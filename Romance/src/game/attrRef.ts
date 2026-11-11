/**
 * 功能注释：属性引用纠正（无依赖，供编辑器 / 保存自愈 / 运行时共用）。
 * AI 常把作品属性写成 {kind:"stat", key:"observation"}，实际应为 {kind:"metric", key:"c:observation"}。
 */
function text(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
}

/**
 * 按作品属性 id 或名称匹配；reserved 是引擎内置键（命中则不改）。对不上返回 null。
 */
export function resolveAttrRef(
  kind: string,
  key: string,
  attrs: { id?: unknown; label?: unknown }[] | undefined,
  reserved: readonly string[] = [],
): { kind: "metric"; key: string } | null {
  if (kind !== "stat" && kind !== "metric") return null;
  const k = text(key);
  if (!k || k.startsWith("c:") || reserved.includes(k)) return null;
  const hit = (Array.isArray(attrs) ? attrs : []).find((a) => text(a?.id) === k || text(a?.label) === k);
  return hit && text(hit.id) ? { kind: "metric", key: `c:${text(hit.id)}` } : null;
}

/** 功能注释：引擎内置属性键（娱乐圈八维 + 内置指标）；作者条件 / 效果一律不再允许引用，货币 money 除外 */
export const ENGINE_STAT_KEYS: readonly string[] = ["yanji", "geyi", "koucai", "yitai", "donggan", "tineng", "caizhi", "zixin"];
export const ENGINE_METRIC_KEYS: readonly string[] = ["fame", "reputation", "stress", "energy", "works", "blackFans", "week"];

/**
 * 功能注释：属性引用是否脏数据（应删除）——
 * stat 类型一律不再有效（作者属性都是 metric + c:）；metric 引用内置指标也删除；货币和 c: 作品属性保留。
 * 调用前应先用 resolveAttrRef 尝试对回作品属性。
 */
export function isDirtyAttrRef(kind: string, key: string): boolean {
  const k = text(key);
  if (kind === "stat") return true;
  if (kind === "metric") return !k || ENGINE_METRIC_KEYS.includes(k) || (!k.startsWith("c:") && k !== "money");
  return false;
}
