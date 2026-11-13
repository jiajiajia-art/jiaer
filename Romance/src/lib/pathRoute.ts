/**
 * 人物线路 → 可视化路线节点。
 * 功能注释：优先读线路关联主线的 nodes 顺序；主线缺失/无节点时用线路手写 routeNodes 兜底。
 * 主线常来自 AI 脏稿，nodes 可能缺失或不是数组，一律当空处理。
 */
export type RouteNode = { id: string; name: string; optional?: boolean };
export type RouteStoryline = { id: string; name?: string; nodes?: { id: string; name?: string; optional?: boolean }[] | null };

export function pathRouteNodes(
  path: { storylineId?: string; routeNodes?: string[] } | null | undefined,
  storylines: RouteStoryline[] | null | undefined,
): RouteNode[] {
  if (!path) return [];
  const line = path.storylineId ? (Array.isArray(storylines) ? storylines : []).find((l) => l?.id === path.storylineId) : undefined;
  const fromLine = (Array.isArray(line?.nodes) ? line!.nodes! : [])
    .filter((n) => n && typeof n === "object" && (n.name || n.id))
    .map((n) => ({ id: String(n.id), name: String(n.name || n.id), optional: !!n.optional }));
  if (fromLine.length) return fromLine;
  return (Array.isArray(path.routeNodes) ? path.routeNodes : [])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((name, i) => ({ id: `r${i}`, name }));
}
