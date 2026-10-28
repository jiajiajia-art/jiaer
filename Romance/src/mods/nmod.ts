/* ═══════════════ .nmod 扩展包 ═══════════════
 * 打包 / 解析 / 安全清洗 / 依赖校验 / ID 冲突预览 / 增量更新 / 体检 / 引用链路 / 模板装入与卸载 / 工程反向打包 / 皮肤隔离。
 * 安全边界：.nmod 只是数据。导入时剥离 engineRules 等底层规则字段、拒绝任何脚本与事件属性，CSS 加作用域前缀。 */
import type { GameState } from "../lib/types";
import type { AnimPreset, Mod, ModCategory, ModContent, ModExt, ModSkin } from "./types";
import { NATIVE_DEPS } from "./types";
import { allMods, cmpVer, getSelection, modById, selectedFeature, upsertUserMod, validateMod } from "./registry";
import { buildRegistry, hasExt, modCategory, modLog } from "./ext";
import { auditStory } from "../game/refAudit";
import { commProblems } from "./comm";

export const NMOD_FORMAT = "nmod";
export const NMOD_SCHEMA = 1;
export const NMOD_MAX_BYTES = 8 * 1024 * 1024;
export const CATEGORY_LABEL: Record<ModCategory, string> = { template: "模板库 MOD", world: "完整世界 MOD", feature: "功能玩法 MOD" };

export type NmodFile = {
  format: typeof NMOD_FORMAT; schema: number; category: ModCategory; packedAt: number; engine: "star";
  manifest: { id: string; name: string; version: string; author?: string; description?: string; cover?: string; deps: { id: string; min?: string }[]; nativeDeps: string[]; contents: string };
  mod: Mod;
};

/* —— 打包 —— */
export function packNmod(m: Mod): string {
  const { builtin: _b, origin: _o, ...rest } = m;
  void _b; void _o;
  const mod = sanitizeDeep(JSON.parse(JSON.stringify(rest))) as Mod;
  const category = modCategory(m);
  const deps = [...(m.deps ?? []), ...(m.dependencies ?? []).filter((d) => !(m.deps ?? []).some((x) => x.id === d)).map((id) => ({ id }))];
  const file: NmodFile = {
    format: NMOD_FORMAT, schema: NMOD_SCHEMA, category, packedAt: Date.now(), engine: "star",
    manifest: { id: m.id, name: m.name, version: m.version, author: m.author, description: m.description, cover: m.cover ?? m.icon, deps, nativeDeps: m.nativeDeps ?? [], contents: contentsLine(m) },
    mod: { ...mod, category },
  };
  return JSON.stringify(file, null, 2);
}
export function contentsLine(m: Mod): string {
  const c = m.content, e = m.ext ?? {};
  const n = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0);
  return [
    n(c.fixedEvents) + n(c.events) && `剧情 ${n(c.fixedEvents) + n(c.events)}`, n(c.rooms) && `地点 / RP 房间 ${n(c.rooms)}`, n(c.npcs) && `角色 ${n(c.npcs)}`,
    n(c.items) && `道具 ${n(c.items)}`, n(c.worldBook) + n(c.lore) && `Lore ${n(c.worldBook) + n(c.lore)}`, n(c.gameRules) && `触发器模板 ${n(c.gameRules)}`,
    n(c.endings) && `结局 ${n(c.endings)}`, n(c.storylines) && `主线 ${n(c.storylines)}`, n(c.cgs) && `CG ${n(c.cgs)}`, n(c.factions) && `阵营 ${n(c.factions)}`,
    (c.theme || c.lookRules?.length || e.skin) && "皮肤 / 动画", n(e.actions) && `动作 ${n(e.actions)}`, n(e.conds) && `条件算子 ${n(e.conds)}`,
    n(e.panels) && `面板 ${n(e.panels)}`, n(e.vars) && `私有变量 ${n(e.vars)}`, e.demo && "演示工程",
  ].filter(Boolean).join(" · ") || "空包";
}

/* —— 安全清洗 —— */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype", "engineRules"]);
const JS_RE = /<\s*script|javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|<\s*(iframe|object|embed|link|meta|base)\b|\son[a-z]+\s*=|srcdoc\s*=/i;
function sanitizeDeep(v: unknown, path = "", errs?: string[], depth = 0): unknown {
  if (depth > 40) { errs?.push(`${path} 嵌套过深`); return undefined; }
  if (typeof v === "string") { if (JS_RE.test(v)) { errs?.push(`${path || "某字段"} 含脚本或事件属性（禁止 JS 注入）`); return ""; } return v; }
  if (Array.isArray(v)) return v.map((x, i) => sanitizeDeep(x, `${path}[${i}]`, errs, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_KEYS.has(k)) { errs?.push(`${path ? path + "." : ""}${k}：MOD 不能修改编辑器底层规则，已剥离`); continue; }
      out[k] = sanitizeDeep(x, path ? `${path}.${k}` : k, errs, depth + 1);
    }
    return out;
  }
  return v;
}

