/**
 * 功能注释：运营后台「适用题材」多选的纯逻辑（C2.1.2）。
 * 与后端 normalizeApplicableThemeTagIds 口径一致：正整数、去重、最多 30 个；改绑至少保留 1 个。
 */

export const MAX_APPLICABLE_THEME_TAGS = 30;

/** 功能注释：切换某题材的选中态；超过上限时忽略新增，返回新数组不改入参 */
export function toggleThemeTagId(current: readonly number[], id: number): number[] {
  if (!Number.isInteger(id) || id <= 0) return [...current];
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length >= MAX_APPLICABLE_THEME_TAGS) return [...current];
  return [...current, id];
}

/** 功能注释：把 id 列表转成「题材名、题材名」展示；找不到名称的 id 显示为 #id（题材被停用/删除时可见） */
export function formatThemeTagLabels(
  ids: readonly number[] | null | undefined,
  tags: ReadonlyArray<{ id: number; name: string }>,
): string {
  if (!ids || !ids.length) return '';
  const nameById = new Map(tags.map((t) => [t.id, t.name]));
  return ids.map((id) => nameById.get(id) || `#${id}`).join('、');
}

/** 功能注释：保存前校验——改绑后至少 1 个题材；返回错误文案或 null */
export function validateThemeRebind(ids: readonly number[]): string | null {
  return ids.length >= 1 ? null : '请至少选择 1 个适用题材';
}
