/* ═══════════════ 模组数值体检 / 叠加影响 ═══════════════
 * 纯计算，不改任何数据，只给出提醒：
 *  - balanceCheck：只检查模组自己写的数值（绝对阈值），不和娱乐圈原版比
 *  - addonImpact / chainShadows：叠加包会替换 / 合并 / 追加哪些内容，以及被后面的包覆盖的部分 */
import { optFx } from "../game/data";
import type { FixedEffect } from "../lib/types";
import { RAW_STAT_LABELS, type BillsSlot, type StatKey, type Training } from "../game/data";
import entMod from "./ent";
import { SLOT_KEYS, type Mod, type ModContent } from "./types";
import { getSelection, modById } from "./registry";

export type Finding = { level: "warn" | "info"; area: string; text: string };
export type Impact = { key: string; label: string; op: "replace" | "merge" | "add"; numeric: boolean; text: string };

/* 槽位中文名；numeric = 会影响数值平衡 */
const SLOT_INFO: Record<string, { label: string; numeric?: boolean }> = {
  play: { label: "开局游玩偏好" }, avatars: { label: "头像库与匹配优先级" }, stats: { label: "能力设定", numeric: true }, customAttrs: { label: "自定义属性", numeric: true }, traits: { label: "特质", numeric: true },
  trainings: { label: "培训课程", numeric: true }, sideJobs: { label: "打工", numeric: true }, zodiacs: { label: "星座", numeric: true },
  startMoney: { label: "开局资金", numeric: true }, startDate: { label: "开局日期" }, startTime: { label: "开局时刻" }, dayStart: { label: "每日起始" },
  dayEnd: { label: "每日结束" }, weather: { label: "天气" }, map: { label: "地图外观" }, encounters: { label: "偶遇" }, sideQuests: { label: "支线" },
  sideQuestCast: { label: "支线角色" }, relations: { label: "关系设定", numeric: true }, calendar: { label: "日历" }, travel: { label: "出行", numeric: true },
  contracts: { label: "签约", numeric: true }, projects: { label: "项目", numeric: true }, imageCrisis: { label: "舆情" }, industry: { label: "行业" },
  help: { label: "帮助" }, opening: { label: "序章" }, cover: { label: "封面" }, weeklyPaper: { label: "周报" }, eventGroups: { label: "事件分组" },
  styles: { label: "外形风格", numeric: true }, identities: { label: "出道身份", numeric: true }, backgrounds: { label: "家庭背景", numeric: true },
  directions: { label: "职业方向", numeric: true }, school: { label: "母校" }, parentJobs: { label: "父母职业" }, creation: { label: "建角文案 / 路径" },
  weekendActs: { label: "周末活动", numeric: true }, fameTiers: { label: "名气分档", numeric: true }, titles: { label: "头衔" }, cars: { label: "座驾", numeric: true },
  npcPool: { label: "NPC 名字池" }, lore: { label: "详细设定" }, festivals: { label: "节日" }, bills: { label: "固定账单", numeric: true }, meals: { label: "饮食生活", numeric: true }, pregnancy: { label: "孕育参数", numeric: true }, gigPrices: { label: "通告价目", numeric: true },
  allowance: { label: "父母生活费", numeric: true }, tuning: { label: "引擎规则", numeric: true }, contacts: { label: "人脉页面配置" },
  // 列表内容：叠加包总是按 id 追加 / 覆盖
  rooms: { label: "地点" }, locations: { label: "地点名录" }, npcs: { label: "人物" }, items: { label: "物品" }, gigs: { label: "通告", numeric: true },
  events: { label: "随机事件", numeric: true }, fixedEvents: { label: "固定事件", numeric: true }, endings: { label: "结局" }, worldBook: { label: "世界书" },
  income: { label: "周期收入", numeric: true }, gameRules: { label: "玩法规则", numeric: true }, lookRules: { label: "剧情美化" }, worldRules: { label: "世界规则" },
};
const LIST_KEYS = ["locations", "npcs", "items", "gigs", "events", "fixedEvents", "endings", "worldBook", "income", "gameRules", "lookRules", "worldRules"] as const;
export const slotLabel = (k: string) => SLOT_INFO[k]?.label ?? k;

const STAT_KEYS = Object.keys(RAW_STAT_LABELS) as StatKey[];
const isStat = (k: string): k is StatKey => (STAT_KEYS as string[]).includes(k);
const num = (v: number) => (Math.abs(v) >= 10000 ? `${+(v / 10000).toFixed(1)}万` : String(Math.round(v * 10) / 10));
const pct = (v: number) => `${Math.round(v * 100)}%`;

