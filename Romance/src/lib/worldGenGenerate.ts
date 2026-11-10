/**
 * 生成世界 · 两次串联真实 AI 生成管线。
 * 禁止用定时器或本地模板冒充生成；默认走平台 /api/romance/world-gen/complete（运营 LLM + 积分），
 * 不读局内「AI 配置」个人 Key。
 * 核心默认：第 1 次=基调+世界书+规则+开局时间+建角+线路；第 2 次=5人物+10地点+5固定事件+结局。
 * 两次严格串联，禁止并行；进度按勾选细项展示明细；缺字段兜底或整批失败，禁止假完成。
 */
import type { AIConfig } from "./types.ts";
import type { Mod, ModContent } from "../mods/types.ts";
import {
  formatWorldGenForbidBlock,
  isWorldGenCoreStep,
  summarizeWorldGenDescription,
  WORLD_DESC_SUMMARY_TARGET,
  WORLD_GEN_EDITOR_STEPS,
  WORLD_GEN_ENGINES,
  type WorldGenDraft,
  type WorldGenEditorStep,
  type WorldGenEngineId,
} from "./worldGenWizard.ts";
import { worldGenAiPolishPrompt, worldGenForbidPrompt } from "./worldGenSettingField.ts";
import { platformNpcTagsPromptLine } from "./npcTags.ts";
import { healNpcListNames, improperPersonNameReason, sanitizeNpcFactionId } from "./personName.ts";
import { healMissingContentIds } from "./modSaveHeal.ts";
import {
  applyWorldGenCrossRefs,
  softValidateWorldGenCrossRefs,
  WORLD_GEN_CUSTOM_ATTRS_SOFT_MAX,
  WORLD_GEN_FIXED_EVENTS_SOFT_MAX,
  WORLD_GEN_NPCS_SOFT_MAX,
  WORLD_GEN_ROOMS_SOFT_MAX,
  type WorldGenRefContext,
} from "./worldGenCrossRefs.ts";
import { normalizeStartMetList } from "./normalizeStartMet.ts";
import { asModArray } from "./asModArray.ts";
import { asNonEmptyTrimmed, asTrimmedString } from "./asTrimmedString.ts";
import { normalizeRuleBranches } from "./gameRuleShape.ts";
import { ensureRoomSceneDescs, healModRoomRefs } from "./sanitizeModStrings.ts";
import {
  completeViaPlatform,
  refundWorldGenPointsViaPlatform,
  type PlatformWorldGenCompleteResult,
} from "./platformWorldGenAi.ts";
import { applyScriptTone, readScriptTone } from "./scriptTone.ts";
import { MOD_DESC_MAX, SCRIPT_TONE_MAX } from "./modBasicInfoLimits.ts";
import { START_DATE_RE } from "./startDateFields.ts";
import {
  ensureWorldGenTravelTimeStartDate,
  normalizeWorldGenPatchStartDate,
} from "./worldGenStartDate.ts";
import {
  ensureWorldGenCustomAttrs,
  ensureWorldGenStartMoney,
  normalizeWorldGenCustomAttrs,
  WORLD_GEN_CUSTOM_ATTRS_COUNT,
} from "./worldGenCreationAttrs.ts";
import { normalizeWorldGenStorylinesPatch } from "./worldGenStorylines.ts";
import {
  normalizeWorldGenFixedEventsPatch,
  softValidateWorldGenFixedEvents,
  WORLD_GEN_FIXED_EVENTS_COUNT,
} from "./worldGenFixedEvents.ts";
import {
  worldGenBatchNeedsEnrich,
  worldGenLeanLimits,
  worldGenLeanPromptBlock,
  worldGenStepNamesFromPatch,
  worldGenStepResultSummary,
  worldGenStepRunningDetail,
  WORLD_GEN_NPCS_COUNT,
  WORLD_GEN_ROOMS_COUNT,
  type WorldGenLeanLimits,
} from "./worldGenProgressDetail.ts";

export { WORLD_GEN_NPCS_COUNT, WORLD_GEN_ROOMS_COUNT } from "./worldGenProgressDetail.ts";

export {
  WORLD_GEN_CUSTOM_ATTRS_SOFT_MAX,
  WORLD_GEN_FIXED_EVENTS_SOFT_MAX,
  WORLD_GEN_NPCS_SOFT_MAX,
  WORLD_GEN_ROOMS_SOFT_MAX,
  applyWorldGenCrossRefs,
  softValidateWorldGenCrossRefs,
  type WorldGenRefContext,
} from "./worldGenCrossRefs.ts";

export {
  coerceWorldGenStartDate,
  ensureWorldGenTravelTimeStartDate,
  inferWorldGenStartDate,
  normalizeWorldGenPatchStartDate,
} from "./worldGenStartDate.ts";

export {
  defaultAttrDescForLabel,
  defaultWorldGenAttrSeeds,
  ensureWorldGenCustomAttrs,
  ensureWorldGenStartMoney,
  healCustomAttrsUnnamed,
  inferWorldGenMoneyLabel,
  normalizeWorldGenCustomAttrs,
  WORLD_GEN_CUSTOM_ATTRS_COUNT,
} from "./worldGenCreationAttrs.ts";

export {
  normalizeWorldGenQuestNodes,
  normalizeWorldGenStorylinesPatch,
} from "./worldGenStorylines.ts";

export {
  normalizeWorldGenFixedEvent,
  normalizeWorldGenFixedEffects,
  normalizeWorldGenFixedEventsPatch,
  softValidateWorldGenFixedEvents,
  WORLD_GEN_FIXED_EVENTS_COUNT,
} from "./worldGenFixedEvents.ts";

/**
 * 功能注释：串联生成并发上限固定为 1——两次核心请求与扩展大类一律串行，禁止并行。
 */
export const WORLD_GEN_PARALLEL_LIMIT = 1;

/** 功能注释：第 1 次生成大类 id（基调+世界书+规则+开局时间+建角+线路） */
export const WORLD_GEN_PHASE1_BATCH_ID = "phase1Foundation";

/** 功能注释：第 2 次生成大类 id（5人物+10地点+5固定事件+结局） */
export const WORLD_GEN_PHASE2_BATCH_ID = "phase2WorldCast";

/** 功能注释：两次串联核心大类；各只打一次完整请求，不再骨架+补文拆枪 */
export function isWorldGenTwoPhaseBatch(batchId: string): boolean {
  const id = String(batchId || "").trim();
  return id === WORLD_GEN_PHASE1_BATCH_ID || id === WORLD_GEN_PHASE2_BATCH_ID;
}

/**
 * 功能注释：单次请求失败后额外重试次数（不含首次）；合计最多 1+MAX_RETRIES 次。
 * 鉴权 / 取消 / 积分不足不重试。
 */
export const WORLD_GEN_MODULE_MAX_RETRIES = 2;

/** 功能注释：固定事件 / 剧情线 / 剧本基调文案长；单模组用 8000；大类合并见 worldGenBatchMaxTokens。 */
export function worldGenModuleMaxTokens(moduleId: string): number {
  return moduleId === "fixedEvents" || moduleId === "storylines" || moduleId === "prompt" ? 8000 : 4000;
}

/**
 * 功能注释：大类一次请求的 token 上限。人物与线路等多项合并需要更大输出；仍受后端 16000 封顶。
 */
export function worldGenBatchMaxTokens(stepIds: readonly string[]): number {
  const ids = stepIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!ids.length) return 4000;
  // 功能注释：两次串联大包需要一次写满多字段，顶满后端上限
  if (
    ids.includes("npcs") && ids.includes("rooms")
    || ids.includes("prompt") && ids.includes("hub:paths")
    || ids.includes("fixedEvents") && ids.includes("storylines")
  ) {
    return 16000;
  }
  if (ids.some((id) => id === "fixedEvents" || id === "storylines")) return 8000;
  if (ids.length >= 3 || ids.some((id) => id === "npcs" || id === "hub:paths" || id === "hub:book" || id === "prompt")) {
    return 12000;
  }
  if (ids.length >= 2) return 8000;
  return worldGenModuleMaxTokens(ids[0]!);
}

/** 功能注释：尚无完成样本时，单次大类请求预估秒数（合并后单次更重） */
export const WORLD_GEN_ETA_FALLBACK_SEC_PER_MODULE = 55;

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
 * 功能注释：生成进度与请求的「大类」。核心默认两次串联请求；扩展玩法仍按大类合并。
 * 例：第1次「基础设定」、第2次「人物地点事件结局」；关系玩法并入「已添加的玩法」。
 */
export type WorldGenBatchCategory = {
  id: string;
  name: string;
  stepIds: readonly string[];
};

export const WORLD_GEN_BATCH_CATEGORIES: readonly WorldGenBatchCategory[] = Object.freeze([
  // 功能注释：第 1 次串联请求——基调+世界书+规则+开局时间+建角+线路
  Object.freeze({
    id: WORLD_GEN_PHASE1_BATCH_ID,
    name: "基础设定",
    stepIds: Object.freeze([
      "prompt",
      "hub:rules",
      "hub:book",
      "travelTime",
      "creation",
      "startResources",
      "hub:paths",
    ]),
  }),
  // 功能注释：第 2 次串联请求——5人物+10地点+5固定事件（事件链）+结局
  Object.freeze({
    id: WORLD_GEN_PHASE2_BATCH_ID,
    name: "人物地点事件结局",
    stepIds: Object.freeze(["npcs", "rooms", "fixedEvents", "storylines"]),
  }),
  Object.freeze({ id: "contacts", name: "人脉", stepIds: Object.freeze(["contacts"]) }),
  Object.freeze({ id: "opening", name: "开场剧情", stepIds: Object.freeze(["opening"]) }),
  Object.freeze({ id: "avatars", name: "头像", stepIds: Object.freeze(["avatars"]) }),
  Object.freeze({
    id: "training",
    name: "养成",
    stepIds: Object.freeze(["trainings", "sideJobs", "income", "gameRules", "tuning"]),
  }),
  Object.freeze({
    id: "playMods",
    name: "已添加的玩法",
    stepIds: Object.freeze([
      "playModInstalls",
      "travel",
      "cars",
      "gigs",
      "contracts",
      "projects",
      "industry",
      "imageCrisis",
      "weeklyPaper",
      "meals",
      "titles",
      "pregnancy",
      "relations",
    ]),
  }),
  Object.freeze({
    id: "beautify",
    name: "美化",
    // 功能注释：开局封面 / 手机应用 / 皮肤美化永不进 AI 批次；只保留仍可勾选的音乐与剧情美化等
    stepIds: Object.freeze(["bgm", "audioRefs", "lookRules", "navTabs"]),
  }),
]);

