/**
 * 功能注释：Romance 读平台题材——公共题材树（编辑器题材下拉 / 玩法商店适用题材）与作品详情上的题材（进局补世界题材）。
 * 两个读取都带缓存 / 进行中去重：同一页面生命周期内同一资源只打一次请求（StrictMode 双挂载也一样）。
 */
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export type PlatformThemeTag = { id: number; name: string; code: string };

/** 功能注释：把 /game-tags/tree 的一二级树拍平成可选题材（有子级取子级，无子级取自身）；非法节点丢弃。 */
export function flattenThemeTagTree(raw: unknown): PlatformThemeTag[] {
  const out: PlatformThemeTag[] = [];
  const seen = new Set<number>();
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue;
      const node = n as { id?: unknown; name?: unknown; code?: unknown; children?: unknown };
      const kids = Array.isArray(node.children) ? node.children : [];
      if (kids.length) { walk(kids); continue; }
      const id = Number(node.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, name: String(node.name ?? "").trim(), code: String(node.code ?? "").trim() });
    }
  };
  walk(raw);
  return out;
}

let tagsPromise: Promise<PlatformThemeTag[]> | null = null;

/** 功能注释：拉一次公共题材树并缓存；失败返回空数组且清缓存（下次可重试），不抛。 */
export function fetchPlatformThemeTags(): Promise<PlatformThemeTag[]> {
  if (tagsPromise) return tagsPromise;
  const p = (async () => {
    try {
      const res = await fetch(`${resolveFunloomApiBase()}/api/auth/game-tags/tree`, { headers: { Accept: "application/json" } });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown } | null;
      if (!res.ok || !json?.success) return [];
      return flattenThemeTagTree(json.data);
    } catch {
      return [];
    }
  })().then((list) => {
    if (!list.length) tagsPromise = null;
    return list;
  });
  tagsPromise = p;
  return p;
}

export type PlatformGameTheme = { themeTagIds: number[]; themeTagNames: string[] };

/** 功能注释：从 /auth/games/info 的 data 取题材；字段缺失 / 类型不对返回 null。 */
export function parseGameThemeFromInfo(data: unknown): PlatformGameTheme | null {
  if (!data || typeof data !== "object") return null;
  const row = data as { theme_tag_ids?: unknown; theme_tag_names?: unknown };
  const ids = Array.isArray(row.theme_tag_ids) ? row.theme_tag_ids.map(Number).filter((n) => Number.isFinite(n)) : [];
  const names = Array.isArray(row.theme_tag_names) ? row.theme_tag_names.map((s) => String(s ?? "").trim()) : [];
  if (!ids.length && !names.some(Boolean)) return null;
  return { themeTagIds: ids, themeTagNames: names };
}

const gameThemeInflight = new Map<string, Promise<PlatformGameTheme | null>>();

/** 功能注释：按作品 fileId 取平台题材（进行中去重）；任何失败返回 null，题材只是增强，不阻断进局 / 编辑。 */
export function fetchPlatformGameTheme(fileId: string): Promise<PlatformGameTheme | null> {
  const id = String(fileId || "").trim();
  if (!id) return Promise.resolve(null);
  const hit = gameThemeInflight.get(id);
  if (hit) return hit;
  const p = (async () => {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      const token = readFunloomAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${resolveFunloomApiBase()}/api/auth/games/info?fileId=${encodeURIComponent(id)}`, { headers });
      const json = (await res.json().catch(() => null)) as { success?: boolean; data?: unknown } | null;
      if (!res.ok || !json?.success) return null;
      return parseGameThemeFromInfo(json.data);
    } catch {
      return null;
    }
  })().finally(() => { gameThemeInflight.delete(id); });
  gameThemeInflight.set(id, p);
  return p;
}
