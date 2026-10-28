/* ————— 地点树：多级嵌套子地点（纯函数，不依赖注册表）—————
 * 每个地点仍是 rooms 表里的一条独立记录；parent 指向上层地点（空 = 顶层）。
 * 层级不限；所有遍历都带防环保护，坏数据也不会死循环。 */
import type { RoomContent } from "../worlds/star2005/content";

type Rooms = Record<string, RoomContent>;

/* 从根到自身的路径（含自身）：梅花庵 → 后院 → 禅房 */
export function pathOf(rooms: Rooms, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let cur: string | undefined = id;
  while (cur && rooms[cur] && !seen.has(cur)) {
    seen.add(cur);
    out.unshift(cur);
    const p: string | undefined = rooms[cur].parent;
    cur = p && rooms[p] ? p : undefined;
  }
  return out;
}

export const parentOf = (rooms: Rooms, id: string): string | undefined => {
  const p = rooms[id]?.parent;
  return p && rooms[p] && p !== id ? p : undefined;
};

/* 直接子地点（按 order、再按原顺序） */
export function childrenOf(rooms: Rooms, id: string): string[] {
  const ids = Object.keys(rooms).filter((x) => x !== id && rooms[x].parent === id);
  return ids.map((x, i) => [x, rooms[x].order ?? i] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x);
}

/* 顶层地点：没有有效父地点；坏数据成环时，环上路径的最顶端也当作根展示，免得整枝消失 */
export const rootsOf = (rooms: Rooms): string[] => Object.keys(rooms).filter((x) => !parentOf(rooms, x) || (pathOf(rooms, x)[0] === x));

/* 整枝（含自身）的全部地点 id */
export function subtreeOf(rooms: Rooms, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (x: string) => { if (seen.has(x)) return; seen.add(x); out.push(x); childrenOf(rooms, x).forEach(walk); };
  walk(id);
  return out;
}

/* a 是否在 b 这一枝内（a === b 也算） */
export const isWithin = (rooms: Rooms, a: string, b: string): boolean => pathOf(rooms, a).includes(b);

/* 同一棵地点树（顶层根相同）——树内移动视为「走几步路」，不算出远门 */
export const sameTree = (rooms: Rooms, a: string, b: string): boolean => {
  const ra = pathOf(rooms, a)[0], rb = pathOf(rooms, b)[0];
  return !!ra && ra === rb && (!!rooms[a]?.parent || !!rooms[b]?.parent);
};

/* 把 id 设为 parent 的子地点是否会形成环（parent 本身在 id 这一枝内） */
export const wouldCycle = (rooms: Rooms, id: string, parent: string | undefined): boolean => !!parent && (parent === id || isWithin(rooms, parent, id));

/* 复制整枝：返回新增的地点记录（新 id，内部 parent 与相互出口重映射；顶层挂到原父节点下） */
export function cloneBranch(rooms: Rooms, id: string, newId: (old: string) => string, nameSuffix = "（副本）"): { added: Rooms; rootId: string } {
  const ids = subtreeOf(rooms, id);
  const map = new Map(ids.map((x) => [x, newId(x)] as const));
  const added: Rooms = {};
  for (const x of ids) {
    const r = rooms[x];
    const exits = Object.fromEntries(Object.entries(r.exits ?? {}).filter(([, to]) => to && map.has(to)).map(([d, to]) => [d, map.get(to!)!]));
    added[map.get(x)!] = {
      ...structuredClone(r),
      exits,
      parent: x === id ? r.parent : map.get(r.parent!) ?? r.parent,
      name: x === id ? `${r.name ?? x}${nameSuffix}` : r.name,
      order: x === id ? (r.order ?? 0) + 0.5 : r.order,
    };
  }
  return { added, rootId: map.get(id)! };
}