/** 功能注释：AI 补丁一律剥离的美化键（对应 WORLD_GEN_NO_AI_BEAUTIFY_STEP_IDS，默认封面由向导写剧本名） */
export const WORLD_GEN_NO_AI_CONTENT_KEYS = Object.freeze(["cover", "phoneAppsCfg", "theme"] as const);

/** 功能注释：运行时一批请求：大类 id + 本次实际勾选的细项 */
export type WorldGenBatch = {
  id: string;
  name: string;
  group: string;
  stepIds: readonly string[];
};

/**
 * 功能注释：把勾选的编辑器模组折叠成大类批次；未归类的细项各自成批（兜底）。
 */
export function resolveWorldGenBatches(selectedStepIds: readonly string[]): WorldGenBatch[] {
  const want = new Set(
    selectedStepIds.map((id) => String(id || "").trim()).filter(Boolean),
  );
  const placed = new Set<string>();
  const out: WorldGenBatch[] = [];
  for (const cat of WORLD_GEN_BATCH_CATEGORIES) {
    const steps = cat.stepIds.filter((id) => want.has(id));
    if (!steps.length) continue;
    for (const id of steps) placed.add(id);
    out.push({
      id: cat.id,
      name: cat.name,
      group: cat.name,
      stepIds: steps,
    });
  }
  for (const id of want) {
    if (placed.has(id)) continue;
    const step = WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    out.push({
      id: `solo:${id}`,
      name: step?.name || id,
      group: step?.group || "",
      stepIds: [id],
    });
  }
  return out;
}

/** 功能注释：大类 id → 与勾选交集的细项；重试单行进度时用 */
export function stepIdsForWorldGenBatch(
  batchId: string,
  selectedStepIds: readonly string[] = [],
): string[] {
  const want = new Set(
    selectedStepIds.map((id) => String(id || "").trim()).filter(Boolean),
  );
  const id = String(batchId || "").trim();
  if (!id) return [];
  if (id.startsWith("solo:")) {
    const stepId = id.slice("solo:".length);
    if (!stepId) return [];
    if (want.size && !want.has(stepId)) return [];
    return [stepId];
  }
  const cat = WORLD_GEN_BATCH_CATEGORIES.find((c) => c.id === id);
  if (!cat) return [];
  const steps = cat.stepIds.filter((stepId) => (want.size ? want.has(stepId) : true));
  return [...steps];
}

/**
 * 功能注释：两次串联波次——第1次基础设定，第2次人物/地点/事件/结局；扩展大类落入末波且仍串行。
 */
export const WORLD_GEN_BATCH_WAVES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze([WORLD_GEN_PHASE1_BATCH_ID]),
  Object.freeze([WORLD_GEN_PHASE2_BATCH_ID]),
  Object.freeze(["opening", "contacts"]),
]);

/** @deprecated 细项波次仅兼容旧单测；正式管线走 partitionWorldGenBatchWaves */
export const WORLD_GEN_DEPENDENCY_WAVES: readonly (readonly string[])[] = Object.freeze([
  Object.freeze([
    "prompt",
    "hub:rules",
    "hub:book",
    "travelTime",
    "startResources",
    "creation",
    "hub:paths",
  ]),
  Object.freeze([
    "rooms",
    "npcs",
    "fixedEvents",
    "storylines",
  ]),
  Object.freeze(["opening", "contacts", "relations"]),
]);

/**
 * 功能注释：把大类按依赖波次分组；未列入的扩展大类落入末波。
 */
export function partitionWorldGenBatchWaves(batchIds: readonly string[]): string[][] {
  const want = new Set(batchIds);
  const waves: string[][] = [];
  const placed = new Set<string>();
  for (const wave of WORLD_GEN_BATCH_WAVES) {
    const batch = batchIds.filter((id) => want.has(id) && (wave as readonly string[]).includes(id));
    for (const id of batch) placed.add(id);
    if (batch.length) waves.push(batch);
  }
  const rest = batchIds.filter((id) => want.has(id) && !placed.has(id));
  if (rest.length) waves.push(rest);
  return waves;
}

/**
 * 功能注释：兼容旧「细项波次」调用；内部先折叠大类再展开细项顺序（同大类细项相邻，不再表示多次请求）。
 */
export function partitionWorldGenWaves(moduleIds: readonly string[]): string[][] {
  const batches = resolveWorldGenBatches(moduleIds);
  const batchWaves = partitionWorldGenBatchWaves(batches.map((b) => b.id));
  const byId = new Map(batches.map((b) => [b.id, b]));
  return batchWaves.map((wave) =>
    wave.flatMap((id) => [...(byId.get(id)?.stepIds ?? [])]),
  );
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
  "titles",
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
  titles: ["titles"],
  pregnancy: ["pregnancy"],
  phoneAppsCfg: ["phoneAppsCfg"],
};

/**
 * 功能注释：清洗 AI 补丁的共享字段规整（startMet / prompt / contacts 等），与细项或大类无关。
 */
function sanitizeWorldGenPatchShape(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
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
      // 功能注释：extraRules 承载作者「禁止生成」，AI 补丁不得覆盖
      if (k === "extraRules") continue;
      const s = asNonEmptyTrimmed(v);
      if (s) prompt[k] = s;
    }
    // 功能注释：统一写入 scriptTone；旧三字段并入后清掉，开局不要把设定原文留在 worldIntro
    const joined = readScriptTone(prompt);
    if (joined) {
      const capped = joined.length > SCRIPT_TONE_MAX ? joined.slice(0, SCRIPT_TONE_MAX) : joined;
      out.prompt = applyScriptTone(prompt, capped) as Record<string, string>;
    } else if (Object.keys(prompt).length) {
      out.prompt = prompt;
    } else {
      delete out.prompt;
    }
  }
  // 功能注释：开局日期统一成 YYYY.MM.DD；兼容 travel/calendar 嵌套与中文年月日
  {
    const withDate = normalizeWorldGenPatchStartDate(out);
    if (withDate.startDate) out.startDate = withDate.startDate;
    else delete out.startDate;
    if (withDate.travel) out.travel = withDate.travel;
  }
  // 功能注释：开场白须为对象；字符串/段落数组先收成 { paragraphs }，再剥 page/html
  if (typeof out.opening === "string") {
    const text = out.opening.trim();
    if (text) out.opening = { paragraphs: [text] };
    else delete out.opening;
  } else if (Array.isArray(out.opening)) {
    const paragraphs = (out.opening as unknown[]).map((p) => asTrimmedString(p)).filter(Boolean);
    if (paragraphs.length) out.opening = { paragraphs };
    else delete out.opening;
  }
  if (out.opening && typeof out.opening === "object" && !Array.isArray(out.opening)) {
    const raw = out.opening as Record<string, unknown>;
    const opening: Record<string, unknown> = {};
    for (const key of ["kicker", "title", "subtitle", "waiting", "cta"] as const) {
      const s = asNonEmptyTrimmed(raw[key]);
      if (s) opening[key] = s;
    }
    if (Array.isArray(raw.paragraphs)) {
      const paragraphs = raw.paragraphs.map((p) => asTrimmedString(p)).filter(Boolean);
      if (paragraphs.length) opening.paragraphs = paragraphs;
    }
    if (Object.keys(opening).length) out.opening = opening;
    else delete out.opening;
  }
  // 功能注释：玩法规则缺 branches / 写成单对象时收成数组，避免进编辑器保存被 validateMod 拦下
  if (Array.isArray(out.gameRules)) {
    out.gameRules = (out.gameRules as unknown[]).map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return row;
      const rule = { ...(row as Record<string, unknown>) };
      rule.branches = normalizeRuleBranches(rule.branches);
      return rule;
    });
  }
  // 功能注释：换地点扣点 / 日程叙事字数内置，AI 与旧模板不得再写给创作者配
  if (out.travel && typeof out.travel === "object" && !Array.isArray(out.travel)) {
    const travel = { ...(out.travel as Record<string, unknown>) };
    delete travel.advanceStory;
    delete travel.apPerMove;
    delete travel.advanceWords;
    out.travel = travel;
  }
  // 功能注释：新建作品引擎规则不要带进工作/违约块；AI 若写出 gigRules 一律剥掉，旧作手写数据不经此路径。
  if (out.tuning && typeof out.tuning === "object" && !Array.isArray(out.tuning)) {
    const tuning = { ...(out.tuning as Record<string, unknown>) };
    delete tuning.gigRules;
    out.tuning = Object.keys(tuning).length ? tuning : undefined;
    if (out.tuning === undefined) delete out.tuning;
  }
  // 功能注释：人脉页只按关系阶段分组；卡片数值已下线；AI / 旧模板夹带的组织分组不得写回。
  if (out.contacts && typeof out.contacts === "object" && !Array.isArray(out.contacts)) {
    const contacts = { ...(out.contacts as Record<string, unknown>) };
    delete contacts.groups;
    delete contacts.orgs;
    contacts.metrics = [];
    if (Array.isArray(contacts.stages)) {
      contacts.stages = contacts.stages.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) return row;
        const stage = { ...(row as Record<string, unknown>) };
        delete stage.groups;
        return stage;
      });
    }
    out.contacts = contacts;
  }
  // 功能注释：生成结果只保留 rooms；丢掉 locations[]，避免与 rooms 双份
  if ("locations" in out) delete out.locations;
  if (Array.isArray(out.npcs)) {
    const factionIds = new Set(
      (Array.isArray((out.creation as { startFactions?: { id?: string }[] } | undefined)?.startFactions)
        ? (out.creation as { startFactions: { id?: string }[] }).startFactions
        : Array.isArray(out.factions)
          ? (out.factions as { id?: string }[])
          : [])
        .map((f) => String(f?.id ?? "").trim())
        .filter(Boolean),
    );
    const roomEntries =
      out.rooms && typeof out.rooms === "object" && !Array.isArray(out.rooms)
        ? Object.entries(out.rooms as Record<string, { name?: string }>)
        : [];
    const roomIds = new Set(roomEntries.map(([id]) => id));
    const roomNameToId = new Map<string, string>(
      roomEntries
        .map(([id, r]): [string, string] => [String(r?.name || "").trim(), id])
        .filter(([name]) => !!name),
    );
    out.npcs = (out.npcs as unknown[])
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const n = { ...(row as Record<string, unknown>) };
        if ("name" in n) n.name = asTrimmedString(n.name);
        if (!asTrimmedString(n.name)) return null;
        if ("gender" in n) {
          const g = asNonEmptyTrimmed(n.gender);
          if (g) n.gender = g;
          else delete n.gender;
        }
        if ("bio" in n) n.bio = asTrimmedString(n.bio);
        if (!asTrimmedString(n.bio)) return null;
        if ("role" in n) n.role = asTrimmedString(n.role);
        if ("appearancePrompt" in n) {
          const ap = asTrimmedString(n.appearancePrompt);
          if (ap) n.appearancePrompt = ap;
          else delete n.appearancePrompt;
        }
        // 功能注释：home 必须是 rooms id；写成地名时按名对回 id
        const homeRaw = asTrimmedString(n.home);
        if (homeRaw) {
          if (roomIds.has(homeRaw)) n.home = homeRaw;
          else if (roomNameToId.has(homeRaw)) n.home = roomNameToId.get(homeRaw)!;
          // 对不上时保留原值，交给软校验/重试，禁止清空
        }
        const kind = asTrimmedString(n.kind);
        n.kind = kind === "roam" || kind === "fixed" ? kind : homeRaw ? "fixed" : "roam";
        delete n.summary;
        // 功能注释：势力 id 是否有效需对照第 1 次已写出的名单，交给 applyWorldGenCrossRefs；
        // 此处只在补丁自带名单时先行对账，避免第 2 次补丁因看不到名单而误删
        if (factionIds.size) {
          const fac = sanitizeNpcFactionId(n.factionId, factionIds);
          if (fac) n.factionId = fac;
          else delete n.factionId;
        }
        return n;
      })
      .filter(Boolean);
  }
  // 功能注释：建角数值属性先丢掉「未命名」空壳；条数收口交给 ensureWorldGenCustomAttrs（生成批）
  if ("customAttrs" in out) {
    const attrs = normalizeWorldGenCustomAttrs(out.customAttrs);
    if (attrs.length) out.customAttrs = attrs;
    else delete out.customAttrs;
  }
  if ("moneyLabel" in out) {
    const ml = asTrimmedString(out.moneyLabel);
    if (ml) out.moneyLabel = ml;
    else delete out.moneyLabel;
  }
  // 功能注释：剧情线只留一条主线且节点须有说明/条件；剥掉奖励与激活事件；丢掉 AI 写出的支线
  if ("storylines" in out || "sidelines" in out) {
    const plot = normalizeWorldGenStorylinesPatch(out);
    if (plot.storylines) out.storylines = plot.storylines;
    else delete out.storylines;
    delete out.sidelines;
  }
  // 功能注释：固定事件收成完整叙事条（有提示词+属性变化、无选项）；半成品与 events[] 库灌入丢掉
  if ("fixedEvents" in out || "events" in out) {
    const fixed = normalizeWorldGenFixedEventsPatch(out);
    if (fixed.fixedEvents) out.fixedEvents = fixed.fixedEvents;
    else delete out.fixedEvents;
    delete out.events;
    delete out.eventGroups;
  }
  return out;
}

