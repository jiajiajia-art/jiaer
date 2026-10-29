import type { GameState as SimState } from "./logic";
import { careerWeekOf, dayDateLabel, dayParts } from "./logic";
import { STAT_LABELS, type StatKey } from "./data";
import { LIVE_LOCATIONS as LOCATIONS, getWorldSlot } from "../mods/registry";
import { liveArray } from "../mods/live";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID, worldItemById as itemById } from "../mods/registry";
import type { ChainBreak, CondGroup, EventChoice, FixedEvent, FixedCond, FixedEffect, FixedEventTime, CustomEnding, IncomeRule, GameRule, Storyline, QuestState } from "../lib/types";
import { getWorldStorylines } from "../mods/registry";
import { PERIODIC_TIME, TIME_UNIT_DAYS, type CmpOp } from "../lib/types";
import type { LibraryGroup } from "./eventLibrary";
import { attrCap } from "./wallet";
import { applyFactionDelta, repOf } from "./factions";
import { getWorldRooms } from "../mods/registry";
import { pathOf } from "./roomTree";
import { rollChance, seededRandom, seqRandom } from "./engineRules";
import { canAccess, cfgValue, clampModVar, getModRegistry, isModActive, modLog, modVarValue } from "../mods/ext";
import { COMM_MAX_DEPTH, bindArgs, checkAccess, filterPass, subscribersOf, trace, validateArgs, type CommResult } from "../mods/comm";
import type { ModArg } from "../mods/types";
import { resolveAudio, audioLabel } from "./audioLib";
import type { AudioCmd } from "../lib/types";

/* 当前正在结算 / 判定的内容归属（模板库 MOD 装入的资源带 _mod；原生 = undefined），用于跨 MOD 授权 */
let ctxOwner: string | undefined;
let modDepth = 0; // 命名条件 / 动作 / 跨 MOD 调用 / 事件投递共用的调用栈深度保护（上限 COMM_MAX_DEPTH）
const withOwner = <T,>(owner: string | undefined, fn: () => T): T => { const prev = ctxOwner; ctxOwner = owner; try { return fn(); } finally { ctxOwner = prev; } };

/* 固定事件引擎：纯函数，无 React。
 * 负责「代码判定是否满足条件」与「代码结算触发后果」，
 * 叙事一律交由上层把 prompt 送进 AI，本模块从不接触 AI。 */

/* 可供条件/后果引用的主角指标（仅这些键，与题材解耦） */
export const BASE_METRICS: { key: string; label: string }[] = [
  { key: "fame", label: "名气" },
  { key: "reputation", label: "口碑" },
  { key: "stress", label: "压力" },
  { key: "energy", label: "精力" },
  { key: "money", label: "现金" },
  { key: "works", label: "作品数" },
  { key: "blackFans", label: "黑粉" },
  { key: "week", label: "周数" },
];
/* 可作条件/效果的数值：内置指标 + 当前世界观的自定义角色属性（键前缀 c:） */
export const FIXED_METRICS: { key: string; label: string }[] = liveArray(() => [
  ...BASE_METRICS,
  ...(getWorldSlot("customAttrs") ?? []).map((d) => ({ key: `c:${d.id}`, label: d.label })),
]);
const METRIC_LABEL: Record<string, string> = new Proxy({}, { get: (_, k) => FIXED_METRICS.find((m) => m.key === k)?.label });
const attrMin = (id: string) => (getWorldSlot("customAttrs") ?? []).find((d) => d.id === id)?.min ?? 0;
const attrMax = (id: string) => { const d = (getWorldSlot("customAttrs") ?? []).find((x) => x.id === id); return d ? attrCap(d.max) : 999; };
/* 结局评定维度的默认满分：自定义属性取其上限，内置指标取常见高位 */
const METRIC_FULL: Record<string, number> = { fame: 750, reputation: 100, stress: 100, energy: 100, money: 2_000_000, works: 12, blackFans: 500, week: 156 };
export const metricDefaultFull = (key: string): number => key.startsWith("c:") ? attrMax(key.slice(2)) : (METRIC_FULL[key] ?? 100);
// 有下限（不小于 0）的指标；现金可为负、周数由引擎推进不在此列
const FLOORED_METRICS = new Set(["fame", "reputation", "stress", "energy", "works", "blackFans"]);

