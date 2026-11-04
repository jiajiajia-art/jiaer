/**
 * 功能注释：模组 content 里「应为数组」的字段，AI 常写成单对象 / {list:[]}。
 * 预览 resolve 里 [...x] 会炸 TypeError: x is not iterable；统一先收成数组。
 */
export function asModArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw.filter((row) => row !== undefined && row !== null) as T[];
  }
  if (!raw || typeof raw !== "object") return [];
  const bag = raw as Record<string, unknown>;
  for (const k of ["items", "list", "entries", "rows", "data", "npcs", "apps", "tracks", "nodes", "paths", "attrs", "customAttrs"]) {
    if (Array.isArray(bag[k])) return asModArray<T>(bag[k]);
  }
  // 功能注释：单条门槛 / 条件常带 metric（无 id）；须收成 [obj]，否则 evalRequires for-of 拿到空或再炸
  if ("id" in bag || "name" in bag || "label" in bag || "metric" in bag) return [raw as T];
  const vals = Object.values(bag);
  if (vals.length && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
    return vals as T[];
  }
  return [];
}
