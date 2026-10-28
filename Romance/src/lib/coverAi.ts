import type { CoverDiy } from "./store";
import type { CoverCopy } from "../mods/types";

/* 装扮封面 · 对话式生成：AI 只回「封面 DIY 字段补丁 + 可选的封面专属 CSS」，这里负责校验与收窄，
 * 保证 AI 生成的结果仍是可以在五个页签里继续手动调的普通 DIY 配置。 */

export const COVER_CLASSES = ["cover-root", "cover-bg", "cover-fx", "cover-panel", "cover-kicker", "cover-title", "cover-logo", "cover-subtitle", "cover-intro", "cover-btns", "cover-btn", "cover-btn-main", "cover-btn-sub", "cover-canvas-item"] as const;

const ENUMS: Partial<Record<keyof CoverDiy, readonly string[]>> = {
  bgPreset: ["starlight", "dawn", "noir", "inkwash", "cyber", "minimal"],
  bgPattern: ["none", "grid", "dots", "lines", "frame", "astrolabe"],
  tint: ["night", "rose", "ocean", "gold", "none", "custom"],
  titleFont: ["default", "song", "hei", "round", "elegant", "brush", "hand", "cursive", "pixel"],
  titleColor: ["white", "gold", "pink", "accent", "custom"],
  titleSize: ["s", "m", "l", "xl"],
  titleDir: ["horizontal", "vertical"],
  titleEffect: ["none", "glow", "stroke", "gold3d", "retro"],
  titleTracking: ["tight", "normal", "wide", "ultra"],
  kickerStyle: ["plain", "pill", "line", "bracket"],
  divider: ["line", "star", "floral", "double", "none"],
  align: ["left", "center", "right"],
  vpos: ["top", "center", "bottom"],
  panel: ["none", "glass", "dark", "paper", "editorial", "jade"],
  btnStyle: ["dream", "rose", "gold", "jade", "solid", "glass", "outline", "paper", "text"],
  btnShape: ["pill", "rounded", "square", "gem"],
  btnLayout: ["grid", "stack", "row"],
  btnWidth: ["full", "compact"],
  fx: ["none", "stars", "petals", "snow", "fireflies", "hearts", "bubbles", "ginkgo"],
  spotlight: ["none", "top", "center", "vignette"],
  cgMode: ["fixed", "carousel", "video"],
  cgFx: ["fade", "slide", "zoom"],
};
const TEXT: Partial<Record<keyof CoverDiy, number>> = { kicker: 60, title: 40, subtitle: 60, intro: 400 };
const RANGE: Partial<Record<keyof CoverDiy, [number, number]>> = { dim: [0, 80], blur: [0, 16], cgInterval: [2, 30] };
const BOOL: (keyof CoverDiy)[] = ["hideTitle", "hideIntro", "hideKicker", "hideSubtitle", "cgShuffle", "cgHideDots"];
const COLOR: (keyof CoverDiy)[] = ["tintColor", "titleCustom", "btnColor", "btnTextColor"];
const URLS: (keyof CoverDiy)[] = ["image", "video", "logo"];
const isUrl = (v: unknown): v is string => typeof v === "string" && /^https:\/\/\S+$/.test(v.trim()) && v.length < 2000;
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim());
export const CSS_MAX = 8000;

export type CoverPatchResult = { patch: Partial<CoverDiy>; clear: (keyof CoverDiy)[]; bgPrompt?: string; dropped: string[] };