/* 能力上限（缺省 999） */
const spanOf = (c: ModContent | undefined, k: StatKey) => { const r = c?.stats?.range?.[k]; const min = Math.max(0, r?.min ?? 0); return Math.max(min + 1, r?.max ?? 999) - min; };

/* 建角加成池里单项最大能力加成（绝对值） */
type BonusSrc = Parameters<typeof optFx>[0] & { name: string };
function maxStartBonus(pools: (BonusSrc[] | undefined)[]): { v: number; who: string; stat: StatKey } | null {
  let best: { v: number; who: string; stat: StatKey } | null = null;
  for (const pool of pools) for (const o of pool ?? []) for (const [k, v] of Object.entries(optFx(o)?.stats ?? {})) { // 作者配置的开局加成（含旧写法自动转换）
    if (!isStat(k) || typeof v !== "number") continue;
    if (!best || Math.abs(v) > Math.abs(best.v)) best = { v, who: o.name, stat: k };
  }
  return best;
}
/* 最快练满某项能力需要几次课（取收益区间中值） */
function fastestCourse(list: Training[] | undefined, span: (k: StatKey) => number, mul: number): { n: number; who: string; stat: StatKey } | null {
  let best: { n: number; who: string; stat: StatKey } | null = null;
  for (const t of list ?? []) for (const [k, r] of Object.entries(t.gain ?? {})) {
    if (!isStat(k) || !r) continue;
    const avg = ((r[0] + r[1]) / 2) * mul;
    if (avg <= 0) continue;
    const n = span(k) / avg;
    if (!best || n < best.n) best = { n, who: t.name, stat: k };
  }
  return best;
}
/* 在事件 / 规则里找出所有属性变化（结构各异，统一递归找 { kind, key, delta }） */
function effectsIn(v: unknown, out: FixedEffect[] = [], depth = 0): FixedEffect[] {
  if (!v || typeof v !== "object" || depth > 8) return out;
  if (Array.isArray(v)) { for (const x of v) effectsIn(x, out, depth + 1); return out; }
  const o = v as Record<string, unknown>;
  if ((o.kind === "stat" || o.kind === "metric") && typeof o.key === "string" && typeof o.delta === "number") out.push(o as FixedEffect);
  for (const x of Object.values(o)) if (x && typeof x === "object") effectsIn(x, out, depth + 1);
  return out;
}
const billWeek = (b: BillsSlot) => (b.weekly ?? []).reduce((a, x) => a + x.amount, 0) + (b.monthly ?? []).reduce((a, x) => a + x.amount, 0) / 4;

