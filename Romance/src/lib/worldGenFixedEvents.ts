/**
 * 生成世界 · 固定事件清洗：按世界观一次写满 5 条完整叙事事件；
 * 禁止选项 / 选项类型；缺提示词或属性变化的半成品一律丢掉。
 */
import { asTrimmedString } from "./asTrimmedString.ts";

/** 功能注释：固定事件建议条数中位（仅提示）；实际接受建议范围约 2–5 */
export const WORLD_GEN_FIXED_EVENTS_COUNT = 3;
export const WORLD_GEN_FIXED_EVENTS_SUGGEST_MIN = 2;
export const WORLD_GEN_FIXED_EVENTS_SUGGEST_MAX = 5;

/** 功能注释：提示词最短字数，避免「夜巡」这类空壳过关 */
const MIN_PROMPT_CHARS = 20;

const EFFECT_KINDS = new Set([
  "stat",
  "metric",
  "rel",
  "addItem",
  "removeItem",
  "unlockLocation",
  "flag",
  "faction",
  "memory",
]);

const COND_KINDS = new Set([
  "stat",
  "metric",
  "rel",
  "location",
  "item",
  "event",
  "time",
  "date",
  "flag",
  "clock",
  "quest",
  "side",
  "faction",
  "visited",
]);

const TIME_KINDS = new Set(["none", "day", "date", "every", "weekly", "monthly", "yearly"]);

function asObjList(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[];
}

/**
 * 功能注释：只保留可结算的后果；丢掉选项里夹带的空壳与未知 kind。
 */
export function normalizeWorldGenFixedEffects(raw: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of asObjList(raw)) {
    const kind = asTrimmedString(row.kind);
    if (!EFFECT_KINDS.has(kind)) continue;
    const key = asTrimmedString(row.key);
    if (kind === "stat" || kind === "metric" || kind === "rel" || kind === "faction" || kind === "flag") {
      if (!key) continue;
      const delta = Number(row.delta);
      if (!Number.isFinite(delta) || delta === 0) continue;
      const effect: Record<string, unknown> = { kind, key, delta };
      if (kind === "flag" && row.set === true) effect.set = true;
      out.push(effect);
      continue;
    }
    if (kind === "memory") {
      if (!key) continue;
      out.push(row.clear === true ? { kind, key, clear: true } : { kind, key });
      continue;
    }
    if (!key) continue;
    out.push({ kind, key });
  }
  return out;
}

/**
 * 功能注释：条件可留空；只洗合法 shape，避免脏 kind 进编辑器。
 */
function normalizeConds(raw: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const row of asObjList(raw)) {
    const kind = asTrimmedString(row.kind);
    if (!COND_KINDS.has(kind)) continue;
    out.push({ ...row, kind });
  }
  return out;
}

function normalizeTime(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const t = raw as Record<string, unknown>;
  const kind = asTrimmedString(t.kind);
  if (!TIME_KINDS.has(kind)) return undefined;
  return { ...t, kind };
}

/**
 * 功能注释：兼容模型把叙事写在 desc/text/content/提示词 等字段，统一收成 prompt。
 */
export function coerceWorldGenFixedEventPrompt(raw: Record<string, unknown>): string {
  for (const key of ["prompt", "desc", "text", "content", "story", "叙事", "提示词", "事件提示词"]) {
    const v = asTrimmedString(raw[key]);
    if (v) return v;
  }
  return "";
}

/**
 * 功能注释：单条固定事件——必须有名称、提示词、至少一条属性变化；强制时间自动触发；剥掉选项。
 */
