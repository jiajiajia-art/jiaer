import { RAW_STAT_ORDER, type CreationPath, type StatsSlot } from "./data";
import { BASE_METRICS } from "./fixedEvents";
import { routeAttrId } from "./routeFx";
import type { AttrDef } from "../lib/types";
import { resolveAttrRef as resolveAttrRefRaw } from "./attrRef";

/* 全局属性池：结局编辑器（触发条件 / 评级维度）与人物线路编辑器共用同一套名称，不另建属性。
 * 名称解析规则与开局时应用线路数值（GameContext）一致：先八维 → 内置指标 → 作品自定义属性 → 都没有则是线路新建属性。
 * 分组（按作者关心程度排序）：
 *   人物线路词条：人物线路「属性 / 声望词条」里作者写过的名字（已解析到真实键）
 *   本作品属性：作品属性表里的自定义属性
 *   引擎内置（兜底）：其余引擎自带数值，仅作后备 */
export type ValueSrc = { kind: "stat" | "metric"; key: string; label: string; group: string };
export const GROUP_ROUTE = "人物线路词条";
export const GROUP_ATTR = "本作品属性";
export const GROUP_BUILTIN = "货币";

/** 功能注释：AI 常漏写 label/name，直接 .trim() 会在角色页 map 里崩成 reading 'trim' */
function cellText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  return "";
}

function rowList(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

export function valueSources(opts: {
  stats?: StatsSlot;
  attrs?: AttrDef[];
  paths?: CreationPath[];
  /** 功能注释：已不再区分题材，保留参数只为兼容旧调用 */
  entBase?: boolean;
  moneyLabel?: string;
}): ValueSrc[] {
  const attrs = Array.isArray(opts.attrs) ? opts.attrs : [];
  const paths = Array.isArray(opts.paths) ? opts.paths : [];
  // 功能注释：任何题材（含娱乐圈）都不列引擎内置属性（演技 / 歌艺等八维、名气 / 口碑 / 黑粉 / 压力 / 精力等）；
  // 只保留作品货币，属性一律来自本作品属性表与人物线路
  const builtin: ValueSrc[] = [
    { kind: "metric", key: "money", label: cellText(opts.moneyLabel) || BASE_METRICS.find((m) => m.key === "money")?.label || "现金", group: GROUP_BUILTIN },
  ];
  const custom: ValueSrc[] = attrs.map((d) => ({ kind: "metric", key: `c:${d.id}`, label: cellText(d?.label) || d?.id || "属性", group: GROUP_ATTR }));
  const all = [...builtin, ...custom];

  // 线路里写过的名字：解析到已有键并提到最前；解析不到的按开局规则生成线路属性键
  const routeNames = [...new Set(paths.flatMap((p) => [...rowList(p?.fx?.attr), ...rowList(p?.fx?.reputation)].map((r) => cellText((r as { name?: unknown } | null)?.name))).filter(Boolean))];
  const route: ValueSrc[] = routeNames.map((n) => {
    const hit = all.find((x) => x.label === n);
    return hit ? { ...hit, group: GROUP_ROUTE } : { kind: "metric", key: `c:${routeAttrId(n)}`, label: n, group: GROUP_ROUTE };
  });
  const taken = new Set(route.map((x) => `${x.kind}:${x.key}`));
  return [...route, ...[...custom, ...builtin].filter((x) => !taken.has(`${x.kind}:${x.key}`))];
}

/* 好感对象：人物线路好感行里出现过的角色排前，其余按角色库顺序 */
export function favorTargets(people: { id: string; name: string }[], paths: CreationPath[] = []) {
  const list = Array.isArray(paths) ? paths : [];
  const used = new Set(list.flatMap((p) => rowList(p?.fx?.favor).map((f) => cellText((f as { target?: unknown } | null)?.target))));
  const hit = (p: { id: string; name: string }) => used.has(p.name) || used.has(p.id);
  return [...people.filter(hit).map((p) => ({ ...p, fromRoute: true })), ...people.filter((p) => !hit(p)).map((p) => ({ ...p, fromRoute: false }))];
}

export const srcValue = (s: { kind: string; key: string }) => `${s.kind}:${s.key}`;

/** 功能注释：带上引擎内置键保护的属性引用纠正 */
export function resolveAttrRef(kind: string, key: string, attrs: { id?: unknown; label?: unknown }[] | undefined) {
  return resolveAttrRefRaw(kind, key, attrs, [...RAW_STAT_ORDER, ...BASE_METRICS.map((m) => m.key)]);
}
