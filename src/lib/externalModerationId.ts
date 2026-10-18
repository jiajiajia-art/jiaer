/**
 * 功能注释：警告/处罚对外 id（moderation_id）为 16 位数字字符串。
 * 禁止 Number()，以免超过 Number.MAX_SAFE_INTEGER 丢精度。
 */
export function parseExternalModerationId(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!/^\d{16}$/.test(value)) return null;
  return value;
}

/** 功能注释：查询参数优先 relatedModerationId，兼容旧 relatedId */
export function readRelatedModerationIdParam(searchParams: URLSearchParams): string | null {
  return parseExternalModerationId(
    searchParams.get('relatedModerationId') || searchParams.get('relatedId'),
  );
}
