/**
 * 存档 ↔ 玩法包版本：开局记下本局合并链里每个包的版本，读档时与当前对比，给玩家一次提示。
 * 物品备忘：背包只存物品 id，卸包后定义消失会变成空格子；存档顺带记住名字 / 图标 / 来源包，
 * 卸包后仍能显示「来自已移除的玩法」，重装后自动恢复正常。纯函数，无运行时依赖。
 */
export type ModStampEntry = { id: string; name: string; version: string };
export type ItemMemoEntry = { name: string; icon?: string; desc?: string; mod?: string; modName?: string };
export type ItemMemo = Record<string, ItemMemoEntry>;

type ChainLike = { id: string; name?: string; version?: string }[];

/** 功能注释：只记叠加包（玩法）；世界本体变动不在这里提示 */
export function stampFromChain(chain: ChainLike): ModStampEntry[] {
  return chain.slice(1).map((m) => ({ id: m.id, name: m.name || m.id, version: m.version || "0.0.0" }));
}

export type ModStampDiff = { removed: ModStampEntry[]; added: ModStampEntry[]; changed: { id: string; name: string; from: string; to: string }[] };

export function diffModStamp(prev: ModStampEntry[] | undefined, cur: ModStampEntry[]): ModStampDiff {
  const empty: ModStampDiff = { removed: [], added: [], changed: [] };
  if (!Array.isArray(prev)) return empty; // 老存档没有记录：不提示，只补记
  const p = new Map(prev.filter((x) => x && x.id).map((x) => [x.id, x]));
  const c = new Map(cur.map((x) => [x.id, x]));
  for (const [id, x] of p) if (!c.has(id)) empty.removed.push(x);
  for (const [id, x] of c) {
    const old = p.get(id);
    if (!old) empty.added.push(x);
    else if (old.version !== x.version) empty.changed.push({ id, name: x.name, from: old.version, to: x.version });
  }
  return empty;
}

export function describeModStampDiff(d: ModStampDiff): string[] {
  const out: string[] = [];
  for (const x of d.removed) out.push(`「${x.name}」已移除：它加的地点、事件和页面不再出现，已获得的物品仍保留在行囊里。`);
  for (const x of d.added) out.push(`新增玩法「${x.name}」（v${x.version}），从现在起生效。`);
  for (const x of d.changed) out.push(`「${x.name}」已从 v${x.from} 更新到 v${x.to}。`);
  return out;
}

/**
 * 功能注释：为背包里当前能解析的物品刷新备忘；解析不到的保留旧备忘（卸包残留）。
 * 背包里没有了的物品从备忘里删掉。无变化时返回原对象，便于调用方跳过写入。
 */
export function refreshItemMemo(
  bag: string[] | undefined,
  memo: ItemMemo | undefined,
  lookup: (id: string) => ItemMemoEntry | undefined,
): ItemMemo | undefined {
  const ids = Array.isArray(bag) ? bag : [];
  const prev = memo ?? {};
  const next: ItemMemo = {};
  let changed = Object.keys(prev).some((id) => !ids.includes(id));
  for (const id of ids) {
    const live = lookup(id);
    if (live) {
      next[id] = live;
      const o = prev[id];
      if (!o || o.name !== live.name || o.icon !== live.icon || o.mod !== live.mod || o.desc !== live.desc) changed = true;
    } else if (prev[id]) next[id] = prev[id];
  }
  if (!changed) return memo;
  return Object.keys(next).length ? next : undefined;
}