export const metricVal = (s: SimState, key: string): number => key.startsWith("c:") ? s.cattrs?.[key.slice(2)] ?? 0 : (s as unknown as Record<string, number>)[key] ?? 0;
const fmt = (d: number) => `${d > 0 ? "+" : ""}${d}`;
// 「HH:MM」→ 当日分钟；不合法返回 null
export const hhmmMin = (v: string): number | null => {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/* 当日时段判定：from ≤ 此刻 < to；from > to 视为跨午夜（如 22:00~06:00） */
function inClock(min: number, from: string, to: string): boolean {
  const a = hhmmMin(from), b = hhmmMin(to);
  if (a == null || b == null) return false;
  const m = ((min % 1440) + 1440) % 1440;
  return a <= b ? m >= a && m < b : m >= a || m < b;
}

/* ——— 触发判定 ——— */

/* 数值比较：缺省按 ≥（旧数据只有 gte / lte） */
export const cmpNum = (have: number, op: CmpOp | undefined, v: number): boolean =>
  op === "lte" ? have <= v : op === "eq" ? have === v : op === "gt" ? have > v : op === "lt" ? have < v : have >= v;

export function evalFixedCond(c: FixedCond, s: SimState): boolean {
  switch (c.kind) {
    case "stat": {
      const have = (s.stats as Record<string, number>)[c.key] ?? 0;
      return cmpNum(have, c.op, c.value);
    }
    case "metric": {
      const have = metricVal(s, c.key);
      return cmpNum(have, c.op, c.value);
    }
    case "rel": {
      const have = s.rel?.[c.key] ?? 0;
      return cmpNum(have, c.op, c.value);
    }
    case "location":
      return s.room === c.key;
    case "item":
      return (s.bag ?? []).includes(c.key);
    case "event":
      return (s.eventsFired ?? []).includes(c.key);
    case "time": {
      const have = (s.day ?? 0) / TIME_UNIT_DAYS[c.unit];
      return c.op === "lte" ? have <= c.value : have >= c.value;
    }
    case "date": {
      if (!/^\d{4}\.\d{2}\.\d{2}$/.test(c.date)) return false;
      const today = dayDateLabel(s.day ?? 0);
      return c.op === "lte" ? today <= c.date : today >= c.date;
    }
    case "flag": {
      const have = s.flags?.[c.key] ?? 0;
      return cmpNum(have, c.op, c.value);
    }
    case "clock":
      return inClock(s.clockMin ?? 0, c.from, c.to);
    case "quest":
      return questState(c.key, s) === c.state;
    case "faction":
      return cmpNum(repOf(s, c.key), c.op, c.value);
    case "visited": {
      const rooms = getWorldRooms();
      return (s.visited ?? []).some((r) => r === c.key || pathOf(rooms, r).includes(c.key));
    }
    case "relSet": {
      const keys = c.keys ?? [];
      if (!keys.length) return false;
      const hit = keys.filter((k) => cmpNum(s.rel?.[k] ?? 0, c.op, c.value)).length;
      return hit >= Math.min(keys.length, c.need && c.need > 0 ? c.need : keys.length);
    }
    case "memory":
      return (s.flags?.[`mem:${c.key}`] ?? 0) > 0;
    case "flagSet":
      return ((s.flags?.[c.key] ?? 0) !== 0) === (c.exists !== false);
    case "group": {
      // 括号子组：空组视为成立；not 对整组取反
      const ok = condsMet(c.conds, s, c.match);
      return c.not ? !ok : ok;
    }
    /* —— 功能 MOD：MOD 未启用 / 未授权一律判为不成立（不报错、不影响原生判定） —— */
    case "modVar": {
      if (!isModActive(c.mod)) return false;
      // 别的 MOD 读取：只能读对方导出的字段，且须导入申请 + 授权
      if (!canAccess(ctxOwner, c.mod, false)) {
        const r = checkAccess(s.modAuth, ctxOwner, c.mod, "field", c.key, "read");
        trace("read", ctxOwner, c.mod, c.key, r, "read");
        if (!r.ok) return false;
      }
      return cmpNum(modVarValue(s.modData, c.mod, c.key), c.op, c.value);
    }
    case "modCfg":
      if (!isModActive(c.mod) || !canAccess(ctxOwner, c.mod, false)) return false;
      return cmpNum(cfgValue(c.mod, c.key), c.op, c.value);
    case "modCond": {
      const reg = getModRegistry().conds.get(c.id);
      if (!reg || reg.mod !== c.mod || !canAccess(ctxOwner, reg.mod, false) || modDepth >= COMM_MAX_DEPTH) return false;
      modDepth++;
      try { return withOwner(reg.mod, () => condsMet(reg.def.conds, s, reg.def.match)); } finally { modDepth--; }
    }
    default:
      return false;
  }
}

/* 条件组合：all = 全部满足；any = 任一满足；无条件视为满足 */
export const condsMet = (conds: FixedCond[] | undefined, s: SimState, match: "all" | "any" = "all") =>
  !conds?.length || (match === "any" ? conds.some((c) => evalFixedCond(c, s)) : conds.every((c) => evalFixedCond(c, s)));

/* 「且 / 或」条件组；空组视为成立 */
export const groupMet = (g: CondGroup | undefined, s: SimState) => !g?.conds?.length || condsMet(g.conds, s, g.match);
/* 事件 / 分支的完整条件：基础条件（按 condMatch 组合）且 每个条件组都成立 */
export const fullCondsMet = (x: { conds?: FixedCond[]; condMatch?: "all" | "any"; condGroups?: CondGroup[] }, s: SimState) =>
  condsMet(x.conds, s, x.condMatch) && (x.condGroups ?? []).every((g) => groupMet(g, s));

/* ——— 事件链：状态写在 flags["chain:<id>"]：0 进行中 / 2 暂停 / -1 中断 / -2 永久失败（主线条件可用「规则变量」读取） ——— */
export const chainFlag = (id: string) => `chain:${id.trim()}`;
export const CHAIN_STATE_LABEL = { running: "进行中", paused: "暂停", interrupted: "中断", failed: "永久失败" } as const;
export type ChainRun = keyof typeof CHAIN_STATE_LABEL;
export function chainRun(s: Pick<SimState, "flags">, id?: string): ChainRun {
  if (!id?.trim()) return "running";
  const f = s.flags?.[chainFlag(id)] ?? 0;
  return f === -2 ? "failed" : f === -1 ? "interrupted" : f === 2 ? "paused" : "running";
}
/** 每次检查时结算事件链断点：永久失败 > 中断 > 暂停；暂停条件不再成立即自动恢复 */
export function applyChainBreaks(s: SimState, events: FixedEvent[]): { next: SimState; changes: string[] } {
  const byChain = new Map<string, ChainBreak[]>();
  for (const ev of events) if (ev.chain?.trim()) byChain.set(ev.chain.trim(), [...(byChain.get(ev.chain.trim()) ?? []), ...(ev.chainBreaks ?? [])]);
  let flags = s.flags;
  const changes: string[] = [];
  for (const [id, breaks] of byChain) {
    const cur = chainRun(s, id);
    if (cur === "failed" || !breaks.length) continue;
    const hit = (st: ChainBreak["state"]) => breaks.find((b) => b.state === st && b.group.conds.length && groupMet(b.group, s));
    const f = hit("failed"), i = cur === "interrupted" ? undefined : hit("interrupted"), p = hit("paused");
    let v: number | null = null;
    if (f) { v = -2; changes.push(`事件链「${id}」永久失败${f.note ? `：${f.note}` : ""}`); }
    else if (i) { v = -1; changes.push(`事件链「${id}」中断${i.note ? `：${i.note}` : ""}`); }
    else if (cur === "running" && p) v = 2;
    else if (cur === "paused" && !p) v = 0;
    if (v !== null) flags = { ...(flags ?? {}), [chainFlag(id)]: v };
  }
  return { next: flags === s.flags ? s : { ...s, flags }, changes };
}

/** 把 AI / 导入 JSON 里的触发时间洗成合法形状（数字转数字、缺项补默认、越界夹回）；无法识别 → undefined */
export function normFixedTime(raw: unknown): FixedEventTime | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  const int = (v: unknown, d: number, lo: number, hi = Infinity) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  switch (t.kind) {
    case "none": return { kind: "none" };
    case "day": return { kind: "day", day: int(t.day, 0, 0) };
    case "date": return typeof t.date === "string" && /^\d{4}[-./]\d{2}[-./]\d{2}$/.test(t.date.trim()) ? { kind: "date", date: t.date.trim().replace(/[-/]/g, ".") } : undefined;
    case "every": { const start = int(t.start, 0, 0); return { kind: "every", days: int(t.days, 7, 1), ...(start ? { start } : {}) }; }
    case "weekly": return { kind: "weekly", dow: int(t.dow, 0, 0, 6) };
    case "monthly": return { kind: "monthly", d: int(t.d, 1, 1, 31) };
    case "yearly": { const m = /^(\d{1,2})[-./](\d{1,2})$/.exec(String(t.md ?? "").trim()); return m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31 ? { kind: "yearly", md: `${m[1].padStart(2, "0")}.${m[2].padStart(2, "0")}` } : undefined; }
    default: return undefined;
  }
}

