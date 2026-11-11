/**
 * 手机应用 SDK（kkapp@1）：用配置描述一个可交互的手机应用，不写代码。
 * 零依赖：平台创作页（主工程）与手机运行时（Romance）共用这一份规范。
 *
 * 结构：应用 = 若干页面；页面 = 自上而下的组件块；按钮 / 列表项可挂「动作」。
 * 动作只能：跳页、按条件结算效果（属性 / 内置指标 / 关系 / 规则变量）、弹提示、记一笔手机动态。
 * 属性引用沿用属性 SDK：条件与效果的 metric 写 "c:<属性id>" 或内置指标（money/stress/energy/fame/reputation/works）。
 * 禁止脚本、网络请求、跨作品读写；所有结算都走引擎的效果结算，受属性上下限约束。
 */

export const KKAPP_SCHEMA = "kkapp@1";
export const KKAPP_TYPES = ["chat", "message", "browse", "read", "video", "job"] as const;
export type KkAppType = (typeof KKAPP_TYPES)[number];

export type KkAppCond =
  | { metric: string; op: "gte" | "lte"; value: number }
  | { flag: string; op: "gte" | "lte"; value: number }
  | { rel: string; op: "gte" | "lte"; value: number };

export type KkAppEffect =
  | { metric: string; delta: number }
  | { flag: string; delta: number; set?: boolean }
  | { rel: string; delta: number };

export type KkAppAction = {
  /** 跳到某页 */
  go?: string;
  /** 结算效果（按顺序） */
  effects?: KkAppEffect[];
  /** 满足才可执行；不满足时按钮置灰并显示 lockedHint */
  when?: KkAppCond[];
  lockedHint?: string;
  /** 执行后的提示 */
  toast?: string;
  /** 整局只能执行一次 */
  once?: boolean;
  /** 冷却天数（游戏内天） */
  cooldownDays?: number;
  /** 写进手机动态 / 剧情日志的一句话（AI 可读） */
  log?: string;
};

export type KkAppItem = { id: string; title: string; subtitle?: string; meta?: string; image?: string; badge?: string; action?: KkAppAction; when?: KkAppCond[] };
export type KkAppPost = { id: string; author: string; avatar?: string; text: string; image?: string; time?: string; likes?: number };
export type KkAppMessage = { from: "me" | "them"; text: string; time?: string };
export type KkAppButton = { id: string; label: string; style?: "primary" | "plain"; action: KkAppAction };

export type KkAppBlock =
  | { kind: "header"; title: string; subtitle?: string; cover?: string }
  | { kind: "text"; text: string; when?: KkAppCond[] }
  | { kind: "notice"; text: string; tone?: "info" | "warn" | "good"; when?: KkAppCond[] }
  | { kind: "stats"; items: { label: string; metric: string }[] }
  | { kind: "list"; title?: string; items: KkAppItem[] }
  | { kind: "feed"; posts: KkAppPost[] }
  | { kind: "chat"; contact: string; avatar?: string; messages: KkAppMessage[] }
  | { kind: "buttons"; items: KkAppButton[] }
  | { kind: "divider" };

export type KkAppPage = { id: string; title: string; tab?: string; blocks: KkAppBlock[] };
export type KkAppSpec = { schema: typeof KKAPP_SCHEMA; type: KkAppType; theme?: { accent?: string; dark?: boolean }; home: string; pages: KkAppPage[] };

