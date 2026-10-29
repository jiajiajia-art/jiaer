/**
 * 生成世界 · 分模组真实 AI 生成管线。
 * 禁止用定时器或本地模板冒充生成；默认走平台 /api/romance/world-gen/complete（运营 LLM + 积分），
 * 不读局内「AI 配置」个人 Key。
 * 依赖：软分层（骨架 → 地点人物 → 剧情）；同层最多 WORLD_GEN_PARALLEL_LIMIT 路并行，层间合并上下文。
 */
import type { AIConfig } from "./types.ts";
import type { Mod, ModContent } from "../mods/types.ts";
import {
  isWorldGenCoreStep,
  WORLD_GEN_EDITOR_STEPS,
  WORLD_GEN_ENGINES,
  type WorldGenDraft,
  type WorldGenEditorStep,
  type WorldGenEngineId,
} from "./worldGenWizard.ts";
import { normalizeStartMetList } from "./normalizeStartMet.ts";
import { asNonEmptyTrimmed, asTrimmedString } from "./asTrimmedString.ts";
import { healModRoomRefs } from "./sanitizeModStrings.ts";
import { completeViaPlatform } from "./platformWorldGenAi.ts";

/**
 * 功能注释：同层（无硬依赖波次内）并行上限。
 * 创作者期望 6–8 路；取 8，由 mapPool 按本波实际条数再截断。
 */
export const WORLD_GEN_PARALLEL_LIMIT = 8;

/**
 * 功能注释：单模组失败后额外重试次数（不含首次）；合计最多 1+MAX_RETRIES 次。
 * 鉴权 / 取消 / 积分不足不重试。
 */
export const WORLD_GEN_MODULE_MAX_RETRIES = 2;

/** 功能注释：尚无完成样本时，单模组串行口径预估秒数（平台 LLM 偏慢） */
export const WORLD_GEN_ETA_FALLBACK_SEC_PER_MODULE = 40;

/** 功能注释：重试间隔（毫秒），随次数略退避，避免打满网关 */
function worldGenRetryDelayMs(attempt: number): number {
  return Math.min(2500, 400 * Math.max(1, attempt));
}

function sleepMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("已取消", "AbortError"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("已取消", "AbortError"));
      },
      { once: true },
    );
  });
}

/**
 * 功能注释：瞬时失败（5xx / 超时 / 网络 / 空结果）自动重试；鉴权类直接抛出。
 * @param maxRetries 额外重试次数，默认 WORLD_GEN_MODULE_MAX_RETRIES（≥2）
 */
export async function withWorldGenRetries<T>(
  run: (attempt: number) => Promise<T>,
  opts: { maxRetries?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const maxRetries = Math.max(2, Math.floor(opts.maxRetries ?? WORLD_GEN_MODULE_MAX_RETRIES));
  let last: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");
    try {
      return await run(attempt);
    } catch (e) {
      last = e;
      if ((e as { name?: string })?.name === "AbortError" || opts.signal?.aborted) throw e;
      if (isFatalAuthGenError(e)) throw e;
      if (attempt >= maxRetries) break;
      await sleepMs(worldGenRetryDelayMs(attempt + 1), opts.signal);
    }
  }
  throw last instanceof Error ? last : new Error(String(last || "生成失败"));
}

/**
 * 功能注释：按已完成进度与并行度估算「此刻」剩余墙钟秒数（取整）。
 * finished=0：并行批次 × fallback；有样本后取「平均速率 × 剩余」与「fallback 批次」较大值，
 * 避免前期快模组拉低均值、后期重模组（固定事件等）把倒计时提前耗尽后一直显示 1 秒。
 */
export function estimateWorldGenEtaSeconds(opts: {
  total: number;
  finished: number;
  elapsedMs: number;
  parallelLimit?: number;
  fallbackSecPerModule?: number;
}): number {
  const total = Math.max(0, Math.floor(Number(opts.total) || 0));
  const finished = Math.max(0, Math.min(total, Math.floor(Number(opts.finished) || 0)));
  const remaining = Math.max(0, total - finished);
  if (remaining === 0) return 0;
  const parallel = Math.max(1, Math.floor(opts.parallelLimit ?? WORLD_GEN_PARALLEL_LIMIT));
  const fallback = Math.max(5, Math.floor(opts.fallbackSecPerModule ?? WORLD_GEN_ETA_FALLBACK_SEC_PER_MODULE));
  const byFallback = Math.ceil(remaining / parallel) * fallback;
  if (finished <= 0 || !(opts.elapsedMs > 400)) {
    return byFallback;
  }
  const secPerFinish = opts.elapsedMs / 1000 / finished;
  const byRate = Math.max(1, Math.ceil(remaining * secPerFinish));
  return Math.max(byRate, byFallback);
}

/**
 * 功能注释：把「此刻剩余秒」换成绝对截止时间戳；UI 每秒用 max(1, ceil((deadline-now)/1000)) 倒计时。
 */
export function worldGenEtaDeadlineMs(remainingSec: number, nowMs = Date.now()): number {
  const sec = Math.max(0, Math.ceil(Number(remainingSec) || 0));
  return nowMs + sec * 1000;
}

/**
 * 功能注释：截止时间已过且仍有未完成模组 → 须重估（否则展示会卡在 1 秒）。
 */