export type ParsedNmod = { ok: boolean; errors: string[]; warnings: string[]; mod?: Mod; category?: ModCategory; meta?: NmodFile["manifest"] };
export function parseNmod(text: string): ParsedNmod {
  if (new Blob([text]).size > NMOD_MAX_BYTES) return { ok: false, errors: [`文件超过 ${NMOD_MAX_BYTES / 1024 / 1024} MB`], warnings: [] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, errors: [`解析失败：${(e as Error).message}`], warnings: [] }; }
  const warnings: string[] = [];
  let modRaw: unknown = raw;
  let meta: NmodFile["manifest"] | undefined;
  const f = raw as Partial<NmodFile>;
  if (f && typeof f === "object" && f.format === NMOD_FORMAT) {
    if (typeof f.schema !== "number" || f.schema > NMOD_SCHEMA) return { ok: false, errors: [`.nmod 版本 ${f.schema} 高于本引擎支持的 ${NMOD_SCHEMA}，请更新游戏`], warnings };
    modRaw = f.mod;
    meta = f.manifest;
  } else warnings.push("这是旧版 .json 模组，已按 .nmod 兼容导入");
  const sec: string[] = [];
  const mod = sanitizeDeep(modRaw, "", sec) as Mod;
  const fatal = sec.filter((x) => x.includes("JS 注入"));
  warnings.push(...sec.filter((x) => !x.includes("JS 注入")));
  if (fatal.length) return { ok: false, errors: fatal.slice(0, 20), warnings };
  const errors = validateMod(mod);
  errors.push(...validateExt(mod.ext));
  if (mod?.ext?.skin?.css) errors.push(...cssProblems(mod.ext.skin.css));
  if (errors.length) return { ok: false, errors, warnings };
  const category = (["template", "world", "feature"] as const).includes(f.category as ModCategory) ? f.category! : modCategory(mod);
  if (category === "world" && mod.kind !== "world") errors.push("完整世界 MOD 的 kind 须为 world");
  if (category !== "world" && mod.kind === "world") warnings.push("这是世界观包：将作为完整世界导入");
  return { ok: !errors.length, errors, warnings, mod: { ...mod, category: mod.kind === "world" ? "world" : category }, category, meta };
}

export function validateExt(e: ModExt | undefined): string[] {
  if (e === undefined) return [];
  const errs: string[] = [];
  if (!e || typeof e !== "object" || Array.isArray(e)) return ["ext 须为对象"];
  const arrs = ["vars", "config", "tables", "actions", "conds", "components", "panels", "grants"] as const;
  for (const k of arrs) if (e[k] !== undefined && !Array.isArray(e[k])) errs.push(`ext.${k} 须为数组`);
  (e.vars ?? []).forEach((v, i) => { if (!v?.key) errs.push(`ext.vars[${i}] 缺少 key`); });
  (e.config ?? []).forEach((v, i) => { if (!v?.key) errs.push(`ext.config[${i}] 缺少 key`); if (typeof v?.def !== "number") errs.push(`ext.config[${i}].def 须为数字`); });
  for (const k of ["tables", "actions", "conds", "components", "panels"] as const) (e[k] ?? []).forEach((v: { id?: unknown }, i: number) => { if (!v || typeof v.id !== "string" || !v.id) errs.push(`ext.${k}[${i}] 缺少 id`); });
  (e.actions ?? []).forEach((a, i) => { if (!Array.isArray(a?.branches)) errs.push(`ext.actions[${i}].branches 须为数组`); });
  (e.conds ?? []).forEach((a, i) => { if (!Array.isArray(a?.conds)) errs.push(`ext.conds[${i}].conds 须为数组`); });
  // 通信声明：只能是静态数据
  if (e.exports !== undefined && (typeof e.exports !== "object" || Array.isArray(e.exports))) errs.push("ext.exports 须为对象");
  for (const k of ["fields", "actions", "events", "presets"] as const) if (e.exports?.[k] !== undefined && !Array.isArray(e.exports[k])) errs.push(`ext.exports.${k} 须为数组`);
  for (const k of ["imports", "subs"] as const) if (e[k] !== undefined && !Array.isArray(e[k])) errs.push(`ext.${k} 须为数组`);
  (e.imports ?? []).forEach((v, i) => { if (!v?.mod || !Array.isArray(v.items)) errs.push(`ext.imports[${i}] 须含 mod 与 items`); });
  (e.subs ?? []).forEach((v, i) => { if (!v?.id || !v.mod || !v.event || !v.action) errs.push(`ext.subs[${i}] 须含 id / mod / event / action`); });
  return errs;
}

