/**
 * 主角头像结果合并（纯函数，无网络依赖）
 */
import type { SessionPlayerProfile } from './playerCharacterCard';

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
