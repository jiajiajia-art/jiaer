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

export function clearPlayModCreateQuery(): void {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(PLAY_MOD_CREATE_QUERY)) return;
    url.searchParams.delete(PLAY_MOD_CREATE_QUERY);
    history.replaceState(null, "", url.toString());
  } catch {
    /* ignore */
  }
}