/** 数值体检。世界观：查自己写的数值；叠加包：只查本包写的数值。不与娱乐圈对比。 */
export function balanceCheck(mod: Mod, baseWorld?: Mod): Finding[] {
  const c = mod.content;
  const ctx: ModContent = mod.kind === "addon" && baseWorld ? { ...baseWorld.content, ...c, stats: c.stats ?? baseWorld.content.stats } : c;
  const out: Finding[] = [];
  const span = (k: StatKey) => spanOf(ctx, k);
  const L = (k: StatKey) => ctx.stats?.labels?.[k] || RAW_STAT_LABELS[k];
  const t = c.tuning ?? {};
  const gainMul = t.trainGainMul ?? ctx.tuning?.trainGainMul ?? 1;

  // —— 能力上下限 ——
  for (const [k, r] of Object.entries(c.stats?.range ?? {})) {
    if (!isStat(k) || !r) continue;
    if (r.max <= r.min) out.push({ level: "warn", area: "能力设定", text: `「${L(k)}」上限 ${r.max} 不大于下限 ${r.min}，引擎会强制把上限设为下限 +1。` });
    const b = c.stats?.base?.[k];
    if (typeof b === "number" && (b < r.min || b > r.max)) out.push({ level: "warn", area: "能力设定", text: `「${L(k)}」初始值 ${b} 超出范围 ${r.min}~${r.max}，开局就会被截断。` });
  }

  // —— 建角加成：单项加成占上限比例过大 ——
  const pools: [string, BonusSrc[] | undefined][] = [["出道身份", c.identities], ["外形风格", c.styles], ["家庭背景", c.backgrounds], ["职业方向", c.directions], ["星座", c.zodiacs]];
  for (const [area, pool] of pools) {
    const b = maxStartBonus([pool]);
    if (!b) continue;
    const ratio = Math.abs(b.v) / span(b.stat);
    if (ratio > 0.2)
      out.push({ level: "warn", area, text: `「${b.who}」${L(b.stat)} ${b.v > 0 ? "+" : ""}${b.v}，占上限 ${pct(ratio)}，开局差距会很大。` });
  }

  // —— 人物线路没有对应的开局加成 ——
  const ids = new Set((c.identities ?? (mod.kind === "addon" ? baseWorld?.content.identities : undefined) ?? []).map((o) => o.id));
  for (const p of c.creation?.paths ?? []) if (p.open && !ids.has(p.id))
    out.push({ level: "info", area: "人物线路", text: `路径「${p.name}」没有同 id（${p.id}）的出道身份，选它开局不会有数值加成。` });

  // —— 课程：最快几次课练满（只用本作品课程，不回落娱乐圈） ——
  if (c.trainings?.length || t.trainGainMul !== undefined) {
    const list = c.trainings ?? (mod.kind === "addon" ? baseWorld?.content.trainings : undefined);
    const f = fastestCourse(list, span, gainMul);
    if (f && f.n < 50)
      out.push({ level: "warn", area: "培训课程", text: `「${f.who}」约 ${Math.ceil(f.n)} 次课就能把${L(f.stat)}练满，养成会很快到顶。` });
    if (f && f.n > 1250)
      out.push({ level: "info", area: "培训课程", text: `最快的课也要约 ${Math.round(f.n)} 次才能练满${L(f.stat)}，成长可能偏慢。` });
  }
  for (const tr of c.trainings ?? []) {
    if (!Object.values(tr.gain ?? {}).some((r) => r && r[1] > 0) && !Object.keys(tr.cgain ?? {}).length && !tr.fame && !tr.reputation)
      out.push({ level: "info", area: "培训课程", text: `「${tr.name}」没有任何收益，上了也白上。` });
    if (tr.cost < 0 || tr.energy < 0) out.push({ level: "warn", area: "培训课程", text: `「${tr.name}」学费或体力为负数，上课反而赚钱 / 回体力，可被无限刷。` });
  }

  // —— 打工：门槛越高收入应越高 ——
  const jobs = [...(c.sideJobs ?? [])].sort((a, b) => a.fameReq - b.fameReq);
  for (let i = 1; i < jobs.length; i++) if (jobs[i].pay < jobs[i - 1].pay && jobs[i].fameReq > jobs[i - 1].fameReq)
    out.push({ level: "info", area: "打工", text: `「${jobs[i].label}」门槛更高，收入（${num(jobs[i].pay)}）却低于「${jobs[i - 1].label}」（${num(jobs[i - 1].pay)}）。` });

  // —— 引擎倍率（绝对阈值，不提原版） ——
  const mul = (v: number | undefined, name: string, hi: number, lo: number) => {
    if (v === undefined) return;
    if (v > hi) out.push({ level: "warn", area: "引擎规则", text: `${name} ×${v}，偏高。` });
    else if (v < lo) out.push({ level: "info", area: "引擎规则", text: `${name} ×${v}，偏低。` });
  };
  mul(t.trainGainMul, "课程收益倍率", 2, 0.3); mul(t.jobPayMul, "打工收入倍率", 2, 0.3); mul(t.trainFeeMul, "学费倍率", 3, 0.3);
  for (const [g, v] of Object.entries(t.gradeMul ?? {})) if (typeof v === "number" && v > 3) out.push({ level: "warn", area: "引擎规则", text: `评级「${g}」收益倍率 ×${v}，一次好评级就能拉开很大差距。` });

  // —— 经济：只用本作品已写账单 ——
  if (c.bills || (mod.kind === "addon" && ctx.bills && baseWorld?.content.bills)) {
    const bills = c.bills ?? ctx.bills;
    if (bills) {
      const bw = billWeek(bills);
      if (bw > 0 && c.startMoney !== undefined) {
        if (c.startMoney >= bw * 52) out.push({ level: "info", area: "开局资金", text: `开局资金 ${num(c.startMoney)} 够付约 ${Math.floor(c.startMoney / bw)} 周账单，前期几乎没有经济压力。` });
      }
      const passive = (Array.isArray(c.income) ? c.income : []).filter((r) => r && r.enabled !== false && !(r.conds ?? []).length && r.target?.kind === "metric" && r.target?.key === "money");
      const pw = passive.reduce((a, r) => a + (r.min + r.max) / 2, 0);
      if (bw > 0 && pw > bw * 1.5) out.push({ level: "warn", area: "周期收入", text: `无条件收入每周约 ${num(pw)}，是每周账单（约 ${num(bw)}）的 ${(pw / bw).toFixed(1)} 倍，不打工也稳赚。` });
    }
  }

  // —— 事件 / 规则：单次属性变化占上限 ——
  type Ev = { name?: string; title?: string; id: string; when?: unknown; chance?: number };
  const scan = (area: string, list: unknown[] | undefined) => {
    for (const e of (list ?? []) as Ev[]) {
      const daily = e.when === "day";
      const freq = (e.chance ?? 100) / 100;
      for (const f of effectsIn(e)) {
        if (f.kind !== "stat" || !isStat(f.key)) continue;
        const r = Math.abs(f.delta) / span(f.key);
        const nm = (typeof e.name === "string" && e.name) || (typeof e.title === "string" && e.title) || e.id;
        if (daily && r * freq * 365 > 1) out.push({ level: "warn", area, text: `「${nm}」每天${freq < 1 ? `有 ${pct(freq)} 概率` : ""}${L(f.key)} ${f.delta > 0 ? "+" : ""}${f.delta}，一年累计可达上限的 ${pct(r * freq * 365)}。` });
        else if (!daily && r >= 0.1) out.push({ level: "warn", area, text: `「${nm}」一次${L(f.key)} ${f.delta > 0 ? "+" : ""}${f.delta}，占上限 ${pct(r)}。` });
      }
    }
  };
  scan("玩法规则", c.gameRules); scan("随机事件", c.events); scan("固定事件", c.fixedEvents);

  // 去重（同一条规则多分支会重复）
  const seen = new Set<string>();
  return out.filter((f) => !seen.has(f.text) && !!seen.add(f.text)).sort((a, b) => (a.level === b.level ? 0 : a.level === "warn" ? -1 : 1));
}