export const isPeriodic = (ev: FixedEvent) => !!ev.time && PERIODIC_TIME.has(ev.time.kind);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const pad2 = (n: number) => String(n).padStart(2, "0");

/* 周期事件此刻所在的周期键；null = 当前不在触发窗口。
 * 窗口从「到点那天」开到周期结束：条件晚几天才满足也能补上，但同一周期只演一次；开局前已过的到点不补。 */
export function fixedPeriodKey(ev: FixedEvent, s: SimState): string | null {
  const t = ev.time;
  const day = s.day ?? 0;
  if (!t) return null;
  switch (t.kind) {
    case "every": {
      const n = Math.max(1, Math.round(Number(t.days)) || 1), st = Math.max(0, Math.round(Number(t.start ?? 0)) || 0);
      return day >= st ? `e${Math.floor((day - st) / n)}` : null;
    }
    case "weekly": {
      const { dow } = dayParts(day);
      const back = dow - Math.max(0, Math.min(6, Math.round(Number(t.dow)) || 0));
      return back >= 0 && day - back >= 0 ? `w${careerWeekOf(day)}` : null;
    }
    case "monthly": {
      const { y, m, d } = dayParts(day);
      const target = Math.min(daysInMonth(y, m), Math.max(1, Math.round(Number(t.d)) || 1));
      return d >= target && day - (d - target) >= 0 ? `m${y}.${pad2(m)}` : null;
    }
    case "yearly": {
      const mm = /^(\d{1,2})[-./](\d{1,2})$/.exec(String(t.md ?? "").trim());
      if (!mm || +mm[1] < 1 || +mm[1] > 12 || +mm[2] < 1 || +mm[2] > 31) return null;
      const { y } = dayParts(day);
      const at = `${y}.${pad2(+mm[1])}.${pad2(+mm[2])}`;
      return dayDateLabel(day) >= at && at >= dayDateLabel(0) ? `y${y}` : null;
    }
    default: return null;
  }
}

export function fixedTimeReady(ev: FixedEvent, s: SimState): boolean {
  const t = ev.time;
  if (!t || t.kind === "none") return true;
  if (t.kind === "day") return (s.day ?? 0) >= t.day;
  if (t.kind === "date") return dayDateLabel(s.day ?? 0) >= String(t.date ?? "").trim().replace(/[-/]/g, "."); // 统一成 YYYY.MM.DD 定长补零再字典序比较（「2005-03-15」写法也能对上）
  if (isPeriodic(ev)) { const k = fixedPeriodKey(ev, s); return !!k && s.eventsAt?.[ev.id] !== k; }
  return true;
}

