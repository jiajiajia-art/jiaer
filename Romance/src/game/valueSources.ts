import { RAW_STAT_LABELS, RAW_STAT_ORDER, type CreationPath, type StatsSlot } from "./data";
import { BASE_METRICS } from "./fixedEvents";
import { routeAttrId } from "./routeFx";
import type { AttrDef } from "../lib/types";

/* 全局属性池：结局编辑器（触发条件 / 评级维度）与人物线路编辑器共用同一套名称，不另建属性。
 * 名称解析规则与开局时应用线路数值（GameContext）一致：先八维 → 内置指标 → 作品自定义属性 → 都没有则是线路新建属性。
 * 分组（按作者关心程度排序）：
 *   人物线路词条：人物线路「属性 / 声望词条」里作者写过的名字（已解析到真实键）
 *   本作品属性：作品属性表里的自定义属性
 *   引擎内置（兜底）：其余引擎自带数值，仅作后备 */
export type ValueSrc = { kind: "stat" | "metric"; key: string; label: string; group: string };
export const GROUP_ROUTE = "人物线路词条";
export const GROUP_ATTR = "本作品属性";
export const GROUP_BUILTIN = "引擎内置（兜底）";

export function valueSources(opts: { stats?: StatsSlot; attrs?: AttrDef[]; paths?: CreationPath[] }): ValueSrc[] {
  const { stats, attrs = [], paths = [] } = opts;
  const hidden = new Set(stats?.hidden ?? []);
  const order = [...(stats?.order ?? []), ...RAW_STAT_ORDER].filter((k, i, a) => a.indexOf(k) === i && !hidden.has(k));
  const meta = stats?.metaLabels ?? {};
  const builtin: ValueSrc[] = [
    ...order.map((k) => ({ kind: "stat" as const, key: k, label: stats?.labels?.[k]?.trim() || RAW_STAT_LABELS[k], group: GROUP_BUILTIN })),
    ...BASE_METRICS.filter((m) => m.key !== "week").map((m) => ({
      kind: "metric" as const, key: m.key, group: GROUP_BUILTIN,
      label: (m.key === "fame" && meta.fame?.trim()) || (m.key === "stress" && meta.stress?.trim()) || m.label,
    })),
  ];
  const custom: ValueSrc[] = attrs.map((d) => ({ kind: "metric", key: `c:${d.id}`, label: d.label.trim() || d.id, group: GROUP_ATTR }));
  const all = [...builtin, ...custom];

  // 线路里写过的名字：解析到已有键并提到最前；解析不到的按开局规则生成线路属性键
  const routeNames = [...new Set(paths.flatMap((p) => [...(p.fx?.attr ?? []), ...(p.fx?.reputation ?? [])].map((r) => r.name.trim())).filter(Boolean))];
  const route: ValueSrc[] = routeNames.map((n) => {
    const hit = all.find((x) => x.label === n);
    return hit ? { ...hit, group: GROUP_ROUTE } : { kind: "metric", key: `c:${routeAttrId(n)}`, label: n, group: GROUP_ROUTE };
  });
  const taken = new Set(route.map((x) => `${x.kind}:${x.key}`));
  return [...route, ...[...custom, ...builtin].filter((x) => !taken.has(`${x.kind}:${x.key}`))];
}

/* 好感对象：人物线路好感行里出现过的角色排前，其余按角色库顺序 */
export function favorTargets(people: { id: string; name: string }[], paths: CreationPath[] = []) {
  const used = new Set(paths.flatMap((p) => (p.fx?.favor ?? []).map((f) => f.target.trim())));
  const hit = (p: { id: string; name: string }) => used.has(p.name) || used.has(p.id);
  return [...people.filter(hit).map((p) => ({ ...p, fromRoute: true })), ...people.filter((p) => !hit(p)).map((p) => ({ ...p, fromRoute: false }))];
}

export const srcValue = (s: { kind: string; key: string }) => `${s.kind}:${s.key}`;