/**
 * 功能注释：清洗 AI 补丁——基础模组禁止写入扩展玩法键；扩展模组也只能写本模组字段。
 * 重新生成基础内容时保留作者已安装组件与手动配置。
 */
export function sanitizeWorldGenAiPatch(
  stepId: string,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeWorldGenBatchPatch([stepId], patch);
}

/**
 * 功能注释：大类合并请求的补丁清洗——本批任一细项拥有的扩展键都保留，其它作者保护区仍剥离。
 */
/**
 * 功能注释：AI 偶发把「夜班房客」等身份写进 name；自愈成真名并把原串挪到 role，
 * 避免人物软校验失败连带整批地点/事件/剧情全部失败。
 */
export function healWorldGenNpcNamesInPatch(patch: Record<string, unknown>): Record<string, unknown> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return patch;
  if (!Array.isArray(patch.npcs) || !patch.npcs.length) return patch;
  const { npcs, healedCount } = healNpcListNames(patch.npcs);
  if (!healedCount) return patch;
  return { ...patch, npcs };
}

export function sanitizeWorldGenBatchPatch(
  stepIds: readonly string[],
  patch: Record<string, unknown>,
  /** 功能注释：第 1 次已落盘内容 + 故事设定；传入后第 2 次只能引用已有 id（属性/势力/世界书/人物/地点） */
  refCtx?: WorldGenRefContext,
): Record<string, unknown> {
  const ids = stepIds.map((id) => String(id || "").trim()).filter(Boolean);
  let shaped = sanitizeWorldGenPatchShape(patch);
  // 功能注释：人物批先自愈身份占位名，再走跨引用与软校验
  if (ids.includes("npcs")) {
    shaped = healWorldGenNpcNamesInPatch(shaped);
  }
  // 功能注释：跨批 id 契约（去 locations / 势力 / 人物 home 与关系 / 年龄日期 / 线路 / 世界书挂靠 / 事件与主线引用）
  const out = applyWorldGenCrossRefs(shaped, ids, refCtx);
  const allowed = new Set<string>();
  for (const id of ids) {
    for (const k of STEP_OWNED_PROTECTED[id] ?? []) allowed.add(k);
  }
  for (const k of WORLD_GEN_AUTHOR_PROTECTED_KEYS) {
    if (!allowed.has(k)) delete out[k];
  }
  // 功能注释：开局封面 / 手机应用配置 / 皮肤美化永不交 AI，即使模型顺带写出也整键丢掉
  for (const k of WORLD_GEN_NO_AI_CONTENT_KEYS) delete out[k];
  // 功能注释：C1 世界生成只产世界本体；玩法安装记录只能由作者在编辑器「添加玩法」写入，AI 补丁一律丢弃
  delete out.playModInstalls;
  // 功能注释：本批若全是基础模组，不得把娱乐圈扩展开关偷偷打开
  const allCore = ids.length > 0 && ids.every((id) => isWorldGenCoreStep(id));
  if (allCore && out.features && typeof out.features === "object" && !Array.isArray(out.features)) {
    const f = { ...(out.features as Record<string, unknown>) };
    for (const flag of ["industryTab", "career", "weeklyPaper", "imageCrisis", "pregnancy", "cars"] as const) {
      if (f[flag] === true) f[flag] = false;
    }
    out.features = f;
  }
  return out;
}

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };
/** 功能注释：单测可返回纯字符串；平台路径返回 text + 实扣分 */
export type WorldGenCompleteResult = string | PlatformWorldGenCompleteResult;
type CompleteFn = (
  cfg: AIConfig,
  messages: ChatMsg[],
  timeoutMs?: number,
) => Promise<WorldGenCompleteResult>;

/** 功能注释：统一 complete 返回形态，便于累计扣分与失败返还 */
export function normalizeWorldGenCompleteResult(raw: WorldGenCompleteResult): PlatformWorldGenCompleteResult {
  if (typeof raw === "string") {
    return { text: raw, pointsDeducted: 0 };
  }
  return {
    text: String(raw?.text || ""),
    pointsDeducted: Math.max(0, Math.floor(Number(raw?.pointsDeducted) || 0)),
    remainingPoints:
      raw?.remainingPoints == null
        ? undefined
        : Math.max(0, Math.floor(Number(raw.remainingPoints) || 0)),
  };
}

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

/** 功能注释：列表旁短原因（≤约 28 字）；完整说明留给 formatGenError */
export function shortGenError(e: unknown): string {
  const err = e as { name?: string; code?: string };
  if (err?.name === "AbortError") return "已取消";
  const { status, detail, message } = genErrorBlob(e);
  const blob = `${detail} ${message} ${err?.code || ""}`.toLowerCase();
  if (
    err instanceof SyntaxError ||
    /expected ['",}\]]|unexpected (?:token|end)|json at position|json.*line \d+ column|json 格式|未返回 json/i.test(
      `${message} ${detail}`,
    )
  ) {
    return "JSON 不完整";
  }
  if (/校验失败/.test(message)) return "字段校验未通过";
  if (status === 401 || /请先登录|not_logged_in/.test(blob)) return "请先登录";
  if (/insufficient_points|积分不足/.test(blob)) return "积分不足";
  if (status === 429) return "接口限流";
  if (status === 503 || /llm_unavailable|生成服务暂不可用/.test(blob)) return "服务暂不可用";
  if (status >= 500) return `服务端错误（${status}）`;
  if (status) return `请求失败（${status}）`;
  const m = String(message || detail || "生成失败").trim();
  return m.length > 28 ? `${m.slice(0, 28)}…` : m || "生成失败";
}

