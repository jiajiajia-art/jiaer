/* ————— 星城 MUD 引擎（纯规则层）—————
 * 参照 Evennia 的房间/出口/心跳约定，用 TypeScript 实现并融入本作确定性引擎。
 * 契约：本文件不含娱乐圈中文名、履历、门槛阈值或按钮文案——它们全部来自
 * worlds/content-pool（world.yaml），经 content.ts 解析后注入。这里只做通用运算：
 * 出口查询、心跳走动、在场判定、门槛求值转发。
 */
import { LOCATIONS } from "./data";
import { dayParts, type GameState as SimState } from "./logic";
import {
  DIR_LABEL,
  ENCOUNTERS,
  PEOPLE,
  PERSON_BY_ID,
  PROJECT_TPL_BY_ID,
  ROOMS,
  ROOM_STATUS_LABELS,
  TRAVEL,
  encountersOf,
  evalRequires,
  intelOfPerson,
  introOf,
  itemsOfRoom,
  type Dir,
  type Encounter,
  type PersonContent,
  type PersonIntel,
  type RoomItem,
} from "../worlds/star2005/content";

export { DIR_LABEL, PEOPLE, PERSON_BY_ID, introOf, itemsOfRoom };
export type { Dir, PersonContent, PersonIntel, RoomItem };

export const locOf = (id: string) => LOCATIONS.find((l) => l.id === id);
export const ALL_ROOMS = Object.keys(ROOMS);

/* 房间叙述文：直接取自内容池 */
export const ROOM_DESC: Record<string, string> = Object.fromEntries(
  Object.entries(ROOMS).map(([id, r]) => [id, r.desc]),
);

export function exitsOf(roomId: string): { dir: Dir; to: string; name: string }[] {
  const ex = ROOMS[roomId]?.exits ?? {};
  return (Object.keys(ex) as Dir[]).map((d) => {
    const to = ex[d]!;
    return { dir: d, to, name: locOf(to)?.name ?? to };
  });
}

/* ═══════════════ 战争迷雾 · 城市地图 ═══════════════ */

/* 地图节点状态：
 * visited  已到访——去过，解锁人物/物品/行动
 * frontier 已发现——某个已到访房间的出口指向它，你「听说过」但还没亲自去
 * unknown  未探索——彻底的灰雾，只知其大概方向 */
export type NodeState = "visited" | "frontier" | "unknown";

export function mapNodeState(s: SimState, roomId: string): NodeState {
  const visited = new Set(s.visited ?? []);
  if (visited.has(roomId)) return "visited";
  for (const v of visited) if (exitsOf(v).some((e) => e.to === roomId)) return "frontier";
  return "unknown";
}

/* 从某个已到访房间望向未探索节点的大概方向（战争迷雾只透露方向，不给名字） */
export function directionHint(s: SimState, roomId: string): string {
  const visited = new Set(s.visited ?? []);
  for (const v of visited) {
    const ex = exitsOf(v).find((e) => e.to === roomId);
    if (ex) return `${locOf(v)?.name ?? v}的${DIR_LABEL[ex.dir]}向`;
  }
  return "城中某处";
}

export type TravelPlan = {
  reachable: boolean;
  explore: boolean; // 目标尚未到访：本次是首探
  sameRoom: boolean;
  hops: number;
  minutes: number;
  fee: number;
  energy: number; // 本次行程消耗的行动力（按段累计）
  reason?: string;
};

/* ═══ 交通方式（玩家自选）═══
 * 同一段路程，选不同交通工具，费用与耗时不同。自己的车不花钱。
 * fareMul 作用于基础车费（hops×feePerHop）；timeMul 作用于基础耗时。 */
export type TransportMode = { id: string; label: string; fareMul: number; timeMul: number; note: string; ownCar?: boolean };
export const TRANSPORT: TransportMode[] = [
  { id: "walk", label: "步行", fareMul: 0, timeMul: 2.4, note: "免费 · 最慢，顺便散散心" },
  { id: "bus", label: "公交", fareMul: 0.4, timeMul: 1.5, note: "便宜，但要等要挤" },
  { id: "subway", label: "地铁", fareMul: 0.7, timeMul: 0.9, note: "准点，性价比高" },
  { id: "taxi", label: "打车", fareMul: 1.8, timeMul: 0.7, note: "最快，也最贵" },
  { id: "drive", label: "自己开车", fareMul: 0, timeMul: 0.7, note: "开自己的车 · 免费又自在", ownCar: true },
];

