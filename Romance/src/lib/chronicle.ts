/**
 * 剧情记忆（参考 SillyTavern 记忆插件：Horae 时光记忆 / 记忆表格 / 自动总结，并与本作世界书机制结合）
 *
 * · 事件线（Horae）：AI 每回合的 memory_updates(main) 落成带「游戏日 · 地点 · 相关人物 · 重要度」的事件，
 *   注入时换算成「今天 / 昨天 / 3 天前」等相对时间，避免把上周的事说成今天。
 * · 按需召回（世界书绿灯）：最近几条常驻；更早的事件按「在场人物 / 当前地点 / 本回合输入与近期对话」命中才召回，
 *   有条数与字数预算，不每回合整段塞。
 * · 关键事件进世界书（记忆表格的可见可改）：重要度 3 的事件自动写成本存档世界书里的关键词条目（标 _mem），
 *   玩家能在「世界书」面板查看、修改、删除；世界书检索自然负责召回。
 * · 场景记忆（变化驱动）：每个地点的陈设 / 状态与人物当前穿着，只在 AI 报告变化时更新；
 *   穿着只给在场人物注入、不在界面显示。
 */
import type { GameState, WorldBookEntry } from "./types";
import { decideWrite, digestPastDays, forget, isValid, promote, reinforce, retention, type LifecycleItem } from "./memory/lifecycle.ts";
import { hybridRetrieve } from "./memory/retrieval.ts";

export type ChronicleEvent = LifecycleItem & {
  id: string;
  day: number; // 游戏日（sim.day）
  time?: string; // 当时的游戏时间文本（仅展示 / 兜底）
  room?: string; // 发生地点 id
  who: string[]; // 相关人物 id
  text: string;
  imp: 1 | 2 | 3; // 1 日常 2 重要 3 关键（关键事件同步进世界书）
  keys?: string[]; // 额外召回关键词
  // 生命周期字段（见 memory/lifecycle）：tier 中/长期、recalls 被召回次数、lastRecall 最近召回日、
  // invalidAt / supersededBy 双时态失效（被新事实推翻，保留可追溯但不再注入）、kind=digest 每日归并
};
export type SceneMem = { facts: string[]; turn: number };

/** op/replaces：AI 指明本条是推翻（update）或撤销（delete）哪条旧记忆；缺省由本地决策层判断 */
export type MemoryUpdate = { scope?: "main" | "npc"; npc?: string; text: string; imp?: number; who?: string[]; keys?: string[]; op?: "add" | "update" | "delete"; replaces?: string };
export type SceneUpdate = { facts?: string[]; looks?: { name?: string; outfit?: string }[] };

const MAX_EVENTS = 300;
const MAX_FACTS = 8;
const RECENT_N = 5; // 中期：至少带最近几条
const MID_DAYS = 2; // 中期：近 N 个游戏日内的事件全部按时间列出
const MID_MAX = 10;
const MID_BUDGET = 900;
const RECALL_N = 6; // 长期：混合检索召回条数
const RECALL_BUDGET = 900;

