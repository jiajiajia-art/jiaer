import type { MapEdits, MapSpotEdit } from "../lib/types";
import { mapSheets } from "./mapSheets";

/* 公共地图：通用题材模板。套用时新建一张底图并放上这些自建地点（依次相连，首个连到开局地点），不覆盖已有内容 */
type P = { name: string; desc: string; x: number; y: number; icon?: string };
export type PublicMap = { id: string; name: string; tag: string; spots: P[] };

export const PUBLIC_MAPS: PublicMap[] = [
  { id: "mansion", name: "宅院通用地图", tag: "古风 · 府邸", spots: [
    { name: "正门", desc: "朱漆大门，门房在侧，来客由此通报。", x: 50, y: 90, icon: "🚪" },
    { name: "前院", desc: "青石铺地，影壁当中，下人往来洒扫。", x: 50, y: 72 },
    { name: "正厅", desc: "待客议事之所，主位高悬匾额。", x: 50, y: 52, icon: "🏮" },
    { name: "书房", desc: "藏书满架，案上笔墨未干。", x: 24, y: 46, icon: "📜" },
    { name: "厨房", desc: "灶火不熄，烟气里有家长里短。", x: 78, y: 64 },
    { name: "闺房", desc: "绣帘低垂，窗下一盆兰草。", x: 28, y: 22 },
    { name: "后花园", desc: "假山池塘，月下最宜私语。", x: 62, y: 22, icon: "🌸" },
    { name: "祠堂", desc: "供奉先祖牌位，家法在此施行。", x: 86, y: 30 },
  ] },
  { id: "palace", name: "皇宫通用地图", tag: "古风 · 宫廷", spots: [
    { name: "宫门", desc: "禁军森严，入宫需验腰牌。", x: 50, y: 92, icon: "🏯" },
    { name: "金銮殿", desc: "早朝议政之所，百官列班。", x: 50, y: 62, icon: "👑" },
    { name: "御书房", desc: "皇帝批阅奏折处，闲人不得近前。", x: 26, y: 54 },
    { name: "后宫", desc: "嫔妃居所，暗流涌动。", x: 50, y: 32 },
    { name: "冷宫", desc: "荒草萋萋，失宠之人的归处。", x: 86, y: 18 },
    { name: "御花园", desc: "四季花开，宫人偶遇之地。", x: 22, y: 22, icon: "🌺" },
    { name: "太医院", desc: "药香弥漫，也藏着宫闱秘密。", x: 78, y: 56 },
  ] },
  { id: "street", name: "街道", tag: "现代 · 城市", spots: [
    { name: "街口", desc: "红绿灯下人来人往。", x: 12, y: 60 },
    { name: "便利店", desc: "二十四小时亮着灯。", x: 30, y: 44, icon: "🏪" },
    { name: "咖啡馆", desc: "落地窗边总有人在等人。", x: 48, y: 62, icon: "☕" },
    { name: "公园", desc: "长椅、梧桐与晨跑的人。", x: 66, y: 36, icon: "🌳" },
    { name: "地铁站", desc: "通往城市各处的入口。", x: 86, y: 58, icon: "🚇" },
  ] },
  { id: "fantasy", name: "西幻通用地图", tag: "西幻 · 冒险", spots: [
    { name: "王城", desc: "白石城墙，旗帜猎猎。", x: 50, y: 50, icon: "🏰" },
    { name: "冒险者公会", desc: "委托板前挤满了佣兵。", x: 34, y: 60, icon: "⚔" },
    { name: "魔法学院", desc: "尖塔林立，星光终夜不灭。", x: 70, y: 30, icon: "✨" },
    { name: "迷雾森林", desc: "传说精灵在林中游荡。", x: 18, y: 26, icon: "🌲" },
    { name: "龙之巢穴", desc: "焦土与金币，危险至极。", x: 86, y: 80, icon: "🐉" },
  ] },
];

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** 把一组地点作为自建地点放进地图；sheet 缺省=新建一张以 name 命名的底图 */
export function addSpots(edits: MapEdits, spots: P[], opt: { sheetName?: string; sheet?: string; link?: string }): MapEdits {
  const next: MapEdits = { ...edits };
  let sheet = opt.sheet;
  if (!sheet && opt.sheetName) {
    sheet = uid("sheet_");
    const cur = mapSheets(edits._config);
    next._config = { ...(edits._config ?? {}), sheets: [...cur.map((x) => (x.id === "main" ? { id: x.id, name: x.name } : x)), { id: sheet, name: opt.sheetName }] };
  }
  let prev = opt.link;
  for (const sp of spots) {
    const id = uid("cus_");
    next[id] = { custom: true, name: sp.name, desc: sp.desc, x: sp.x, y: sp.y, icon: sp.icon, link: prev, sheet: sheet === "main" ? undefined : sheet } satisfies MapSpotEdit;
    prev = id;
  }
  return next;
}

/** 从文本解析：每行「名称：备注」或「名称 - 备注」，也接受顿号/逗号分隔的一行名称 */
export function parseSpots(text: string): P[] {
  const lines = text.split(/\n/).map((l) => l.trim().replace(/^[\d.、)）\-*•\s]+/, "")).filter(Boolean);
  const raw = lines.length === 1 && !/[:：]/.test(lines[0]) ? lines[0].split(/[、，,；;]/).map((n) => ({ name: n.trim(), desc: "" }))
    : lines.map((l) => { const m = l.match(/^(.+?)\s*[:：—–-]\s*(.*)$/); return m ? { name: m[1].trim(), desc: m[2].trim() } : { name: l, desc: "" }; });
  const list = raw.filter((r) => r.name).slice(0, 40);
  const cols = Math.ceil(Math.sqrt(list.length));
  const rows = Math.ceil(list.length / cols);
  return list.map((r, i) => ({ ...r, x: Math.round(((i % cols) + 0.5) / cols * 80 + 10), y: Math.round((Math.floor(i / cols) + 0.5) / rows * 70 + 18) }));
}
