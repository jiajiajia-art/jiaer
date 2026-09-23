/**
 * 创作页作品列表条数：全页分页 10；预览态 PC 铺满当前已加载列表，手机只露 2 条。
 */

export const WORKS_PAGE_SIZE = 10;
/** 与 GameGrid 手机断点一致 */
export const WORKS_MOBILE_MEDIA = '(max-width: 768px)';
export const WORKS_MOBILE_PREVIEW_SIZE = 2;
/** 与 getUserData limit=100 对齐，PC 预览一次排满不必点「全部」 */
export const WORKS_DESKTOP_PREVIEW_SIZE = 100;

export type WorksListMode = 'preview' | 'full';

/**
 * 功能注释：预览页 PC 用桌面条数铺满网格；手机默认 2 条。全页模式走分页 10。
 */
export function resolveWorksListLimit(options: {
  mode: WorksListMode;
  isMobile: boolean;
}): number {
  if (options.mode !== 'preview') {
    return WORKS_PAGE_SIZE;
  }
  return options.isMobile ? WORKS_MOBILE_PREVIEW_SIZE : WORKS_DESKTOP_PREVIEW_SIZE;
}

/** 功能注释：PC 预览已铺满列表，不展示「全部」入口；手机超过预览条数才需要。 */
export function shouldShowWorksViewAll(options: {
  mode: WorksListMode;
  isMobile: boolean;
}): boolean {
  return options.mode === 'preview' && options.isMobile;
}
