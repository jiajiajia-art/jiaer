/**
 * 生成世界 · 进度明细与瘦身配额。
 * 创作者侧要看到「正在写什么 / 生成了什么」，而不是只显示「进行中」。
 * 全选多项时用精简条数 + 短正文，禁止项项打满长文。
 */
import type { ModContent } from "../mods/types.ts";
import { WORLD_GEN_EDITOR_STEPS } from "./worldGenWizard.ts";
import { WORLD_GEN_FIXED_EVENTS_COUNT } from "./worldGenFixedEvents.ts";
import { readScriptTone } from "./scriptTone.ts";
import { SCRIPT_TONE_MAX, SCRIPT_TONE_TARGET_MIN, SCRIPT_TONE_TARGET_MAX } from "./modBasicInfoLimits.ts";


/** 功能注释：人物建议条数中位（仅提示用，不再硬卡正好 N 条）。 */
export const WORLD_GEN_NPCS_COUNT = 4;
/** 功能注释：人物建议范围约 2–6；少/多都不整批失败，也不补空条目。 */
export const WORLD_GEN_NPCS_SUGGEST_MIN = 2;
export const WORLD_GEN_NPCS_SUGGEST_MAX = 6;

/** 功能注释：地点建议条数中位（仅提示用）。 */
export const WORLD_GEN_ROOMS_COUNT = 5;
/** 功能注释：地点建议范围约 3–8。 */
export const WORLD_GEN_ROOMS_SUGGEST_MIN = 3;
export const WORLD_GEN_ROOMS_SUGGEST_MAX = 8;

/** 功能注释：勾选达到该数即进入「全选瘦身」——正文更短；人物/地点/固定事件条数仍按硬配额。 */
export const WORLD_GEN_LEAN_STEP_THRESHOLD = 8;

/** 功能注释：各细项进行中时展示的产出面；多面用「 / 」拼接，避免只写「进行中」。 */
export const WORLD_GEN_STEP_FACETS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  prompt: Object.freeze(["叙事口吻", "世界铁律", "系统提示骨架"]),
  "hub:rules": Object.freeze(["婚姻", "姓氏", "生育", "社会秩序"]),
  "hub:book": Object.freeze(["条目名", "关键词", "挂靠"]),
  "hub:paths": Object.freeze(["线路名", "解锁提示", "开局地点"]),
  travelTime: Object.freeze(["开局日期", "行动点", "推进单位"]),
  creation: Object.freeze(["建角字段", "数值属性"]),
  startResources: Object.freeze(["开局资金"]),
  rooms: Object.freeze(["地点名", "出口", "开局点"]),
  npcs: Object.freeze(["姓名", "身份", "关系"]),
  relations: Object.freeze(["表白门槛", "婚礼", "伴侣加成"]),
  contacts: Object.freeze(["关系档位"]),
  fixedEvents: Object.freeze(["事件名", "提示词", "开局提示词", "开场白", "属性变化"]),
  storylines: Object.freeze(["主线", "结局标题"]),
  opening: Object.freeze(["开场白段落", "标题"]),
  trainings: Object.freeze(["课程名", "学费"]),
  sideJobs: Object.freeze(["打工", "周末活动"]),
  income: Object.freeze(["账单", "周期收入"]),
  gameRules: Object.freeze(["玩法规则"]),
  tuning: Object.freeze(["引擎规则", "经济"]),
  lookRules: Object.freeze(["剧情美化条件"]),
  navTabs: Object.freeze(["底栏页签"]),
  bgm: Object.freeze(["音乐条目"]),
  avatars: Object.freeze(["头像池规则"]),
});

/** 功能注释：单批请求的条数 / 文长上限；全选时更严，少选时略宽但仍禁止灌满。 */
export type WorldGenLeanLimits = {
  worldBookEntries: number;
  npcs: number;
  paths: number;
  rooms: number;
  fixedEvents: number;
  storylines: number;
  sidelines: number;
  endings: number;
  /** 人物小传目标字数 */
  npcBioChars: number;
  /** 世界书正文目标字数 */
  worldBookBodyChars: number;
  /** 开场白每段目标字数 */
  openingParaChars: number;
  /** 是否再打一枪补长文（仅关键字段） */
  enrich: boolean;
};

/**
 * 功能注释：按本次勾选细项数决定瘦身配额。全选（≥阈值）禁止项项打满长文。
 */
