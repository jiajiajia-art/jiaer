/**
 * 条件数组安全读取：AI/脏稿常缺 conds。
 * 编辑器④剧情挂载审计与条件行时，禁止对 undefined 读 .length（会崩页并被 ErrorBoundary 重挂到①基础）。
 * 本文件零依赖，便于 Node 单测直接 import。
 */

/** 功能注释：把可能缺失的条件列表收成数组；非数组一律空数组。 */
export function asCondList<T>(conds: T[] | null | undefined): T[] {
  return Array.isArray(conds) ? conds : [];
}

/** 功能注释：条件组列表；组内 conds 缺失时按空组处理。 */
export function asCondGroups<T extends { conds?: unknown }>(
  groups: T[] | null | undefined,
): Array<T & { conds: unknown[] }> {
  return (Array.isArray(groups) ? groups : []).map((g) => ({
    ...g,
    conds: asCondList(g?.conds as unknown[]),
  }));
}

/**
 * 功能注释：复现「旧代码直读 .conds.length」会炸、新代码不炸。
 * 单测用，禁止在生产路径调用旧写法。
 */
export function wouldThrowOnMissingCondsLength(row: { conds?: unknown } | null | undefined): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void (row as any).conds.length;
    return false;
  } catch {
    return true;
  }
}
