import type { Mod, ModContent } from "../mods/types.ts";
import { asNonEmptyTrimmed, asTrimmedString } from "./asTrimmedString.ts";
import { normalizeRuleBranches } from "./gameRuleShape.ts";
import { normalizeStartMetList } from "./normalizeStartMet.ts";
import { sanitizeNpcFactionId } from "./personName.ts";

/** 功能注释：模组 JSON 里常见「应为字符串」的字段名；AI 常写成对象/数字 */
const STRING_FIELD_KEYS = new Set([
  "id", "name", "label", "title", "desc", "bio", "role", "gender", "relation",
  "content", "brief", "detail", "src", "prompt", "memory", "event", "note",
  "subject", "body", "text", "hint", "icon", "version", "author", "description",
  "startDate", "startRoom", "weather", "platformAutoplay", "phoneHomeWallpaper", "phoneCommSkin",
  "pickTitle", "currency", "freeLabel", "perksLabel", "unlockHint", "group",
  "replyPrompt", "badge", "city", "placeholder", "tag", "blurb", "about",
  "genre", "type", "avatarVariant", "avatar", "summary", "html", "page", "image", "video",
  // 功能注释：生图提示词字段（人物外观 / 地点画面），AI 或旧草稿可能写成对象
  // （style 不入表：cover.style 是对象；作品画风 imageGen.style 由 workImageSettingsOf 只认字符串）
  "appearancePrompt", "scenePrompt",
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
  "worldBook", "income", "gameRules", "storylines", "sidelines", "lookRules", "playModInstalls",
  "worldRules", "navTabs", "phoneAppsCfg", "bgm", "audio", "audioRefs", "platformAudioRefs", "musicOrder", "cgs",
  "factions", "locations", "styles", "identities", "backgrounds", "directions",
  "zodiacs", "parentJobs", "identityOpts", "backgroundOpts", "klassOpts", "trainings", "sideJobs", "bills", "customAttrs",
  "paths", "fields", "choices", "keywords", "tags", "paragraphs", "nodes",
  "modes", "apps", "acts", "shop", "works", "roam", "options", "conds", "effects",
  "members", "chars", "regions", "lore", "choose", "fixed",
  // 功能注释：门槛 requires 常被 AI 写成单对象；不洗则 evalRequires for-of → is not iterable
  "requires", "requirements",
  // 功能注释：分档 / 公共随机池名常被 AI 写成对象；必须进清洗，否则 [...tiers] / new Set(publicRandom) 炸 is not iterable
  "tiers", "publicRandom", "looksTiers", "fameTiers",
  // 功能注释：开局势力 / 手机扩展 / 依赖常被 AI 写成对象；必须进清洗，否则预览建角 flatMap/展开仍炸
  "startFactions", "phoneAppsExtra", "dependencies",
]);

function coerceArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  for (const k of ["apps", "items", "list", "data", "entries", "nodes", "paths", "modes", "rows", "jobs", "tracks", "regions"]) {
    if (Array.isArray(o[k])) return o[k] as unknown[];
  }
  // 功能注释：单条门槛带 metric（无 id）；须收成 [obj]，与 asModArray 一致
  if ("id" in o || "name" in o || "label" in o || "metric" in o) return [o];
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
    // 功能注释：主线缺 nodes 时 questOpts / 剧情页会 reading 'map'；对象单条也收成数组
    if (k === "storylines") {
      out[k] = coerceArray(v).map((row) => {
        const item = deepCoerceContent(row);
        if (!item || typeof item !== "object" || Array.isArray(item)) return item;
        const line = item as Record<string, unknown>;
        line.nodes = coerceArray(line.nodes).map((n) => deepCoerceContent(n));
        return line;
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
    // 功能注释：opening 须为对象；AI 常写成字符串或段落数组，否则 validateMod「opening 须为对象」拦保存
    if (k === "opening") {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out[k] = deepCoerceContent(v, k);
      } else if (typeof v === "string" && v.trim()) {
        out[k] = { paragraphs: [v.trim()] };
      } else if (Array.isArray(v)) {
        const paragraphs = v.map((p) => asTrimmedString(p)).filter(Boolean);
        if (paragraphs.length) out[k] = { paragraphs };
      }
      continue;
    }
    if (ARRAY_FIELD_KEYS.has(k)) {
      const arr = coerceArray(v);
      const stringLists = new Set(["keywords", "tags", "roam", "works", "childNames", "options", "paragraphs", "publicRandom", "audioRefs", "platformAudioRefs", "musicOrder", "parentJobs", "identityOpts", "backgroundOpts", "klassOpts", "phoneAppsExtra", "dependencies"]);
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
      // 功能注释：封面/DIY 的 css 必须是字符串；对象若走 asTrimmedString 单字段兜底会洗成 "red"/"true"，预览 .trim 虽不炸但样式错乱
      if (k === "css" && v != null && typeof v === "object") continue;
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
 * 功能注释：进入此地场景描述必填；AI / 地点库 / 清洗后若仍空，用地点名补一句，避免编辑器交白卷。
 */
export function ensureRoomSceneDescs(rooms: ModContent["rooms"] | Record<string, unknown> | undefined): void {
  if (!rooms || typeof rooms !== "object") return;
  for (const [id, room] of Object.entries(rooms)) {
    if (!room || typeof room !== "object") continue;
    const r = room as { name?: string; desc?: string };
    if (String(r.desc ?? "").trim()) continue;
    const name = String(r.name ?? "").trim() || id;
    r.desc = `你来到了「${name}」。`;
  }
}

/** 功能注释：所属势力只能绑当前作品 startFactions；失效 id（如 faction-royal）一律清空 */
function healNpcFactionRefs(content: ModContent, fixes: string[]): void {
  const factionIds = new Set(
    (Array.isArray(content.creation?.startFactions) ? content.creation!.startFactions! : [])
      .map((f) => (f && typeof f === "object" ? String((f as { id?: string }).id ?? "").trim() : ""))
      .filter(Boolean),
  );
  if (!Array.isArray(content.npcs)) return;
  for (const n of content.npcs) {
    if (!n || typeof n !== "object") continue;
    const rawFac = (n as { factionId?: unknown }).factionId;
    if (rawFac == null || rawFac === "") continue;
    const cleaned = sanitizeNpcFactionId(rawFac, factionIds);
    if (!cleaned) {
      const label = (typeof n.name === "string" && n.name.trim()) || n.id || "?";
      fixes.push(`已清除人物「${label}」的失效势力绑定`);
      delete (n as { factionId?: string }).factionId;
    } else if (cleaned !== String(rawFac).trim()) {
      (n as { factionId?: string }).factionId = cleaned;
    }
  }
}

/**
 * 功能注释：AI 常写 startRoom / NPC.home 指向不存在的房间 id（如 kid_bedroom）。
 * 就地纠偏到有效地点，返回人类可读修复说明；无 rooms 时清除无效 startRoom。
 * 同时清除失效势力绑定（与地点表无关）。
 */
export function healModRoomRefs(content: ModContent): string[] {
  const fixes: string[] = [];
  const rooms = content.rooms;
  if (!rooms || typeof rooms !== "object") {
    if (content.startRoom) {
      fixes.push(`已清除无效 startRoom「${content.startRoom}」（尚无地点表）`);
      delete content.startRoom;
    }
    healNpcFactionRefs(content, fixes);
    return fixes;
  }
  const ids = Object.keys(rooms);
  if (!ids.length) {
    if (content.startRoom) {
      fixes.push(`已清除无效 startRoom「${content.startRoom}」（地点表为空）`);
      delete content.startRoom;
    }
    healNpcFactionRefs(content, fixes);
    return fixes;
  }
  const cur = typeof content.startRoom === "string" ? content.startRoom.trim() : "";
  if (cur && !(cur in rooms)) {
    fixes.push(`已清除无效开局地点「${cur}」（不在地点表）`);
    delete content.startRoom;
  }
  if (Array.isArray(content.npcs)) {
    for (const n of content.npcs) {
      if (!n || typeof n !== "object") continue;
      const home = typeof n.home === "string" ? n.home.trim() : "";
      if (home && !(home in rooms)) {
        const label = (typeof n.name === "string" && n.name.trim()) || n.id || "?";
        fixes.push(`已清除人物「${label}」的无效 home「${home}」`);
        delete (n as { home?: string }).home;
      }
    }
  }
  healNpcFactionRefs(content, fixes);
  return fixes;
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
  // 功能注释：dependencies 非数组时也要收成字符串列表，禁止 beginAuthorPreviewMod 里 .filter 崩预览入口
  if (m.dependencies !== undefined) {
    m.dependencies = coerceStringList(coerceArray(m.dependencies)) ?? [];
  }

  if (m.content && typeof m.content === "object") {
    m.content = deepCoerceContent(m.content) as ModContent;
    // 功能注释：房间 name 空时回落 id；desc 必填，空则按地名补一句
    const rooms = m.content.rooms;
    if (rooms && typeof rooms === "object") {
      for (const [id, room] of Object.entries(rooms)) {
        if (!room || typeof room !== "object") continue;
        const r = room as { name?: string; desc?: string };
        if (!r.name) r.name = id;
        if (typeof r.desc !== "string") r.desc = "";
      }
      ensureRoomSceneDescs(rooms);
    }
    // 功能注释：只清除悬空引用，不替作者猜开局地点；预览/发布必须由作者显式勾选。
    healModRoomRefs(m.content);
    // 功能注释：剔除档案/支线底栏项（本体入口）；label 被洗成空时回落 id
    const tabs = m.content.navTabs;
    if (Array.isArray(tabs)) {
      m.content.navTabs = tabs.filter((row) => {
        if (!row || typeof row !== "object") return false;
        const id = String((row as { id?: string }).id ?? "");
        return id !== "sim" && id !== "quest";
      });
      for (const row of m.content.navTabs) {
        if (!row || typeof row !== "object") continue;
        const t = row as { id?: string; label?: string };
        if (!String(t.label ?? "").trim() && t.id) t.label = String(t.id);
      }
      if (!m.content.navTabs.length) delete m.content.navTabs;
    }
  }

  return m;
}
