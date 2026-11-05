/**
 * 固定事件 · AI 帮写：按世界观一次写出恰好 5 条完整叙事事件；
 * 每条必须有名称 / 触发方式 / 事件提示词 / 属性变化；禁止选项。
 */
import type { FixedEvent } from "./types";
import { asTrimmedString } from "./asTrimmedString.ts";
import type { FixedEventTime } from "./types";
import {
  coerceWorldGenFixedEventPrompt,
  normalizeWorldGenFixedEvent,
  WORLD_GEN_FIXED_EVENTS_COUNT,
} from "./worldGenFixedEvents.ts";

/** 功能注释：编辑器「AI 帮写」与生成世界共用的完整事件条数 */
export const AI_FIXED_EVENTS_COUNT = WORLD_GEN_FIXED_EVENTS_COUNT;

/** 功能注释：帮写时注入的世界观摘要，避免模型凭空写无关桥段 */
export type AiFixedEventsWorldContext = {
  title?: string;
  setting?: string;
  scriptTone?: string;
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

/**
 * 功能注释：系统提示——强制恰好 5 条、字段写满、无选项；并带上世界观与可用键。
 */
export function buildAiFixedEventsSystemPrompt(
  ctx: AiFixedEventsWorldContext,
  existing: FixedEvent[],
): string {
  const worldBits = [
    ctx.title ? `作品名：${ctx.title}` : "",
    ctx.setting ? `故事设定：${ctx.setting.slice(0, 600)}` : "",
    ctx.scriptTone ? `剧本基调摘要：${ctx.scriptTone.slice(0, 400)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `你是文字养成游戏的剧本策划。按当前世界观写出恰好 ${AI_FIXED_EVENTS_COUNT} 条「固定事件」。
只输出一个 \`\`\`json 代码块，内容为数组 FixedEvent[]（长度必须是 ${AI_FIXED_EVENTS_COUNT}），不要其他文字。

每条必须一次写完整，缺一不可：
{"id":"fx_小写英文","name":"事件名","trigger":{"kind":"auto"},"time":{"kind":"day","day":开局后第N天} 或 {"kind":"none"},"conds":[],"prompt":"交给 AI 演绎的剧情（60~200字：场景、人物、冲突与走向）","effects":[{"kind":"metric"|"stat"|"rel","key":"…","delta":非0整数}],"once":true}

硬性规则：
- 正好 ${AI_FIXED_EVENTS_COUNT} 条，不多不少
- prompt 不能为空，也不能短于 20 字
- effects 至少 1 条属性变化
- trigger 只能是 {"kind":"auto"}（时间自动叙事）
- 禁止 choices、禁止选项文案、禁止选项类型、禁止 enter/choice/action 等触发
- 事件要贴合世界观地点与人物，不要写无关题材

${worldBits || "（世界观信息不足时，仍须写出完整可上演的 5 条叙事事件）"}

可用指标：${ids(ctx.metrics, 20)}
可用属性：${ids(ctx.stats, 20)}
人物：${ids(ctx.npcs)}
地点：${ids(ctx.rooms)}
已有事件 id（不要重复）：${ids(existing.map((e) => ({ id: e.id, name: e.name || e.id })), 60)}`;
}

/** 功能注释：一键帮写的默认用户句，不依赖创作者再打长描述 */
export const AI_FIXED_EVENTS_DEFAULT_ASK =
  `按当前世界观生成恰好 ${AI_FIXED_EVENTS_COUNT} 条完整固定事件：每条含名称、trigger.auto、事件提示词、触发后属性变化；禁止选项。`;

/**
 * 功能注释：清洗 AI 输出——只留完整叙事条，强制 auto、剥选项，最多 AI_FIXED_EVENTS_COUNT 条。
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

  for (const row of arr) {
    if (out.length >= AI_FIXED_EVENTS_COUNT) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = { ...(row as Record<string, unknown>) };
    if (!asTrimmedString(r.prompt)) {
      const coerced = coerceWorldGenFixedEventPrompt(r);
      if (coerced) r.prompt = coerced;
    }
    // 功能注释：复用生成世界清洗——缺提示词/缺后果/带选项一律丢掉
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
      // 功能注释：清洗层已规范化 time；缺省 none，编辑器展示「仅凭条件」
      time: (norm.time as FixedEventTime | undefined) ?? { kind: "none" },
      conds: Array.isArray(norm.conds) ? (norm.conds as FixedEvent["conds"]) : undefined,
      effects: norm.effects as FixedEvent["effects"],
      nextIds: Array.isArray(norm.nextIds) ? (norm.nextIds as string[]) : undefined,
      once: norm.once === false ? false : true,
      locked: norm.locked === true || undefined,
      chain: typeof norm.chain === "string" ? norm.chain : undefined,
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
 * 功能注释：帮写确认入库时——若现有多为空壳/半成品，则整表替换为本次 5 条，避免叠出一堆缺提示词提醒。
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
  if (mostlyShells) return generated.slice(0, AI_FIXED_EVENTS_COUNT);
  const taken = new Set(existing.map((e) => e.id));
  const add: FixedEvent[] = [];
  for (const ev of generated) {
    if (add.length + existing.length >= existing.length + AI_FIXED_EVENTS_COUNT) break;
    let id = ev.id;
    if (taken.has(id)) id = `${id}_${Math.random().toString(36).slice(2, 5)}`;
    taken.add(id);
    add.push({ ...ev, id });
  }
  return [...existing, ...add];
}