/* —— 皮肤：CSS 作用域隔离 + 动画预设 —— */
export function cssProblems(css: string): string[] {
  const p: string[] = [];
  if (/@import/i.test(css)) p.push("皮肤 CSS 不允许 @import");
  if (/expression\s*\(|behavior\s*:|-moz-binding|javascript:/i.test(css)) p.push("皮肤 CSS 含可执行脚本写法（expression / behavior / binding），已禁止");
  if (/url\(\s*["']?(?!data:image\/|https:\/\/)/i.test(css)) p.push("皮肤 CSS 的 url() 只允许 https:// 或 data:image/ 图片");
  if (/\[\s*value/i.test(css)) p.push("皮肤 CSS 不允许读取输入框 value 的选择器");
  if (/position\s*:\s*fixed/i.test(css)) p.push("皮肤 CSS 不允许 position: fixed（会盖住编辑器本体）");
  return p;
}
export const safeId = (id: string) => id.replace(/[^a-z0-9_-]/gi, "");
/* 每条选择器都加 [data-nmod="id"] 前缀；@keyframes 重命名为 nm-<id>-<name>，只在 MOD 自己的面板里生效 */
export function scopeCss(css: string, modId: string): string {
  if (cssProblems(css).length) return "";
  const sid = safeId(modId);
  const scope = `[data-nmod="${sid}"]`;
  const names = new Set<string>();
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  css.replace(/@keyframes\s+([\w-]+)/g, (_, n: string) => { names.add(n); return ""; });
  let out = "", i = 0;
  const pre = (sel: string) => sel.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x === ":root" || x === ":scope" ? scope : x.startsWith("&") ? `${scope}${x.slice(1)}` : `${scope} ${x}`)).join(", ");
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    // 找到匹配的右括号（支持一层嵌套：@media / @keyframes）
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (/^@keyframes/i.test(head)) out += `@keyframes nm-${sid}-${head.replace(/@keyframes\s+/i, "").trim()}{${body}}\n`;
    else if (/^@media|^@supports/i.test(head)) out += `${head}{${scopeCss(body, modId)}}\n`;
    else if (head.startsWith("@")) { /* 其余 at-rule（@font-face 等）丢弃 */ }
    else out += `${pre(head)}{${body}}\n`;
    i = j;
  }
  for (const n of names) out = out.replace(new RegExp(`(animation(?:-name)?\\s*:[^;{}]*?)\\b${n}\\b`, "g"), `$1nm-${sid}-${n}`);
  return out;
}
export const ANIM_LABEL: Record<AnimPreset, string> = { none: "无", fade: "淡入", slide: "上滑", pop: "弹出", pulse: "呼吸", float: "漂浮", glow: "辉光", shimmer: "流光" };
const ANIM_KF: Record<Exclude<AnimPreset, "none">, string> = {
  fade: "from{opacity:0}to{opacity:1}",
  slide: "from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}",
  pop: "0%{opacity:0;transform:scale(.9)}70%{transform:scale(1.03)}100%{opacity:1;transform:none}",
  pulse: "0%,100%{transform:scale(1)}50%{transform:scale(1.03)}",
  float: "0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}",
  glow: "0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--nm-accent) 0%,transparent)}50%{box-shadow:0 0 18px 2px color-mix(in srgb,var(--nm-accent) 45%,transparent)}",
  shimmer: "from{background-position:-200% 0}to{background-position:200% 0}",
};
const LOOP: AnimPreset[] = ["pulse", "float", "glow", "shimmer"];
const FONT: Record<NonNullable<ModSkin["font"]>, string> = { inherit: "inherit", serif: "var(--font-serif, serif)", sans: "system-ui, sans-serif", mono: "ui-monospace, monospace", round: "\"Nunito\", \"PingFang SC\", sans-serif" };
const SHADOW: Record<NonNullable<ModSkin["shadow"]>, string> = { none: "none", soft: "0 2px 10px rgb(0 0 0 / .08)", lift: "0 10px 28px -10px rgb(0 0 0 / .35)", neon: "0 0 0 1px var(--nm-accent), 0 0 22px -4px var(--nm-accent)" };
const PATTERN: Record<NonNullable<ModSkin["pattern"]>, string> = {
  none: "none",
  dots: "radial-gradient(color-mix(in srgb,var(--nm-fg) 12%,transparent) 1px,transparent 1.5px) 0 0/14px 14px",
  grid: "linear-gradient(color-mix(in srgb,var(--nm-fg) 8%,transparent) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,color-mix(in srgb,var(--nm-fg) 8%,transparent) 1px,transparent 1px) 0 0/18px 18px",
  stripes: "repeating-linear-gradient(45deg,color-mix(in srgb,var(--nm-fg) 6%,transparent) 0 6px,transparent 6px 14px)",
  paper: "linear-gradient(color-mix(in srgb,var(--nm-accent) 6%,transparent),transparent 40%)",
};
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\)|hsla?\([\d\s.,%/deg]+\)|var\(--[a-z0-9-]+\)|[a-z]+)$/i;
const col = (v: string | undefined, fb: string) => (v && COLOR_RE.test(v.trim()) ? v.trim() : fb);
/* 完整皮肤样式表：基础变量 + 面板 / 组件外观 + 动画 + 作者 CSS（全部限定在 [data-nmod] 内） */
export function skinCss(modId: string, s: ModSkin | undefined): string {
  const sid = safeId(modId);
  const sc = `[data-nmod="${sid}"]`;
  const k = s ?? {};
  const dur = Math.max(100, Math.min(4000, k.duration ?? 520));
  let css = `${sc}{--nm-bg:${col(k.bg, "var(--paper)")};--nm-fg:${col(k.fg, "var(--ink)")};--nm-accent:${col(k.accent, "var(--jade)")};--nm-border:${col(k.border, "var(--line)")};--nm-radius:${Math.max(0, Math.min(32, k.radius ?? 16))}px;`
    + `color:var(--nm-fg);font-family:${FONT[k.font ?? "inherit"]};}\n`
    + `${sc} .nm-panel{background:${PATTERN[k.pattern ?? "none"] === "none" ? "" : PATTERN[k.pattern ?? "none"] + ","}var(--nm-bg);border:1px solid var(--nm-border);border-radius:var(--nm-radius);box-shadow:${SHADOW[k.shadow ?? "soft"]};}\n`
    + `${sc} .nm-comp{border-radius:calc(var(--nm-radius) * .6);}\n${sc} .nm-accent{color:var(--nm-accent);}\n${sc} .nm-fill{background:var(--nm-accent);}\n`;
  const anim = (p: AnimPreset | undefined, cls: string) => {
    if (!p || p === "none") return;
    css += `@keyframes nm-${sid}-${p}{${ANIM_KF[p]}}\n`;
    const loop = LOOP.includes(p);
    css += `${sc} ${cls}{animation:nm-${sid}-${p} ${dur}ms ${loop ? "ease-in-out infinite" : "cubic-bezier(.2,.8,.2,1) both"};${p === "shimmer" ? "background-image:linear-gradient(110deg,transparent 30%,color-mix(in srgb,var(--nm-accent) 18%,transparent) 50%,transparent 70%);background-size:200% 100%;" : ""}}\n`;
  };
  anim(k.panelAnim, ".nm-panel");
  anim(k.componentAnim, ".nm-comp");
  css += `@media (prefers-reduced-motion: reduce){${sc} *{animation:none !important;}}\n`;
  if (k.css?.trim()) css += scopeCss(k.css, modId);
  return css;
}

