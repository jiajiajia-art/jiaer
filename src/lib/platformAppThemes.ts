/**
 * 功能注释：C0.2 手机应用「适用题材」纯逻辑。
 * 创作者上架前必须至少选 1 个题材；题材 id 存在平台应用 content JSON，不改库表。
 */

/** 上架时至少选 1 个题材的提示原文 */
export const PLATFORM_APP_THEME_REQUIRED_HINT = '请至少选择 1 个适用题材';
/** 单个应用最多可选题材数，与后端 normalizeApplicableThemeTagIds 上限一致 */
export const PLATFORM_APP_THEME_MAX = 30;

/** 功能注释：归一题材 id 列表——正整数、去重、截断上限；非数组返回空数组 */
export function normalizeThemeTagIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    const n = Number(item);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
    if (out.length >= PLATFORM_APP_THEME_MAX) break;
  }
  return out;
}

/** 功能注释：多选切换——已选则取消，未选则追加（超上限忽略） */
export function toggleThemeTagId(current: number[], id: number): number[] {
  if (!Number.isInteger(id) || id <= 0) return current;
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length >= PLATFORM_APP_THEME_MAX) return current;
  return [...current, id];
}

/** 功能注释：上架校验——返回错误文案；通过返回空串 */
export function validateApplicableThemesForPublish(ids: number[] | undefined | null): string {
  return normalizeThemeTagIds(ids).length > 0 ? '' : PLATFORM_APP_THEME_REQUIRED_HINT;
}

/** 功能注释：从平台应用记录读取题材 id——优先后端拆出的字段，兜底读 content 对象 */
export function readAppThemeTagIds(app: { applicableThemeTagIds?: unknown; content?: unknown }): number[] {
  const direct = normalizeThemeTagIds(app.applicableThemeTagIds);
  if (direct.length) return direct;
  const c = app.content;
  if (c && typeof c === 'object' && !Array.isArray(c)) {
    return normalizeThemeTagIds((c as { applicableThemeTagIds?: unknown }).applicableThemeTagIds);
  }
  return [];
}
