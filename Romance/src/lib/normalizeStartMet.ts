/**
 * 功能注释：把 AI/旧数据里的 startMet 规范成 string[]。
 * 非法形态（对象、单字符串、数字）禁止直接展开，否则会抛「is not iterable」。
 */
export function normalizeStartMetList(raw: unknown): string[] | undefined {
  if (raw == null || raw === false) return undefined;
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    arr = raw.split(/[,，\s]+/).filter(Boolean);
  } else if (typeof raw === "object") {
    arr = Object.values(raw as Record<string, unknown>);
  } else {
    return undefined;
  }
  const ids = [...new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean))];
  return ids.length ? ids : undefined;
}
