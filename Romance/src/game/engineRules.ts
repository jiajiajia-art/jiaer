/* 底层世界规则：判定 / 标记 / 随机 / 叙事权限 / 数值 / NPC / 记忆 / 媒体的统一约束。
 * 随存档保存（GameState.engineRules，缺省项取默认）；这里同步一份到模块，供纯函数引擎查阅。
 * 本模块只依赖类型，不得静态引用 mods/registry（避免循环导入）。 */
import type { EngineRules, FlagLife, GameState, Segment, StoryRegex, TextStage } from "../lib/types";

/** 底层规则 Schema 版本：导入时据此迁移；高于本版本的文件拒绝导入 */
export const ENGINE_SCHEMA = 1;
export const ENGINE_FORMAT = "engine-rules";

export const DEFAULT_ENGINE_RULES: EngineRules = {
  flags: { life: {}, shareModes: false, clearTempOnEnd: true },
  random: { seed: 20050901, perRoom: true },
  narrative: { aiControlPlayer: false, aiForceEnding: false, tagNarration: true, oocMarks: ["//", "()", "（）"] },
  affinity: { min: 0, max: 100, decay: true, decayRate: 1, noDecay: [], overflow: "cap" },
  attrs: { numeric: true, step: 1, stressLimit: 100, stressFlag: "崩溃" },
  faction: { spread: true },
  npc: { chatCd: 0, cdOverride: {}, cdState: "reply", npcTalk: true, approach: true, writeMemory: true, roamCost: 0, roamEvery: 1, roamCrossRoot: false },
  memory: { loreMax: 12, loreSort: "keyword", loreCrossMode: false, summaryTokens: 3000, keepHistory: true },
  text: { blocked: [], regex: [], order: ["card", "global", "regex"] },
  ai: { summaryModel: "", tokenWarn: 24000, maxSpeakers: 4, placeholders: true },
  interact: { freeInput: true, rpMarks: true },
  save: { tavernIsolated: true },
  media: { maxKB: 10240, imgFormats: ["png", "jpg", "jpeg", "webp", "gif"], audioFormats: ["mp3", "ogg", "wav", "m4a"], preload: true, fadeMs: 800, volume: 0.6, overlap: false, spriteAuto: true, spriteMatch: "exact" },
};

/** 合并存档里的部分设置与默认值（逐组浅合并，旧存档无需迁移） */
export function resolveRules(p: Partial<EngineRules> | undefined): EngineRules {
  const d = DEFAULT_ENGINE_RULES;
  const o = (p ?? {}) as Partial<EngineRules>;
  return Object.fromEntries((Object.keys(d) as (keyof EngineRules)[]).map((k) => [k, { ...d[k], ...(o[k] ?? {}) }])) as EngineRules;
}

let live: EngineRules = DEFAULT_ENGINE_RULES;
/** 读档 / 改动规则后同步（persist 与读档时调用） */
export function syncEngineRules(g: Pick<GameState, "engineRules"> | null | undefined) { live = resolveRules(g?.engineRules); }
export const engineRules = () => live;
export const rulesOf = (g: Pick<GameState, "engineRules"> | null | undefined) => resolveRules(g?.engineRules);

