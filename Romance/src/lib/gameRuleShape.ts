/** 功能注释：玩法规则的分支常被 AI 写成缺省或单条对象；编辑器直接 .map 会崩成 reading 'map'。 */
export function normalizeRuleBranches(raw: unknown): { conds: unknown[]; effects: unknown[]; match?: "all" | "any"; notice?: string; eventId?: string }[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const nested = ["branches", "list", "items"].map((k) => o[k]).find(Array.isArray);
    list = (nested as unknown[] | undefined) ?? (("conds" in o || "effects" in o || "eventId" in o) ? [o] : []);
  }
  return list.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { conds: [], effects: [] };
    const b = item as Record<string, unknown>;
    const match = b.match === "any" || b.match === "all" ? b.match : undefined;
    const notice = typeof b.notice === "string" && b.notice.trim() ? b.notice : undefined;
    const eventId = typeof b.eventId === "string" && b.eventId.trim() ? b.eventId.trim() : undefined;
    return { ...b, conds: Array.isArray(b.conds) ? b.conds : [], effects: Array.isArray(b.effects) ? b.effects : [], ...(match ? { match } : {}), ...(notice ? { notice } : {}), ...(eventId ? { eventId } : {}) };
  });
}
