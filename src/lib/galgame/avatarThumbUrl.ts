/**
 * 角色头像：列表/气泡用 *_150.webp；放大预览用原图（禁止大图吃 150）。
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

/** 原图 /api/.../base_xxx.png → /api/.../base_xxx_150.webp */
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
 * 列表/气泡：只返回 webp 小图路径，绝不直接吃 PNG 原图。
 */
export function pickDisplayAvatarThumbUrl(
  candidates: Array<string | null | undefined>,
): string {
  for (const c of candidates) {
    const u = trimStr(c);
    if (!u) continue;
    if (isAvatarThumbUrl(u)) return u;
  }
  for (const c of candidates) {
    const derived = deriveAvatarThumbUrl(c);
    if (derived) return derived;
  }
  return '';
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
