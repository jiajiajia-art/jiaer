import { loadGlobal, saveGlobal } from "./saveScope";

/* 顶栏 DIY：自由组合（版式 / 名牌头像 / 状态栏模块与排序 / 配色）+ 样式正则 + 自定义 HTML / CSS 模板。
 * 存在 ThemePref.topbarDiy：属全局外观，随「美化主题包」一起导出；世界模组的 content.theme 也可附带一套。
 * 可上传：.topbar.json 样式文件、HTML / CSS 模板文件、正则文件（兼容 SillyTavern 酒馆 regex JSON）。 */

export type TopbarModuleKey = "week" | "date" | "location" | "weather" | "money" | "days" | "ap";
export type TopbarRegexTarget = "all" | "name" | "title" | TopbarModuleKey | "rawBar";
export type TopbarLayout = "double" | "reverse" | "single" | "statusOnly" | "profileOnly";
export type TopbarBarStyle = "pill" | "grid" | "chips" | "minimal" | "underline";
export type TopbarAvatarShape = "circle" | "rounded" | "diamond" | "hidden";
export type TopbarAvatarFrame = "halo" | "gold" | "white" | "solid" | "none";
export type TopbarCardStyle = "none" | "glass" | "pill" | "card" | "tag";
export type TopbarShadow = "none" | "soft" | "glow" | "strong";
export type TopbarAlign = "between" | "left" | "center";
export type TopbarBg = "gradient" | "aurora" | "plain";

export type TopbarRegexRule = {
  id: string;
  name: string;
  enabled: boolean;
  target: TopbarRegexTarget;
  pattern: string;
  flags?: string; // 留空 = 只替换第一处；默认 g
  replacement: string; // 支持 $1 / $& / $<名>；可写 HTML 与内联样式（脚本、事件属性会被过滤）
  css?: string; // 这条规则附带的 CSS（规则启用时生效）
};

export type TopbarDiy = {
  on?: boolean;
  preset?: string; // 最近一次套用的组合预设 id（仅作标记）
  /* 版式 */
  layout?: TopbarLayout;
  align?: TopbarAlign; // 状态栏模块的排布
  /* 名牌与头像 */
  avatarShape?: TopbarAvatarShape;
  avatarFrame?: TopbarAvatarFrame;
  avatarFrameImg?: string; // 头像框贴图（透明 PNG，叠在头像外圈）
  frameScale?: number; // 头像框贴图相对头像的大小 %（100 ~ 200）
  avatarSize?: number; // 24 ~ 60 px
  cardStyle?: TopbarCardStyle;
  cardImg?: string; // 名牌底图
  showName?: boolean;
  showAge?: boolean;
  showArchiveBtn?: boolean;
  archiveText?: string;
  showCenterTitle?: boolean;
  titleMain?: string; // 居中主标（留空 = 当前作品名）
  titleSub?: string; // 居中副标（留空 = 世界名）
  apRight?: boolean; // 右上角行动点胶囊
  showEndBtn?: boolean; // 右上角结束按钮（菜单按钮始终保留）
  /* 状态栏 */
  barStyle?: TopbarBarStyle;
  barImg?: string;
  modules?: TopbarModuleKey[]; // 顺序即显示顺序
  hiddenModules?: Partial<Record<TopbarModuleKey, boolean>>;
  showIcons?: boolean;
  showLabels?: boolean;
  /* 配色与质感（留空 = 跟随皮肤） */
  bg?: string;
  bgAlpha?: number;
  bgImg?: string; // 整条顶栏的背景图
  bgImgAlpha?: number; // 背景图不透明度 %
  btnBg?: string; // 右侧圆形按钮（行动点 / 结束 / 菜单）底色
  btnText?: string; // 右侧按钮文字与图标色
  btnRadius?: number; // 右侧按钮圆角 px（0 = 方形，20 = 正圆）
  hideNote?: boolean; // 隐藏顶栏下方的世界提示行
  blur?: number;
  border?: string;
  borderW?: number;
  shadow?: TopbarShadow;
  padY?: number;
  barBg?: string;
  barAlpha?: number;
  barBorder?: string;
  barRadius?: number;
  fontSize?: number;
  text?: string;
  textSoft?: string;
  accent?: string;
  /* 样式正则 */
  regexRules?: TopbarRegexRule[];
  /* 自定义模板（填写后替换组合式顶栏）与专属 CSS */
  customHtml?: string;
  templateOn?: boolean;
  keepActions?: boolean; // 模板旁保留右侧 行动点 / 结束 / 菜单 按钮
  customCss?: string;
};

/* 顶栏要显示的数据（由游戏状态算出；预览时用示例数据） */
export type TopbarData = {
  name: string;
  age: string | number;
  avatar?: string;
  initial: string;
  week: string; // 第 01 周
  weekNum: string; // 01
  date: string; // 2005.01.03 周一
  time: string; // 完整时间串
  location: string;
  weather?: string;
  money?: string;
  negative?: boolean;
  ap?: number;
  apMax?: number;
  apLow?: boolean;
  daysLeft?: number;
  world: string;
};

