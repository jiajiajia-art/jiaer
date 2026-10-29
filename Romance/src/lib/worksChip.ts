/** 功能注释：资料卡作品条的书名号预览。开关打开时包上《》，关掉只留作品名。 */
export function worksMarkPreview(works: unknown, plain: unknown): string {
  const list = Array.isArray(works) ? works : [];
  const sample = list.map((item) => (typeof item === "string" ? item.trim() : "")).find(Boolean) || "风起南巷";
  const bare = sample.replace(/^《+|》+$/g, "");
  return plain ? bare : `《${bare}》`;
}
