/**
 * 玩法 Mod 守卫：纯函数，无运行时依赖（工坊保存 / 上传 / 合并链路共用）。
 * - 世界本体字段拦截：玩法包只扩展玩法，不得改世界的人设底子
 * - 扩展配置区推导：按包里实际写了哪些槽，决定装进世界后打开哪些配置面板
 * - 撞名检测：未声明 override 却与世界 / 其它包同 id 的条目
 * - 依赖排序：拓扑排序 + 环检测
 */
import type { ModContent } from "./types";
import type { PlayModEditorPanelId } from "./playModCatalog";

/** 功能注释：玩法包禁止写的世界本体字段 → 中文说明 */
export const PLAY_MOD_FORBIDDEN_FIELDS: Record<string, string> = {
  worldBook: "世界书",
  lore: "详细设定",
  festivals: "节日设定",
  prompt: "剧本基调 / 提示词",
  terms: "术语表",
  startDate: "开局日期",
  startMoney: "开局资金",
  moneyLabel: "货币名",
  startRoom: "开局地点",
  startMet: "开局结识人物",
  creation: "建角页",
  styles: "建角外形池",
  identities: "建角身份池",
  backgrounds: "建角家庭背景",
  directions: "建角职业方向",
  school: "母校",
  parentJobs: "父母职业池",
  opening: "开场",
  cover: "作品封面",
  theme: "界面风格",
  imageGen: "作品画风",
  timeLimit: "本局时限",
  navTabs: "底栏页签",
  navSize: "底栏格数",
  playModInstalls: "玩法安装记录",
  phoneAppsCfg: "手机应用安装",
  phoneHomeWallpaper: "手机壁纸",
  phoneCommSkin: "通讯皮肤",
};

export function forbiddenPlayFields(content: ModContent | undefined): string[] {
  if (!content || typeof content !== "object") return [];
  return Object.keys(content).filter((k) => k in PLAY_MOD_FORBIDDEN_FIELDS && (content as Record<string, unknown>)[k] !== undefined);
}

/** 功能注释：剥掉世界本体字段，返回干净内容与被剥掉的字段 */
export function stripForbiddenPlayFields(content: ModContent | undefined): { content: ModContent; removed: string[] } {
  const removed = forbiddenPlayFields(content);
  if (!removed.length) return { content: content ?? {}, removed };
  const out: Record<string, unknown> = { ...content };
  for (const k of removed) delete out[k];
  return { content: out as ModContent, removed };
}

export const forbiddenFieldLabels = (fields: string[]) => fields.map((k) => PLAY_MOD_FORBIDDEN_FIELDS[k] ?? k);

/**
 * 功能注释：工坊里改动「底层世界已有条目」属于有意覆盖——给这些条目补 override:true，
 * 加载报告就不会把它们当成误撞名；与其它玩法包的意外撞名仍会被报出来。
 */
export function markBaseOverrides(content: ModContent, base: ModContent | undefined): ModContent {
  if (!base) return content;
  const baseIdx = idIndex(base);
  const out: Record<string, unknown> = { ...content };
  for (const [slot, v] of Object.entries(content)) {
    const ids = baseIdx.get(slot);
    if (!ids) continue;
    if (slot === "rooms" && v && typeof v === "object" && !Array.isArray(v)) {
      const rooms: Record<string, unknown> = {};
      for (const [id, r] of Object.entries(v as Record<string, Row>)) rooms[id] = ids.has(id) && r && typeof r === "object" && !r.override ? { ...r, override: true } : r;
      out[slot] = rooms;
    } else if (Array.isArray(v)) {
      out[slot] = (v as Row[]).map((r) => (r && typeof r === "object" && typeof r.id === "string" && ids.has(r.id) && !r.override ? { ...r, override: true } : r));
    }
  }
  return out as ModContent;
}

/** 功能注释：内容槽 → 世界编辑器扩展配置区 */
const SLOT_PANEL: [string, PlayModEditorPanelId][] = [
  ["gigs", "gigs"], ["gigPrices", "gigs"], ["gigConfig", "gigs"],
  ["contracts", "contracts"], ["projects", "projects"], ["industry", "industry"],
  ["imageCrisis", "imageCrisis"], ["weeklyPaper", "weeklyPaper"], ["meals", "meals"],
  ["pregnancy", "pregnancy"], ["travel", "travel"], ["cars", "cars"],
  ["titles", "titles"], ["relations", "relations"],
];

const hasValue = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : v && typeof v === "object" ? Object.keys(v).length > 0 : v !== undefined && v !== null && v !== "";

export function derivePlayModEditorPanels(content: ModContent | undefined): PlayModEditorPanelId[] {
  if (!content || typeof content !== "object") return [];
  const c = content as Record<string, unknown>;
  const out = new Set<PlayModEditorPanelId>();
  for (const [slot, panel] of SLOT_PANEL) if (hasValue(c[slot])) out.add(panel);
  if (content.features?.factionRep) out.add("factionRep");
  if (content.features?.relationsPlay) out.add("relations");
  return [...out];
}

export const PLAY_MOD_PANEL_LABEL: Record<PlayModEditorPanelId, string> = {
  gigs: "通告库", contracts: "合约", projects: "项目", industry: "行业生态", imageCrisis: "舆情",
  weeklyPaper: "周报", meals: "生活开销", pregnancy: "孕育", travel: "出行", cars: "座驾",
  titles: "头衔", relations: "关系玩法", factionRep: "阵营声望", phoneApp: "手机应用",
};

