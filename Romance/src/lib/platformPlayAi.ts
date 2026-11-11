/**
 * Romance 局内叙事 / Studio 预览 · 平台 AI：
 * 走 funloom /api/romance/play/complete（运营 text-llm + 积分账本）。
 * 禁止读局内「AI 配置」里的个人 baseUrl / apiKey。
 * API 基址：VITE_API_BASE_URL；空串 = 同源 /api（cn-gogo 等 Aliyun 部署）。
 */
import { aiRouteBody } from "./platformAiRoutes.ts";
import { aiTraceBody } from "./aiTrace.ts";
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
  /** 功能注释：计费溯源功能点（见 lib/aiTrace.ts） */
  feature?: string;
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
        ...aiRouteBody("text"),
        ...aiTraceBody("text", { feature: opts.feature }),
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

/* —— 真流式：/api/romance/play/stream（SSE）——
 * 协议（后端交接见 docs/后端需求-流式输出.md）：
 *   data: {"delta":"一段文字"}                          逐段正文
 *   data: {"done":true,"pointsDeducted":3,"remainingPoints":97}   结束（含扣点）
 *   data: {"error":"说明","code":"INSUFFICIENT_POINTS"}  出错
 * 也兼容 OpenAI 风格：data: {"choices":[{"delta":{"content":"…"}}]} / data: [DONE]
 * 后端未上线（404/405/501 或非 event-stream）时自动退回同步 complete，调用方无感。 */

export function playStreamUrl(apiBase = resolveFunloomApiBase()): string {
  const base = String(apiBase || "").trim().replace(/\/$/, "");
  return `${base}/api/romance/play/stream`;
}

export type PlaySseEvent = { delta?: string; done?: boolean; error?: string; code?: string; pointsDeducted?: number; remainingPoints?: number };

/** 功能注释：解析一行 SSE；非 data 行 / 空行返回 null */
export function parsePlaySseLine(line: string): PlaySseEvent | null {
  const t = line.trim();
  if (!t.startsWith("data:")) return null;
  const payload = t.slice(5).trim();
  if (!payload) return null;
  if (payload === "[DONE]") return { done: true };
  let j: Record<string, unknown>;
  try { j = JSON.parse(payload); } catch { return { delta: payload }; }
  if (typeof j.error === "string" || (j.error && typeof j.error === "object")) {
    const err = typeof j.error === "string" ? j.error : String((j.error as { message?: string }).message ?? "平台演绎失败");
    return { error: err, code: typeof j.code === "string" ? j.code : undefined };
  }
  const choice = Array.isArray(j.choices) ? (j.choices[0] as { delta?: { content?: string } } | undefined) : undefined;
  const delta = typeof j.delta === "string" ? j.delta : typeof choice?.delta?.content === "string" ? choice.delta.content : undefined;
  const num = (v: unknown) => (v == null || !Number.isFinite(Number(v)) ? undefined : Math.max(0, Math.floor(Number(v))));
  return { delta, done: j.done === true || undefined, pointsDeducted: num(j.pointsDeducted), remainingPoints: num(j.remainingPoints) };
}

/**
 * 功能注释：平台真流式补全；每收到一段就回调 onDelta(chunk, full)。
 * 接口不可用时退回 completePlayViaPlatform（一次性回调），保证功能不坏。
 */
export async function streamPlayViaPlatform(
  messages: PlatformPlayChatMsg[],
  onDelta: (chunk: string, full: string) => void,
  opts: PlatformPlayCompleteOpts = {},
): Promise<PlatformPlayCompleteResult> {
  const token = requireAuthToken();
  const ctl = new AbortController();
  if (opts.signal) opts.signal.addEventListener("abort", () => ctl.abort(), { once: true });
  // 看门狗：首包与流中静默超过时限即中止
  const idleMs = opts.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 120_000;
  let dog: ReturnType<typeof setTimeout> | undefined;
  const kick = () => { if (dog) clearTimeout(dog); dog = setTimeout(() => ctl.abort(), idleMs); };
  const fallback = async () => {
    const r = await completePlayViaPlatform(messages, opts);
    onDelta(r.text, r.text);
    return r;
  };
  try {
    kick();
    const res = await fetch(playStreamUrl(), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream", "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        messages,
        max_tokens: opts.max_tokens || 4000,
        stream: true,
        ...aiRouteBody("text"),
        ...aiTraceBody("text", { feature: opts.feature }),
      }),
    });
    const type = res.headers.get("content-type") || "";
    if ([404, 405, 501].includes(res.status) || (res.ok && !type.includes("text/event-stream"))) {
      if (dog) clearTimeout(dog);
      return await fallback();
    }
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      let msg = "";
      try { const j = JSON.parse(body); msg = String(j?.message || j?.error || ""); } catch { /* 非 JSON */ }
      throw Object.assign(new Error(msg || (res.status === 401 ? "请先登录平台账号后再演绎剧情。" : `平台演绎失败（${res.status}）`)), { status: res.status, body: body.slice(0, 800) });
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "", points = 0;
    let remaining: number | undefined;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      kick();
      buf += dec.decode(value, { stream: true });
      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const ev = parsePlaySseLine(line);
        if (!ev) continue;
        if (ev.error) throw Object.assign(new Error(ev.error), { status: 500, code: ev.code, body: line.slice(0, 400) });
        if (ev.delta) { full += ev.delta; onDelta(ev.delta, full); }
        if (ev.pointsDeducted != null) points = ev.pointsDeducted;
        if (ev.remainingPoints != null) remaining = ev.remainingPoints;
      }
    }
    const tail = parsePlaySseLine(buf);
    if (tail?.delta) { full += tail.delta; onDelta(tail.delta, full); }
    if (!full.trim()) throw Object.assign(new Error("平台返回空内容"), { status: 204, body: "" });
    return { text: full, pointsDeducted: points, remainingPoints: remaining };
  } catch (e) {
    if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");
    if ((e as { name?: string })?.name === "AbortError") {
      throw Object.assign(new Error(`平台演绎超时（${Math.round(idleMs / 1000)} 秒无响应）`), { status: 408, body: "" });
    }
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}
