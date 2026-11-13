/**
 * 平台语音合成：已登录平台 → POST /api/romance/tts/synthesize（运营「AI 模型中心」配置的语音线路 + 积分）。
 * 线路与音色列表走 GET /api/romance/ai-routes?capability=tts（每条线路带 voices）。
 * 计费：创作（编辑器 / 作者试玩）扣织梦豆 billCurrency="points"；玩家游玩扣 KK 币 billCurrency="kk"；按所选线路倍率。
 * 返回 JSON { data: { audio } }（dataURL 或 https）或直接返回音频二进制，两种都认。
 */
import { aiRouteBody } from "./platformAiRoutes";
import { aiTraceBody } from "./aiTrace";
import { readFunloomAuthToken, resolveFunloomApiBase } from "./platformAvatarLibrary.ts";

export function platformTtsUrl(apiBase = resolveFunloomApiBase()): string {
  return `${String(apiBase || "").trim().replace(/\/$/, "")}/api/romance/tts/synthesize`;
}

/** 功能注释：创作走织梦豆、游玩走 KK 币；场景沿用 aiTrace 的判定（只看页面地址） */
export function ttsBilling(feature?: string) {
  const trace = aiTraceBody("tts", { feature });
  return { ...trace, billCurrency: trace.scene === "play_tts" ? ("kk" as const) : ("points" as const) };
}

export async function synthSpeechViaPlatform(text: string, opts: { voice?: string; gender?: string; speed?: number; feature?: string } = {}): Promise<string> {
  const token = readFunloomAuthToken();
  if (!token) throw Object.assign(new Error("请先登录平台账号后再使用语音。"), { status: 401, code: "NOT_LOGGED_IN" });
  const res = await fetch(platformTtsUrl(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json, audio/*", "Content-Type": "application/json" },
    body: JSON.stringify({
      text: text.slice(0, 600),
      ...(opts.voice ? { voice: opts.voice } : {}),
      ...(opts.gender ? { gender: opts.gender } : {}),
      speed: opts.speed ?? 1,
      ...aiRouteBody("tts"),
      ...ttsBilling(opts.feature),
    }),
  });
  const type = res.headers.get("content-type") || "";
  if (res.ok && type.startsWith("audio/")) return URL.createObjectURL(await res.blob());
  const raw = await res.text().catch(() => "");
  let json: { success?: boolean; data?: { audio?: string; url?: string }; message?: string; code?: string } | null = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  const audio = String(json?.data?.audio || json?.data?.url || "").trim();
  if (!res.ok || json?.success === false || !audio) {
    const msg = String(json?.message || "").trim() || (res.status === 401 ? "请先登录平台账号后再使用语音。" : `语音合成失败（${res.status}）`);
    throw Object.assign(new Error(msg), { status: res.status, code: json?.code });
  }
  return audio;
}