/* —— 撞名检测 —— */
export type IdClash = { slot: string; id: string; with: string };
type Row = { id?: unknown; override?: unknown };

/** 功能注释：收集一份内容里所有「按 id 合并」的条目：slot → id → 是否声明 override */
function idIndex(content: ModContent | undefined): Map<string, Map<string, boolean>> {
  const idx = new Map<string, Map<string, boolean>>();
  if (!content || typeof content !== "object") return idx;
  for (const [slot, v] of Object.entries(content)) {
    if (slot in PLAY_MOD_FORBIDDEN_FIELDS) continue;
    const ids = new Map<string, boolean>();
    if (slot === "rooms" && v && typeof v === "object" && !Array.isArray(v)) {
      for (const [id, r] of Object.entries(v as Record<string, Row>)) ids.set(id, !!r?.override);
    } else if (Array.isArray(v)) {
      for (const r of v as Row[]) if (r && typeof r === "object" && typeof r.id === "string" && r.id) ids.set(r.id, !!r.override);
    }
    if (ids.size) idx.set(slot, ids);
  }
  return idx;
}

/**
 * 功能注释：pack 里与 bases 同 id、却没写 override:true 的条目。
 * bases 按加载顺序传入（世界在前），每条冲突只报第一个撞上的来源。
 */
export function findIdClashes(pack: ModContent | undefined, bases: { name: string; content: ModContent | undefined }[]): IdClash[] {
  const mine = idIndex(pack);
  const out: IdClash[] = [];
  const seen = new Set<string>();
  for (const b of bases) {
    const theirs = idIndex(b.content);
    for (const [slot, ids] of mine) {
      const other = theirs.get(slot);
      if (!other) continue;
      for (const [id, override] of ids) {
        const key = `${slot}\u0000${id}`;
        if (override || seen.has(key) || !other.has(id)) continue;
        seen.add(key);
        out.push({ slot, id, with: b.name });
      }
    }
  }
  return out;
}

/* —— 依赖排序（Kahn + 稳定：同层保持原顺序） —— */

/** 功能注释：平台 SDK（玩法运行时）版本；上传包写 compatMin，安装时按区间判断 */
export const PLAY_MOD_SDK_VERSION = "1.0.0";

export function cmpSemver(a: string, b: string): number {
  const pa = String(a).split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export function sanitizeConflictIds(v: unknown, selfId?: string): string[] {
  if (!Array.isArray(v)) return [];
  const out = v.map((x) => String(x ?? "").trim().toLowerCase()).filter((x) => /^[a-z0-9][a-z0-9_-]{1,48}$/.test(x) && x !== selfId);
  return [...new Set(out)].slice(0, 20);
}

type InstallableLike = { slug: string; id?: string; name: string; conflictsWith?: string[]; compatMin?: string; compatMax?: string };

/**
 * 功能注释：安装前阻断原因（null = 可装）。
 * - SDK 版本不在 compatMin~compatMax
 * - 双向互斥：它声明与已装包冲突，或已装包声明与它冲突
 */
export function playModInstallBlock(
  item: InstallableLike,
  installedSlugs: string[],
  lookup: (slug: string) => InstallableLike | undefined,
  sdk: string = PLAY_MOD_SDK_VERSION,
): string | null {
  if (item.compatMin && cmpSemver(sdk, item.compatMin) < 0) return `需要更新的平台版本（≥ ${item.compatMin}），当前 ${sdk}`;
  if (item.compatMax && cmpSemver(sdk, item.compatMax) > 0) return `只支持到平台 ${item.compatMax}，当前 ${sdk}，等作者更新`;
  const keys = new Set([item.slug, item.id].filter(Boolean) as string[]);
  for (const slug of installedSlugs) {
    if (keys.has(slug)) continue;
    const other = lookup(slug);
    const otherKeys = new Set([slug, other?.id].filter(Boolean) as string[]);
    const mine = (item.conflictsWith ?? []).some((c) => otherKeys.has(c));
    const theirs = (other?.conflictsWith ?? []).some((c) => keys.has(c));
    if (mine || theirs) return `与已添加的「${other?.name ?? slug}」互斥，需先移除它`;
  }
  return null;
}

export function sortByDeps(ids: string[], depsOf: (id: string) => string[]): { order: string[]; cycle: string[] } {
  const uniq = [...new Set(ids)];
  const set = new Set(uniq);
  const indeg = new Map(uniq.map((id) => [id, 0]));
  const next = new Map<string, string[]>(uniq.map((id) => [id, []]));
  for (const id of uniq) {
    for (const d of new Set(depsOf(id))) {
      if (d === id || !set.has(d)) continue;
      next.get(d)!.push(id);
      indeg.set(id, indeg.get(id)! + 1);
    }
  }
  const order: string[] = [];
  const done = new Set<string>();
  // 功能注释：每轮取原顺序里第一个入度为 0 的，保证作者的安装顺序在不违反依赖时生效
  while (order.length < uniq.length) {
    const pick = uniq.find((id) => !done.has(id) && indeg.get(id) === 0);
    if (!pick) break;
    done.add(pick);
    order.push(pick);
    for (const n of next.get(pick)!) indeg.set(n, indeg.get(n)! - 1);
  }
  return { order, cycle: uniq.filter((id) => !done.has(id)) };
}