export function worldGenEtaNeedsRecalibrate(opts: {
  deadlineMs: number;
  nowMs?: number;
  remainingModules: number;
  finishedChanged: boolean;
  hasDeadline: boolean;
}): boolean {
  const remainingModules = Math.max(0, Math.floor(Number(opts.remainingModules) || 0));
  if (remainingModules <= 0) return false;
  if (opts.finishedChanged || !opts.hasDeadline) return true;
  const now = Number.isFinite(opts.nowMs) ? Number(opts.nowMs) : Date.now();
  return Number(opts.deadlineMs) > 0 && now >= Number(opts.deadlineMs);
}

/**
 * 功能注释：由截止时间算出展示秒数；生成中至少显示 1，全部完成后为 0。
 * 注意：到期后若仍未完成，调用方须重标定 deadline（见 worldGenEtaNeedsRecalibrate），
 * 否则会长期停在 1——那是「已超时、等待重估」的瞬时值，不是真实只需 1 秒。
 */
export function worldGenEtaDisplaySeconds(opts: {
  deadlineMs: number;
  nowMs?: number;
  remainingModules: number;
}): number {
  const remainingModules = Math.max(0, Math.floor(Number(opts.remainingModules) || 0));
  if (remainingModules <= 0) return 0;
  const now = Number.isFinite(opts.nowMs) ? Number(opts.nowMs) : Date.now();
  const left = Math.ceil((Number(opts.deadlineMs) - now) / 1000);
  return Math.max(1, left);
}

/**
 * 功能注释：把剩余秒拆成「分 + 秒」供 UI 分栏展示（不足 1 分时分为 0，UI 只显示秒）。
 */
export function formatWorldGenEtaParts(totalSec: number): { minutes: number; seconds: number } {
  const safe = Math.max(0, Math.floor(Number(totalSec) || 0));
  return {
    minutes: Math.floor(safe / 60),
    seconds: safe % 60,
  };
}

/** 功能注释：预计耗时文案；0 分时只显示秒（如「25秒」），有分时「5分05秒」。 */
export function formatWorldGenEtaLabel(parts: { minutes: number; seconds: number }): string {
  const m = Math.max(0, Math.floor(Number(parts.minutes) || 0));
  const s = Math.max(0, Math.floor(Number(parts.seconds) || 0));
  if (m <= 0) return `${s}秒`;
  return `${m}分${String(s).padStart(2, "0")}秒`;
}

/**
 * 功能注释：进度列表自动滚动目标。
 * prefer=running：只找进行中；prefer=failed：只找失败；
 * prefer=auto（默认）：先进行中，没有则取第一个失败（生成结束引导用户看失败项）。
 */
export function pickWorldGenScrollTargetId(
  modules: ReadonlyArray<{ id?: string; status?: string }> | null | undefined,
  opts?: { prefer?: "running" | "failed" | "auto" },
): string | null {
  if (!Array.isArray(modules)) return null;
  const prefer = opts?.prefer ?? "auto";
  const pick = (status: string) => {
    for (const row of modules) {
      if (String(row?.status || "") !== status) continue;
      const id = String(row?.id || "").trim();
      if (id) return id;
    }
    return null;
  };
  if (prefer === "running") return pick("running");
  if (prefer === "failed") return pick("failed");
  return pick("running") || pick("failed");
}

/**
 * 功能注释：软依赖分层——硬依赖很少，但后层剧情最好先有地点/人物 id。
 * 同层可并行；未列入的扩展模组落入末波。
 */
export const WORLD_GEN_DEPENDENCY_WAVES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze([
    "prompt",
    "hub:rules",
    "hub:book",
    "travelTime",
    "startResources",
    "creation",
    "creationPools",
    "opening",
  ]),
  Object.freeze([
    "hub:map",
    "rooms",
    "hub:person",
    "npcs",
    "relations",
    "contacts",
    "hub:faction",
    "hub:paths",
    "lore",
  ]),
  Object.freeze(["hub:fixed", "fixedEvents", "storylines"]),
]);

/**
 * 功能注释：把勾选模组按依赖波次分组；同波内顺序保持勾选顺序。
 */
export function partitionWorldGenWaves(moduleIds: readonly string[]): string[][] {
  const want = new Set(moduleIds);
  const waves: string[][] = [];
  const placed = new Set<string>();
  for (const wave of WORLD_GEN_DEPENDENCY_WAVES) {
    const batch = moduleIds.filter((id) => want.has(id) && (wave as readonly string[]).includes(id));
    for (const id of batch) placed.add(id);
    if (batch.length) waves.push(batch);
  }
  const rest = moduleIds.filter((id) => want.has(id) && !placed.has(id));
  if (rest.length) waves.push(rest);
  return waves;
}

/** 功能注释：有限并发池；保持结果下标与入参一致 */
export async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  };
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

/**
 * 功能注释：作者已装组件 / 扩展玩法数据键；基础模组重生成不得覆盖这些字段。
 * 仅当本次勾选的扩展模组 id 明确对应时才允许写入。
 */
export const WORLD_GEN_AUTHOR_PROTECTED_KEYS = Object.freeze([
  "playModInstalls",
  "gigs",
  "gigPrices",
  "contracts",
  "projects",
  "industry",
  "imageCrisis",
  "weeklyPaper",
  "meals",
  "pregnancy",
  "phoneAppsCfg",
  "cars",
] as const);

