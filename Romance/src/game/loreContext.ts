/* ═══════════════ 按需设定：详细设定 / 节日 / 进行中的事件 ═══════════════
 * 目标：把大世界观拆成「此刻用得上的」才发给 AI，节省 token 又不让 AI 乱编。
 *  - 详细设定：主角所在地区 → 发完整设定（含下属势力与角色）；其他地区只发名称 + 简介速查表；
 *              剧情里提到别处的地区 / 势力 / 角色 → 单独补发它自己的完整设定（不捆绑下属）。
 *  - 节日：平时只发名称与日期；临近或正值节日、或剧情提到关键词时发完整设定。
 *  - 事件：关键词触发；带结束关键词的事件每回合持续发送，直到 AI 正文出现结束词。 */
import type { FixedEvent, Festival, GameState, LoreChar, LoreNode, LoreRegion } from "../lib/types";
import { asTrimmedString } from "../lib/asTrimmedString";
import { slot } from "../mods/live";
import { dayParts } from "./logic";
import { applyFixedEffects, applyHiddenBranches, fixedEligible } from "./fixedEvents";

const LORE_FULL_BUDGET = 3000; // 当前地区完整设定
const LORE_INDEX_BUDGET = 1200; // 其他地区速查表
const LORE_MENTION_BUDGET = 1600; // 被提及条目的补充设定
const SCAN_TURNS = 2; // 提及 / 关键词检索最近几回合

export const loreRegions = (): LoreRegion[] => slot<LoreRegion[]>("lore", () => [], () => []) ?? [];
export const worldFestivals = (): Festival[] => slot<Festival[]>("festivals", () => [], () => []) ?? [];

