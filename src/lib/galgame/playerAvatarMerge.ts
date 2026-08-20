/**
 * 主角头像结果合并（纯函数，无网络依赖）
 */
import type { SessionPlayerProfile } from './playerCharacterCard';
import {
  pickPreferredNpcAvatarFields,
  sessionPortraitTimestamp,
} from './npcAvatarMerge.ts';

export type PlayerAvatarMergeInput = {
  avatarUrl: string;
  avatarThumbUrl?: string;
};

/** 仅合并头像字段，避免后台完成时覆盖用户已保存的姓名/人设 */
export function mergePlayerAvatarIntoProfile(
  current: SessionPlayerProfile | null | undefined,
  result: PlayerAvatarMergeInput,
  fallback?: { name?: string; gender?: string; persona?: string },
): SessionPlayerProfile {
  const base: SessionPlayerProfile = current && typeof current === 'object'
    ? { ...current }
    : {
        name: String(fallback?.name || '').trim() || '主角',
        gender: (fallback?.gender as SessionPlayerProfile['gender']) || 'other',
        persona: String(fallback?.persona || ''),
        customAttributes: {},
      };
  return {
    ...base,
    avatarUrl: result.avatarUrl,
    ...(result.avatarThumbUrl ? { avatarThumbUrl: result.avatarThumbUrl } : {}),
    avatarNeedsRegen: false,
  };
}

/**
 * 功能注释：play-ui / 属性面板回写时，局内更新的立绘优先于旧 session URL / 文档图。
 * 与 NPC pickPreferredNpcAvatarFields 同规则，避免「游戏里已是新图、档案又变回旧图」。
 */
export function mergeIncomingSessionPlayerProfile(
  incoming: SessionPlayerProfile | null | undefined,
  local: SessionPlayerProfile | null | undefined,
): SessionPlayerProfile | null {
  if (!incoming || typeof incoming !== 'object') {
    return local && typeof local === 'object' ? { ...local } : null;
  }
  if (!local || typeof local !== 'object') {
    return { ...incoming };
  }
  const picked = pickPreferredNpcAvatarFields(incoming, local);
  const next: SessionPlayerProfile = {
    ...local,
    ...incoming,
    avatarUrl: picked.avatarUrl || incoming.avatarUrl || local.avatarUrl,
    ...(picked.avatarThumbUrl
      ? { avatarThumbUrl: picked.avatarThumbUrl }
      : {}),
  };
  if (picked.avatarUrl) {
    next.avatarNeedsRegen = false;
  }
  return next;
}

export { sessionPortraitTimestamp };
