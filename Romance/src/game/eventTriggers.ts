/* 事件触发类型：地点进入 / 行动完成 / 对话分支 / 好感变化 / 道具获得 / 轮次。
 * 每次固定事件检查时，比对「上次快照」与当前状态，命中且此刻可触发的事件进入待演队列（一次上演一桩）。
 * 旧存档第一次检查只建快照、不补触发。 */
import type { EventSnap } from "./logic";
import type { FixedEvent, GameState, WorldBookEntry } from "../lib/types";
import { fixedEligible } from "./fixedEvents";
import { getWorldRooms } from "../mods/registry";
import { pathOf } from "./roomTree";
import { filterPass } from "../mods/comm";
import { isModActive } from "../mods/ext";
import { takeAudioSignals } from "./audioEngine";

type Sim = GameState["sim"];
const snapOf = (g: GameState): EventSnap => ({ room: g.sim.room, bag: [...(g.sim.bag ?? [])], rel: { ...(g.sim.rel ?? {}) }, turn: g.turnCount ?? 0, story: g.story.length });
const sameSnap = (a: EventSnap, b: EventSnap) => a.room === b.room && a.turn === b.turn && a.story === b.story && a.bag.join() === b.bag.join() && JSON.stringify(a.rel) === JSON.stringify(b.rel);
const queue = (s: Sim, ids: string[]): Sim => (ids.length ? { ...s, evQueue: Array.from(new Set([...(s.evQueue ?? []), ...ids])) } : s);

export function scanTriggers(g: GameState, events: FixedEvent[]): Sim {
  const s = g.sim, cur = snapOf(g), prev = s.evSnap;
  // MOD 广播的事件：本轮消费一次即清空（只认仍在启用中的 MOD）
  const modEvs = (s.modEvents ?? []).filter((x) => isModActive(x.mod));
  const clear = (x: Sim): Sim => (x.modEvents ? { ...x, modEvents: undefined } : x);
  // 播放器发出的音频信号（播放结束 / 淡入完成 / 淡出完成）：每次检查取走一次
  const audioSigs = takeAudioSignals();
  if (!prev) return clear({ ...s, evSnap: cur });
  if (sameSnap(prev, cur) && !modEvs.length && !audioSigs.length) return clear(s);
  const entered = cur.room !== prev.room ? pathOf(getWorldRooms(), cur.room) : [];
  const gotItems = cur.bag.filter((x) => !prev.bag.includes(x));
  const acts = g.story.slice(prev.story).filter((t) => t.role === "player" && !t.error).map((t) => t.segments.map((x) => x.text).join(""));
  const rounds = Array.from({ length: Math.max(0, Math.min(50, cur.turn - prev.turn)) }, (_, i) => prev.turn + i + 1);
  const hits = events.filter((ev) => {
    const t = ev.trigger;
    if (!t) return false;
    let hit = false;
    switch (t.kind) {
      case "enter": hit = !!t.room && (entered.includes(t.room) || (cur.room === t.room && cur.room !== prev.room)); break;
      case "action": hit = !!t.text.trim() && acts.some((a) => a.includes(t.text.trim())); break;
      case "item": hit = gotItems.includes(t.item); break;
      case "rel": { const d = (cur.rel[t.npc] ?? 0) - (prev.rel[t.npc] ?? 0); hit = t.delta > 0 ? d >= t.delta : t.delta < 0 ? d <= t.delta : false; break; }
      case "round": hit = rounds.some((n) => (t.at && n === t.at) || (!!t.every && t.every > 0 && n % t.every === 0)); break;
      case "modEvent": hit = modEvs.some((x) => x.mod === t.mod && x.event === t.event && filterPass(t.filter, x.args)); break;
      case "audio": hit = audioSigs.some((x) => x.on === t.on && (!t.id || x.id === t.id)); break;
      default: hit = false;
    }
    return hit && !(s.evQueue ?? []).includes(ev.id) && fixedEligible(ev, s);
  });
  return queue(clear({ ...s, evSnap: cur }), hits.map((e) => e.id));
}

/** 对话分支触发：玩家选了 某事件 · 某选项 */
export function queueChoiceTriggers(s: Sim, events: FixedEvent[], evId: string, choiceId: string): Sim {
  return queue(s, events.filter((e) => e.trigger?.kind === "choice" && e.trigger.event === evId && e.trigger.choice === choiceId && fixedEligible(e, s)).map((e) => e.id));
}

/** 取出队首「此刻仍可触发」的事件；失效的出队丢弃 */
export function takeQueued(events: FixedEvent[], s: Sim): { ev: FixedEvent | null; sim: Sim } {
  const q = [...(s.evQueue ?? [])];
  while (q.length) {
    const ev = events.find((e) => e.id === q[0]);
    if (ev && fixedEligible(ev, s)) return { ev, sim: s };
    q.shift();
  }
  return { ev: null, sim: (s.evQueue?.length ?? 0) ? { ...s, evQueue: undefined } : s };
}

/** 酒馆侧：事件 → 世界书「剧情线索」条目（关键词检索注入；同一事件链进同一互斥组） */
export function eventToWorldBook(ev: FixedEvent, order = 100): WorldBookEntry {
  const kws = (ev.keywords ?? []).map((k) => k.trim()).filter(Boolean);
  return {
    id: `wb_ev_${ev.id}`,
    title: `剧情线索 · ${ev.name || "未命名事件"}`,
    keywords: kws.length ? kws : [ev.name].filter(Boolean),
    content: ev.prompt.trim(),
    enabled: true,
    mode: "keyword",
    order,
  };
}

export const TRIGGER_LABEL: Record<NonNullable<FixedEvent["trigger"]>["kind"], string> = {
  auto: "时间自动", enter: "进入地点", action: "行动完成", choice: "对话分支", rel: "好感变化", item: "获得道具", round: "会话轮次", modEvent: "MOD 事件", audio: "音频信号",
};