export function worldGenLeanLimits(selectedStepCount: number): WorldGenLeanLimits {
  const lean = Math.max(0, Math.floor(selectedStepCount) || 0) >= WORLD_GEN_LEAN_STEP_THRESHOLD;
  if (lean) {
    return {
      worldBookEntries: 3,
      // 功能注释：条数只是建议；瘦身只压每条正文，不裁成固定条数、不补空壳
      npcs: WORLD_GEN_NPCS_COUNT,
      paths: 2,
      rooms: WORLD_GEN_ROOMS_COUNT,
      fixedEvents: WORLD_GEN_FIXED_EVENTS_COUNT,
      storylines: 1,
      sidelines: 0,
      endings: 2,
      npcBioChars: 120,
      worldBookBodyChars: 80,
      openingParaChars: 90,
      enrich: true,
    };
  }
  return {
    worldBookEntries: 4,
    npcs: WORLD_GEN_NPCS_COUNT,
    paths: 3,
    rooms: WORLD_GEN_ROOMS_COUNT,
    fixedEvents: WORLD_GEN_FIXED_EVENTS_COUNT,
    storylines: 1,
    sidelines: 0,
    endings: 3,
    npcBioChars: 160,
    worldBookBodyChars: 120,
    openingParaChars: 110,
    enrich: true,
  };
}

/** 功能注释：该大类是否需要第二阶段补长文（仅含长文细项时才打，避免无意义双请求）。 */
export function worldGenBatchNeedsEnrich(stepIds: readonly string[]): boolean {
  const need = new Set(["prompt", "npcs", "hub:book", "opening", "storylines", "fixedEvents", "hub:paths"]);
  return stepIds.some((id) => need.has(String(id || "").trim()));
}

function stepLabel(stepId: string): string {
  return WORLD_GEN_EDITOR_STEPS.find((s) => s.id === stepId)?.name || stepId;
}

/**
 * 功能注释：进行中文案。有具体名称时优先展示（世界书条目名 / 线路名 / 人名）；
 * 否则用面相列表，例如「正在写婚姻 / 姓氏 / 生育」。
 */
export function worldGenStepRunningDetail(
  stepId: string,
  opts?: { names?: readonly string[]; phase?: "skeleton" | "enrich" },
): string {
  const id = String(stepId || "").trim();
  const names = (opts?.names ?? []).map((n) => String(n || "").trim()).filter(Boolean);
  const phase = opts?.phase ?? "skeleton";
  if (names.length) {
    const shown = names.slice(0, 4).join("、");
    const more = names.length > 4 ? `等 ${names.length} 项` : "";
    if (id === "hub:book") {
      return phase === "enrich" ? `正在补条目正文：${shown}${more}` : `正在写条目：${shown}${more}`;
    }
    if (id === "hub:paths") {
      return phase === "enrich" ? `正在补线路细节：${shown}${more}` : `正在写线路：${shown}${more}`;
    }
    if (id === "npcs") {
      return phase === "enrich" ? `正在补小传：${shown}${more}` : `正在写人物：${shown}${more}`;
    }
    if (id === "rooms") return `正在写地点：${shown}${more}`;
    if (id === "fixedEvents") return `正在写事件：${shown}${more}`;
    if (id === "storylines") return `正在写剧情：${shown}${more}`;
    return `正在写：${shown}${more}`;
  }
  const facets = WORLD_GEN_STEP_FACETS[id];
  if (facets?.length) {
    if (phase === "enrich") return `正在补长文：${facets.slice(0, 3).join(" / ")}`;
    return `正在写${facets.join(" / ")}`;
  }
  return phase === "enrich" ? `正在补全「${stepLabel(id)}」` : `正在生成「${stepLabel(id)}」`;
}

function listNames(rows: unknown, keys: readonly string[], cap = 6): string[] {
  if (!Array.isArray(rows)) return [];
  const out: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) {
        out.push(v.trim());
        break;
      }
    }
    if (out.length >= cap) break;
  }
  return out;
}

