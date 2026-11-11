import type { HomeListFilters, HomeListMode } from './gameBrowseFilters.ts';
import { HOME_NOVEL_QUICK_FILTER_MODE } from './gameBrowseFilters.ts';

/**
 * 视觉小说快捷筛与题材组合时的互斥规则：
 * - 点「视觉小说」→ 清空题材（小说历史数据常无题材，防空列表）
 * - 在视觉小说模式下再选题材 → 退出快捷筛回到全部，保留题材
 */
export function resolveHomeFiltersForNovelThemeConflict(
  prev: HomeListFilters,
  next: Partial<Pick<HomeListFilters, 'mode' | 'tagId'>>,
): HomeListFilters {
  const merged: HomeListFilters = {
    ...prev,
    ...next,
  };

  const switchingToNovel = Object.prototype.hasOwnProperty.call(next, 'mode')
    && next.mode === HOME_NOVEL_QUICK_FILTER_MODE
    && prev.mode !== HOME_NOVEL_QUICK_FILTER_MODE;

  if (switchingToNovel) {
    return {
      ...merged,
      mode: HOME_NOVEL_QUICK_FILTER_MODE,
      tagId: null,
    };
  }

  const pickingThemeWhileNovel = Object.prototype.hasOwnProperty.call(next, 'tagId')
    && next.tagId != null
    && prev.mode === HOME_NOVEL_QUICK_FILTER_MODE;

  if (pickingThemeWhileNovel) {
    return {
      ...merged,
      mode: 'all' as HomeListMode,
      tagId: next.tagId ?? null,
    };
  }

  return merged;
}