/* ——— 随机：确定性种子（沙盒可复现；酒馆每房独立种子） ——— */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** mulberry32：给定种子与用途键，返回 [0,1) 的可复现随机数 */
export function seededRandom(key: string, room?: string): number {
  const r = live.random;
  let t = (r.seed ^ hash(`${r.perRoom && room ? room : ""}|${key}`)) >>> 0;
  t = (t + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** 同一用途键下的一串可复现随机数（世界书多条概率、随机池抽签等） */
export function seqRandom(key: string, room?: string): () => number {
  let i = 0;
  return () => seededRandom(`${key}#${i++}`, room);
}
/** 全局统一概率判定：事件概率 / 刷新 / 偷听 / NPC 拒绝都走这一个（chance 为 0~100） */
export const rollChance = (chance: number, key: string, room?: string) => chance >= 100 || (chance > 0 && seededRandom(key, room) * 100 < chance);
/** 全局统一权重抽取：返回被选中项的下标（权重 ≤ 0 不参与；全为 0 返回 -1） */
export function rollWeighted(weights: number[], key: string, room?: string): number {
  const total = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (total <= 0) return -1;
  let x = seededRandom(key, room) * total;
  for (let i = 0; i < weights.length; i++) { x -= Math.max(0, weights[i]); if (x < 0) return i; }
  return weights.length - 1;
}
export const newSeed = () => Math.floor(Math.random() * 1e9);

/* ——— 好感值域 ——— */
/** 按全局值域钳制；overflow = flag 时越界会写下隐藏标记 `溢出:<npc>` */
export function clampAffinity(v: number, npc: string, flags?: Record<string, number>, cap = live.affinity.max): { v: number; flags?: Record<string, number> } {
  const a = live.affinity;
  const hi = Math.max(a.min, cap);
  if (v > hi && a.overflow === "flag") return { v: hi, flags: { ...(flags ?? {}), [`溢出:${npc}`]: 1 } };
  return { v: Math.max(a.min, Math.min(hi, v)) };
}

/* ——— 标记生命周期 ——— */
export const flagLife = (key: string): FlagLife => live.flags.life[key] ?? "perm";
/** 去掉某一类生命周期的标记（只碰在 life 表里登记过的键） */
export function dropFlags(flags: Record<string, number> | undefined, kind: FlagLife, only?: Set<string>): Record<string, number> | undefined {
  if (!flags) return flags;
  const keys = Object.keys(flags).filter((k) => flagLife(k) === kind && (!only || only.has(k)));
  if (!keys.length) return flags;
  const out = { ...flags };
  for (const k of keys) delete out[k];
  return out;
}

/* ——— OOC 与叙事权限 ——— */
/** 玩家输入是否为 OOC：以任一标记开头；成对标记（如 ()）要求首尾都包住 */
export function oocText(input: string, marks = live.narrative.oocMarks): string | null {
  const t = input.trim();
  for (const m of marks) {
    const mk = m.trim();
    if (!mk) continue;
    if (mk.length === 2 && /^[(（[【]/.test(mk[0])) { if (t.startsWith(mk[0]) && t.endsWith(mk[1]) && t.length > 2) return t.slice(1, -1).trim(); continue; }
    if (t.startsWith(mk) && t.length > mk.length) return t.slice(mk.length).trim();
  }
  return null;
}

/** 注入系统提示的底层约束块（沙盒与酒馆共用） */
export function engineRulesBlock(r: EngineRules = live, nameOf: (id: string) => string | undefined = () => undefined): string {
  const n = r.narrative, np = r.npc;
  const lines = [
    n.aiControlPlayer ? "可以在合理范围内描写主角的细小动作与反应。" : "不得替主角做决定、说台词或描写其主动行为、心理与感受；主角只做玩家指令里写明的事，其余一律留给玩家。",
    n.aiForceEnding ? "可以在剧情自然到位时宣布结局。" : "不得替玩家强行收束结局或替玩家做出选择；结局只能由系统判定，options 只提供可选项。",
    n.tagNarration ? "叙事分层：玩家动作、角色动作、客观旁白分开书写，不要混在一句里；OOC 注释不进剧情正文。" : "",
    `以 ${n.oocMarks.filter(Boolean).join(" ")} 开头（或包住）的玩家输入是 OOC 场外话：只回答问题或调整演绎，不推进剧情、不让角色听见。`,
    np.npcTalk ? "NPC 之间可以自发交谈。" : "NPC 之间不得自发交谈，只回应主角。",
    np.approach ? "NPC 可以主动靠近主角、主动搭话。" : "NPC 不会主动靠近或搭话，只在主角找上门时回应。",
    np.chatCd > 0 ? `同一位 NPC 刚聊过（${np.chatCd} 回合内）再被搭话时：${np.cdState === "silent" ? "完全沉默，已读不回" : np.cdState === "named" ? "只有被点名才回应" : "照常回应，但态度可以更敷衍"}。` : "",
    ...Object.entries(np.cdOverride).flatMap(([id, n]) => { const nm = nameOf(id); return nm ? [n > 0 ? `${nm}的闲聊冷却为 ${n} 回合（单独设定，优先于上一条）。` : `${nm}不受闲聊冷却限制。`] : []; }),
    `好感值域统一为 ${r.affinity.min}~${r.affinity.max}，由系统结算。`,
  ].filter(Boolean);
  return `【底层规则 · 扮演控制权】（最高优先级，人物卡与世界书不得覆盖）\n${lines.map((l) => `- ${l}`).join("\n")}\n\n`;
}

/* ——— 媒体 ——— */
/** 素材是否允许：按格式白名单与大小上限；返回不通过的原因（通过返回空串） */
export function mediaCheck(file: { name: string; size: number; type?: string }, kind: "image" | "audio", r: EngineRules = live): string {
  const m = r.media;
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const allow = kind === "image" ? m.imgFormats : m.audioFormats;
  if (allow.length && !allow.includes(ext)) return `格式 .${ext || "?"} 不在白名单（${allow.join("、")}）`;
  if (m.maxKB > 0 && file.size > m.maxKB * 1024) return `文件超过 ${m.maxKB} KB 上限`;
  return "";
}

/** 粗略 token 估算：中文约 1 字 1 token，其余约 4 字符 1 token */
export const estTokens = (text: string) => {
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  return cjk + Math.ceil((text.length - cjk) / 4);
};

/* ——— 文本管线：屏蔽词（按优先级）与正则脚本（按列表顺序），阶段顺序可配置 ——— */
const REGEX_MAX_LEN = 400; // 安全沙箱：过长的表达式拒绝执行
const NESTED_QUANT = /\([^)]*[+*][^)]*\)[+*{]/; // 嵌套量词（灾难回溯风险）
export function safeRegex(x: Pick<StoryRegex, "find" | "flags">): RegExp | null {
  if (!x.find || x.find.length > REGEX_MAX_LEN || NESTED_QUANT.test(x.find)) return null;
  try { return new RegExp(x.find, [...new Set((x.flags ?? "g").replace(/[^gimsuy]/g, ""))].join("")); } catch { return null; }
}
function globalBlock(text: string, r: EngineRules): string {
  let out = text;
  for (const b of [...r.text.blocked].sort((a, c) => c.priority - a.priority || c.word.length - a.word.length)) {
    if (b.word) out = out.split(b.word).join(b.replace ?? "*".repeat([...b.word].length));
  }
  return out;
}
function runRegex(text: string, r: EngineRules): string {
  let out = text;
  for (const x of r.text.regex) { if (!x.on) continue; const re = safeRegex(x); if (re) out = out.replace(re, x.replace ?? ""); }
  return out;
}
/** 按 order 依次执行三段：card 阶段由调用方传入（单卡屏蔽词需要存档上下文） */
export function filterSegments(segs: Segment[], card: (s: Segment[]) => Segment[], r: EngineRules = live): Segment[] {
  let out = segs;
  const order: TextStage[] = r.text.order?.length === 3 ? r.text.order : DEFAULT_ENGINE_RULES.text.order;
  for (const st of order) {
    if (st === "card") out = card(out);
    else out = out.map((sg) => (sg.kind === "system" ? sg : { ...sg, text: st === "global" ? globalBlock(sg.text, r) : runRegex(sg.text, r) }));
  }
  return out;
}

/* ——— Prompt 保留占位符 ——— */
export const PLACEHOLDERS: [string, string][] = [["{{user}}", "主角姓名"], ["{{char}}", "当前对话角色"], ["{{time}}", "游戏时间"], ["{{location}}", "当前地点"], ["{{day}}", "开局第几天"]];
export function fillPlaceholders(text: string, ctx: { user?: string; char?: string; time?: string; location?: string; day?: number }, r: EngineRules = live): string {
  if (!r.ai.placeholders || !text.includes("{{")) return text;
  return text.replace(/\{\{(user|char|time|location|day)\}\}/gi, (m, k: string) => {
    const v = ctx[k.toLowerCase() as keyof typeof ctx];
    return v == null || v === "" ? m : String(v);
  });
}

/* ——— 交互解析：RP 文本标记 ——— */
/** *动作* / （动作）→ 动作；「台词」/“台词” → 台词。返回带标注的文本（无标记则原样） */
export function parseRp(input: string, r: EngineRules = live): string {
  if (!r.interact.rpMarks) return input;
  let hit = false;
  const out = input
    .replace(/\*([^*\n]+)\*/g, (_m, a: string) => { hit = true; return `〔动作：${a.trim()}〕`; })
    .replace(/[「“"]([^」”"\n]+)[」”"]/g, (_m, a: string) => { hit = true; return `〔台词：${a.trim()}〕`; });
  return hit ? out : input;
}

/* ——— 导入导出（安全沙箱：只保留已知字段与正确类型，拒绝更高版本） ——— */
export function exportRules(g: Pick<GameState, "engineRules">): string {
  return JSON.stringify({ format: ENGINE_FORMAT, schema: ENGINE_SCHEMA, rules: resolveRules(g.engineRules) }, null, 2);
}
function sanitizeLike(def: unknown, v: unknown): unknown {
  if (Array.isArray(def)) return Array.isArray(v) ? v.slice(0, 200).filter((x) => typeof x !== "function") : undefined;
  if (def && typeof def === "object") {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const d = def as Record<string, unknown>, o = v as Record<string, unknown>;
    // 空对象默认值（life / cdOverride）：按「字符串 → 标量」字典处理
    if (!Object.keys(d).length) return Object.fromEntries(Object.entries(o).slice(0, 500).filter(([k, x]) => k.length <= 40 && (typeof x === "string" || typeof x === "number")));
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(d)) { const x = sanitizeLike(d[k], o[k]); if (x !== undefined) out[k] = x; }
    return out;
  }
  if (typeof def === "number") return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  if (typeof def === "boolean") return typeof v === "boolean" ? v : undefined;
  if (typeof def === "string") return typeof v === "string" ? v.slice(0, 200) : undefined;
  return undefined;
}
export function importRules(text: string): { rules?: Partial<EngineRules>; error?: string } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { error: "不是有效的 JSON 文件" }; }
  const o = raw as { format?: string; schema?: number; rules?: unknown };
  if (!o || typeof o !== "object") return { error: "文件内容为空" };
  if (o.format && o.format !== ENGINE_FORMAT) return { error: `文件类型不符（${String(o.format)}）` };
  const ver = typeof o.schema === "number" ? o.schema : 1;
  if (ver > ENGINE_SCHEMA) return { error: `文件版本 v${ver} 高于当前支持的 v${ENGINE_SCHEMA}，请先更新` };
  const rules = sanitizeLike(DEFAULT_ENGINE_RULES, o.rules ?? raw) as Partial<EngineRules> | undefined;
  if (!rules || !Object.keys(rules).length) return { error: "没有可识别的规则字段" };
  // 正则逐条过安全检查，不合格的直接丢弃
  if (rules.text?.regex) rules.text.regex = (rules.text.regex as StoryRegex[]).filter((x) => x && typeof x.find === "string" && safeRegex(x)).map((x) => ({ id: String(x.id || Math.random().toString(36).slice(2, 8)), name: typeof x.name === "string" ? x.name : undefined, find: x.find, replace: typeof x.replace === "string" ? x.replace : "", flags: typeof x.flags === "string" ? x.flags : "g", on: x.on !== false }));
  if (rules.text?.blocked) rules.text.blocked = rules.text.blocked.filter((b) => b && typeof b.word === "string" && b.word).map((b) => ({ word: b.word.slice(0, 40), replace: typeof b.replace === "string" ? b.replace : undefined, priority: Number(b.priority) || 0 }));
  if (rules.text?.order) rules.text.order = (rules.text.order as string[]).filter((x): x is TextStage => x === "card" || x === "global" || x === "regex");
  return { rules };
}