/* 冷却：上次上演日记在 flags["evday:<id>"] = day + 1（0 = 从未上演），旧存档无需迁移 */
const cdKey = (id: string) => `evday:${id}`;

/* 事件此刻是否可触发：需有提示词、未被一次性拦截、（若需激活）已激活、时间到、条件全满足 */
export function fixedEligible(ev: FixedEvent, s: SimState): boolean {
  if (!ev.prompt?.trim()) return false;
  if (ev.once && !isPeriodic(ev) && (s.eventsFired ?? []).includes(ev.id)) return false; // 周期事件按周期去重，忽略「只触发一次」
  if (ev.locked && !(s.eventsUnlocked ?? []).includes(ev.id)) return false;
  if (ev.cooldown && ev.cooldown > 0) { const last = s.flags?.[cdKey(ev.id)]; if (last && (s.day ?? 0) - (last - 1) < ev.cooldown) return false; }
  if (!fixedTimeReady(ev, s)) return false;
  if (chainRun(s, ev.chain) !== "running") return false; // 所属事件链暂停 / 中断 / 失败
  return fullCondsMet(ev, s);
}

/* 从事件表挑出「此刻可触发」的第一个（按创作者排序，一次只推进一桩，保证叙事连贯） */
// 关键词触发的事件不按顺序自动上演，由玩家 / 剧情提到关键词时激活（见 game/loreContext）
const byKeyword = (ev: FixedEvent) => !!ev.keywords?.some((k) => k.trim());
export function pickFixedEvent(events: FixedEvent[], s: SimState): FixedEvent | null {
  for (const ev of events) if (!ev.random && !byKeyword(ev) && (!ev.trigger || ev.trigger.kind === "auto") && fixedEligible(ev, s)) return ev;
  return null;
}

/* ——— 结算：把一组后果落到 sim（属性/关系/物品/解锁地点/规则变量），不登记触发 ——— */
export function applyEffectList(s: SimState, effects: FixedEffect[] | undefined): { next: SimState; changes: string[] } {
  const changes: string[] = [];
  const next: SimState = {
    ...s,
    stats: { ...s.stats },
    rel: { ...(s.rel ?? {}) },
    bag: [...(s.bag ?? [])],
    visited: [...(s.visited ?? [])],
    discoveredAt: { ...(s.discoveredAt ?? {}) },
    flags: { ...(s.flags ?? {}) },
  };

  for (const e of effects ?? []) {
    switch (e.kind) {
      case "stat": {
        const stats = next.stats as Record<string, number>;
        stats[e.key] = Math.max(0, (stats[e.key] ?? 0) + e.delta);
        changes.push(`${STAT_LABELS[e.key as StatKey] ?? e.key} ${fmt(e.delta)}`);
        break;
      }
      case "metric": {
        const cur = metricVal(next, e.key);
        const v = FLOORED_METRICS.has(e.key) ? Math.max(0, cur + e.delta) : cur + e.delta;
        if (e.key.startsWith("c:")) { const id = e.key.slice(2); next.cattrs = { ...(next.cattrs ?? {}), [id]: Math.max(attrMin(id), Math.min(attrMax(id), v)) }; }
        else (next as unknown as Record<string, number>)[e.key] = v;
        changes.push(`${METRIC_LABEL[e.key] ?? e.key} ${fmt(e.delta)}`);
        break;
      }
      case "rel": {
        next.rel[e.key] = (next.rel[e.key] ?? 0) + e.delta;
        changes.push(`与${PERSON_BY_ID[e.key]?.name ?? e.key}关系 ${fmt(e.delta)}`);
        break;
      }
      case "addItem": {
        if (!next.bag.includes(e.key)) next.bag.push(e.key);
        changes.push(`获得「${itemById(e.key)?.name ?? e.key}」`);
        break;
      }
      case "removeItem": {
        next.bag = next.bag.filter((id) => id !== e.key);
        changes.push(`失去「${itemById(e.key)?.name ?? e.key}」`);
        break;
      }
      case "unlockLocation": {
        if (!next.visited.includes(e.key)) next.visited.push(e.key);
        if (next.discoveredAt[e.key] == null) next.discoveredAt[e.key] = next.day;
        changes.push(`解锁 ${LOCATIONS.find((l) => l.id === e.key)?.name ?? e.key}`);
        break;
      }
      case "flag": {
        // 规则变量是幕后计数，不向玩家播报
        if (!e.key) break;
        next.flags![e.key] = e.set ? e.delta : (next.flags![e.key] ?? 0) + e.delta;
        break;
      }
      case "faction":
        applyFactionDelta(next, e.key, e.delta, changes);
        break;
      case "memory":
        // 记忆标记同为幕后状态，不播报
        if (e.key) next.flags![`mem:${e.key}`] = e.clear ? 0 : 1;
        break;
      case "modVar": {
        // 写进该 MOD 自己的数据表，不碰全局 flags；别的 MOD 只能写对方导出为「可读写」的字段
        if (!e.key || !isModActive(e.mod)) break;
        if (!canAccess(ctxOwner, e.mod, true)) {
          const r = checkAccess(next.modAuth, ctxOwner, e.mod, "field", e.key, "write");
          trace("write", ctxOwner, e.mod, e.key, r, "write", { delta: e.delta, set: !!e.set });
          if (!r.ok) break;
        }
        const tbl = { ...(next.modData?.[e.mod] ?? {}) };
        const cur = modVarValue(next.modData, e.mod, e.key);
        tbl[e.key] = clampModVar(e.mod, e.key, e.set ? e.delta : cur + e.delta);
        next.modData = { ...(next.modData ?? {}), [e.mod]: tbl };
        break;
      }
      case "modAction": {
        // 内部动作：只有 MOD 自己（或工程触发器）能直接执行；别的 MOD 须调用对方导出的动作（modCall）
        const reg = getModRegistry().actions.get(e.id);
        if (!reg || reg.mod !== e.mod) { modLog(e.mod, "warn", `动作「${e.id}」未注册（MOD 未启用或已卸载），已跳过`); break; }
        if (!canAccess(ctxOwner, reg.mod, false)) { modLog(ctxOwner, "warn", `ERR_NO_PERMISSION：「${reg.mod}」的内部动作「${e.id}」不对外开放，请调用其导出动作`); break; }
        runModAction(next, changes, reg.mod, e.id, {});
        break;
      }
      case "modCall": {
        const res = callExported(next, changes, ctxOwner, e.mod, e.id, e.args);
        // 回调：调用方自己的内部动作，带 $code / $ok 参数
        const cb = res.ok ? e.then : e.onError;
        if (cb && ctxOwner) runModAction(next, changes, ctxOwner, cb, { ok: res.ok, code: res.ok ? "OK" : res.code });
        break;
      }
      case "modEmit":
        emitModEvent(next, changes, ctxOwner, e.event, e.args);
        break;
      case "audio": {
        // 只排指令，不在这里出声：结算可能是推演 / 预览；真正播放由正式游玩时的播放器按序号执行一次
        if (e.op !== "stopAll" && !(e.op === "volume" && !e.id)) {
          const a = resolveAudio(e.id);
          if (!a) { modLog(ctxOwner, "warn", `ERR_NOT_EXIST：音频「${e.id || "（空）"}」不在音频库（或其 MOD 未启用）`); break; }
          // 跨 MOD：别的 MOD 注入的音频须在对方 exports.audio 中导出，并经导入授权
          if (ctxOwner && a._mod && a._mod !== ctxOwner) {
            const r = checkAccess(next.modAuth, ctxOwner, a._mod, "audio", a.id, "read");
            trace("read", ctxOwner, a._mod, a.id, r, "read");
            if (!r.ok) break;
          }
        }
        pushAudio(next, { op: e.op, id: e.id, volume: e.volume, fade: e.fade, from: ctxOwner });
        changes.push(`${({ play: "播放", stop: "停止", stopAll: "停止全部音频", switchBgm: "切换 BGM 到", volume: "调整音量" } as const)[e.op]}${e.id ? `「${audioLabel(e.id)}」` : ""}`);
        break;
      }
    }
  }
  return { next, changes };
}

