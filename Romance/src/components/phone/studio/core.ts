/* ═══ 开发者工坊 · 数据层 ═══
 * 玩家通过对话生成「小手机应用」：AppSpec 描述页面与积木块，由 Runner 解释运行。
 * 流程：草稿 → 完整性检查（Skill 校验 + 页面/交互/数据/资料）→ 审核中心 → 审核通过 → 发布到应用商店。 */
import { loadGlobal, saveGlobal, removeGlobal } from "../../../lib/saveScope";
import { useSyncExternalStore } from "react";

/* ——— 应用描述 ——— */
export type BlockType = "text" | "stat" | "list" | "todo" | "note" | "form" | "records" | "counter" | "button" | "image";
export type Block = {
  id: string;
  type: BlockType;
  title?: string;
  text?: string; // text / button 文案 / toast 内容
  items?: string[]; // list 条目；stat 为「标签:数值」
  fields?: { key: string; label: string; kind?: "text" | "number" | "date" }[]; // form 字段
  action?: "navigate" | "toast" | "save" | "none"; // button 行为
  target?: string; // navigate 目标页 id
  store?: string; // form / records 共享的数据表名
  source?: import("./live").LiveSource; // text / list / stat：接入游戏世界的数据源（实时读取，刷新即更新）
  prompt?: string; // source = "ai" 时：让 AI 结合当前世界写什么
};
export type Page = { id: string; name: string; blocks: Block[] };
/* 布局习惯：由 AI 向玩家确认，运行器严格按此渲染；确认过的习惯会记住，下个应用默认沿用 */
export type Layout = {
  nav: "bottom" | "top" | "side"; // 导航位置
  density: "compact" | "comfortable" | "loose"; // 信息密度
  style: "card" | "list" | "flat"; // 内容呈现
  radius: "sharp" | "round" | "pill"; // 圆角
  font: "sm" | "md" | "lg"; // 字号
  hand: "right" | "left" | "center"; // 主按钮位置（单手习惯）
  header: "large" | "small"; // 标题栏
  dark: boolean; // 深色界面
};
export const LAYOUT_OPTS: { [K in keyof Layout]: { label: string; opts: [Layout[K], string][] } } = {
  nav: { label: "导航位置", opts: [["bottom", "底部"], ["top", "顶部"], ["side", "侧边抽屉"]] },
  density: { label: "信息密度", opts: [["compact", "紧凑"], ["comfortable", "适中"], ["loose", "宽松"]] },
  style: { label: "内容呈现", opts: [["card", "卡片"], ["list", "列表"], ["flat", "平铺"]] },
  radius: { label: "圆角", opts: [["sharp", "方正"], ["round", "圆润"], ["pill", "胶囊"]] },
  font: { label: "字号", opts: [["sm", "小"], ["md", "标准"], ["lg", "大"]] },
  hand: { label: "主按钮", opts: [["right", "右手边"], ["left", "左手边"], ["center", "居中通栏"]] },
  header: { label: "标题栏", opts: [["large", "大标题"], ["small", "小标题"]] },
  dark: { label: "界面", opts: [[false, "浅色"], [true, "深色"]] },
};
export const DEFAULT_LAYOUT: Layout = { nav: "bottom", density: "comfortable", style: "card", radius: "round", font: "md", hand: "center", header: "small", dark: false };
const HABIT_KEY = "star2005.phone.studio.habits";
export const loadHabits = (): Layout | null => { const v = loadGlobal<Partial<Layout> | null>(HABIT_KEY, null); return v ? { ...DEFAULT_LAYOUT, ...v } : null; };
export const saveHabits = (l: Layout) => { saveGlobal(HABIT_KEY, l); };
export const layoutOf = (s: AppSpec): Layout => ({ ...DEFAULT_LAYOUT, ...(s.layout ?? {}) });
export const layoutText = (l: Layout) => (Object.keys(LAYOUT_OPTS) as (keyof Layout)[]).map((k) => `${LAYOUT_OPTS[k].label}:${LAYOUT_OPTS[k].opts.find(([v]) => v === l[k])?.[1]}`).join("，");