export const KKAPP_BLOCK_KINDS = ["header", "text", "notice", "stats", "list", "feed", "chat", "buttons", "divider"] as const;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, fb = "") => (typeof v === "string" ? v : typeof v === "number" ? String(v) : fb);
const num = (v: unknown, fb = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const op = (v: unknown): "gte" | "lte" => (v === "lte" ? "lte" : "gte");
const slug = (v: unknown, fb: string) => {
  const s = str(v).trim();
  return s || fb;
};

export const isKkApp = (content: unknown): content is KkAppSpec => isRec(content) && content.schema === KKAPP_SCHEMA;

function normCond(raw: unknown): KkAppCond | null {
  if (!isRec(raw)) return null;
  const value = num(raw.value);
  if (typeof raw.metric === "string" && raw.metric) return { metric: raw.metric, op: op(raw.op), value };
  if (typeof raw.flag === "string" && raw.flag) return { flag: raw.flag, op: op(raw.op), value };
  if (typeof raw.rel === "string" && raw.rel) return { rel: raw.rel, op: op(raw.op), value };
  return null;
}
const normConds = (v: unknown) => arr(v).map(normCond).filter((x): x is KkAppCond => !!x);

function normEffect(raw: unknown): KkAppEffect | null {
  if (!isRec(raw)) return null;
  const delta = num(raw.delta);
  if (typeof raw.metric === "string" && raw.metric) return { metric: raw.metric, delta };
  if (typeof raw.flag === "string" && raw.flag) return { flag: raw.flag, delta, ...(raw.set === true ? { set: true } : {}) };
  if (typeof raw.rel === "string" && raw.rel) return { rel: raw.rel, delta };
  return null;
}

function normAction(raw: unknown): KkAppAction | undefined {
  if (!isRec(raw)) return undefined;
  const a: KkAppAction = {};
  if (str(raw.go)) a.go = str(raw.go);
  const effects = arr(raw.effects).map(normEffect).filter((x): x is KkAppEffect => !!x);
  if (effects.length) a.effects = effects;
  const when = normConds(raw.when);
  if (when.length) a.when = when;
  if (str(raw.lockedHint)) a.lockedHint = str(raw.lockedHint);
  if (str(raw.toast)) a.toast = str(raw.toast);
  if (raw.once === true) a.once = true;
  if (num(raw.cooldownDays) > 0) a.cooldownDays = Math.round(num(raw.cooldownDays));
  if (str(raw.log)) a.log = str(raw.log);
  return Object.keys(a).length ? a : undefined;
}

function normBlock(raw: unknown, i: number): KkAppBlock | null {
  if (!isRec(raw)) return null;
  const when = normConds(raw.when);
  const w = when.length ? { when } : {};
  switch (raw.kind) {
    case "header": return { kind: "header", title: str(raw.title), ...(str(raw.subtitle) ? { subtitle: str(raw.subtitle) } : {}), ...(str(raw.cover) ? { cover: str(raw.cover) } : {}) };
    case "text": return str(raw.text) ? { kind: "text", text: str(raw.text), ...w } : null;
    case "notice": return str(raw.text) ? { kind: "notice", text: str(raw.text), tone: raw.tone === "warn" || raw.tone === "good" ? raw.tone : "info", ...w } : null;
    case "stats": return { kind: "stats", items: arr(raw.items).filter(isRec).map((x) => ({ label: str(x.label), metric: str(x.metric) })).filter((x) => x.label && x.metric) };
    case "list": return {
      kind: "list", ...(str(raw.title) ? { title: str(raw.title) } : {}),
      items: arr(raw.items).filter(isRec).map((x, j) => {
        const action = normAction(x.action);
        const iw = normConds(x.when);
        return {
          id: slug(x.id, `item${j + 1}`), title: str(x.title),
          ...(str(x.subtitle) ? { subtitle: str(x.subtitle) } : {}), ...(str(x.meta) ? { meta: str(x.meta) } : {}),
          ...(str(x.image) ? { image: str(x.image) } : {}), ...(str(x.badge) ? { badge: str(x.badge) } : {}),
          ...(action ? { action } : {}), ...(iw.length ? { when: iw } : {}),
        };
      }).filter((x) => x.title),
    };
    case "feed": return { kind: "feed", posts: arr(raw.posts).filter(isRec).map((x, j) => ({
      id: slug(x.id, `post${j + 1}`), author: str(x.author, "匿名"), text: str(x.text),
      ...(str(x.avatar) ? { avatar: str(x.avatar) } : {}), ...(str(x.image) ? { image: str(x.image) } : {}),
      ...(str(x.time) ? { time: str(x.time) } : {}), ...(typeof x.likes === "number" ? { likes: x.likes } : {}),
    })).filter((x) => x.text) };
    case "chat": return { kind: "chat", contact: str(raw.contact, "对方"), ...(str(raw.avatar) ? { avatar: str(raw.avatar) } : {}),
      messages: arr(raw.messages).filter(isRec).map((x) => ({ from: x.from === "me" ? "me" as const : "them" as const, text: str(x.text), ...(str(x.time) ? { time: str(x.time) } : {}) })).filter((x) => x.text) };
    case "buttons": {
      const items: KkAppButton[] = [];
      arr(raw.items).filter(isRec).forEach((x, j) => {
        const action = normAction(x.action);
        if (action) items.push({ id: slug(x.id, `btn${j + 1}`), label: str(x.label, "确定"), style: x.style === "plain" ? "plain" : "primary", action });
      });
      return { kind: "buttons", items };
    }
    case "divider": return { kind: "divider" };
    default: void i; return null;
  }
}

/** 规范化：脏数据尽量修成可渲染的应用；完全不可用返回 null */
export function normalizeKkApp(raw: unknown, fallbackType: KkAppType = "browse"): KkAppSpec | null {
  if (!isRec(raw)) return null;
  const type = (KKAPP_TYPES as readonly string[]).includes(str(raw.type)) ? (raw.type as KkAppType) : fallbackType;
  const pages = arr(raw.pages).filter(isRec).map((p, i) => ({
    id: slug(p.id, `page${i + 1}`),
    title: str(p.title, `页面${i + 1}`),
    ...(str(p.tab) ? { tab: str(p.tab) } : {}),
    blocks: arr(p.blocks).map(normBlock).filter((b): b is KkAppBlock => !!b),
  }));
  if (!pages.length) return null;
  const home = pages.some((p) => p.id === raw.home) ? str(raw.home) : pages[0].id;
  const theme = isRec(raw.theme) ? {
    ...(/^#[0-9a-f]{3,8}$/i.test(str(raw.theme.accent)) ? { accent: str(raw.theme.accent) } : {}),
    ...(raw.theme.dark === true ? { dark: true } : {}),
  } : undefined;
  return { schema: KKAPP_SCHEMA, type, ...(theme && Object.keys(theme).length ? { theme } : {}), home, pages };
}

/** 校验：给创作者看的问题清单（规范化前的原始数据） */
export function validateKkApp(raw: unknown): string[] {
  const errs: string[] = [];
  if (!isRec(raw)) return ["应用内容须为对象"];
  const pages = arr(raw.pages);
  if (!pages.length) errs.push("至少需要一个页面（pages）");
  const ids = new Set<string>();
  pages.forEach((p, i) => {
    if (!isRec(p)) { errs.push(`pages[${i}] 不是对象`); return; }
    const id = str(p.id);
    if (!id) errs.push(`第 ${i + 1} 页缺少 id`);
    else if (ids.has(id)) errs.push(`页面 id「${id}」重复`);
    ids.add(id);
    arr(p.blocks).forEach((b, j) => {
      if (!isRec(b) || !(KKAPP_BLOCK_KINDS as readonly string[]).includes(str(b.kind))) errs.push(`页面「${id || i + 1}」第 ${j + 1} 块类型不支持：${isRec(b) ? str(b.kind) : "?"}`);
    });
  });
  if (raw.home !== undefined && !ids.has(str(raw.home))) errs.push(`首页「${str(raw.home)}」不存在`);
  for (const go of collectKkAppGoTargets(raw)) if (!ids.has(go)) errs.push(`跳转目标页「${go}」不存在`);
  return errs;
}

/** 所有 go 跳转目标（校验用） */
export function collectKkAppGoTargets(raw: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!isRec(v)) return;
    if (typeof v.go === "string" && v.go) out.add(v.go);
    for (const x of Object.values(v)) walk(x);
  };
  walk(raw);
  return [...out];
}

