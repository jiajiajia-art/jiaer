import { nextTurnCueBlock } from "./eventNotices.ts";
import { mobsHere } from "../game/mud";
import { applyMemory, chronicleFallbackSummary, memoryBlock } from "./chronicle";
import { parseStepJson, type StepParseFail } from "./stepParse.ts";
import { affinityCapOf } from "../worlds/star2005/content";
import { clampAffinity, engineRulesBlock, fillPlaceholders, oocText, parseRp, rulesOf, seqRandom } from "../game/engineRules";
import { AIHttpError } from "./aiError";
import { completePlayViaPlatform,
  streamPlayViaPlatform, hasPlatformPlayAuth } from "./platformPlayAi.ts";
import { charCardBlock } from "../game/charCard";
import { evalFixedCond, storylineBrief } from "../game/fixedEvents";
import { sidelineBrief } from "./sidelines";
import { hasWorldGigs, getWorldPromptHeader, getWorldPromptFragment, getWorldNpcs, getWorldRuleDims, promptFrag, term, getWorldSlot, worldItemsOfRoom, worldItemById, worldActivitiesOfRoom, worldRoom, worldLocOf, getWorldSidelines } from "../mods/registry";
import { customActsOf, customItemsOf, findCustomItem, firedOf, spotDesc, spotEventsOf, spotName } from "../game/mapedits";
import { drawProfileAvatar, randomPools, systemPools } from "../game/avatarPools";
import { ruleEffects, orderIncome } from "../game/worldRules";
/* ————— AI 接入：配置校验 / SSE 流式 / 结构化解析 / 记忆压缩 / mock 兜底 ————— */
import { ensureFertility, rollIntimacy } from "../game/pregnancy";
import type { AIConfig, AIStep, GameState, Npc, Player, Segment } from "./types";
import { TIME_UNIT_LABEL, limitDays } from "./types";
import { uid } from "./store";
import { canRomance, phaseOf, startDateLabel } from "../game/logic";
import { ensureBirthday, findNpc, isPlaceholderName, normName, tickBirthdays, tickPlayerAge } from "./npcIdentity";
import { STAT_LABELS, STAT_ORDER, WORLD_RULE_DIMS, fameTier, tierOf, clampStat, worldRuleLabel, creationCopy } from "../game/data";
import { creationVars, fillText } from "../game/creationText";
import { defaultWorldBook } from "../game/worldbook";
import { factionLoreEntries, factionsAtRoom } from "../game/factions";
import { pickWorldBook, type WorldBookCtx, type WorldBookPick } from "../game/worldbookPick";
import { activeEventsBlock } from "../game/loreContext";
import { affinityOf, kbBlock, remember, romanceBlock } from "../game/npcKnowledge";
import { blankRel, ensureRelations, relDimLabel } from "../game/relations";
import { romanticCapOf } from "../worlds/star2005/content";
import { knowledgeBlock } from "../game/kb";
import { timelinePrompt } from "../game/npcTimeline";
import { attrCap, walletDef, wallet } from "../game/wallet";
import { phoneLinkPrompt } from "../game/phoneLink";
import { linkNewcomer, personGender, relNetPromptLines } from "../game/relNet";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

/* 单回合叙事对好感的最大影响（与金额封顶同理）：AI 只能"建议"小幅变动，
 * 大额好感只能靠确定性玩法（私下联系/情感线）经营，防止模型凭空拉满关系。 */
const AFFINITY_TURN_CAP = 10;
/* 单回合叙事对爱慕（关系轴 sim.relations[pid].romantic）的最大影响：比好感更谨慎，心动要一点点攒 */
const LOVE_TURN_CAP = 5;
const isLoveLabel = (label: unknown) => label === "爱慕" || label === "心动" || label === relDimLabel("romantic");

function endpoint(cfg: AIConfig, path: string) {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  return base + path;
}

/* 浏览器直连失败（多为对方未开 CORS 跨域）时给出可读原因，而不是笼统的 Failed to fetch */
async function aiFetch(cfg: AIConfig, url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    const base = cfg.baseUrl.replace(/\/+$/, "");
    const v1 = /\/v\d+(\/|$)/.test(base) ? "" : `；另外多数 OpenAI 兼容接口的地址需以 /v1 结尾（如 ${base}/v1）`;
    throw new Error(`无法从浏览器连接「${base}」：该服务未允许网页跨域访问（CORS），请求被浏览器拦截。请改用支持浏览器直连的接口地址，或通过自建代理转发${v1}。`);
  }
}

/* —— 生图：OpenAI 兼容 /images/generations，返回可直接作 src 的 dataURL 或图片 URL —— */
export const imageConfigured = (cfg: AIConfig) => !!(cfg.imgBaseUrl || cfg.baseUrl) && !!(cfg.imgApiKey || cfg.apiKey) && !!cfg.imgModel;
export async function generateImage(cfg: AIConfig, prompt: string, size?: string): Promise<string> {
  const base = (cfg.imgBaseUrl || cfg.baseUrl).replace(/\/+$/, "");
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.imgApiKey || cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.imgModel, prompt, n: 1, size: size || cfg.imgSize || "1024x1792" }),
  });
  if (!res.ok) throw new Error(`生图失败（${res.status}）${(await res.text().catch(() => "")).slice(0, 120)}`);
  const data = await res.json();
  const d = data?.data?.[0];
  if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  if (d?.url) return d.url;
  throw new Error("接口未返回图片");
}