const STEP_OWNED_PROTECTED: Record<string, readonly string[]> = {
  playModInstalls: ["playModInstalls"],
  gigs: ["gigs", "gigPrices"],
  contracts: ["contracts"],
  projects: ["projects"],
  industry: ["industry"],
  imageCrisis: ["imageCrisis"],
  weeklyPaper: ["weeklyPaper"],
  meals: ["meals"],
  pregnancy: ["pregnancy"],
  phoneAppsCfg: ["phoneAppsCfg"],
};

/**
 * 功能注释：清洗 AI 补丁——基础模组禁止写入扩展玩法键；扩展模组也只能写本模组字段。
 * 重新生成基础内容时保留作者已安装组件与手动配置。
 */
export function sanitizeWorldGenAiPatch(
  stepId: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  const allowed = new Set(STEP_OWNED_PROTECTED[stepId] ?? []);
  for (const k of WORLD_GEN_AUTHOR_PROTECTED_KEYS) {
    if (!allowed.has(k)) delete out[k];
  }
  // 功能注释：基础生成不得把娱乐圈扩展开关偷偷打开
  if (isWorldGenCoreStep(stepId) && out.features && typeof out.features === "object" && !Array.isArray(out.features)) {
    const f = { ...(out.features as Record<string, unknown>) };
    for (const flag of ["industryTab", "career", "weeklyPaper", "imageCrisis", "pregnancy", "cars"] as const) {
      if (f[flag] === true) f[flag] = false;
    }
    out.features = f;
  }
  // 功能注释：startMet 必须是 id 数组；对象/单字符串会在 registry 展开时炸「is not iterable」
  if ("startMet" in out) {
    const normalized = normalizeStartMetList(out.startMet);
    if (normalized?.length) out.startMet = normalized;
    else delete out.startMet;
  }
  // 功能注释：terms / prompt 文案必须是字符串，否则编辑器 .trim() 整页崩
  if (out.terms && typeof out.terms === "object" && !Array.isArray(out.terms)) {
    const terms: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.terms as Record<string, unknown>)) {
      const s = asNonEmptyTrimmed(v);
      if (s) terms[k] = s;
    }
    if (Object.keys(terms).length) out.terms = terms;
    else delete out.terms;
  }
  if (out.prompt && typeof out.prompt === "object" && !Array.isArray(out.prompt)) {
    const prompt: Record<string, string> = {};
    for (const [k, v] of Object.entries(out.prompt as Record<string, unknown>)) {
      const s = asNonEmptyTrimmed(v);
      if (s) prompt[k] = s;
    }
    if (Object.keys(prompt).length) out.prompt = prompt;
    else delete out.prompt;
  }
  if (Array.isArray(out.npcs)) {
    out.npcs = (out.npcs as unknown[]).map((row) => {
      if (!row || typeof row !== "object") return row;
      const n = { ...(row as Record<string, unknown>) };
      if ("name" in n) n.name = asTrimmedString(n.name);
      if ("gender" in n) {
        const g = asNonEmptyTrimmed(n.gender);
        if (g) n.gender = g;
        else delete n.gender;
      }
      if ("bio" in n) n.bio = asTrimmedString(n.bio);
      if ("role" in n) n.role = asTrimmedString(n.role);
      return n;
    });
  }
  return out;
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
type CompleteFn = (cfg: AIConfig, messages: ChatMsg[], timeoutMs?: number) => Promise<string>;

/** 功能注释：占位 cfg；平台路径不使用个人 AIConfig，仅满足 CompleteFn 签名 */
const PLATFORM_CFG_STUB: AIConfig = {
  baseUrl: "",
  apiKey: "",
  model: "",
  models: [],
  temperature: 0.4,
  topP: 0.95,
};

async function resolveCfg(cfg?: AIConfig): Promise<AIConfig> {
  if (cfg) return cfg;
  return PLATFORM_CFG_STUB;
}

/** 功能注释：生成中途只做骨架校验；完整 validateMod 在编辑器保存时再跑，避免半成品误报 */
function softValidateModSkeleton(mod: Mod): string[] {
  const errs: string[] = [];
  if (!mod || typeof mod !== "object") return ["模组必须是一个 JSON 对象"];
  if (typeof mod.id !== "string" || !mod.id.trim()) errs.push("id 缺失");
  if (typeof mod.name !== "string" || !mod.name.trim()) errs.push("name 缺失");
  if (!mod.content || typeof mod.content !== "object") errs.push("content 缺失");
  return errs;
}

/** 功能注释：从错误对象抽出接口原文，供鉴权/文案判断（不依赖 aiError 模块，便于 strip-types 单测） */
function genErrorBlob(e: unknown): { status: number; detail: string; message: string } {
  const err = e as { status?: number; body?: string; message?: string; name?: string };
  let detail = "";
  try {
    const j = JSON.parse(err?.body || "");
    const x = j?.error ?? j;
    detail = String(x?.message ?? x?.msg ?? j?.message ?? "");
  } catch {
    detail = String(err?.body || "").slice(0, 120);
  }
  return { status: err?.status ?? 0, detail, message: String(err?.message || "") };
}

/**
 * 功能注释：登录失效 / 积分不足 /（兼容旧）密钥类错误应立刻停整批，禁止继续打满勾选模组。
 */