/** 所有被引用的 metric（属性检查用） */
export function collectKkAppMetrics(raw: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!isRec(v)) return;
    if (typeof v.metric === "string" && v.metric) out.add(v.metric);
    for (const x of Object.values(v)) walk(x);
  };
  walk(raw);
  return [...out];
}

/** 各类型的起步模板（空白但可直接渲染） */
export function kkAppStarter(type: KkAppType, name = "新应用"): KkAppSpec {
  const page = (blocks: KkAppBlock[]): KkAppSpec => ({ schema: KKAPP_SCHEMA, type, home: "home", pages: [{ id: "home", title: name, blocks }] });
  switch (type) {
    case "chat": return page([{ kind: "chat", contact: "联系人", messages: [{ from: "them", text: "在吗？" }] }]);
    case "message": return page([{ kind: "list", title: "消息", items: [{ id: "m1", title: "系统通知", subtitle: "欢迎使用" }] }]);
    case "read": return page([{ kind: "header", title: name }, { kind: "text", text: "正文内容" }]);
    case "video": return page([{ kind: "feed", posts: [{ id: "v1", author: name, text: "第一条视频" }] }]);
    case "job": return page([{ kind: "list", title: "职位", items: [{ id: "j1", title: "职位名称", subtitle: "要求", meta: "报酬" }] }]);
    default: return page([{ kind: "header", title: name }, { kind: "text", text: "介绍文字" }]);
  }
}

