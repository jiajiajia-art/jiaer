/**
 * 角色头像：列表/气泡优先 *_150.webp（须真实存在）；无确认小图时回落原图。
 * 禁止臆造未 ensure 的 *_150.webp（会导致裂图）。
 * 列表等待 ensure 时禁止先画原图再换成 150（会闪大图）。
 */

function trimStr(value: unknown): string {
  return String(value ?? '').trim();
}

/** 是否已是 150 webp 小图 */
export function isAvatarThumbUrl(url: string | null | undefined): boolean {
  const u = trimStr(url);
  if (!u) return false;
  return /_150\.webp(?:\?|#|$)/i.test(u) || /\.150\.webp(?:\?|#|$)/i.test(u);
}

/** 原图 /api/.../base_xxx.png → /api/.../base_xxx_150.webp（仅推导路径，不代表文件已存在） */
export function deriveAvatarThumbUrl(sourceUrl: string | null | undefined): string {
  const raw = trimStr(sourceUrl);
  if (!raw) return '';
  if (isAvatarThumbUrl(raw)) return raw;

  const qIndex = raw.search(/[?#]/);
  const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : '';

  const cleaned = path
    .replace(/_150\.webp$/i, '')
    .replace(/\.150h\.webp$/i, '')
    .replace(/\.150u\.webp$/i, '')
    .replace(/\.150\.webp$/i, '')
    .replace(/\.(png|jpe?g|webp|gif)$/i, '');

  if (!cleaned) return '';
  return `${cleaned}_150.webp${query}`;
}

/**
 * 只返回已确认的 webp 小图路径；绝不从 PNG 臆造（避免 404 裂图）。
 */
export function pickDisplayAvatarThumbUrl(
  candidates: Array<string | null | undefined>,
): string {
  for (const c of candidates) {
    const u = trimStr(c);
    if (!u) continue;
    if (isAvatarThumbUrl(u)) return u;
  }
  return '';
}

/**
 * 列表/编辑坞展示：确认 150 → 原图；禁止臆造未存在的 *_150.webp。
 * （放大预览、兜底场景仍可用；列表头像请用 pickAvatarListDisplayUrl。）
 */
export function pickAvatarDisplayUrl(
  candidates: Array<string | null | undefined>,
): string {
  const thumb = pickDisplayAvatarThumbUrl(candidates);
  if (thumb) return thumb;
  for (const c of candidates) {
    const u = trimStr(c);
    if (!u) continue;
    if (!isAvatarThumbUrl(u)) return u;
  }
  return '';
}

export type PickAvatarListDisplayOptions = {
  /**
   * true：仍在拉取/ensure 150 → 无确认小图时返回空（占位），禁止先出原图再换小图。
   * false：ensure 已结束仍无小图 → 允许回落原图（稳定一帧，不再切换）。
   */
  pendingThumbs?: boolean;
};

/**
 * 列表/详情头像坞：优先确认 150；pending 时不回落原图，避免「先大图后小图」闪烁。
 * 已有确认 150 时无论 pending 与否都立刻返回（不等 character-avatar-thumbs）。
 */
export function pickAvatarListDisplayUrl(
  candidates: Array<string | null | undefined>,
  options?: PickAvatarListDisplayOptions | null,
): string {
  const thumb = pickDisplayAvatarThumbUrl(candidates);
  if (thumb) return thumb;
  if (options?.pendingThumbs) return '';
  for (const c of candidates) {
    const u = trimStr(c);
    if (!u) continue;
    if (!isAvatarThumbUrl(u)) return u;
  }
  return '';
}

/** 候选里是否已有确认 *_150.webp（可立即展示，不必等批量 ensure）。 */
export function hasConfirmedAvatarThumb(
  candidates: Array<string | null | undefined>,
): boolean {
  return Boolean(pickDisplayAvatarThumbUrl(candidates));
}

/**
 * 从档案列表抽出已确认小图，供打开面板时立刻播种，避免整表空白转圈。
 */
export function collectConfirmedAvatarThumbs(
  entries: Array<{ id?: string | null; avatarThumbUrl?: string | null } | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    if (!entry) continue;
    const id = trimStr(entry.id);
    if (!id || out[id]) continue;
    const thumb = pickDisplayAvatarThumbUrl([entry.avatarThumbUrl]);
    if (thumb) out[id] = thumb;
  }
  return out;
}

/**
 * 局内生图小图 → 同目录原图（player_xxx_150.webp → player_xxx.webp）。
 * 仅对 /sessions/ 或 /avatars/ 路径做，避免把文档 NPC 的 base_150.webp 错推成 base.webp。
 */
export function deriveAvatarFullUrlFromThumb(thumbUrl: string | null | undefined): string {
  const raw = trimStr(thumbUrl);
  if (!raw || !isAvatarThumbUrl(raw)) return '';
  if (!/\/sessions\/|\/avatars\//i.test(raw)) return '';
  return raw
    .replace(/_150\.webp(?=[?#]|$)/i, '.webp')
    .replace(/\.150\.webp(?=[?#]|$)/i, '.webp');
}

/**
 * 放大预览：优先非 150 原图；没有则对局内小图反推同目录 .webp。
 */
export function pickDisplayAvatarFullUrl(
  candidates: Array<string | null | undefined>,
): string {
  for (const c of candidates) {
    const u = trimStr(c);
    if (!u) continue;
    if (!isAvatarThumbUrl(u)) return u;
  }
  for (const c of candidates) {
    const guessed = deriveAvatarFullUrlFromThumb(c);
    if (guessed) return guessed;
  }
  return '';
}