export function isFatalAuthGenError(e: unknown): boolean {
  const { status, detail, message } = genErrorBlob(e);
  const code = String((e as { code?: string })?.code || "");
  const blob = `${detail} ${message} ${code}`.toLowerCase();
  if (status === 401) return true;
  if (/insufficient_points|积分不足|请先登录|not_logged_in/.test(blob)) return true;
  if (/invalid.*key|api[\s_-]?key|unauthorized|authentication\s*fails|incorrect.*key|密钥无效|api key 不正确|尚未配置\s*ai/.test(blob)) {
    return true;
  }
  return false;
}

/** 功能注释：轻量错误文案（不依赖 aiError 参数属性，便于 Node strip-types 单测） */
export function formatGenError(e: unknown): string {
  const err = e as { name?: string; code?: string };
  if (err?.name === "AbortError") return "已取消";
  const { status, detail, message } = genErrorBlob(e);
  const blob = `${detail} ${message} ${err?.code || ""}`.toLowerCase();
  if (status === 401 || /请先登录|not_logged_in/.test(blob)) {
    return "请先登录平台账号后再生成世界。";
  }
  if (/insufficient_points|积分不足/.test(blob)) {
    return message || detail || "积分不足，请充值后再生成。";
  }
  // 兼容旧个人 Key 路径文案（单测 / 历史会话）
  if (/invalid.*key|api[\s_-]?key|authentication\s*fails|密钥无效|api key 不正确/.test(blob) || status === 401) {
    return "请先登录平台账号后再生成世界。";
  }
  if (status === 429) return "接口限流了，稍等片刻再试。";
  if (status === 503 || /llm_unavailable|生成服务暂不可用/.test(blob)) {
    return "平台生成服务暂不可用，请稍后再试。";
  }
  if (status >= 500) return `AI 服务端出错了（${status}），稍后重试即可。${detail ? `（${detail}）` : ""}`;
  if (status) return `AI 请求失败（${status}）。${detail ? `（${detail}）` : ""}`;
  return message || "网络或配置异常，请稍后重试。";
}

export type WorldGenModuleStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type WorldGenModuleState = {
  id: string;
  name: string;
  group: string;
  status: WorldGenModuleStatus;
  error?: string;
};

export type WorldGenProgress = {
  /** 已进入生成队列的模组（仅勾选的） */
  modules: WorldGenModuleState[];
  /** 当前正在生成的下标（0-based）；全部结束为 -1 */
  currentIndex: number;
  /** 已成功数 */
  doneCount: number;
  /** 失败数 */
  failedCount: number;
  /** 队列总长 */
  total: number;
  /** 温和文案，如「正在生成角色 2/8」 */
  label: string;
  cancelled: boolean;
  /** 功能注释：遇密钥/鉴权错误提前停批，后续未再请求 */
  stoppedByAuth?: boolean;
};

export type WorldGenRunResult = {
  mod: Mod;
  progress: WorldGenProgress;
  cancelled: boolean;
};

/** 功能注释：进度里识别登录/积分等致命失败，向导展示停批提示 */
export function progressHasAuthFailure(p: WorldGenProgress | null | undefined): boolean {
  if (!p) return false;
  if (p.stoppedByAuth) return true;
  return p.modules.some(
    (m) =>
      m.status === "failed" &&
      /请先登录|积分不足|API Key|密钥|尚未配置\s*AI|平台生成服务/i.test(m.error || ""),
  );
}

/**
 * 功能注释：发版后旧 tab 仍握着旧 hash，动态 import 会 404。
 * 生成世界若拆成独立 chunk，失败文案即此；须整页硬刷新，禁止当「AI 失败」进空编辑器。
 */
export function isStaleChunkLoadErrorMessage(msg: unknown): boolean {
  const s = String(msg || "");
  return /Failed to fetch dynamically imported module|Loading chunk [\d]+ failed|Importing a module script failed|error loading dynamically imported module/i.test(
    s,
  );
}

/** 功能注释：进度里任一失败项是旧 chunk 404 */
export function progressHasStaleChunkFailure(p: WorldGenProgress | null | undefined): boolean {
  if (!p) return false;
  return p.modules.some((m) => m.status === "failed" && isStaleChunkLoadErrorMessage(m.error));
}