export const SAMPLE_TOPBAR_DATA: TopbarData = {
  name: "叶见月", age: 22, initial: "叶", week: "第 01 周", weekNum: "01", date: "2005.01.03 周一", time: "第 1 周 · 2005.01.03 周一",
  location: "星城 · 梧桐里", weather: "晴", money: "¥0.5万", ap: 3, apMax: 5, daysLeft: 365, world: "星城",
};

export const MODULE_KEYS: TopbarModuleKey[] = ["week", "date", "location", "weather", "money", "days", "ap"];
export const MODULE_LABELS: Record<TopbarModuleKey, string> = {
  week: "周数", date: "日期", location: "地点", weather: "天气", money: "资产", days: "倒计时", ap: "行动点",
};
const DEFAULT_HIDDEN: Partial<Record<TopbarModuleKey, boolean>> = { ap: true };

export const REGEX_TARGETS: [TopbarRegexTarget, string][] = [
  ["all", "全部文字"], ["name", "名字"], ["title", "标题"], ["week", "周数"], ["date", "日期"], ["location", "地点"],
  ["weather", "天气"], ["money", "资产"], ["days", "倒计时"], ["ap", "行动点"], ["rawBar", "整条状态栏"],
];
const TARGETS = new Set<string>(REGEX_TARGETS.map(([k]) => k));
export const targetLabel = (t: TopbarRegexTarget) => REGEX_TARGETS.find(([k]) => k === t)?.[1] ?? t;
export const apText = (d: TopbarData) => (d.ap != null ? `${d.ap}/${d.apMax ?? ""}` : "");
export const daysText = (d: TopbarData) => (d.daysLeft != null ? `主线剩 ${d.daysLeft} 天` : "");
/* 「整条状态栏」正则的输入：固定 6 段，用「 | 」分隔 */
export const rawBarText = (d: TopbarData) =>
  [d.week, d.date, d.location, d.weather || "—", d.money ?? "—", d.ap != null ? `行动 ${apText(d)}` : "—"].join(" | ");
export function topbarFieldText(t: TopbarRegexTarget, d: TopbarData, title = ""): string {
  switch (t) {
    case "name": return d.name;
    case "title": return title;
    case "week": return d.week;
    case "date": return d.date;
    case "weather": return d.weather ?? "";
    case "money": return d.money ?? "";
    case "days": return daysText(d);
    case "ap": return apText(d);
    case "rawBar": return rawBarText(d);
    default: return d.location;
  }
}
export const TEMPLATE_VARS: [string, string][] = [
  ["name", "名字"], ["age", "年龄"], ["avatarImg", "头像（整张图）"], ["avatar", "头像地址"], ["initial", "名字首字"],
  ["week", "第 N 周"], ["weekNum", "周数"], ["date", "日期"], ["time", "完整时间"], ["location", "地点"], ["weather", "天气"],
  ["money", "资产"], ["ap", "行动点"], ["apMax", "行动点上限"], ["days", "主线剩余"], ["world", "世界名"], ["title", "主标题"],
];
/* 头像在模板里先用占位地址参与过滤，过滤后再换回真实地址：避免把大体积的 dataURL 反复解析、缓存 */
export const AVATAR_TOKEN = "./__tb_avatar__";
export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
const stripUndef = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
export const newTopbarId = (p = "tb") => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clampN = (n: unknown, lo: number, hi: number) => (typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined);
const COLOR_OK = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%/+-]+\)|var\(--[\w-]+\)|[a-z]{3,20})$/i;
const color = (c?: string) => (c && COLOR_OK.test(c.trim()) ? c.trim() : undefined);
const IMG_OK = /^(https?:\/\/|data:image\/|blob:|\.{0,2}\/)/i;
const cssUrl = (u?: string) => (u && IMG_OK.test(u.trim()) ? `url("${u.trim().replace(/["\\\n\r]/g, "")}")` : "");
/* 外来 CSS 的最低限度清洗：去掉 @import，以及读取输入框 value 的属性选择器（防止借 CSS 外传 API Key 等） */
export const cssSafe = (css: string) => css.replace(/@import[^;]*;?/gi, "").replace(/[^{}]*\[\s*value[^{}]*\{[^}]*\}/gi, "");