/* —— 导入预览：依赖 / ID 冲突 / 增量差异 —— */
export type ResKind = "剧情" | "事件库" | "结局" | "世界书" | "主线" | "角色" | "道具" | "通告" | "地点" | "玩法规则" | "CG" | "阵营" | "动作" | "条件算子" | "组件" | "面板";
type ResRef = { kind: ResKind; id: string; name: string; data: unknown };
export function resourcesOf(m: Mod): ResRef[] {
  const c = m.content ?? {}, e = m.ext ?? {};
  const out: ResRef[] = [];
  const add = (kind: ResKind, list: { id: string; name?: string; title?: string; label?: string }[] | undefined) => {
    for (const x of list ?? []) if (x?.id) out.push({ kind, id: x.id, name: x.name || x.title || x.label || x.id, data: x });
  };
  add("剧情", c.fixedEvents); add("事件库", c.events); add("结局", c.endings); add("世界书", c.worldBook); add("主线", c.storylines);
  add("角色", c.npcs as { id: string; name?: string }[]); add("道具", c.items as { id: string; name?: string }[]); add("通告", c.gigs as { id: string; name?: string }[]);
  for (const [id, r] of Object.entries(c.rooms ?? {})) out.push({ kind: "地点", id, name: (r as { name?: string }).name || id, data: r });
  add("玩法规则", c.gameRules as { id: string; name?: string }[]); add("CG", c.cgs); add("阵营", c.factions);
  add("动作", e.actions); add("条件算子", e.conds); add("组件", e.components); add("面板", e.panels);
  return out;
}
export type DepCheck = { id: string; need?: string; have?: string; ok: boolean; text: string };
export type ImportPreview = {
  mod: Mod; existing?: Mod; deps: DepCheck[]; blocked: boolean;
  conflicts: { kind: ResKind; id: string; name: string; other: string }[];
  diff?: { added: string[]; changed: string[]; removed: string[]; edited: string[] };
};
const hash = (v: unknown) => { const s = JSON.stringify(v) ?? ""; let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const rkey = (r: { kind: string; id: string }) => `${r.kind}:${r.id}`;
export function previewImport(mod: Mod): ImportPreview {
  const existing = modById(mod.id);
  const deps: DepCheck[] = [];
  const allDeps = [...(mod.deps ?? []), ...(mod.dependencies ?? []).filter((d) => !(mod.deps ?? []).some((x) => x.id === d)).map((id) => ({ id, min: undefined as string | undefined }))];
  for (const d of allDeps) {
    const dm = modById(d.id);
    if (!dm) deps.push({ id: d.id, need: d.min, ok: false, text: `缺少前置「${d.id}」${d.min ? `（≥ ${d.min}）` : ""}` });
    else if (d.min && cmpVer(dm.version, d.min) < 0) deps.push({ id: d.id, need: d.min, have: dm.version, ok: false, text: `「${dm.name}」版本 ${dm.version} 低于要求 ${d.min}` });
    else deps.push({ id: d.id, need: d.min, have: dm.version, ok: true, text: `「${dm.name}」v${dm.version}` });
  }
  for (const n of mod.nativeDeps ?? []) {
    const known = (NATIVE_DEPS as readonly string[]).includes(n);
    const off = ["phone", "career", "pregnancy", "cars", "transport"].includes(n) && !selectedFeature(n as "phone");
    deps.push({ id: `native:${n}`, ok: known && !off, text: !known ? `未知原生组件「${n}」` : off ? `原生组件「${n}」在当前世界已关闭` : `原生组件「${n}」` });
  }
  const mine = resourcesOf(mod);
  const conflicts: ImportPreview["conflicts"] = [];
  for (const o of allMods()) {
    if (o.id === mod.id) continue;
    const theirs = new Set(resourcesOf(o).map(rkey));
    for (const r of mine) if (theirs.has(rkey(r))) conflicts.push({ kind: r.kind, id: r.id, name: r.name, other: o.name });
  }
  let diff: ImportPreview["diff"];
  if (existing) {
    const old = new Map(resourcesOf(existing).map((r) => [rkey(r), r]));
    const base = existing.origin?.base ?? {};
    const nu = new Map(mine.map((r) => [rkey(r), r]));
    diff = { added: [], changed: [], removed: [], edited: [] };
    for (const [k, r] of nu) { const o = old.get(k); if (!o) diff.added.push(`${r.kind}·${r.name}`); else if (hash(o.data) !== hash(r.data)) diff.changed.push(`${r.kind}·${r.name}`); }
    for (const [k, r] of old) {
      if (!nu.has(k)) diff.removed.push(`${r.kind}·${r.name}`);
      if (base[k] && base[k] !== hash(r.data)) diff.edited.push(`${r.kind}·${r.name}`);
    }
  }
  return { mod, existing, deps, blocked: deps.some((d) => !d.ok && !d.id.startsWith("native:")), conflicts, diff };
}

export type ImportOpts = { strategy: "rename" | "skip" | "overwrite"; keepEdits: boolean };
/* 深度替换 id 引用（只替换与旧 id 完全相等的字符串值，及 rooms 的键） */
function renameRefs<T>(v: T, map: Map<string, string>): T {
  if (typeof v === "string") return (map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map((x) => renameRefs(x, map)) as T;
  if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) o[map.get(k) ?? k] = renameRefs(x, map); return o as T; }
  return v;
}
const LISTS: Partial<Record<ResKind, keyof ModContent>> = { 剧情: "fixedEvents", 事件库: "events", 结局: "endings", 世界书: "worldBook", 主线: "storylines", 角色: "npcs", 道具: "items", 通告: "gigs", 玩法规则: "gameRules", CG: "cgs", 阵营: "factions" };
const EXTS: Partial<Record<ResKind, keyof ModExt>> = { 动作: "actions", 条件算子: "conds", 组件: "components", 面板: "panels" };
function dropRes(m: Mod, kind: ResKind, id: string): Mod {
  const c = { ...m.content } as Record<string, unknown>;
  if (kind === "地点") { const r = { ...(m.content.rooms ?? {}) }; delete r[id]; return { ...m, content: { ...m.content, rooms: r } }; }
  const lk = LISTS[kind];
  if (lk) { c[lk] = (c[lk] as { id: string }[] | undefined)?.filter((x) => x.id !== id); return { ...m, content: c as ModContent }; }
  const ek = EXTS[kind];
  if (ek && m.ext) return { ...m, ext: { ...m.ext, [ek]: (m.ext[ek] as { id: string }[] | undefined)?.filter((x) => x.id !== id) } };
  return m;
}
function putRes(m: Mod, kind: ResKind, data: unknown): Mod {
  const d = data as { id: string };
  if (kind === "地点") return { ...m, content: { ...m.content, rooms: { ...(m.content.rooms ?? {}), [d.id]: data as never } } };
  const lk = LISTS[kind];
  if (lk) { const list = ((m.content as Record<string, unknown>)[lk] as { id: string }[] | undefined) ?? []; return { ...m, content: { ...m.content, [lk]: [...list.filter((x) => x.id !== d.id), data] } }; }
  const ek = EXTS[kind];
  if (ek) { const list = ((m.ext ?? {})[ek] as { id: string }[] | undefined) ?? []; return { ...m, ext: { ...(m.ext ?? {}), [ek]: [...list.filter((x) => x.id !== d.id), data] } }; }
  return m;
}
export function applyImport(p: ImportPreview, o: ImportOpts): { ok: boolean; errors: string[]; mod?: Mod; notes: string[] } {
  let m: Mod = JSON.parse(JSON.stringify(p.mod));
  const notes: string[] = [];
  if (p.conflicts.length) {
    if (o.strategy === "skip") { for (const c of p.conflicts) m = dropRes(m, c.kind, c.id); notes.push(`跳过 ${p.conflicts.length} 个冲突资源`); }
    if (o.strategy === "rename") {
      const map = new Map<string, string>();
      const taken = new Set(allMods().flatMap((x) => resourcesOf(x).map((r) => r.id)));
      for (const c of p.conflicts) { let n = `${c.id}__${m.id}`, i = 2; while (taken.has(n)) n = `${c.id}__${m.id}${i++}`; taken.add(n); map.set(c.id, n); }
      m = { ...m, content: renameRefs(m.content, map), ext: m.ext ? renameRefs(m.ext, map) : undefined };
      notes.push(`自动重命名 ${map.size} 个冲突 ID（包内引用已同步改写）`);
    }
    if (o.strategy === "overwrite") notes.push(`覆盖 ${p.conflicts.length} 个同名资源（按加载顺序后者生效）`);
  }
  // 增量更新：作者二次修改过的资源，按开关保留本地版本
  if (p.existing && o.keepEdits) {
    const base = p.existing.origin?.base ?? {};
    let kept = 0;
    for (const r of resourcesOf(p.existing)) if (base[rkey(r)] && base[rkey(r)] !== hash(r.data)) { m = putRes(m, r.kind, r.data); kept++; }
    if (kept) notes.push(`保留了 ${kept} 个你二次修改过的资源`);
  }
  const base: Record<string, string> = {};
  for (const r of resourcesOf(m)) base[rkey(r)] = hash(r.data);
  // 保留本地修改的资源基线仍按旧基线，下次更新依然识别为「已修改」
  if (p.existing && o.keepEdits) for (const r of resourcesOf(p.existing)) { const ob = p.existing.origin?.base?.[rkey(r)]; if (ob && ob !== hash(r.data)) base[rkey(r)] = ob; }
  m = { ...m, builtin: undefined, origin: { source: "nmod", installedAt: Date.now(), version: m.version, base } };
  const errors = upsertUserMod(m);
  if (!errors.length) modLog(m.id, "info", `${p.existing ? `更新 ${p.existing.version} → ${m.version}` : `安装 v${m.version}`}：${notes.join("；") || "无冲突"}`);
  return { ok: !errors.length, errors, mod: m, notes };
}

