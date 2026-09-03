/**
 * 一句话生成 pending「完整作品」素材勾选与生图进度：按 fileId 暂存，支持刷新后续跑。
 */
import type { IdeaAssetFlags, IdeaGenerateOptions } from './ideaFullWorkEstimate';
import { shouldGenerateAssetsAfterIdea } from './ideaFullWorkEstimate';

const FLAGS_PREFIX = 'idea-full-work-assets:';
const STATUS_PREFIX = 'idea-full-work-status:';
const BANNER_PREFIX = 'asset-gap-banner:';
const BANNER_DISMISS_PREFIX = 'asset-gap-banner-dismissed:';

export type IdeaAssetGenStatus = 'pending' | 'running' | 'done' | 'failed';

function flagsKey(id: string): string {
  return `${FLAGS_PREFIX}${id}`;
}

function statusKey(id: string): string {
  return `${STATUS_PREFIX}${id}`;
}

function safeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemove(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function parseFlags(raw: string | null): IdeaAssetFlags | null {
  if (!raw) return null;
  try {
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

/** 功能注释：文本 job 入队后记住勾选的素材类型，供完成后接力生图（刷新不丢）。 */
export function rememberIdeaFullWorkAssets(jobOrFileId: string, options: IdeaGenerateOptions): void {
  if (!jobOrFileId || !shouldGenerateAssetsAfterIdea(options)) {
    return;
  }
  safeSet(flagsKey(jobOrFileId), JSON.stringify(options.assets));
  safeSet(statusKey(jobOrFileId), 'pending');
}

/** 功能注释：读取 pending 素材勾选（不删除，便于失败重试 / 刷新续跑）。 */
export function peekIdeaFullWorkAssets(jobOrFileId: string): IdeaAssetFlags | null {
  return parseFlags(safeGet(flagsKey(jobOrFileId)));
}

/** 功能注释：清除素材勾选与生图状态（成功或用户放弃后）。 */
export function clearIdeaFullWorkAssets(jobOrFileId: string): void {
  if (!jobOrFileId) return;
  safeRemove(flagsKey(jobOrFileId));
  safeRemove(statusKey(jobOrFileId));
  // 进度 key 与 ideaFullWorkProgress 约定一致，避免续跑横幅读到旧快照
  safeRemove(`idea-full-work-progress:${jobOrFileId}`);
}

export function setIdeaAssetGenStatus(fileId: string, status: IdeaAssetGenStatus): void {
  if (!fileId) return;
  safeSet(statusKey(fileId), status);
}

export function peekIdeaAssetGenStatus(fileId: string): IdeaAssetGenStatus | null {
  const v = safeGet(statusKey(fileId));
  if (v === 'pending' || v === 'running' || v === 'done' || v === 'failed') return v;
  return null;
}

/** @deprecated 改用 peek + clear；保留兼容旧调用 */
export function consumeIdeaFullWorkAssets(jobOrFileId: string): IdeaAssetFlags | null {
  const flags = peekIdeaFullWorkAssets(jobOrFileId);
  if (flags) clearIdeaFullWorkAssets(jobOrFileId);
  return flags;
}

/** 功能注释：标记本局素材横幅类型，并广播以便 React 立即重渲染（sessionStorage  alone 不触发）。 */
export const ASSET_GAP_BANNER_EVENT = 'asset-gap-banner-changed';

export function markAssetGapBannerPending(fileId: string, kind: 'text' | 'full' | 'generating'): void {
  if (!fileId) return;
  safeSet(`${BANNER_PREFIX}${fileId}`, kind);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSET_GAP_BANNER_EVENT, { detail: { fileId, kind } }));
  }
}

export function peekAssetGapBannerKind(fileId: string): 'text' | 'full' | 'generating' | null {
  if (!fileId) return null;
  const v = safeGet(`${BANNER_PREFIX}${fileId}`);
  if (v === 'text' || v === 'full' || v === 'generating') return v;
  return null;
}

export function dismissAssetGapBanner(fileId: string): void {
  if (!fileId) return;
  safeSet(`${BANNER_DISMISS_PREFIX}${fileId}`, '1');
}

export function isAssetGapBannerDismissed(fileId: string): boolean {
  if (!fileId) return false;
  return safeGet(`${BANNER_DISMISS_PREFIX}${fileId}`) === '1';
}

export function clearAssetGapBannerDismissed(fileId: string): void {
  if (!fileId) return;
  safeRemove(`${BANNER_DISMISS_PREFIX}${fileId}`);
}