const clip = (t: unknown, n: number) => { const s = loreText(t); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
/** 功能注释：地区/势力/角色常缺 detail；直接 .trim() 会在「详细设定」预览崩成 reading 'trim' */
const loreText = (raw: unknown) => asTrimmedString(raw);
const loreKeys = (raw: unknown) => (Array.isArray(raw) ? raw : []).map((k) => loreText(k)).filter(Boolean);
/** 检索文本：本回合输入 + 最近几回合正文 */
export function recentHay(state: GameState, input: string, turns = SCAN_TURNS): string {
  const recent = state.story.filter((t) => !t.error).slice(-turns)
    .map((t) => t.segments.map((s) => (s.kind === "dialogue" ? `${s.speaker}${s.text}` : s.text)).join(" ")).join(" ");
  return `${input} ${recent}`.toLowerCase();
}
/* 名称 + 关键词；单字名容易误命中，至少 2 字才参与提及判定 */
const namesOf = (n: LoreNode) => [loreText(n.name), ...loreKeys(n.keywords)].filter((k) => k.length >= 2);
const hit = (n: LoreNode, hay: string) => namesOf(n).some((k) => hay.includes(k.toLowerCase()));

/** 主角此刻所在的地区：地点归属 → 地名包含地区名 / 关键词 → 只有一个地区时默认它 */
export function currentRegions(state: GameState, regions = loreRegions()): LoreRegion[] {
  const room = state.sim?.room;
  const loc = state.world?.location ?? "";
  const byRoom = room ? regions.filter((r) => r.rooms?.includes(room)) : [];
  if (byRoom.length) return byRoom;
  const byName = loc ? regions.filter((r) => namesOf(r).some((k) => loc.includes(k))) : [];
  if (byName.length) return byName;
  return regions.length === 1 ? regions : [];
}

function pushWithin(out: string[], block: string, used: { n: number }, budget: number) {
  if (used.n + block.length > budget && out.length) return false;
  out.push(used.n + block.length > budget ? clip(block, budget - used.n) : block);
  used.n += block.length;
  return true;
}
const charLine = (c: LoreChar, owner: string) => `· 角色「${loreText(c.name)}」${owner ? `（${owner}）` : ""}：${loreText(c.detail) || loreText(c.brief)}`;

/** 某地区作为「当前地区」时发送的完整设定（含下属势力与角色） */
export function regionFull(r: LoreRegion): string {
  const lines = [`◆ 地区「${loreText(r.name)}」\n${loreText(r.detail) || loreText(r.brief)}`];
  for (const f of r.factions ?? []) {
    lines.push(`▸ 势力「${loreText(f.name)}」：${loreText(f.detail) || loreText(f.brief)}`);
    for (const c of f.chars ?? []) lines.push(charLine(c, f.name));
  }
  for (const c of r.chars ?? []) lines.push(charLine(c, ""));
  return lines.join("\n");
}
/** 速查表里的一个地区：名称 + 简介，势力与角色也只列名称 + 简介 */
export function regionIndex(r: LoreRegion): string {
  const lines = [`◇ ${loreText(r.name)}：${clip(loreText(r.brief) || loreText(r.detail), 60)}`];
  const fs = (r.factions ?? []).map((f) => `${loreText(f.name)}（${clip(loreText(f.brief) || loreText(f.detail), 24)}）`);
  if (fs.length) lines.push(`  势力：${fs.join("；")}`);
  const cs = [...(r.factions ?? []).flatMap((f) => f.chars ?? []), ...(r.chars ?? [])].map((c) => `${loreText(c.name)}（${clip(loreText(c.brief) || loreText(c.detail), 20)}）`);
  if (cs.length) lines.push(`  角色：${cs.join("；")}`);
  return lines.join("\n");
}

/** 详细设定块：当前地区完整 + 其他地区速查 + 被提及条目单独补发 */
export function loreBlock(state: GameState, input: string): string {
  const regions = loreRegions().filter((r) => loreText(r.name));
  if (!regions.length) return "";
  const here = currentRegions(state, regions);
  const hereIds = new Set(here.map((r) => r.id));
  const others = regions.filter((r) => !hereIds.has(r.id));
  const hay = recentHay(state, input);
  const parts: string[] = [];

  if (here.length) {
    const out: string[] = [], used = { n: 0 };
    for (const r of here) pushWithin(out, regionFull(r), used, LORE_FULL_BUDGET);
    parts.push(`【详细设定 · 主角所在：${here.map((r) => r.name).join("、")}】（本地区的完整设定，须据此演绎）\n${out.join("\n\n")}`);
  }
  if (others.length) {
    const out: string[] = [], used = { n: 0 };
    for (const r of others) if (!pushWithin(out, regionIndex(r), used, LORE_INDEX_BUDGET)) break;
    parts.push(`【设定速查 · ${here.length ? "其他地区" : "各地区"}】（只列名称与简介；提到这些地方或人物时以此为准，不得编造与之冲突的内容）\n${out.join("\n")}`);
  }

  // 剧情提及：别处的地区 / 势力 / 角色，各自单独补发完整设定
  const mentions: string[] = [], used = { n: 0 };
  for (const r of others) {
    if (hit(r, hay) && loreText(r.detail)) pushWithin(mentions, `◆ 地区「${loreText(r.name)}」\n${loreText(r.detail)}`, used, LORE_MENTION_BUDGET);
    for (const f of r.factions ?? []) {
      if (hit(f, hay) && loreText(f.detail)) pushWithin(mentions, `◆ 势力「${loreText(f.name)}」（${loreText(r.name)}）\n${loreText(f.detail)}`, used, LORE_MENTION_BUDGET);
      for (const c of f.chars ?? []) if (hit(c, hay) && loreText(c.detail)) pushWithin(mentions, `◆ 角色「${loreText(c.name)}」（${loreText(r.name)} · ${loreText(f.name)}）\n${loreText(c.detail)}`, used, LORE_MENTION_BUDGET);
    }
    for (const c of r.chars ?? []) if (hit(c, hay) && loreText(c.detail)) pushWithin(mentions, `◆ 角色「${loreText(c.name)}」（${loreText(r.name)}）\n${loreText(c.detail)}`, used, LORE_MENTION_BUDGET);
  }
  if (mentions.length) parts.push(`【补充设定 · 剧情提及】（主角不在这些地方，但剧情提到了，须与以下设定一致）\n${mentions.join("\n\n")}`);
  return parts.join("\n\n");
}

/* —— 节日 —— */
const DAY = 86400000;
export type FestivalState = { f: Festival; status: string } | null;
/** 节日相对今天的状态：正值 / N 天后（在提前窗口内）；不在窗口内返回 null */
export function festivalStatus(f: Festival, day: number): string | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(loreText(f.date));
  if (!m) return null;
  const { y, m: mo, d } = dayParts(day);
  const today = Date.UTC(y, mo - 1, d);
  const len = Math.max(1, f.days ?? 1), lead = Math.max(0, f.lead ?? 3);
  for (const Y of [y - 1, y, y + 1]) {
    const start = Date.UTC(Y, +m[1] - 1, +m[2]), end = start + (len - 1) * DAY;
    if (today >= start && today <= end) return len > 1 ? `正值节日（第 ${(today - start) / DAY + 1} / ${len} 天）` : "就是今天";
    const until = (start - today) / DAY;
    if (until > 0 && until <= lead) return `${until} 天后`;
  }
  return null;
}
export function festivalBlock(state: GameState, input: string): string {
  const list = worldFestivals().filter((f) => loreText(f.name));
  if (!list.length) return "";
  const day = state.sim?.day ?? 0;
  const hay = recentHay(state, input);
  const details: string[] = [];
  for (const f of list) {
    const st = festivalStatus(f, day);
    const kw = [f.name, ...loreKeys(f.keywords)].map((k) => loreText(k).toLowerCase()).filter((k) => k.length >= 2).some((k) => hay.includes(k));
    if ((st || kw) && loreText(f.detail)) details.push(`◆ ${loreText(f.name)}（${loreText(f.date)}${(f.days ?? 1) > 1 ? `，持续 ${f.days} 天` : ""}）${st ? ` · ${st}` : " · 剧情提及"}\n${loreText(f.detail)}`);
  }
  const index = `【节日速查】${list.map((f) => `${f.name}（${f.date}）`).join("、")}`;
  return details.length ? `${index}\n【节日设定】（临近或剧情提到的节日，须据此演绎习俗与氛围）\n${details.join("\n\n")}` : index;
}

