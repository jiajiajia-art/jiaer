/**
 * 对接 funloom 平台应用表（/api/platform-apps）。
 * 手机、作品编辑器、创作页共用；作品只存已装 appId，打开按 type 读 content。
 */
import { readFunloomAuthToken, resolveFunloomApiBase, resolvePlatformAvatarUrl } from "./platformAvatarLibrary";

export const PLATFORM_APP_TYPES = ["chat", "message", "browse", "read", "video", "job"] as const;
export type PlatformAppType = (typeof PLATFORM_APP_TYPES)[number];

export type PlatformAppStatus = "draft" | "published";

export type PlatformApp = {
  appId: string;
  authorId: string;
  authorName: string;
  name: string;
  icon: string;
  previews: string[];
  summary: string;
  category: string;
  type: PlatformAppType | string;
  content: unknown;
  status: PlatformAppStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export { OFFICIAL_PLATFORM_APP_IDS } from "./phoneAppsConfig";

export const PLATFORM_APP_TYPE_LABEL: Record<PlatformAppType, string> = {
  chat: "聊天",
  message: "信息",
  browse: "浏览",
  read: "阅读",
  video: "视频",
  job: "招聘",
};

function apiBase(): string {
  return resolveFunloomApiBase();
}

export function resolvePlatformAppIconUrl(path: string | null | undefined): string {
  return resolvePlatformAvatarUrl(path);
}

async function parseJson(res: Response) {
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: unknown;
    message?: string;
    code?: string;
  } | null;
  return { res, json };
}

/** 功能注释：商店 / 编辑器只拉已上架 */
export async function listPublishedPlatformApps(q = ""): Promise<PlatformApp[]> {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = readFunloomAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const { res, json } = await parseJson(
    await fetch(`${apiBase()}/api/platform-apps${qs ? `?${qs}` : ""}`, { headers }),
  );
  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(json?.message || "加载应用商店失败");
  }
  return json.data as PlatformApp[];
}

/** 功能注释：按已装 appId 批量解析；缺的 id 由调用方标「应用不可用」 */
export async function batchPlatformApps(ids: string[]): Promise<PlatformApp[]> {
  const uniq = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (!uniq.length) return [];
  const { res, json } = await parseJson(
    await fetch(`${apiBase()}/api/platform-apps/batch?ids=${encodeURIComponent(uniq.join(","))}`, {
      headers: { Accept: "application/json" },
    }),
  );
  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(json?.message || "加载应用失败");
  }
  return json.data as PlatformApp[];
}

export async function getPlatformApp(appId: string): Promise<PlatformApp | null> {
  const id = String(appId || "").trim();
  if (!id) return null;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = readFunloomAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const { res, json } = await parseJson(
    await fetch(`${apiBase()}/api/platform-apps/${encodeURIComponent(id)}`, { headers }),
  );
  if (res.status === 404) return null;
  if (!res.ok || !json?.success || !json.data) {
    throw new Error(json?.message || "加载应用失败");
  }
  return json.data as PlatformApp;
}

/** 功能注释：content.legacyUi 指向现成页面；否则按 type 打开通用页 */
export function platformAppLegacyUi(content: unknown): string {
  if (!content || typeof content !== "object") return "";
  const ui = (content as { legacyUi?: unknown }).legacyUi;
  return typeof ui === "string" ? ui.trim() : "";
}

export function platformAppContentText(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (typeof o.body === "string") return o.body;
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return "";
    }
  }
  return String(content);
}
