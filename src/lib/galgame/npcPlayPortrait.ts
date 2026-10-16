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
 * 功能注释：旁路立绘说话人身份键。同键不换图/不重播进场，避免流式多句对白连环闪多个立绘。
 */
export function buildPortraitSpeakerKey(dialogueStep: {
  isPlayer?: boolean;
  speakerId?: string | null;
  npcId?: string | null;
  speakerName?: string | null;
} | null | undefined): string {
  if (!dialogueStep) return '';
  const speakerId = trimStr(dialogueStep.speakerId || dialogueStep.npcId);
  const isPlayer = Boolean(dialogueStep.isPlayer) || speakerId === 'player';
  if (isPlayer) return 'player';
  if (speakerId) return `npc:${speakerId}`;
  const name = trimStr(dialogueStep.speakerName);
  return name ? `name:${name}` : '';
}

/**
 * 功能注释：按 npcId 优先、姓名/曾用名回落，取出局内档案立绘 URL。
 * 对白 step 有时只有 speakerName，列表改名后仍要对得上现用名。
 * 问题10：当 npcId 与「唯一命中」的 speakerName 指向不同档案时，以姓名为准，避免错立绘。
 */
export function pickSessionNpcAvatarUrl(
  edits: SessionNpcPortraitLike[] | null | undefined,
  opts: { npcId?: string | null; speakerName?: string | null } = {},
): string {
  const list = Array.isArray(edits) ? edits : [];
  const npcId = trimStr(opts.npcId);
  const speakerName = trimStr(opts.speakerName);

  const byId = npcId ? list.find((item) => trimStr(item?.id) === npcId) : undefined;
  const nameMatches = speakerName
    ? list.filter((item) => (
      trimStr(item?.name) === speakerName
      || trimStr(item?.originalName) === speakerName
    ))
    : [];
  const byNameUnique = nameMatches.length === 1 ? nameMatches[0] : undefined;

  // 唯一姓名命中另一 id → 跟姓名（LLM 错借 id）
  if (
    byId
    && byNameUnique
    && trimStr(byId.id) !== trimStr(byNameUnique.id)
  ) {
    const nameUrl = trimStr(byNameUnique.avatarUrl);
    if (nameUrl) return nameUrl;
  }

  if (byId) {
    const url = trimStr(byId.avatarUrl);
    if (url) return url;
  }
  if (byNameUnique) {
    const url = trimStr(byNameUnique.avatarUrl);
    if (url) return url;
  }
  // 多名重名时回落到第一个姓名命中（无 id 场景）
  if (!npcId && nameMatches.length > 0) {
    const url = trimStr(nameMatches[0]?.avatarUrl);
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

/**
 * 功能注释：Aliyun raw 旁路立绘路径（player / NPC 统一）。
 * 主角也必须吃 activeImage，避免 preset 未就绪时旁路立绘整段空窗。
 */
export function resolveRawBridgeDialogueImagePath(opts: {
  isPlayer: boolean;
  activeImage?: string | null;
  sessionPlayerAvatarUrl?: string | null;
  playerDocumentImagePath?: string | null;
  npcId?: string | null;
  speakerName?: string | null;
  documentImages?: Record<string, string | undefined> | string | null;
  sessionNpcAvatarUrl?: string | null;
}): string | undefined {
  if (opts.isPlayer) {
    const sessionUrl = trimStr(opts.sessionPlayerAvatarUrl);
    if (sessionUrl) return sessionUrl;
    const doc = trimStr(opts.playerDocumentImagePath);
    if (doc) return doc;
    const active = trimStr(opts.activeImage);
    return active || undefined;
  }
  return resolveNpcPlayImagePath({
    npcId: opts.npcId,
    speakerName: opts.speakerName,
    activeImage: opts.activeImage,
    documentImages: opts.documentImages,
    sessionAvatarUrl: opts.sessionNpcAvatarUrl,
  });
}
