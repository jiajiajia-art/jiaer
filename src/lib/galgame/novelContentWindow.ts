/**
 * 视觉小说阅读：长正文窗口缓冲 / 虚拟列表纯逻辑
 */

export const NOVEL_WINDOW_STEP_THRESHOLD = 400;
export const NOVEL_VIRTUAL_STEP_THRESHOLD = 800;
export const NOVEL_WINDOW_BYTES_THRESHOLD = Math.floor(1.5 * 1024 * 1024);
export const NOVEL_WINDOW_DEFAULT_LIMIT = 120;
export const NOVEL_WINDOW_MAX_LIMIT = 300;
export const NOVEL_WINDOW_PRELOAD_PAD = 20;
export const NOVEL_VIRTUAL_OVERSCAN = 12;
export const NOVEL_VIRTUAL_ESTIMATE_HEIGHT = 120;

export type NovelContentLayout = 'single' | 'segmented';

export interface NovelStepRange {
  from: number;
  to: number; // exclusive
}

export interface NovelStepBuffer {
  totalStepCount: number;
  chapterIndex: Array<{
    id: string;
    title: string;
    startStepIndex: number;
    endStepIndex: number;
  }>;
  ranges: NovelStepRange[];
  stepsByIndex: Map<number, unknown>;
}

/** 功能注释：根据 meta 决定是否走窗口拉取（短篇保持整包）。 */
export function shouldUseNovelWindowMode(meta: {
  stepCount?: number | null;
  contentBytes?: number | null;
  contentLayout?: string | null;
} | null | undefined): boolean {
  if (!meta) return false;
  if (String(meta.contentLayout || '').trim() === 'segmented') return true;
  const steps = Math.max(0, Math.floor(Number(meta.stepCount) || 0));
  const bytes = Math.max(0, Math.floor(Number(meta.contentBytes) || 0));
  return steps >= NOVEL_WINDOW_STEP_THRESHOLD || bytes >= NOVEL_WINDOW_BYTES_THRESHOLD;
}

/** 功能注释：达阈值时启用虚拟列表，避免 DOM 卡片爆炸。 */
export function shouldUseNovelVirtualList(totalStepCount: number): boolean {
  return Math.max(0, Math.floor(Number(totalStepCount) || 0)) >= NOVEL_VIRTUAL_STEP_THRESHOLD;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

/** 功能注释：合并半开区间，保证 loadedRanges 有序无重叠。 */
export function mergeNovelStepRanges(ranges: NovelStepRange[]): NovelStepRange[] {
  const sorted = [...ranges]
    .map((r) => ({
      from: Math.max(0, Math.floor(Number(r.from) || 0)),
      to: Math.max(0, Math.floor(Number(r.to) || 0)),
    }))
    .filter((r) => r.to > r.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);

  const merged: NovelStepRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (!last || range.from > last.to) {
      merged.push({ ...range });
      continue;
    }
    last.to = Math.max(last.to, range.to);
  }
  return merged;
}

/** 功能注释：判断 [from,to) 是否已被已加载区间完全覆盖。 */
export function novelRangesCover(ranges: NovelStepRange[], from: number, to: number): boolean {
  const start = Math.max(0, Math.floor(Number(from) || 0));
  const end = Math.max(start, Math.floor(Number(to) || 0));
  if (end <= start) return true;
  let cursor = start;
  for (const range of mergeNovelStepRanges(ranges)) {
    if (range.to <= cursor) continue;
    if (range.from > cursor) return false;
    cursor = Math.max(cursor, range.to);
    if (cursor >= end) return true;
  }
  return cursor >= end;
}

/**
 * 功能注释：计算缺失窗口；已覆盖则返回 null。
 */
export function computeMissingNovelWindow(
  ranges: NovelStepRange[],
  targetFrom: number,
  targetLimit: number,
  totalStepCount: number,
): { from: number; limit: number } | null {
  const total = Math.max(0, Math.floor(Number(totalStepCount) || 0));
  if (total < 1) return null;
  const from = clampInt(targetFrom, 0, 0, total);
  const limit = clampInt(targetLimit, NOVEL_WINDOW_DEFAULT_LIMIT, 1, NOVEL_WINDOW_MAX_LIMIT);
  const to = Math.min(total, from + limit);
  if (novelRangesCover(ranges, from, to)) return null;
  return { from, limit: Math.max(1, to - from) };
}