export type AppSpec = {
  name: string;
  type: string; // 应用类型：工具 / 阅读 / 养成…
  features: string[];
  pages: Page[];
  tabs: string[]; // 底部导航（页面 id）
  noTabs?: boolean; // 玩家明确不要底部导航（页面间用按钮跳转）
  interaction: string;
  storage: "" | "none" | "local" | "cloud";
  login: boolean | null;
  network: boolean | null;
  iconDesc: string;
  color: string;
  intro: string;
  layout: Partial<Layout> | null; // 布局习惯（需向玩家确认）
  skills: SkillId[];
  skillConfig: Partial<Record<SkillId, Record<string, string>>>;
};
export type AppMeta = { icon: string; category: string; version: string; screenshots: string[]; developer: string };
export type AppStatus = "draft" | "needs_fix" | "pending" | "reviewing" | "approved" | "rejected" | "listed" | "delisted";
export const STATUS_LABEL: Record<AppStatus, string> = {
  draft: "草稿", needs_fix: "待补全", pending: "待审核", reviewing: "审核中", approved: "审核通过", rejected: "审核驳回", listed: "已上架", delisted: "已下架",
};
export const STATUS_TONE: Record<AppStatus, string> = {
  draft: "#8e8e93", needs_fix: "#ff9500", pending: "#5e5ce6", reviewing: "#0a84ff", approved: "#34c759", rejected: "#ff3b30", listed: "#30b0c7", delisted: "#8e8e93",
};
export type Turn = { role: "user" | "assistant"; text: string };
export type UserApp = {
  id: string; spec: AppSpec; meta: AppMeta; status: AppStatus; turns: Turn[];
  report?: Report; review?: { opinion: string; reasons: string[]; at: number };
  createdAt: number; updatedAt: number; publishedAt?: number; rating?: number;
  reviews?: import("./review").ReviewRecord[]; reviewStartedAt?: number; reviewError?: string;
};

/* ——— 内置 Skill ——— */
export type SkillId = "ui" | "form" | "db" | "auth" | "pay" | "upload" | "notify" | "test" | "pack" | "audit";
export type Skill = {
  id: SkillId; name: string; desc: string; system?: boolean; // system = 提交时自动运行，无需选择
  config?: { key: string; label: string; placeholder: string }[];
  needed: (s: AppSpec) => string | null; // 返回「为什么需要」，null = 不需要
  check?: (s: AppSpec) => string[]; // 返回问题列表
};
const has = (s: AppSpec, t: BlockType) => s.pages.some((p) => p.blocks.some((b) => b.type === t));
const feat = (s: AppSpec, re: RegExp) => re.test(s.features.join(" ") + s.intro + s.type);
export const SKILLS: Skill[] = [
  { id: "ui", name: "UI 页面生成", desc: "生成页面结构、底部导航与积木块", needed: () => "所有应用都需要页面",
    check: (s) => s.pages.filter((p) => !p.blocks.length).map((p) => `页面「${p.name}」是空白页`) },
  { id: "form", name: "表单生成", desc: "录入字段 + 保存按钮", needed: (s) => (has(s, "form") ? "应用里有表单" : null),
    check: (s) => s.pages.flatMap((p) => p.blocks.filter((b) => b.type === "form" && !(b.fields ?? []).length).map(() => `「${p.name}」的表单没有字段`)) },
  { id: "db", name: "数据库生成", desc: "本机数据表，保存记录/待办/笔记", config: [{ key: "table", label: "数据表名", placeholder: "如 records" }],
    needed: (s) => (s.storage === "local" || s.storage === "cloud" || has(s, "form") || has(s, "todo") || has(s, "note") || has(s, "counter") ? "应用需要保存数据" : null),
    check: (s) => (s.storage === "none" && (has(s, "form") || has(s, "todo")) ? ["存储需求选了「不需要」，但页面里有要保存的数据"] : []) },
  { id: "auth", name: "登录注册", desc: "本机账号登录页", config: [{ key: "mode", label: "登录方式", placeholder: "如 手机号 / 昵称" }],
    needed: (s) => (s.login ? "需求里勾选了登录" : null) },
  { id: "pay", name: "支付功能", desc: "游戏内钱包模拟支付", config: [{ key: "merchant", label: "收款方名称", placeholder: "如 小店" }],
    needed: (s) => (feat(s, /支付|付款|会员|购买|充值/) ? "功能里提到支付/会员" : null) },
  { id: "upload", name: "文件上传", desc: "图片上传与预览", config: [{ key: "maxMB", label: "单个文件上限 (MB)", placeholder: "如 2" }],
    needed: (s) => (has(s, "image") || feat(s, /上传|相册|照片/) ? "需要上传图片" : null),
    check: (s) => { const v = Number(s.skillConfig.upload?.maxMB); return s.skillConfig.upload?.maxMB && !(v > 0 && v <= 10) ? ["上传上限需在 1~10 MB"] : []; } },
  { id: "notify", name: "消息通知", desc: "提醒与弹窗通知", config: [{ key: "when", label: "提醒时机", placeholder: "如 每天 21:00" }],
    needed: (s) => (feat(s, /提醒|通知|闹钟|打卡/) ? "功能里提到提醒/通知" : null) },
  { id: "test", name: "应用测试", desc: "逐页打开、点按按钮、读写数据", system: true, needed: () => "提交时自动运行" },
  { id: "pack", name: "应用打包", desc: "校验版本号与资源，生成安装包", system: true, needed: () => "提交时自动运行" },
  { id: "audit", name: "应用审核", desc: "内容合规与体验预审", system: true, needed: () => "提交时自动运行" },
];
export const skillById = (id: string) => SKILLS.find((k) => k.id === id);
export const neededSkills = (s: AppSpec) => SKILLS.filter((k) => !k.system && k.needed(s));