/* —— 引用链路：关闭 / 卸载某 MOD 前，谁在调用它 —— */
type Hit = { path: string; what: string };
function scanRefs(v: unknown, modId: string, path: string, out: Hit[], depth = 0) {
  if (!v || typeof v !== "object" || depth > 30) return;
  if (Array.isArray(v)) { v.forEach((x, i) => scanRefs(x, modId, path, out, depth + 1)); return; }
  const o = v as Record<string, unknown>;
  const label = (o.name || o.title || o.label) as string | undefined;
  const here = label ? `${path} › ${label}` : path;
  if (typeof o.kind === "string" && o.mod === modId && ["modVar", "modCfg", "modCond", "modAction"].includes(o.kind)) {
    const KIND: Record<string, string> = { modVar: "读写私有变量", modCfg: "读取配置", modCond: "调用条件算子", modAction: "调用触发器动作" };
    out.push({ path: here, what: `${KIND[o.kind]}「${(o.key ?? o.id) as string}」` });
  }
  for (const [k, x] of Object.entries(o)) if (x && typeof x === "object") scanRefs(x, modId, here, out, depth + 1);
}
export function modDependents(modId: string, game?: GameState | null): string[] {
  const out: string[] = [];
  const sel = getSelection();
  for (const o of allMods()) {
    if (o.id === modId) continue;
    const on = sel.world === o.id || sel.addons.includes(o.id);
    if ((o.dependencies ?? []).includes(modId) || (o.deps ?? []).some((d) => d.id === modId)) out.push(`${on ? "已启用" : "未启用"}的「${o.name}」把它声明为前置依赖`);
    if (!on) continue;
    const hits: Hit[] = [];
    scanRefs(o.content, modId, `MOD「${o.name}」`, hits);
    scanRefs(o.ext, modId, `MOD「${o.name}」`, hits);
    for (const h of hits) out.push(`${h.path} → ${h.what}`);
  }
  if (game) {
    const hits: Hit[] = [];
    const g = game as unknown as Record<string, unknown>;
    for (const [k, label] of [["fixedEvents", "剧情桥段"], ["customEndings", "结局"], ["cgs", "CG"], ["worldBook", "世界书"]] as const)
      scanRefs((g[k] as { _mod?: string }[] | undefined)?.filter((x) => x?._mod !== modId), modId, `当前存档 › ${label}`, hits);
    for (const h of hits) out.push(`${h.path} → ${h.what}`);
    const owned = templateOwned(game, modId);
    if (owned) out.push(`当前存档里有 ${owned} 个由它装入的资源（可在「模板装入」处卸载）`);
  }
  return out;
}