/* 按所选交通方式换算某趟行程的实际车费与耗时（就近取整；至少 1 分钟）。 */
export function fareFor(plan: TravelPlan, mode: TransportMode): { fee: number; minutes: number } {
  return {
    fee: Math.max(0, Math.round(plan.fee * mode.fareMul)),
    minutes: Math.max(1, Math.round(plan.minutes * mode.timeMul)),
  };
}

/* 城市通行图搜索：可穿行「已到访」房间，最后一步可踏入相邻的未探索节点（首探）。
 * 纯图运算 + 内容池参数，不含任何领域中文或阈值。 */
export function travelPlan(s: SimState, to: string): TravelPlan {
  const from = s.room ?? "apartment";
  const base = { explore: false, sameRoom: false, hops: 0, minutes: 0, fee: 0, energy: 0 };
  if (to === from) return { ...base, reachable: false, sameRoom: true, reason: "你已经在这里了。" };
  const visited = new Set(s.visited ?? []);
  const seen = new Set<string>([from]);
  let frontier: string[] = [from];
  let dist = 0;
  while (frontier.length) {
    dist += 1;
    const nextLayer: string[] = [];
    for (const cur of frontier) {
      for (const ex of exitsOf(cur)) {
        const nb = ex.to;
        if (nb === to) {
          const hops = dist;
          const acc = roomAccess(s, to);
          if (!acc.ok) return { ...base, reachable: false, hops, reason: acc.note };
          return {
            reachable: true,
            explore: !visited.has(to),
            sameRoom: false,
            hops,
            minutes: hops * TRAVEL.minutesPerHop,
            fee: hops * TRAVEL.feePerHop,
            energy: 0,
          };
        }
        if (visited.has(nb) && !seen.has(nb)) { seen.add(nb); nextLayer.push(nb); }
      }
    }
    frontier = nextLayer;
  }
  return { ...base, reachable: false, reason: "你还不知道怎么去那里——先摸索到附近吧。" };
}

/* ═══════════════ 地点动态状态 · 营业/开放/拍摄 ═══════════════ */

/* 状态键：open 开放 · closed 今日休息 · busy 有剧组占用（拍摄中） · event 活动
 * 「营业状态」不阻拦通行（closed 也能进去看看），只反映此刻这里在发生什么。 */
export type RoomStatusKind = "open" | "closed" | "busy" | "event";
export type RoomStatusView = { kind: RoomStatusKind; label: string; open: boolean };

/* 由内容池的 hours/openDays 与在场剧组推导；引擎不写死中文，文案取自 ROOM_STATUS_LABELS。 */
export function roomStatus(s: SimState, roomId: string): RoomStatusView {
  const L = ROOM_STATUS_LABELS ?? {};
  const r = ROOMS[roomId];
  // busy：有 in_progress 项目，其负责人据点正是此地 → 剧组占用
  const busy = (s.projects ?? []).some((p) => {
    if (p.status !== "in_progress") return false;
    const tpl = PROJECT_TPL_BY_ID[p.templateId];
    const mgr = tpl ? PERSON_BY_ID[tpl.managerNpcId] : undefined;
    return mgr?.home === roomId;
  });
  if (busy) return { kind: "busy", label: L.busy ?? "busy", open: true };
  // 开放星期（1=周一…7=周日；dayParts.dow 为 0=周一…6=周日）
  if (r?.openDays && r.openDays.length) {
    const wd = dayParts(s.day ?? 0).dow + 1;
    if (!r.openDays.includes(wd)) return { kind: "closed", label: L.closed ?? "closed", open: false };
  }
  const label = r?.hours ? `${L.open ?? "open"} · ${r.hours}` : (L.open ?? "open");
  return { kind: "open", label, open: true };
}

/* 通行门槛：内容池未登记 access 则畅通；未达标则给出解释文案（+ 差值提示）。
 * 与营业状态不同，门槛达不到会真正拦住前往。 */