/** 校验 AI 补丁：值为 null = 清除该项（回到默认 / 世界封面）；不认识或不合法的键丢弃并记下 */
export function sanitizeCoverPatch(raw: unknown): CoverPatchResult {
  const out: CoverPatchResult = { patch: {}, clear: [], dropped: [] };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const p = out.patch as Record<string, unknown>;
  for (const [k0, v] of Object.entries(raw as Record<string, unknown>)) {
    const k = k0 as keyof CoverDiy;
    if (k0 === "bgPrompt") { if (typeof v === "string" && v.trim()) out.bgPrompt = v.trim().slice(0, 600); continue; }
    if (v === null) { if (k0 !== "on") out.clear.push(k); continue; }
    if (ENUMS[k]) { if (typeof v === "string" && ENUMS[k]!.includes(v)) p[k] = v; else out.dropped.push(k0); }
    else if (TEXT[k]) { if (typeof v === "string") p[k] = v.slice(0, TEXT[k]); else out.dropped.push(k0); }
    else if (RANGE[k]) { const n = Number(v); if (Number.isFinite(n)) p[k] = Math.round(Math.min(RANGE[k]![1], Math.max(RANGE[k]![0], n))); else out.dropped.push(k0); }
    else if (BOOL.includes(k)) p[k] = !!v || undefined;
    else if (COLOR.includes(k)) { if (isHex(v)) p[k] = v.trim(); else out.dropped.push(k0); }
    else if (URLS.includes(k)) { if (isUrl(v)) p[k] = v.trim(); else out.dropped.push(k0); } // 本地图片占位 / 非 https 一律不收
    else if (k0 === "cgs") { const a = Array.isArray(v) ? v.filter(isUrl).slice(0, 8) : []; if (a.length) p.cgs = a; else out.dropped.push(k0); }
    else if (k0 === "labels" || k0 === "hide") {
      if (!v || typeof v !== "object") { out.dropped.push(k0); continue; }
      const keys = k0 === "labels" ? ["start", "continue", "config"] : ["continue", "config"];
      const o = Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([x]) => keys.includes(x))
        .map(([x, y]) => [x, k0 === "labels" ? (typeof y === "string" ? y.slice(0, 10) : undefined) : !!y || undefined]));
      p[k0] = o;
    } else if (k0 === "css") { if (typeof v === "string") p.css = v.slice(0, CSS_MAX); else out.dropped.push(k0); }
    else out.dropped.push(k0);
  }
  return out;
}

/** 合并补丁：labels / hide 按子键合并；清除项删除；空值整理掉 */
export function applyCoverPatch(d: CoverDiy, r: CoverPatchResult): CoverDiy {
  const n: CoverDiy = { ...d, ...r.patch };
  if (r.patch.labels) n.labels = { ...d.labels, ...r.patch.labels };
  if (r.patch.hide) n.hide = { ...d.hide, ...r.patch.hide };
  for (const k of r.clear) delete n[k];
  for (const k of Object.keys(n) as (keyof CoverDiy)[]) if (n[k] === undefined || n[k] === "") delete n[k];
  return n;
}

/** 发给 AI 的当前配置：本地上传的图片 / 视频（data:）换成占位，免得把几 MB 的 base64 塞进对话 */
export function coverForPrompt(d: CoverDiy): Record<string, unknown> {
  const o: Record<string, unknown> = { ...d };
  for (const k of ["image", "video", "logo"] as const) if (typeof o[k] === "string" && (o[k] as string).startsWith("data:")) o[k] = "（本地上传的图片，保持不动）";
  if (Array.isArray(o.cgs)) o.cgs = (o.cgs as string[]).map((u) => (u.startsWith("data:") ? "（本地图片）" : u));
  if (Array.isArray(o.canvasItems)) o.canvasItems = `（画布自由元素 ${o.canvasItems.length} 项）`;
  return o;
}

