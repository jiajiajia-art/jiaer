import { getImageUrl } from './constants';
import {
  coverUrlAfterDisplayCoverError,
  toDisplayCoverUrl,
} from './displayCoverUrl';

/** 功能注释：运营统计封面 — 与首页一致走 display-cover + ASSET_HOST */
export function resolveOperatorCoverSrc(coverUrl: string | null | undefined): string {
  const display = toDisplayCoverUrl(coverUrl);
  return getImageUrl(display || coverUrl);
}

/** 功能注释：display-cover 失败时回退原图绝对地址 */
export function resolveOperatorCoverFallbackSrc(
  failedDisplayPathOrUrl: string | null | undefined,
  coverUrl: string | null | undefined,
): string {
  const failed = String(failedDisplayPathOrUrl || '');
  const pathOnly = failed.replace(/^https?:\/\/[^/]+/i, '') || failed;
  const displayPath = toDisplayCoverUrl(coverUrl) || '';
  const fallbackPath = coverUrlAfterDisplayCoverError(displayPath || pathOnly, coverUrl);
  return fallbackPath ? getImageUrl(fallbackPath) : '';
}