/* —— 体检：内部逻辑错误 / 冲突 / 无效注册 —— */
export type HealthItem = { level: "error" | "warn" | "ok"; text: string };
export function modHealth(m: Mod): HealthItem[] {
  const out: HealthItem[] = [];
  const e = m.ext ?? {};
  const err = (t: string) => out.push({ level: "error", text: t }), warn = (t: string) => out.push({ level: "warn", text: t });
  for (const x of validateMod(m)) err(x);
  for (const x of validateExt(m.ext)) err(x);
  const dup = (label: string, ids: string[]) => { const s = new Set<string>(); for (const i of ids) { if (s.has(i)) err(`${label}「${i}」重复注册`); s.add(i); } };
  dup("变量", (e.vars ?? []).map((v) => v.key)); dup("配置", (e.config ?? []).map((v) => v.key)); dup("数据表", (e.tables ?? []).map((v) => v.id));
  dup("动作", (e.actions ?? []).map((v) => v.id)); dup("条件算子", (e.conds ?? []).map((v) => v.id)); dup("组件", (e.components ?? []).map((v) => v.id)); dup("面板", (e.panels ?? []).map((v) => v.id));
  const vars = new Set((e.vars ?? []).map((v) => v.key)), cfgs = new Set((e.config ?? []).map((v) => v.key));
  const actIds = new Set((e.actions ?? []).map((a) => a.id)), condIds = new Set((e.conds ?? []).map((a) => a.id));
  const deps = new Set([...(m.dependencies ?? []), ...(m.deps ?? []).map((d) => d.id)]);
  const granted = (owner: string) => allMods().find((x) => x.id === owner)?.ext?.grants?.some((g) => g.mod === m.id);
  // 引用检查：自己的引用必须存在；别人的 MOD 必须声明依赖且获得授权
  const walk = (v: unknown, where: string) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, where)); return; }
    const o = v as Record<string, unknown>;
    if (typeof o.kind === "string" && typeof o.mod === "string" && o.kind.startsWith("mod")) {
      const key = (o.key ?? o.id) as string;
      if (!o.mod) err(`${where}：引用没选 MOD`);
      else if (o.mod === m.id) {
        if (o.kind === "modVar" && !vars.has(key)) err(`${where}：私有变量「${key}」未声明`);
        if (o.kind === "modCfg" && !cfgs.has(key)) err(`${where}：配置项「${key}」未声明`);
        if (o.kind === "modCond" && !condIds.has(key)) err(`${where}：条件算子「${key}」未注册`);
        if (o.kind === "modAction" && !actIds.has(key)) err(`${where}：动作「${key}」未注册`);
      } else {
        if (!deps.has(o.mod)) err(`${where}：调用了「${o.mod}」却没把它声明为依赖`);
        if (o.kind !== "modAction" && o.kind !== "modCond" && !granted(o.mod)) err(`${where}：「${o.mod}」未授权本 MOD 访问其数据（默认隔离）`);
        if (o.kind === "modVar" && "delta" in o && allMods().find((x) => x.id === o.mod)?.ext?.grants?.find((g) => g.mod === m.id)?.access !== "rw") err(`${where}：写入「${o.mod}」的变量需要读写授权`);
      }
    }
    for (const x of Object.values(o)) if (x && typeof x === "object") walk(x, where);
  };
  for (const a of e.actions ?? []) { walk(a.branches, `动作「${a.label || a.id}」`); if (!a.branches?.length) warn(`动作「${a.label || a.id}」没有任何分支，执行时什么也不做`); if (a.branches?.some((b) => !b.effects?.length)) warn(`动作「${a.label || a.id}」有分支没有效果`); }
  for (const c of e.conds ?? []) { walk(c.conds, `条件算子「${c.label || c.id}」`); if (!c.conds?.length) warn(`条件算子「${c.label || c.id}」没有条件，永远成立`); }
  walk(m.content, "内容"); walk(e.demo, "演示工程");
  // 循环调用：条件算子 ↔ 条件算子，动作 ↔ 动作
  const cycle = (label: string, items: { id: string; refs: string[] }[]) => {
    const g = new Map(items.map((i) => [i.id, i.refs]));
    const st = new Map<string, number>();
    const dfs = (id: string, trail: string[]): boolean => {
      if (st.get(id) === 1) { err(`${label}循环调用：${[...trail.slice(trail.indexOf(id)), id].join(" → ")}`); return true; }
      if (st.get(id) === 2) return false;
      st.set(id, 1);
      for (const n of g.get(id) ?? []) if (g.has(n) && dfs(n, [...trail, id])) { st.set(id, 2); return true; }
      st.set(id, 2);
      return false;
    };
    for (const i of items) dfs(i.id, []);
  };
  const refsOf = (v: unknown, kind: string): string[] => { const r: string[] = []; const w = (x: unknown) => { if (!x || typeof x !== "object") return; if (Array.isArray(x)) return x.forEach(w); const o = x as Record<string, unknown>; if (o.kind === kind && o.mod === m.id) r.push(o.id as string); Object.values(o).forEach(w); }; w(v); return r; };
  cycle("条件算子", (e.conds ?? []).map((c) => ({ id: c.id, refs: refsOf(c.conds, "modCond") })));
  cycle("动作", (e.actions ?? []).map((a) => ({ id: a.id, refs: refsOf(a.branches, "modAction") })));
  for (const c of e.components ?? []) {
    if ((c.type === "meter" || c.type === "counter" || c.type === "badge") && (!c.var || !vars.has(c.var))) err(`组件「${c.label || c.id}」绑定的变量「${c.var || "（空）"}」未声明`);
    if (c.type === "table" && !(e.tables ?? []).some((t) => t.id === c.table)) err(`组件「${c.label || c.id}」绑定的数据表「${c.table || "（空）"}」不存在`);
    if (c.type === "meter" && !(c.max! > 0) && !((e.vars ?? []).find((v) => v.key === c.var)?.max! > 0)) warn(`进度条组件「${c.label || c.id}」没有上限（max），无法计算百分比`);
  }
  const compIds = new Set((e.components ?? []).map((c) => c.id));
  for (const p of e.panels ?? []) { if (!p.components.length) warn(`面板「${p.title || p.id}」是空的`); for (const c of p.components) if (!compIds.has(c)) err(`面板「${p.title || p.id}」引用了不存在的组件「${c}」`); }
  for (const v of e.vars ?? []) { if (v.min != null && v.max != null && v.min > v.max) err(`变量「${v.label || v.key}」下限大于上限`); if (v.init != null && (v.min != null && v.init < v.min || v.max != null && v.init > v.max)) warn(`变量「${v.label || v.key}」初值超出范围`); }
  for (const c of e.config ?? []) {
    if (c.type === "choice" && !c.options?.length) err(`配置「${c.label || c.key}」是选择题但没有选项`);
    if (c.min != null && c.def < c.min || c.max != null && c.def > c.max) warn(`配置「${c.label || c.key}」默认值超出范围`);
  }
  for (const t of e.tables ?? []) if (!t.columns.length) warn(`数据表「${t.label || t.id}」没有列`);
  for (const g of e.grants ?? []) if (!modById(g.mod)) warn(`授权对象「${g.mod}」未安装`);
  for (const p of commProblems(m)) (p.level === "error" ? err : warn)(p.text);
  if (e.skin?.css) for (const p of cssProblems(e.skin.css)) err(p);
  for (const d of [...deps]) if (!modById(d)) err(`前置依赖「${d}」未安装`);
  // 与其他 MOD 的注册冲突（假设与当前选择一起加载）
  const sel = getSelection();
  const chain = [sel.world, ...sel.addons.filter((x) => x !== m.id), m.id].map((id) => (id === m.id ? m : modById(id))).filter((x): x is Mod => !!x);
  for (const c of buildRegistry(chain).conflicts) if (c.mods.includes(m.id)) warn(`注册冲突：${c.kind}「${c.id}」与 ${c.mods.filter((x) => x !== m.id).map((x) => modById(x)?.name ?? x).join("、")} 重复`);
  // 包内剧情 / 结局 / 主线 / 世界书的引用与逻辑（只检查包内能确定的部分）
  const c = m.content ?? {};
  const a = auditStory({ events: [...(c.fixedEvents ?? []), ...(c.events ?? [])], endings: c.endings, storylines: c.storylines, worldBook: c.worldBook, cgs: c.cgs, factions: c.factions, npcIds: c.npcs?.length ? c.npcs.map((n) => n.id) : undefined, roomIds: c.rooms ? Object.keys(c.rooms) : undefined, skip: ["item", "location", "quest", "flag", ...(c.npcs?.length ? [] : ["npc" as const])] });
  for (const i of a.issues.slice(0, 60)) out.push({ level: i.level, text: `${i.from ? i.from + "：" : ""}${i.text}` });
  if (!hasExt(m) && modCategory(m) === "feature") warn("标记为功能玩法 MOD，但没有注册任何扩展能力");
  if (!out.length) out.push({ level: "ok", text: "体检通过：没有发现逻辑错误、冲突或无效注册" });
  return out;
}