/** 功能注释：轻量错误文案（不依赖 aiError 参数属性，便于 Node strip-types 单测） */
export function formatGenError(e: unknown): string {
  const err = e as { name?: string; code?: string };
  if (err?.name === "AbortError") return "已取消";
  const { status, detail, message } = genErrorBlob(e);
  const blob = `${detail} ${message} ${err?.code || ""}`.toLowerCase();
  if (
    err instanceof SyntaxError ||
    /expected ['",}\]]|unexpected (?:token|end)|json at position|json.*line \d+ column/i.test(message)
  ) {
    // 功能注释：进度行只展示短因；完整句留给弹窗/日志
    return "JSON 不完整（已自动修复并重试）";
  }
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
  /** 功能注释：所属大类请求 id；同类细项共享，ETA 按大类计 */
  batchId?: string;
  /** 功能注释：进行中具体产出（如「正在写婚姻 / 姓氏 / 生育」），禁止只写「进行中」 */
  detail?: string;
  /** 功能注释：完成后可点开的结果摘要 */
  summary?: string;
};

export type WorldGenProgress = {
  /** 已进入生成队列的细项（仅勾选的；展示明细用） */
  modules: WorldGenModuleState[];
  /** 当前正在生成的下标（0-based）；全部结束为 -1 */
  currentIndex: number;
  /** 已成功细项数 */
  doneCount: number;
  /** 失败细项数 */
  failedCount: number;
  /** 细项队列总长 */
  total: number;
  /** 温和文案，如「正在写婚姻 / 姓氏 / 生育」 */
  label: string;
  cancelled: boolean;
  /** 功能注释：遇密钥/鉴权错误提前停批，后续未再请求 */
  stoppedByAuth?: boolean;
};

/**
 * 功能注释：按大类统计完成度，供预计耗时使用（细项进度条仍按勾选项计）。
 */
export function worldGenBatchProgressCounts(
  modules: ReadonlyArray<Pick<WorldGenModuleState, "id" | "batchId" | "status">>,
): { total: number; finished: number } {
  const byBatch = new Map<string, Array<"pending" | "running" | "done" | "failed">>();
  for (const m of modules) {
    const bid = String(m.batchId || m.id || "").trim();
    if (!bid) continue;
    const st = (m.status === "done" || m.status === "failed" || m.status === "running" || m.status === "pending"
      ? m.status
      : "pending") as "pending" | "running" | "done" | "failed";
    const list = byBatch.get(bid) ?? [];
    list.push(st);
    byBatch.set(bid, list);
  }
  let finished = 0;
  for (const list of byBatch.values()) {
    if (list.every((s) => s === "done" || s === "failed")) finished += 1;
  }
  return { total: byBatch.size, finished };
}

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

/** 功能注释：同一会话只硬刷一次，避免旧 CDN 死循环；与 WorldGenWizard / App ErrorBoundary 共用 */
export const STALE_CHUNK_RELOAD_KEY = "star:staleChunkReload";

/**
 * 功能注释：发版后旧 chunk 404 → 带 `_r` 硬刷新拉新入口。
 * @returns true 表示已发起刷新（调用方应挂起 Promise / 停止后续逻辑）
 */
export function reloadOnceForStaleChunk(error?: unknown): boolean {
  if (error != null && !isStaleChunkLoadErrorMessage(
    error instanceof Error ? error.message : error,
  )) {
    return false;
  }
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, "1");
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
    return true;
  } catch {
    return false;
  }
}

/**
 * 功能注释：动态 import 遇旧 hash 时自动硬刷；刷新中挂起 Promise，避免 React 把 404 抛成红屏。
 */
export function importWithStaleChunkReload<T>(loader: () => Promise<T>): Promise<T> {
  return loader().catch((err: unknown) => {
    if (reloadOnceForStaleChunk(err)) {
      return new Promise<T>(() => {
        /* 页面正在 replace，永不 resolve */
      });
    }
    throw err;
  });
}

/** 功能注释：进度里任一失败项是旧 chunk 404 */
export function progressHasStaleChunkFailure(p: WorldGenProgress | null | undefined): boolean {
  if (!p) return false;
  return p.modules.some((m) => m.status === "failed" && isStaleChunkLoadErrorMessage(m.error));
}

/** 功能注释：各编辑器模组对应的 content 字段提示，供 AI 只产出相关键，避免覆盖未勾选模组 */
const MODULE_FIELD_HINT: Record<string, string> = {
  "hub:rules": "worldRules[{id,name,options?}]、gameRules[{id,name,branches?}]：每条必须带稳定非空 id（小写英文/数字/-_），禁止只写文案不写 id",
  "hub:book": "worldBook[{id,title,keywords,content,enabled}]：第1次只写标题/关键词/正文，不要写 bindRooms/bindNpcs（挂靠在人物地点写出后再填）；条数见瘦身配额；正文宜短；剧本基调只写在同批 prompt.scriptTone，勿再写 worldIntro",
  "hub:paths": "creation.paths[]、identities[]：线路条数见配额；第1次生成写出线路骨架（线路只写 id/name/tag/blurb/about；hero 与 room 在第2次人物地点写出后回填，对不上人物的线路会被删；若设定有组织/势力，同批写 creation.startFactions[{id,name}] 作为唯一势力名单，设定没有组织就不要写势力名单；不要写 pathTitle、pathIntro、formTitle、formIntro、identityLabel、fixedAge、parentNote、seedDescription 或 paths[].formIntro；这些留空，建角页用游戏默认句）",
  travelTime: "startDate（必填，YYYY.MM.DD，须贴合本世界观时代，如现代都市 2019.09.01、民国 1935.03.12；禁止留空；缺日期时服务端会本地兜底）、travel（apPerTurn / advanceUnit / advanceDays；换地点扣点与日程叙事字数内置，勿写 apPerMove / advanceWords / advanceStory / play.ageAuto）",
  opening: "opening{kicker?,title?,subtitle?,paragraphs:[至少2段开场白],waiting?,cta?}：必须写 paragraphs（每段按瘦身配额，贴合本世界观；可用占位 {name}{school}{money}{parents}）；不要写 page/html 自定义开场页代码；title/waiting/cta 可简短",
  navTabs: "navTabs[]、navSize",
  phoneAppsCfg: "phoneAppsCfg[]",
  theme: "theme{}",
  bgm: "bgm[]（内嵌 data: / 本机 local: / 链接；不要把作品引用或平台曲写成 bgm）",
  audioRefs: "audioRefs[]（只写作品音频库已有 id，可空，勿编造）",
  platformAudioRefs: "platformAudioRefs[]（只写 platform: 前缀的平台曲目 id，可空，勿编造；不要写入 bgm 或 audioRefs）",
  avatars: "avatars{pools?,publicRandom?,match?}",
  creation: `customAttrs[]：建议约 2–4 条数值属性（参考 ${WORLD_GEN_CUSTOM_ATTRS_COUNT}），每条必有明确 label（禁止「未命名」/空名）、desc、id/min/max/init；条数可少可多，禁止为凑数补空壳；勿单独生成 fameTiers；不要预填空壳属性。creation.fields / creation.builtin（系统字段固定为姓名/性别/年龄/生日，只能改显示名；creation.fields 仅按作品明确需要生成）`,
  npcs: `npcs[{id,name,role,kind,home,roam,bio,appearancePrompt?,gender,age,tags?,relation?,metStart?,wxStart?,factionId?,pathId?}]：建议约 2–6 名（参考 ${WORLD_GEN_NPCS_COUNT}）；每名必须有名有姓的 name（如沈晚晴/林晚舟，禁止「夜班房客」「店员」「厨娘」等身份占位当姓名——身份写到 role 或 bio）、gender、age、bio；另写 appearancePrompt（形象提示词：性别年龄感/发型五官服装，不含关系剧情）；home 必须是同批 rooms 的 id（写成地名时按名对回 id，对不上整批重试，禁止清空 home）；设定里到处走动才标 roam 并列出可出现地点 id；factionId 只能填本作品势力名单 id，无组织则省略；pathId 填该人物对应的第1次线路 id（线路主角）；age 为单个整数且须与开局日期同一时代；设定无人物关系时不要写 metStart/wxStart；不要写 summary；不要写 works/代表作除非设定明确是演艺圈`,
  relations: "relations{confess?,wedding?,bridge?:{off?,perDay?},partnerPerks?}（须已添加关系玩法包；勿写介绍认识/三人同行/撮合/劝和/挑拨等 bridge.modes 预置）",
  contacts: "contacts{stages:[{id,label,min,tone?}]}（嵌人物上方；禁止写 metrics/卡片数值；禁止 groups/orgs/stage.groups）",
  startResources: "startMoney（非负数字）、moneyLabel（货币名称，如 元/灵石/星币，必填，开局页与局内文案共用）",
  trainings: "trainings[]",
  sideJobs: "sideJobs[]、weekendActs[]",
  income: "income[]、bills{}",
  gameRules: "gameRules[]",
  titles: "titles[{id,name,tier,req,desc}]（仅在已添加头衔玩法时生成；勿写 fameTiers）",
  endings: "endings[]、timeLimit、gradeDims（兼容旧草稿；经济规则改由养成 tuning 步骤生成）",
  tuning: "tuning{modules?,gradeOdds?,restStress?,jobPayMul?,trainFeeMul?,economy{bankrupt?,bankruptLine?,overdraftStress?,graceWeeks?,graceBillMul?}…}：只写本作品已勾玩法相关项；勿默认灌娱乐圈通告/违约/课程；禁止写 chargeItems / 扣费依据；作品没有账单也没有生活开销时不要写 economy；破产结束默认不开启（bankrupt 不写或 false）",
  startWeather: "weather",
  rooms: `rooms{id:{name,desc必填非空（进入后给玩家读的文字）,scenePrompt?（画面描述：空间陈设光线，与 desc 分开）,parent?,exits?,bg?,bgm?}}、startRoom：建议约 3–8 个地点（参考 ${WORLD_GEN_ROOMS_COUNT}）；只写 rooms/startRoom/exits，不要写 locations[]；startRoom 必须是 rooms 里的 id`,
  travel: "travel{}、cars[]",
  prompt: `prompt{scriptTone}（系统提示词写完整口吻/时代/铁律，硬上限 ${SCRIPT_TONE_MAX}，少于 80 字视为未写完；禁止「约 700 字」截短，禁止留空或只贴创作者原文）；并在同级 manifest.description 写约 100 字玩家可见简介`,
  lore: "worldBook[]（旧详细设定已并入世界书：title/content/keywords；挂靠见人物地点之后）",
  festivals: "worldBook[]（旧节日已并入世界书）",
  cover: "cover{}",
  fixedEvents: `fixedEvents[]：建议约 2–5 条完整叙事事件（参考 ${WORLD_GEN_FIXED_EVENTS_COUNT}）；每条必有 id/name/prompt（≥20字）/effects（至少1条；key 只能是本作品建角属性 id、人物关系或地点 id，建角里没有 fame 就不要写 fame）/trigger；可含 time/conds/nextIds/openingPrompt（是否作开局提示词）/choices（仅当需要玩家选择）；nextIds 只能指向本次事件 id；不要写 events[]；同批另写 opening{title?,paragraphs:[至少2段开局叙事]}（开场与固定事件都要生成）；条目变多时缩短每条正文，不要为凑数写空事件`,
  storylines: "storylines[]（仅 1 条主线，nodes 须有 name/desc，conds 只能用本作品属性/人物/地点 id；没有合法条件就留空重试该节点，禁止自动补名气条件、禁止 rewards）；可含 unlockIds 指向已写出的固定事件；endings[]、timeLimit、gradeDims；禁止写 sidelines（支线留给创作者手建）",
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
    // 功能注释：建角属性必须整表替换（含 AI 写成单对象时先收成数组）。按 id 合并会把旧「未命名」空壳留下来，且对象会让预览 ...(attrs) 炸 is not iterable。
    if (k === "customAttrs") {
      out[k] = asModArray(v);
      continue;
    }
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
  // 功能注释：分模组生成易出现 startRoom 与 rooms 不同步，合并后立即纠偏；空场景描述按地名补全
  healModRoomRefs(merged);
  ensureRoomSceneDescs(merged.rooms);
  // 功能注释：AI 常漏写 worldRules/gameRules 等条目 id；合并后立刻补编号，工坊/编辑器不再红字「缺少 id」
  healMissingContentIds(merged);
  return merged;
}