/* —— 组合默认值与解析 —— */
const DEFAULTS = {
  layout: "double" as TopbarLayout, align: "between" as TopbarAlign, avatarShape: "circle" as TopbarAvatarShape,
  // 头像默认只描一圈主色细边，和顶栏其余圆按钮一致
  avatarFrame: "solid" as TopbarAvatarFrame, avatarSize: 40, frameScale: 145, cardStyle: "none" as TopbarCardStyle,
  showName: true, showAge: true, showArchiveBtn: true, archiveText: "查看档案 ›", showCenterTitle: true,
  apRight: true, showEndBtn: true, barStyle: "pill" as TopbarBarStyle, showIcons: true, showLabels: false,
  templateOn: true, keepActions: true,
};
export type TopbarResolved = Omit<TopbarDiy, keyof typeof DEFAULTS | "modules" | "hiddenModules"> & typeof DEFAULTS & {
  active: boolean;
  modules: TopbarModuleKey[];
  hidden: Partial<Record<TopbarModuleKey, boolean>>;
};
/* 合并默认值；DIY 关闭时完全回到默认顶栏（设置本身保留） */
export function resolveTopbarDiy(d?: TopbarDiy): TopbarResolved {
  const active = !!d && d.on !== false;
  const src: TopbarDiy = active && d ? d : {};
  const listed = (src.modules ?? []).filter((k) => MODULE_KEYS.includes(k));
  return {
    ...DEFAULTS,
    ...stripUndef(src),
    active,
    modules: [...new Set([...listed, ...MODULE_KEYS])],
    hidden: src.hiddenModules ?? DEFAULT_HIDDEN,
  } as TopbarResolved;
}

/* —— 内置组合预设：只改版式与结构，颜色、贴图、正则与代码保留 —— */
export type TopbarPreset = { id: string; name: string; desc: string; diy: TopbarDiy };
export const BUILTIN_TOPBAR_PRESETS: TopbarPreset[] = [
  { id: "glass", name: "磨砂胶囊", desc: "主色细环头像 · 磨砂一体状态胶囊（默认）", diy: {} },
  {
    id: "card", name: "名牌晶格", desc: "白边方头像名牌卡 · 带小标题的分格状态栏",
    diy: { avatarShape: "rounded", avatarFrame: "white", avatarSize: 42, cardStyle: "card", barStyle: "grid", showIcons: false, showLabels: true, barRadius: 12 },
  },
  {
    id: "compact", name: "单行通透", desc: "头像、状态与菜单压成一行，把画面让给剧情",
    diy: { layout: "single", avatarFrame: "gold", avatarSize: 32, showAge: false, showArchiveBtn: false, barStyle: "minimal", align: "left", apRight: false, hiddenModules: { ap: false, days: true }, padY: 6 },
  },
  {
    id: "chips", name: "手账散卡", desc: "每项状态是一枚悬浮小徽章，灵动少女感",
    diy: { avatarSize: 42, cardStyle: "glass", barStyle: "chips", align: "left", apRight: false, hiddenModules: { ap: false } },
  },
  {
    id: "banner", name: "剧场横幅", desc: "状态条置顶 · 菱形描金头像名签 · 居中剧场标题",
    diy: { layout: "reverse", avatarShape: "diamond", avatarFrame: "gold", avatarSize: 40, cardStyle: "tag", barStyle: "underline", showArchiveBtn: false },
  },
  {
    id: "status", name: "纯状态条", desc: "收起名牌，只留一条信息栏；点状态条查看档案",
    diy: { layout: "statusOnly", barStyle: "pill", apRight: false, hiddenModules: { ap: false }, padY: 8 },
  },
];
const STRUCT_KEYS: (keyof TopbarDiy)[] = [
  "layout", "align", "avatarShape", "avatarFrame", "avatarSize", "cardStyle", "showName", "showAge", "showArchiveBtn",
  "showCenterTitle", "apRight", "showEndBtn", "barStyle", "modules", "hiddenModules", "showIcons", "showLabels", "barRadius", "padY",
];
export function applyTopbarPreset(d: TopbarDiy | undefined, p: TopbarPreset): TopbarDiy {
  const base: TopbarDiy = { ...(d ?? {}) };
  for (const k of STRUCT_KEYS) delete base[k];
  return { ...base, ...p.diy, on: true, preset: p.id };
}
/* 美化页里的一句话摘要：默认 / 预设名 / 自定义模板 + 生效正则数 */
export function topbarSummary(d?: TopbarDiy): string {
  if (!d || d.on === false) return "默认";
  const parts = [d.customHtml?.trim() && d.templateOn !== false ? "自定义模板" : BUILTIN_TOPBAR_PRESETS.find((p) => p.id === d.preset)?.name ?? "已自定"];
  const n = d.regexRules?.filter((r) => r.enabled).length ?? 0;
  if (n) parts.push(`正则 ${n}`);
  return parts.join(" · ");
}

