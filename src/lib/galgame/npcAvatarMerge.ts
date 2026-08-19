/**
 * 局内 NPC 头像结果合并（纯函数，无网络依赖）
 */
import type { PlayerEditableNpc } from './characterProfile';

function isSessionPortraitUrl(url?: string | null): boolean {
  return /\/sessions\/[^/]+\/avatars\//i.test(String(url || '').trim());
}

export type NpcAvatarMergeInput = {
  npcId: string;
  avatarUrl: string;
  avatarThumbUrl?: string;
};

/** 仅合并头像字段，避免后台完成时覆盖用户已保存的姓名/人设 */
export function mergeNpcAvatarIntoProfiles(
  profiles: PlayerEditableNpc[] | null | undefined,
  result: NpcAvatarMergeInput,
): PlayerEditableNpc[] {
  const list = Array.isArray(profiles) ? profiles : [];
  const id = String(result?.npcId || '').trim();
  const avatarUrl = String(result?.avatarUrl || '').trim();
  if (!id || !avatarUrl) return list;
  let found = false;
  const next = list.map((p) => {
    if (String(p?.id || '') !== id) return p;
    found = true;
    return {
      ...p,
      avatarUrl,
      ...(result.avatarThumbUrl ? { avatarThumbUrl: result.avatarThumbUrl } : {}),
    };
  });
  if (found) return next;
  return [
    ...list,
    {
      id,
      name: '',
      gender: 'female',
      relationship: '',
      summary: '',
      attitudeToPlayer: '',
      avatarUrl,
      ...(result.avatarThumbUrl ? { avatarThumbUrl: result.avatarThumbUrl } : {}),
    } as PlayerEditableNpc,
  ];
}

export type NpcAvatarFields = {
  avatarUrl?: string | null;
  avatarThumbUrl?: string | null;
};

/** 局内文件名 `{id}_{Date.now()}.webp` 里的时间戳；无则 0 */
export function sessionPortraitTimestamp(url?: string | null): number {
  const path = String(url || '').split('?')[0].split('#')[0];
  const m = path.match(/_(\d{10,13})\.(?:webp|png|jpe?g)$/i);
  return m ? Number(m[1]) : 0;
}

/**
 * 服务端回写 vs 本局已生成：局内图优先于文档图；两张都是局内图时取时间戳更新的一张。
 * 避免重新生成后 play-ui / 属性面板带回旧 session URL，把列表打回上一张。
 */
export function pickPreferredNpcAvatarFields(
  incoming: NpcAvatarFields | null | undefined,
  local: NpcAvatarFields | null | undefined,
): { avatarUrl: string; avatarThumbUrl: string } {
  const inUrl = String(incoming?.avatarUrl || '').trim();
  const locUrl = String(local?.avatarUrl || '').trim();
  const inThumb = String(incoming?.avatarThumbUrl || '').trim();
  const locThumb = String(local?.avatarThumbUrl || '').trim();
  const locSession = isSessionPortraitUrl(locUrl);
  const inSession = isSessionPortraitUrl(inUrl);

  let useLocal = false;
  if (locSession && !inSession) {
    useLocal = true;
  } else if (locSession && inSession) {
    const locTs = sessionPortraitTimestamp(locUrl);
    const inTs = sessionPortraitTimestamp(inUrl);
    if (locTs > inTs) useLocal = true;
    else if (locTs === inTs && locUrl !== inUrl) useLocal = true;
  }

  if (useLocal) {
    return { avatarUrl: locUrl, avatarThumbUrl: locThumb || inThumb };
  }
  return { avatarUrl: inUrl || locUrl, avatarThumbUrl: inThumb || locThumb };
}

/**
 * 服务端回写档案列表时：局内新生成立绘优先于文档旧图 / 更旧的局内图。
 */
export function mergeIncomingNpcProfiles(
  incoming: PlayerEditableNpc[] | null | undefined,
  local: PlayerEditableNpc[] | null | undefined,
): PlayerEditableNpc[] {
  const server = Array.isArray(incoming) ? incoming : [];
  const prev = Array.isArray(local) ? local : [];
  const localById = new Map(prev.map((p) => [String(p?.id || ''), p]));
  const seen = new Set<string>();
  const next = server.map((row) => {
    const id = String(row?.id || '');
    if (id) seen.add(id);
    const loc = id ? localById.get(id) : undefined;
    if (!loc) return row;
    const picked = pickPreferredNpcAvatarFields(row, loc);
    if (!picked.avatarUrl) return row;
    return {
      ...row,
      avatarUrl: picked.avatarUrl,
      ...(picked.avatarThumbUrl ? { avatarThumbUrl: picked.avatarThumbUrl } : {}),
    };
  });
  for (const p of prev) {
    const id = String(p?.id || '');
    if (id && !seen.has(id) && isSessionPortraitUrl(p.avatarUrl)) {
      next.push(p);
    }
  }
  return next;
}