/** 功能注释：从补丁抽出细项相关名称，供进行中文案与摘要复用。 */
export function worldGenStepNamesFromPatch(
  stepId: string,
  patch: Record<string, unknown> | null | undefined,
): string[] {
  if (!patch || typeof patch !== "object") return [];
  const id = String(stepId || "").trim();
  if (id === "hub:book" || id === "lore" || id === "festivals") {
    return listNames(patch.worldBook, ["title", "name", "id"]);
  }
  if (id === "hub:paths") {
    const creation = patch.creation;
    const paths =
      creation && typeof creation === "object" && !Array.isArray(creation)
        ? (creation as { paths?: unknown }).paths
        : undefined;
    return listNames(paths, ["name", "id"]);
  }
  if (id === "npcs") return listNames(patch.npcs, ["name", "id"]);
  if (id === "rooms") {
    const rooms = patch.rooms;
    if (!rooms || typeof rooms !== "object" || Array.isArray(rooms)) return [];
    return Object.values(rooms as Record<string, { name?: string }>)
      .map((r) => String(r?.name || "").trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  if (id === "fixedEvents") {
    const a = listNames(patch.fixedEvents, ["name", "title", "id"]);
    const b = listNames(patch.events, ["name", "title", "id"]);
    return [...a, ...b].slice(0, 6);
  }
  if (id === "storylines") {
    const a = listNames(patch.storylines, ["name", "title", "id"]);
    const c = listNames(patch.endings, ["title", "name", "id"]);
    return [...a, ...c].slice(0, 6);
  }
  if (id === "hub:rules") {
    const rules = Array.isArray(patch.worldRules) ? patch.worldRules : [];
    return listNames(rules, ["name", "label", "id", "title"]);
  }
  if (id === "prompt") {
    const tone = readScriptTone(
      patch.prompt && typeof patch.prompt === "object" && !Array.isArray(patch.prompt)
        ? (patch.prompt as { scriptTone?: string })
        : null,
    );
    return tone ? ["剧本基调"] : [];
  }
  if (id === "opening") {
    const opening =
      patch.opening && typeof patch.opening === "object" && !Array.isArray(patch.opening)
        ? (patch.opening as { title?: unknown; paragraphs?: unknown })
        : null;
    const title = typeof opening?.title === "string" ? opening.title.trim() : "";
    const n = Array.isArray(opening?.paragraphs) ? opening!.paragraphs.filter((p) => String(p ?? "").trim()).length : 0;
    if (title) return [title];
    if (n) return [`${n} 段开场白`];
  }
  return [];
}

/**
 * 功能注释：完成后可点开的结果摘要（短列表，不贴全文）。
 */
export function worldGenStepResultSummary(
  stepId: string,
  content: ModContent | Record<string, unknown> | null | undefined,
): string {
  const patch = (content ?? {}) as Record<string, unknown>;
  const id = String(stepId || "").trim();
  const names = worldGenStepNamesFromPatch(id, patch);

  if (id === "hub:rules") {
    const n = Array.isArray(patch.worldRules) ? patch.worldRules.length : 0;
    const g = Array.isArray(patch.gameRules) ? patch.gameRules.length : 0;
    const bits = [
      n ? `世界规则 ${n} 条` : "",
      g ? `玩法规则 ${g} 条` : "",
      names.length ? `含：${names.slice(0, 4).join("、")}` : "婚姻 / 姓氏 / 生育等社会秩序",
    ].filter(Boolean);
    return bits.join(" · ") || "已写入世界规则";
  }
  if (id === "hub:book") {
    const n = Array.isArray(patch.worldBook) ? patch.worldBook.length : 0;
    return n
      ? `世界书 ${n} 条${names.length ? `：${names.join("、")}` : ""}`
      : "已写入世界书骨架";
  }
  if (id === "hub:paths") {
    return names.length ? `人物线路：${names.join("、")}` : "已写入人物线路骨架";
  }
  if (id === "npcs") {
    const n = Array.isArray(patch.npcs) ? patch.npcs.length : 0;
    return n ? `人物 ${n} 名${names.length ? `：${names.join("、")}` : ""}` : "已写入人物骨架";
  }
  if (id === "rooms") {
    const rooms = patch.rooms && typeof patch.rooms === "object" && !Array.isArray(patch.rooms)
      ? Object.keys(patch.rooms as object).length
      : 0;
    return rooms ? `地点 ${rooms} 个${names.length ? `：${names.join("、")}` : ""}` : "已写入地点骨架";
  }
  if (id === "prompt") {
    const tone = readScriptTone(
      patch.prompt && typeof patch.prompt === "object" && !Array.isArray(patch.prompt)
        ? (patch.prompt as { scriptTone?: string })
        : null,
    );
    return tone ? `剧本基调 ${tone.length} 字（建议 ${SCRIPT_TONE_TARGET_MIN}–${SCRIPT_TONE_TARGET_MAX}，上限 ${SCRIPT_TONE_MAX}）` : "已写入剧本基调";
  }
  if (id === "opening") {
    const opening =
      patch.opening && typeof patch.opening === "object" && !Array.isArray(patch.opening)
        ? (patch.opening as { paragraphs?: unknown; title?: unknown })
        : null;
    const n = Array.isArray(opening?.paragraphs) ? opening!.paragraphs.filter((p) => String(p ?? "").trim()).length : 0;
    const title = typeof opening?.title === "string" ? opening.title.trim() : "";
    return `${title ? `「${title}」· ` : ""}${n} 段开场白`;
  }
  if (id === "fixedEvents") {
    const n =
      (Array.isArray(patch.fixedEvents) ? patch.fixedEvents.length : 0) +
      (Array.isArray(patch.events) ? patch.events.length : 0);
    // 功能注释：开场与固定事件一起生成；摘要要如实写出各写了什么（开局提示词条数 + 开场白段数）
    const openingFlags = (Array.isArray(patch.fixedEvents) ? patch.fixedEvents : []).filter(
      (e) => e && typeof e === "object" && (e as { openingPrompt?: unknown }).openingPrompt === true,
    ).length;
    const op = patch.opening && typeof patch.opening === "object" && !Array.isArray(patch.opening)
      ? (patch.opening as { paragraphs?: unknown })
      : null;
    const paras = Array.isArray(op?.paragraphs) ? op!.paragraphs.filter((p) => String(p ?? "").trim()).length : 0;
    const extra = [openingFlags ? `开局提示词 ${openingFlags} 条` : "", paras ? `开场白 ${paras} 段` : ""].filter(Boolean);
    const head = n ? `固定事件 ${n} 条${names.length ? `：${names.join("、")}` : ""}` : "已写入固定事件";
    return extra.length ? `${head} · ${extra.join(" · ")}` : head;
  }
  if (id === "storylines") {
    const main = Array.isArray(patch.storylines) ? patch.storylines.length : 0;
    // 功能注释：AI 不生成支线，摘要不再展示「支线 0」
    const end = Array.isArray(patch.endings) ? patch.endings.length : 0;
    return [`主线 ${main}`, `结局 ${end}`].join(" · ");
  }
  if (id === "travelTime") {
    const sd = typeof patch.startDate === "string" ? patch.startDate.trim() : "";
    return sd ? `开局日期 ${sd}` : "已写入时间与推进";
  }
  if (id === "startResources") {
    const m = patch.startMoney;
    return typeof m === "number" ? `开局资金 ${m}` : "已写入开局资金";
  }
  if (names.length) return `${stepLabel(id)}：${names.join("、")}`;
  return `「${stepLabel(id)}」已生成`;
}

/**
 * 功能注释：写入 AI 提示的条数/字数约束段，强迫模型少而精。
 */
export function worldGenLeanPromptBlock(limits: WorldGenLeanLimits, phase: "skeleton" | "enrich"): string {
  if (phase === "skeleton") {
    return `速度与体量（禁止灌满无关长文；条数只是建议，禁止为凑数补空壳）：
- 世界书最多 ${limits.worldBookEntries} 条：须有 id/title/keywords/content（本阶段不要写 bindRooms/bindNpcs）
- 人物建议约 ${WORLD_GEN_NPCS_SUGGEST_MIN}–${WORLD_GEN_NPCS_SUGGEST_MAX} 名（参考 ${limits.npcs}）：每条必须 name/gender/age/bio（约 ${limits.npcBioChars} 字），无名字或无正文的丢掉
- 人物线路最多 ${limits.paths} 条：须有 id/name 与关键开局字段
- 地点建议约 ${WORLD_GEN_ROOMS_SUGGEST_MIN}–${WORLD_GEN_ROOMS_SUGGEST_MAX} 个（参考 ${limits.rooms}，每条 name+desc 非空）；固定事件建议约 2–5 条（参考 ${limits.fixedEvents}，每条必有 name、prompt、effects）；主线恰好 ${limits.storylines} 条；支线 ${limits.sidelines} 条（须为 0，勿写 sidelines）；结局最多 ${limits.endings}
- 剧本基调 scriptTone 写完整口吻/时代/铁律，建议 ${SCRIPT_TONE_TARGET_MIN}–${SCRIPT_TONE_TARGET_MAX} 字，上限 ${SCRIPT_TONE_MAX} 字；禁止「约 700 字」式截短
- 开场白每段约 ${limits.openingParaChars} 字，至少 2 段
- 建角 customAttrs 建议约 2–4 条：每条必须有中文名称与 desc，禁止「未命名」或空壳凑数
- 开局资金须同时写 startMoney 与 moneyLabel（货币名）；开局日期 startDate 格式 YYYY.MM.DD
- 只写 rooms / startRoom / exits，不要写 locations[]
- 严禁堆砌无关长文；未点名的扩展玩法字段不要写；缺名字/正文的条目丢掉，禁止用占位假完成`;
  }
  return `补长文阶段（只补已有骨架，禁止新增空壳条目）：
- 在已有 id 上补全：世界书正文约 ${limits.worldBookBodyChars} 字/条；人物 bio 约 ${limits.npcBioChars} 字；scriptTone 写完整（建议 ${SCRIPT_TONE_TARGET_MIN}–${SCRIPT_TONE_TARGET_MAX} 字，上限 ${SCRIPT_TONE_MAX} 字）
- 开场白每段可补到约 ${limits.openingParaChars} 字
- 条目变多时只缩短每条正文，不要为建议条数再补空条目
- 建角属性保持有名称的有效条；不要新增空「未命名」属性
- 不要新增超出骨架的空壳；不要重写无关字段`;
}