/* —— 内置示例正则：一键加入后可随意改 —— */
export const SAMPLE_REGEX_RULES: Omit<TopbarRegexRule, "id">[] = [
  { name: "周数 · 英文 WEEK", enabled: true, target: "week", pattern: "第\\s*(\\d+)\\s*周", flags: "g", replacement: "WEEK $1" },
  {
    name: "日期 · 只留月/日", enabled: true, target: "date", pattern: "(\\d{4})\\.(\\d{1,2})\\.(\\d{1,2})\\s*(周\\S+)?", flags: "g",
    replacement: "<b style=\"font-family:var(--font-serif)\">$2/$3</b> <small style=\"opacity:.7\">$4</small>",
  },
  { name: "地点 · 星芒前后缀", enabled: true, target: "location", pattern: "^(.+)$", flags: "", replacement: "「$1」" },
  { name: "天气 · 加书名号", enabled: true, target: "weather", pattern: "^(.+)$", flags: "", replacement: "「$1」" },
  {
    name: "资产 · 鎏金高亮", enabled: true, target: "money", pattern: "(¥?-?[\\d.,]+万?)", flags: "g",
    replacement: "<span class=\"tb-gold\">$1</span>", css: ".app-topbar .tb-gold { color: var(--gold); font-weight: 900; letter-spacing: .02em; }",
  },
  {
    name: "整条状态栏 · 重新排版", enabled: true, target: "rawBar", pattern: "^(.*?) \\| (.*?) \\| (.*?) \\| (.*?) \\| (.*?) \\| (.*)$", flags: "",
    replacement: "<div class=\"tb-raw\"><b>$1</b><span>$2</span><span class=\"tb-raw-loc\">$3 · $4</span><span class=\"tb-raw-money\">$5</span></div>",
    css: ".app-topbar .tb-raw { display: flex; align-items: center; gap: 10px; width: 100%; white-space: nowrap; }\n.app-topbar .tb-raw b { padding: 1px 8px; border-radius: 99px; background: var(--jade); color: white; font-size: .9em; }\n.app-topbar .tb-raw-loc { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 700; }\n.app-topbar .tb-raw-money { color: var(--coral); font-weight: 800; }",
  },
];

/* —— 示例模板：演示占位符与 data-action（profile / menu / end / schedule / none） —— */
export const SAMPLE_TEMPLATE = `<div class="tbx">
  <div class="tbx-id">
    {{avatarImg}}
    <div class="tbx-who"><b>{{name}}</b><small>{{age}} 岁 · {{world}}</small></div>
  </div>
  <div class="tbx-info">
    <span class="tbx-week">{{week}}</span><span>{{date}}</span>
    <i class="tbx-dot"></i><span>{{location}}</span>
    <i class="tbx-dot"></i><span>{{weather}}</span>
  </div>
  <div class="tbx-money" data-action="none">{{money}}</div>
</div>`;
export const SAMPLE_TEMPLATE_CSS = `.app-topbar .tbx { display: flex; align-items: center; gap: 12px; }
.app-topbar .tbx-id { display: flex; align-items: center; gap: 8px; min-width: 0; }
.app-topbar .tb-ava { width: 38px; height: 38px; flex-shrink: 0; border-radius: 12px; object-fit: cover; border: 2px solid var(--gold); display: flex; align-items: center; justify-content: center; background: var(--paper); color: var(--jade); font-weight: 800; }
.app-topbar .tbx-who { display: flex; flex-direction: column; line-height: 1.25; }
.app-topbar .tbx-who b { font-family: var(--font-serif); font-size: 16px; color: var(--jade-deep); }
.app-topbar .tbx-who small { font-size: 10px; color: var(--ink-soft); letter-spacing: .12em; }
.app-topbar .tbx-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; overflow: hidden; white-space: nowrap; font-size: 12px; }
.app-topbar .tbx-week { padding: 1px 8px; border-radius: 99px; background: linear-gradient(90deg, var(--jade), var(--coral)); color: white; font-weight: 700; font-size: 11px; }
.app-topbar .tbx-dot { width: 3px; height: 3px; border-radius: 99px; background: var(--ink-soft); opacity: .5; }
.app-topbar .tbx-money { font-weight: 900; color: var(--coral); white-space: nowrap; }`;

