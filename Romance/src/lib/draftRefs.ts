/**
 * 模组编辑器「只读当前表单」的引用池：人物 / 地点 / 物品 / 属性 / 阵营。
 * 功能注释：编辑器下拉与默认值只能来自正在编辑的作品草稿；草稿为空就保持空，
 * 禁止回退到内置娱乐圈世界（LIVE_PEOPLE / LIVE_LOCATIONS / star2005）。
 */
import type { ValueSrc } from "../game/valueSources";

export type DraftRefOpt = { id: string; name: string };
export type DraftRefs = {
  people: DraftRefOpt[];
  rooms: DraftRefOpt[];
  items: DraftRefOpt[];
  factions?: DraftRefOpt[];
  /** 本作品自定义属性（对应条件/效果里的 c:<id> 指标） */
  attrs: { id: string; label?: string }[];
  /** 本作品可用的主角属性键（可空：不预选） */
  statKeys?: string[];
  /** 本作品数值来源（主角属性 + 指标 + 自定义属性），供条件/效果下拉；缺省才退回引擎内置列表 */
  srcs?: ValueSrc[];
  /** 本作品已声明的指标键（见 workMetricKeys）；用于只提供依赖指标齐全的预设/模板 */
  metricKeys?: string[];
};

export const EMPTY_DRAFT_REFS: DraftRefs = { people: [], rooms: [], items: [], factions: [], attrs: [] };

const firstId = (list: { id: string }[] | undefined): string => String(list?.[0]?.id ?? "");

/** 功能注释：新建条件/效果时的默认引用；列表为空返回 ""（不预选），绝不借用别的世界。 */
export function draftRefDefaults(refs: DraftRefs) {
  const firstAttr = String(refs.attrs?.[0]?.id ?? "").trim();
  return {
    rel: firstId(refs.people),
    relSet: (refs.people ?? []).slice(0, 2).map((p) => p.id),
    location: firstId(refs.rooms),
    item: firstId(refs.items),
    faction: firstId(refs.factions),
    /** 指标：只取本作品第一个自定义属性；没有属性就不自动填 */
    metric: firstAttr ? `c:${firstAttr}` : "",
    stat: String(refs.statKeys?.[0] ?? ""),
  };
}

/** 功能注释：把表单里的 rooms 记录 / npcs / 物品整理成 DraftRefs（不碰任何 LIVE_*）。 */
export function buildDraftRefs(input: {
  npcs?: { id: string; name?: string }[];
  rooms?: Record<string, { name?: string; items?: { id: string; name?: string }[] }>;
  items?: { id: string; name?: string }[];
  factions?: { id: string; name?: string }[];
  attrs?: { id: string; label?: string }[];
  statKeys?: string[];
  srcs?: ValueSrc[];
  metricKeys?: string[];
}): DraftRefs {
  const rooms = input.rooms ?? {};
  const roomItems = Object.values(rooms).flatMap((r) => (Array.isArray(r?.items) ? r.items : []));
  const seen = new Set<string>();
  const items = [...(input.items ?? []), ...roomItems]
    .filter((i) => i && i.id && !seen.has(i.id) && !!seen.add(i.id))
    .map((i) => ({ id: i.id, name: i.name || i.id }));
  return {
    people: (input.npcs ?? []).map((n) => ({ id: n.id, name: n.name || n.id })),
    rooms: Object.entries(rooms).map(([id, r]) => ({ id, name: r?.name || id })),
    items,
    factions: (input.factions ?? []).map((f) => ({ id: f.id, name: f.name || f.id })),
    attrs: Array.isArray(input.attrs) ? input.attrs : [],
    statKeys: input.statKeys,
    srcs: input.srcs,
    metricKeys: input.metricKeys,
  };
}
