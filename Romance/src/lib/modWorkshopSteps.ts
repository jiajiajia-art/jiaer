/**
 * 功能注释：AI 创意工坊引导步 ↔ tally 下标。玩法步数曾比 key 表多 1，渲染读 undefined[1] 整页崩。
 */

/** 世界观 STEPS 对应 tally 下标（跳过「世界书」「平衡」单独项） */
export const WORLD_STEP_KEY = [0, 1, 2, 3, 4, 6] as const;

/** 玩法 PLAY_STEPS 与 playTally 一一对应（含引擎平衡） */
export const PLAY_STEP_KEY = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** 步骤钮完成态；缺下标/缺 tally 行时当未完成，禁止抛 reading '1' */
export function stepDoneFlag(done: [string, number][], key: number | undefined): boolean {
  if (key == null || !Number.isFinite(key)) return false;
  const row = done[key];
  return Array.isArray(row) && (row[1] ?? 0) > 0;
}