const uid = () => `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clampImp = (n: unknown): 1 | 2 | 3 => (n === 3 || n === "3" ? 3 : n === 2 || n === "2" ? 2 : 1);

/* 相对时间：今天 / 昨天 / 前天 / N 天前 / 约 N 周前 */
export function relDay(now: number, day: number): string {
  const d = Math.max(0, now - day);
  if (d === 0) return "今天";
  if (d === 1) return "昨天";
  if (d === 2) return "前天";
  if (d < 7) return `${d} 天前`;
  if (d < 60) return `约 ${Math.round(d / 7)} 周前`;
  return `约 ${Math.round(d / 30)} 个月前`;
}

/* 文本里点到名的人物（全名或别名子串命中） */
function namedIds(g: GameState, text: string): string[] {
  return g.npcs.filter((n) => (n.name && text.includes(n.name)) || (n.aliases ?? []).some((a) => a && a.length >= 2 && text.includes(a))).map((n) => n.id);
}

/* 关键事件 → 本存档世界书条目（关键词 = 相关人物名 + 额外关键词；地点绑定沿用世界书的 bindRooms 语义不强制） */
function toWorldBook(g: GameState, ev: ChronicleEvent, roomName: (id?: string) => string): WorldBookEntry {
  const names = ev.who.map((id) => g.npcs.find((n) => n.id === id)?.name).filter(Boolean) as string[];
  const kw = [...new Set([...names, ...(ev.keys ?? [])].map((k) => k.trim()).filter((k) => k.length >= 2))].slice(0, 8);
  return {
    id: `mem_${ev.id}`,
    title: `记忆 · ${ev.text.slice(0, 16)}`,
    keywords: kw.length ? kw : [roomName(ev.room)].filter(Boolean),
    content: `【往事 · ${ev.time || `第 ${ev.day} 天`}${ev.room ? ` · ${roomName(ev.room)}` : ""}】${ev.text}`,
    enabled: true,
    mode: "keyword",
    order: 90,
    weight: 120,
    _mem: true,
  } as WorldBookEntry;
}

/* 每日归并：几条日常合成一条「当日经过」 */
function makeDigest(day: number, parts: ChronicleEvent[]): ChronicleEvent {
  const text = `当日经过：${parts.map((p) => p.text.replace(/[。.]$/, "")).join("；")}`.slice(0, 200);
  return {
    id: uid(), day, time: parts[0].time, room: parts[0].room, text, imp: 1, kind: "digest",
    who: [...new Set(parts.flatMap((p) => p.who))],
    keys: [...new Set(parts.flatMap((p) => p.keys ?? []))].slice(0, 8),
  };
}

/* 落地：main 记忆 → 事件线（关键事件同步世界书）；场景变化 → 场景记忆 / 穿着 */
export function applyMemory(
  g: GameState,
  updates: MemoryUpdate[],
  scene: SceneUpdate | undefined,
  ctx: { roomName: (id?: string) => string; defaultBook: () => WorldBookEntry[]; recalled?: string[] },
): GameState {
  let next = g;
  const day = g.sim?.day ?? 0;
  const room = g.sim?.room;
  let events = [...(g.chronicle ?? [])];
  const addBook: WorldBookEntry[] = [];
  const offBook = new Set<string>();
  for (const mu of updates) {
    const text = String(mu.text ?? "").trim().slice(0, 200);
    if (!text || mu.scope === "npc") continue;
    const whoByName = (mu.who ?? []).flatMap((nm) => namedIds(g, String(nm)));
    const who = [...new Set([...whoByName, ...namedIds(g, text)])];
    // 决策写入：ADD / UPDATE / DELETE / NOOP（UPDATE、DELETE 只做双时态失效，不物理删除）
    const d = decideWrite(events.filter(isValid), { text, who, op: mu.op, replaces: typeof mu.replaces === "string" ? mu.replaces : undefined });
    if (d.op === "NOOP") {
      if (d.target) events = events.map((e) => (e.id === d.target ? { ...e, imp: Math.max(e.imp, clampImp(mu.imp)) as 1 | 2 | 3 } : e));
      continue;
    }
    const ev: ChronicleEvent = {
      id: uid(), day, time: g.world?.time, room, text, imp: clampImp(mu.imp), who,
      keys: (mu.keys ?? []).map((k) => String(k).trim()).filter(Boolean).slice(0, 6),
    };
    if (d.target && (d.op === "UPDATE" || d.op === "DELETE")) {
      events = events.map((e) => (e.id === d.target ? { ...e, invalidAt: day, supersededBy: d.op === "UPDATE" ? ev.id : undefined } : e));
      offBook.add(`mem_${d.target}`);
    }
    if (d.op === "DELETE") continue;
    events.push(ev);
    if (ev.imp === 3) addBook.push(toWorldBook(g, ev, ctx.roomName));
  }
  // 巩固与遗忘：本回合被注入的记忆加固 → 晋升长期 → 过往日常归并 → 清理衰减殆尽的琐事
  const recalled = new Set(ctx.recalled ?? []);
  const before = g.chronicle ?? [];
  events = forget(digestPastDays(promote(reinforce(events, recalled, day), day), day, (d0, parts) => makeDigest(d0, parts)), day);
  if (events.length !== before.length || events.some((e, i) => e !== before[i])) next = { ...next, chronicle: events.slice(-MAX_EVENTS) };
  if (addBook.length || offBook.size) {
    const book = (next.worldBook ?? ctx.defaultBook()).map((b) => (offBook.has(b.id) ? { ...b, enabled: false } : b));
    next = { ...next, worldBook: [...book, ...addBook] };
  }

  if (scene && room) {
    const facts = (scene.facts ?? []).map((f) => String(f ?? "").trim().slice(0, 60)).filter(Boolean);
    if (facts.length) {
      const old = next.sceneMem?.[room]?.facts ?? [];
      // 新事实在前；与新事实同主语（前 4 字相同）的旧事实视为被更新，丢弃
      const merged = [...facts, ...old.filter((o) => !facts.some((f) => f === o || f.slice(0, 4) === o.slice(0, 4)))].slice(0, MAX_FACTS);
      next = { ...next, sceneMem: { ...(next.sceneMem ?? {}), [room]: { facts: merged, turn: g.turnCount } } };
    }
    const looks = { ...(next.looks ?? {}) };
    let changed = false;
    for (const l of scene.looks ?? []) {
      const id = l?.name ? namedIds(g, String(l.name))[0] : undefined;
      const outfit = String(l?.outfit ?? "").trim().slice(0, 60);
      if (id && outfit && looks[id] !== outfit) { looks[id] = outfit; changed = true; }
    }
    if (changed) next = { ...next, looks };
  }
  return next;
}

/* 分层取用：中期（近几日按时间全列）+ 长期（其余记忆走混合检索：向量 + BM25 + 实体图 → RRF → 遗忘曲线重排） */
function memoryLayers(g: GameState, hay: string, presentIds: string[]) {
  const now = g.sim?.day ?? 0;
  const room = g.sim?.room;
  const all = (g.chronicle ?? []).filter(isValid);
  const recentByCount = all.slice(-RECENT_N);
  const mid = [...new Map([...all.filter((e) => e.day >= now - MID_DAYS), ...recentByCount].map((e) => [e.id, e])).values()]
    .sort((a, b) => all.indexOf(a) - all.indexOf(b))
    .slice(-MID_MAX);
  const midIds = new Set(mid.map((e) => e.id));
  // 关键事件已进世界书，由世界书检索召回，这里不重复
  const pool = all.filter((e) => !midIds.has(e.id) && e.imp < 3);
  const entities = [...new Set([...presentIds, ...namedIds(g, hay)])];
  const ranked = hybridRetrieve(pool.map((e) => ({ id: e.id, text: e.text, who: e.who, room: e.room, keys: e.keys ?? [] })), { text: hay, entities, room });
  const byId = new Map(pool.map((e) => [e.id, e]));
  const long = ranked
    .map((r) => {
      const e = byId.get(r.id)!;
      return { e, s: r.rrf * 1000 * (0.4 + 0.6 * retention(e, now)) * (1 + 0.2 * e.imp) * (e.tier === "long" ? 1.15 : 1) };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.e);
  return { mid, long };
}

/* 本回合实际注入的记忆 id（中期 + 被召回的长期），供写回阶段做间隔重复加固 */
export function recalledMemoryIds(g: GameState, hay: string, presentIds: string[], roomName: (id?: string) => string): string[] {
  return pickLayers(g, hay, presentIds, roomName).recall.map((e) => e.id);
}

function pickLayers(g: GameState, hay: string, presentIds: string[], roomName: (id?: string) => string) {
  const now = g.sim?.day ?? 0;
  const line = (e: ChronicleEvent) => `· [${relDay(now, e.day)}${e.room ? ` · ${roomName(e.room)}` : ""}] ${e.text}`;
  const { mid, long } = memoryLayers(g, hay, presentIds);
  const recent: ChronicleEvent[] = [];
  let usedMid = 0;
  for (const e of [...mid].reverse()) {
    const l = line(e).length;
    if (usedMid + l > MID_BUDGET && recent.length) break;
    recent.unshift(e); usedMid += l;
  }
  const recall: ChronicleEvent[] = [];
  let used = 0;
  for (const e of long) {
    if (recall.length >= RECALL_N) break;
    const l = line(e).length;
    if (used + l > RECALL_BUDGET) continue;
    recall.push(e); used += l;
  }
  const all = g.chronicle ?? [];
  recall.sort((a, b) => all.indexOf(a) - all.indexOf(b));
  return { recent, recall, line };
}

/* 注入块：中期近况（相对时间）+ 长期相关往事（混合检索）+ 此地场景 / 在场者穿着（工作记忆） */
export function memoryBlock(g: GameState, hay: string, presentIds: string[], roomName: (id?: string) => string): string {
  const room = g.sim?.room;
  const { recent, recall, line } = pickLayers(g, hay, presentIds, roomName);
  const facts = room ? g.sceneMem?.[room]?.facts ?? [] : [];
  const looks = presentIds.map((id) => { const o = g.looks?.[id]; const nm = g.npcs.find((n) => n.id === id)?.name; return o && nm ? `${nm}：${o}` : ""; }).filter(Boolean);
  const parts: string[] = [];
  if (recent.length) parts.push(`〈最近发生的事〉\n${recent.map(line).join("\n")}`);
  if (recall.length) parts.push(`〈与此刻相关的往事〉\n${recall.map(line).join("\n")}`);
  if (facts.length || looks.length) parts.push(`〈此地现状（延续上次所见，未写到的变化不得凭空出现或消失）〉\n${[...facts.map((f) => `· ${f}`), ...looks.map((l) => `· ${l}`)].join("\n")}`);
  if (!parts.length) return "";
  return `【剧情记忆】（由系统记录的已发生事实，时间按当前游戏日换算；被新事实推翻的旧说法已移除，以此为准；叙事须与之一致，可自然提起，不要逐条复述）\n${parts.join("\n")}`;
}

/* 摘要失败兜底：按事件条目保留（关键优先），而不是截取原文末尾 */
export function chronicleFallbackSummary(g: GameState, max = 900): string {
  const all = (g.chronicle ?? []).filter(isValid);
  const keep = [...all.filter((e) => e.imp >= 2), ...all.slice(-8)];
  const uniq = [...new Map(keep.map((e) => [e.id, e])).values()].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  let out = "";
  for (const e of [...uniq].reverse()) { const l = `· ${e.time || `第${e.day}天`} ${e.text}\n`; if (out.length + l.length > max) break; out = l + out; }
  return out.trim();
}
