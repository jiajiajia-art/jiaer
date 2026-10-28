/**
 * 功能注释：把任意值收成可 trim 的字符串。
 * AI / 脏数据常把 name、terms 写成对象或数字，直接 .trim() 会炸「t.trim is not a function」。
 */
export function asTrimmedString(raw: unknown, fallback = ""): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return fallback;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  return fallback;
}

/** 功能注释：非空才返回字符串，否则 undefined（便于删除空 terms 键） */
export function asNonEmptyTrimmed(raw: unknown): string | undefined {
  const s = asTrimmedString(raw);
  return s || undefined;
}
