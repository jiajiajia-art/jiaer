/**
 * 生成世界 · 进度明细与瘦身配额。
 * 创作者侧要看到「正在写什么 / 生成了什么」，而不是只显示「进行中」。
 * 全选多项时用精简条数 + 短正文，禁止项项打满长文。
 */
import type { ModContent } from "../mods/types.ts";
import { WORLD_GEN_EDITOR_STEPS } from "./worldGenWizard.ts";
import { WORLD_GEN_FIXED_EVENTS_COUNT } from "./worldGenFixedEvents.ts";
import { readScriptTone } from "./scriptTone.ts";

/** 功能注释：勾选达到该数即进入「全选瘦身」——条数更少、正文更短、骨架优先。 */
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
  fixedEvents: Object.freeze(["事件名", "提示词", "属性变化"]),
  storylines: Object.freeze(["主线", "支线", "结局标题"]),
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
  /** 剧本基调目标字数（骨架阶段更短） */
  scriptToneChars: number;
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
      npcs: 3,
      paths: 2,
      rooms: 4,
      // 功能注释：固定事件按世界观一次写满完整叙事条，不多不少
      fixedEvents: WORLD_GEN_FIXED_EVENTS_COUNT,
      storylines: 1,
      sidelines: 0,
      endings: 2,
      scriptToneChars: 700,
      npcBioChars: 120,
      worldBookBodyChars: 80,
      openingParaChars: 90,
      enrich: true,
    };
  }
  return {
    worldBookEntries: 4,
    npcs: 4,
    paths: 3,
    rooms: 5,
    fixedEvents: WORLD_GEN_FIXED_EVENTS_COUNT,
    storylines: 1,
    sidelines: 0,
    endings: 3,
    scriptToneChars: 1100,
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
    const b = listNames(patch.sidelines, ["name", "title", "id"]);
    const c = listNames(patch.endings, ["title", "name", "id"]);
    return [...a, ...b, ...c].slice(0, 6);
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
    return tone ? `剧本基调约 ${tone.length} 字` : "已写入剧本基调";
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
    return n ? `固定事件 ${n} 条${names.length ? `：${names.join("、")}` : ""}` : "已写入固定事件";
  }
  if (id === "storylines") {
    const main = Array.isArray(patch.storylines) ? patch.storylines.length : 0;
    const side = Array.isArray(patch.sidelines) ? patch.sidelines.length : 0;
    const end = Array.isArray(patch.endings) ? patch.endings.length : 0;
    return [`主线 ${main}`, `支线 ${side}`, `结局 ${end}`].join(" · ");
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
    return `速度与体量（骨架优先，禁止灌满长文）：
- 世界书最多 ${limits.worldBookEntries} 条：先写 id/title/keywords，正文可先空或 ≤${Math.min(40, limits.worldBookBodyChars)} 字
- 人物最多 ${limits.npcs} 名：必须 name/gender/age，bio 先写约 ${Math.min(80, limits.npcBioChars)} 字提纲
- 人物线路最多 ${limits.paths} 条：先写 id/name 与关键开局字段
- 地点最多 ${limits.rooms} 个；固定事件恰好 ${limits.fixedEvents} 条完整叙事（每条必有 name、trigger.auto、prompt、effects；禁止 choices/选项；骨架阶段也不得空提示词）；主线恰好 ${limits.storylines} 条（节点须有目标说明与完成条件，禁止空「新节点」、禁止节点奖励/激活事件）；支线 ${limits.sidelines} 条（须为 0，勿写 sidelines）；结局最多 ${limits.endings}
- 剧本基调 scriptTone 先写约 ${Math.min(400, limits.scriptToneChars)} 字骨架（覆盖口吻与铁律要点即可）
- 开场白每段约 ${Math.min(70, limits.openingParaChars)} 字，至少 2 段
- 建角 customAttrs 正好 3 条：每条必须有中文名称与 desc（属性说明），禁止「未命名」或空壳
- 开局资金须同时写 startMoney 与 moneyLabel（货币名）
- 严禁堆砌无关长文；未点名的扩展玩法字段不要写`;
  }
  return `补长文阶段（只补已有骨架，禁止新增大量条目）：
- 在已有 id 上补全：世界书正文约 ${limits.worldBookBodyChars} 字/条；人物 bio 约 ${limits.npcBioChars} 字；scriptTone 补到约 ${limits.scriptToneChars} 字
- 开场白每段可补到约 ${limits.openingParaChars} 字
- 固定事件保持恰好 ${limits.fixedEvents} 条：补强 prompt 与 effects，仍禁止 choices，禁止新增半成品
- 建角属性仍保持 3 条有名称的；不要新增空「未命名」属性
- 不要新增超出骨架的条目数；不要重写无关字段`;
}