/* ——— MOD 执行：内部动作 / 跨 MOD 调用 / 事件广播（共用深度保护，失败返回错误码、不抛异常） ——— */
function runModAction(next: SimState, changes: string[], owner: string, actionId: string, args: Record<string, ModArg>): CommResult<null> {
  const reg = getModRegistry().actions.get(actionId);
  if (!reg || reg.mod !== owner) return { ok: false, code: "ERR_NOT_EXIST", msg: `「${owner}」没有动作「${actionId}」` };
  if (modDepth >= COMM_MAX_DEPTH) { modLog(owner, "error", `ERR_DEPTH：动作「${actionId}」超过 ${COMM_MAX_DEPTH} 层调用，已拦截（疑似循环调用）`); return { ok: false, code: "ERR_DEPTH", msg: "调用层数超限" }; }
  modDepth++;
  try {
    withOwner(owner, () => {
      const branches = Object.keys(args).length ? bindArgs(reg.def.branches, args) : reg.def.branches;
      const br = branches.find((b) => condsMet(b.conds, next, b.match)); // 如果…否则如果…否则：命中第一个分支
      if (!br) return;
      const r = applyEffectList(next, br.effects);
      Object.assign(next, r.next);
      changes.push(...r.changes);
      modLog(owner, "info", `执行动作「${reg.def.label || actionId}」`);
    });
  } finally { modDepth--; }
  return { ok: true, value: null };
}
function callExported(next: SimState, changes: string[], from: string | undefined, to: string, id: string, rawArgs: Record<string, unknown> | undefined): CommResult<null> {
  const acc = checkAccess(next.modAuth, from, to, "action", id, "call");
  if (!acc.ok) { trace("call", from, to, id, acc, "call", rawArgs); return acc; }
  const exp = acc.value as import("../mods/types").ModExportAction;
  const args = validateArgs(exp.params, rawArgs);
  if (!args.ok) { trace("call", from, to, id, args, "call", rawArgs); return args; }
  const r = runModAction(next, changes, to, exp.action, args.value);
  trace("call", from, to, id, r, "call", args.value);
  return r;
}
function emitModEvent(next: SimState, changes: string[], from: string | undefined, event: string, rawArgs: Record<string, unknown> | undefined) {
  // 只有 MOD 自己的内部动作能广播它导出的事件
  if (!from) { modLog(undefined, "warn", `ERR_NO_PERMISSION：工程触发器不能代替 MOD 广播事件「${event}」`); return; }
  const acc = checkAccess(next.modAuth, undefined, from, "event", event, "subscribe");
  if (!acc.ok) { trace("emit", from, from, event, acc, undefined, rawArgs); return; }
  const args = validateArgs((acc.value as import("../mods/types").ModExportEvent).params, rawArgs);
  if (!args.ok) { trace("emit", from, from, event, args, undefined, rawArgs); return; }
  trace("emit", from, from, event, { ok: true, value: null }, undefined, args.value);
  // 事件体只含轻量信息：事件名 / 时间 / 基础参数
  const body: Record<string, ModArg> = { ...args.value, event, from, day: next.day ?? 0 };
  for (const sub of subscribersOf(next.modAuth, next.modSubPrio, from, event)) {
    if (!sub.access.ok) { trace("deliver", sub.mod, from, event, sub.access, "subscribe"); continue; }
    if (!filterPass(sub.def.filter, args.value)) continue;
    const r = runModAction(next, changes, sub.mod, sub.def.action, body);
    trace("deliver", sub.mod, from, event, r, "subscribe", args.value);
  }
  // 交给原生触发器（触发源 = MOD 事件），由 scanTriggers 照常排队、校验
  next.modEvents = [...(next.modEvents ?? []), { mod: from, event, args: args.value }].slice(-20);
}