/** 功能注释：把窗口 steps 写入缓冲（全局下标 = from + i）。 */
export function applyNovelWindowToBuffer(
  buffer: NovelStepBuffer,
  from: number,
  steps: unknown[],
  extras?: {
    totalStepCount?: number;
    chapterIndex?: NovelStepBuffer['chapterIndex'];
  },
): NovelStepBuffer {
  const list = Array.isArray(steps) ? steps : [];
  const safeFrom = Math.max(0, Math.floor(Number(from) || 0));
  const nextMap = new Map(buffer.stepsByIndex);
  for (let i = 0; i < list.length; i += 1) {
    nextMap.set(safeFrom + i, list[i]);
  }
  const nextRanges = mergeNovelStepRanges([
    ...buffer.ranges,
    { from: safeFrom, to: safeFrom + list.length },
  ]);
  return {
    totalStepCount: Math.max(
      buffer.totalStepCount,
      Math.floor(Number(extras?.totalStepCount) || 0),
      safeFrom + list.length,
    ),
    chapterIndex: Array.isArray(extras?.chapterIndex) && extras.chapterIndex.length > 0
      ? extras.chapterIndex
      : buffer.chapterIndex,
    ranges: nextRanges,
    stepsByIndex: nextMap,
  };
}

export function createEmptyNovelStepBuffer(
  totalStepCount = 0,
  chapterIndex: NovelStepBuffer['chapterIndex'] = [],
): NovelStepBuffer {
  return {
    totalStepCount: Math.max(0, Math.floor(Number(totalStepCount) || 0)),
    chapterIndex: Array.isArray(chapterIndex) ? chapterIndex : [],
    ranges: [],
    stepsByIndex: new Map(),
  };
}

/**
 * 功能注释：目录跳转目标窗口（章区间 + pad，限制 max limit）。
 */
export function computeChapterFetchWindow(
  chapter: { startStepIndex: number; endStepIndex: number } | null | undefined,
  totalStepCount: number,
  pad = NOVEL_WINDOW_PRELOAD_PAD,
): { from: number; limit: number } {
  const total = Math.max(0, Math.floor(Number(totalStepCount) || 0));
  if (!chapter || total < 1) {
    return { from: 0, limit: Math.min(NOVEL_WINDOW_DEFAULT_LIMIT, Math.max(total, 1)) };
  }
  const start = clampInt(chapter.startStepIndex, 0, 0, Math.max(0, total - 1));
  const end = clampInt(chapter.endStepIndex, start, start, Math.max(0, total - 1));
  const from = Math.max(0, start - Math.max(0, pad));
  const to = Math.min(total, end + 1 + Math.max(0, pad));
  return {
    from,
    limit: Math.min(NOVEL_WINDOW_MAX_LIMIT, Math.max(NOVEL_WINDOW_DEFAULT_LIMIT, to - from)),
  };
}

/**
 * 功能注释：虚拟列表可见下标窗口（含 overscan）。
 */
export function computeVirtualIndexWindow({
  scrollTop,
  viewportHeight,
  totalCount,
  estimateHeight = NOVEL_VIRTUAL_ESTIMATE_HEIGHT,
  overscan = NOVEL_VIRTUAL_OVERSCAN,
}: {
  scrollTop: number;
  viewportHeight: number;
  totalCount: number;
  estimateHeight?: number;
  overscan?: number;
}): { start: number; end: number } {
  const total = Math.max(0, Math.floor(Number(totalCount) || 0));
  const row = Math.max(1, Math.floor(Number(estimateHeight) || NOVEL_VIRTUAL_ESTIMATE_HEIGHT));
  const top = Math.max(0, Number(scrollTop) || 0);
  const vh = Math.max(0, Number(viewportHeight) || 0);
  const pad = Math.max(0, Math.floor(Number(overscan) || 0));
  if (total < 1) return { start: 0, end: 0 };
  const start = Math.max(0, Math.floor(top / row) - pad);
  const end = Math.min(total, Math.ceil((top + vh) / row) + pad);
  return { start, end };
}

/**
 * 功能注释：从缓冲取出连续展示列表，并附带 globalStepIndex（目录锚点用）。
 */
export function buildBufferedDisplaySteps(
  buffer: NovelStepBuffer,
  start: number,
  end: number,
): Array<Record<string, unknown> & { globalStepIndex: number }> {
  const from = Math.max(0, Math.floor(Number(start) || 0));
  const to = Math.max(from, Math.floor(Number(end) || 0));
  const out: Array<Record<string, unknown> & { globalStepIndex: number }> = [];
  for (let i = from; i < to; i += 1) {
    const step = buffer.stepsByIndex.get(i);
    if (!step || typeof step !== 'object') continue;
    out.push({
      ...(step as Record<string, unknown>),
      globalStepIndex: i,
    });
  }
  return out;
}

/** 功能注释：整包 steps 转缓冲（短篇路径）。 */
export function bufferFromFullSteps(
  steps: unknown[],
  chapterIndex: NovelStepBuffer['chapterIndex'] = [],
): NovelStepBuffer {
  const list = Array.isArray(steps) ? steps : [];
  return applyNovelWindowToBuffer(createEmptyNovelStepBuffer(list.length, chapterIndex), 0, list, {
    totalStepCount: list.length,
    chapterIndex,
  });
}
