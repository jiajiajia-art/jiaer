/**
 * 封面 / 素材「生图」统一入口。
 * 已登录平台 → /api/romance/images/generate（运营「生图配置」epone/ggb + 积分）。
 * 未登录且个人 AI 配置齐全 → 浏览器直连个人网关（兜底）。
 * 禁止再要求创作者去「设置 · AI 配置」填图5的密钥。
 */
import type { AIConfig } from "./types";
import { generateImage, imageConfigured } from "./ai";
import { hasPlatformPlayAuth } from "./platformPlayAi.ts";
import { appendNegativeSection } from "./editorImagePrompts.ts";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

/** 功能注释：拼平台编辑器生图 API；基址可为空（同源反代） */
export function editorImageGenerateUrl(apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/romance/images/generate`;
}

/** 功能注释：登录平台即可生图；否则需个人生图配置 */
export function platformImageConfigured(cfg: AIConfig): boolean {
  return hasPlatformPlayAuth() || imageConfigured(cfg);
}

export { appendNegativeSection };

export type PlatformImageGenOptions = {
  /** 功能注释：可选参考图 dataURL / https，最多 2 张，传给平台垫图 */
  referenceImages?: string[];
  signal?: AbortSignal;
  /** 功能注释：负面词（三层提示词之一）；单独字段发给平台，同时在 prompt 末尾带一段明确标注，兼容尚未识别该字段的网关 */
  negativePrompt?: string;
};

/** 功能注释：裁掉空串并最多保留 2 张，避免请求体过大 / 超限 */
export function normalizeClientReferenceImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => String(x ?? "").trim())
    .filter((s) => /^data:image\//i.test(s) || /^https?:\/\//i.test(s))
    .slice(0, 2);
}

/**
 * 功能注释：用平台 JWT 调后端生图；失败抛带 status/body 的 Error。
 */
export async function generateImageViaPlatform(
  prompt: string,
  size?: string,
  options: PlatformImageGenOptions = {},
): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) {
    throw Object.assign(new Error("请先登录平台账号后再生图。"), {
      status: 401,
      code: "NOT_LOGGED_IN",
    });
  }

  const referenceImages = normalizeClientReferenceImages(options.referenceImages);
  const negativePrompt = String(options.negativePrompt ?? "").trim();
  const res = await fetch(editorImageGenerateUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: appendNegativeSection(prompt, negativePrompt),
      size: size || undefined,
      ...(negativePrompt ? { negativePrompt } : {}),
      ...(referenceImages.length ? { referenceImages } : {}),
    }),
    signal: options.signal,
  });

  const rawBody = await res.text().catch(() => "");
  let json: {
    success?: boolean;
    data?: { image?: string };
    message?: string;
    error?: string;
    code?: string;
  } | null = null;
  try {
    json = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success) {
    const msg =
      String(json?.message || json?.error || "").trim() ||
      (res.status === 401 ? "请先登录平台账号后再生图。" : `平台生图失败（${res.status}）`);
    throw Object.assign(new Error(msg), {
      status: res.status,
      body: rawBody.slice(0, 800),
      code: json?.code,
    });
  }

  const image = String(json?.data?.image || "").trim();
  if (!image) {
    throw Object.assign(new Error("平台未返回图片"), { status: 204, body: rawBody.slice(0, 200) });
  }
  return image;
}

export async function generatePlatformImage(
  cfg: AIConfig,
  prompt: string,
  size?: string,
  options: PlatformImageGenOptions = {},
): Promise<string> {
  // 功能注释：优先平台网关（图5 运营配置）；个人 Key 仅作未登录兜底（个人网关暂不垫图）
  if (hasPlatformPlayAuth()) {
    return generateImageViaPlatform(prompt, size, options);
  }
  if (options.signal?.aborted) {
    throw Object.assign(new Error("已取消"), { name: "AbortError" });
  }
  return generateImage(cfg, appendNegativeSection(prompt, options.negativePrompt), size);
}