/* ——— 需求确认清单（12 项，未确认时小珠必须追问） ——— */
export const REQUIREMENTS: { key: string; label: string; ok: (s: AppSpec) => boolean }[] = [
  { key: "name", label: "应用名称", ok: (s) => !!s.name.trim() },
  { key: "type", label: "应用类型", ok: (s) => !!s.type.trim() },
  { key: "features", label: "主要功能", ok: (s) => s.features.length > 0 },
  { key: "pages", label: "页面结构", ok: (s) => s.pages.length > 0 },
  { key: "tabs", label: "底部导航", ok: (s) => s.tabs.length > 0 || !!s.noTabs },
  { key: "interaction", label: "交互方式", ok: (s) => !!s.interaction.trim() },
  { key: "storage", label: "数据存储", ok: (s) => !!s.storage },
  { key: "login", label: "是否登录", ok: (s) => s.login !== null },
  { key: "network", label: "是否联网", ok: (s) => s.network !== null },
  { key: "iconDesc", label: "应用图标", ok: (s) => !!s.iconDesc.trim() },
  { key: "color", label: "主题颜色", ok: (s) => /^#[0-9a-f]{6}$/i.test(s.color) },
  { key: "intro", label: "应用简介", ok: (s) => s.intro.trim().length >= 10 },
  { key: "layout", label: "布局习惯", ok: (s) => !!s.layout && Object.keys(s.layout).length > 0 },
];
export const missingReqs = (s: AppSpec) => REQUIREMENTS.filter((r) => !r.ok(s));

/* ——— 图标规范 ——— */
export const ICON_RULE = { types: ["image/png", "image/jpeg", "image/webp"], min: 512, max: 1024, maxKB: 1024 };
export type IconCheck = { ok: boolean; problems: string[]; w: number; h: number };
export async function checkIconFile(f: File): Promise<IconCheck & { url: string }> {
  const url = await readAsDataURL(f);
  const problems: string[] = [];
  if (!ICON_RULE.types.includes(f.type)) problems.push("只支持 PNG、JPG、WebP 格式");
  if (f.size > ICON_RULE.maxKB * 1024) problems.push(`文件不能超过 ${ICON_RULE.maxKB} KB（当前 ${Math.round(f.size / 1024)} KB）`);
  let w = 0, h = 0;
  try { ({ w, h } = await imgSize(url)); } catch { problems.push("图片无法读取"); }
  if (w && w !== h) problems.push(`必须是正方形（当前 ${w}×${h}）`);
  if (w && (Math.min(w, h) < ICON_RULE.min || Math.max(w, h) > ICON_RULE.max)) problems.push(`尺寸需在 ${ICON_RULE.min}~${ICON_RULE.max} 像素之间（当前 ${w}×${h}）`);
  return { ok: !problems.length, problems, w, h, url };
}
export const readAsDataURL = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f); });
const imgSize = (url: string) => new Promise<{ w: number; h: number }>((res, rej) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = url; });
/** 自动适配：居中裁成正方形并缩放到 512×512 PNG */
export async function autoFitIcon(url: string): Promise<string> {
  const i = new Image(); i.src = url; await i.decode();
  const s = Math.min(i.naturalWidth, i.naturalHeight), c = document.createElement("canvas");
  c.width = c.height = 512;
  c.getContext("2d")!.drawImage(i, (i.naturalWidth - s) / 2, (i.naturalHeight - s) / 2, s, s, 0, 0, 512, 512);
  return c.toDataURL("image/png");
}
/** 元数据里的图标是否合规（仅接受工坊生成/适配后的 512 PNG data URL，或已校验的上传） */
export const iconValid = (m: AppMeta) => m.icon.startsWith("data:image/");
/** 生成默认图标：主题色渐变 + 名称首字 */
export function makeIcon(s: AppSpec): string {
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const g = c.getContext("2d")!, col = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#7cc8a6";
  const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, col); gr.addColorStop(1, shade(col, -40));
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.arc(400, 110, 150, 0, 7); g.fill();
  g.fillStyle = "#fff"; g.font = "bold 260px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText((s.name.trim() || "应").charAt(0), 256, 276);
  return c.toDataURL("image/png");
}
/** 生成页面预览截图（示意稿） */
export function makeShot(s: AppSpec, p: Page): string {
  const c = document.createElement("canvas"); c.width = 390; c.height = 780;
  const g = c.getContext("2d")!, col = /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#7cc8a6";
  g.fillStyle = "#f6f7f9"; g.fillRect(0, 0, 390, 780);
  g.fillStyle = col; g.fillRect(0, 0, 390, 110);
  g.fillStyle = "#fff"; g.font = "bold 30px system-ui, sans-serif"; g.fillText(p.name, 24, 78);
  let y = 134;
  for (const b of p.blocks.slice(0, 6)) {
    const h = b.type === "list" || b.type === "todo" || b.type === "records" ? 150 : b.type === "button" ? 56 : 96;
    g.fillStyle = b.type === "button" ? col : "#fff"; roundRect(g, 20, y, 350, h, 18); g.fill();
    g.fillStyle = b.type === "button" ? "#fff" : "#333"; g.font = "bold 20px system-ui, sans-serif";
    g.fillText(b.title || b.text || BLOCK_LABEL[b.type], 40, y + (b.type === "button" ? 36 : 38));
    if (b.type !== "button") { g.fillStyle = "#e3e5e9"; for (let k = 0; k < (h > 100 ? 3 : 1); k++) { roundRect(g, 40, y + 56 + k * 30, 260 - k * 40, 14, 7); g.fill(); } }
    y += h + 16; if (y > 700) break;
  }
  if (s.tabs.length > 1) { g.fillStyle = "#fff"; g.fillRect(0, 716, 390, 64); g.fillStyle = "#999"; g.font = "16px system-ui"; s.tabs.forEach((t, i) => g.fillText(s.pages.find((x) => x.id === t)?.name ?? t, 20 + (i * 370) / s.tabs.length, 756)); }
  return c.toDataURL("image/png");
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function shade(hex: string, d: number) { const n = parseInt(hex.slice(1), 16); const f = (v: number) => Math.max(0, Math.min(255, v + d)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
export const BLOCK_LABEL: Record<BlockType, string> = { text: "文字", stat: "数据卡", list: "列表", todo: "待办清单", note: "笔记", form: "表单", records: "记录列表", counter: "计数器", button: "按钮", image: "图片上传" };

/* ——— 完整性检查 ——— */
export type CheckLevel = "done" | "risk" | "must" | "fail";
export const LEVEL_LABEL: Record<CheckLevel, string> = { done: "已完成", risk: "存在风险", must: "必须补全", fail: "检查失败" };
export const LEVEL_TONE: Record<CheckLevel, string> = { done: "#34c759", risk: "#ff9500", must: "#ff3b30", fail: "#af52de" };
export type CheckItem = { group: "资料" | "Skill" | "页面" | "交互" | "数据" | "体验"; level: CheckLevel; title: string; hint?: string };
export type Report = { items: CheckItem[]; at: number; pass: boolean; summary: Record<CheckLevel, number> };
const KNOWN = new Set(Object.keys(BLOCK_LABEL));
const UNFINISHED = /TODO|待定|待补|未完成|xxx|\.\.\.|…/i;
const BANNED = /赌博|博彩|色情|毒品|诈骗|外挂/;

export function runChecks(app: UserApp): Report {
  const s = app.spec, m = app.meta, out: CheckItem[] = [];
  const add = (group: CheckItem["group"], level: CheckLevel, title: string, hint?: string) => out.push({ group, level, title, hint });
  const req = (ok: boolean, group: CheckItem["group"], title: string, hint: string) => add(group, ok ? "done" : "must", ok ? title : `缺少${title}`, ok ? undefined : hint);

  // 资料
  req(!!s.name.trim() && s.name.length <= 12, "资料", "应用名称", "在「资料」里填写 1~12 字的应用名称");
  req(iconValid(m), "资料", "应用图标", `上传 ${ICON_RULE.min}~${ICON_RULE.max} 像素正方形 PNG/JPG/WebP，或点「生成图标」`);
  req(s.intro.trim().length >= 10, "资料", "应用简介", "简介至少 10 个字，说清楚应用能做什么");
  req(!!m.category.trim(), "资料", "应用分类", "选择一个分类");
  req(/^\d+\.\d+\.\d+$/.test(m.version), "资料", "版本号", "版本号格式为 1.0.0");
  req(m.screenshots.length > 0, "资料", "应用截图", "至少上传 1 张截图，或点「生成页面截图」");
  req(!!m.developer.trim(), "资料", "开发者信息", "填写开发者名称");
  const miss = missingReqs(s);
  if (miss.length) add("资料", "must", `需求未确认：${miss.map((r) => r.label).join("、")}`, "回到对话，让小珠帮你把这些问题确认清楚");

  // Skill
  for (const k of neededSkills(s)) {
    if (!s.skills.includes(k.id)) { add("Skill", "must", `「${k.desc}」还没开启`, "回到对话让小珠补上"); continue; }
    const emptyCfg = (k.config ?? []).filter((c) => !s.skillConfig[k.id]?.[c.key]?.trim());
    if (emptyCfg.length) { add("Skill", "must", `还需要填写：${emptyCfg.map((c) => c.label).join("、")}`, "到「填写」页补上"); continue; }
    try {
      const probs = k.check?.(s) ?? [];
      if (probs.length) probs.forEach((p) => add("Skill", "must", p, "按提示修改页面或填写内容"));
      else add("Skill", "done", `${k.desc.split(/[，、+]/)[0]}正常`);
    } catch { add("Skill", "fail", "应用内部功能出错", "回到对话让小珠重新生成"); }
  }

  // 页面
  if (!s.pages.length) add("页面", "must", "应用没有任何页面", "让小珠生成页面结构");
  const ids = new Set(s.pages.map((p) => p.id));
  for (const p of s.pages) {
    if (!p.blocks.length) { add("页面", "must", `「${p.name}」是空白页面`, "给这个页面加内容，或从导航中移除"); continue; }
    const bad = p.blocks.filter((b) => !KNOWN.has(b.type));
    if (bad.length) add("页面", "fail", `「${p.name}」无法渲染：未知组件 ${bad.map((b) => b.type).join("、")}`, "让小珠换成支持的组件");
    else add("页面", "done", `「${p.name}」可以正常打开`);
    const unf = p.blocks.filter((b) => UNFINISHED.test([b.title, b.text, ...(b.items ?? [])].join(" ")));
    if (unf.length) add("页面", "must", `「${p.name}」有未完成的内容（${unf.map((b) => b.title || BLOCK_LABEL[b.type]).join("、")}）`, "把「待定 / TODO / …」替换成真实内容");
  }
  if (s.tabs.length) {
    const lost = s.tabs.filter((t) => !ids.has(t));
    if (lost.length) add("页面", "must", `底部导航指向不存在的页面：${lost.join("、")}`, "补上这些页面或从导航里删掉");
    if (s.tabs.length > 5) add("体验", "risk", `底部导航有 ${s.tabs.length} 个，超过 5 个会很挤`, "合并成 3~5 个");
  }
  const orphan = s.pages.filter((p) => !s.tabs.includes(p.id) && !s.pages.some((q) => q.blocks.some((b) => b.action === "navigate" && b.target === p.id)));
  if ((s.tabs.length || s.noTabs) && orphan.filter((p) => p.id !== s.pages[0]?.id).length) add("页面", "risk", `页面没有入口：${orphan.map((p) => p.name).join("、")}`, "加到底部导航，或用按钮跳转过去");

  // 交互
  const buttons = s.pages.flatMap((p) => p.blocks.filter((b) => b.type === "button").map((b) => ({ p, b })));
  for (const { p, b } of buttons) {
    if (!b.action || b.action === "none") add("交互", "must", `「${p.name}」的按钮「${b.text || "未命名"}」点了没反应`, "给按钮设置跳转 / 提示 / 保存");
    else if (b.action === "navigate" && !ids.has(b.target ?? "")) add("交互", "fail", `按钮「${b.text}」跳转到不存在的页面`, "修改跳转目标");
    else if (b.action === "toast" && !b.text) add("交互", "must", "提示按钮缺少文案");
  }
  if (buttons.length && !out.some((x) => x.group === "交互" && x.level !== "done")) add("交互", "done", `${buttons.length} 个按钮均有效`);
  const forms = s.pages.flatMap((p) => p.blocks.filter((b) => b.type === "form"));
  for (const f of forms) if (!s.pages.some((p) => p.blocks.some((b) => b.type === "records" && b.store === f.store))) add("交互", "risk", `表单「${f.title || "未命名"}」保存后没地方查看`, "加一个同数据表的「记录列表」");

  // 数据：真实读写一次本机存储
  if (s.storage === "local" || has(s, "todo") || has(s, "form") || has(s, "note")) {
    try { const k = `uapp.selftest.${app.id}`; saveGlobal(k, "1"); const ok = loadGlobal<string>(k, "") === "1"; removeGlobal(k); add("数据", ok ? "done" : "fail", ok ? "数据可以正常保存与读取" : "数据写入后读不出来"); }
    catch { add("数据", "fail", "本机存储不可用（可能已满）", "清理小手机里的大图后重试"); }
  }
  if (s.storage === "cloud" && !s.network) add("数据", "must", "选择了云端存储但应用不联网", "改成本机存储，或开启联网");
  if (s.login && !s.network && s.storage === "cloud") add("数据", "risk", "离线登录无法同步账号");

  // 体验
  if (s.pages.some((p) => p.blocks.length > 12)) add("体验", "risk", "有页面组件超过 12 个，滚动太长", "拆成多个页面");
  if (s.intro.length > 0 && s.intro.length < 20) add("体验", "risk", "简介偏短，用户可能看不懂", "补充一两句使用场景");
  if (BANNED.test(s.name + s.intro + s.features.join(""))) add("体验", "must", "内容涉及违规题材", "修改应用名称、简介或功能");
  if (s.pages.length === 1 && s.features.length > 2) add("体验", "risk", "功能较多但只有一个页面", "按功能拆分页面");

  const summary = { done: 0, risk: 0, must: 0, fail: 0 } as Record<CheckLevel, number>;
  out.forEach((x) => summary[x.level]++);
  return { items: out, at: Date.now(), pass: !summary.must && !summary.fail, summary };
}

/** 审核中心：在完整性检查之上做合规与体验复审，给出意见 */
export function reviewApp(app: UserApp): { ok: boolean; opinion: string; reasons: string[] } {
  const r = runChecks(app), reasons: string[] = [];
  if (!r.pass) reasons.push(...r.items.filter((x) => x.level === "must" || x.level === "fail").map((x) => x.title));
  const risks = r.items.filter((x) => x.level === "risk");
  if (risks.length > 2) reasons.push(`体验风险过多（${risks.length} 项）：${risks.map((x) => x.title).join("；")}`);
  if (app.meta.screenshots.length < 2) reasons.push("截图少于 2 张，用户无法了解应用全貌");
  return reasons.length
    ? { ok: false, opinion: "很遗憾，本次审核未通过。请根据下列原因修改后重新提交。", reasons }
    : { ok: true, opinion: risks.length ? `审核通过。建议后续优化：${risks.map((x) => x.title).join("；")}` : "审核通过，应用完整、交互有效，可以发布到应用商店。", reasons: [] };
}

/* ——— 存储（本机，跨组件订阅） ——— */
const KEY = "star2005.phone.studio.v1";
let cache: UserApp[] | null = null;
const subs = new Set<() => void>();
const read = (): UserApp[] => { if (cache) return cache; { const v = loadGlobal<UserApp[]>(KEY, []); cache = Array.isArray(v) ? v : []; } return cache!; };
export function saveApps(list: UserApp[]) {
  cache = list;
  saveGlobal(KEY, list); // 玩家做的应用 = 编辑器作品，全局共享
  subs.forEach((f) => f());
}
export const useUserApps = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read);
export const patchApp = (id: string, p: Partial<UserApp> | ((a: UserApp) => Partial<UserApp>)) =>
  saveApps(read().map((a) => (a.id === id ? { ...a, ...(typeof p === "function" ? p(a) : p), updatedAt: Date.now() } : a)));
export const removeApp = (id: string) => saveApps(read().filter((a) => a.id !== id));

export const uid = (p = "u") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const blankSpec = (): AppSpec => ({ name: "", type: "", features: [], pages: [], tabs: [], interaction: "", storage: "", login: null, network: null, iconDesc: "", color: "", intro: "", layout: null, skills: ["ui"], skillConfig: {} });
export function newApp(developer: string): UserApp {
  const now = Date.now();
  return { id: uid("ua-"), spec: blankSpec(), meta: { icon: "", category: "", version: "1.0.0", screenshots: [], developer }, status: "draft", turns: [], createdAt: now, updatedAt: now };
}

/** 合并 AI / 模板给出的规格补丁：页面按 id 合并，其余字段覆盖 */
export function mergeSpec(s: AppSpec, p: Partial<AppSpec>): AppSpec {
  const next: AppSpec = { ...s };
  for (const [k, v] of Object.entries(p) as [keyof AppSpec, unknown][]) {
    if (v === undefined) continue;
    if (k === "pages" && Array.isArray(v)) {
      const pages = [...s.pages];
      for (const pg of v as Page[]) {
        if (!pg?.id) continue;
        const i = pages.findIndex((x) => x.id === pg.id);
        const fixed = { ...pg, blocks: (pg.blocks ?? []).map((b) => ({ ...b, id: b.id || uid("b") })) };
        if (i >= 0) pages[i] = { ...pages[i], ...fixed }; else pages.push(fixed);
      }
      next.pages = pages;
    } else if (k === "skillConfig" && v && typeof v === "object") {
      next.skillConfig = { ...s.skillConfig };
      for (const [sk, cfg] of Object.entries(v as object)) next.skillConfig[sk as SkillId] = { ...(s.skillConfig[sk as SkillId] ?? {}), ...(cfg as object) };
    } else if (k === "layout" && v && typeof v === "object") {
      next.layout = { ...(s.layout ?? {}), ...(v as Partial<Layout>) };
    } else if (k === "skills" && Array.isArray(v)) {
      next.skills = Array.from(new Set(["ui", ...(v as string[]).filter((x) => skillById(x))])) as SkillId[];
    } else (next as Record<string, unknown>)[k] = v;
  }
  return next;
}

/** 自动补全：按检查结果补齐能确定性修复的内容 */
export function autoFix(app: UserApp): UserApp {
  let s = { ...app.spec, pages: app.spec.pages.map((p) => ({ ...p, blocks: [...p.blocks] })) };
  const m = { ...app.meta, screenshots: [...app.meta.screenshots] };
  if (!s.name.trim()) s.name = "我的小应用";
  if (!s.type) s.type = "工具";
  if (!s.features.length) s.features = ["记录"];
  if (!s.interaction) s.interaction = "点按与表单输入";
  if (!s.storage) s.storage = "local";
  if (s.login === null) s.login = false;
  if (s.network === null) s.network = false;
  if (s.storage === "cloud" && !s.network) s.storage = "local";
  if (!/^#[0-9a-f]{6}$/i.test(s.color)) s.color = "#7cc8a6";
  if (!s.layout) s.layout = loadHabits() ?? DEFAULT_LAYOUT;
  if (!s.iconDesc) s.iconDesc = `${s.color} 渐变底 + 名称首字`;
  if (s.intro.trim().length < 20) s.intro = `${s.name}是一款${s.type}应用，支持${s.features.join("、")}，数据保存在本机，打开即用。`;
  if (!s.pages.length) s.pages = [{ id: "home", name: "首页", blocks: [] }];
  for (const p of s.pages) {
    if (!p.blocks.length) p.blocks.push({ id: uid("b"), type: "text", title: p.name, text: `这里是「${p.name}」，${s.intro.slice(0, 40)}` });
    p.blocks = p.blocks.filter((b) => KNOWN.has(b.type)).map((b) => {
      const clean = (t?: string) => t?.replace(UNFINISHED, "").trim();
      const nb = { ...b, title: clean(b.title), text: clean(b.text), items: b.items?.map((x) => clean(x)).filter((x): x is string => !!x) };
      // 写死的列表 / 数据卡改为按当前世界由 AI 现写，避免假数据
      if ((b.type === "list" || b.type === "stat") && !b.source) Object.assign(nb, { source: "ai" as const, prompt: b.prompt || `${b.title || BLOCK_LABEL[b.type]}：结合当前游戏世界的人物、地点与剧情写真实内容`, items: undefined });
      if (b.type === "button") {
        if (!b.action || b.action === "none") return { ...nb, action: "toast" as const, text: nb.text || "好的" };
        if (b.action === "navigate" && !s.pages.some((q) => q.id === b.target)) return { ...nb, target: s.pages[0].id };
      }
      if (b.type === "form" && !(b.fields ?? []).length) return { ...nb, fields: [{ key: "content", label: "内容" }], store: b.store || "records" };
      return nb;
    });
    if (!p.blocks.length) p.blocks.push({ id: uid("b"), type: "text", title: p.name, text: s.intro });
  }
  // 表单配套记录列表
  for (const p of s.pages) for (const f of p.blocks.filter((b) => b.type === "form")) {
    if (!s.pages.some((q) => q.blocks.some((b) => b.type === "records" && b.store === f.store))) p.blocks.push({ id: uid("b"), type: "records", title: "已保存的记录", store: f.store });
  }
  const ids = new Set(s.pages.map((p) => p.id));
  s.tabs = s.noTabs ? [] : s.tabs.filter((t) => ids.has(t));
  if (!s.noTabs) {
    if (!s.tabs.length) s.tabs = s.pages.slice(0, 4).map((p) => p.id);
    for (const p of s.pages) if (!s.tabs.includes(p.id) && s.tabs.length < 5) s.tabs.push(p.id);
  }
  s = { ...s, skills: Array.from(new Set([...s.skills.filter((id) => skillById(id)?.needed(s)), ...neededSkills(s).map((k) => k.id)])) as SkillId[] };
  for (const k of neededSkills(s)) for (const c of k.config ?? []) {
    if (!s.skillConfig[k.id]?.[c.key]) s.skillConfig = { ...s.skillConfig, [k.id]: { ...(s.skillConfig[k.id] ?? {}), [c.key]: CFG_DEFAULT[c.key] ?? "默认" } };
  }
  if (!iconValid(m)) m.icon = makeIcon(s);
  if (!m.category) m.category = CATEGORIES.includes(s.type) ? s.type : "工具";
  if (!/^\d+\.\d+\.\d+$/.test(m.version)) m.version = "1.0.0";
  if (!m.developer.trim()) m.developer = "独立开发者";
  if (m.screenshots.length < 2) m.screenshots = s.pages.slice(0, 3).map((p) => makeShot(s, p));
  return { ...app, spec: s, meta: m };
}
const CFG_DEFAULT: Record<string, string> = { table: "records", mode: "昵称", merchant: "小店", maxMB: "2", when: "每天 21:00" };
export const CATEGORIES = ["工具", "效率", "生活", "阅读", "社交", "娱乐", "养成", "财务", "健康", "学习"];