/**
 * 功能注释：修复模型常见的轻微 JSON 错误。除尾逗号外，仅在解析器明确报告
 * “数组元素 / 属性值后缺逗号”的位置插入逗号；不猜测截断内容，避免静默灌入半截事件。
 */
export function parseWorldGenJson(rawJson: string): Record<string, unknown> {
  let candidate = rawJson.replace(/,\s*([}\]])/g, "$1");
  for (let repairCount = 0; repairCount <= 8; repairCount += 1) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("AI 未返回 JSON 对象");
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (!(error instanceof SyntaxError) || repairCount >= 8) throw error;
      const message = String(error.message || "");
      const missingSeparator =
        /expected ',' or '\]' after array element/i.test(message) ||
        /expected ',' or '\}' after property value/i.test(message);
      const match = message.match(/position\s+(\d+)/i);
      if (!missingSeparator || !match) throw error;
      const position = Number(match[1]);
      if (!Number.isInteger(position) || position <= 0 || position >= candidate.length) throw error;
      candidate = `${candidate.slice(0, position)},${candidate.slice(position)}`;
    }
  }
  throw new SyntaxError("JSON 修复次数超限");
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
  return parseWorldGenJson(body.slice(start, end + 1));
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

/**
 * 功能注释：世界规则大类可顺带写 manifest.description（约 100 字摘要）；超限压成摘要，禁止原文长贴。
 */
export function extractManifestDescription(raw: string): string | undefined {
  try {
    const obj = parseJsonObject(raw);
    const mf = obj.manifest;
    if (!mf || typeof mf !== "object" || Array.isArray(mf)) return undefined;
    const d = asNonEmptyTrimmed((mf as { description?: unknown }).description);
    if (!d) return undefined;
    if (d.length <= MOD_DESC_MAX) {
      return d.length > WORLD_DESC_SUMMARY_TARGET + 40
        ? summarizeWorldGenDescription(d, "", WORLD_DESC_SUMMARY_TARGET)
        : d;
    }
    return summarizeWorldGenDescription(d, "", WORLD_DESC_SUMMARY_TARGET);
  } catch {
    return undefined;
  }
}

/**
 * 功能注释：已生成内容的上下文，供第 2 次读到第 1 次的 id。
 * 剧本基调必须完整带上（禁止截成 600 字摘要）；含建角属性 / 货币 / 世界书标题 / 势力 / 线路 / 开局日期。
 */
export function buildGeneratedContext(mod: Mod, max = 12000): string {
  const c = mod.content ?? {};
  const bits: string[] = [
    `作品名：${mod.name}`,
    mod.description ? `简介：${mod.description.slice(0, 200)}` : "",
  ];
  if (c.prompt && typeof c.prompt === "object") {
    const p = c.prompt as { scriptTone?: string; gmIntro?: string; worldIntro?: string; narratorPersona?: string };
    const tone = [p.scriptTone, p.gmIntro, p.worldIntro, p.narratorPersona].map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).join("\n\n");
    // 功能注释：第 2 次必须读完整剧本基调，不得截断或改成摘要
    if (tone) bits.push(`剧本基调：\n${tone}`);
  }
  const attrs = asModArray<{ id?: string; label?: string; name?: string; desc?: string }>(c.customAttrs);
  if (attrs.length) {
    bits.push(
      `建角属性：${attrs
        .map((a) => `${a.id}=${a.label || a.name || a.id}${a.desc ? `（${String(a.desc).slice(0, 40)}）` : ""}`)
        .join("、")}`,
    );
  } else {
    bits.push("建角属性：（无）");
  }
  const moneyLabel = typeof c.moneyLabel === "string" ? c.moneyLabel.trim() : "";
  if (moneyLabel) bits.push(`货币名 moneyLabel：${moneyLabel}`);
  if (typeof c.startMoney === "number") bits.push(`开局资金：${c.startMoney}`);
  const book = asModArray<{ id?: string; title?: string }>(c.worldBook);
  bits.push(
    book.length
      ? `世界书：${book.map((w) => `${w.id}=${w.title || w.id}`).join("、")}`
      : "世界书：（无）",
  );
  const factions = asModArray<{ id?: string; name?: string }>(
    c.factions ?? (c.creation as { startFactions?: unknown } | undefined)?.startFactions,
  );
  bits.push(
    factions.length
      ? `势力：${factions.map((f) => `${f.id}=${f.name || f.id}`).join("、")}`
      : "势力：无",
  );
  if (typeof c.startDate === "string" && c.startDate.trim()) {
    bits.push(`开局日期：${c.startDate.trim()}`);
  }
  if (Array.isArray(c.creation?.paths) && c.creation!.paths!.length) {
    bits.push(`人物线路：${c.creation!.paths!.map((p) => `${p.id}=${p.name}`).join("、")}`);
  } else {
    bits.push("人物线路：（无）");
  }
  if (c.rooms && typeof c.rooms === "object") {
    bits.push(`地点：${Object.entries(c.rooms as Record<string, { name?: string }>).map(([id, r]) => `${id}=${r?.name || id}`).join("、") || "（无）"}`);
  }
  if (typeof c.startRoom === "string" && c.startRoom.trim()) {
    bits.push(`开局地点 startRoom：${c.startRoom.trim()}`);
  }
  if (Array.isArray(c.npcs) && c.npcs.length) {
    bits.push(
      `人物：${(c.npcs as { id?: string; name?: string; role?: string; age?: number }[])
        .map((n) => `${n.id}=${n.name}${n.role ? `(${n.role})` : ""}${typeof n.age === "number" ? `/${n.age}岁` : ""}`)
        .join("、")}`,
    );
  }
  if (Array.isArray(c.storylines) && c.storylines.length) {
    bits.push(`主线：${(c.storylines as { id?: string; name?: string; title?: string }[]).map((s) => s.name || s.title || s.id).join("、")}`);
  }
  if (Array.isArray(c.sidelines) && c.sidelines.length) {
    bits.push(`支线：${(c.sidelines as { id?: string; name?: string }[]).map((s) => s.name || s.id).join("、")}`);
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
  return softValidateBatchPatch([step.id], patch);
}

