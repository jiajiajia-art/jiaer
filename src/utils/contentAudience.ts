export const CONTENT_AUDIENCE_VALUES = ['male', 'female', 'all'] as const;

export type ContentAudience = (typeof CONTENT_AUDIENCE_VALUES)[number];

export const CONTENT_AUDIENCE_OPTIONS: readonly ContentAudience[] = CONTENT_AUDIENCE_VALUES;

/**
 * 规范化作品分类；只接受男性向/女性向/全性向对应的英文码
 */
export function normalizeContentAudience(value: unknown): ContentAudience | null {
  const normalized = String(value || '').trim().toLowerCase();
  return CONTENT_AUDIENCE_VALUES.includes(normalized as ContentAudience)
    ? (normalized as ContentAudience)
    : null;
}

export function isValidContentAudience(value: unknown): value is ContentAudience {
  return normalizeContentAudience(value) !== null;
}

/**
 * 单选作品分类：点同一项保持选中，点另一项切换
 */
export function selectContentAudience(
  current: ContentAudience | null,
  next: ContentAudience,
): ContentAudience {
  const normalized = normalizeContentAudience(next);
  if (!normalized) {
    return current ?? CONTENT_AUDIENCE_OPTIONS[0];
  }
  return normalized;
}
