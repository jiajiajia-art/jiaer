/**
 * 生成世界 · 平台 AI：走 funloom /api/romance/world-gen/complete（运营 text-llm + 积分账本）。
 * 禁止读局内「AI 配置」里的个人 baseUrl / apiKey。
 * API 基址：VITE_API_BASE_URL；空串 = 同源 /api（cn-gogo 等 Aliyun 部署）。
 */
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";
import type { WorldGenEngineId } from "./worldGenWizard.ts";

export type PlatformWorldGenChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 功能注释：拼平台 API 绝对/同源路径；基址可为空（同源反代） */
export function worldGenCompleteUrl(apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/romance/world-gen/complete`;
}

export type PlatformWorldGenCompleteOpts = {
  engineId?: WorldGenEngineId | string;
  moduleId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  max_tokens?: number;
};

/**
 * 功能注释：用平台 JWT 调后端补全；失败抛带 status/body 的 Error，供 worldGenGenerate 统一文案与 fail-fast。
 */
export async function completeViaPlatform(
  messages: PlatformWorldGenChatMsg[],
  opts: PlatformWorldGenCompleteOpts = {},
): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) {
    const err = Object.assign(new Error("请先登录平台账号后再生成世界。"), {
      status: 401,
      body: JSON.stringify({ message: "请先登录平台账号后再生成世界。", code: "NOT_LOGGED_IN" }),
    });
    throw err;
  }

  const ctl = opts.timeoutMs && opts.timeoutMs > 0 ? new AbortController() : undefined;
  const dog = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs) : undefined;
  if (opts.signal && ctl) {
    opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  }
  const signal = ctl?.signal ?? opts.signal;

  try {
    // 功能注释：空基址 → `/api/...`，与主站 HOST_ADDRESS='' 的 Aliyun 同源部署一致
    const res = await fetch(worldGenCompleteUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        messages,
        engineId: opts.engineId || "balanced",
        moduleId: opts.moduleId || "",
        max_tokens: opts.max_tokens || 4000,
      }),
    });

    const rawBody = await res.text().catch(() => "");
    let json: {
      success?: boolean;
      data?: { text?: string };
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
        (res.status === 401 ? "请先登录平台账号后再生成世界。" : `平台生成失败（${res.status}）`);
      throw Object.assign(new Error(msg), {
        status: res.status,
        body: rawBody.slice(0, 800),
        code: json?.code,
      });
    }

    const text = String(json?.data?.text || "").trim();
    if (!text) {
      throw Object.assign(new Error("平台返回空内容"), { status: 204, body: rawBody.slice(0, 200) });
    }
    return text;
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new DOMException("已取消", "AbortError");
    }
    if (ctl?.signal.aborted && opts.timeoutMs) {
      throw Object.assign(
        new Error(`平台生成超时（${Math.round((opts.timeoutMs ?? 0) / 1000)} 秒）`),
        { status: 408, body: "" },
      );
    }
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}
