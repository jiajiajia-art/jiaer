import type { Mod, ModContent } from "../mods/types.ts";
import { asNonEmptyTrimmed, asTrimmedString } from "./asTrimmedString.ts";
import { normalizeRuleBranches } from "./gameRuleShape.ts";
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
  // 功能注释：固定事件链名 / 失败提示词也会被直接 .trim()
  "chain", "failPrompt", "key", "date", "md", "from", "to",
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

/** 功能注释：编辑器对列表做 (x ?? []).map；AI 常写成 {apps:[]} 或单条对象，必须收成数组否则整页崩 */
const ARRAY_FIELD_KEYS = new Set([
  "npcs", "items", "gigs", "events", "fixedEvents", "endings", "gradeDims",
  "worldBook", "income", "gameRules", "storylines", "lookRules", "playModInstalls",
  "worldRules", "navTabs", "phoneAppsCfg", "bgm", "audio", "audioRefs", "cgs",
  "factions", "locations", "styles", "identities", "backgrounds", "directions",
  "zodiacs", "parentJobs", "identityOpts", "backgroundOpts", "klassOpts", "trainings", "sideJobs", "bills", "customAttrs",
  "paths", "fields", "choices", "keywords", "tags", "paragraphs", "nodes",
  "modes", "apps", "acts", "shop", "works", "roam", "options", "conds", "effects",
  "members", "chars", "regions", "lore", "choose", "fixed",
]);

function coerceArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  for (const k of ["apps", "items", "list", "data", "entries", "nodes", "paths", "modes", "rows", "jobs", "tracks", "regions"]) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  if ("id" in o || "name" in o || "label" in o) return [o];
  const vals = Object.values(o);
  // 功能注释：数组也是 object，不能把 {tracks:[]} 收成「一项是数组」否则下游 .src 为 undefined
  if (vals.length && vals.every((v) => v && typeof v === "object" && !Array.isArray(v))) return vals;
  return [];
}

/** 功能注释：人物时间线编辑器直接 .map；AI 常写成一段字符串或单条 {when,text} */
function coerceTimeline(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" || typeof raw === "number") {
    const text = String(raw).trim();
    return text ? [{ id: "tl_0", when: "", text }] : [];
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["entries", "items", "list", "events", "rows"]) {
      if (Array.isArray(o[key])) return o[key] as unknown[];
    }
    if ("when" in o || "text" in o || "place" in o) return [o];
  }
  return coerceArray(raw);
}

function normalizeTimelineRow(row: unknown, i: number): Record<string, unknown> {
  if (typeof row === "string" || typeof row === "number") {
    return { id: `tl_${i}`, when: "", text: String(row).trim() };
  }
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { id: `tl_${i}`, when: "", text: "" };
  }
  const coerced = deepCoerceContent(row) as Record<string, unknown>;
  const place = asNonEmptyTrimmed(coerced.place);
  const out: Record<string, unknown> = {
    ...coerced,
    id: asTrimmedString(coerced.id) || `tl_${i}`,
    when: asTrimmedString(coerced.when),
    text: asTrimmedString(coerced.text),
  };
  if (place) out.place = place;
  else delete out.place;
  return out;
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
    if (k === "timeline") {
      out[k] = coerceTimeline(v).map((row, i) => normalizeTimelineRow(row, i));
      continue;
    }
    if (k === "gameRules") {
      out[k] = coerceArray(v).map((row) => {
        const item = deepCoerceContent(row);
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const rule = item as Record<string, unknown>;
        rule.branches = normalizeRuleBranches(rule.branches);
        return rule;
      });
      continue;
    }
    // 功能注释：母校是一段文字；AI 常写成选项对象数组，输入框会显示 [object Object]
    if (k === "school") {
      const parts = (Array.isArray(v) ? v : [v]).map((item) => asTrimmedString(item)).filter(Boolean);
      if (parts.length) out[k] = parts.join("、");
      else if (typeof v === "string") out[k] = v;
      continue;
    }
    if (ARRAY_FIELD_KEYS.has(k)) {
      const arr = coerceArray(v);
      const stringLists = new Set(["keywords", "tags", "roam", "works", "childNames", "options", "paragraphs", "publicRandom", "audioRefs", "parentJobs", "identityOpts", "backgroundOpts", "klassOpts"]);
      out[k] = stringLists.has(k)
        ? (coerceStringList(arr) ?? [])
        : arr.map((row) => deepCoerceContent(row));
      continue;
    }
    if (k === "terms" || k === "labels" || k === "familyVoices") {
      const map = coerceStringMap(v);
      if (map) out[k] = map;
      continue;
    }
    // 功能注释：content.prompt 是片段表；fixedEvents[].prompt 是单弦。对象若像片段表则按 map 洗，否则解包成字符串
    if (k === "prompt") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const keys = Object.keys(v as object);
        const looksLikeFragments = keys.some((x) => /Intro|Persona|Rule|Style|Tone|System|World|Gm|Narrator/i.test(x));
        if (looksLikeFragments || keys.length > 2) {
          const map = coerceStringMap(v);
          if (map) out[k] = map;
          continue;
        }
      }
      const s = asNonEmptyTrimmed(v);
      if (s) out[k] = s;
      else if (typeof v === "string") out[k] = v;
      continue;
    }
    if (STRING_FIELD_KEYS.has(k) || /Label$/i.test(k) || /Hint$/i.test(k) || /Title$/i.test(k)) {
      // 功能注释：星座 from/to 是 [月,日]，不能按文案丢掉，否则进「角色」页 .join 崩页并被刷新打回基础
      if (Array.isArray(v)) {
        out[k] = v.map((item) => (item && typeof item === "object" ? deepCoerceContent(item) : item));
        continue;
      }
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