/* ——— 事件结算：落后果，并登记已触发 / 激活后续 ——— */
export function pushAudio(s: SimState, c: Omit<AudioCmd, "n">) {
  const n = (s.audioSeq ?? 0) + 1;
  s.audioSeq = n;
  s.audioQ = [...(s.audioQ ?? []), { ...c, n }].slice(-20);
}
export function applyFixedEffects(s: SimState, ev: FixedEvent): { next: SimState; changes: string[] } {
  const { next, changes } = withOwner(ev._mod, () => applyEffectList(s, ev.effects));
  // 剧情节点 BGM：上演时平滑切换（音频不存在 = 跳过，不打断当前音乐）
  if (ev.bgm && resolveAudio(ev.bgm)) pushAudio(next, { op: "switchBgm", id: ev.bgm, from: ev._mod });
  modLog(ev._mod, "info", `上演「${ev.name || ev.id}」${changes.length ? `：${changes.join("，")}` : ""}`);

  // 登记已触发（避免一次性事件重复触发，也供后续事件以「已触发事件」为条件）
  if (!(next.eventsFired ?? []).includes(ev.id)) next.eventsFired = [...(next.eventsFired ?? []), ev.id];
  // 周期事件：记下本周期已上演
  const pk = isPeriodic(ev) ? fixedPeriodKey(ev, s) : null;
  if (pk) next.eventsAt = { ...(next.eventsAt ?? {}), [ev.id]: pk };
  // 激活后续事件（供其 locked 门槛解锁）
  if (ev.nextIds?.length) next.eventsUnlocked = Array.from(new Set([...(next.eventsUnlocked ?? []), ...ev.nextIds]));
  if (next.evQueue?.includes(ev.id)) next.evQueue = next.evQueue.filter((x) => x !== ev.id);
  if (ev.cooldown) next.flags = { ...(next.flags ?? {}), [cdKey(ev.id)]: (s.day ?? 0) + 1 };

  return { next, changes };
}

/* ——— 事件选项：选项值带标记，玩家点击后由代码识别并结算 ——— */
const CHOICE_RE = /^⟦选项:([^:⟧]+):([^⟧]+)⟧/;
export const choiceValue = (ev: FixedEvent, c: EventChoice) => `⟦选项:${ev.id}:${c.id}⟧${c.label}`;
/** 此刻可见的选项（按出现条件过滤）→ 玩家选项按钮 */
export const eventChoiceOptions = (ev: FixedEvent, s: SimState) =>
  (ev.choices ?? []).filter((c) => !c.hidden && typeof c.label === "string" && c.label.trim() && fullCondsMet(c, s)).slice(0, 3).map((c) => ({ label: c.label, value: choiceValue(ev, c) }));
/** 解析玩家输入里的选项标记；找不到对应事件 / 选项返回 null */
export function parseChoice(input: string, events: FixedEvent[]): { ev: FixedEvent; choice: EventChoice } | null {
  const m = CHOICE_RE.exec(input);
  if (!m) return null;
  const ev = events.find((e) => e.id === m[1]);
  const choice = ev?.choices?.find((c) => c.id === m[2]);
  return ev && choice ? { ev, choice } : null;
}
/** 结算选项：先过成功判定（check），不满足走失败分支；记录 flags["choice:<事件>:<选项>"] = 1 成功 / -1 失败，可作条件引用 */
export function applyChoice(s: SimState, ev: FixedEvent, c: EventChoice): { next: SimState; changes: string[]; failed: boolean; prompt: string } {
  const failed = !!c.check?.conds.length && !groupMet(c.check, s);
  const { next, changes } = applyEffectList(s, failed ? c.failEffects : c.effects);
  next.flags = { ...(next.flags ?? {}), [`choice:${ev.id}:${c.id}`]: failed ? -1 : 1 };
  const ids = failed ? c.failNextIds : c.nextIds;
  if (ids?.length) next.eventsUnlocked = Array.from(new Set([...(next.eventsUnlocked ?? []), ...ids]));
  return { next, changes, failed, prompt: (failed ? c.failPrompt : c.prompt)?.trim() ?? "" };
}
/** 隐藏分支：事件上演时条件已满足的，自动按选中结算（不出按钮）；返回给 AI 的续写指引 */
export function applyHiddenBranches(s: SimState, ev: FixedEvent): { next: SimState; changes: string[]; prompts: string[] } {
  let next = s;
  const changes: string[] = [], prompts: string[] = [];
  for (const c of ev.choices ?? []) {
    if (!c.hidden || !fullCondsMet(c, next)) continue;
    const r = applyChoice(next, ev, c);
    next = r.next; changes.push(...r.changes);
    prompts.push(r.prompt || c.label);
  }
  return { next, changes, prompts };
}