/** 功能注释：各编辑器模组对应的 content 字段提示，供 AI 只产出相关键，避免覆盖未勾选模组 */
const MODULE_FIELD_HINT: Record<string, string> = {
  "hub:person": "npcs[]、startMet、familyWx、familyVoices、relations（人物相关）",
  "hub:map": "rooms{}、startRoom、locations[]、travel、map",
  "hub:rules": "worldRules[]、gameRules[]",
  "hub:engine": "tuning、stats、features",
  "hub:beauty": "lookRules[]、theme、cover",
  "hub:nav": "navTabs[]、navSize、terms（仅 tab* 键）",
  "hub:book": "worldBook[]、prompt（scriptTone）",
  "hub:fixed": "fixedEvents[]、events[]、encounters[]",
  "hub:cg": "（CG 图鉴多为素材引用；可写 opening / cover 相关文案占位，勿捏造外链大图）",
  "hub:audio": "bgm[]、audioRefs[]、platformAudioRefs[]（平台曲只写 platform: 前缀 id，勿编造，勿写入 bgm 或 audioRefs）",
  "hub:faction": "lore[]（地区→势力→角色）",
  "hub:timeline": "storylines[]、npcs[].timeline",
  "hub:end": "endings[]、timeLimit、gradeDims[]",
  "hub:paths": "creation.paths[]、identities[]（不要写 pathTitle、pathIntro、formTitle、formIntro、identityLabel、fixedAge、parentNote、seedDescription 或 paths[].formIntro；这些留空，建角页用游戏默认句）",
  "hub:mods": "playModInstalls[]（仅合理默认占位，勿编造不存在的组件 id）",
  travelTime: "startDate、startTime、dayStart、dayEnd、travel（节奏相关）、play.ageAuto/pickStartDate",
  features: "features{}",
  navTabs: "navTabs[]、navSize",
  phoneAppsCfg: "phoneAppsCfg[]",
  theme: "theme{}",
  bgm: "bgm[]（内嵌 data: / 本机 local: / 链接；不要把作品引用或平台曲写成 bgm）",
  audioRefs: "audioRefs[]（只写作品音频库已有 id，可空，勿编造）",
  platformAudioRefs: "platformAudioRefs[]（只写 platform: 前缀的平台曲目 id，可空，勿编造；不要写入 bgm 或 audioRefs）",
  avatars: "avatars{pools?,publicRandom?,match?}",
  creation: "customAttrs[]、creation.fields / creation.builtin（建角：属性 + 字段；勿预填演技等八维）",
  creationPools: "styles[]、identities[]、backgrounds[]、directions[]、school、parentJobs[]、zodiacs[]",
  npcs: "npcs[]、startMet、familyWx、familyVoices",
  relations: "relations{}",
  contacts: "contacts{}",
  startResources: "startMoney",
  trainings: "trainings[]",
  sideJobs: "sideJobs[]、weekendActs[]",
  growRules: "fameTiers[]、titles[]、bills{}",
  income: "income[]",
  gameRules: "gameRules[]",
  economy: "bills{}、startMoney、allowance（如需要）",
  tuning: "tuning{}",
  startWeather: "weather",
  rooms: "rooms{}、startRoom、locations[]",
  travel: "travel{}、cars[]",
  prompt: "prompt{scriptTone}（整段剧本基调；旧 gmIntro/worldIntro/narratorPersona 可读并入）",
  lore: "lore[]",
  festivals: "festivals[]",
  cover: "cover{}",
  opening: "opening{}",
  fixedEvents: "fixedEvents[]、events[]",
  storylines: "storylines[]",
  endings: "endings[]、timeLimit、gradeDims[]",
  lookRules: "lookRules[]",
  playModInstalls: "playModInstalls[]（可空）",
  gigs: "gigs[]、gigPrices{}",
  contracts: "contracts{}",
  projects: "projects{}",
  industry: "industry{}",
  imageCrisis: "imageCrisis{}",
  weeklyPaper: "weeklyPaper{}",
  meals: "meals[]",
  pregnancy: "pregnancy{}、features.pregnancy",
  ext: "ext{}（声明式扩展，可空对象）",
};

function engineLabel(id: WorldGenEngineId): string {
  return WORLD_GEN_ENGINES.find((e) => e.id === id)?.name ?? id;
}

function engineStyleHint(id: WorldGenEngineId): string {
  if (id === "deep") return "文风偏深度推演：动机细腻、因果长线、设定自洽。";
  if (id === "light") return "文风偏轻量灵感：结构清晰、条目精炼、便于后续手改。";
  return "文风偏平衡叙事：剧情推进、人物塑造与节奏兼顾。";
}

/** 功能注释：浅合并 content；带 id 的数组合并；对象浅合并；标量覆盖。未勾选模组字段不会被空值抹掉。 */
export function mergeModContent(base: ModContent, patch: Record<string, unknown>): ModContent {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (Array.isArray(v) && Array.isArray(cur) && v.every((x) => x && typeof x === "object" && "id" in (x as object))) {
      const next = [...cur] as { id?: string }[];
      for (const item of v as { id: string }[]) {
        const i = next.findIndex((x) => x?.id === item.id);
        if (i >= 0) next[i] = { ...next[i], ...item };
        else next.push(item);
      }
      out[k] = next;
    } else if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) {
      out[k] = { ...(cur as object), ...(v as object) };
    } else {
      out[k] = v;
    }
  }
  const merged = out as ModContent;
  // 功能注释：分模组生成易出现 startRoom 与 rooms 不同步，合并后立即纠偏
  healModRoomRefs(merged);
  return merged;
}

