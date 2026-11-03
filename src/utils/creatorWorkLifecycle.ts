import type { UserGameData } from "../api/home/getGameData.type";

export type CreatorWorkStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "update_pending"
  | "unpublished";

/** 功能注释：统一书架、草稿计数和卡片标签的作品生命周期口径。 */
export function resolveCreatorWorkStatus(
  game: Pick<UserGameData, "is_public" | "moderation_status" | "moderationStatus">,
): CreatorWorkStatus {
  const moderation = String(
    game.moderationStatus || game.moderation_status || "none",
  ).toLowerCase();
  if (moderation === "update_pending_review") return "update_pending";
  if (moderation === "pending_review") return "pending";
  if (moderation === "rejected" || moderation === "update_rejected") return "rejected";
  if (moderation === "delisted" || moderation === "taken_down") return "unpublished";
  if (Number(game.is_public) === 1) return "published";
  return "draft";
}

export function creatorWorkStatusLabel(status: CreatorWorkStatus): string {
  if (status === "draft") return "草稿";
  if (status === "pending") return "审核中";
  if (status === "rejected") return "未通过";
  if (status === "update_pending") return "更新审核中";
  if (status === "unpublished") return "已下架";
  return "已发布";
}

export function isDraftSlotWork(
  game: Pick<UserGameData, "is_public" | "moderation_status" | "moderationStatus">,
): boolean {
  return resolveCreatorWorkStatus(game) === "draft";
}