/* —— 安全过滤：DOM 白名单（标签 / 属性 / 图片地址），并校验「再解析一次不变」以拦截变异型注入 —— */
const DROP_TAGS = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "link", "meta", "base", "form", "input",
  "textarea", "select", "option", "template", "noscript", "noembed", "noframes", "xmp", "plaintext", "listing", "title",
  "desc", "foreignobject", "use", "image", "animate", "animatemotion", "animatetransform", "set", "audio", "video",
  "source", "track", "canvas", "math", "portal", "dialog", "slot",
]);
const KEEP_TAGS = new Set([
  "div", "span", "p", "b", "strong", "i", "em", "u", "s", "small", "big", "sup", "sub", "br", "hr", "img", "ul", "ol", "li",
  "section", "header", "footer", "figure", "figcaption", "mark", "label", "time", "button", "svg", "g", "path", "circle",
  "rect", "line", "polyline", "polygon", "ellipse", "defs", "lineargradient", "radialgradient", "stop", "text", "tspan",
]);
const ATTR_OK = /^(class|style|title|role|alt|width|height|viewbox|d|fill|fill-opacity|fill-rule|clip-rule|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-dasharray|stroke-opacity|cx|cy|r|rx|ry|x|y|x1|y1|x2|y2|dx|dy|points|offset|stop-color|stop-opacity|opacity|transform|preserveaspectratio|xmlns|font-size|font-weight|text-anchor|dominant-baseline|gradientunits|gradienttransform|aria-[a-z-]+|data-[a-z0-9-]+)$/;
const SAFE_SRC = /^(https?:\/\/|data:image\/[a-z0-9.+-]+[;,]|blob:|\.{0,2}\/[^:]*$)/i;
const BAD_STYLE = /expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|@import/i;
function cleanTree(root: Element) {
  for (const el of Array.from(root.children)) {
    const tag = el.tagName.toLowerCase();
    if (DROP_TAGS.has(tag)) { el.remove(); continue; }
    cleanTree(el);
    if (!KEEP_TAGS.has(tag)) { el.replaceWith(...Array.from(el.childNodes)); continue; }
    for (const a of Array.from(el.attributes)) {
      const n = a.name.toLowerCase();
      const ok =
        n === "src" ? tag === "img" && SAFE_SRC.test(a.value.trim())
        : n === "id" ? /^tb[-_][\w-]*$/.test(a.value)
        : n === "style" ? !BAD_STYLE.test(a.value)
        : ATTR_OK.test(n) && !/javascript:|vbscript:/i.test(a.value);
      if (!ok) el.removeAttribute(a.name);
    }
    if (tag === "button") el.setAttribute("type", "button");
  }
}
function cleanOnce(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  cleanTree(doc.body);
  return doc.body.innerHTML;
}
const htmlCache = new Map<string, string>();
export function sanitizeTopbarHtml(raw: string): string {
  if (!raw) return "";
  const hit = htmlCache.get(raw);
  if (hit !== undefined) return hit;
  let out: string;
  if (typeof DOMParser === "undefined") out = escapeHtml(raw);
  else {
    const once = cleanOnce(raw);
    out = cleanOnce(once) === once ? once : escapeHtml(raw.replace(/<[^>]*>/g, ""));
  }
  if (raw.length < 20000) {
    if (htmlCache.size > 400) htmlCache.clear();
    htmlCache.set(raw, out);
  }
  return out;
}

/* —— 正则引擎：作用于已转义的纯文本；结果有改动才按 HTML（过滤后）渲染 —— */
export const cleanFlags = (f?: string) => [...new Set((f ?? "g").replace(/[^gimsuy]/g, ""))].join("");
export function compileRegex(pattern: string, flags?: string): { re: RegExp | null; error?: string } {
  try {
    return { re: new RegExp(pattern, cleanFlags(flags)) };
  } catch (e) {
    return { re: null, error: e instanceof Error ? e.message : "语法错误" };
  }
}
const reCache = new Map<string, RegExp | null>();
const slowRules = new Set<string>();
const slowKey = (r: TopbarRegexRule) => `${r.id}\u0000${r.pattern}\u0000${r.flags ?? "g"}`;
export const regexPaused = (r: TopbarRegexRule) => slowRules.has(slowKey(r));
function cachedRe(r: TopbarRegexRule): RegExp | null {
  const key = `${cleanFlags(r.flags)}/${r.pattern}`;
  if (!reCache.has(key)) {
    if (reCache.size > 300) reCache.clear();
    reCache.set(key, compileRegex(r.pattern, r.flags).re);
  }
  return reCache.get(key) ?? null;
}
export type RxOut = { text: string; html: string; changed: boolean };
const plain = (text: string): RxOut => ({ text, html: escapeHtml(text), changed: false });
export function applyTopbarRegex(text: string, target: TopbarRegexTarget, rules?: TopbarRegexRule[]): RxOut {
  const src = text ?? "";
  if (!rules?.length || !src) return plain(src);
  let out = escapeHtml(src);
  let hit = false;
  for (const r of rules) {
    if (!r.enabled || !r.pattern) continue;
    if (target === "rawBar" ? r.target !== "rawBar" : r.target !== "all" && r.target !== target) continue;
    if (slowRules.has(slowKey(r))) continue;
    const re = cachedRe(r);
    if (!re) continue;
    re.lastIndex = 0;
    const t0 = performance.now();
    const next = out.replace(re, r.replacement ?? "");
    // 回溯失控的正则会卡住界面：单次超过 30ms 就暂停这条规则（改动规则后自动恢复）
    if (performance.now() - t0 > 30) {
      slowRules.add(slowKey(r));
      console.warn(`[顶栏正则] 「${r.name}」耗时过长，已暂停`);
    }
    if (next !== out) { out = next; hit = true; }
  }
  return hit ? { text: src, html: sanitizeTopbarHtml(out), changed: true } : plain(src);
}
/* 模板占位：{{key}} = 经过样式正则处理后的内容；{{key:raw}} = 原始纯文本（适合放进属性里） */
export function renderTopbarTemplate(tpl: string, vars: Record<string, RxOut | string>, avatarUrl?: string): string {
  const filled = tpl.replace(/\{\{\s*([a-zA-Z]+)(:raw)?\s*\}\}/g, (_m, k: string, raw?: string) => {
    const v = vars[k];
    if (v == null) return "";
    if (typeof v === "string") return escapeHtml(v);
    return raw ? escapeHtml(v.text) : v.html;
  });
  const safe = sanitizeTopbarHtml(filled);
  return avatarUrl ? safe.split(AVATAR_TOKEN).join(escapeHtml(avatarUrl)) : safe;
}

