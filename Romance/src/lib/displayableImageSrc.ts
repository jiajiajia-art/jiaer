/**
 * 功能注释：地点背景等字段常被写成说明文字或 {url} 对象。
 * 只有能当图片地址用的值才交给 <img>，避免缩略图画出浏览器裂图。
 */
import { asTrimmedString } from "./asTrimmedString.ts";

const IMAGE_SRC = /^(https?:\/\/|data:image\/|blob:|\/)/i;

export function displayableImageSrc(raw: unknown): string {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    for (const key of ["url", "src", "image", "href"]) {
      const nested = displayableImageSrc(record[key]);
      if (nested) return nested;
    }
  }
  const text = asTrimmedString(raw);
  if (!text || text === "[object Object]") return "";
  return IMAGE_SRC.test(text) ? text : "";
}