/* —— 获取模型列表 —— */
export async function fetchModels(cfg: AIConfig): Promise<string[]> {
  const res = await aiFetch(cfg, endpoint(cfg, "/models"), {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) throw new Error(`模型列表获取失败（${res.status}）${res.status === 404 && !/\/v\d+$/.test(cfg.baseUrl.replace(/\/+$/, "")) ? "：地址可能缺少 /v1" : ""}`);
  const data = await res.json();
  const list: string[] = (data?.data ?? data ?? [])
    .map((m: { id?: string } | string) => (typeof m === "string" ? m : m.id))
    .filter(Boolean);
  if (!list.length) throw new Error("接口未返回可用模型");
  return list;
}

/* —— 测试连接（发送一次极小请求） —— */
export async function testConnection(cfg: AIConfig): Promise<string> {
  const res = await aiFetch(cfg, endpoint(cfg, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model || "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 4,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`连接失败（${res.status}）${t.slice(0, 120)}`);
  }
  return "连接成功，模型可用。";
}

/** 功能注释：个人 Key 已填，或已登录平台（走运营文案配置）均可演绎 */
export const isPersonalConfigured = (cfg: AIConfig) => !!cfg.baseUrl && !!cfg.apiKey && !!cfg.model;
export const isConfigured = (cfg: AIConfig) => hasPlatformPlayAuth() || isPersonalConfigured(cfg);

/** 功能注释：把多模态 content 压成纯文本，供平台 play/complete 使用 */
function flattenMsgContent(content: ChatMsg["content"]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((p) => (p && typeof p === "object" && p.type === "text" ? String(p.text || "") : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function toPlatformMessages(messages: ChatMsg[]): { role: "system" | "user" | "assistant"; content: string }[] {
  return messages
    .map((m) => ({ role: m.role, content: flattenMsgContent(m.content) }))
    .filter((m) => m.content);
}

/* —— SSE 流式对话；onDelta 收到增量文本；返回完整文本 —— */
/* 默认关闭深度思考：reasoning.effort=none（DeepSeek V4 等）；DeepSeek/火山用 thinking.type，硅基流动/Qwen 用 enable_thinking。
 * 接口不认这些参数时（4xx）自动去掉重试一次。 */
// 依次尝试的思考参数：用户选 none 时先尝试关闭，不被接受就退到 low（DeepSeek V4 只支持 low/high/max），最后才裸发
function thinkCandidates(cfg: AIConfig): Record<string, unknown>[] {
  const effort = cfg.reasoningEffort ?? "none";
  if (effort !== "none") return [{ reasoning: { effort } }, {}];
  return [
    { reasoning: { effort: "none" }, thinking: { type: "disabled" }, enable_thinking: false },
    { thinking: { type: "disabled" } },
    { reasoning: { effort: "low" } },
    {},
  ];
}
async function postChat(cfg: AIConfig, body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const go = (b: Record<string, unknown>) => fetch(endpoint(cfg, "/chat/completions"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    signal,
    body: JSON.stringify(b),
  });
  const list = thinkCandidates(cfg);
  let res!: Response;
  for (const extra of list) {
    res = await go({ ...body, ...extra });
    if (res.status !== 400 && res.status !== 422) return res;
  }
  return res;
}

/**
 * 功能注释：已登录平台时走平台文案模型，不再直连个人 Key。
 * 优先真流式 /api/romance/play/stream（逐段 onDelta）；后端未上线时自动退回同步 complete。
 */
async function streamChatViaPlatform(
  messages: ChatMsg[],
  onDelta: (chunk: string, full: string) => void,
  signal?: AbortSignal,
  onStage?: (stage: string) => void,
): Promise<string> {
  onStage?.("正在连接平台文案模型");
  let first = true;
  const { text } = await streamPlayViaPlatform(toPlatformMessages(messages), (chunk, full) => {
    if (first) { first = false; onStage?.("正在生成"); }
    onDelta(chunk, full);
  }, {
    signal,
    feature: "chat:stream",
    timeoutMs: 120_000,
    max_tokens: 4000,
  });
  if (!text.trim()) throw new AIHttpError(204, "接口返回了空内容");
  return text;
}

export async function streamChat(
  cfg: AIConfig,
  messages: ChatMsg[],
  onDelta: (chunk: string, full: string) => void,
  signal?: AbortSignal,
  onThink?: (full: string) => void,
  onStage?: (stage: string) => void,
): Promise<string> {
  // 功能注释：平台 JWT 在场 → 强制运营 text-llm，避免 Studio 预览误用失效的个人 Key
  if (hasPlatformPlayAuth()) {
    return streamChatViaPlatform(messages, onDelta, signal, onStage);
  }

  let think = "";
  // 关闭流式：整段请求后一次性回调，调用方无需区分
  if (!cfg.stream) {
    const r = await postChat(cfg, { model: cfg.model, messages, temperature: cfg.temperature, top_p: cfg.topP }, signal);
    if (!r.ok) throw new AIHttpError(r.status, await r.text().catch(() => ""));
    const data = await r.json();
    const msg = data?.choices?.[0]?.message ?? {};
    const rc: string = msg.reasoning_content ?? msg.reasoning ?? "";
    if (rc && onThink) onThink(rc);
    const content: string = msg.content ?? "";
    if (content) onDelta(content, content);
    return content;
  }
  // 看门狗：首包 90s、流中静默 60s 即中止，避免接口无响应时永远卡在「演绎中」
  const ctl = new AbortController();
  signal?.addEventListener("abort", () => ctl.abort());
  let timedOut = "";
  let dog: ReturnType<typeof setTimeout> | null = null;
  const arm = (ms: number, why: string) => { if (dog) clearTimeout(dog); dog = setTimeout(() => { timedOut = why; ctl.abort(); }, ms); };
  arm(90_000, "接口 90 秒内没有任何响应，请检查接口地址、模型名或网络");
  const fail = (e: unknown): never => {
    if (dog) clearTimeout(dog);
    if (timedOut) throw new AIHttpError(408, timedOut);
    throw e;
  };
  let res: Response;
  onStage?.("正在连接 AI 接口");
  try {
    res = await postChat(cfg, { model: cfg.model, messages, temperature: cfg.temperature, top_p: cfg.topP, stream: true }, ctl.signal);
  } catch (e) { return fail(e); }
  if (!res.ok || !res.body) {
    if (dog) clearTimeout(dog);
    const t = await res.text().catch(() => "");
    throw new AIHttpError(res.status, t);
  }
  arm(60_000, "AI 回复中途停止超过 60 秒，已中止");
  onStage?.(`已连接（${res.status}），等待模型开始输出`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try { chunk = await reader.read(); } catch (e) { return fail(e); }
    const { done, value } = chunk;
    if (done) break;
    arm(60_000, "AI 回复中途停止超过 60 秒，已中止");
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const json = JSON.parse(payload);
        if (json?.error) { timedOut = ""; if (dog) clearTimeout(dog); throw new AIHttpError(500, JSON.stringify(json.error)); }
        const d = json?.choices?.[0]?.delta;
        const r: string = d?.reasoning_content ?? d?.reasoning ?? "";
        if (r && onThink) { think += r; onThink(think); }
        const delta: string = d?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(delta, full);
        }
      } catch (e) {
        if (e instanceof AIHttpError) throw e;
        /* 跳过不完整分片 */
      }
    }
  }
  if (dog) clearTimeout(dog);
  if (!full.trim()) throw new AIHttpError(204, think ? "模型只输出了思考过程，没有正文。可在 AI 配置里把「思考强度」调为 low 后重试" : "接口返回了空内容，请确认模型名是否正确");
  return full;
}

/* —— 非流式（记忆压缩用） ——
 * timeoutMs：整次请求（含读完响应）的时限，到点中止并抛 408；不传则不设限，其余调用方行为不变 */
export async function complete(cfg: AIConfig, messages: ChatMsg[], timeoutMs?: number): Promise<string> {
  // 功能注释：平台登录态优先走运营文案配置（与 streamChat 一致）
  if (hasPlatformPlayAuth()) {
    const { text } = await completePlayViaPlatform(toPlatformMessages(messages), {
      feature: "chat:complete",
      timeoutMs: timeoutMs && timeoutMs > 0 ? timeoutMs : 120_000,
      max_tokens: 4000,
    });
    return text;
  }

  const ctl = timeoutMs && timeoutMs > 0 ? new AbortController() : undefined;
  const dog = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : undefined;
  try {
    const res = await postChat(cfg, { model: cfg.model, messages, temperature: 0.4 }, ctl?.signal);
    if (!res.ok) throw new AIHttpError(res.status, await res.text().catch(() => ""));
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    if (ctl?.signal.aborted) throw new AIHttpError(408, `接口 ${Math.round((timeoutMs ?? 0) / 1000)} 秒内没有完成回复，已中止`);
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}

/* —— 原生工具调用（OpenAI 兼容 function calling） ——
 * 模型可直接以结构化参数调用工具，省去从正文里抠 JSON；接口不支持 tools 时自动退回普通对话。 */
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { name: string; args: unknown; raw: string };
export async function completeWithTools(
  cfg: AIConfig,
  messages: ChatMsg[],
  tools: ToolDef[],
  timeoutMs?: number,
): Promise<{ text: string; calls: ToolCall[]; native: boolean }> {
  // 功能注释：平台文案链路暂不透传 tools，退回普通 complete（与接口不支持 tools 时一致）
  if (hasPlatformPlayAuth()) {
    return { text: await complete(cfg, messages, timeoutMs), calls: [], native: false };
  }
  const ctl = timeoutMs && timeoutMs > 0 ? new AbortController() : undefined;
  const dog = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : undefined;
  try {
    const res = await postChat(cfg, {
      model: cfg.model, messages, temperature: 0.4,
      tools: tools.map((t) => ({ type: "function", function: t })), tool_choice: "auto",
    }, ctl?.signal);
    if (res.status === 400 || res.status === 404 || res.status === 422) {
      return { text: await complete(cfg, messages, timeoutMs), calls: [], native: false };
    }
    if (!res.ok) throw new AIHttpError(res.status, await res.text().catch(() => ""));
    const data = await res.json();
    const msg = data?.choices?.[0]?.message ?? {};
    const calls: ToolCall[] = (Array.isArray(msg.tool_calls) ? msg.tool_calls : []).map((c: { function?: { name?: string; arguments?: string } }) => {
      const raw = c?.function?.arguments ?? "";
      let args: unknown = undefined;
      try { args = raw ? JSON.parse(raw) : {}; } catch { try { args = JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")); } catch { args = undefined; } }
      return { name: c?.function?.name ?? "", args, raw };
    });
    return { text: typeof msg.content === "string" ? msg.content : "", calls, native: true };
  } catch (e) {
    if (ctl?.signal.aborted) throw new AIHttpError(408, `接口 ${Math.round((timeoutMs ?? 0) / 1000)} 秒内没有完成回复，已中止`);
    throw e;
  } finally {
    if (dog) clearTimeout(dog);
  }
}

/* ————— 内容解析 ————— */

// 流式过程中，把 JSON 数据块从展示文本里剔除（玩家只看到剧情）
export function displayText(full: string): string {
  let t = full;
  const fence = t.search(/```json|```\s*\{/i);
  if (fence >= 0) t = t.slice(0, fence);
  else {
    const brace = t.search(/\n\s*\{[\s\S]*"(narrative|state_diff|narration|options|world|player_changes|npc_changes)"/);
    if (brace >= 0) t = t.slice(0, brace);
  }
  return stripMarkup(t);
}

/* 剥离模型漏出的提示词残骸：「# 谨遵指令」类指令行、--- 分隔线、各级 markdown 标题符号与加粗符号。
 * 玩家只看到纯叙事；标题行若带正文（如「## 第一幕」）则仅去掉 # 号保留文字，纯指令标题整行删除。 */
/* 兜底：模型偶尔把数值快照抄进正文（「相关负责人信任 28」「演技185」），含「数值名 + 数字」的句子整句去掉 */
let leakRe: RegExp | null = null;
function dropStatLeaks(line: string): string {
  if (!/\d/.test(line)) return line;
  leakRe ??= new RegExp(`(${["名气", "口碑", "压力", "负责人信任", "信任值", "黑粉", "好感度?", "爱慕值?", "心动值?", "行动点", "行动力", "精力值?", "八维", ...Object.values(STAT_LABELS)].join("|")})\\s*(值|度|分)?\\s*[:：为是]?\\s*[+＋\\-－]?\\d{1,4}(?![万千百元块岁年月日号点时分秒周天])`);
  const parts = line.match(/[^。！？!?]+[。！？!?」』”]*|[^。！？!?]+$/g) ?? [line];
  const kept = parts.filter((p) => !leakRe!.test(p));
  return kept.length === parts.length ? line : kept.join("");
}
const DIRECTIVE_LINE = /^\s*#*\s*[【\[]?\s*(谨遵指令|系统指令|指令|输出规范|结构化数据|状态变更|state_diff|tabs|memory_updates|save_summary|need_clarification|narrative)\s*[】\]]?\s*[:：]?\s*$/i;
export function stripMarkup(text: string): string {
  return text
    .split("\n")
    .map(dropStatLeaks)
    .filter((l) => !isChapterTitle(l) && !DIRECTIVE_LINE.test(l) && !/^\s*#*\s*[【\[]?谨遵指令/.test(l) && !/^\s*(-{3,}|\*{3,}|_{3,}|={3,})\s*$/.test(l))
    .map((l) => l.replace(/^\s{0,3}#{1,6}\s*/, "").replace(/\*\*(.+?)\*\*/g, "$1"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* AI 输出异常检测：正常中文叙事每隔十几个字必有标点，
 * 若出现「大量连续汉字、中间无任何标点/空白」的特征，判为乱码，
 * 前端据此拦截、引导重新生成，而非把乱码渲染给玩家。 */
const GARBLE_RUN = 60; // 连续无标点汉字达到该长度即判为异常
export function looksGarbled(text: string): boolean {
  if (!text) return false;
  const runs = text.match(/[一-鿿]{40,}/g);
  return !!runs && runs.some((r) => r.length >= GARBLE_RUN);
}

/* 模型自拟的章节标题行：【序章 · xx】【第一章 xx】【楔子】等 */
export const isChapterTitle = (line: string) => /^[【\[〔]\s*(序章|序幕|楔子|引子|尾声|终章|番外|第[一二三四五六七八九十百零\d]+[章幕回节卷周天日])[^】\]〕]*[】\]〕]$/.test(line.trim());

/* 说话人标签必须像个名字：短、且不含标点。
 * 否则「妈，」苏疏影拉上拉链……这类「以一句台词开头的旁白」会被误认成说话人「妈，」。 */
const SPEAKER_BAD = /[，。！？、；：…,.!?;:~～—"“”'‘’（）()《》〈〉\s]/;
export const isSpeakerName = (name: string) => name.length > 0 && name.length <= 12 && !SPEAKER_BAD.test(name);
/** 旧存档兼容：已被误拆成对话的段落（说话人不像名字）在显示时还原为旁白 */
export function repairSegments(segs: Segment[]): Segment[] {
  return segs.map((sg) => (sg.kind === "dialogue" && !isSpeakerName(sg.speaker.trim()) ? { kind: "narration", text: `「${sg.speaker}」${sg.text}` } : sg));
}

/** 去掉行首漏出的字段标签（【剧情正文】/【正文】/[正文]，可带冒号），返回剩余正文（已 trim） */
export function stripFieldLabel(line: string): string {
  return line.trim().replace(/^[【\[](剧情)?正文[】\]]\s*[:：]?\s*/, "").trim();
}

// 把散文剧情解析为分段（旁白 / 对话）
export function proseToSegments(prose: string): Segment[] {
  const segs: Segment[] = [];
  const lines = prose.split(/\n/);
  for (const raw of lines) {
    // 去掉模型偶尔漏出的字段标签（如「【剧情正文】」「【正文】：」），避免当成旁白显示
    const line = stripFieldLabel(raw);
    if (!line) continue;
    if (isChapterTitle(line)) continue; // 「【序章 · 天光未亮】」这类章节标题不展示
    // 约定格式「角色名」：台词——用「」时必须带冒号（不带冒号的「…」多半是台词本身）；【角色名】冒号可省
    const m = line.match(/^([【「\[])(.+?)[】」\]]([:：]?)\s*(.*)$/);
    if (m && m[4] && isSpeakerName(m[2].trim()) && (m[1] !== "「" || m[3])) segs.push({ kind: "dialogue", speaker: m[2].trim(), text: m[4] });
    else segs.push({ kind: "narration", text: line });
  }
  return segs;
}

// 从完整回复里抽取 JSON 数据块
export function extractStep(full: string): AIStep | null {
  return parseStepDetailed(full).step;
}

/** 功能注释：解析失败原因——no-json 没写状态块；truncated 块没写完（流被截断）；invalid 块写了但不是合法 JSON */
export type { StepParseFail };

/** 功能注释：解析并归一化状态块；失败带原因（见 lib/stepParse.ts） */
export function parseStepDetailed(full: string): { step: AIStep | null; reason?: StepParseFail } {
  const r = parseStepJson(full);
  return r.obj ? { step: normalizeStep(r.obj as AIStep) } : { step: null, reason: r.reason };
}

/** 功能注释：状态块修复请求——沿用本回合原提示词，附上 AI 已写的正文，只让它补一个完整的 ```json 块 */
export function buildStepRepairMessages(original: ChatMsg[], full: string, reason: StepParseFail): ChatMsg[] {
  const why = reason === "truncated" ? "状态块没写完就中断了" : reason === "invalid" ? "状态块不是合法 JSON（可能有注释、尾逗号或缺引号）" : "没有输出状态块";
  return [
    ...original,
    { role: "assistant", content: full.slice(0, 6000) },
    {
      role: "user",
      content: `（系统）你上一条回复${why}。正文保持不变，不要重写剧情。请只输出与这段正文对应的一个完整 \`\`\`json 状态块，字段与约定格式一致，不要注释、不要尾逗号、不要任何其它文字。`,
    },
  ];
}

/* 结构化协议归一：state_diff 内的变更与顶层旧字段合并为同一份 AIStep，
 * 由 applyStep 一次性写入状态中枢；narrative 与 narration 互为兜底。 */
export function normalizeStep(raw: AIStep): AIStep {
  const st: AIStep = { ...raw };
  const d = raw.state_diff;
  if (d && typeof d === "object") {
    if (d.world) st.world = { ...(d.world ?? {}), ...(raw.world ?? {}) };
    if (d.player_changes && !raw.player_changes) st.player_changes = d.player_changes;
    if (Array.isArray(d.npc_changes)) st.npc_changes = [...(raw.npc_changes ?? []), ...d.npc_changes];
    if (Array.isArray(d.intimate) && !raw.intimate) st.intimate = d.intimate;
    if (d.game_end && raw.game_end === undefined) st.game_end = d.game_end;
  }
  if (!st.narration && typeof raw.narrative === "string") st.narration = raw.narrative;
  // 容错：模型常把数值直接写成 player_changes.money: -200 / fame: 5（而非 attrs 数组），
  // 这里统一转成 attrs delta，避免剧情里花了钱、账本却没变的割裂
  const pc0 = st.player_changes as (Record<string, unknown> & { attrs?: { key?: string; delta?: number }[] }) | undefined;
  if (pc0 && typeof pc0 === "object") {
    const attrs = Array.isArray(pc0.attrs) ? [...pc0.attrs] : [];
    for (const [k, v] of Object.entries(pc0)) {
      if (k === "attrs" || typeof v !== "number" || !Number.isFinite(v) || !v) continue;
      if (!attrs.some((a) => a?.key === k)) attrs.push({ key: k, delta: v });
    }
    if (attrs.length) st.player_changes = { ...(pc0 as object), attrs } as AIStep["player_changes"];
  }
  if (st.narration) st.narration = stripMarkup(st.narration);
  st.need_clarification = (Array.isArray(raw.need_clarification) ? raw.need_clarification : []).map(String).map((q) => q.trim()).filter(Boolean);
  return st;
}

/* 剧情重复检测：本回合叙事与最近一回合高度相同（去标点后前 80 字一致，或整体包含）即视为复读 */
export function isRepeatNarrative(prev: string, cur: string): boolean {
  const norm = (t: string) => t.replace(/[\s，。！？、；：“”‘’「」『』（）()…—,.!?;:"'\-]/g, "");
  const a = norm(prev), b = norm(cur);
  if (a.length < 40 || b.length < 40) return false;
  return a === b || a.slice(0, 80) === b.slice(0, 80) || a.includes(b) || b.includes(a);
}

/* ————— 系统提示词 ————— */
export function buildSimSnapshot(state: GameState): string {
  const s = state.sim;
  if (!s) return "";
  const stats = STAT_ORDER.map((k) => `${STAT_LABELS[k]}${s.stats[k]}`).join("、");
  const tier = fameTier(s.fame).label;
  const gig = term("gig", "工作");
  const active = s.activeGigId ? `进行中${gig}剩余 ${s.gigDaysLeft} 天` : `无在拍${gig}`;
  return `【事业数值引擎（幕后真实数据：剧情走向须与之一致，但这些数字与字段名是给你看的，严禁出现在旁白、台词或心事里；只能写成可感知的现象，如"负责人信任低"→"她对你还不太放心"）】
第 ${s.week} 周 · ${phaseOf(s.week)}｜${term("fame", "名气")} ${s.fame}（${tier}）｜${term("reputation", "口碑")} ${s.reputation}｜压力 ${s.stress}｜${wallet.bound() ? `${wallet.name()} ${wallet.fmt(wallet.balance(s))}` : `资金 ${wallet.short(s.money)}`}｜行动力 ${s.energy}
八维：${stats}
${term("works", "作品")} ${s.works}｜奖项 ${s.awards}｜黑粉 ${s.blackFans}｜负责人信任 ${s.trust}｜${active}${s.dating ? `｜交往中：${[s.dating, ...(s.partners ?? [])].map((id) => state.npcs.find((n) => n.id === id)?.name ?? id).join("、")}` : ""}${s.spouses?.length ? `｜配偶：${s.spouses.map((id) => state.npcs.find((n) => n.id === id)?.name ?? id).join("、")}` : ""}`;
}

/* 世界·社会规则块：仅当玩家在设置里开启时注入，让 AI 的世界观与叙事遵循这些设定。 */
function buildWorldRules(state: GameState): string {
  const wr = state.worldRules;
  if (!wr?.enabled) return "";
  const female = !/男/.test(state.player.gender ?? "女");
  const dims = getWorldRuleDims()?.length ? getWorldRuleDims() : WORLD_RULE_DIMS;
  const lines = dims.map((d) => {
    const cur = wr.choices[d.id] ?? d.def;
    const opt = d.options.find((o) => o.id === cur);
    const fx = ruleEffects(d.id, cur, female, hasWorldGigs());
    return `· ${d.label}：${opt?.label ?? worldRuleLabel(d.id, cur)}——${opt?.desc ?? ""}${fx.length ? `（系统已落地：${fx.join("；")}）` : ""}`;
  }).join("\n");
  return `【世界·社会规则】（玩家设定，本局世界观须严格遵循；与现实不符处以此为准。NPC 的言行、社会舆论、称谓与家庭观念都要体现这些规则；数值效果由系统结算，叙事不得与之矛盾）
${lines}

`;
}

/* 自定义属性：当前值 + 档位 + 说明；AI 用 player_changes.attrs 的 key 增减 */
function customAttrLine(state: GameState): string {
  const defs = state.attrDefs ?? [];
  if (!defs.length) return "";
  const cur = walletDef(state);
  const rows = defs.map((d) => {
    const v = state.player.attrs.find((a) => a.key === d.id)?.value ?? d.init;
    const t = tierOf(v, d.tiers);
    return `${d.label}(key=${d.id}) ${v}${d.max ? `/${d.max}` : ""}${t ? `【${t}】` : ""}${cur?.id === d.id ? "【通用货币】" : ""}${d.desc ? `：${d.desc}` : ""}`;
  });
  // 钱包绑定了自定义货币：主线里的买卖 / 赚钱 / 收礼 / 打赏都记在这个属性上，不再用 money
  const money = cur ? `\n通用货币：「${cur.label}」(key=${cur.id})。主角在剧情中购买、花费、赚钱、收红包或转账时，在 player_changes.attrs 用 key=${cur.id} 写 delta（花费为负）；不要使用 money。手机里的购物、打赏、红包、转账已由系统自动记账，不要重复扣加。` : "";
  return `自定义属性：${rows.join("｜")}（剧情使其变化时，在 player_changes.attrs 里用对应 key 写 delta）${money}\n`;
}

/* 游玩偏好：本局设定 > 世界观默认；视角不填 = 跟随世界观叙事口吻；方向仅本局（设备偏好，不跟世界观） */
export function playPrefsOf(state: Pick<GameState, "playPrefs">): import("./types").PlayPrefs {
  const d = getWorldSlot("play");
  return {
    // 功能注释：游戏模式暂未开放，固定剧情模式（世界观默认 / 旧存档里的游戏模式也按剧情模式）
    mode: "novel" as const,
    pov: state.playPrefs?.pov ?? d?.pov,
    // 功能注释：横竖屏暂不支持选择，旧存档里的横屏也按竖屏
    orient: "portrait" as const,
  };
}
const POV_RULE: Record<import("./types").Pov, string> = {
  "1": "第一人称：旁白一律以「我」指代主角，可直接写主角的所思所感；其他人物用名字或他 / 她",
  "2": "第二人称：旁白一律以「你」指代主角，像在对玩家耳语；其他人物用名字或他 / 她",
  "3": "第三人称：旁白以主角姓名或「她 / 他」指代主角，保持旁观的叙述距离",
};
function playPrefsBlock(state: GameState): string {
  const p = playPrefsOf(state);
  const parts = [
    p.pov && `【叙事视角】${POV_RULE[p.pov]}（优先于上文口吻中的人称写法）。`,
    p.mode === "novel" && "【游玩模式 · 剧情模式】正文按小说章节的笔法连续叙述，约 800~1200 字：场景、对白、心理与环境交织推进，少用系统化提示语与数值播报；结尾仍给出 options，但写成剧情走向式的选择。对白行的「角色名」必须写具体姓+名全名（如「苏桂芬」「冯建国」），禁止只用「老冯」「二姨」等昵称/称谓作说话人；称谓可写进 aliases。",
  ].filter(Boolean);
  return parts.length ? `${parts.join("\n")}\n\n` : "";
}

/* 头像池：剧本勾了「随机池」时，让 AI 给首次出场的新人物挑一个最贴合的池名 */
function avatarPoolBlock(): string {
  // 功能注释：本剧没开随机池时，用平台头像库分类名（青年女性 / 成熟男性…）让 AI 按性别年龄挑
  const own = randomPools().map((p) => p.name);
  const names = own.length ? own : systemPools().filter((p) => Array.isArray(p.images) && p.images.length).map((p) => p.name);
  return names.length ? `【新人物头像池】首次出场的新人物在 npc_changes 里加 "avatar_variant"，从下列池名中挑一个最贴合其性别、年龄与气质的（须与池名一字不差）：${names.join("、")}。拿不准就省略，系统会随机抽图。\n\n` : "";
}

/* 主角所选人物线路的出身经历（如科班：母校表演系应届生）。家人当然清楚这些，不受「各人只知私有知识库」限制 */
function pathBackground(state: GameState): string {
  const id = state.sim?.char?.identityId;
  const path = id ? (creationCopy().paths ?? []).find((x) => x.id === id) : undefined;
  const about = path?.about ? fillText(path.about, creationVars({ path: path.name })).trim() : "";
  if (!about) return "";
  return `出身经历：${about}\n（主角的家人、亲属与旧识清楚主角的人物线路、母校、专业与求学经历，提到主角时必须记得并据此反应，不得表现得不知道或问错。）\n`;
}

export function buildSystemPrompt(state: GameState): string {
  const p = state.player;
  const firstNpc = getWorldNpcs()[0];
  const npcEx = promptFrag("npcExample", firstNpc ? { id: firstNpc.id, name: firstNpc.name } : { id: "npc1", name: "某人" });
  // 时限天数与结算同口径：存档没有自选开局日期时，从世界观实际开局日（day 0）起算
  const limDays = limitDays(state.timeLimit, state.startDate || startDateLabel());
  // 功能注释：剧本基调必须来自作品；留空时不注入娱乐圈引擎的默认 GM 话术。
  return `${getWorldPromptHeader()}

${engineRulesBlock(rulesOf(state), (id) => state.npcs.find((n) => n.id === id)?.name)}${limDays > 0 ? `【本局时限】整个故事${state.timeLimit?.endDate ? `截止于 ${state.timeLimit.endDate}` : `只有 ${state.timeLimit!.value}${TIME_UNIT_LABEL[state.timeLimit!.unit]}`}（共 ${limDays} 天），当前第 ${(state.sim?.day ?? 0)} 天，剩余 ${Math.max(0, limDays - (state.sim?.day ?? 0))} 天。叙事节奏须与之匹配，不得写超出时限的情节。\n\n` : ""}【主角设定】
姓名：${p.name}｜年龄：${p.age}｜性别：${p.gender}｜身份：${p.identity}｜家世：${p.background}｜阶层：${p.klass}
${(p.extra ?? []).map((e) => `${e.label}：${e.value}`).join("｜") || ""}
人设：${p.description}
${pathBackground(state)}${customAttrLine(state)}${(p.history ?? []).length ? `经历：${p.history.slice(-6).map((h) => h.title).join("；")}\n` : ""}${state.contract ? `开局签约：${state.contract.company}（${state.contract.companyStyle}·${state.contract.focusLabel}），底薪${state.contract.baseSalary}｜分成${state.contract.revenueShare}｜违约金${state.contract.penalty}｜${state.contract.exclusive}\n` : ""}
${getWorldPromptFragment()}${playPrefsBlock(state)}${avatarPoolBlock()}${buildWorldRules(state)}${buildSimSnapshot(state)}

【核心人物】（"近况记忆"是该角色与主角相处的往事，交谈时须记得、并保持各自身份口吻。每位角色只知道自己的私有知识库与公共世界书，不得知道别人与主角的私事；生活费、转账等金钱数额一律由系统计算，你不得改动或许诺具体金额。[id: …] 只供 JSON 引用该人物（npc_changes.id、links.id），剧情正文与台词里绝不能出现；标「尚未结识」的人物与主角还不熟，可以照常登场，但不要写成老相识，也不要为 TA 另建新角色）
${state.npcs
  .map((n) => {
    const kbm = state.npcKb?.[n.id]?.playerMemory;
    const mem = (kbm?.length ? kbm.slice(-2).map((m) => m.text) : (n.interactions ?? []).slice(-2).map((it) => it.text)).join("；");
    const ps = n.persona;
    // 功能注释：性别必须写入核心人物条——世界设定 / persona / 花名册任一来源；否则模型常把女角色写成「他」
    const gender = personGender(state, n.id) || ps?.gender || "";
    const custom = [gender && `性别${gender}`, ps?.text?.trim() && `玩家设定人设：${ps.text.trim()}`, ps?.voice?.trim() && `说话口吻：${ps.voice.trim()}`].filter(Boolean).join("；");
    const tl = timelinePrompt(n, state.sim?.day ?? 0);
    const love = romanceBlock(state, n.id, true); // 家人返回空：只有亲情，不演恋爱
    const unmet = (state.sim?.metPeople ?? []).includes(n.id) ? "" : "，尚未结识";
    return `- ${n.name} [id: ${n.id}]（${gender ? `${gender}，` : ""}${n.identity}，与主角：${n.relation}${unmet}，好感${affinityOf(state, n.id)}${love ? `，${love}` : ""}，心情${n.mood || "平静"}）${custom ? `\n  · ${custom}（务必遵守）` : ""}${tl ? `\n  · ${tl}` : ""}${mem ? `\n  · 近况记忆：${mem}` : ""}`;
  })
  .join("\n")}

【人物关系网】（人物之间只有下列关系是明确设定的；主角自己的家人与恋人见上方各人物的「与主角」。没列出的伴侣、前任、父母、子女一律视为未设定：不得凭姓氏、称谓、年龄、身份或常识推断谁和谁是亲属或伴侣，也不得替未设定的人编出具体的家人姓名）
${relNetPromptLines(state).map((l) => `- ${l}`).join("\n") || "（暂无明确设定的人物关系）"}

【已知记忆（前情摘要）】
${state.memory || "（游戏刚刚开始）"}

【输出规范 · 严格遵守】
1. 先输出【剧情正文】：旁白用自然段落；人物台词单独成行，格式为「角色名」：台词。多换行，画面细腻。不要输出任何字段名或代码。
2. 正文之后，紧跟一个 \`\`\`json 代码块，包含本回合的结构化数据。你是「唯一真源状态中枢」的解析器：一切剧情结果都必须落进这份 JSON，再由系统统一分发到故事 / 人物 / NPC / 地图·事件 / 设置·存档各页，任何页面都不自行决定事实；数值冲突一律以【当前状态】为准。不得只输出散文，不得遗漏关键状态。字段：
{
  "narrative": "本回合剧情文本（与正文一致的纯文本）",
  "state_diff": {"world": {}, "player_changes": {}, "npc_changes": []},
  "tabs": {"story":"本回合一句话摘要","character":"主角状态变化要点","npc":"相关人物动向","map":"地点/事件变化","settings":"可省略"},
  "memory_updates": [{"scope":"main","text":"本回合真正发生、值得长期记住的事（一句话，写清谁做了什么）","imp":1,"who":["相关人物全名"],"keys":["可选：日后提起时可能出现的关键词"]},{"scope":"npc","npc":"角色名","text":"该角色应记住的事"}],
  "scene_memory": {"facts":["仅当此地陈设/状态有新出现或改变时写，如：前台的铜铃坏了"],"looks":[{"name":"在场人物全名","outfit":"仅当其穿着变化或首次描写时写"}]},
  "save_summary": "30字内的存档摘要：时间·地点·关键进展",
  "need_clarification": ["仅当玩家指令信息不足、无法判定结果时列出要补充的问题，否则给空数组"],
  "narration": "同 narrative（兼容字段）",
  "dialogue": [{"speaker":"角色名","text":"台词"}],
  "system": "系统提示，可省略",
  "options": [{"label":"给玩家看的选项文案","value":"发给你的指令"}],
  "world": {"time":"游戏内时间","location":"当前地点","weather":"天气"},
  "player_changes": {"attrs":[{"key":"fame","label":"${term("fame", "名气")}","delta":5}],"identity":"如有变化","history_add":{"title":"","detail":""}},
  "npc_changes": [{"id":"${npcEx.id}","name":"${npcEx.name}","gender":"女","aliases":["称谓，可省略"],"age":"新人物必填，如 46岁","identity":"新人物必填","relation":"与主角关系","bio":"新人物必填：一两句背景","affinity_delta":8,"dims":[{"label":"爱慕","delta":2}],"reason":"原因","interaction":"本回合互动一句话","self_event":"（可选）该角色自己身上发生的事","mood":"此刻心境，一句完整的话（10~25字，如：刚被导演夸了，嘴角压不住）","links":[{"id":"仅新人物可填：已有人物的 id","kind":"parent","note":"可选：具体称呼，如 养母"}]}],
  "thoughts": [{"name":"在场角色名","text":"TA 此刻没说出口的心事，一两句","diary":"可选：当 TA 心绪起伏较大时，以 TA 第一人称写的日记，80~200字"}],
  "intimate": ["仅当本回合主角与某 NPC 发生亲密关系时填该 NPC 名字，否则省略"],
  "game_end": false,
  "epilogue": "仅当你判定结局到来时给出，≥1000字的主角生平后记"
}
2.0 记忆：memory_updates 里 scope=main 只记本回合真正发生的新事实（不写猜测、不复述旧事），imp 为重要度：1 日常、2 重要（关系转折、承诺、秘密）、3 关键（改变剧情走向、日后必须记得的事，极少使用）；who 填相关人物全名。scene_memory 只在此地陈设、状态或在场者穿着发生变化时填写，没有变化整个省略。
2.1 state_diff 与下方的 world / player_changes / npc_changes 等价，二选一填写即可，不要两边重复写同一变动。不要输出 world.note，不要写「局势」摘要。
2.2 禁止剧情重复：不得复述上一回合已经写过的段落、台词或情节，每回合都必须推进新的事件或新的情绪。
2.4 台词与旁白去 AI 味：人物说话必须符合其身份、年龄、性格与当下处境，像真实活人在日常开口——口语化、自然平实、有烟火气；严禁书面腔、严禁排比与金句堆砌、严禁拿人物职业硬拗生硬比喻（如用修桥、算账、做菜去硬套人生哲理），严禁「把这话说得很轻，轻得像……」「那口气只有……才懂」「眼底闪过一丝不易察觉的……」「先说清楚/我只说一次」等矫揉造作的 AI 惯用语；段落结尾严禁旁白对玩家总结、喊话或抒情收尾（如「接下来怎么走，全看你自己」「故事才刚刚开始」「这一天注定不平凡」），停在具体的动作、台词或画面上即可。
2.5 角色不知道游戏数值：任何人物的台词与心事里，一律不得出现属性名、数值、分数、等级、「八维」「好感度」「名气值」等游戏术语（如「演技180」）；要评价主角，只能用该角色在剧情里亲眼所见、亲耳所闻的具体表现来说（如「你上回试镜那段哭戏还行」），数值只放进 JSON。
2.6 动作与台词分开写：动作神态写在旁白里，台词放进引号「」；台词行内如需小动作，用全角括号（）包住。
2.7 换场景：主角本回合移动到另一个地点时，world.location 必须写成目的地的正式地名（优先用地图上已有的地名：${(() => { try { return [...new Set(Object.keys(state.mapEdits ?? {}).filter((k) => k !== "_config").map((k) => (state.mapEdits as Record<string, { name?: string }>)[k]?.name).filter(Boolean))].slice(0, 30).join("、") || "按世界观地图"; } catch { return "按世界观地图"; } })()}）；地点没变就保持原值。
2.8 好感与爱慕是两条独立的关系轴：好感（affinity_delta）决定熟络与暖意；爱慕（【核心人物】里的「爱慕 当前/上限（档位）」）是角色私下的心动，只能通过 dims 里 label 为「爱慕」的 delta 改变（单回合 -5~5，只写增减、不写绝对值）。只有剧情里真有心动契机（被打动、暧昧升温、被保护、亲密接触）或失望受伤时才写爱慕变化，日常寒暄、公事往来一律不写；主角的家人只有亲情，绝不写爱慕；标注「不可攻略」的人物同样绝不写爱慕、不写 intimate，只发展好感、信任与友情。人物言行须与当前爱慕档位一致：爱慕为 0 或不可攻略的人不暧昧、不吃醋、不说情话；低档位只含蓄流露，高档位才明显动心；未确认恋爱关系前不以恋人自居；心意只有本人知道，旁人不得替其说破。
2.3 正文中不得出现「# 谨遵指令」「---」分隔线、markdown 标题或任何字段名。
3. thoughts：给本回合每位在场的重要 NPC 各写一句心事（不含主角），要与台词形成反差或补充，让玩家有「偷看到」的感觉；diary 只在情绪有明显波动时写，不要每回合都写。
4. options 固定给 3 个（不要多于 3 个），文案就是玩家点击后要发生的事，具体可玩。没有数值变化的字段就省略，不要编造无意义的变动。
5. 人物命名铁律：凡在剧情中出场或说话的人物（含来电、亲戚、路人里有台词者），都必须有具体姓名。台词行的「角色名」一律写全名（如「苏桂芬」），不得只写「二姨」「男人」「陌生人」等称谓；称谓写进 aliases。首次出场的新人物必须写进 npc_changes（含 name/gender/age/identity/relation/bio；gender 只能是「男」「女」或「其他」），已出场的人物沿用原名、id 与性别，只更新变化的字段，绝不另建同名或同一人的新角色。
5.1 人物关系：新人物与【核心人物】里已有人物的关系，只有剧情明确交代时才写进该新人物的 links（按 [id: …] 引用，没有 id 时写对方全名到 name），kind 指对方是新人物的什么人：parent=父亲或母亲，child=子女，partner=现任伴侣或配偶，ex=前任，other=其他明确关系（note 写清是什么关系，如 同门师兄）；拿不准就不写。links 只用于新人物，不得借此改写已有人物之间的关系；【人物关系网】以外的关系一律按未设定处理。
5.2 性别与人称：旁白与台词指代人物时，代词必须与其性别一致——女用「她」，男用「他」，其他用「TA」；不得把女角色写成「他」或男性外貌动作，也不得把男角色写成「她」。【核心人物】里已标明的性别不可改写。
6. 只有当故事自然抵达结局（${promptFrag("endingHint", "达成目标/离开/婚恋定局/意外")}等）才把 game_end 设为 true 并给出 epilogue。
${pregnancyBlock(state)}

【线下【对话】与微信规则】
【对话】是线下当面交谈入口，无论是否认识对方，玩家都可以发起对话。NPC 可根据性格、心情、对玩家的印象自由选择好好回应、敷衍或直接无视。
只有微信好友（${(state.phone?.contacts ?? []).map((id) => state.npcs.find((n) => n.id === id)?.name ?? id).join("、") || "暂无"}）可以发微信、打电话；其余人物没有微信，只能当面交谈，分开后就无法沟通，剧情里不得出现与他们的微信往来（被主角删掉的好友除外：TA 可以打电话、发邮件或重新申请好友）。${phoneLinkPrompt(state)}`;
}

/* 怀孕状态提示：数值本身隐藏，只把事实交给 GM 演绎 */
function pregnancyBlock(state: GameState): string {
  const pg = state.sim?.pregnancy;
  const kids = state.sim?.children ?? [];
  const lines: string[] = [];
  if (pg) {
    const d = (state.sim?.day ?? 0) - pg.startDay;
    lines.push(`主角已怀上${pg.fatherName}的孩子约 ${d} 天${pg.known ? "（主角已知情）" : "（主角尚未察觉，可写些细微的身体异样）"}，叙事须体现孕期对工作、身体与人际的影响。`);
  }
  if (kids.length) lines.push(`主角的孩子：${kids.map((k) => `${k.name}（与${k.fatherName ?? "对方"}所生）`).join("、")}。`);
  return lines.length ? `【孕育】${lines.join("")}` : "";
}

/* 世界书检索（借鉴酒馆 SillyTavern 世界书机制）：
 * · 蓝灯（constant / 关键词为空）——每回合常驻注入；
 * · 绿灯（关键词触发）——扫描最近若干回合对话 + 本回合输入 + 当前场景，命中关键词才注入；
 * · 命中条目按 order 升序排列（越小越靠前、越受模型重视），并受字数预算上限约束。
 * 拼装为一段可注入系统提示的参考资料；无命中则返回空串。 */
const WB_SCAN_TURNS = 4; // 扫描最近的对话回合数（绿灯关键词的检索窗口）
const WB_CHAR_BUDGET = 1600; // 注入正文的字数上限，防止挤占剧情上下文

/* 本回合的检索文本：输入 + 当前场景 + 最近数回合对话原文 */
function wbHay(state: GameState, query: string): string {
  const recentText = state.story
    .slice(-WB_SCAN_TURNS)
    .map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}${s.text}` : s.text)).join(" "))
    .join(" ");
  return `${query} ${state.world?.note ?? ""} ${state.world?.location ?? ""} ${recentText}`;
}
/* 选出本回合要注入的世界书条目（模式 / 有效期 / 绑定范围 / 互斥组 / 权重，规则见 game/worldbookPick） */
export function worldBookPickFor(state: GameState, query: string, ctx: WorldBookCtx = {}): WorldBookPick {
  // 阵营派系作为虚拟条目参与检索（不写进玩家的世界书）
  const book = [...(state.worldBook ?? defaultWorldBook()), ...factionLoreEntries(state)];
  const npcIds = ctx.npcIds ?? sceneNpcIds(state, query);
  const pick = pickWorldBook(state, book, wbHay(state, query), { npcIds }, seqRandom(`wb:${state.turnCount}`, state.sim?.room)); // 同一回合多次检索结果一致，可复现
  // 底层规则：检索条数上限 + 排序策略（keyword = 命中顺序 / order；priority = 按权重高者优先）
  const M = rulesOf(state).memory;
  const ranked = M.loreSort === "priority" ? [...pick.entries].sort((a, b) => (b.weight ?? 100) - (a.weight ?? 100) || (a.order ?? 100) - (b.order ?? 100)) : pick.entries;
  const entries = M.loreMax > 0 ? ranked.slice(0, M.loreMax) : ranked;
  const keep = new Set(entries.map((e) => e.id));
  return { ...pick, entries, fired: pick.fired.filter((id) => keep.has(id)) };
}
export function worldBookBlock(state: GameState, query: string, ctx: WorldBookCtx = {}, pick?: WorldBookPick): string {
  const hits = (pick ?? worldBookPickFor(state, query, ctx)).entries;
  if (!hits.length) return "";
  // 字数预算：按序累加，超出上限即停止（核心/靠前条目优先保留）
  const parts: string[] = [];
  let used = 0;
  for (const e of hits) {
    const block = `◆ ${e.title || "设定"}\n${fillPlaceholders(e.content.trim(), phCtx(state))}`;
    if (used + block.length > WB_CHAR_BUDGET && parts.length) break;
    parts.push(block);
    used += block.length;
  }
  return `【世界书 · 设定参考】（玩家为本局撰写的世界设定，须据此演绎，勿与之冲突）\n${parts.join("\n\n")}`;
}

/* 当前点位的场景、物件、行动与行囊（含世界预设 + 玩家地图编辑器自定义），注入让 AI 叙事与之一致。 */
export function mapSpotBlock(state: GameState): string {
  const room = state.sim?.room;
  const bagIds = state.sim?.bag ?? [];
  const lines: string[] = [];

  if (room) {
    const locName = spotName(state, room) ?? worldLocOf(room)?.name;
    const locDesc = spotDesc(state, room) ?? worldRoom(room)?.desc;
    if (locName) lines.push(`当前地点：${locName}`);
    if (locDesc) lines.push(`场景环境：${locDesc}`);
    // 功能注释：势力范围——此地归谁管，人物的言行与立场要符合
    const owners = factionsAtRoom(room);
    if (owners.length) lines.push(`势力范围：此地是${owners.map((f) => `「${f.name}」`).join("、")}的地盘`);

    const presetItems = worldItemsOfRoom(room).map((it) => ({
      id: it.id,
      name: it.name,
      desc: it.desc,
      prompt: undefined as string | undefined,
      price: it.price,
    }));
    const usrItems = customItemsOf(state, room).map((it) => ({
      id: it.id,
      name: it.name,
      desc: it.desc,
      prompt: it.prompt,
      price: undefined as number | undefined,
    }));
    const allSpotItems = [...presetItems, ...usrItems];
    if (allSpotItems.length) {
      lines.push(
        `此处场景物件：${allSpotItems
          .map((it) => {
            const status = bagIds.includes(it.id) ? "已收入行囊" : it.price ? `在售 ${wallet.fmt(it.price)}` : "在场可互动/拾取";
            const hint = it.prompt?.trim() ? ` · 设定提示：${it.prompt.trim()}` : "";
            return `${it.name}（${status}｜${it.desc.trim() || "无描述"}${hint}）`;
          })
          .join("；")}`,
      );
    }

    const presetActs = worldActivitiesOfRoom(room).map((a) => ({
      name: a.name,
      desc: a.desc,
      prompt: undefined as string | undefined,
    }));
    const usrActs = customActsOf(state, room).map((a) => ({
      name: a.label,
      desc: a.hint || "",
      prompt: a.prompt,
    }));
    const allActs = [...presetActs, ...usrActs];
    if (allActs.length) {
      lines.push(
        `此处可执行行动：${allActs
          .map((a) => {
            const detail = [a.desc?.trim(), a.prompt?.trim() ? `设定提示：${a.prompt.trim()}` : ""].filter(Boolean).join(" · ");
            return detail ? `${a.name}（${detail}）` : a.name;
          })
          .join("；")}`,
      );
    }

    const evts = spotEventsOf(state, room, firedOf(state, "spot"));
    if (evts.length) {
      lines.push(
        `此处潜在剧情线索：${evts.map((ev) => `${ev.title}${ev.annotation ? `（${ev.annotation}）` : ""}`).join("；")}`,
      );
    }
  }

  if (bagIds.length) {
    const carried = bagIds
      .map((id) => {
        const custom = findCustomItem(state, id);
        if (custom) {
          const hint = custom.prompt?.trim() ? ` · 设定：${custom.prompt.trim()}` : "";
          return `${custom.name}（${custom.desc.trim() || "随身物件"}${hint}）`;
        }
        const preset = worldItemById(id);
        if (preset) {
          const useInfo = preset.use?.msg ? ` · 用途：${preset.use.msg}` : "";
          return `${preset.name}（${preset.desc}${useInfo}）`;
        }
        return null;
      })
      .filter(Boolean);
    if (carried.length) {
      lines.push(`主角随身行囊：${carried.join("；")}`);
    }
  }

  if (!lines.length) return "";
  return `【当前场景物件 · 行动 · 随身行囊】（须将以下地点物件、行动与行囊物品融入叙事；玩家互动、拾取、使用物件或执行地点行动时，据此生动演绎并在 options 中提供贴合场景物件/行动的后续选项）\n${lines.join("\n")}`;
}

/* 此刻真实在场的人物：按代码实时记录的人物所在地（与底部在场人物条同一口径）判定，AI 不能改 */
export function presentNpcIds(state: GameState): string[] {
  const room = state.sim?.room;
  if (!room || !state.sim) return [];
  return mobsHere(state.sim, room, state.npcs).filter((p) => p.present).map((p) => p.id);
}

/* 在场约束：只传「此刻与主角同处此地」的人物（代码实时位置），AI 只能让这些人当面出场 */
function presenceBlock(state: GameState): string {
  const room = state.sim?.room;
  const roomName = room ? spotName(state, room) ?? worldLocOf(room)?.name ?? room : "未知";
  const hereIds = new Set(presentNpcIds(state));
  const here = state.npcs.filter((n) => n.name && hereIds.has(n.id)).map((n) => n.name);
  return `【此地在场人物】（由代码实时记录，必须严格遵守）
主角所在：${roomName}
在场：${here.length ? here.join("、") : "除主角外无人"}
规则：只有以上在场的人能当面出现、说话、做动作、写进 thoughts；不得让名单外的人物当面出场（路人只可一笔带过，不给台词）。`;
}

/* 本回合可能开口的角色：只取代码判定在场的人；玩家点名的在场者优先，最多 4 位（点名不在场的人不会让 TA 开口） */
function sceneNpcIds(state: GameState, input: string): string[] {
  const here = presentNpcIds(state);
  const named = state.npcs.filter((n) => n.name && input.includes(n.name) && here.includes(n.id)).map((n) => n.id);
  // 群聊裁决：同一回合最多几位角色开口（底层规则，缺省 4）
  return Array.from(new Set([...named, ...here])).filter((id) => state.npcs.some((n) => n.id === id)).slice(0, Math.max(1, rulesOf(state).ai.maxSpeakers));
}

/* Prompt 占位符上下文：{{user}} {{time}} {{location}} {{day}}（{{char}} 由调用方补） */
const phCtx = (state: GameState) => ({ user: state.player?.name, time: state.world?.time, location: state.world?.location, day: state.sim?.day });

export function buildMessages(state: GameState, userInput: string, wbPick?: WorldBookPick): ChatMsg[] {
  const input = typeof userInput === "string" ? userInput : String(userInput ?? "");
  const msgs: ChatMsg[] = [{ role: "system", content: buildSystemPrompt(state) }];
  // 知识库：按玩家输入检索 help 文档，命中则注入，避免模型编造游戏机制/世界设定
  const kb = knowledgeBlock(input);
  if (kb) msgs.push({ role: "system", content: kb });
  // 世界书：唯一设定通道（含原详细设定 / 节日）；地点·人物在场或关键词命中才注入
  const wb = worldBookBlock(state, input, {}, wbPick);
  if (wb) msgs.push({ role: "system", content: wb });
  // 功能注释：「当前状态」类块（进行中事件 / 主线支线进度 / 下回合提示 / 当前点位 / 在场人物）
  // 放在最近剧情原文之后、玩家输入之前：模型最后读到的是此刻真实状态，不会被更早的剧情带偏
  const stateBlocks: string[] = [];
  const quest = state.sim ? storylineBrief(state.sim) : "";
  const side = state.sim ? sidelineBrief(getWorldSidelines(), state.sim) : "";
  for (const block of [activeEventsBlock(state), quest && `【主线进度】（由代码判定，剧情须围绕当前目标推进，不得自行宣布完成）\n${quest}`, side && `【进行中的支线】（额外任务，由代码判定成败，可顺带推进，不得自行宣布完成，也不影响主线）\n${side}`]) if (block) stateBlocks.push(block);
  // 上回合之后由代码判定发生的事 + 当前可展开的特殊事件（不自动开写，只在玩家下次行动时交给 AI）
  {
    const cue = nextTurnCueBlock(state.pendingCues, state.eventNotices, state.sim?.day ?? 0, (room) => (room ? spotName(state, room) ?? worldLocOf(room)?.name ?? room : ""));
    if (cue) stateBlocks.push(cue);
  }
  // 地图编辑器：当前点位的玩家自定义（改名/描述/物件），让叙事与所见场景一致
  const ms = mapSpotBlock(state);
  if (ms) stateBlocks.push(ms);
  // 剧情记忆：最近事件（相对时间）+ 按在场 / 地点 / 关键词召回的往事 + 此地现状（变化驱动）
  {
    const roomName = (id?: string) => (id ? spotName(state, id) ?? worldLocOf(id)?.name ?? id : "");
    const mb = memoryBlock(state, wbHay(state, input), presentNpcIds(state), roomName);
    if (mb) stateBlocks.push(mb);
  }
  // 在场名单由代码决定并下发给 AI，剧情只能按真实在场的人写
  stateBlocks.push(presenceBlock(state));
  // 私有知识库：只注入在场 / 被点名的角色，每人一块、互不可见
  const cardHay = `${input} ${state.story.filter((t) => !t.error).slice(-2).map((t) => t.segments.map((s) => s.text).join("")).join(" ")}`;
  for (const id of sceneNpcIds(state, input)) {
    const cn = state.npcs.find((n) => n.id === id);
    const card = cn ? fillPlaceholders(charCardBlock(cn.name, cn.persona, cardHay), { ...phCtx(state), char: cn.name }) : "";
    msgs.push({ role: "system", content: `${kbBlock(state, id)}${card ? `\n${card}` : ""}\n【隔离规则】以上内容只能在扮演「${state.npcs.find((n) => n.id === id)?.name ?? id}」时使用；其他角色不知道这些，不得借他人之口说出。同一话题，不同角色须按各自知识库给出不同的回应。` });
  }
  // 只带最近若干回合原文，早期靠 memory。
  // 功能注释：runTurn 会先把本回合玩家气泡写进 story 再拼提示词——末尾那条就是本回合输入，这里剔除，避免玩家输入在提示里出现两次
  const hist = state.story.filter((t) => !t.error);
  const lastT = hist[hist.length - 1];
  if (lastT?.role === "player" && lastT.segments.map((x) => x.text).join("").trim() === input.trim()) hist.pop();
  const recent = hist.slice(-4);
  for (const t of recent) {
    const text = t.segments.map((s) => (s.kind === "dialogue" ? `「${s.speaker}」：${s.text}` : s.text)).join("\n");
    msgs.push({ role: t.role === "player" ? "user" : "assistant", content: text });
  }
  for (const b of stateBlocks) msgs.push({ role: "system", content: b });
  // OOC：按底层规则的标记符识别，作为场外话交给模型，不推进剧情
  const ooc = oocText(input, rulesOf(state).narrative.oocMarks);
  // RP 文本标记：*动作* /「台词」标注后交给模型，区分玩家动作与玩家台词
  msgs.push({ role: "user", content: ooc != null ? `【OOC · 场外话，不推进剧情、角色听不见】${ooc}` : parseRp(input, rulesOf(state)) });
  return msgs;
}

/* —— 记忆压缩（每 5 回合，异步，仅主线） —— */
export async function compressMemory(cfg: AIConfig, state: GameState): Promise<string> {
  const transcript = state.story
    .map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}:${s.text}` : s.text)).join(" "))
    .join("\n");
  const prompt = `请把下面这段养成剧情压缩成不超过 400 字的主线记忆摘要，只保留：关键剧情推进、人物关系变化、主角重要抉择与结果。不要写无关细节。已有旧摘要可并入。

旧摘要：${state.memory || "无"}

近期剧情：
${transcript.slice(-4000)}`;
  if (isConfigured(cfg)) {
    try {
      const out = await complete(cfg, [{ role: "user", content: prompt }]);
      if (out.trim()) return out.trim();
    } catch {
      /* 失败则退回本地压缩 */
    }
  }
  // 本地兜底：优先按剧情事件线保留（重要事件优先），没有事件线时才截取最近原文
  const fromEvents = chronicleFallbackSummary(state);
  if (fromEvents) return `${state.memory ? `${state.memory.slice(-400)}\n` : ""}${fromEvents}`.slice(-1200);
  const merged = (state.memory + " " + transcript).replace(/\s+/g, " ").trim();
  return merged.slice(-600);
}

/* ————— 应用 AIStep 到状态，返回新状态 + 变更提示 ————— */
/* 返回当前满足条件、但尚未解锁的 CG id */
export function newlyUnlockedCgs(state: GameState): string[] {
  if (!state.sim) return [];
  return (state.cgs ?? []).filter((c) => c.enabled !== false && !!(c.imageFileId || c.image) && c.conds.length > 0 && !state.cgUnlocked?.[c.id] && c.conds.every((k) => evalFixedCond(k, state.sim))).map((c) => c.id);
}

export function applyStep(state: GameState, step: AIStep): { next: GameState; changes: string[] } {
  const next: GameState = structuredClone(state);
  const changes: string[] = [];
  const turn = next.turnCount + 1;
  const time = step.world?.time || next.world.time;
  const kbWrites: { id: string; player?: string; self?: string }[] = [];
  const newLinks: { id: string; links: unknown[] }[] = []; // 本回合新建档人物 AI 交代的关系，等全部新人物入册后再解析
  const loveTurn: Record<string, number> = {}; // 本回合每人已落账的爱慕变化（同一人多条 npc_changes 也共用 ±LOVE_TURN_CAP）

  // 日历归确定性引擎：world.time 由引擎写成「第 N 周 · 日期 星期」，AI 回写的时间只作上面 time 的记忆时间戳。
  // 模型常照抄提示里的手机时间（如「2005.01.04 上午 08:12」），若覆盖进来，顶栏会把年份读成「第 2005 周」。
  // 功能注释：不再解析 / 落账 world.note（局势摘要），顶栏也不再展示
  if (step.world) {
    const { note: _dropNote, ...worldRest } = step.world;
    next.world = { ...next.world, ...worldRest, time: next.world.time || step.world.time || "", note: "" };
  }

  // 玩家变更
  const pc = step.player_changes;
  if (pc) {
    if (pc.identity) next.player.identity = pc.identity;
    const bound = walletDef(next);
    for (const a of pc.attrs ?? []) {
      if (a.key === "money") continue; // 资金只记一本账：sim.money / 绑定货币（见下方），不另建「money」属性
      let attr = next.player.attrs.find((x) => x.key === a.key || x.label === a.label);
      if (!attr) {
        attr = { key: a.key || a.label || uid(), label: a.label || a.key || "属性", value: 0, max: a.max ?? 999, icon: a.icon };
        next.player.attrs.push(attr);
      }
      const before = attr.value;
      if (typeof a.value === "number") attr.value = a.value;
      else if (typeof a.delta === "number") attr.value += a.delta;
      if (a.max) attr.max = a.max;
      const def = next.attrDefs?.find((x) => x.id === attr!.key);
      attr.value = Math.max(def?.min ?? 0, Math.min(def ? attrCap(def.max) : attr.max, Math.round(attr.value)));
      const d = attr.value - before;
      if (d) changes.push(`${attr.label} ${d > 0 ? "+" : ""}${d}`);
      // 同步回确定性引擎，保持数值一致
      const s = next.sim;
      if (s?.cattrs && attr.key in s.cattrs) s.cattrs = { ...s.cattrs, [attr.key]: attr.value };
      if (s && d) {
        if (attr.key === "fame") s.fame = Math.max(0, Math.min(1000, s.fame + d));
        else if (attr.key === "reputation") s.reputation = Math.max(0, Math.min(100, s.reputation + d));
        else if (attr.key === "stress") {
          s.stress = Math.max(0, Math.min(100, s.stress + d));
          // 底层规则：压力累积到阈值写下崩溃标记（事件条件可读）
          const R = rulesOf(state).attrs;
          if (R.numeric && R.stressFlag && s.stress >= R.stressLimit) s.flags = { ...(s.flags ?? {}), [R.stressFlag]: 1 };
        }
        else if (attr.key in s.stats) s.stats[attr.key as keyof typeof s.stats] = clampStat(attr.key as keyof typeof s.stats, s.stats[attr.key as keyof typeof s.stats] + d);
      }
    }
    // 资金变更（AI 可用特殊属性 key: money，单位元）
    // 拒绝超额金钱：单回合叙事金额封顶 ±20 万，避免 AI 凭空发钱破坏账本平衡
    const moneyAttr = (pc.attrs ?? []).find((a) => a.key === "money");
    if (moneyAttr && next.sim && typeof moneyAttr.delta === "number" && Number.isFinite(moneyAttr.delta)) {
      const md = orderIncome(Math.max(-200000, Math.min(200000, Math.round(moneyAttr.delta)))); // 世界规则·社会秩序：正向进账按地位修正
      if (bound) {
        // AI 仍写了 money：按 1:1 记到绑定的货币属性上，避免两本账
        const before = wallet.balance(next);
        const w = wallet.add(next, md);
        next.sim = w.sim;
        next.player = w.player;
        const d = wallet.balance(next) - before;
        if (d) changes.push(`${bound.label} ${d > 0 ? "+" : ""}${d}`);
      } else if (md) {
        wallet.addIn(next.sim, md);
        changes.push(`资金 ${md > 0 ? "+" : "-"}${wallet.fmt(Math.abs(md))}`);
      }
    }
    for (const e of pc.extra ?? []) {
      const ex = next.player.extra.find((x) => x.label === e.label);
      if (ex) ex.value = e.value;
      else next.player.extra.push(e);
    }
    if (pc.history_add) {
      next.player.history.push({ turn, time, title: pc.history_add.title, detail: pc.history_add.detail });
    }
  }

  // AI 生成的标签可能夹带空串/空白/null 或重复项——去空去重再落账，
  // 否则前端以标签值作 key 渲染时会触发 React「唯一 key」告警。
  const cleanTags = (raw: unknown): string[] =>
    Array.isArray(raw) ? Array.from(new Set(raw.map((t) => (typeof t === "string" ? t.trim() : "")).filter(Boolean))) : [];

  // NPC 变更
  for (const nc of step.npc_changes ?? []) {
    if (!nc || typeof nc !== "object") continue;
    const ncName = typeof nc.name === "string" ? nc.name.trim() : "";
    let npc: Npc | undefined = findNpc(next.npcs, nc.id, ncName);
    if (!npc) {
      // 新人物必须有具体名字：陌生人/某人/男子/他/她 之类占位称呼不建档
      if (isPlaceholderName(ncName)) continue;
      npc = {
        id: nc.id || uid(),
        name: ncName,
        age: nc.age || "",
        identity: nc.identity || "神秘人物",
        relation: nc.relation || "初识",
        avatar: "",
        bio: nc.bio || "",
        mood: nc.mood || "",
        affinity: 0,
        dims: [
          { label: "信任", value: 0 },
          { label: "友善", value: 0 },
          { label: "敌意", value: 0 },
        ],
        tags: cleanTags(nc.tags),
        attrs: [],
        affinityHistory: [],
        interactions: [],
      };
      // 头像：AI 指定的同名池优先，否则从本剧随机池抽（都没开 → 留空，沿用首字头像）
      // 功能注释：本剧池抽不到时套用平台头像库（按性别 / 年龄段分类）；性别一并写入 persona，后续剧情提示才能锁定人称
      const gIn = typeof nc.gender === "string" ? nc.gender.trim() : "";
      const gNorm = gIn === "男" || gIn === "女" || gIn === "其他" ? gIn : (/女|姐|妹|娘|她/.test(`${ncName}${nc.identity ?? ""}${nc.bio ?? ""}`) ? "女" : /男|哥|弟|他/.test(`${ncName}${nc.identity ?? ""}${nc.bio ?? ""}`) ? "男" : undefined);
      if (gNorm) npc.persona = { ...(npc.persona ?? {}), gender: gNorm };
      const av = drawProfileAvatar(npc.id, { name: ncName, age: nc.age, identity: nc.identity, bio: nc.bio, gender: gNorm, variant: typeof nc.avatar_variant === "string" ? nc.avatar_variant : undefined });
      if (av.url) { npc.avatar = av.url; npc.avatarVariant = av.variant; }
      npc = ensureBirthday(npc, next.sim?.day ?? 0);
      next.npcs.push(npc);
      // 只是剧情里初次登场：是否结识由玩家在回合底部的人物名片上决定（见 game/npcIntro）
      changes.push(`初遇 ${npc.name}`);
      if (Array.isArray(nc.links) && nc.links.length) newLinks.push({ id: npc.id, links: nc.links });
    } else if (ncName && !isPlaceholderName(ncName) && normName(ncName) !== normName(npc.name) && !(npc.aliases ?? []).some((a) => normName(a) === normName(ncName))) {
      npc.aliases = [...(npc.aliases ?? []), ncName]; // 按 id 命中但换了称呼：记为别名，后续同名不再另建
    }
    for (const a of nc.aliases ?? []) {
      if (a && normName(a) !== normName(npc.name) && !(npc.aliases ?? []).some((x) => normName(x) === normName(a))) npc.aliases = [...(npc.aliases ?? []), a];
    }
    // 功能注释：已有人物缺性别时，用本回合 AI 给出的 gender 补上（不覆盖玩家已设定）
    if (!npc.persona?.gender) {
      const gIn = typeof nc.gender === "string" ? nc.gender.trim() : "";
      if (gIn === "男" || gIn === "女" || gIn === "其他") npc.persona = { ...(npc.persona ?? {}), gender: gIn };
    }
    if (nc.age && !npc.age) npc.age = nc.age;
    if (nc.identity) npc.identity = nc.identity;
    if (nc.relation) npc.relation = nc.relation;
    if (nc.bio) npc.bio = nc.bio;
    if (nc.mood) npc.mood = nc.mood;
    if (nc.tags?.length) npc.tags = cleanTags([...npc.tags, ...nc.tags]);
    // 好感统一走确定性引擎 s.rel：AI 的 affinity_delta 只作「建议」，按单回合上限钳制后
    // 落账到 s.rel（0~cap），再镜像回展示轴 npc.affinity。杜绝 AI 绕开冷却/衰减/上限凭空拉满。
    if (typeof nc.affinity_delta === "number" && nc.affinity_delta !== 0 && next.sim && rulesOf(state).attrs.numeric) {
      const cap = affinityCapOf(npc.id) > 100 ? affinityCapOf(npc.id) : rulesOf(state).affinity.max;
      const capped = Math.max(-AFFINITY_TURN_CAP, Math.min(AFFINITY_TURN_CAP, Math.round(nc.affinity_delta)));
      const before = next.sim.rel[npc.id] ?? npc.affinity; // 无引擎条目的人物从展示值起算，不把原有好感冲成 0
      const cl = clampAffinity(before + capped, npc.id, next.sim.flags, cap);
      if (cl.flags) next.sim.flags = cl.flags; // 好感溢出：写下隐藏标记「溢出:<id>」
      const after = cl.v;
      const eff = after - before;
      if (eff !== 0) {
        next.sim.rel[npc.id] = after;
        npc.affinityHistory.push({ turn, delta: eff, reason: nc.reason || "" });
        changes.push(`${npc.name} 好感 ${eff > 0 ? "+" : ""}${eff}`);
      }
    }
    // 展示轴镜像自引擎好感（0~100）；无引擎条目（AI 临时创建的人物）则维持原值
    {
      const relv = next.sim?.rel[npc.id];
      if (relv !== undefined) npc.affinity = Math.max(0, Math.min(100, relv));
    }
    // 爱慕不是自由维度：一律落到关系轴 sim.relations[pid].romantic（与聊天、当面交谈、情感线同一份真相）。
    // AI 只能给增减建议，同一人本回合累计封顶 ±LOVE_TURN_CAP；绝对值写法忽略，家人不计。
    let love = 0;
    for (const d of nc.dims ?? []) {
      if (isLoveLabel(d?.label)) {
        if (typeof d.delta === "number" && Number.isFinite(d.delta)) love += d.delta;
        continue;
      }
      let dim = npc.dims.find((x) => x.label === d.label);
      if (!dim) {
        dim = { label: d.label, value: 0 };
        npc.dims.push(dim);
      }
      if (typeof d.value === "number") dim.value = d.value;
      else if (typeof d.delta === "number") dim.value = Math.max(-100, Math.min(100, dim.value + d.delta));
    }
    if (love && next.sim && canRomance(next.sim, npc.id)) {
      const used = loveTurn[npc.id] ?? 0;
      const lv = Math.max(-LOVE_TURN_CAP, Math.min(LOVE_TURN_CAP, used + Math.round(love))) - used;
      const rels = ensureRelations(next.sim.relations);
      const r = rels[npc.id] ?? blankRel();
      const romantic = Math.max(0, Math.min(romanticCapOf(npc.id), r.romantic + lv));
      const eff = romantic - r.romantic;
      if (eff !== 0) {
        next.sim.relations = { ...rels, [npc.id]: { ...r, romantic } };
        loveTurn[npc.id] = used + eff;
        changes.push(`${npc.name} 爱慕 ${eff > 0 ? "+" : ""}${eff}`);
      }
    }
    // 功能注释：interactions 供人物页「互动记录」等读取；与 playerMemory 同步写，同句不重复 push
    if (nc.interaction) {
      const it = nc.interaction.trim();
      const lastIt = npc.interactions[npc.interactions.length - 1];
      if (it && lastIt?.text?.trim() !== it) npc.interactions.push({ turn, time, text: it });
    }
    kbWrites.push({ id: npc.id, player: nc.interaction, self: nc.self_event });
  }
  // 新人物的人际关系：只收剧情明确交代、两头都真实存在的（按 id，或与花名册全名 / 别名完全一致），不改动已有人物之间的关系
  for (const { id, links } of newLinks) {
    const resolved = links.map((l) => {
      if (!l || typeof l !== "object") return l;
      const ref = l as { id?: unknown; name?: unknown };
      const key = typeof ref.id === "string" ? ref.id.trim() : "";
      const nm = typeof ref.name === "string" ? ref.name.trim() : "";
      const hit = key || nm ? findNpc(next.npcs, key || undefined, nm || key) : undefined;
      return { ...l, id: hit?.id };
    });
    const net = linkNewcomer(next, id, resolved);
    if (net) next.relNet = net;
  }
  // 交互写入该 NPC 的 playerMemory、自身事件写入 selfMemory（超量自动折叠摘要）
  for (const w of kbWrites) {
    if (w.player) Object.assign(next, remember(next, w.id, "player", w.player, time));
    if (w.self) Object.assign(next, remember(next, w.id, "self", w.self, time));
  }

  // 结构化记忆：main → 主线前情摘要；npc → 该角色私有 playerMemory
  for (const m of Array.isArray(step.memory_updates) ? step.memory_updates : []) {
    const mu = typeof m === "string" ? { scope: "main" as const, text: m } : m;
    const text = mu?.text?.trim();
    if (!text) continue;
    const who = mu.scope === "npc" && mu.npc ? findNpc(next.npcs, mu.npc, mu.npc) : undefined;
    if (who) { if (rulesOf(next).npc.writeMemory) Object.assign(next, remember(next, who.id, "player", text, time)); } // 底层规则可关闭 NPC 私有记忆写入
  }
  // 功能注释：主线记忆 → 剧情事件线（游戏日 / 地点 / 人物 / 重要度，关键事件同步进本存档世界书）；场景变化 → 场景记忆 / 在场者穿着
  {
    const mains = (Array.isArray(step.memory_updates) ? step.memory_updates : [])
      .map((m) => (typeof m === "string" ? { scope: "main" as const, text: m } : m))
      .filter((m) => m && m.scope !== "npc" && String(m.text ?? "").trim());
    const roomName = (id?: string) => (id ? spotName(next, id) ?? worldLocOf(id)?.name ?? id : "");
    const mem = applyMemory(next, mains, step.scene_memory, { roomName, defaultBook: defaultWorldBook });
    if (mem !== next) Object.assign(next, mem);
  }
  if (typeof step.save_summary === "string" && step.save_summary.trim()) next.saveSummary = step.save_summary.trim().slice(0, 60);
  // tabs 分发：只收文字摘要写进状态中枢，各 Tab 读取展示；数值事实一律来自上面已结算的状态，Tab 不自行决定
  if (step.tabs && typeof step.tabs === "object") {
    const dig = { ...(next.tabDigest ?? {}) };
    for (const [k, v] of Object.entries(step.tabs)) {
      const text = typeof v === "string" ? stripMarkup(v).trim().slice(0, 80) : "";
      if (text && ["story", "character", "npc", "map", "settings"].includes(k)) dig[k] = { text, turn };
    }
    next.tabDigest = dig;
  }

  // 隐藏生育率：亲密关系有概率受孕（受孕本身不提示，孕期征兆/分娩由日结算推进）
  if (next.sim) {
    next.sim = ensureFertility(next.sim);
    for (const nm of Array.isArray(step.intimate) ? step.intimate : []) {
      const who = findNpc(next.npcs, nm, nm);
      if (!who || !canRomance(next.sim, who.id)) continue; // 不可攻略 / 家人 / 子女不结算亲密关系
      next.sim = rollIntimacy(next.sim, who.id, who.name, next.player.gender, Math.random(), who.persona?.gender === "男" || who.persona?.gender === "女" ? who.persona.gender : undefined).next;
      if (next.sim.pregnancy) break;
    }
  }

  // 心事 → NPC 视角日记（只在 AI 写了 diary 时入册）
  for (const t of Array.isArray(step.thoughts) ? step.thoughts : []) {
    if (!t?.diary?.trim()) continue;
    const who = findNpc(next.npcs, t.name, t.name);
    if (!who) continue;
    next.diaries = [...(next.diaries ?? []), { id: uid(), npcId: who.id, name: who.name, time, turn, text: t.diary.trim() }];
  }

  next.turnCount = turn;
  next.options = (step.options ?? []).slice(0, 3); // 选项最多 3 个：多了占屏、难选
  if (step.game_end) {
    next.ended = true;
    if (step.epilogue) next.epilogue = step.epilogue;
  }
  next.updatedAt = Date.now();
  next.npcs = tickBirthdays(next.npcs, next.sim?.day ?? 0).npcs;
  // 主角年龄随日历内置开启（AI 回合也可能推进日期）
  { const a = tickPlayerAge(next, next.sim?.day ?? 0); next.player = a.g.player; next.playerAgedYear = a.g.playerAgedYear; if (a.note) changes.push(a.note); }
  return { next, changes };
}

/* ————— 结局后记：未配置 AI 时的一次性兜底文案（非逐回合生成，不含随机假数据） ————— */
export function mockEpilogue(p: Player): string {
  const paras = promptFrag("mockEpilogue", GENERIC_EPILOGUE);
  return paras.map((x) => x.replace(/\{name\}/g, p.name)).join("\n\n");
}
const GENERIC_EPILOGUE = [
  "【{name}·后记】",
  "很多年后，人们提起{name}，总要先顿一顿，像在心里把一段旧时光重新走过一遍。",
  "她走过的路不算平坦，也不算传奇，却每一步都踩得实实在在。那些相遇与别离、跌倒与站起，都成了她后来温柔的底气。",
  "灯暗下去的时候，故事也就落幕了。而那盏灯，据说至今还亮着。",
];
