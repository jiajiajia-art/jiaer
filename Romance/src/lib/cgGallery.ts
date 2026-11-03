import type { CgDef, GameState, Turn } from "./types";

/** 功能注释：新增与批量上传都从“未设置条件”开始，避免图片被误判为已解锁。 */
export function createCgDraft(id: string, title: string, imageFileId?: string): CgDef {
  const name = title.trim().replace(/\.[^.]+$/, "").slice(0, 24);
  return { id, title: name || "未命名 CG", imageFileId, conds: [] };
}

/** 功能注释：数组顺序就是玩家图鉴顺序，移动时不引入额外 order 字段。 */
export function moveCg(list: CgDef[], id: string, delta: -1 | 1): CgDef[] {
  const from = list.findIndex((cg) => cg.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

/** 功能注释：解锁状态与“新”标记都写进当前存档，切换存档不会串档。 */
export function latestCgDialogue(story: Turn[] | undefined): string {
  const turn = [...(story ?? [])].reverse().find((item) => item.role === "ai" && item.segments?.length);
  if (!turn) return "";
  return turn.segments.map((segment) =>
    segment.kind === "dialogue" ? `${segment.speaker}：${segment.text}` : segment.text,
  ).join("\n").trim().slice(0, 2000);
}

export function applyCgUnlocks(game: GameState, ids: string[], time: string, dialogue = ""): GameState {
  if (!ids.length) return game;
  return {
    ...game,
    cgUnlocked: { ...(game.cgUnlocked ?? {}), ...Object.fromEntries(ids.map((id) => [id, time])) },
    cgNew: [...new Set([...(game.cgNew ?? []), ...ids])],
    cgDialogue: dialogue
      ? { ...(game.cgDialogue ?? {}), ...Object.fromEntries(ids.map((id) => [id, dialogue])) }
      : game.cgDialogue,
  };
}

export const hasCgMenu = (list: CgDef[] | undefined): boolean =>
  !!list?.some((cg) => cg.enabled !== false);

export function cgRevealBatch(ids: string[]): { id: string; extra: number } | null {
  return ids.length ? { id: ids[0], extra: ids.length - 1 } : null;
}
