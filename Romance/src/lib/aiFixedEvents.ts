/**
 * 固定事件 · AI 帮写：只按本作品材料写事件；条数建议约 2–5，不补空壳。
 * 材料里没有演艺圈内容时，禁止通告/片场/名气等词。
 */
import type { FixedEvent } from "./types";
import { asTrimmedString } from "./asTrimmedString.ts";
import type { FixedEventTime } from "./types";
import {
  coerceWorldGenFixedEventPrompt,
  normalizeWorldGenFixedEvent,
  WORLD_GEN_FIXED_EVENTS_COUNT,
  WORLD_GEN_FIXED_EVENTS_SUGGEST_MAX,
  WORLD_GEN_FIXED_EVENTS_SUGGEST_MIN,
} from "./worldGenFixedEvents.ts";

/** 功能注释：帮写建议条数中位；与生成世界共用，不再硬卡正好 5 */
export const AI_FIXED_EVENTS_COUNT = WORLD_GEN_FIXED_EVENTS_COUNT;
export const AI_FIXED_EVENTS_SUGGEST_MIN = WORLD_GEN_FIXED_EVENTS_SUGGEST_MIN;
export const AI_FIXED_EVENTS_SUGGEST_MAX = WORLD_GEN_FIXED_EVENTS_SUGGEST_MAX;

/** 功能注释：帮写时注入的本作品摘要，禁止回落旧世界 */
export type AiFixedEventsWorldContext = {
  title?: string;
  setting?: string;
  scriptTone?: string;
  worldBook?: { id?: string; title?: string; keywords?: string; content?: string }[];
  rooms?: { id: string; name: string }[];
  npcs?: { id: string; name: string }[];
  metrics?: { key: string; label: string }[];
  stats?: { key: string; label: string }[];
};

/** 功能注释：把 id/name 或 key/label 列表压成提示词一行，两种键都认 */
function ids(
  list: { id?: string; name?: string; key?: string; label?: string }[] | undefined,
  n = 40,
): string {
  if (!list?.length) return "（无）";
  return (
    list
      .slice(0, n)
      .map((x) => `${x.id ?? x.key ?? "?"}=${x.name ?? x.label ?? "?"}`)
      .join("，") || "（无）"
  );
}

const ENT_TERMS = ["通告", "片场", "经纪人", "试镜", "红毯", "粉丝", "名气", "黑粉", "明星", "导演", "练习生"];

/** 功能注释：材料里未出现演艺圈词时，明确禁止模型写这些词 */
function entertainmentForbidLine(ctx: AiFixedEventsWorldContext): string {
  const blob = [
    ctx.title,
    ctx.setting,
    ctx.scriptTone,
    ...(ctx.worldBook ?? []).flatMap((w) => [w.title, w.keywords, w.content]),
    ...(ctx.rooms ?? []).map((r) => r.name),
    ...(ctx.npcs ?? []).map((n) => n.name),
    ...(ctx.stats ?? []).map((s) => s.label),
    ...(ctx.metrics ?? []).map((m) => m.label),
  ]
    .map((x) => String(x ?? ""))
    .join("\n");
  const present = ENT_TERMS.filter((t) => blob.includes(t));
  if (present.length === ENT_TERMS.length) return "";
  const banned = ENT_TERMS.filter((t) => !present.includes(t));
  return `材料未提供演艺圈设定时，事件名与正文禁止出现：${banned.join("、")}。`;
}

/**
 * 功能注释：系统提示——只使用本作品世界书/地点/人物/属性；条数建议；属性变化只能改已有键。
 */
