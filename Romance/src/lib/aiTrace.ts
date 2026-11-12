/**
 * 功能注释：AI 计费溯源字段——play/complete、world-gen/complete、images/generate 三个扣费接口统一附带，
 * 让后端把每一次上游调用记到「哪个场景 / 哪部作品 / 哪次前端请求」上，运营仪表盘可按用途拆账。
 * 判定只看当前页面地址（不猜）：
 *   ?play=1&fileId=…          → play_*（玩家游玩），fileId 取地址里的作品 id
 *   ?reviewPreview=1&fileId=… → review_*（审核预览）
 *   其余（创作页 / 编辑器 / 作者试玩）→ create_*，fileId 取 ?draftId=（未保存过的草稿为空）
 */
import { resolveRomancePlayMode } from "./platformRomancePlay.ts";
import { readRomancePlatformDraftId } from "./platformRomanceDraft.ts";

export type AiTraceKind = "text" | "image" | "tts";
export type AiTraceScene =
  | "create_text" | "create_image" | "create_tts"
  | "play_text" | "play_image" | "play_tts"
  | "review_text" | "review_image" | "review_tts";
/** 功能注释：fileId 从哪里来，后端落库原样保存，便于核对 */
export type AiTraceFileIdSource = "url_play" | "url_review" | "url_draft" | "none";

export type AiTraceBody = {
  scene: AiTraceScene;
  fileId?: string;
  fileIdSource: AiTraceFileIdSource;
  /** 功能注释：前端生成的请求 id；同一次调用的重试沿用同一个，后端按它关联多次上游尝试 */
  clientRequestId: string;
  /** 功能注释：发起调用的功能点（如 world-gen:module、editor:image、play:chat），便于定位到具体按钮 */
  feature?: string;
  /** 功能注释：同一次生成任务（如一个世界模组的骨架 + 补文 + 重试）共用；退款按它对账 */
  traceGroupId?: string;
};

function newRequestId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const newAiTraceGroupId = () => newRequestId();

export function aiTraceBody(kind: AiTraceKind, opts: { feature?: string; clientRequestId?: string; traceGroupId?: string; search?: string } = {}): AiTraceBody {
  const search = opts.search ?? (typeof location !== "undefined" ? location.search : "");
  const play = resolveRomancePlayMode(search);
  let scene: AiTraceScene;
  let fileId = "";
  let fileIdSource: AiTraceFileIdSource = "none";
  if (play.mode === "play") {
    scene = `play_${kind}` as AiTraceScene;
    fileId = play.fileId;
    fileIdSource = "url_play";
  } else if (play.mode === "reviewPreview") {
    scene = `review_${kind}` as AiTraceScene;
    fileId = play.fileId;
    fileIdSource = "url_review";
  } else {
    scene = `create_${kind}` as AiTraceScene;
    fileId = readRomancePlatformDraftId(search);
    fileIdSource = fileId ? "url_draft" : "none";
  }
  return {
    scene,
    ...(fileId ? { fileId } : {}),
    fileIdSource,
    clientRequestId: opts.clientRequestId || newRequestId(),
    ...(opts.feature ? { feature: String(opts.feature).slice(0, 64) } : {}),
    ...(opts.traceGroupId ? { traceGroupId: opts.traceGroupId } : {}),
  };
}