/* —— 封面专属 CSS：把每条规则收进 .cover-root，避免改到游戏其它界面 —— */
function splitTop(css: string): { head: string; body?: string }[] {
  const out: { head: string; body?: string }[] = [];
  let i = 0;
  while (i < css.length) {
    const brace = css.indexOf("{", i), semi = css.indexOf(";", i);
    if (brace < 0) { const rest = css.slice(i).trim(); if (rest) out.push({ head: rest }); break; }
    if (semi >= 0 && semi < brace) { out.push({ head: css.slice(i, semi + 1).trim() }); i = semi + 1; continue; } // @import 之类的语句
    let depth = 1, j = brace + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    out.push({ head: css.slice(i, brace).trim(), body: css.slice(brace + 1, j - 1) });
    i = j;
  }
  return out;
}
export function scopeCoverCss(raw: string): string {
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<\/?style[^>]*>/gi, "").slice(0, CSS_MAX);
  const walk = (src: string): string => splitTop(src).map(({ head, body }) => {
    if (body === undefined) return /^@import\s+url\(\s*["']?https:\/\/fonts\.(googleapis|loli)\.(com|net)\//i.test(head) ? head : ""; // 只放行网络字体
    if (/^@(media|supports|container)/i.test(head)) return `${head}{${walk(body)}}`;
    if (/^@(keyframes|-webkit-keyframes|font-face)/i.test(head)) return `${head}{${body}}`;
    if (head.startsWith("@")) return "";
    const sel = head.split(",").map((s) => s.trim()).filter(Boolean)
      .map((s) => (/^(html|body|:root)\b/i.test(s) ? ".cover-root" : s.includes(".cover-root") ? s : `.cover-root ${s}`)).join(", ");
    return sel ? `${sel}{${body}}` : "";
  }).filter(Boolean).join("\n");
  const scoped = walk(css);
  // @import 须在样式表最前
  const imports = scoped.split("\n").filter((l) => l.startsWith("@import"));
  return [...imports, ...scoped.split("\n").filter((l) => !l.startsWith("@import"))].join("\n");
}

/** 从 AI 回复里取出 ```json 补丁（也接受整段就是 JSON） */
export function extractCoverJson(raw: string): unknown {
  const fenced = /```(?:json)?\s*\n?([\s\S]*?)```/i.exec(raw)?.[1];
  const cand = fenced ?? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  try { return JSON.parse(cand); } catch { return null; }
}

/** 封面模式：显式 mode 优先，否则按有没有 HTML / 背景推断 */
export const coverMode = (c: CoverCopy) => c.mode ?? (c.html ? "html" : c.image || c.video || c.cgs?.length ? "media" : "default");

/* —— 作者封面（模组 cover 槽）⇄ DIY 编辑器 ——
 * 文字与背景沿用 CoverCopy 原字段（老模组兼容），其余样式收进 cover.style。 */
const COPY_KEYS = ["kicker", "title", "subtitle", "intro", "image", "video", "dim", "cgMode", "cgs", "cgInterval", "cgFx", "cgShuffle", "cgHideDots"] as const;
const isCopyKey = (k: string): k is (typeof COPY_KEYS)[number] => (COPY_KEYS as readonly string[]).includes(k);
/** 模组封面 → 编辑器里的一份 DIY 配置 */
export function toDiy(cv: CoverCopy): CoverDiy {
  const d: Record<string, unknown> = { ...(cv.style ?? {}) };
  for (const k of COPY_KEYS) if (cv[k] !== undefined) d[k] = cv[k];
  return d as CoverDiy;
}
/** 编辑器 DIY 配置 → 写回模组封面（保留 HTML 模式相关字段） */
export function fromDiy(cv: CoverCopy, d: CoverDiy | undefined): CoverCopy {
  const out: Record<string, unknown> = { ...cv };
  for (const k of COPY_KEYS) delete out[k];
  delete out.style;
  const style: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d ?? {})) {
    if (k === "on" || v === undefined || v === "") continue;
    if (isCopyKey(k)) out[k] = v; else style[k] = v;
  }
  if (Object.keys(style).length) out.style = style;
  if (out.mode !== "html") delete out.mode; // 默认 / 图片视频由是否有背景自动推断
  return out as CoverCopy;
}
/** 封面最终样式 = 作者样式层 + 玩家 DIY（玩家优先；按钮文字 / 显隐按子项合并；CSS 两段都生效，玩家在后） */
export function withAuthorStyle(style: CoverDiy | undefined, d: CoverDiy): CoverDiy {
  if (!style) return d;
  const base: Record<string, unknown> = { ...style };
  for (const k of COPY_KEYS) delete base[k];
  // 功能注释：AI 脏封面 css 可能是对象/数字，禁止 x?.trim() 炸「t.trim is not a function」
  const css = [style.css, d.css]
    .filter((x): x is string => typeof x === "string" && !!x.trim())
    .join("\n");
  return { ...(base as CoverDiy), ...d, labels: { ...style.labels, ...d.labels }, hide: { ...style.hide, ...d.hide }, css: css || undefined };
}