function parseJsonObject(raw: unknown): Record<string, unknown> {
  // 功能注释：接口偶发直接给对象；非字符串时禁止 .trim()，否则报 t.trim is not a function
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  const t = String(raw ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 未返回 JSON 对象");
  try {
    return JSON.parse(body.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return JSON.parse(body.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1")) as Record<string, unknown>;
  }
}

/** 功能注释：从回复里取出 content 补丁；允许顶层直接是 content 字段，或包在 {content|patch|manifest} 里 */
export function extractContentPatch(raw: string): Record<string, unknown> {
  const obj = parseJsonObject(raw);
  if (obj.content && typeof obj.content === "object" && !Array.isArray(obj.content)) {
    return obj.content as Record<string, unknown>;
  }
  if (obj.patch && typeof obj.patch === "object" && !Array.isArray(obj.patch)) {
    return obj.patch as Record<string, unknown>;
  }
  const { manifest: _m, remove: _r, ...rest } = obj;
  void _m; void _r;
  if (!Object.keys(rest).length) throw new Error("AI 返回的补丁为空");
  return rest;
}

/** 功能注释：已生成内容的精简上下文，保证后续模组设定一致 */
export function buildGeneratedContext(mod: Mod, max = 4500): string {
  const c = mod.content ?? {};
  const bits: string[] = [
    `作品名：${mod.name}`,
    mod.description ? `简介：${mod.description.slice(0, 200)}` : "",
  ];
  if (c.prompt && typeof c.prompt === "object") {
    const p = c.prompt as { scriptTone?: string; gmIntro?: string; worldIntro?: string; narratorPersona?: string };
    const tone = [p.scriptTone, p.gmIntro, p.worldIntro, p.narratorPersona].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join("\n\n");
    if (tone) bits.push(`剧本基调：${tone.slice(0, 600)}`);
  }
  if (c.rooms && typeof c.rooms === "object") {
    bits.push(`地点：${Object.entries(c.rooms as Record<string, { name?: string }>).map(([id, r]) => `${id}=${r?.name || id}`).join("、") || "（无）"}`);
  }
  if (Array.isArray(c.npcs) && c.npcs.length) {
    bits.push(`人物：${(c.npcs as { id?: string; name?: string; role?: string }[]).map((n) => `${n.id}=${n.name}${n.role ? `(${n.role})` : ""}`).join("、")}`);
  }
  if (Array.isArray(c.creation?.paths) && c.creation!.paths!.length) {
    bits.push(`人物线路：${c.creation!.paths!.map((p) => `${p.id}=${p.name}`).join("、")}`);
  }
  if (Array.isArray(c.storylines) && c.storylines.length) {
    bits.push(`主线：${(c.storylines as { id?: string; name?: string; title?: string }[]).map((s) => s.name || s.title || s.id).join("、")}`);
  }
  if (Array.isArray(c.endings) && c.endings.length) {
    bits.push(`结局：${(c.endings as { id?: string; title?: string }[]).map((e) => e.title || e.id).join("、")}`);
  }
  if (Array.isArray(c.fixedEvents) && c.fixedEvents.length) {
    bits.push(`固定事件：${(c.fixedEvents as { id?: string; name?: string }[]).slice(0, 12).map((e) => e.name || e.id).join("、")}`);
  }
  const text = bits.filter(Boolean).join("\n");
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function softValidatePatch(step: WorldGenEditorStep, patch: Record<string, unknown>): string | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return "补丁不是对象";
  if (!Object.keys(patch).length) return "补丁为空";
  // 功能注释：硬校验交给 validateMod；此处只拦明显空壳，避免「成功」却什么都没写
  const hint = MODULE_FIELD_HINT[step.id] || "";
  const keys = Object.keys(patch);
  if (hint && keys.length === 1 && keys[0] === "features" && step.id !== "features") {
    return "补丁与模组无关（仅 features）";
  }
  return null;
}

function progressLabel(
  modules: WorldGenModuleState[],
  currentIndex: number,
  cancelled: boolean,
  stoppedByAuth = false,
): string {
  if (cancelled) return "已取消生成，已保留完成内容";
  const total = modules.length;
  const done = modules.filter((m) => m.status === "done").length;
  const failed = modules.filter((m) => m.status === "failed").length;
  const running = modules.filter((m) => m.status === "running");
  if (currentIndex < 0 || currentIndex >= total) {
    if (stoppedByAuth) {
      return `已停止后续请求：成功 ${done}/${total}，失败 ${failed}`;
    }
    if (failed) return `生成结束：成功 ${done}/${total}，失败 ${failed}`;
    return done === total && total > 0 ? `全部完成 ${done}/${total}` : "准备生成…";
  }
  if (running.length > 1) {
    const names = running.slice(0, 3).map((m) => m.name).join("、");
    const more = running.length > 3 ? `等 ${running.length} 项` : "";
    return `并行生成 ${names}${more}（已完成 ${done}/${total}）`;
  }
  const cur = modules[currentIndex] || running[0];
  return cur ? `正在生成${cur.name} ${done + 1}/${total}` : `准备生成 0/${total}`;
}

export function makeInitialProgress(moduleIds: readonly string[]): WorldGenProgress {
  const idSet = new Set(moduleIds);
  const modules: WorldGenModuleState[] = WORLD_GEN_EDITOR_STEPS
    .filter((s) => idSet.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, group: s.group, status: "pending" as const }));
  return {
    modules,
    currentIndex: modules.length ? 0 : -1,
    doneCount: 0,
    failedCount: 0,
    total: modules.length,
    label: modules.length ? `准备生成 0/${modules.length}` : "未勾选模组",
    cancelled: false,
  };
}

function snapshotProgress(
  modules: WorldGenModuleState[],
  currentIndex: number,
  cancelled: boolean,
  stoppedByAuth = false,
): WorldGenProgress {
  return {
    modules: modules.map((m) => ({ ...m })),
    currentIndex,
    doneCount: modules.filter((m) => m.status === "done").length,
    failedCount: modules.filter((m) => m.status === "failed").length,
    total: modules.length,
    label: progressLabel(modules, currentIndex, cancelled, stoppedByAuth),
    cancelled,
    stoppedByAuth: stoppedByAuth || undefined,
  };
}

export type GenerateOneOpts = {
  step: WorldGenEditorStep;
  draft: WorldGenDraft;
  mod: Mod;
  signal?: AbortSignal;
  /** 注入 complete，便于单测；默认走真实 AI */
  completeFn?: CompleteFn;
  cfg?: AIConfig;
};

/** 功能注释：真实调用一次 AI，生成单个模组补丁并合并；失败抛错，不写假数据 */
export async function generateOneWorldGenModule(opts: GenerateOneOpts): Promise<{ mod: Mod; patch: Record<string, unknown> }> {
  const cfg = await resolveCfg(opts.cfg);
  if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");

  let completeFn = opts.completeFn;
  if (!completeFn) {
    // 功能注释：静态引入平台 LLM，禁止再拆独立 chunk（发版后旧页动态 import 404 会 22 项全挂）
    completeFn = async (_c, messages, timeoutMs) =>
      completeViaPlatform(messages, {
        engineId: opts.draft.engineId,
        moduleId: opts.step.id,
        timeoutMs,
        signal: opts.signal,
      });
  }

  const engineId = opts.draft.engineId;
  const fields = MODULE_FIELD_HINT[opts.step.id] || `与「${opts.step.name}」相关的 content 字段（${opts.step.desc}）`;
  const ctx = buildGeneratedContext(opts.mod);
  const polish = opts.draft.aiPolish
    ? "若故事设定口语化，请在保留原意前提下整理结构与表达。"
    : "尽量贴近创作者原文表述，不要过度改写。";

  const messages: ChatMsg[] = [
    {
      role: "system",
      content: `你是文字模拟游戏的模组设计师。只输出一个 JSON 对象，不要解释、不要 Markdown 说明。
JSON 形如：{"content":{ ...本模组相关字段... }}。
只写本模组需要的字段；数组条目必须带稳定 id（小写英文/数字/-_）；不要输出未要求的大段无关字段。
${engineStyleHint(engineId)}`,
    },
    {
      role: "user",
      content: `作品名称：${opts.draft.title.trim()}
故事设定：${opts.draft.setting.trim()}
创作引擎：${engineLabel(engineId)}（${engineId}）
${polish}

当前模组：「${opts.step.group} · ${opts.step.name}」
说明：${opts.step.desc}
请主要产出这些字段：${fields}

已生成上下文（须与之一致，勿自相矛盾）：
${ctx || "（尚无其它模组）"}

要求：内容须能被编辑器继续手改；地点/人物 id 与上下文已有 id 对齐；不要编造无法访问的外链大图。`,
    },
  ];

  // 功能注释：网络/空结果/解析失败至少再试 2 次；鉴权失败立即上抛
  return withWorldGenRetries(async () => {
    const raw = await completeFn!(cfg, messages, 120_000);
    if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");
    if (!String(raw || "").trim()) throw new Error("AI 返回空内容");

    const rawPatch = extractContentPatch(String(raw));
    const patch = sanitizeWorldGenAiPatch(opts.step.id, rawPatch);
    const soft = softValidatePatch(opts.step, patch);
    if (soft) throw new Error(soft);

    const next: Mod = {
      ...opts.mod,
      content: mergeModContent(opts.mod.content, patch),
    };
    // 功能注释：整模校验；生成中途允许不完整，但 id/name 等骨架必须仍合法
    const fatal = softValidateModSkeleton(next);
    if (fatal.length) throw new Error(`校验失败：${fatal.join("；")}`);

    return { mod: next, patch };
  }, { signal: opts.signal, maxRetries: WORLD_GEN_MODULE_MAX_RETRIES });
}

export type RunWorldGenOpts = {
  draft: WorldGenDraft;
  seedMod: Mod;
  /** 仅生成这些模组；已成功的 id 传入 doneIds 则跳过 */
  moduleIds: readonly string[];
  doneIds?: ReadonlySet<string>;
  signal?: AbortSignal;
  onProgress?: (p: WorldGenProgress) => void;
  completeFn?: CompleteFn;
  cfg?: AIConfig;
};

/**
 * 功能注释：按依赖波次生成；同波最多 PARALLEL 路并行，波结束后合并再开下一波。
 * 普通失败不阻断同波其它项；鉴权失败停整批；取消保留已完成。
 */
export async function runWorldGenModules(opts: RunWorldGenOpts): Promise<WorldGenRunResult> {
  const cfg = await resolveCfg(opts.cfg);

  const progress = makeInitialProgress(opts.moduleIds);
  let mod = opts.seedMod;
  let stoppedByAuth = false;
  const done = new Set(opts.doneIds ?? []);
  const rowById = new Map(progress.modules.map((m) => [m.id, m]));

  const emit = (cancelled = false) => {
    const runningIdx = progress.modules.findIndex((m) => m.status === "running");
    const idx = runningIdx >= 0 ? runningIdx : -1;
    const p = snapshotProgress(progress.modules, idx, cancelled, stoppedByAuth);
    opts.onProgress?.(p);
    return p;
  };

  const failRest = (msg: string) => {
    for (const row of progress.modules) {
      if (row.status === "done" || done.has(row.id)) continue;
      if (row.status === "failed" && row.error) continue;
      row.status = "failed";
      row.error = `${msg}（未继续请求）`;
    }
  };

  if (!progress.modules.length) {
    return { mod, progress: emit(), cancelled: false };
  }

  // 功能注释：已成功的先标 done，再按波次跑剩余
  for (const row of progress.modules) {
    if (done.has(row.id)) row.status = "done";
  }
  emit();

  const waves = partitionWorldGenWaves(progress.modules.map((m) => m.id));

  for (const waveIds of waves) {
    if (opts.signal?.aborted) {
      return { mod, progress: emit(true), cancelled: true };
    }
    if (stoppedByAuth) break;

    const batch = waveIds
      .map((id) => rowById.get(id)!)
      .filter((row) => row && row.status !== "done" && !done.has(row.id));
    if (!batch.length) continue;

    for (const row of batch) {
      row.status = "running";
      row.error = undefined;
    }
    emit();

    // 功能注释：同波共享波开始时的 mod 快照，避免并行写竞态；结束后再顺序合并
    const snapshotMod = mod;
    type OneResult =
      | { id: string; ok: true; patch: Record<string, unknown> }
      | { id: string; ok: false; error: unknown; aborted?: boolean };

    const results = await mapPool(batch, WORLD_GEN_PARALLEL_LIMIT, async (row): Promise<OneResult> => {
      if (opts.signal?.aborted || stoppedByAuth) {
        return { id: row.id, ok: false, error: new DOMException("已取消", "AbortError"), aborted: true };
      }
      const step = WORLD_GEN_EDITOR_STEPS.find((s) => s.id === row.id);
      if (!step) {
        return { id: row.id, ok: false, error: new Error("未知模组") };
      }
      try {
        const r = await generateOneWorldGenModule({
          step,
          draft: opts.draft,
          mod: snapshotMod,
          signal: opts.signal,
          completeFn: opts.completeFn,
          cfg,
        });
        return { id: row.id, ok: true, patch: r.patch };
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError" || opts.signal?.aborted) {
          return { id: row.id, ok: false, error: e, aborted: true };
        }
        return { id: row.id, ok: false, error: e };
      }
    });

    if (opts.signal?.aborted || results.some((r) => !r.ok && r.aborted && !stoppedByAuth)) {
      for (const row of batch) {
        if (row.status === "running") row.status = "pending";
      }
      return { mod, progress: emit(true), cancelled: true };
    }

    // 功能注释：先处理鉴权失败，再合并成功补丁（按波内顺序，稳定可复现）
    for (const r of results) {
      const row = rowById.get(r.id)!;
      if (r.ok) continue;
      const msg = formatGenError(r.error);
      row.status = "failed";
      row.error = msg;
      if (isFatalAuthGenError(r.error)) {
        stoppedByAuth = true;
      }
    }
    if (stoppedByAuth) {
      const authMsg =
        batch.map((b) => b.error).find((e) => e && /登录|积分|密钥|API Key/i.test(e)) ||
        "请先登录平台账号后再生成世界。";
      failRest(authMsg);
      return { mod, progress: emit(), cancelled: false };
    }

    for (const r of results) {
      if (!r.ok) continue;
      const row = rowById.get(r.id)!;
      mod = {
        ...mod,
        content: mergeModContent(mod.content, r.patch),
      };
      row.status = "done";
      done.add(row.id);
    }
    emit();
  }

  return { mod, progress: emit(), cancelled: false };
}