/** 旧版纯文本内容 → kkapp（兼容：文字放进阅读页） */
export function kkAppFromLegacy(content: unknown, type: KkAppType = "browse", name = "应用"): KkAppSpec {
  if (isKkApp(content)) return normalizeKkApp(content, type) ?? kkAppStarter(type, name);
  const text = typeof content === "string" ? content : isRec(content) && typeof content.text === "string" ? content.text : "";
  return { schema: KKAPP_SCHEMA, type, home: "home", pages: [{ id: "home", title: name, blocks: text ? [{ kind: "text", text }] : [] }] };
}

/**
 * 对话补丁合并：pages 按 id 合并（同 id 整页替换），removePages 删除页；其余字段覆盖。
 * 这样 AI 每轮只需输出改动的页面。
 */
export function mergeKkAppPatch(base: KkAppSpec, patch: unknown): KkAppSpec {
  if (!isRec(patch)) return base;
  const pages = [...base.pages];
  for (const p of arr(patch.pages)) {
    if (!isRec(p) || !str(p.id)) continue;
    const i = pages.findIndex((x) => x.id === p.id);
    if (i >= 0) pages[i] = { ...pages[i], ...(p as object) } as KkAppPage; else pages.push(p as unknown as KkAppPage);
  }
  const removed = new Set(arr(patch.removePages).map((x) => str(x)));
  const merged = {
    ...base, ...(isRec(patch.theme) ? { theme: { ...base.theme, ...patch.theme } } : {}),
    ...(str(patch.type) ? { type: patch.type } : {}), ...(str(patch.home) ? { home: patch.home } : {}),
    pages: pages.filter((p) => !removed.has(p.id)),
  };
  return normalizeKkApp(merged, base.type) ?? base;
}

