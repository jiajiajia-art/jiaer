/**
 * 功能注释：创作者身份门禁（C0.1）。
 * 首次有游戏世界「审核通过并成功上架」后激活；未激活不能进玩法 Mod / 手机应用创作。
 */
import type { UserGameData } from '../api/home/getGameData.type.ts';
import { resolveCreatorWorkStatus } from '../utils/creatorWorkLifecycle.ts';

/** 功能注释：入口锁定提示原文；含义不能少，标点可微调 */
export const CREATOR_IDENTITY_LOCKED_HINT =
  '需要过审作品解锁创作者身份即可使用。公开发布一部游戏世界并通过审核后解锁。';

/** 功能注释：是否已激活创作者身份——至少一部作品处于已公开发布 */
export function isCreatorIdentityActivated(
  games: Array<Pick<UserGameData, 'is_public' | 'moderation_status' | 'moderationStatus'>>,
): boolean {
  return games.some((game) => resolveCreatorWorkStatus(game) === 'published');
}