/** 功能注释：大类补丁软校验——只拦空壳；硬校验留给编辑器保存（导出供单测） */
export function softValidateBatchPatch(
  stepIds: readonly string[],
  patch: Record<string, unknown>,
  /** 功能注释：传入第 1 次内容后，人物 home 可对照已有地点校验 */
  refCtx?: WorldGenRefContext,
): string | null {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return "补丁不是对象";
  if (!Object.keys(patch).length) return "补丁为空";
  const keys = Object.keys(patch);
  const ids = stepIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (
    keys.length === 1 &&
    keys[0] === "features" &&
    !ids.includes("features")
  ) {
    return "补丁与模组无关（仅 features）";
  }
  // 功能注释：人物条数只是建议；至少 1 名且每条有名字与可用正文，禁止空壳
  if (ids.includes("npcs")) {
    if (!Array.isArray(patch.npcs) || !patch.npcs.length) {
      return "人物至少 1 名（编辑器字段 npcs[]）";
    }
    for (const row of patch.npcs) {
      if (!row || typeof row !== "object" || Array.isArray(row)) return "人物条目格式错误";
      const n = row as Record<string, unknown>;
      const name = typeof n.name === "string" ? n.name.trim() : "";
      if (!name) return "人物缺少姓名";
      const badName = improperPersonNameReason(name);
      if (badName) return badName;
      const gender = typeof n.gender === "string" ? n.gender.trim() : "";
      if (!gender) return `人物「${name}」缺少性别`;
      if (typeof n.age !== "number" || !Number.isFinite(n.age)) return `人物「${name}」缺少年龄`;
      const bio = typeof n.bio === "string" ? n.bio.trim() : "";
      if (bio.length < 20) return `人物「${name}」小传过短（须写出贴合世界观的简介）`;
    }
  }
  // 功能注释：地点条数只是建议；至少 1 个且 name/desc 非空；只要 rooms，不要 locations[]
  if (ids.includes("rooms")) {
    const rooms = patch.rooms;
    if (!rooms || typeof rooms !== "object" || Array.isArray(rooms)) {
      return "缺少地点 rooms（编辑器字段）";
    }
    const entries = Object.entries(rooms as Record<string, unknown>);
    if (!entries.length) {
      return "地点至少 1 个（编辑器字段 rooms）";
    }
    for (const [roomId, raw] of entries) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return `地点「${roomId}」格式错误`;
      }
      const room = raw as Record<string, unknown>;
      const name = typeof room.name === "string" ? room.name.trim() : "";
      const desc = typeof room.desc === "string" ? room.desc.trim() : "";
      if (!name) return `地点「${roomId}」缺少 name`;
      if (!desc) return `地点「${name}」缺少 desc`;
    }
    const startRoom = typeof patch.startRoom === "string" ? patch.startRoom.trim() : "";
    if (startRoom && !(startRoom in (rooms as Record<string, unknown>))) {
      return `开局地点 startRoom「${startRoom}」不在 rooms 里`;
    }
  }
  // 功能注释：①基础剧本基调必须由 AI 写进 scriptTone，开局不得空着或只贴设定原文占位
  if (ids.includes("prompt")) {
    const tone = readScriptTone(
      patch.prompt && typeof patch.prompt === "object" && !Array.isArray(patch.prompt)
        ? (patch.prompt as { scriptTone?: string })
        : null,
    );
    if (!tone) return "缺少剧本基调 scriptTone";
    if (tone.length > SCRIPT_TONE_MAX) return `剧本基调超过 ${SCRIPT_TONE_MAX} 字`;
    if (tone.length < 80) return "剧本基调过短（须写出完整系统提示词）";
  }
  // 功能注释：时间与推进必须给出合法开局日期，发布清单与日历都依赖它
  if (ids.includes("travelTime")) {
    const sd = typeof patch.startDate === "string" ? patch.startDate.trim() : "";
    if (!START_DATE_RE.test(sd)) return "缺少开局日期 startDate（YYYY.MM.DD）";
  }
  // 功能注释：默认生成开场白正文；仅有标题/装饰不算完成（与 authorPreview.hasOpeningCopy 对齐）
  if (ids.includes("opening")) {
    const opening =
      patch.opening && typeof patch.opening === "object" && !Array.isArray(patch.opening)
        ? (patch.opening as { paragraphs?: unknown })
        : null;
    const paragraphs = Array.isArray(opening?.paragraphs)
      ? opening!.paragraphs.map((p) => String(p ?? "").trim()).filter(Boolean)
      : [];
    if (paragraphs.length < 2) return "开场白至少两段 paragraphs";
    const total = paragraphs.join("").length;
    if (total < 120) return "开场白过短";
  }
  // 功能注释：建角批至少 1 条有名称属性；建议 2–4，条数不硬卡
  if (ids.includes("creation")) {
    const attrs = normalizeWorldGenCustomAttrs(patch.customAttrs);
    if (!attrs.length) {
      return "建角属性至少 1 条有名称的数值属性";
    }
    if (attrs.some((a) => !asTrimmedString(a.desc))) {
      return "建角属性缺少属性说明 desc";
    }
  }
  // 功能注释：固定事件至少 1 条完整叙事；建议 2–5，半成品打回重试
  if (ids.includes("fixedEvents")) {
    const fixedErr = softValidateWorldGenFixedEvents(patch);
    if (fixedErr) return fixedErr;
  }
  // 功能注释：跨批 id 契约——home / startRoom 必须是 rooms id，条数只在超出宽松上限时失败
  return softValidateWorldGenCrossRefs(ids, patch, refCtx);
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
    const names = running.slice(0, 3).map((m) => m.detail || m.name).join("、");
    const more = running.length > 3 ? `等 ${running.length} 项` : "";
    // 功能注释：同批细项会一并标 running，但请求仍是串联两次，文案禁止再写「并行」
    return `串联生成中：${names}${more}（已完成 ${done}/${total}）`;
  }
  const cur = modules[currentIndex] || running[0];
  if (!cur) return `准备生成 0/${total}`;
  return `${cur.detail || `正在生成「${cur.name}」`}（${done + 1}/${total}）`;
}

/**
 * 功能注释：进度行按勾选细项展开，便于展示「正在写什么」；同类仍合并为一次大类请求（见 batchId）。
 */
export function makeInitialProgress(moduleIds: readonly string[]): WorldGenProgress {
  const want = [
    ...new Set(moduleIds.map((id) => String(id || "").trim()).filter(Boolean)),
  ];
  const batches = resolveWorldGenBatches(want);
  const batchIdByStep = new Map<string, string>();
  for (const b of batches) {
    for (const sid of b.stepIds) batchIdByStep.set(sid, b.id);
  }
  const knownOrder = WORLD_GEN_EDITOR_STEPS.map((s) => s.id);
  const ordered = [
    ...knownOrder.filter((id) => want.includes(id)),
    ...want.filter((id) => !knownOrder.includes(id)),
  ];
  const modules: WorldGenModuleState[] = ordered.map((id) => {
    const step = WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id);
    return {
      id,
      name: step?.name || id,
      group: step?.group || "",
      batchId: batchIdByStep.get(id) || `solo:${id}`,
      status: "pending" as const,
    };
  });
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

export type WorldGenBatchProgressEvent = {
  phase: "skeleton" | "enrich";
  detailByStep: Record<string, string>;
  namesByStep?: Record<string, string[]>;
};

export type GenerateBatchOpts = {
  batch: WorldGenBatch;
  draft: WorldGenDraft;
  mod: Mod;
  signal?: AbortSignal;
  completeFn?: CompleteFn;
  cfg?: AIConfig;
  /** 功能注释：本次勾选细项总数，用于全选瘦身配额 */
  selectedStepCount?: number;
  /** 功能注释：骨架/补文阶段回调，供进度行展示「正在写什么」 */
  onBatchProgress?: (ev: WorldGenBatchProgressEvent) => void;
};

/** 功能注释：真实调用一次 AI，生成单个模组补丁并合并；失败抛错，不写假数据 */
export async function generateOneWorldGenModule(opts: GenerateOneOpts): Promise<{ mod: Mod; patch: Record<string, unknown> }> {
  return generateWorldGenBatch({
    batch: {
      id: opts.step.id,
      name: opts.step.name,
      group: opts.step.group,
      stepIds: [opts.step.id],
    },
    draft: opts.draft,
    mod: opts.mod,
    signal: opts.signal,
    completeFn: opts.completeFn,
    cfg: opts.cfg,
  });
}

function buildWorldGenBatchMessages(opts: {
  batch: WorldGenBatch;
  draft: WorldGenDraft;
  mod: Mod;
  stepIds: readonly string[];
  steps: readonly WorldGenEditorStep[];
  phase: "skeleton" | "enrich";
  limits: WorldGenLeanLimits;
  skeletonPatch?: Record<string, unknown>;
}): ChatMsg[] {
  const { batch, draft, mod, stepIds, steps, phase, limits, skeletonPatch } = opts;
  const engineId = draft.engineId;
  const fieldLines = steps
    .map((s) => {
      const fields = MODULE_FIELD_HINT[s.id] || `与「${s.name}」相关的 content 字段（${s.desc}）`;
      return `- ${s.name}：${fields}`;
    })
    .join("\n");
  const stepNames = steps.map((s) => s.name).join("、");
  const ctx = buildGeneratedContext(mod);
  const polish = worldGenAiPolishPrompt(!!draft.aiPolish);
  const forbidLine = worldGenForbidPrompt(draft.forbidGen);
  const needPrompt = stepIds.includes("prompt");
  const leanBlock = worldGenLeanPromptBlock(limits, phase);
  const phaseTitle = phase === "skeleton" ? "骨架阶段" : "补长文阶段";
  const skeletonHint =
    phase === "enrich" && skeletonPatch
      ? `\n已有骨架（只在其上补长文，禁止大批新增条目）：\n${JSON.stringify(skeletonPatch).slice(0, 3500)}\n`
      : "";
  return [
    {
      role: "system",
      content: `你是文字模拟游戏的模组设计师。只输出一个 JSON 对象，不要解释、不要 Markdown 说明。
JSON 形如：{"content":{ ...本大类相关字段... }${needPrompt ? `,"manifest":{"description":"约${WORLD_DESC_SUMMARY_TARGET}字简介"}` : ""}}。
当前是「${phaseTitle}」：同类字段合并一次产出；数组条目必须带稳定 id（小写英文/数字/-_）；不要输出未要求的大段无关字段。
${engineStyleHint(engineId)}`,
    },
    {
      role: "user",
      content: `作品名称：${draft.title.trim()}
故事设定：${draft.setting.trim()}
创作引擎：${engineLabel(engineId)}（${engineId}）
${polish}
${forbidLine ? `${forbidLine}\n` : ""}
当前大类：「${batch.name}」
包含：${stepNames}
请在同一次回复里产出这些字段：
${fieldLines}
${skeletonHint}
已生成上下文（须与之一致，勿自相矛盾）：
${ctx || "（尚无其它模组）"}

${leanBlock}

要求：内容须能被编辑器继续手改；地点/人物 id 与上下文已有 id 对齐；不要编造无法访问的外链大图。
${needPrompt ? `本批必须：1) content.prompt.scriptTone 写完整系统提示词（硬上限 ${SCRIPT_TONE_MAX}，少于 80 字视为未写完；禁止「约 700 字」截短，禁止留空或只粘贴上方「故事设定」原文）；2) manifest.description 写约 ${WORLD_DESC_SUMMARY_TARGET} 字玩家可见简介。\n` : ""}${stepIds.includes("travelTime") ? `本批必须写 content.startDate，格式严格 YYYY.MM.DD（例 2024.03.15），按上方故事设定与已生成上下文的时代/人物年龄选取，禁止留空、禁止中文日期、禁止只写 travel 不写 startDate（缺日期时本地会兜底，但仍应尽量写出）。\n` : ""}${stepIds.includes("creation") ? `本批 customAttrs 建议约 2–4 条：每条有贴合本世界观的中文名称与 desc，禁止「未命名」或空壳凑数；少了或多了都可以。\n` : ""}${stepIds.includes("startResources") ? `本批必须写 content.startMoney（非负）与 content.moneyLabel（货币名，如 元/灵石），禁止只写金额不写货币名。\n` : ""}${stepIds.includes("fixedEvents") ? `本批 fixedEvents 建议约 2–5 条完整叙事事件：每条含 name、prompt（≥20字）、effects（key 只能用上方建角属性/人物关系/地点 id）；可含 openingPrompt（开局提示词勾选）；需要选择才写 choices；nextIds 只能指向本次事件 id；不要写 events[]。\n` : ""}${stepIds.includes("rooms") ? `本批 rooms 建议约 3–8 个地点：每条含 name 与非空 desc；写 startRoom（须为 rooms 内 id）；只写 rooms，不要写 locations[]。\n` : ""}${stepIds.includes("npcs") ? `${platformNpcTagsPromptLine()}\n本批 npcs 建议约 2–6 名；每条必须含有名有姓的 name、gender、age、bio、appearancePrompt；home 必须是同批 rooms id；设定无组织则不要写 factionId；设定无人物关系则不要写 metStart/wxStart。` : ""}${stepIds.includes("storylines") ? `\n本批须写 1 条主线 storylines[]（节点含 name/desc；conds 只用本作品属性/人物/地点，禁止自动补名气）与 endings[]；禁止写 sidelines。\n` : ""}${stepIds.includes("npcs") || stepIds.includes("rooms") ? `\n世界书挂靠：人物与地点写出后，可另写 worldBook:[{id,bindRooms,bindNpcs}]（id 取上方「世界书」已有 id；bindRooms/bindNpcs 只能填本批 rooms/npcs 的 id，对不上的会被删除；不写则按名称自动回填）。\n事件效果与主线条件的属性 key 只能来自上方「建角属性」id，人物/地点只能用本批 id；上方「势力：无」时不要写势力；设定没有好感恋爱时不要写 rel 效果。\n` : ""}`,
    },
  ];
}

