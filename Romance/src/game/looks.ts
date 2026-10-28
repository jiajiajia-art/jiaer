/* 容貌数值（主角）：纯函数、零运行时依赖。
 * 单独成模块是为了让 worlds/star2005/content.ts 不必在运行时导入 game/logic.ts——
 * 否则 registry → content → logic → … → registry 会形成加载期循环，出现「初始化前访问」错误。 */
export function computeLooks(s: { stats: { yitai: number; zixin: number }; styling: number; stress: number; looksBonus?: number }) {
  const raw = s.stats.yitai * 0.55 + s.stats.zixin * 0.25 + s.styling * 0.2;
  const penalty = s.stress >= 75 ? 0.9 : 1;
  return Math.round(Math.max(0, Math.min(999, raw * penalty + (s.looksBonus ?? 0)))); // looksBonus：开局选项配置的容貌永久加成
}