export function buildAiFixedEventsSystemPrompt(
  ctx: AiFixedEventsWorldContext,
  existing: FixedEvent[],
): string {
  const worldBits = [
    ctx.title ? `作品名：${ctx.title}` : "",
    ctx.setting ? `故事设定：${ctx.setting}` : "",
    ctx.scriptTone ? `剧本基调：${ctx.scriptTone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const bookBits = (ctx.worldBook ?? [])
    .slice(0, 12)
    .map((w) => {
      const title = asTrimmedString(w.title) || asTrimmedString(w.id) || "条目";
      const kw = asTrimmedString(w.keywords);
      const body = asTrimmedString(w.content).slice(0, 120);
      return `- ${title}${kw ? `「${kw}」` : ""}${body ? `：${body}` : ""}`;
    })
    .join("\n");

  const exampleRoom = ctx.rooms?.[0]?.name || "本作品地点";
  const exampleAttr = ctx.stats?.[0]?.label || ctx.metrics?.[0]?.label || "本作品属性";
  const forbid = entertainmentForbidLine(ctx);

  return `你是文字养成游戏的剧本策划。按当前作品材料写出约 ${AI_FIXED_EVENTS_SUGGEST_MIN}–${AI_FIXED_EVENTS_SUGGEST_MAX} 条「固定事件」（参考 ${AI_FIXED_EVENTS_COUNT} 条）。
只输出一个 \`\`\`json 代码块，内容为数组 FixedEvent[]，不要其他文字。

每条必须一次写完整：
{"id":"fx_小写英文","name":"事件名","trigger":{"kind":"auto"},"time":{"kind":"day","day":开局后第N天} 或 {"kind":"none"},"conds":[],"prompt":"这场戏里谁、在哪个已有地点、做了什么、说了什么（60~200字）","effects":[{"kind":"metric"|"stat"|"rel","key":"…","delta":非0整数}],"once":true,"openingPrompt":false}

硬性规则：
- 建议 ${AI_FIXED_EVENTS_SUGGEST_MIN}–${AI_FIXED_EVENTS_SUGGEST_MAX} 条；少了或多了都可以，但每条必须有名字和可用正文，禁止空壳凑数
- prompt 不能为空，也不能短于 20 字；只写这场戏的事，禁止「眼底闪过一丝」「空气仿佛凝固」「命运的齿轮」「故事才刚刚开始」
- effects 至少 1 条；key 只能是下方「可用指标/属性」或人物关系 id
- 不需要选择的事件用 trigger.auto 且不要写 choices；需要玩家选择才带 choices，选项后果也只能改已有属性/关系
- 事件名和正文只用材料里的时代、身份、场合
${forbid ? `- ${forbid}\n` : ""}
${worldBits || "（世界观信息不足时，仍须用已给的地点/人物/属性写出可上演事件）"}

世界书：
${bookBits || "（无）"}

可用指标：${ids(ctx.metrics, 20)}
可用属性：${ids(ctx.stats, 20)}
人物：${ids(ctx.npcs)}
地点：${ids(ctx.rooms)}
已有事件 id（不要重复）：${ids(existing.map((e) => ({ id: e.id, name: e.name || e.id })), 60)}

示例口吻：在「${exampleRoom}」围绕「${exampleAttr}」写一场可结算的戏，不要用材料里没有的词。`;
}

/** 功能注释：一键帮写的默认用户句 */
export const AI_FIXED_EVENTS_DEFAULT_ASK =
  `按当前作品生成约 ${AI_FIXED_EVENTS_SUGGEST_MIN}–${AI_FIXED_EVENTS_SUGGEST_MAX} 条完整固定事件：每条含名称、事件提示词、属性变化；不需要选择就不要写选项。`;

/**
 * 功能注释：清洗 AI 输出——只留完整叙事条；条数软上限，不强制正好 N。
 */
export function sanitizeAiFixedEvents(raw: unknown, taken: Set<string>): FixedEvent[] {
  const arr = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { events?: unknown }).events)
      ? (raw as { events: unknown[] }).events
      : raw && typeof raw === "object" && Array.isArray((raw as { fixedEvents?: unknown }).fixedEvents)
        ? (raw as { fixedEvents: unknown[] }).fixedEvents
        : [];

  const out: FixedEvent[] = [];
  const rename = new Map<string, string>();
  const used = new Set(taken);
  const softCap = AI_FIXED_EVENTS_SUGGEST_MAX + 3;

  for (const row of arr) {
    if (out.length >= softCap) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = { ...(row as Record<string, unknown>) };
    if (!asTrimmedString(r.prompt)) {
      const coerced = coerceWorldGenFixedEventPrompt(r);
      if (coerced) r.prompt = coerced;
    }
    const norm = normalizeWorldGenFixedEvent(r, out.length);
    if (!norm) continue;

    let id = String(norm.id);
    if (used.has(id)) {
      const n = `${id}_${Math.random().toString(36).slice(2, 5)}`;
      rename.set(id, n);
      id = n;
      norm.id = id;
    }
    used.add(id);

    const ev: FixedEvent = {
      id,
      name: String(norm.name),
      prompt: String(norm.prompt),
      trigger: { kind: "auto" },
      time: (norm.time as FixedEventTime | undefined) ?? { kind: "none" },
      conds: Array.isArray(norm.conds) ? (norm.conds as FixedEvent["conds"]) : undefined,
      effects: norm.effects as FixedEvent["effects"],
      nextIds: Array.isArray(norm.nextIds) ? (norm.nextIds as string[]) : undefined,
      once: norm.once === false ? false : true,
      locked: norm.locked === true || undefined,
      chain: typeof norm.chain === "string" ? norm.chain : undefined,
      ...(norm.openingPrompt === true ? { openingPrompt: true } : {}),
      ...(Array.isArray(norm.choices) ? { choices: norm.choices as FixedEvent["choices"] } : {}),
    };
    out.push(ev);
  }

  if (rename.size) {
    for (const e of out) {
      e.nextIds = e.nextIds?.map((i) => rename.get(i) ?? i);
      e.conds = e.conds?.map((c) =>
        c.kind === "event" && rename.has(c.key) ? { ...c, key: rename.get(c.key)! } : c,
      );
    }
  }
  return out;
}

/**
 * 功能注释：帮写确认入库——空壳多则整表替换；否则追加，不强制正好 N 条。
 */
export function mergeAiFixedEventsIntoLibrary(
  existing: FixedEvent[],
  generated: FixedEvent[],
): FixedEvent[] {
  if (!generated.length) return existing;
  const incomplete = (e: FixedEvent) =>
    !asTrimmedString(e.prompt) || !Array.isArray(e.effects) || e.effects.length === 0;
  const mostlyShells =
    existing.length === 0 ||
    existing.filter(incomplete).length >= Math.ceil(existing.length * 0.5);
  if (mostlyShells) return generated;
  const taken = new Set(existing.map((e) => e.id));
  const add: FixedEvent[] = [];
  for (const ev of generated) {
    let id = ev.id;
    if (taken.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 5)}`;
    taken.add(id);
    add.push({ ...ev, id });
  }
  return [...existing, ...add];
}