/* —— 顶栏专属 CSS：挂在 html:root:root .app-topbar 上，压过皮肤；由 applyFreeStyle 注入 —— */
const SH: Record<TopbarShadow, string> = {
  none: "none",
  soft: "0 6px 18px -14px rgba(120,90,200,0.45)",
  glow: "0 4px 22px -6px var(--jade)",
  strong: "0 12px 32px -12px rgba(0,0,0,0.45)",
};
export function buildTopbarCss(d?: TopbarDiy): string {
  if (!d || d.on === false) return "";
  const R = "html:root:root .app-topbar";
  const out: string[] = [];
  const root: string[] = [];
  const bg = color(d.bg);
  const bgA = clampN(d.bgAlpha, 0, 100);
  if (bg) root.push(`background: color-mix(in srgb, ${bg} ${bgA ?? 92}%, transparent) !important;`);
  else if (bgA != null) root.push(`background: color-mix(in srgb, var(--paper-2) ${bgA}%, transparent) !important;`);
  const blur = clampN(d.blur, 0, 30);
  if (blur != null) root.push(`backdrop-filter: blur(${blur}px) saturate(1.15) !important; -webkit-backdrop-filter: blur(${blur}px) saturate(1.15) !important;`);
  const bd = color(d.border);
  if (bd) root.push(`border-bottom-color: ${bd} !important;`);
  const bw = clampN(d.borderW, 0, 6);
  if (bw != null) root.push(`border-bottom-width: ${bw}px !important; border-bottom-style: solid !important;`);
  if (d.shadow && SH[d.shadow]) root.push(`box-shadow: ${SH[d.shadow]} !important;`);
  const tx = color(d.text);
  if (tx) root.push(`--ink: ${tx}; color: ${tx};`);
  const ts = color(d.textSoft);
  if (ts) root.push(`--ink-soft: ${ts};`);
  const ac = color(d.accent);
  if (ac) root.push(`--jade: ${ac}; --jade-deep: color-mix(in srgb, ${ac} 78%, black);`);
  if (root.length) out.push(`${R} { ${root.join(" ")} }`);
  const py = clampN(d.padY, 0, 24);
  if (py != null) out.push(`${R} .topbar-inner { padding-top: ${py}px !important; padding-bottom: ${py}px !important; }`);
  // 散卡样式没有整条底衬，底色 / 描边 / 圆角作用到每枚徽章上
  const barSel = d.barStyle === "chips" ? `${R} .topbar-chip` : `${R} .topbar-status-bar`;
  const bar: string[] = [];
  const bb = color(d.barBg);
  const ba = clampN(d.barAlpha, 0, 100);
  if (bb) bar.push(`background: color-mix(in srgb, ${bb} ${ba ?? 85}%, transparent) !important;`);
  else if (ba != null) bar.push(`background: color-mix(in srgb, var(--paper) ${ba}%, transparent) !important;`);
  const bbd = color(d.barBorder);
  if (bbd) bar.push(`border-color: ${bbd} !important;`);
  const br = clampN(d.barRadius, 0, 40);
  if (br != null) bar.push(`border-radius: ${br}px !important;`);
  if (bar.length) out.push(`${barSel} { ${bar.join(" ")} }`);
  const fs = clampN(d.fontSize, 10, 18);
  if (fs != null) out.push(`${R} .topbar-status-bar { font-size: ${fs}px !important; }`);
  const gi = cssUrl(d.bgImg);
  if (gi) {
    const ga = clampN(d.bgImgAlpha, 0, 100) ?? 100;
    out.push(`${R}::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: ${gi} center / cover no-repeat; opacity: ${ga / 100}; }`);
  }
  const btn: string[] = [];
  const bnb = color(d.btnBg);
  if (bnb) btn.push(`background: ${bnb} !important;`);
  const bnt = color(d.btnText);
  if (bnt) btn.push(`color: ${bnt} !important; --ink: ${bnt}; --ink-soft: ${bnt}; --jade-deep: ${bnt};`);
  const bnr = clampN(d.btnRadius, 0, 20);
  if (bnr != null) btn.push(`border-radius: ${bnr}px !important;`);
  if (btn.length) out.push(`${R} .topbar-actions .diy-btn, ${R} .topbar-actions .topbar-ap { ${btn.join(" ")} }`);
  if (d.hideNote) out.push(`${R} .topbar-note { display: none !important; }`);
  const bi = cssUrl(d.barImg);
  if (bi) {
    out.push(
      `${R} .topbar-status-bar { isolation: isolate; }`,
      `${R} .topbar-status-bar::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; background: ${bi} center / cover no-repeat; opacity: .9; }`,
    );
  }
  const ci = cssUrl(d.cardImg);
  if (ci) {
    out.push(
      `${R} .topbar-profile-card { isolation: isolate; overflow: hidden; }`,
      `${R} .topbar-profile-card::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; background: ${ci} center / cover no-repeat; opacity: .9; }`,
    );
  }
  for (const r of d.regexRules ?? []) if (r.enabled && r.css?.trim()) out.push(cssSafe(r.css.trim()));
  if (d.customCss?.trim()) out.push(cssSafe(d.customCss.trim()));
  return out.join("\n");
}