/* —— 模板库 MOD：装入当前存档（资源打归属标记）/ 只卸载该 MOD 的资源 —— */
type Owned = { _mod?: string; id: string };
/* [存档字段, 模组字段, 名称]：主线来自世界本身，不装入存档 */
const TPL: [keyof GameState, keyof ModContent, string][] = [["fixedEvents", "fixedEvents", "剧情"], ["customEndings", "endings", "结局"], ["worldBook", "worldBook", "世界书"], ["cgs", "cgs", "CG"], ["factions", "factions", "阵营"]];
export function templateOwned(g: GameState, modId: string): number {
  return TPL.reduce((n, [k]) => n + (((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []).filter((x) => x._mod === modId).length, 0);
}
export function installTemplate(g: GameState, m: Mod, strategy: ImportOpts["strategy"]): { game: GameState; notes: string[] } {
  const next = { ...g } as Record<string, unknown>;
  const notes: string[] = [];
  const map = new Map<string, string>();
  const taken = new Set(TPL.flatMap(([k]) => (((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []).filter((x) => x._mod !== m.id).map((x) => x.id)));
  for (const [, mk] of TPL) for (const x of ((m.content as Record<string, unknown>)[mk] as Owned[] | undefined) ?? []) if (taken.has(x.id) && strategy === "rename") { let n = `${x.id}__${m.id}`, i = 2; while (taken.has(n)) n = `${x.id}__${m.id}${i++}`; map.set(x.id, n); }
  for (const [k, mk, label] of TPL) {
    const src = renameRefs((((m.content as Record<string, unknown>)[mk] as Owned[] | undefined) ?? []), map);
    if (!src.length) continue;
    const cur = (((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []).filter((x) => x._mod !== m.id); // 重装 = 先清掉旧的同包资源
    const ids = new Set(cur.map((x) => x.id));
    const add = src.filter((x) => strategy !== "skip" || !ids.has(x.id)).map((x) => ({ ...x, _mod: m.id }));
    next[k] = strategy === "overwrite" ? [...cur.filter((x) => !add.some((a) => a.id === x.id)), ...add] : [...cur, ...add];
    notes.push(`${label} ${add.length}${src.length - add.length ? `（跳过 ${src.length - add.length}）` : ""}`);
  }
  if (map.size) notes.push(`重命名 ${map.size} 个冲突 ID`);
  modLog(m.id, "info", `装入当前存档：${notes.join("，") || "无可装入的资源"}`);
  return { game: next as GameState, notes };
}
/* 外部引用：存档里「不属于该 MOD」的内容引用了它装入的资源 */
export function templateExternalRefs(g: GameState, modId: string): string[] {
  const owned = new Set(TPL.flatMap(([k]) => (((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []).filter((x) => x._mod === modId).map((x) => x.id)));
  if (!owned.size) return [];
  const out: string[] = [];
  for (const [k, , label] of TPL) for (const x of (((g as Record<string, unknown>)[k] as (Owned & { name?: string; title?: string })[] | undefined) ?? [])) {
    if (x._mod === modId) continue;
    const s = JSON.stringify(x);
    for (const id of owned) if (s.includes(`"${id}"`)) out.push(`${label}「${x.name || x.title || x.id}」引用了「${id}」`);
  }
  return out;
}
export function uninstallTemplate(g: GameState, modId: string): GameState {
  const next = { ...g } as Record<string, unknown>;
  let n = 0;
  for (const [k] of TPL) { const cur = ((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []; const keep = cur.filter((x) => x._mod !== modId); n += cur.length - keep.length; if (cur.length) next[k] = keep; }
  modLog(modId, "info", `从当前存档卸载 ${n} 个资源（其余内容未动）`);
  return next as GameState;
}

/* —— 工程反向打包：把当前存档的创作内容打成模板库 MOD —— */
export function projectToMod(g: GameState, meta: { id: string; name: string; version?: string; author?: string; description?: string; cover?: string }, onlyMine = true): Mod {
  const content: ModContent = {};
  for (const [k, mk] of TPL) {
    const list = (((g as Record<string, unknown>)[k] as Owned[] | undefined) ?? []).filter((x) => !onlyMine || !x._mod).map(({ _mod, ...x }) => { void _mod; return x; });
    if (list.length) (content as Record<string, unknown>)[mk] = list;
  }
  const gr = (g as unknown as { gameRules?: unknown[] }).gameRules;
  if (Array.isArray(gr) && gr.length) content.gameRules = gr as ModContent["gameRules"];
  return { id: meta.id, name: meta.name, version: meta.version ?? "1.0.0", author: meta.author, description: meta.description, cover: meta.cover, kind: "addon", category: "template", slotMerge: "merge", dependencies: [], content };
}

/* —— 示例：功能玩法 MOD（演示私有变量 / 配置分支 / 动作 / 条件 / 面板 / 皮肤如何与原生事件串联） —— */
export function sampleFeatureMod(): Mod {
  return {
    id: "stamina-demo", name: "体力养成（示例）", version: "1.0.0", author: "示例", kind: "addon", category: "feature", slotMerge: "merge",
    description: "演示功能玩法 MOD：私有「体力」变量、难度配置分支、训练动作、命名条件、状态面板与独立皮肤。",
    dependencies: [], content: {},
    ext: {
      vars: [{ key: "stamina", label: "体力", init: 60, min: 0, max: 100 }, { key: "trained", label: "训练次数", init: 0, min: 0 }],
      config: [{ key: "hard", label: "困难模式", type: "toggle", def: 0 }, { key: "cost", label: "每次训练消耗", type: "number", def: 15, min: 1, max: 50 }],
      tables: [{ id: "tips", label: "训练建议", columns: ["体力", "建议"], rows: [{ 体力: "≥ 60", 建议: "可以高强度训练" }, { 体力: "< 30", 建议: "先休息" }] }],
      conds: [{ id: "tired", label: "体力不足", conds: [{ kind: "modVar", mod: "stamina-demo", key: "stamina", op: "lt", value: 30 }] }],
      actions: [{ id: "train", label: "训练一次", branches: [
        { conds: [{ kind: "modCond", mod: "stamina-demo", id: "tired" }], effects: [{ kind: "metric", key: "stress", delta: 5 }] },
        { conds: [{ kind: "modCfg", mod: "stamina-demo", key: "hard", op: "eq", value: 1 }], effects: [{ kind: "modVar", mod: "stamina-demo", key: "stamina", delta: -25 }, { kind: "modVar", mod: "stamina-demo", key: "trained", delta: 1 }] },
        { conds: [], effects: [{ kind: "modVar", mod: "stamina-demo", key: "stamina", delta: -15 }, { kind: "modVar", mod: "stamina-demo", key: "trained", delta: 1 }] },
      ] }, { id: "rest", label: "休息", branches: [{ conds: [], effects: [{ kind: "modVar", mod: "stamina-demo", key: "stamina", delta: 30 }] }] }],
      components: [
        { id: "st-meter", label: "体力", type: "meter", var: "stamina", max: 100 },
        { id: "st-count", label: "累计训练", type: "counter", var: "trained" },
        { id: "st-tips", label: "训练建议", type: "table", table: "tips" },
      ],
      panels: [{ id: "stamina-panel", title: "体力养成", components: ["st-meter", "st-count", "st-tips"] }],
      skin: { accent: "#e0952f", radius: 18, shadow: "lift", pattern: "dots", panelAnim: "slide", componentAnim: "pop", duration: 520 },
      demo: {
        note: "把下面的示例事件复制进「剧情桥段」：在训练场触发训练动作；体力不足时另一条事件提醒休息。",
        events: [
          { id: "demo_train", name: "示例·训练", prompt: "主角在训练场挥汗如雨。", effects: [{ kind: "modAction", mod: "stamina-demo", id: "train" }], once: false, cooldown: 1 },
          { id: "demo_rest", name: "示例·该休息了", prompt: "主角累得抬不起手，决定休息。", conds: [{ kind: "modCond", mod: "stamina-demo", id: "tired" }], effects: [{ kind: "modAction", mod: "stamina-demo", id: "rest" }], once: false, cooldown: 2 },
        ],
      },
    },
  };
}