/** @deprecated 编辑器已不再展示「沿用娱乐圈」；保留空实现以免旧引用报错 */
export function inheritedSlots(_mod: Mod): { key: string; label: string; numeric: boolean }[] {
  return [];
}

/* 某槽在 prior 链里最终的值（缺省不回落娱乐圈，避免叠加体检误报） */
function priorValue(prior: Mod[], k: string): unknown {
  for (let i = prior.length - 1; i >= 0; i--) { const v = (prior[i].content as Record<string, unknown>)[k]; if (v !== undefined) return v; }
  return undefined;
}
const idsOf = (v: unknown) => new Set(Array.isArray(v) ? v.map((x) => (x as { id?: string })?.id).filter(Boolean) as string[] : []);
const idList = (v: unknown) => (Array.isArray(v) ? v : []) as { id?: string; name?: string; label?: string }[];
const nameOf = (x: { id?: string; name?: string; label?: string }) => x.name || x.label || x.id || "";

/* 内容相同就不算改动（内置扩展包会重复声明世界观原有的数据） */
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
const impactCache = new WeakMap<object, { sig: string; v: Impact[] }>();

/** 叠加包对 prior（世界观 + 排在它前面的叠加包）做了什么 */
export function addonImpact(addon: Mod, prior: Mod[]): Impact[] {
  const sig = prior.map((m) => m.id).join(">") + "|" + (addon.slotMerge ?? "");
  const hit = impactCache.get(addon.content);
  if (hit && hit.sig === sig) return hit.v;
  const v = computeImpact(addon, prior);
  impactCache.set(addon.content, { sig, v });
  return v;
}
function computeImpact(addon: Mod, prior: Mod[]): Impact[] {
  const c = addon.content as Record<string, unknown>;
  const out: Impact[] = [];
  const merge = addon.slotMerge === "merge";
  const push = (key: string, op: Impact["op"], text: string) => out.push({ key, label: slotLabel(key), op, numeric: !!SLOT_INFO[key]?.numeric, text });
  const diffIds = (key: string, mine: unknown, before: unknown) => {
    const old = new Map(idList(before).map((x) => [x.id, x]));
    const over = idList(mine).filter((x) => x.id && old.has(x.id) && !same(x, old.get(x.id)));
    const add = idList(mine).filter((x) => !x.id || !old.has(x.id)).length;
    if (over.length) push(key, "merge", `${add ? `新增 ${add} · ` : ""}覆盖 ${over.length}（${over.slice(0, 3).map(nameOf).join("、")}${over.length > 3 ? "…" : ""}）`);
    else if (add) push(key, "add", `新增 ${add}`);
  };
  for (const k of SLOT_KEYS) {
    const v = c[k];
    if (v === undefined) continue;
    const before = priorValue(prior, k);
    if (before !== undefined && same(v, before)) continue;
    const isArr = Array.isArray(v);
    if (merge && before !== undefined && isArr && Array.isArray(before) && v.every((x) => x && typeof (x as { id?: unknown }).id === "string")) diffIds(k, v, before);
    else if (merge && before && v && typeof v === "object" && !isArr && typeof before === "object" && !Array.isArray(before)) {
      const b = before as Record<string, unknown>;
      const keys = Object.entries(v as Record<string, unknown>).filter(([kk, vv]) => !same(vv, b[kk]));
      if (keys.length) push(k, "merge", `改写 ${keys.length} 项设定`);
    } else if (before === undefined) push(k, "add", isArr ? `新增 ${v.length}` : "新增");
    else push(k, "replace", isArr ? `整组替换（原 ${Array.isArray(before) ? before.length : "?"} 项 → ${v.length} 项）` : typeof v === "object" ? "整组替换" : `替换为 ${typeof v === "number" ? num(v) : String(v)}`);
  }
  for (const k of LIST_KEYS) {
    const v = c[k];
    if (!Array.isArray(v) || !v.length) continue;
    diffIds(k, v, prior.flatMap((m) => idList((m.content as Record<string, unknown>)[k])));
  }
  const rooms = addon.content.rooms;
  if (rooms && Object.keys(rooms).length) {
    const old: Record<string, unknown> = Object.assign({}, ...prior.map((m) => m.content.rooms ?? {}));
    const add = Object.keys(rooms).filter((r) => !(r in old)).length;
    const over = Object.keys(rooms).filter((r) => r in old && !same(rooms[r], old[r])).length;
    if (add || over) push("rooms", over ? "merge" : "add", [add && `新增 ${add}`, over && `覆盖 ${over}`].filter(Boolean).join(" · "));
  }
  // 数值相关的排前面；替换 > 覆盖 > 新增
  const rank = { replace: 0, merge: 1, add: 2 };
  return out.sort((a, b) => Number(b.numeric) - Number(a.numeric) || rank[a.op] - rank[b.op]);
}