/** 功能注释：只重试失败项；成功项绝不重跑 */
export async function retryFailedWorldGenModules(opts: RunWorldGenOpts & {
  previous: WorldGenProgress;
}): Promise<WorldGenRunResult> {
  const failedIds = opts.previous.modules.filter((m) => m.status === "failed").map((m) => m.id);
  const doneIds = new Set(opts.previous.modules.filter((m) => m.status === "done").map((m) => m.id));
  return runWorldGenModules({
    ...opts,
    moduleIds: failedIds,
    doneIds,
  }).then((r) => {
    // 合并进度：保留原成功项 + 本次结果
    const map = new Map(opts.previous.modules.map((m) => [m.id, { ...m }]));
    for (const m of r.progress.modules) map.set(m.id, m);
    const modules = opts.previous.modules.map((m) => map.get(m.id) || m);
    const progress = snapshotProgress(modules, -1, r.cancelled);
    opts.onProgress?.(progress);
    return { mod: r.mod, progress, cancelled: r.cancelled };
  });
}

export async function retryOneWorldGenModule(opts: RunWorldGenOpts & {
  previous: WorldGenProgress;
  moduleId: string;
}): Promise<WorldGenRunResult> {
  const doneIds = new Set(opts.previous.modules.filter((m) => m.status === "done").map((m) => m.id));
  doneIds.delete(opts.moduleId);
  return runWorldGenModules({
    ...opts,
    moduleIds: [opts.moduleId],
    doneIds,
  }).then((r) => {
    const map = new Map(opts.previous.modules.map((m) => [m.id, { ...m }]));
    for (const m of r.progress.modules) map.set(m.id, m);
    const modules = opts.previous.modules.map((m) => map.get(m.id) || m);
    const progress = snapshotProgress(modules, -1, r.cancelled);
    opts.onProgress?.(progress);
    return { mod: r.mod, progress, cancelled: r.cancelled };
  });
}