/** 给 AI 的应用规范说明 */
export function kkAppPromptSpec(attrs: { id: string; label: string }[] = []): string {
  const attrLine = attrs.length ? attrs.map((a) => `"c:${a.id}"(${a.label})`).join("、") : "（作品属性由作者定义；不确定时只用内置指标）";
  return `【手机应用规范 kkapp@1】应用是纯配置，不写代码。
结构：{"schema":"kkapp@1","type":"chat|message|browse|read|video|job","theme":{"accent":"#hex","dark":false},"home":"首页id","pages":[{"id","title","tab"?:"底栏名(写了就出现在底部标签栏)","blocks":[...]}]}
组件块 blocks（自上而下）：
  - {"kind":"header","title","subtitle"?,"cover"?:图片URL}
  - {"kind":"text","text","when"?}  文案里可写 {c:属性id} {money} {fame} 等占位，显示当前数值
  - {"kind":"notice","text","tone":"info|warn|good","when"?}
  - {"kind":"stats","items":[{"label","metric"}]}  显示数值
  - {"kind":"list","title"?,"items":[{"id","title","subtitle"?,"meta"?,"image"?,"badge"?,"action"?,"when"?}]}
  - {"kind":"feed","posts":[{"id","author","avatar"?,"text","image"?,"time"?,"likes"?}]}
  - {"kind":"chat","contact","avatar"?,"messages":[{"from":"me|them","text","time"?}]}
  - {"kind":"buttons","items":[{"id","label","style":"primary|plain","action"}]}
  - {"kind":"divider"}
动作 action：{"go"?:页面id,"effects"?:[{"metric","delta"}|{"flag","delta","set"?}|{"rel":npcId,"delta"}],"when"?:[条件],"lockedHint"?,"toast"?,"once"?:true,"cooldownDays"?,"log"?:"写进剧情的一句话"}
条件：{"metric","op":"gte|lte","value"} | {"flag","op","value"} | {"rel":npcId,"op","value"}
metric 只能用：${attrLine}，或内置 money/stress/energy/fame/reputation/works。花钱用 {"metric":"money","delta":-数额} 并配 when 检查余额。
禁止脚本、网址请求、跨作品数据；效果数值要克制，配合 cooldownDays / once 防止刷数值。`;
}

/* ═══ 沙盒运行时：实时预览用，不读写任何存档 ═══ */
export type KkSandbox = { metrics: Record<string, number>; flags: Record<string, number>; rel: Record<string, number>; day: number };
const SANDBOX_BASE: Record<string, number> = { money: 5000, stress: 20, energy: 100, fame: 0, reputation: 50, works: 0 };

/** 初始沙盒：内置指标给常见初值，应用里引用到的属性给 50（可在预览面板调整） */
export function kkSandboxInit(spec: KkAppSpec | null, seed?: Partial<KkSandbox>): KkSandbox {
  const metrics: Record<string, number> = { ...SANDBOX_BASE };
  for (const m of spec ? collectKkAppMetrics(spec) : []) if (!(m in metrics)) metrics[m] = 50;
  return { metrics: { ...metrics, ...(seed?.metrics ?? {}) }, flags: { ...(seed?.flags ?? {}) }, rel: { ...(seed?.rel ?? {}) }, day: seed?.day ?? 0 };
}

export const kkSandboxRead = (s: KkSandbox, metric: string) => s.metrics[metric] ?? 0;

export function kkSandboxCond(c: KkAppCond, s: KkSandbox): boolean {
  const have = "metric" in c ? kkSandboxRead(s, c.metric) : "flag" in c ? s.flags[c.flag] ?? 0 : s.rel[c.rel] ?? 0;
  return c.op === "lte" ? have <= c.value : have >= c.value;
}

export function kkSandboxApply(effects: KkAppEffect[], s: KkSandbox, label: (metric: string) => string = (m) => m): { next: KkSandbox; changes: string[] } {
  const next: KkSandbox = { ...s, metrics: { ...s.metrics }, flags: { ...s.flags }, rel: { ...s.rel } };
  const changes: string[] = [];
  const fmt = (d: number) => `${d > 0 ? "+" : ""}${d}`;
  for (const e of effects) {
    if ("metric" in e) {
      const floor = e.metric !== "money";
      const v = (next.metrics[e.metric] ?? 0) + e.delta;
      next.metrics[e.metric] = floor ? Math.max(0, v) : v;
      changes.push(`${label(e.metric)} ${fmt(e.delta)}`);
    } else if ("flag" in e) next.flags[e.flag] = e.set ? e.delta : (next.flags[e.flag] ?? 0) + e.delta;
    else { next.rel[e.rel] = Math.max(0, Math.min(100, (next.rel[e.rel] ?? 0) + e.delta)); changes.push(`与 ${e.rel} 关系 ${fmt(e.delta)}`); }
  }
  return { next, changes };
}