function detailMapForPhase(
  stepIds: readonly string[],
  phase: "skeleton" | "enrich",
  patch?: Record<string, unknown>,
): { detailByStep: Record<string, string>; namesByStep: Record<string, string[]> } {
  const detailByStep: Record<string, string> = {};
  const namesByStep: Record<string, string[]> = {};
  for (const id of stepIds) {
    const names = patch ? worldGenStepNamesFromPatch(id, patch) : [];
    if (names.length) namesByStep[id] = names;
    detailByStep[id] = worldGenStepRunningDetail(id, { phase, names });
  }
  return { detailByStep, namesByStep };
}

/**
 * 功能注释：大类一次请求；两次串联核心大类只打一枪完整产出（禁止再拆骨架+补文变成多请求）；
 * 扩展小批仍可骨架→补文。请求/响应对产品调试打控制台日志。
 */
export async function generateWorldGenBatch(opts: GenerateBatchOpts): Promise<{ mod: Mod; patch: Record<string, unknown> }> {
  const cfg = await resolveCfg(opts.cfg);
  if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");

  const stepIds = opts.batch.stepIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (!stepIds.length) throw new Error("大类未包含模组");
  const steps = stepIds
    .map((id) => WORLD_GEN_EDITOR_STEPS.find((s) => s.id === id))
    .filter((s): s is WorldGenEditorStep => !!s);
  if (!steps.length) throw new Error("未知模组");

  const selectedCount = Math.max(
    stepIds.length,
    Math.floor(opts.selectedStepCount ?? opts.draft.editorStepIds?.length ?? stepIds.length),
  );
  const limits = worldGenLeanLimits(selectedCount);
  // 功能注释：两次串联核心批禁止再拆补文枪，保证整流程只有两次大请求
  const doEnrich =
    !isWorldGenTwoPhaseBatch(opts.batch.id)
    && limits.enrich
    && worldGenBatchNeedsEnrich(stepIds);

  let completeFn = opts.completeFn;
  /** 功能注释：仅平台默认路径在最终失败时走返还；单测注入的 completeFn 不打 refund */
  const usedPlatformComplete = !completeFn;
  const makeComplete = (maxTokens: number): CompleteFn => {
    if (opts.completeFn) return opts.completeFn;
    return async (_c, messages, timeoutMs) =>
      completeViaPlatform(messages, {
        engineId: opts.draft.engineId,
        moduleId: opts.batch.id,
        timeoutMs,
        signal: opts.signal,
        max_tokens: maxTokens,
      });
  };
  if (!completeFn) completeFn = makeComplete(Math.min(6000, worldGenBatchMaxTokens(stepIds)));

  const engineId = opts.draft.engineId;
  const needPrompt = stepIds.includes("prompt");
  // 功能注释：第 2 次必须对照第 1 次已落盘 id（属性/势力/世界书/人物/地点）与故事设定清洗补丁
  const refCtxFor = (m: Mod): WorldGenRefContext => ({
    content: (m.content ?? {}) as Record<string, unknown>,
    settingText: `${opts.draft.title ?? ""}\n${opts.draft.setting ?? ""}`,
  });

  const runPhase = async (
    phase: "skeleton" | "enrich",
    baseMod: Mod,
    skeletonPatch?: Record<string, unknown>,
  ): Promise<{ mod: Mod; patch: Record<string, unknown>; rawText: string; points: number }> => {
    const messages = buildWorldGenBatchMessages({
      batch: opts.batch,
      draft: opts.draft,
      mod: baseMod,
      stepIds,
      steps,
      // 功能注释：两次串联核心批用完整阶段文案，避免模型按「骨架可空」少写假完成
      phase: isWorldGenTwoPhaseBatch(opts.batch.id) ? "enrich" : phase,
      limits,
      skeletonPatch,
    });
    // 功能注释：两次串联与固定事件大包给足 token，避免截断成半成品假完成
    const maxTokens = Math.min(
      16000,
      isWorldGenTwoPhaseBatch(opts.batch.id)
        ? worldGenBatchMaxTokens(stepIds)
        : phase === "skeleton"
          ? Math.min(stepIds.includes("fixedEvents") ? 8000 : 5000, worldGenBatchMaxTokens(stepIds))
          : Math.min(stepIds.includes("fixedEvents") ? 8000 : 7000, worldGenBatchMaxTokens(stepIds)),
    );
    const fn = makeComplete(maxTokens);
    let points = 0;
    const out = await withWorldGenRetries(async () => {
      // 功能注释：产品调试——请求与生成内容打到控制台（含 messages / 原文）
      console.log("[world-gen] request", {
        batchId: opts.batch.id,
        batchName: opts.batch.name,
        phase,
        stepIds,
        maxTokens,
        messages,
      });
      const { text, pointsDeducted } = normalizeWorldGenCompleteResult(
        await fn(cfg, messages, 180_000),
      );
      points += pointsDeducted;
      if (opts.signal?.aborted) throw new DOMException("已取消", "AbortError");
      if (!String(text || "").trim()) throw new Error("AI 返回空内容");

      const rawText = String(text);
      console.log("[world-gen] response", {
        batchId: opts.batch.id,
        batchName: opts.batch.name,
        phase,
        stepIds,
        text: rawText,
      });
      const rawPatch = extractContentPatch(rawText);
      let patch = sanitizeWorldGenBatchPatch(stepIds, rawPatch, refCtxFor(baseMod));
      // 功能注释：时间与推进漏写 startDate 时按题材/已有人物年龄补全，避免「缺少开局日期」整项失败
      if (stepIds.includes("travelTime")) {
        patch = ensureWorldGenTravelTimeStartDate(patch, opts.draft, baseMod);
      }
      // 功能注释：开局资金漏写货币名时按题材补全，避免行上只显示「货币」
      if (stepIds.includes("startResources") || stepIds.includes("creation")) {
        patch = ensureWorldGenStartMoney(patch, opts.draft);
      }
      // 功能注释：建角批收口为正好 3 条有名属性；空壳/未命名丢掉后按题材补齐，不留给编辑器
      if (stepIds.includes("creation")) {
        patch = ensureWorldGenCustomAttrs(patch, opts.draft);
      }
      const soft = softValidateBatchPatch(stepIds, patch, refCtxFor(baseMod));
      if (soft) throw new Error(soft);

      const descFromAi = needPrompt ? extractManifestDescription(rawText) : undefined;
      const next: Mod = {
        ...baseMod,
        ...(descFromAi ? { description: descFromAi } : {}),
        content: applyWorldGenForbidToContent(
          mergeModContent(baseMod.content, patch),
          opts.draft.forbidGen,
        ),
      };
      const fatal = softValidateModSkeleton(next);
      if (fatal.length) throw new Error(`校验失败：${fatal.join("；")}`);
      return { mod: next, patch, rawText };
    }, { signal: opts.signal, maxRetries: WORLD_GEN_MODULE_MAX_RETRIES });
    return { ...out, points };
  };

  let chargedPoints = 0;
  try {
    opts.onBatchProgress?.({
      phase: "skeleton",
      ...detailMapForPhase(stepIds, "skeleton"),
    });
    const skeleton = await runPhase("skeleton", opts.mod);
    chargedPoints += skeleton.points;
    opts.onBatchProgress?.({
      phase: "skeleton",
      ...detailMapForPhase(stepIds, "skeleton", skeleton.patch),
    });

    if (!doEnrich) {
      return { mod: skeleton.mod, patch: skeleton.patch };
    }

    opts.onBatchProgress?.({
      phase: "enrich",
      ...detailMapForPhase(stepIds, "enrich", skeleton.patch),
    });
    try {
      const enriched = await runPhase("enrich", skeleton.mod, skeleton.patch);
      chargedPoints += enriched.points;
      // 功能注释：补文补丁叠在骨架上，保证摘要能看到名称 + 长文；时间与推进仍须保住 startDate
      let patch = sanitizeWorldGenBatchPatch(
        stepIds,
        mergeModContent(
          skeleton.patch as ModContent,
          enriched.patch,
        ) as unknown as Record<string, unknown>,
        refCtxFor(skeleton.mod),
      );
      if (stepIds.includes("travelTime")) {
        patch = ensureWorldGenTravelTimeStartDate(patch, opts.draft, skeleton.mod);
      }
      if (stepIds.includes("startResources") || stepIds.includes("creation")) {
        patch = ensureWorldGenStartMoney(patch, opts.draft);
      }
      if (stepIds.includes("creation")) {
        patch = ensureWorldGenCustomAttrs(patch, opts.draft);
      }
      opts.onBatchProgress?.({
        phase: "enrich",
        ...detailMapForPhase(stepIds, "enrich", patch),
      });
      return { mod: enriched.mod, patch };
    } catch (enrichErr) {
      // 功能注释：补文失败仍保留骨架，避免全选时长文拖垮已出结果
      if ((enrichErr as { name?: string })?.name === "AbortError" || opts.signal?.aborted) throw enrichErr;
      if (isFatalAuthGenError(enrichErr)) throw enrichErr;
      return { mod: skeleton.mod, patch: skeleton.patch };
    }
  } catch (e) {
    if (usedPlatformComplete && chargedPoints > 0) {
      await refundWorldGenPointsViaPlatform({
        engineId,
        moduleId: opts.batch.id,
        points: chargedPoints,
        reason: "module_failed_after_charge",
        signal: opts.signal,
      });
    }
    throw e;
  }
}

