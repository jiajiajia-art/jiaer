/**
 * Romance 局内叙事 / Studio 预览 · 平台 AI：
 * 走 funloom /api/romance/play/complete（运营 text-llm + 积分账本）。
 * 禁止读局内「AI 配置」里的个人 baseUrl / apiKey。
 * API 基址：VITE_API_BASE_URL；空串 = 同源 /api（cn-gogo 等 Aliyun 部署）。
 */
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export type PlatformPlayChatMsg = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 功能注释：拼平台局内叙事 API 路径；基址可为空（同源反代） */
export function playCompleteUrl(apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/romance/play/complete`;
}

/** 功能注释：已登录平台账号则局内叙事走 text-llm，无需个人 Key */
export function hasPlatformPlayAuth(): boolean {
  return !!readFunloomAuthToken();
}

export type PlatformPlayCompleteOpts = {
  timeoutMs?: number;
  signal?: AbortSignal;
  max_tokens?: number;
};

export type PlatformPlayCompleteResult = {
  text: string;
  pointsDeducted: number;
  remainingPoints?: number;
};

function requireAuthToken(): string {
  const token = readFunloomAuthToken();
  if (!token) {
    const err = Object.assign(new Error("请先登录平台账号后再演绎剧情。"), {
      status: 401,
      body: JSON.stringify({ message: "请先登录平台账号后再演绎剧情。", code: "NOT_LOGGED_IN" }),
    });
    throw err;
  }
  return token;
}

/**
 * 功能注释：用平台 JWT 调后端补全；失败抛带 status/body 的 Error，供 friendlyAIError 翻译。
 */
export async function completePlayViaPlatform(
  messages: PlatformPlayChatMsg[],
  opts: PlatformPlayCompleteOpts = {},
): Promise<PlatformPlayCompleteResult> {
  const token = requireAuthToken();

  const ctl = opts.timeoutMs && opts.timeoutMs > 0 ? new AbortController() : undefined;
  const dog = ctl ? setTimeout(() => ctl.abort(), opts.timeoutMs) : undefined;
  if (opts.signal && ctl) {
    opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  }
  const signal = ctl?.signal ?? opts.signal;

  try {
    const res = await fetch(playCompleteUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal,
      body: JSON.stringify({
        messages,
        max_tokens: opts.max_tokens || 4000,
      }),
    });

    const rawBody = await res.text().catch(() => "");
    let json: {
      success?: boolean;
      data?: { text?: string; pointsDeducted?: number; remainingPoints?: number };
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
        (res.status === 401 ? "请先登录平台账号后再演绎剧情。" : `平台演绎失败（${res.status}）`);
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
    const pointsDeducted = Math.max(0, Math.floor(Number(json?.data?.pointsDeducted) || 0));
    const remainingRaw = json?.data?.remainingPoints;
    const remainingPoints =
      remainingRaw == null || !Number.isFinite(Number(remainingRaw))
        ? undefined
        : Math.max(0, Math.floor(Number(remainingRaw)));
    return { text, pointsDeducted, remainingPoints };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") {
      throw new DOMException("已取消", "AbortError");
    }
    if (ctl?.signal.aborted && opts.timeoutMs) {
      throw Object.assign(
        new Error(`平台演绎超时（${Math.round((opts.timeoutMs ?? 0) / 1000)} 秒）`),
        { status: 408, body: "" },
      );
    }
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}