/* —— 导入导出：样式文件 / 正则文件 / HTML / CSS —— */
export const STYLE_FORMAT = "star-topbar-style";
export const REGEX_FORMAT = "star-topbar-regex";
export type SavedTopbarPreset = {
  id: string;
  name: string;
  author?: string;
  at: number;
  topbar?: TopbarBg;
  topbarText?: string;
  diy: TopbarDiy;
};
export type TopbarStyleFile = {
  format: typeof STYLE_FORMAT;
  version: 1;
  name: string;
  author?: string;
  createdAt: number;
  topbar?: TopbarBg;
  topbarText?: string;
  diy: TopbarDiy;
};
export const styleFileOf = (s: SavedTopbarPreset): TopbarStyleFile => ({
  format: STYLE_FORMAT, version: 1, name: s.name, author: s.author, createdAt: s.at, topbar: s.topbar, topbarText: s.topbarText, diy: s.diy,
});
export const regexFileOf = (rules: TopbarRegexRule[]) => ({
  format: REGEX_FORMAT,
  version: 1,
  rules: rules.map((r) => ({ name: r.name, enabled: r.enabled, target: r.target, pattern: r.pattern, flags: r.flags, replacement: r.replacement, css: r.css })),
});
const K_SAVED = "star:topbar_presets_v1";
export const loadSavedTopbars = (): SavedTopbarPreset[] =>
  (loadGlobal<SavedTopbarPreset[]>(K_SAVED, []) || []).filter((s) => s && typeof s === "object" && s.diy);
export const saveTopbars = (list: SavedTopbarPreset[]) => saveGlobal(K_SAVED, list);

