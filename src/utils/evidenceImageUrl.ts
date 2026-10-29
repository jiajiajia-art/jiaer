import { getImageUrl } from './constants';

/** 功能注释：举报/申诉证据可能是绝对 URL，也可能是 R2 key，读图统一走 /public 代理 */
export function resolveEvidenceImageUrl(keyOrUrl: string): string {
  const raw = String(keyOrUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/public/') || raw.startsWith('public/')) return getImageUrl(raw);
  return getImageUrl(`public/${raw.replace(/^\//, '')}`);
}