export type RoomAccessView = { ok: boolean; note: string };
export function roomAccess(s: SimState, roomId: string): RoomAccessView {
  const a = ROOMS[roomId]?.access;
  if (!a) return { ok: true, note: "" };
  const g = a.requires?.length ? evalRequires(a.requires, s) : { ok: true, hint: "" };
  if (g.ok) return { ok: true, note: "" };
  return { ok: false, note: g.hint ? `${a.note}（${g.hint}）` : a.note };
}

/* 当前房间可拾取/查看的地点物品（含是否已收入行囊） */
export function itemsHere(s: SimState, roomId: string): (RoomItem & { owned: boolean })[] {
  return itemsOfRoom(roomId).map((it) => ({ ...it, owned: (s.bag ?? []).includes(it.id) }));
}

/* ═══════════════ 打听情报 · 每人只知与自己相关 ═══════════════ */

/* 某人物可打听的情报视图：unlocked 已听得、available 门槛达标可打听、locked 需更进一步 */
export type IntelView = { id: string; topic: string; text: string; unlocked: boolean; available: boolean; hint: string };

/* 列出该人物的自有情报（须先结识；含解锁/门槛状态）。这里只做转发与门槛比较，内容全在池中。 */
export function intelOf(s: SimState, personId: string): IntelView[] {
  const known = new Set(s.knownIntel ?? []);
  return intelOfPerson(personId).map((it) => {
    const g = it.requires?.length ? evalRequires(it.requires, s) : { ok: true, hint: "" };
    return { id: it.id, topic: it.topic, text: it.text, unlocked: known.has(it.id), available: g.ok, hint: g.hint };
  });
}

/* 打听一条情报：须已结识该人物、门槛达标且尚未听过；成功则写入 knownIntel 并返回消息文本 */
export function learnIntel(s: SimState, personId: string, intelId: string): { next: SimState; msg: string } {
  const it = intelOfPerson(personId).find((x) => x.id === intelId);
  if (!it) return { next: s, msg: "TA 对此讳莫如深。" };
  if (!(s.metPeople ?? []).includes(personId)) return { next: s, msg: "你和 TA 还不熟，说不上几句私房话。" };
  if ((s.knownIntel ?? []).includes(intelId)) return { next: s, msg: it.text };
  const g = it.requires?.length ? evalRequires(it.requires, s) : { ok: true, hint: "" };
  if (!g.ok) return { next: s, msg: `TA 此刻不愿多谈——${g.hint}。` };
  return { next: { ...s, knownIntel: [...(s.knownIntel ?? []), intelId] }, msg: it.text };
}

/* ═══════════════ 人物系统 · 心跳 ═══════════════ */

/* 心跳伪随机：由 (id + tick) 派生，保证同一心跳下的走动可复现 */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/* 解析当前人物位置：老存档或首次进入时，从各自据点落座 */
export function resolveMobs(s: SimState): Record<string, string> {
  const cur = s.mobs ?? {};
  const out: Record<string, string> = {};
  for (const m of PEOPLE) out[m.id] = cur[m.id] ?? m.home;
  return out;
}

export type WorldEvent = { text: string };

/* 世界心跳：推进一拍，roam 人物沿出口在活动范围内走动；产出与玩家所在房间相关的环境事件 */
export function tickWorld(s: SimState): { mobs: Record<string, string>; tick: number; events: WorldEvent[] } {
  const prev = resolveMobs(s);
  const tick = (s.tick ?? 0) + 1;
  const next: Record<string, string> = { ...prev };
  const events: WorldEvent[] = [];
  const playerRoom = s.room ?? "apartment";

  for (const m of PEOPLE) {
    if (m.kind !== "roam") continue;
    const from = prev[m.id];
    if (hash(m.id + ":move:" + tick) > 0.42) continue; // 约 42% 概率移动一步
    const cand = exitsOf(from).filter((e) => m.roam.includes(e.to));
    if (!cand.length) continue;
    const pick = cand[Math.floor(hash(m.id + ":dir:" + tick) * cand.length)];
    next[m.id] = pick.to;
    const known = s.metPeople?.includes(m.id) || evalRequires(m.requires, s).ok;
    if (from === playerRoom && known) events.push({ text: `${m.name}起身离开，往${DIR_LABEL[pick.dir]}边的${pick.name}去了。` });
    else if (pick.to === playerRoom && known) events.push({ text: `${m.name}信步走了进来。` });
  }
  return { mobs: next, tick, events };
}