const pick = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const img = (v: unknown) => (typeof v === "string" && IMG_OK.test(v.trim()) ? v.trim() : undefined);
const col = (v: unknown) => (typeof v === "string" ? color(v) : undefined);
function normalizeRule(it: unknown): TopbarRegexRule | null {
  if (!it || typeof it !== "object") return null;
  const o = it as Record<string, unknown>;
  const target = (typeof o.target === "string" && TARGETS.has(o.target) ? o.target : "all") as TopbarRegexTarget;
  // SillyTavern：{ scriptName, findRegex: "/…/gi", replaceString（{{match}} = 整段匹配）, disabled }
  if (typeof o.findRegex === "string") {
    let pattern = o.findRegex;
    let flags = "g";
    const m = pattern.match(/^\/([\s\S]+)\/([a-z]*)$/);
    if (m) { pattern = m[1]; flags = m[2]; }
    return {
      id: newTopbarId("rx"), name: String(o.scriptName || o.name || "导入的正则").slice(0, 40), enabled: o.disabled !== true, target,
      pattern, flags: cleanFlags(flags), replacement: String(o.replaceString ?? o.replacement ?? "").replace(/\{\{match\}\}/gi, "$$&"), css: str(o.css, 20000),
    };
  }
  if (typeof o.pattern === "string") {
    return {
      id: newTopbarId("rx"), name: String(o.name || "自定义正则").slice(0, 40), enabled: o.enabled !== false, target,
      pattern: o.pattern, flags: typeof o.flags === "string" ? cleanFlags(o.flags) : "g", replacement: String(o.replacement ?? ""), css: str(o.css, 20000),
    };
  }
  return null;
}
/* 外来样式逐项校验：未知字段丢弃、枚举值核对、数字夹到合理范围、颜色与图片地址过滤 */
export function normalizeTopbarDiy(raw: unknown): TopbarDiy {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const n = (k: string, lo: number, hi: number) => clampN(o[k], lo, hi);
  const d: TopbarDiy = {
    on: bool(o.on), preset: str(o.preset, 40),
    layout: pick(o.layout, ["double", "reverse", "single", "statusOnly", "profileOnly"] as const),
    align: pick(o.align, ["between", "left", "center"] as const),
    avatarShape: pick(o.avatarShape, ["circle", "rounded", "diamond", "hidden"] as const),
    avatarFrame: pick(o.avatarFrame, ["halo", "gold", "white", "solid", "none"] as const),
    avatarFrameImg: img(o.avatarFrameImg), frameScale: n("frameScale", 100, 200), avatarSize: n("avatarSize", 24, 60),
    cardStyle: pick(o.cardStyle, ["none", "glass", "pill", "card", "tag"] as const), cardImg: img(o.cardImg),
    showName: bool(o.showName), showAge: bool(o.showAge), showArchiveBtn: bool(o.showArchiveBtn), archiveText: str(o.archiveText, 16),
    showCenterTitle: bool(o.showCenterTitle), titleMain: str(o.titleMain, 24), titleSub: str(o.titleSub, 24),
    apRight: bool(o.apRight), showEndBtn: bool(o.showEndBtn),
    barStyle: pick(o.barStyle, ["pill", "grid", "chips", "minimal", "underline"] as const), barImg: img(o.barImg),
    showIcons: bool(o.showIcons), showLabels: bool(o.showLabels),
    bg: col(o.bg), bgAlpha: n("bgAlpha", 0, 100), bgImg: img(o.bgImg), bgImgAlpha: n("bgImgAlpha", 0, 100),
    btnBg: col(o.btnBg), btnText: col(o.btnText), btnRadius: n("btnRadius", 0, 20), hideNote: bool(o.hideNote), blur: n("blur", 0, 30), border: col(o.border), borderW: n("borderW", 0, 6),
    shadow: pick(o.shadow, ["none", "soft", "glow", "strong"] as const), padY: n("padY", 0, 24),
    barBg: col(o.barBg), barAlpha: n("barAlpha", 0, 100), barBorder: col(o.barBorder), barRadius: n("barRadius", 0, 40), fontSize: n("fontSize", 10, 18),
    text: col(o.text), textSoft: col(o.textSoft), accent: col(o.accent),
    customHtml: str(o.customHtml, 20000), templateOn: bool(o.templateOn), keepActions: bool(o.keepActions), customCss: str(o.customCss, 40000),
  };
  if (Array.isArray(o.modules)) d.modules = [...new Set(o.modules.filter((k): k is TopbarModuleKey => MODULE_KEYS.includes(k as TopbarModuleKey)))];
  if (o.hiddenModules && typeof o.hiddenModules === "object") {
    const h: Partial<Record<TopbarModuleKey, boolean>> = {};
    for (const k of MODULE_KEYS) {
      const v = (o.hiddenModules as Record<string, unknown>)[k];
      if (typeof v === "boolean") h[k] = v;
    }
    d.hiddenModules = h;
  }
  if (Array.isArray(o.regexRules)) d.regexRules = o.regexRules.map(normalizeRule).filter((r): r is TopbarRegexRule => !!r);
  return stripUndef(d);
}
const DIY_HINT = ["layout", "barStyle", "avatarShape", "avatarFrame", "cardStyle", "modules", "hiddenModules", "customHtml", "customCss", "bg", "accent", "barBg"];
const styleOf = (o: Record<string, unknown>, diy: unknown, fallback = "导入的顶栏"): SavedTopbarPreset => ({
  id: newTopbarId("tbs"), name: (str(o.name, 30) || fallback).trim() || fallback, author: str(o.author, 30), at: Number(o.createdAt) || Date.now(),
  topbar: pick(o.topbar, ["gradient", "aurora", "plain"] as const), topbarText: str(o.topbarText, 12), diy: normalizeTopbarDiy(diy),
});
export type TopbarImport = { styles: SavedTopbarPreset[]; rules: TopbarRegexRule[]; html?: string; css?: string };
/* 自动识别上传文件：本平台样式 / 正则文件、美化主题包、酒馆正则、裸 DIY 对象、HTML 模板、CSS */
export function parseTopbarFile(text: string, filename = ""): TopbarImport {
  const res: TopbarImport = { styles: [], rules: [] };
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const body = text.replace(/^\uFEFF/, "").trim();
  if (!body) throw new Error("文件是空的");
  if (ext === "css") { res.css = body; return res; }
  const looksJson = body.startsWith("{") || body.startsWith("[");
  if (ext === "html" || ext === "htm" || (!looksJson && /<[a-z][\s\S]*>/i.test(body))) {
    const css: string[] = [];
    const html = body.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, c: string) => { css.push(c.trim()); return ""; });
    res.html = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html).trim();
    if (css.length) res.css = css.join("\n");
    return res;
  }
  let j: unknown;
  try {
    j = JSON.parse(body);
  } catch {
    throw new Error("不是有效的 JSON / HTML / CSS 文件");
  }
  const visit = (x: unknown) => {
    if (Array.isArray(x)) { x.forEach(visit); return; }
    if (!x || typeof x !== "object") return;
    const o = x as Record<string, unknown>;
    if (o.format === STYLE_FORMAT || (o.diy && typeof o.diy === "object")) { res.styles.push(styleOf(o, o.diy)); return; }
    if (o.format === "star-theme-pack" && o.theme && typeof o.theme === "object") {
      const t = o.theme as Record<string, unknown>;
      if (t.topbarDiy || t.topbar || t.topbarText) res.styles.push(styleOf({ ...o, topbar: t.topbar, topbarText: t.topbarText }, t.topbarDiy ?? {}, "主题包里的顶栏"));
      return;
    }
    if (o.format === REGEX_FORMAT || Array.isArray(o.rules) || Array.isArray(o.scripts)) {
      visit(o.rules ?? o.scripts);
      return;
    }
    const rule = normalizeRule(o);
    if (rule) { res.rules.push(rule); return; }
    if (DIY_HINT.some((k) => k in o)) res.styles.push(styleOf(o, o));
    else if (Array.isArray(o.regexRules)) visit(o.regexRules);
  };
  visit(j);
  if (!res.styles.length && !res.rules.length) throw new Error("没有识别到顶栏样式或正则规则");
  return res;
}
