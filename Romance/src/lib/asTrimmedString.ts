/**
 * 功能注释：把任意值收成可 trim 的字符串。
 * AI / 脏数据常把 name、terms 写成对象或数字，直接 .trim() 会炸「t.trim is not a function」。
 * 对象若带 zh/en/text/name/label/n/t/v 等常见包装字段，解出第一段非空字符串，避免洗成空导致编辑器「必填」。
 */

/** 功能注释：AI 常把文案包进这些键；按优先级取第一个可用字符串 */
const OBJECT_TEXT_KEYS = [
  "zh", "zh-CN", "zh_cn", "cn", "en", "text", "name", "label", "title", "value",
  "content", "desc", "n", "t", "v", "l", "s", "msg", "message", "string",
] as const;

function unwrapObjectText(raw: Record<string, unknown>, depth: number): string {
  if (depth <= 0) return "";
  for (const k of OBJECT_TEXT_KEYS) {
    if (!(k in raw)) continue;
    const hit = asTrimmedString(raw[k], "", depth - 1);
    if (hit) return hit;
  }
  // 功能注释：单字段对象（如 { fog: '雾港' }）再兜底一次
  const vals = Object.values(raw);
  if (vals.length === 1) return asTrimmedString(vals[0], "", depth - 1);
  return "";
}

export function asTrimmedString(raw: unknown, fallback = "", depth = 3): string {
  if (typeof raw === "string") return raw.trim();
  if (raw == null) return fallback;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const unwrapped = unwrapObjectText(raw as Record<string, unknown>, depth);
    return unwrapped || fallback;
  }
  return fallback;
}

/** 功能注释：非空才返回字符串，否则 undefined（便于删除空 terms 键） */
export function asNonEmptyTrimmed(raw: unknown): string | undefined {
  const s = asTrimmedString(raw);
  return s || undefined;
}