/* —— 事件：关键词触发 / 进行中 / 结束关键词 —— */
export const isKeywordEvent = (ev: FixedEvent) => loreKeys(ev.keywords).length > 0;
const kwHit = (keys: string[] | undefined, hay: string) => loreKeys(keys).map((k) => k.toLowerCase()).some((k) => hay.includes(k));

/** 本回合被关键词触发的事件（仍需满足时间、条件、一次性 / 前置激活） */
export function keywordEventHits(state: GameState, input: string): FixedEvent[] {
  const active = new Set(state.sim?.eventsActive ?? []);
  const hay = recentHay(state, input);
  return (state.fixedEvents ?? []).filter((ev) => isKeywordEvent(ev) && !active.has(ev.id) && fixedEligible(ev, state.sim) && kwHit(ev.keywords, hay));
}
/** 激活事件：结算数值、登记已触发，并加入进行中列表（由 activeEventsBlock 发给 AI） */
export function activateEvents(state: GameState, evs: FixedEvent[]): GameState {
  if (!evs.length) return state;
  let sim = state.sim;
  for (const ev of evs) sim = applyHiddenBranches(applyFixedEffects(sim, ev).next, ev).next;
  return { ...state, sim: { ...sim, eventsActive: Array.from(new Set([...(sim.eventsActive ?? []), ...evs.map((e) => e.id)])) } };
}
/** 固定事件以剧情幕上演后：带结束关键词的转为进行中，继续每回合发送 */
export function keepIfOngoing(state: GameState, ev: FixedEvent): GameState {
  if (!loreKeys(ev.endKeywords).length) return state;
  return { ...state, sim: { ...state.sim, eventsActive: Array.from(new Set([...(state.sim.eventsActive ?? []), ev.id])) } };
}
export function activeEventsBlock(state: GameState): string {
  const ids = state.sim?.eventsActive ?? [];
  if (!ids.length) return "";
  const evs = ids.map((id) => (state.fixedEvents ?? []).find((e) => e.id === id)).filter((e): e is FixedEvent => !!e && !!loreText(e.prompt));
  if (!evs.length) return "";
  return `【进行中的事件】（以下事件正在发生，本回合须据此推进剧情）\n${evs.map((ev) => {
    const ends = loreKeys(ev.endKeywords);
    return `◆ ${loreText(ev.name) || "事件"}\n${loreText(ev.prompt)}${ends.length ? `\n（结束标志：当此事件在剧情中自然收束时，正文里写出「${ends[0]}」${ends.length > 1 ? `（或${ends.slice(1).map((k) => `「${k}」`).join("、")}）` : ""}；还没结束就不要写。）` : ""}`;
  }).join("\n\n")}`;
}
/** AI 回复落地后：出现结束关键词的事件结束；没有结束词的事件只发一回合 */
export function settleActiveEvents(state: GameState, aiText: string): GameState {
  const ids = state.sim?.eventsActive ?? [];
  if (!ids.length) return state;
  const text = aiText.toLowerCase();
  const keep = ids.filter((id) => {
    const ev = (state.fixedEvents ?? []).find((e) => e.id === id);
    if (!ev) return false;
    const ends = loreKeys(ev.endKeywords);
    return ends.length > 0 && !kwHit(ends, text);
  });
  if (keep.length === ids.length) return state;
  return { ...state, sim: { ...state.sim, eventsActive: keep.length ? keep : undefined } };
}
