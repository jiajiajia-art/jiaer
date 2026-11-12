import type { Turn } from "./types";

/**
 * 功能注释：正文区只显示「当前地点」的剧情——换场景即翻篇，剧情记录本身完整保留（AI 上下文 / 剧情志 / 存档不受影响）。
 * 从最新一条往前取，遇到记录了其他地点的回合就停；旧存档里没记地点的回合视为同一场景（行为与以前一致）。
 * AI 主动转场（turn.scene）时，把触发转场的那句玩家输入一并带上，避免新场景开头没头没尾。
 */
export function turnsInCurrentScene(story: readonly Turn[], room?: string): Turn[] {
  if (!room) return [...story];
  let start = story.length;
  while (start > 0) {
    const t = story[start - 1];
    if (t.room && t.room !== room) break;
    start--;
  }
  const first = story[start];
  if (start > 0 && first?.scene && first.role === "ai" && story[start - 1].role === "player") start--;
  return story.slice(start);
}
