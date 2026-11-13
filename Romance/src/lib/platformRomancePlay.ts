/**
 * 功能注释：玩家 / 审核预览读 Romance 内容。
 * - play=1：已上架发布镜像（非作者 live 草稿）
 * - reviewPreview=1：运营待审快照（需审核员 token）
 */
import { resolveFunloomApiBase, readFunloomAuthToken } from "./platformAvatarLibrary.ts";

export type RomancePlayMode = "play" | "reviewPreview" | null;

/** 功能注释：从 URL 解析玩家进局 / 审核预览参数 */
export function resolveRomancePlayMode(
  search = typeof location !== "undefined" ? location.search : "",
): { mode: RomancePlayMode; fileId: string } {
  const q = new URLSearchParams(search);
  const fileId = String(q.get("fileId") || "").trim();
  if (!fileId) return { mode: null, fileId: "" };
  if (q.get("reviewPreview") === "1") return { mode: "reviewPreview", fileId };
  if (q.get("play") === "1") return { mode: "play", fileId };
  return { mode: null, fileId };
}

function publishedContentUrl(fileId: string, apiBase: string): string {
  const base = String(apiBase || "").replace(/\/$/, "");
  return `${base}/api/games/romance/${encodeURIComponent(fileId)}/published-content`;
}

function reviewContentUrl(fileId: string, apiBase: string): string {
  const base = String(apiBase || "").replace(/\/$/, "");
  return `${base}/api/admin/moderation/publish-queue/${encodeURIComponent(fileId)}/romance-content`;
}

export type RomancePlayContentResult =
  | { ok: true; content: unknown }
  | { ok: false; error: string; needLogin?: boolean };

/** 功能注释：拉取已发布包；未上架或无镜像时失败，禁止回落到作者草稿 */
export async function fetchRomancePublishedContent(
  fileId: string,
  apiBase = resolveFunloomApiBase(),
): Promise<RomancePlayContentResult> {
  const id = String(fileId || "").trim();
  if (!id) return { ok: false, error: "缺少作品 id" };
  try {
    const res = await fetch(publishedContentUrl(id, apiBase), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      data?: { content?: unknown };
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.message || `加载发布内容失败（${res.status}）` };
    }
    return { ok: true, content: json.data?.content ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}

/** 功能注释：审核员只读待审快照；无 token 明确提示登录 */
export async function fetchRomancePendingReviewContent(
  fileId: string,
  apiBase = resolveFunloomApiBase(),
): Promise<RomancePlayContentResult> {
  const id = String(fileId || "").trim();
  if (!id) return { ok: false, error: "缺少作品 id" };
  const token = readFunloomAuthToken();
  if (!token) return { ok: false, error: "请先登录运营账号", needLogin: true };
  try {
    const res = await fetch(reviewContentUrl(id, apiBase), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      message?: string;
      data?: { content?: unknown };
    };
    if (!res.ok || !json.success) {
      return { ok: false, error: json.message || `拉取待审正文失败（${res.status}）` };
    }
    return { ok: true, content: json.data?.content ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "网络错误" };
  }
}
