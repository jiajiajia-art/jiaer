/**
 * 主线出场立绘：局内重新生成的头像优先于创作台文档 images。
 * 角色列表已吃 sessionNpcEdits.avatarUrl，对白层必须同一套选择器，否则会出现「列表新、场景旧」。
 */

import { resolvePlayPortraitScale } from './playerCharacterCard.ts';

export type SessionNpcPortraitLike = {
  id?: string | null;
  name?: string | null;
  originalName?: string | null;
  avatarUrl?: string | null;
};

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/**
 * 功能注释：按 npcId 优先、姓名/曾用名回落，取出局内档案立绘 URL。
 * 对白 step 有时只有 speakerName，列表改名后仍要对得上现用名。
 */
export function pickSessionNpcAvatarUrl(
  edits: SessionNpcPortraitLike[] | null | undefined,
  opts: { npcId?: string | null; speakerName?: string | null } = {},
): string {
  const list = Array.isArray(edits) ? edits : [];
  const npcId = trimStr(opts.npcId);
  const speakerName = trimStr(opts.speakerName);
  if (npcId) {
    const byId = list.find((item) => trimStr(item?.id) === npcId);
    const url = trimStr(byId?.avatarUrl);
    if (url) return url;
  }
  if (speakerName) {
    const byName = list.find((item) => (
      trimStr(item?.name) === speakerName
      || trimStr(item?.originalName) === speakerName
    ));
    const url = trimStr(byName?.avatarUrl);
    if (url) return url;
  }
  return '';
}

/**
 * 功能注释：文档 NPC images（对象或历史字符串）解析；activeImage 优先，再 base。
 */
export function resolveDocumentNpcImagePath(
  documentImages: Record<string, string | undefined> | string | null | undefined,
  activeImage?: string | null,
): string | undefined {
  if (typeof documentImages === 'string') {
    const raw = documentImages.trim();
    return raw || undefined;
  }
  if (documentImages && typeof documentImages === 'object') {
    const active = trimStr(activeImage);
    const activeUrl = active ? documentImages[active] : undefined;
    if (typeof activeUrl === 'string' && activeUrl.trim()) return activeUrl.trim();
    if (typeof documentImages.base === 'string' && documentImages.base.trim()) {
      return documentImages.base.trim();
    }
    const first = Object.values(documentImages).find(
      (value): value is string => typeof value === 'string' && value.trim() !== '',
    );
    return first?.trim() || undefined;
  }
  return undefined;
}

/**
 * 功能注释：出场立绘路径。局内 avatarUrl 一旦存在就盖住文档图与 step.activeImage
 *（activeImage 仍指向创作台旧表情/全身图，正是「列表已新、游戏仍旧」的来源）。
 */
export function resolveNpcPlayImagePath(opts: {
  npcId?: string | null;
  speakerName?: string | null;
  activeImage?: string | null;
  documentImages?: Record<string, string | undefined> | string | null;
  sessionAvatarUrl?: string | null;
}): string | undefined {
  const sessionUrl = trimStr(opts.sessionAvatarUrl);
  if (sessionUrl) return sessionUrl;
  const fromDocument = resolveDocumentNpcImagePath(opts.documentImages, opts.activeImage);
  if (fromDocument) return fromDocument;
  const fallback = trimStr(opts.activeImage);
  return fallback || undefined;
}

export function resolveNpcPlayPortraitScale(opts: {
  sessionAvatarUrl?: string | null;
  documentPortraitScale?: number | null;
}): number | undefined {
  return resolvePlayPortraitScale({
    sessionAvatarUrl: opts.sessionAvatarUrl,
    documentPortraitScale: opts.documentPortraitScale,
  });
}
