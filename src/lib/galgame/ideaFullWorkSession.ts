/**
 * 一句话生成 pending「完整作品」素材勾选：按 jobId/fileId 暂存，文本完成后消费。
 */
import type { IdeaAssetFlags, IdeaGenerateOptions } from './ideaFullWorkEstimate';
import { shouldGenerateAssetsAfterIdea } from './ideaFullWorkEstimate';

const STORAGE_PREFIX = 'idea-full-work-assets:';

function storageKey(id: string): string {
  return `${STORAGE_PREFIX}${id}`;
}

/** 功能注释：文本 job 入队后记住勾选的素材类型，供完成后接力生图。 */
export function rememberIdeaFullWorkAssets(jobOrFileId: string, options: IdeaGenerateOptions): void {
  if (!jobOrFileId || !shouldGenerateAssetsAfterIdea(options)) {
    return;
  }
  try {
    sessionStorage.setItem(storageKey(jobOrFileId), JSON.stringify(options.assets));
  } catch {
    // ignore quota / private mode
  }
}

/** 功能注释：取出并清除 pending 素材勾选；无则返回 null。 */
export function consumeIdeaFullWorkAssets(jobOrFileId: string): IdeaAssetFlags | null {
  if (!jobOrFileId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(jobOrFileId));
    if (!raw) return null;
    sessionStorage.removeItem(storageKey(jobOrFileId));
    const parsed = JSON.parse(raw) as IdeaAssetFlags;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      portraits: Boolean(parsed.portraits),
      scenes: Boolean(parsed.scenes),
      cover: Boolean(parsed.cover),
    };
  } catch {
    return null;
  }
}

/** 功能注释：标记本局需要展示「素材待补齐」提醒（按 fileId）。 */
export function markAssetGapBannerPending(fileId: string, kind: 'text' | 'full'): void {
  if (!fileId) return;
  try {
    sessionStorage.setItem(`asset-gap-banner:${fileId}`, kind);
  } catch {
    // ignore
  }
}

export function peekAssetGapBannerKind(fileId: string): 'text' | 'full' | null {
  if (!fileId) return null;
  try {
    const v = sessionStorage.getItem(`asset-gap-banner:${fileId}`);
    if (v === 'text' || v === 'full') return v;
    return null;
  } catch {
    return null;
  }
}

export function dismissAssetGapBanner(fileId: string): void {
  if (!fileId) return;
  try {
    sessionStorage.setItem(`asset-gap-banner-dismissed:${fileId}`, '1');
  } catch {
    // ignore
  }
}

export function isAssetGapBannerDismissed(fileId: string): boolean {
  if (!fileId) return false;
  try {
    return sessionStorage.getItem(`asset-gap-banner-dismissed:${fileId}`) === '1';
  } catch {
    return false;
  }
}

export function clearAssetGapBannerDismissed(fileId: string): void {
  if (!fileId) return;
  try {
    sessionStorage.removeItem(`asset-gap-banner-dismissed:${fileId}`);
  } catch {
    // ignore
  }
}