/* 当前房间在场人物（含履历与是否可交谈） */
export type HerePerson = { id: string; name: string; role: string; bio: string; present: boolean; hint: string; offerLabel?: string };

export function mobsHere(s: SimState, roomId: string): HerePerson[] {
  const pos = resolveMobs(s);
  return PEOPLE.filter((m) => !s.npcLives?.[m.id]?.dead && pos[m.id] === roomId).map((m) => {
    const g = evalRequires(m.requires, s);
    const hint = m.requires.length ? g.hint : m.presentHint ?? "";
    return { id: m.id, name: m.name, role: m.role, bio: m.bio, present: g.ok, hint, offerLabel: m.offers?.label };
  });
}

/* ═══════════════ 条件邂逅 · 同处一地方可触发 ═══════════════ */

export type EncounterView = { id: string; personId: string; label: string; seed: string; effects?: Encounter["effects"] };

/* 单条邂逅是否此刻可触发：须未触发过（once）、门槛达标、性格匹配、关系到位。 */
function encounterEligible(s: SimState, e: Encounter): boolean {
  if (e.once && (s.eventsFired ?? []).includes(e.id)) return false;
  if (e.needTrait && !(s.char.traitIds ?? []).includes(e.needTrait)) return false;
  if (e.minRel !== undefined && (s.rel?.[e.personId] ?? 0) < e.minRel) return false;
  if (e.requires?.length && !evalRequires(e.requires, s).ok) return false;
  return true;
}

/* 当前房间里、与玩家同处一地的人物身上此刻可触发的特殊事件（前端据此在人物行动条给出按钮）。 */
export function encountersHere(s: SimState, roomId: string): EncounterView[] {
  const pos = resolveMobs(s);
  const present = new Set(PEOPLE.filter((m) => !s.npcLives?.[m.id]?.dead && pos[m.id] === roomId && evalRequires(m.requires, s).ok).map((m) => m.id));
  const out: EncounterView[] = [];
  for (const pid of present) {
    for (const e of encountersOf(pid)) {
      if (encounterEligible(s, e)) out.push({ id: e.id, personId: e.personId, label: e.label, seed: e.seed, effects: e.effects });
    }
  }
  return out;
}

/* 触发一条邂逅：确定性应用数值增减、登记为已触发，返回叙事种子交给上层送 AI 演绎。 */
export function fireEncounter(s: SimState, id: string): { next: SimState; seed: string } {
  const e = ENCOUNTERS.find((x) => x.id === id);
  if (!e || !encounterEligible(s, e)) return { next: s, seed: "" };
  const cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const n: SimState = { ...s, rel: { ...s.rel }, eventsFired: [...(s.eventsFired ?? [])] };
  const f = e.effects ?? {};
  if (f.rel) {
    const cap = e.personId === "guchen" || e.personId === "songshixu" ? 1000 : 100;
    n.rel[e.personId] = cl((n.rel[e.personId] ?? 0) + f.rel, 0, cap);
  }
  if (f.stress) n.stress = cl(n.stress + f.stress, 0, 100);
  if (f.energy) n.energy = cl(n.energy + f.energy, 0, 100);
  if (f.reputation) n.reputation = cl(n.reputation + f.reputation, 0, 100);
  if (f.fame) n.fame = Math.max(0, n.fame + f.fame);
  if (!n.metPeople.includes(e.personId)) n.metPeople = [...n.metPeople, e.personId];
  if (e.once) n.eventsFired.push(e.id);
  return { next: n, seed: e.seed };
}

/* 已结识/可见人物此刻散落何处（营造世界在呼吸的感觉） */
export function mobsElsewhere(s: SimState, roomId: string): { name: string; where: string }[] {
  const pos = resolveMobs(s);
  return PEOPLE.filter((m) => !s.npcLives?.[m.id]?.dead && m.kind === "roam" && pos[m.id] !== roomId && (s.metPeople?.includes(m.id) || evalRequires(m.requires, s).ok))
    .map((m) => ({ name: m.name, where: locOf(pos[m.id])?.name ?? pos[m.id] }));
}
