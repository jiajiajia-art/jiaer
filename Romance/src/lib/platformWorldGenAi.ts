/**
 * 生成世界 · 平台 AI：走 funloom /api/romance/world-gen/complete（运营 text-llm + 积分账本）。
 * 禁止读局内「AI 配置」里的个人 baseUrl / apiKey。
 * API 基址：VITE_API_BASE_URL；空串 = 同源 /api（cn-gogo 等 Aliyun 部署）。
 */
import { aiRouteBody } from "./platformAiRoutes";
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

/** 功能注释：模组最终失败后返还已扣织梦豆 */
export function worldGenRefundUrl(apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/romance/world-gen/refund`;
}

export type PlatformWorldGenCompleteOpts = {
  engineId?: WorldGenEngineId | string;
  moduleId?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  max_tokens?: number;
};

/** 功能注释：成功补全须带回本次实扣分，供前端解析失败后汇总返还 */
export type PlatformWorldGenCompleteResult = {
  text: string;
  pointsDeducted: number;
  remainingPoints?: number;
};

function requireAuthToken(): string {
  const token = readFunloomAuthToken();
  if (!token) {
    const err = Object.assign(new Error("请先登录平台账号后再生成世界。"), {
      status: 401,
      body: JSON.stringify({ message: "请先登录平台账号后再生成世界。", code: "NOT_LOGGED_IN" }),
    });
    throw err;
  }
  return token;
}

/**
 * 功能注释：用平台 JWT 调后端补全；失败抛带 status/body 的 Error，供 worldGenGenerate 统一文案与 fail-fast。
 * 成功返回 text + pointsDeducted（LLM 已扣费；客户端 JSON 校验失败须走 refund）。
 */
export async function completeViaPlatform(
  messages: PlatformWorldGenChatMsg[],
  opts: PlatformWorldGenCompleteOpts = {},
): Promise<PlatformWorldGenCompleteResult> {
  const token = requireAuthToken();

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
        ...aiRouteBody("text"),
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
        new Error(`平台生成超时（${Math.round((opts.timeoutMs ?? 0) / 1000)} 秒）`),
        { status: 408, body: "" },
      );
    }
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}

export type PlatformWorldGenRefundOpts = {
  engineId?: WorldGenEngineId | string;
  moduleId?: string;
  /** 本次模组累计已扣（含自动重试各次） */
  points: number;
  reason?: string;
  signal?: AbortSignal;
};

/**
 * 功能注释：模组最终失败（含 JSON 修完仍挂）时返还已扣织梦豆；成功返回 true，网络/业务失败返回 false（不抛，避免盖住原错误）。
 */
export async function refundWorldGenPointsViaPlatform(
  opts: PlatformWorldGenRefundOpts,
): Promise<boolean> {
  const points = Math.max(0, Math.floor(Number(opts.points) || 0));
  if (points < 1) return true;

  let token: string;
  try {
    token = requireAuthToken();
  } catch {
    return false;
  }

  try {
    const res = await fetch(worldGenRefundUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: opts.signal,
      body: JSON.stringify({
        engineId: opts.engineId || "balanced",
        moduleId: opts.moduleId || "",
        points,
        reason: opts.reason || "module_failed",
      }),
    });
    const rawBody = await res.text().catch(() => "");
    let json: { success?: boolean } | null = null;
    try {
      json = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      json = null;
    }
    return !!(res.ok && json?.success);
  } catch {
    return false;
  }
}
