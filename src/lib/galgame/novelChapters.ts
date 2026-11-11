/**
 * 视觉小说阅读页：章节 TOC 归一化与跳转锚点
 */

export const NOVEL_CHAPTER_TITLE_MAX_LENGTH = 40;

export interface NovelChapterIndexItem {
  id: string;
  title: string;
  startStepIndex: number;
  endStepIndex: number;
}

export interface NovelChapterTocDisplay {
  ordinal: string;
  title: string;
}

const GENERIC_CHAPTER_TITLE = /^第\s*\d+\s*章$/u;

/** 功能注释：判断是否为占位章名（启发式「第 N 章」），需从正文补真实标题。 */
export function isGenericChapterTitle(title: string | null | undefined): boolean {
  return GENERIC_CHAPTER_TITLE.test(String(title || '').trim());
}

/** 功能注释：规范化 content.chapterIndex；非法项丢弃，保证可读目录。 */
export function normalizeNovelChapterIndex(
  raw: unknown,
  stepCount: number,
): NovelChapterIndexItem[] {
  const total = Math.max(0, Number(stepCount) || 0);
  if (total < 1 || !Array.isArray(raw)) return [];

  const result: NovelChapterIndexItem[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    let title = String(record.title || '').trim().replace(/\s+/g, ' ');
    if (!title) title = `第${result.length + 1}章`;
    if (title.length > NOVEL_CHAPTER_TITLE_MAX_LENGTH) {
      title = title.slice(0, NOVEL_CHAPTER_TITLE_MAX_LENGTH).trim();
    }
    let start = Number(record.startStepIndex);
    let end = Number(record.endStepIndex);
    if (!Number.isFinite(start)) continue;
    if (!Number.isFinite(end)) end = start;
    start = Math.max(0, Math.min(total - 1, Math.floor(start)));
    end = Math.max(start, Math.min(total - 1, Math.floor(end)));
    result.push({
      id: String(record.id || '').trim() || `ch_${result.length + 1}`,
      title,
      startStepIndex: start,
      endStepIndex: end,
    });
  }
  return result;
}

/** 功能注释：从 legacy chapters 生成仅展示用 TOC（无 step 时用序号）。 */
export function chapterIndexFromLegacyChapters(
  legacyChapters: Array<{ id?: string; title?: string }> | null | undefined,
): NovelChapterIndexItem[] {
  if (!Array.isArray(legacyChapters) || legacyChapters.length === 0) return [];
  return legacyChapters.map((ch, i) => ({
    id: String(ch?.id || `ch_${i + 1}`),
    title: String(ch?.title || `第${i + 1}章`).trim() || `第${i + 1}章`,
    startStepIndex: i,
    endStepIndex: i,
  }));
}

/**
 * 功能注释：章节起点若落在 scene_change，则跳到下一个可见文案 step。
 */
export function resolveReadableStepIndex(
  steps: Array<{ type?: string } | null | undefined>,
  startStepIndex: number,
): number {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) return 0;
  let index = Math.max(0, Math.min(list.length - 1, Math.floor(Number(startStepIndex) || 0)));
  while (index < list.length) {
    const type = String(list[index]?.type || '').trim();
    if (type && type !== 'scene_change') return index;
    index += 1;
  }
  return Math.max(0, list.length - 1);
}

/** 功能注释：简介展示文案；空则返回空串由 UI 决定占位。 */
export function resolveNovelSynopsisText(
  description: string | null | undefined,
): string {
  return String(description || '').trim();
}

/** 功能注释：从章节起点附近 steps 抽取可读标题（场景名优先）。 */
export function pickChapterTitleFromSteps(
  steps: Array<Record<string, unknown> | null | undefined>,
  startStepIndex: number,
): string {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) return '';
  const start = Math.max(0, Math.min(list.length - 1, Math.floor(Number(startStepIndex) || 0)));
  const end = Math.min(list.length, start + 6);

  for (let i = start; i < end; i += 1) {
    const step = list[i];
    if (!step || typeof step !== 'object') continue;
    const type = String(step.type || '').trim();
    if (type === 'scene_change') {
      const sceneName = String(step.sceneName || step.content || step.text || '').trim();
      if (sceneName) {
        return sceneName.slice(0, NOVEL_CHAPTER_TITLE_MAX_LENGTH).trim();
      }
    }
  }

  for (let i = start; i < end; i += 1) {
    const step = list[i];
    if (!step || typeof step !== 'object') continue;
    const type = String(step.type || '').trim();
    if (type === 'scene_change') continue;
    const text = String(step.content || step.text || step.message || step.title || '').trim();
    if (!text) continue;
    const clipped = text.length > 16 ? `${text.slice(0, 16)}…` : text;
    return clipped.slice(0, NOVEL_CHAPTER_TITLE_MAX_LENGTH).trim();
  }

  return '';
}

/**
 * 功能注释：占位「第 N 章」用正文场景/摘要补标题；已有 AI 标题则保留。
 */
export function enrichChapterTitlesFromSteps(
  chapters: NovelChapterIndexItem[],
  steps: Array<Record<string, unknown> | null | undefined>,
): NovelChapterIndexItem[] {
  return chapters.map((chapter, index) => {
    if (!isGenericChapterTitle(chapter.title)) return { ...chapter };
    const picked = pickChapterTitleFromSteps(steps, chapter.startStepIndex);
    if (!picked) {
      if (index === 0) return { ...chapter, title: '开篇' };
      return { ...chapter };
    }
    return { ...chapter, title: picked };
  });
}

/** 功能注释：目录行展示「第 N 章」+ 标题，避免只剩序号右侧空白。 */
export function formatChapterTocDisplay(
  chapter: NovelChapterIndexItem,
  index: number,
): NovelChapterTocDisplay {
  const ordinal = `第${index + 1}章`;
  const rawTitle = String(chapter.title || '').trim();
  if (!rawTitle || isGenericChapterTitle(rawTitle)) {
    return { ordinal, title: '' };
  }
  // 标题若已是「第N章 xxx」则去掉重复序号前缀
  const stripped = rawTitle.replace(/^第\s*\d+\s*章\s*[·•\-—:]?\s*/u, '').trim();
  return { ordinal, title: stripped || rawTitle };
}

/**
 * 功能注释：按 scene_change 切章；标题优先用场景名，避免目录只有「第 N 章」。
 */
export function buildFallbackChapterIndexFromSteps(
  steps: Array<Record<string, unknown> | null | undefined>,
): NovelChapterIndexItem[] {
  const list = (Array.isArray(steps) ? steps : []).filter((s) => s && s.type) as Array<
    Record<string, unknown>
  >;
  const stepCount = list.length;
  if (stepCount < 1) return [];

  const starts = [0];
  for (let i = 1; i < stepCount; i += 1) {
    if (String(list[i]?.type || '') === 'scene_change') starts.push(i);
  }
  const unique = [...new Set(starts)].filter((n) => n >= 0 && n < stepCount);

  return normalizeNovelChapterIndex(
    unique.map((start, idx) => {
      const end = idx + 1 < unique.length ? unique[idx + 1] - 1 : stepCount - 1;
      const picked = pickChapterTitleFromSteps(list, start);
      return {
        id: `ch_${idx + 1}`,
        title: picked || (idx === 0 ? '开篇' : `第${idx + 1}章`),
        startStepIndex: start,
        endStepIndex: end,
      };
    }),
    stepCount,
  );
}
