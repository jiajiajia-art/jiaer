import type { Mod, ModContent } from "../mods/types.ts";
import { asNonEmptyTrimmed, asTrimmedString } from "./asTrimmedString.ts";
import { normalizeStartMetList } from "./normalizeStartMet.ts";

/** 功能注释：模组 JSON 里常见「应为字符串」的字段名；AI 常写成对象/数字 */
const STRING_FIELD_KEYS = new Set([
  "id", "name", "label", "title", "desc", "bio", "role", "gender", "relation",
  "content", "brief", "detail", "src", "prompt", "memory", "event", "note",
  "subject", "body", "text", "hint", "icon", "version", "author", "description",
  "startDate", "startTime", "dayStart", "dayEnd", "startRoom", "weather",
  "pickTitle", "currency", "freeLabel", "perksLabel", "unlockHint", "group",
  "replyPrompt", "badge", "city", "placeholder", "tag", "blurb", "about",
  "genre", "type", "avatarVariant", "html", "page", "image", "video",
  // 功能注释：开局封面 DIY / CoverView 会对这些字段 .trim()，AI 常写成对象
  "css", "kicker", "subtitle", "cta", "waiting", "intro", "bgPrompt",
]);

function coerceStringMap(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = asNonEmptyTrimmed(v);
    if (s) out[k] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

function coerceStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    const one = asNonEmptyTrimmed(raw);
    return one ? [one] : undefined;
  }
  const ids = [...new Set(raw.map((x) => asTrimmedString(x)).filter(Boolean))];
  return ids.length ? ids : undefined;
}

/**
 * 功能注释：递归把 content 树里该是字符串的字段收干净。
 * 仅洗字段名命中 / labels·terms 类映射 / 字符串数组；不改 number/boolean 玩法值。
 */
function deepCoerceContent(value: unknown, keyHint = ""): unknown {
  if (Array.isArray(value)) {
    if (["keywords", "tags", "roam", "works", "childNames", "options", "paragraphs", "publicRandom"].includes(keyHint)) {
      return coerceStringList(value) ?? [];
    }
    return value.map((row) => deepCoerceContent(row));
  }
  if (!value || typeof value !== "object") return value;

  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === "startMet") {
      const met = normalizeStartMetList(v);
      if (met) out[k] = met;
      continue;
    }
    if (k === "terms" || k === "prompt" || k === "labels" || k === "familyVoices") {
      const map = coerceStringMap(v);
      if (map) out[k] = map;
      continue;
    }
    if (STRING_FIELD_KEYS.has(k) || /Label$/i.test(k) || /Hint$/i.test(k) || /Title$/i.test(k)) {
      if (k === "id" || k === "name" || k === "label" || k === "title") {
        out[k] = asTrimmedString(v, typeof v === "number" || typeof v === "boolean" ? String(v) : "");
      } else {
        const s = asNonEmptyTrimmed(v);
        if (s) out[k] = s;
        else if (typeof v === "string") out[k] = v;
        // 非字符串脏值直接丢弃，避免下游 .trim()
      }
      continue;
    }
    out[k] = deepCoerceContent(v, k);
  }
  return out;
}

/**
 * 功能注释：会话/AI 脏模组进编辑器前统一清洗。
 * 刷新会从 localStorage 恢复未清洗的旧 mod；必须深度覆盖 travel/avatars/stats 等。
 */
export function sanitizeModStrings(mod: Mod): Mod {
  const m: Mod = structuredClone(mod);
  m.id = asTrimmedString(m.id);
  m.name = asTrimmedString(m.name);
  m.version = asTrimmedString(m.version) || "1.0.0";
  if (m.author != null) m.author = asTrimmedString(m.author) || undefined;
  if (m.description != null) m.description = asTrimmedString(m.description) || undefined;
  if (Array.isArray(m.dependencies)) {
    m.dependencies = coerceStringList(m.dependencies) ?? [];
  }

  if (m.content && typeof m.content === "object") {
    m.content = deepCoerceContent(m.content) as ModContent;
    // 功能注释：房间 name 空时回落 id，保证地点树可渲染
    const rooms = m.content.rooms;
    if (rooms && typeof rooms === "object") {
      for (const [id, room] of Object.entries(rooms)) {
        if (!room || typeof room !== "object") continue;
        const r = room as { name?: string; desc?: string };
        if (!r.name) r.name = id;
        if (typeof r.desc !== "string") r.desc = "";
      }
    }
    // 功能注释：底栏项 label 被洗成空时回落 id，避免编辑器再对脏 label 做假定
    const tabs = m.content.navTabs;
    if (Array.isArray(tabs)) {
      for (const row of tabs) {
        if (!row || typeof row !== "object") continue;
        const t = row as { id?: string; label?: string };
        if (!String(t.label ?? "").trim() && t.id) t.label = String(t.id);
      }
    }
  }

  return m;
}
