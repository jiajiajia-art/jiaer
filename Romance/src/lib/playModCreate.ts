/** 功能注释：平台「创作游戏 → 玩法 Mod」入口查询参数。 */
export const PLAY_MOD_CREATE_QUERY = "createPlayMod";

export function shouldOpenPlayModCreate(
  search = typeof location !== "undefined" ? location.search : "",
): boolean {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const v = q.get(PLAY_MOD_CREATE_QUERY);
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export function ensurePlayModCreateQuery(): void {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get(PLAY_MOD_CREATE_QUERY) === "1") return;
    url.searchParams.set(PLAY_MOD_CREATE_QUERY, "1");
    history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}

/** 功能注释：C2.3「我的玩法 Mod → 继续编辑」携带的组件 id 查询参数 */
export const PLAY_MOD_EDIT_QUERY = "editComponent";

/** 功能注释：读取要继续编辑的组件 id；无则返回空串 */
export function readPlayModEditComponentId(
  search = typeof location !== "undefined" ? location.search : "",
): string {
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    return String(q.get(PLAY_MOD_EDIT_QUERY) || "").trim().slice(0, 80);
  } catch {
    return "";
  }
}

/**
 * 功能注释：从组件记录 payload 里还原玩法叠加包 Mod，供工坊 target 载入；
 * payload 无 mod 或缺 content 时返回 null（调用方提示「该记录无法继续编辑」）。
 */
export function modFromComponentPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const mod = (payload as { mod?: unknown }).mod;
  if (!mod || typeof mod !== "object") return null;
  const m = mod as Record<string, unknown>;
  if (!m.id || !m.content || typeof m.content !== "object") return null;
  return { ...m, kind: "addon", slotMerge: m.slotMerge || "merge" };
}

export function clearPlayModCreateQuery(): void {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(PLAY_MOD_CREATE_QUERY) && !url.searchParams.has(PLAY_MOD_EDIT_QUERY)) return;
    url.searchParams.delete(PLAY_MOD_CREATE_QUERY);
    url.searchParams.delete(PLAY_MOD_EDIT_QUERY);
    history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}
