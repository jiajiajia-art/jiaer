/* 主线复盘时间线：比较每次落盘前后的状态，自动记下关键变动（时间 / 地点 / 好感 / 属性 / 事件 / 目标 / 阵营）。
 * 同一回合内的多次变动合并为一条；每回合第一条附带检查点，可回到此刻或从这里开平行分支。 */
import type { GameState, TimelineEntry, TimelineKind } from "../lib/types";
import { STAT_LABELS, type StatKey } from "./data";
import { metricVal, FIXED_METRICS } from "./fixedEvents";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID, getWorldEvents, getWorldStorylines } from "../mods/registry";
import { liveFactions } from "./factions";

export const TIMELINE_MAX = 300;
export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = { time: "时间", place: "地点", rel: "好感", stat: "属性", event: "事件", quest: "目标", faction: "阵营" };
// 每回合都会动、记下来只是噪音的指标
const SKIP_METRICS = new Set(["energy", "week"]);
const sgn = (d: number) => `${d > 0 ? "+" : ""}${Math.round(d * 10) / 10}`;

function diff(a: GameState, b: GameState): TimelineEntry["items"] {
  const out: TimelineEntry["items"] = [];
  const push = (kind: TimelineKind, text: string) => out.push({ kind, text });
  if (a.world.time !== b.world.time && b.world.time) push("time", b.world.time);
  if (a.world.location !== b.world.location && b.world.location) push("place", `来到 ${b.world.location}`);
  const sa = a.sim, sb = b.sim;
  if (!sa || !sb) return out;
  const npcName = (id: string) => b.npcs.find((n) => n.id === id)?.name ?? PERSON_BY_ID[id]?.name ?? id;
  for (const k of new Set([...Object.keys(sa.rel ?? {}), ...Object.keys(sb.rel ?? {})])) {
    const d = (sb.rel?.[k] ?? 0) - (sa.rel?.[k] ?? 0);
    if (d) push("rel", `与${npcName(k)} ${sgn(d)}`);
  }
  for (const k of Object.keys(sb.stats ?? {})) {
    const d = ((sb.stats as Record<string, number>)[k] ?? 0) - ((sa.stats as Record<string, number>)[k] ?? 0);
    if (d) push("stat", `${STAT_LABELS[k as StatKey] ?? k} ${sgn(d)}`);
  }
  for (const m of FIXED_METRICS) {
    if (SKIP_METRICS.has(m.key)) continue;
    const d = metricVal(sb, m.key) - metricVal(sa, m.key);
    if (d) push("stat", `${m.label} ${sgn(d)}`);
  }
  const was = new Set(sa.eventsFired ?? []);
  const evName = (id: string) => (b.fixedEvents ?? []).find((e) => e.id === id)?.name ?? getWorldEvents().find((e) => e.id === id)?.name ?? id;
  for (const id of sb.eventsFired ?? []) if (!was.has(id)) push("event", `触发「${evName(id)}」`);
  const fa = sa.flags ?? {}, fb = sb.flags ?? {};
  const questName = (id: string) => {
    for (const l of getWorldStorylines() ?? []) {
      if (l.id === id) return `主线「${l.name}」`;
      const n = (Array.isArray(l.nodes) ? l.nodes : []).find((x) => x.id === id);
      if (n) return `「${n.name}」`;
    }
    return `「${id}」`;
  };
  for (const k of Object.keys(fb)) {
    if (fa[k] === fb[k]) continue;
    if (k.startsWith("quest:")) push("quest", `${questName(k.slice(6))}${fb[k] === 1 ? "达成" : fb[k] === -1 ? "失败" : "重置"}`);
    else if (k.startsWith("faction:")) { const f = liveFactions().find((x) => x.id === k.slice(8)); push("faction", `${f?.name ?? k.slice(8)}声望 ${sgn((fb[k] ?? 0) - (fa[k] ?? 0))}`); }
    else if (k.startsWith("chain:")) push("event", `事件链「${k.slice(6)}」${{ 0: "恢复", 2: "暂停", [-1]: "中断", [-2]: "永久失败" }[fb[k]] ?? "变更"}`);
    else if (k.startsWith("mem:") && fb[k] > 0) push("event", `记下「${k.slice(4)}」`);
  }
  return out;
}

/** 合并同类：同一条里时间 / 地点只留最新，数值类同名累计 */
function merge(prev: TimelineEntry["items"], add: TimelineEntry["items"]): TimelineEntry["items"] {
  const list = [...prev];
  for (const it of add) {
    if (it.kind === "time" || it.kind === "place") {
      const i = list.findIndex((x) => x.kind === it.kind);
      if (i >= 0) { list[i] = it; continue; }
    } else {
      const m = /^(.*) ([+-][\d.]+)$/.exec(it.text);
      const i = m ? list.findIndex((x) => x.kind === it.kind && x.text.startsWith(`${m[1]} `) && /[+-][\d.]+$/.test(x.text)) : -1;
      if (m && i >= 0) {
        const n = Number(/([+-][\d.]+)$/.exec(list[i].text)![1]) + Number(m[2]);
        if (n) list[i] = { ...it, text: `${m[1]} ${sgn(n)}` }; else list.splice(i, 1);
        continue;
      }
    }
    list.push(it);
  }
  return list;
}

const uid = () => `tl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** 记录一次状态变动；返回新状态与需要写入的检查点 id（无变动原样返回）。 */
export function recordTimeline(prev: GameState | null, next: GameState): { state: GameState; cp?: string } {
  if (!prev || prev.id !== next.id || !next.sim || next.ended) return { state: next };
  const items = diff(prev, next);
  if (!items.length) return { state: next };
  // 时间线只由这里维护：以内存中的最新版本为准（调用方可能拿着旧对象再次落盘）
  const list = prev.timeline ?? next.timeline ?? [];
  const last = list[list.length - 1];
  if (last && last.turn === next.turnCount) {
    const merged = merge(last.items, items);
    const tl = [...list.slice(0, -1), { ...last, items: merged, time: next.world.time || last.time, location: next.world.location || last.location }];
    return { state: { ...next, timeline: tl } };
  }
  const cp = uid();
  const entry: TimelineEntry = { id: uid(), turn: next.turnCount, time: next.world.time, location: next.world.location, items, cp };
  return { state: { ...next, timeline: [...list, entry].slice(-TIMELINE_MAX) }, cp };
}