/* 结局条件组合：all = 全部满足；any = 任一满足（无条件视为满足） */
export const endingCondsMet = (e: CustomEnding, s: SimState) =>
  (!e.conds.length || (e.match === "any" ? e.conds.some((c) => evalFixedCond(c, s)) : e.conds.every((c) => evalFixedCond(c, s))))
  && (e.condGroups ?? []).every((g) => groupMet(g, s));

/** 条件此刻的实际数值（供编辑器展示「当前 xx」），非数值型返回 null */
export function condCurrent(c: FixedCond, s: SimState): string | null {
  switch (c.kind) {
    case "stat": return String((s.stats as Record<string, number>)[c.key] ?? 0);
    case "metric": return String(metricVal(s, c.key));
    case "rel": return String(s.rel?.[c.key] ?? 0);
    case "time": return `${Math.floor(((s.day ?? 0) / TIME_UNIT_DAYS[c.unit]) * 10) / 10}`;
    case "date": return dayDateLabel(s.day ?? 0);
    case "flag": return String(s.flags?.[c.key] ?? 0);
    case "clock": { const m = s.clockMin ?? 0; return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
    case "quest": return QUEST_STATE_LABEL[questState(c.key, s)];
    case "faction": return String(repOf(s, c.key));
    case "relSet": return `${(c.keys ?? []).filter((k) => cmpNum(s.rel?.[k] ?? 0, c.op, c.value)).length}/${(c.keys ?? []).length} 人`;
    default: return null;
  }
}

/* 自定义结局匹配：按列表顺序，首个启用且条件全满足者命中；autoOnly 仅看「达成即落幕」。 */
export function matchCustomEnding(list: CustomEnding[] | undefined, s: SimState, autoOnly = false): CustomEnding | null {
  for (const e of list ?? []) {
    if (e.enabled === false || (autoOnly && !e.auto)) continue;
    if (autoOnly && !e.conds.length && !e.condGroups?.length && !e.minDay) continue; // 无条件的自动结局会开局即终，跳过
    if (e.minDay && (s.day ?? 0) < e.minDay) continue;
    if (endingCondsMet(e, s)) return e;
  }
  return null;
}

/* 周期收入：逐条判定条件，命中则在 [min, max] 内取整发放；返回结算后状态与说明 */
export function applyIncome(s: SimState, rules: IncomeRule[] | undefined): { next: SimState; changes: string[] } {
  let next = s;
  const changes: string[] = [];
  for (const r of rules ?? []) {
    if (r.enabled === false || !(r.conds ?? []).every((c) => evalFixedCond(c, next))) continue;
    const lo = Math.min(r.min, r.max), hi = Math.max(r.min, r.max);
    const delta = Math.round(lo + seededRandom(`income:${r.id}:${next.day ?? 0}`, next.room) * (hi - lo));
    if (!delta) continue;
    const res = applyEffectList(next, [{ kind: r.target.kind, key: r.target.key, delta }]);
    next = res.next;
    changes.push(`${r.label || "周期收入"}：${res.changes.join("、")}`);
  }
  return { next, changes };
}

/* 玩法规则：按时机（每天结束 / 每周结算）逐条判定；分支依次比对，命中第一个即执行。
 * 一次性 / 冷却 / 概率在命中分支前判定；触发记录写在 rulesFired（规则 id → 触发当天）。 */
export function applyGameRules(s: SimState, when: GameRule["when"], rules: GameRule[] | undefined): { next: SimState; changes: string[] } {
  let next = s;
  const changes: string[] = [];
  for (const r of rules ?? []) {
    if (r.enabled === false || (r.when ?? "week") !== when || !r.branches?.length) continue;
    const last = next.rulesFired?.[r.id];
    if (last != null && (r.once || (r.cooldown && (next.day ?? 0) - last < r.cooldown))) continue;
    if (r.chance != null && r.chance < 100 && !rollChance(r.chance, `rule:${r.id}:${next.day ?? 0}`, next.room)) continue;
    const b = r.branches.find((x) => condsMet(x.conds, next, x.match));
    if (!b) continue;
    const res = applyEffectList(next, b.effects);
    next = { ...res.next, rulesFired: { ...(res.next.rulesFired ?? {}), [r.id]: next.day ?? 0 } };
    const text = [b.notice?.trim(), res.changes.join("、")].filter(Boolean).join("：");
    if (text) changes.push(text);
  }
  return { next, changes };
}

/* 随机事件池：开启「随机触发」的分组（缺省 = NPC 之间），按概率从此刻可触发的事件里随机抽一桩 */
export const RANDOM_CHANCE = 0.22;
export const randomGroupIds = (groups: LibraryGroup[], chosen?: string[]) => chosen ?? groups.filter((g) => g.kind === "npc").map((g) => g.id);
export function pickRandomEvent(groups: LibraryGroup[], chosen: string[] | undefined, own: FixedEvent[], s: SimState): FixedEvent | null {
  const rnd = seqRandom(`randev:${s.day ?? 0}:${s.tick ?? 0}`, s.room);
  if (rnd() >= RANDOM_CHANCE) return null;
  const on = new Set(randomGroupIds(groups, chosen));
  const skip = new Set(own.map((e) => e.id)); // 已导入的以存档里的版本为准
  const pool = [
    ...own.filter((e) => e.random && !byKeyword(e)),
    ...groups.filter((g) => on.has(g.id)).flatMap((g) => g.events).filter((e) => !skip.has(e.id)),
  ].filter((e) => fixedEligible(e, s));
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

/* ═══ 主线与目标 ═══
 * 进度写在 flags["quest:<id>"]：1 = 完成，-1 = 失败；主线本身在必做节点全部完成时记为完成。
 * 必做节点按顺序激活（前面的必做节点都完成才轮到它）；可选目标随所在位置激活，不阻塞后续。 */
export const QUEST_STATE_LABEL: Record<QuestState, string> = { done: "已完成", failed: "已失败", active: "进行中", pending: "未开始" };
type QuestSrc = Pick<SimState, "flags">;
const qFlag = (s: QuestSrc, id: string) => s.flags?.[`quest:${id}`] ?? 0;

function nodeState(line: Storyline, idx: number, s: QuestSrc): QuestState {
  const f = qFlag(s, line.nodes[idx].id);
  if (f > 0) return "done";
  if (f < 0) return "failed";
  if (qFlag(s, line.id) !== 0) return "pending"; // 主线已结束，剩余节点不再推进
  return line.nodes.slice(0, idx).every((n) => n.optional || qFlag(s, n.id) > 0) ? "active" : "pending";
}

export function questState(key: string, s: QuestSrc, lines: Storyline[] | undefined = getWorldStorylines()): QuestState {
  for (const line of lines ?? []) {
    if (line.id === key) {
      const f = qFlag(s, line.id);
      return f > 0 ? "done" : f < 0 ? "failed" : line.enabled === false ? "pending" : "active";
    }
    const i = line.nodes.findIndex((n) => n.id === key);
    if (i >= 0) return line.enabled === false ? "pending" : nodeState(line, i, s);
  }
  const f = qFlag(s, key);
  return f > 0 ? "done" : f < 0 ? "failed" : "pending";
}

/** 每天结束结算主线：判定激活节点的失败 / 完成，发奖励、激活事件；一天内可连续推进多个节点 */
export function applyStorylines(s: SimState, lines: Storyline[] | undefined): { next: SimState; changes: string[] } {
  let next = s;
  const changes: string[] = [];
  const mark = (id: string, v: number) => { next = { ...next, flags: { ...(next.flags ?? {}), [`quest:${id}`]: v } }; };
  const unlock = (ids?: string[]) => { if (ids?.length) next = { ...next, eventsUnlocked: Array.from(new Set([...(next.eventsUnlocked ?? []), ...ids])) }; };
  for (const line of lines ?? []) {
    if (line.enabled === false || !line.nodes?.length || qFlag(next, line.id) !== 0) continue;
    for (let guard = 0; guard <= line.nodes.length; guard++) {
      let moved = false;
      for (let i = 0; i < line.nodes.length; i++) {
        const n = line.nodes[i];
        if (nodeState(line, i, next) !== "active") continue;
        if (n.failConds?.length && n.failConds.some((c) => evalFixedCond(c, next))) {
          mark(n.id, -1); unlock(n.failUnlockIds); moved = true;
          changes.push(`${n.optional ? "目标" : "主线"}「${n.name}」失败`);
          if (!n.optional) { mark(line.id, -1); changes.push(`主线「${line.name}」中断`); }
          continue;
        }
        if (!n.conds?.length || !condsMet(n.conds, next, n.match)) continue;
        mark(n.id, 1); unlock(n.unlockIds); moved = true;
        const res = applyEffectList(next, n.rewards);
        next = res.next;
        changes.push(`${n.optional ? "目标" : "主线"}「${n.name}」达成${res.changes.length ? "：" + res.changes.join("、") : ""}`);
      }
      if (qFlag(next, line.id) === 0 && line.nodes.every((n) => n.optional || qFlag(next, n.id) > 0)) { mark(line.id, 1); changes.push(`主线「${line.name}」完成`); }
      if (!moved || qFlag(next, line.id) !== 0) break;
    }
  }
  return { next, changes };
}

/** 给 AI / 界面的主线进度摘要：每条主线的当前节点与可选目标 */
export function storylineBrief(s: QuestSrc, lines: Storyline[] | undefined = getWorldStorylines()): string {
  return (lines ?? []).filter((l) => l.enabled !== false && l.nodes?.length).map((l) => {
    const st = questState(l.id, s, lines);
    if (st !== "active") return `【${l.name}】${QUEST_STATE_LABEL[st]}`;
    const act = l.nodes.filter((_, i) => nodeState(l, i, s) === "active");
    const done = l.nodes.filter((n) => qFlag(s, n.id) > 0).length;
    return `【${l.name}】${done}/${l.nodes.length} · 当前：${act.map((n) => `${n.optional ? "（可选）" : ""}${n.name}${n.desc ? `——${n.desc}` : ""}`).join("；") || "无"}`;
  }).join("\n");
}
