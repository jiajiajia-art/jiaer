/**
 * 功能注释：世界书关键词经常整段缺失，或被写成对象。
 * 编辑器审计会对它调用 .some；这里统一收成字符串列表，调用方只看 length。
 */
import { asTrimmedString } from "./asTrimmedString.ts";

export function keywordTexts(raw: unknown): string[] {
  const rows = Array.isArray(raw) ? raw : raw == null || raw === "" ? [] : [raw];
  return rows.map((item) => asTrimmedString(item)).filter(Boolean);
}
