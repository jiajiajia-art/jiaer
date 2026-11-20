/* 剧情解析出的「新地点」：识别正式地名 → 在本局存档 mapEdits 里叠加一个自建点 → 从素材库按相似度挑场景图。
 * 纯函数、不依赖世界注册表，便于单测；只改本局 mapEdits，不动作者世界编辑器里的原地图定稿。 */
import type { MapEdits, MapSpotEdit } from "./types.ts";

/** 占位词 / 方位词：不是正式地名，禁止据此建点 */
const PLACEHOLDER = /^(某处|某地|某个地方|外面|外头|这里|这儿|那里|那儿|附近|远处|别处|别的地方|不远处|路上|途中|未知|未知地点|新地点|未命名|无|不详|原地|室内|室外|街上|门外|门口外)$/;

/**
 * 功能注释：判断 AI 写出的 world.location 是否是可建点的「正式地名」。
 * 输入地名；输出 true 才允许自动建点。含句读 / 过长 / 纯占位词 / 含「新地点」均视为非正式。
 */
export function isFormalPlaceName(name: string | undefined | null): boolean {
  const n = (name ?? "").trim();
  if (n.length < 2 || n.length > 16) return false;
  if (PLACEHOLDER.test(n) || /新地点/.test(n)) return false;
  if (/[，。！？；：,.!?;:\n]/.test(n)) return false;
  if (/^[\d\s]+$/.test(n)) return false;
  return true;
}

/** 合格的地点说明句：AI 简介优先，否则用「你来到了「地名」。」；永远不带「新地点」占位 */
export function spotDescFor(name: string, aiDesc?: string): string {
  const d = (aiDesc ?? "").trim();
  if (d && !/新地点/.test(d)) return d;
  return `你来到了「${name}」。`;
}

/**
 * 功能注释：「你来到了「地名」。」是提示词用的进入脚手架，不是给玩家看的正文。
 * 整句命中（含无书名号变体）视为样板句，界面应隐藏。
 */
export function isArrivalBoilerplate(text: string | undefined | null, placeName?: string): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  const esc = (placeName ?? ".+?").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^你来到了[「"']?${esc}[」"']?[。.!！…]*$`).test(t);
}