/** 链中每个叠加包被后面的包盖掉的改动：{ 包 id → 提示[] } */
export function chainShadows(chain: Mod[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const addons = chain.filter((m) => m.kind === "addon");
  addons.forEach((a, i) => {
    const notes: string[] = [];
    for (const k of [...SLOT_KEYS, ...LIST_KEYS] as string[]) {
      const mine = (a.content as Record<string, unknown>)[k];
      if (mine === undefined) continue;
      for (const b of addons.slice(i + 1)) {
        const theirs = (b.content as Record<string, unknown>)[k];
        if (theirs === undefined) continue;
        const listKey = (LIST_KEYS as readonly string[]).includes(k);
        if (!listKey && b.slotMerge !== "merge") { notes.push(`「${slotLabel(k)}」被后面的「${b.name}」整组替换，本包的改动不生效`); break; }
        const mineIds = idsOf(mine), clash = idList(theirs).filter((x) => x.id && mineIds.has(x.id));
        if (clash.length) notes.push(`「${slotLabel(k)}」有 ${clash.length} 项与「${b.name}」同 id（${clash.slice(0, 2).map(nameOf).join("、")}${clash.length > 2 ? "…" : ""}），以「${b.name}」为准`);
      }
    }
    if (notes.length) out[a.id] = notes;
  });
  return out;
}

/** 叠加包所叠加的对象：当前选中的世界观 + 排在它前面的已启用叠加包（未启用 = 假设排在最后） */
export function priorFor(mod: Mod): Mod[] {
  const sel = getSelection();
  const world = modById(sel.world);
  const base = world && world.kind === "world" ? world : entMod;
  if (mod.kind !== "addon") return [];
  const idx = sel.addons.indexOf(mod.id);
  const ids = idx >= 0 ? sel.addons.slice(0, idx) : sel.addons;
  return [base, ...ids.map(modById).filter((m): m is Mod => !!m && m.kind === "addon" && m.id !== mod.id)];
}