export function normalizeWorldGenFixedEvent(
  raw: unknown,
  index: number,
): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = asTrimmedString(r.name) || asTrimmedString(r.title);
  const prompt = coerceWorldGenFixedEventPrompt(r);
  const effects = normalizeWorldGenFixedEffects(r.effects);
  if (!name || prompt.length < MIN_PROMPT_CHARS || !effects.length) return null;

  const id = asTrimmedString(r.id) || `fx_auto_${index + 1}`;
  const ev: Record<string, unknown> = {
    id: /^[a-z0-9_-]+$/i.test(id) ? id : `fx_auto_${index + 1}`,
    name,
    prompt,
    // 功能注释：固定事件只做时间自动叙事，禁止 enter/choice 等选项型触发
    trigger: { kind: "auto" },
    effects,
    once: r.once === false ? false : true,
  };

  const time = normalizeTime(r.time);
  if (time) ev.time = time;
  const conds = normalizeConds(r.conds);
  if (conds.length) ev.conds = conds;
  if (r.condMatch === "any" || r.condMatch === "all") ev.condMatch = r.condMatch;
  if (Array.isArray(r.nextIds)) {
    const nextIds = r.nextIds.map((x) => asTrimmedString(x)).filter(Boolean);
    if (nextIds.length) ev.nextIds = nextIds;
  }
  if (r.locked === true) ev.locked = true;
  const chain = asTrimmedString(r.chain);
  if (chain) ev.chain = chain;
  // 功能注释：开局提示词勾选——玩家开局用已勾选条目的 prompt 生成第一场剧情
  if (r.openingPrompt === true) ev.openingPrompt = true;
  // 功能注释：需要玩家选择时保留 choices；否则保持自动播放不带选项
  if (Array.isArray(r.choices) && r.choices.length) {
    const choices = r.choices.filter((c) => c && typeof c === "object" && !Array.isArray(c));
    if (choices.length) ev.choices = choices;
  }
  return ev;
}

/**
 * 功能注释：把 AI 的 fixedEvents（及误写入的 events）收成最多 WORLD_GEN_FIXED_EVENTS_COUNT 条完整事件；
 * 丢掉半成品与选项；不再往 content.events 灌库。
 */
export function normalizeWorldGenFixedEventsPatch(
  patch: Record<string, unknown>,
  /** 功能注释：软上限防爆；建议范围约 2–5，允许略多但丢空壳 */
  limit = Math.max(WORLD_GEN_FIXED_EVENTS_SUGGEST_MAX + 3, WORLD_GEN_FIXED_EVENTS_COUNT),
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  // 功能注释：世界观生成的固定事件只进 fixedEvents；AI 若顺带写 events[] 一律丢掉，避免事件库半成品
  delete out.events;
  delete out.eventGroups;

  const rawList = [
    ...asObjList(out.fixedEvents),
    // 功能注释：若模型只写了 events[]，先并入再删，避免整批变空
    ...asObjList(patch.events),
  ];
  const seen = new Set<string>();
  const list: Record<string, unknown>[] = [];
  for (const row of rawList) {
    if (list.length >= limit) break;
    const ev = normalizeWorldGenFixedEvent(row, list.length);
    if (!ev) continue;
    let id = String(ev.id);
    if (seen.has(id)) {
      id = `${id}_${list.length + 1}`;
      ev.id = id;
    }
    seen.add(id);
    list.push(ev);
  }

  if (list.length) out.fixedEvents = list;
  else delete out.fixedEvents;
  return out;
}

/**
 * 功能注释：软校验——至少 1 条完整叙事即可；建议 2–5，条数超出建议不失败；半成品打回。
 * 需要选择的事件可带 choices；不需要的保持 auto 无选项。
 */
export function softValidateWorldGenFixedEvents(
  patch: Record<string, unknown>,
  _expect = WORLD_GEN_FIXED_EVENTS_COUNT,
): string | null {
  void _expect;
  const list = asObjList(patch.fixedEvents);
  if (!list.length) {
    return "固定事件至少 1 条完整叙事事件";
  }
  for (const row of list) {
    const name = asTrimmedString(row.name) || "未命名";
    if (!name || name === "未命名") return "固定事件缺少名称";
    if (asTrimmedString(row.prompt).length < MIN_PROMPT_CHARS) {
      return `固定事件「${name}」缺少事件提示词`;
    }
    if (!normalizeWorldGenFixedEffects(row.effects).length) {
      return `固定事件「${name}」缺少触发后属性变化`;
    }
  }
  return null;
}
