/**
 * 功能注释：AI/上传成功后预取封面，避免 R2 刚写入或局域网代理闪断时 img 直接 ERR_CONNECTION_CLOSED。
 */

import { getImageUrl } from './constants';
import { addImageTimestamp, bumpCacheBust } from './imageCache';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns 可直接用于 <img src> 的绝对 URL（带新 cache bust）；预取失败时仍返回可重试的远端 URL
 */
export async function resolveCoverPreviewSrc(
  coverPath: string,
  options?: { retries?: number; delayMs?: number },
): Promise<string> {
  const raw = String(coverPath || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:image/') || raw.startsWith('blob:')) return raw;

  const retries = Math.max(0, Number(options?.retries ?? 3));
  const delayMs = Math.max(0, Number(options?.delayMs ?? 400));

  bumpCacheBust(raw);
  let lastUrl = addImageTimestamp(getImageUrl(raw));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    bumpCacheBust(raw);
    lastUrl = addImageTimestamp(getImageUrl(raw));
    try {
      const res = await fetch(lastUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (attempt < retries) await sleep(delayMs * (attempt + 1));
        continue;
      }
      const buf = await res.arrayBuffer();
      if (!buf.byteLength) {
        if (attempt < retries) await sleep(delayMs * (attempt + 1));
        continue;
      }
      const type = res.headers.get('content-type') || 'image/webp';
      if (!/^image\//i.test(type) && !/octet-stream/i.test(type)) {
        if (attempt < retries) await sleep(delayMs * (attempt + 1));
        continue;
      }
      // 功能注释：预取成功仍用带 bust 的远端 URL，避免 blob 泄漏；确认可达即可展示
      return lastUrl;
    } catch {
      if (attempt < retries) await sleep(delayMs * (attempt + 1));
    }
  }

  bumpCacheBust(raw);
  return addImageTimestamp(getImageUrl(raw)) || lastUrl;
}