/** 自建地点 id：按地名生成稳定短哈希，同名只会得到同一 id（同日 / 同名只建一次） */
export function customSpotIdFor(name: string): string {
  let h = 0;
  for (const ch of name.trim()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `cus_ai_${h.toString(36)}`;
}

/** 功能注释：太泛的场所词不能单独当「同一个地点」 */
const GENERIC_PLACE = /^(公寓|宿舍|别墅|酒店|旅馆|民宿|宾馆|大厦|大楼|小区|房间|卧室|客厅|厨房|书房|浴室|家|屋|室|楼|馆|店|铺|吧|厅)$/;

/**
 * 功能注释：地名可比对的几种写法。去掉行政区前缀（巴黎第16区·）和「的」，
 * 「曦瑶的公寓」与「巴黎第16区·曦瑶公寓」会得到同一个「曦瑶公寓」。
 */
export function placeKeys(name: string): string[] {
  const raw = name.trim().replace(/\s+/g, "");
  if (raw.length < 2) return [];
  const chunks = raw.split(/[·・•.|/／\-—]/).map((s) => s.trim()).filter((s) => s.length >= 2);
  const keys = new Set<string>();
  for (const s of [raw, ...chunks]) {
    keys.add(s);
    keys.add(s.replace(/的(?=公寓|宿舍|别墅|酒店|旅馆|民宿|宾馆|大厦|大楼|小区|房间|卧室|客厅|厨房|书房|浴室|宅|府|苑|屋|室|楼|馆|店|铺|吧|厅|家)/g, ""));
  }
  return [...keys].filter((k) => k.length >= 2);
}

/** 功能注释：两个地名是不是同一个地方。全等、去掉「的」和区域前缀后全等，或较短的一侧被较长的一侧包含。 */
export function samePlaceName(a: string, b: string): boolean {
  const ak = placeKeys(a);
  const bk = placeKeys(b);
  for (const x of ak) {
    for (const y of bk) {
      if (x === y) return true;
      const short = x.length <= y.length ? x : y;
      const long = x.length <= y.length ? y : x;
      if (short.length < 3 || GENERIC_PLACE.test(short)) continue;
      if (long.includes(short)) return true;
    }
  }
  return false;
}

/**
 * 功能注释：把新地点叠进本局 mapEdits（custom 自建点，link 连回转场前房间，保证可寻路返回）。
 * 已存在同 id 时原样返回（不覆盖作者 / 玩家已改的坐标、图片、说明）。
 */
export function addAutoSpot(
  edits: MapEdits | undefined,
  opt: { name: string; desc?: string; link?: string; background?: string },
): { edits: MapEdits; id: string; created: boolean } {
  const id = customSpotIdFor(opt.name);
  const cur: MapEdits = edits ?? {};
  if (cur[id]) return { edits: cur, id, created: false };
  const count = Object.keys(cur).filter((k) => k !== "_config" && (cur[k] as MapSpotEdit)?.custom).length;
  // 功能注释：围绕地图中心按序号错开摆放，避免新点叠在一起；坐标只是初值，之后可在编辑器里调
  const angle = (count % 8) * (Math.PI / 4);
  const ring = 22 + Math.floor(count / 8) * 8;
  const spot: MapSpotEdit = {
    custom: true,
    name: opt.name.trim(),
    desc: spotDescFor(opt.name.trim(), opt.desc),
    link: opt.link,
    x: Math.round(50 + Math.cos(angle) * ring),
    y: Math.round(50 + Math.sin(angle) * ring),
    unlock: "story",
    ...(opt.background ? { background: opt.background } : {}),
  };
  return { edits: { ...cur, [id]: spot }, id, created: true };
}

/* —— 素材库相似匹配（场景图） —— */
export type SceneAssetLite = { name: string; description?: string; imageUrl: string; tags?: string[] };

const bigrams = (s: string): Set<string> => {
  const t = s.replace(/\s+/g, "").toLowerCase();
  const out = new Set<string>();
  if (t.length === 1) out.add(t);
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};
const dice = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const x of a) if (b.has(x)) hit++;
  return (2 * hit) / (a.size + b.size);
};

/** 低于此分数放弃匹配，宁可无图也不配错图 */
export const SCENE_MATCH_MIN_SCORE = 0.3;

/**
 * 功能注释：为新地点从素材库挑 Top-1 场景图。
 * 顺序：名称全等 → 名称互含 → 标签 / 描述与地名词、题材关键词的 2-gram 相似度；分数过低返回 undefined。
 */
export function pickSimilarSceneAsset(
  placeName: string,
  assets: SceneAssetLite[],
  opt: { desc?: string; worldKeywords?: string[] } = {},
): SceneAssetLite | undefined {
  const q = placeName.trim().toLowerCase();
  if (!q || !assets.length) return undefined;
  const usable = assets.filter((a) => a.imageUrl?.trim());
  const exact = usable.find((a) => a.name.trim().toLowerCase() === q);
  if (exact) return exact;
  const contain = usable
    .filter((a) => {
      const n = a.name.trim().toLowerCase();
      return n.length >= 2 && (n.includes(q) || q.includes(n) || samePlaceName(placeName, a.name));
    })
    .sort((a, b) => Math.abs(a.name.length - q.length) - Math.abs(b.name.length - q.length))[0];
  if (contain) return contain;
  const qGrams = bigrams([placeName, opt.desc ?? "", ...(opt.worldKeywords ?? [])].join(" "));
  const nameGrams = bigrams(placeName);
  let best: { a: SceneAssetLite; score: number } | undefined;
  for (const a of usable) {
    const hay = bigrams([a.name, a.description ?? "", ...(a.tags ?? [])].join(" "));
    // 地名本身的相似权重更高，题材词只做辅助
    const score = dice(nameGrams, hay) * 0.7 + dice(qGrams, hay) * 0.3;
    if (!best || score > best.score) best = { a, score };
  }
  return best && best.score >= SCENE_MATCH_MIN_SCORE ? best.a : undefined;
}