/**
 * 功能注释：每批合并后把作者「禁止生成」写回 prompt.extraRules，避免被其它字段浅合并冲掉。
 */
export function applyWorldGenForbidToContent(
  content: ModContent,
  forbidGen: string | null | undefined,
): ModContent {
  const block = formatWorldGenForbidBlock(forbidGen);
  if (!block) return content;
  const prompt = { ...(content.prompt ?? {}), extraRules: block };
  return { ...content, prompt };
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
 * 功能注释：生成结束（含取消/鉴权停批）后写入开局日期与资金默认，预览清单不再拦这三项相关字段。
 */
export function finalizeWorldGenModDefaults(mod: Mod, draft: WorldGenDraft): Mod {
  let content = ensureWorldGenStartMoney({ ...(mod.content as Record<string, unknown>) }, draft);
  // 功能注释：仅当稿里已有建角属性（含空壳）时收口为 3 条有名；未跑建角批不硬塞
  if ("customAttrs" in content) {
    content = ensureWorldGenCustomAttrs(content, draft);
  }
  const withDate = ensureWorldGenTravelTimeStartDate(content, draft, mod);
  return { ...mod, content: withDate as Mod["content"] };
}

/**
 * 功能注释：按两次串联波次生成（PARALLEL=1）；第1次基础设定 → 第2次人物地点事件结局。
 * 进度行是勾选细项；同一大类只打一次请求。鉴权失败停整批；取消保留已完成。
 */
export async function runWorldGenModules(opts: RunWorldGenOpts): Promise<WorldGenRunResult> {
  const cfg = await resolveCfg(opts.cfg);

  const batches = resolveWorldGenBatches(opts.moduleIds);
  const batchById = new Map(batches.map((b) => [b.id, b]));
  const progress = makeInitialProgress(opts.moduleIds);
  let mod = opts.seedMod;
  let stoppedByAuth = false;
  const done = new Set(opts.doneIds ?? []);
  const rowById = new Map(progress.modules.map((m) => [m.id, m]));
  const selectedStepCount = progress.modules.length;

  const finish = (cancelled = false) => {
    mod = finalizeWorldGenModDefaults(mod, opts.draft);
    const runningIdx = progress.modules.findIndex((m) => m.status === "running");
    const idx = runningIdx >= 0 ? runningIdx : -1;
    const p = snapshotProgress(progress.modules, idx, cancelled, stoppedByAuth);
    opts.onProgress?.(p);
    return { mod, progress: p, cancelled };
  };

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
      row.detail = undefined;
    }
  };

  const stepsOfBatch = (batchId: string) => {
    const batch = batchById.get(batchId);
    return batch ? [...batch.stepIds] : progress.modules.filter((m) => m.batchId === batchId).map((m) => m.id);
  };

  if (!progress.modules.length) {
    return finish(false);
  }

  // 功能注释：已成功的细项先标 done，再按大类波次跑剩余
  for (const row of progress.modules) {
    if (done.has(row.id)) {
      row.status = "done";
      row.detail = undefined;
    }
  }
  emit();

  const waves = partitionWorldGenBatchWaves(batches.map((b) => b.id));

  for (const waveBatchIds of waves) {
    if (opts.signal?.aborted) {
      return finish(true);
    }
    if (stoppedByAuth) break;

    const waveBatches = waveBatchIds
      .map((id) => batchById.get(id)!)
      .filter((batch) => {
        if (!batch) return false;
        return batch.stepIds.some((sid) => {
          const row = rowById.get(sid);
          return row && row.status !== "done" && !done.has(sid);
        });
      });
    if (!waveBatches.length) continue;

    for (const batch of waveBatches) {
      for (const sid of batch.stepIds) {
        const row = rowById.get(sid);
        if (!row || row.status === "done" || done.has(sid)) continue;
        row.status = "running";
        row.error = undefined;
        row.summary = undefined;
        row.detail = worldGenStepRunningDetail(sid, { phase: "skeleton" });
      }
    }
    emit();

    const snapshotMod = mod;
    type OneResult =
      | { id: string; ok: true; patch: Record<string, unknown> }
      | { id: string; ok: false; error: unknown; aborted?: boolean };

    const results = await mapPool(waveBatches, WORLD_GEN_PARALLEL_LIMIT, async (batch): Promise<OneResult> => {
      if (opts.signal?.aborted || stoppedByAuth) {
        return { id: batch.id, ok: false, error: new DOMException("已取消", "AbortError"), aborted: true };
      }
      try {
        const r = await generateWorldGenBatch({
          batch,
          draft: opts.draft,
          mod: snapshotMod,
          signal: opts.signal,
          completeFn: opts.completeFn,
          cfg,
          selectedStepCount,
          onBatchProgress: (ev) => {
            for (const sid of batch.stepIds) {
              const row = rowById.get(sid);
              if (!row || row.status !== "running") continue;
              row.detail =
                ev.detailByStep[sid] ||
                worldGenStepRunningDetail(sid, {
                  phase: ev.phase,
                  names: ev.namesByStep?.[sid],
                });
            }
            emit();
          },
        });
        return { id: batch.id, ok: true, patch: r.patch };
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError" || opts.signal?.aborted) {
          return { id: batch.id, ok: false, error: e, aborted: true };
        }
        return { id: batch.id, ok: false, error: e };
      }
    });

    if (opts.signal?.aborted || results.some((r) => !r.ok && r.aborted && !stoppedByAuth)) {
      for (const batch of waveBatches) {
        for (const sid of batch.stepIds) {
          const row = rowById.get(sid);
          if (row?.status === "running") {
            row.status = "pending";
            row.detail = undefined;
          }
        }
      }
      return finish(true);
    }

    for (const r of results) {
      if (r.ok) continue;
      const err = shortGenError(r.error);
      for (const sid of stepsOfBatch(r.id)) {
        const row = rowById.get(sid);
        if (!row || row.status === "done") continue;
        row.status = "failed";
        row.error = err;
        row.detail = undefined;
      }
      if (isFatalAuthGenError(r.error)) stoppedByAuth = true;
    }
    if (stoppedByAuth) {
      const authMsg =
        progress.modules.map((b) => b.error).find((e) => e && /登录|积分|密钥|API Key/i.test(e)) ||
        "请先登录平台账号后再生成世界。";
      failRest(authMsg);
      return finish(false);
    }

    for (const r of results) {
      if (!r.ok) continue;
      mod = {
        ...mod,
        content: mergeModContent(mod.content, r.patch),
      };
      for (const sid of stepsOfBatch(r.id)) {
        const row = rowById.get(sid);
        if (!row) continue;
        row.status = "done";
        row.error = undefined;
        row.detail = undefined;
        row.summary = worldGenStepResultSummary(sid, r.patch);
        done.add(sid);
      }
    }
    emit();
  }

  return finish(false);
}

/** 功能注释：只重试失败细项；成功项绝不重跑。进度 id 已是细项 id。 */
export async function retryFailedWorldGenModules(opts: RunWorldGenOpts & {
  previous: WorldGenProgress;
}): Promise<WorldGenRunResult> {
  const failedIds = opts.previous.modules.filter((m) => m.status === "failed").map((m) => m.id);
  const doneIds = new Set(opts.previous.modules.filter((m) => m.status === "done").map((m) => m.id));
  return runWorldGenModules({
    ...opts,
    moduleIds: failedIds.length ? failedIds : opts.moduleIds,
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

export async function retryOneWorldGenModule(opts: RunWorldGenOpts & {
  previous: WorldGenProgress;
  moduleId: string;
}): Promise<WorldGenRunResult> {
  const doneIds = new Set(opts.previous.modules.filter((m) => m.status === "done").map((m) => m.id));
  doneIds.delete(opts.moduleId);
  // 功能注释：若传入大类 id（兼容旧调用），展开为细项；否则按细项重试
  const selected = opts.draft.editorStepIds?.length ? opts.draft.editorStepIds : opts.moduleIds;
  const asBatch = stepIdsForWorldGenBatch(opts.moduleId, selected);
  const stepIds = asBatch.length && (WORLD_GEN_BATCH_CATEGORIES.some((c) => c.id === opts.moduleId) || opts.moduleId.startsWith("solo:"))
    ? asBatch
    : [opts.moduleId];
  // 功能注释：同批其它细项若已成功则保留；重试时把同批失败项一并重跑更稳
  const batchId = opts.previous.modules.find((m) => m.id === opts.moduleId)?.batchId;
  const retryIds = batchId
    ? opts.previous.modules.filter((m) => m.batchId === batchId && m.status !== "done").map((m) => m.id)
    : stepIds;
  for (const id of retryIds) doneIds.delete(id);
  return runWorldGenModules({
    ...opts,
    moduleIds: retryIds.length ? retryIds : stepIds,
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
