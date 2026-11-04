import { affinityCapOf } from "../worlds/star2005/content";
/* ————— 星城 MUD 引擎（纯规则层）—————
 * 参照 Evennia 的房间/出口/心跳约定，用 TypeScript 实现并融入本作确定性引擎。
 * 契约：本文件不含娱乐圈中文名、履历、门槛阈值或按钮文案——它们全部来自
 * worlds/content-pool（world.yaml），经 content.ts 解析后注入。这里只做通用运算：
 * 出口查询、心跳走动、在场判定、门槛求值转发。
 */
import { feature } from "../mods/registry";
import { LIVE_PEOPLE as PEOPLE, LIVE_PERSON_BY_ID as PERSON_BY_ID, LIVE_ROOMS as ROOMS, getWorldStartRoom, runtimeLinks, worldIntroOf as introOf, worldItemsOfRoom as itemsOfRoom, worldLocOf } from "../mods/registry";
import { arcView, canRomance, dayParts, type ArcView, type GameState as SimState } from "./logic";
import { liveArray } from "../mods/live";
import type { Npc } from "../lib/types";
import type { TransportMode } from "../worlds/star2005/content";
import { childrenOf, isWithin, parentOf, pathOf, sameTree } from "./roomTree";
import { engineRules } from "./engineRules";
import {
  DIR_LABEL,
  ENCOUNTERS,
  PROJECT_TPL_BY_ID,
  ROOM_STATUS_LABELS,
  TRAVEL,
  encountersOf,
  evalRequires,
  intelOfPerson,
  setRoomPathProvider,
  type Dir,
  type Encounter,
  type PersonContent,
  type PersonIntel,
  type RoomItem,
} from "../worlds/star2005/content";

export { DIR_LABEL, PEOPLE, PERSON_BY_ID, introOf, itemsOfRoom };
export type { Dir, PersonContent, PersonIntel, RoomItem };

export const locOf = (id: string) => worldLocOf(id);
/* 当前世界全部房间 id（函数：随生效世界变化，且不在模块加载期求值） */
export const allRooms = () => Object.keys(ROOMS);
export const startRoom = () => getWorldStartRoom();

/* 房间叙述文：直接取自内容池 */
export const roomDesc = (id: string): string | undefined => ROOMS[id]?.desc;

export function exitsOf(roomId: string): { dir: Dir; to: string; name: string }[] {
  const ex = ROOMS[roomId]?.exits ?? {};
  const base = (Object.keys(ex) as Dir[]).map((d) => {
    const to = ex[d]!;
    return { dir: d, to, name: locOf(to)?.name ?? to };
  });
  // 自建地点：与其「连通到」的地点双向相连
  const extra = runtimeLinks(roomId).filter((to) => !base.some((b) => b.to === to)).map((to) => ({ dir: "n" as Dir, to, name: locOf(to)?.name ?? to }));
  return [...base, ...extra];
}

/* ═══════════════ 地点树 · 多级子地点 ═══════════════ */
setRoomPathProvider((id) => (id ? pathOf(ROOMS, id) : []));

/* 通行图：方向出口 + 地点树的上下层连接（父 ↔ 子）。寻路与 NPC 走动都走这张图 */
export function linksOf(roomId: string): { to: string; name: string; dir?: Dir }[] {
  const out: { to: string; name: string; dir?: Dir }[] = exitsOf(roomId);
  const add = (to?: string) => { if (to && !out.some((e) => e.to === to)) out.push({ to, name: locOf(to)?.name ?? ROOMS[to]?.name ?? to }); };
  add(parentOf(ROOMS, roomId));
  childrenOf(ROOMS, roomId).forEach(add);
  return out;
}

/* 面包屑：根 → … → 当前 */
export const roomPath = (roomId: string) => pathOf(ROOMS, roomId).map((id) => ({ id, name: locOf(id)?.name ?? ROOMS[id]?.name ?? id }));
export const roomParent = (roomId: string) => parentOf(ROOMS, roomId);
export const roomUpLabel = (roomId: string) => ROOMS[roomId]?.upLabel;
export const roomBgOf = (roomId: string) => ROOMS[roomId]?.bg;
export const roomBgmOf = (roomId: string) => ROOMS[roomId]?.bgm;
/* 同一棵地点树里的移动：只是走几步路，不收车费、不扣行动点 */
export const insideTree = (a: string, b: string) => sameTree(ROOMS, a, b);
/* 某人的活动范围是否覆盖此地：roam 里写了某个地点 = 它整枝（含全部子地点）都算 */
export const inRange = (range: readonly string[], roomId: string) => range.some((r) => isWithin(ROOMS, roomId, r));

/* 当前地点的直接子地点入口：隐藏的（未到访且未解锁）不出现；上锁 / 门槛不足的照常显示但标明原因 */
export type ChildEntry = { id: string; name: string; desc: string; ok: boolean; note: string; visited: boolean };
export function childEntries(s: SimState, roomId: string): ChildEntry[] {
  const visited = new Set(s.visited ?? []);
  return childrenOf(ROOMS, roomId).flatMap((id) => {
    const r = ROOMS[id];
    const unlocked = (s.flags?.[`unlock:${id}`] ?? 0) >= 1;
    if (r.hidden && !visited.has(id) && !unlocked) return [];
    const acc = roomAccess(s, id);
    return [{ id, name: locOf(id)?.name ?? r.name ?? id, desc: r.intro ?? r.desc ?? "", ok: acc.ok, note: acc.note, visited: visited.has(id) }];
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
  for (const v of visited) if (linksOf(v).some((e) => e.to === roomId)) return "frontier";
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
export type { TransportMode } from "../worlds/star2005/content";
/* 当前世界的出行方式（模组 travel.modes 覆盖）；默认方式 / 无车时的回退方式 */
const NO_TRANSPORT: TransportMode[] = [{ id: "go", label: "前往", fareMul: 0, timeMul: 1, note: "直接前往" }];
/* 出行面板文案：全部由模组 travel 配置，未配置时用通用缺省 */
export const travelText = () => ({ title: TRAVEL.pickTitle?.trim() || "怎么去", cur: TRAVEL.currency ?? "¥", free: TRAVEL.freeLabel?.trim() || "免费" });
export const fareText = (fee: number) => { const t = travelText(); return fee > 0 ? `${t.cur}${fee}` : t.free; };
export const transportOn = () => feature("transport") && !!TRAVEL.modes?.length;
export const TRANSPORT: TransportMode[] = liveArray(() => (!transportOn() ? NO_TRANSPORT : TRAVEL.modes!));
export const defaultTransport = (): TransportMode => {
  const pub = TRANSPORT.filter((m) => !m.ownCar);
  return pub.find((m) => m.id === TRAVEL.defaultMode) ?? pub.find((m) => m.id === "subway") ?? pub[0] ?? TRANSPORT[0];
};
/* 行程点：体力按「段」计——走一段路扣 1 点，进入一段事件支线扣 N 点；每点 = 世界 travel.energyPerHop 体力 */
export const hopEnergy = () => Math.max(1, Math.round(TRAVEL.energyPerHop || 1));
/* 行动点：每回合（推进一次）回满到作者设定值，换地点踩点扣固定点数，进入支线按事件设定扣 */
export const apMax = () => Math.max(1, Math.round(TRAVEL.apPerTurn ?? 10));
export const apPerMove = () => Math.max(0, Math.round(TRAVEL.apPerMove ?? 1));
/* 推进节奏：每次推进几天；日程叙事内置开启，字数走 travel.advanceWords 缺省 500（创作者界面不再配置） */
export const advanceDays = () => Math.max(1, Math.min(30, Math.round(TRAVEL.advanceDays ?? 1)));
export type AdvanceUnit = "day" | "week" | "month" | "year";
/** 推进单位（缺省：日）；日模式下次数沿用 advanceDays */
export type AdvancePref = { unit: AdvanceUnit; count: number };
export const advanceUnit = (p?: AdvancePref): AdvanceUnit => p?.unit ?? ((["day", "week", "month", "year"] as const).includes(TRAVEL.advanceUnit as AdvanceUnit) ? (TRAVEL.advanceUnit as AdvanceUnit) : "day");
export const advanceCount = (p?: AdvancePref) => p ? Math.max(1, Math.min(p.unit === "day" ? 30 : 12, Math.round(p.count))) : advanceUnit() === "day" ? advanceDays() : Math.max(1, Math.min(12, Math.round(TRAVEL.advanceCount ?? 1)));
export const advanceLabel = (p?: AdvancePref) => { const u = advanceUnit(p), n = advanceCount(p); const U = { day: "天", week: "周", month: "个月", year: "年" }[u]; return n === 1 ? `一${U === "个月" ? "个月" : U}` : `${n} ${U}`; };
/** 功能注释：推进后 AI 日程叙事内置开启，创作者界面不再暴露开关 */
export const advanceStoryOn = () => true;
export const advanceWords = () => Math.max(100, Math.min(2000, Math.round(TRAVEL.advanceWords ?? 500)));
export const tripPoints = (s: { ap?: number }) => Math.max(0, s.ap ?? apMax());
export const tripPointsMax = apMax;
export const carShopId = (): string | undefined => TRAVEL.carShop;

/* 按所选交通方式换算某趟行程的实际车费（作者为每种方式配置每段花费；不再计算耗时）。 */
export function fareFor(plan: TravelPlan, mode: TransportMode): { fee: number; minutes: number } {
  return {
    // 票价由作者为公共交通配置（每趟固定 ¥）；自有座驾免费；旧模组回退到 基础车费×倍率
    fee: !transportOn() || mode.ownCar ? 0 : Math.max(0, Math.round(mode.fee != null ? mode.fee : plan.fee * mode.fareMul)),
    minutes: 0, // 出行不再以分钟计时：路程只消耗行程点

  };
}

/* 城市通行图搜索：可穿行「已到访」房间，最后一步可踏入相邻的未探索节点（首探）。
 * 纯图运算 + 内容池参数，不含任何领域中文或阈值。 */
export function travelPlan(s: SimState, to: string): TravelPlan {
  const from = s.room ?? getWorldStartRoom();
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
      for (const ex of linksOf(cur)) {
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
            energy: hops * hopEnergy(),
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
  const r = ROOMS[roomId];
  // 单独上锁：只认这一层自己的解锁变量，父地点解锁不连带
  if (r?.locked && (s.flags?.[`unlock:${roomId}`] ?? 0) < 1) return { ok: false, note: r.lockNote || "门锁着，进不去。" };
  const a = r?.access;
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

/* —— 地图人物名单 ——
 * 内容池人物（据点 / 活动范围 / 门槛 / 邂逅都来自内容池）+ 存档里设了常驻地点的其他人物（自定义 / 剧情新增）。
 * 传入存档名单（g.npcs）时：名字、身份取存档值；常驻地点（npc.home）覆盖内容池据点。
 * 没有内容池据点、也没设常驻地点的人物（家人、婴儿、网友……）不上地图。 */
export type MapNpc = Pick<Npc, "id" | "name" | "identity" | "bio" | "home">;
type Walker = { id: string; name: string; role: string; bio: string; home: string; anchored: boolean; m?: PersonContent };

const validRoom = (id?: string): id is string => !!id && id in ROOMS;

function walkers(roster?: readonly MapNpc[], hero?: string): Walker[] {
  const own = new Map((roster ?? []).map((n) => [n.id, n]));
  const out: Walker[] = PEOPLE.map((m) => {
    const n = own.get(m.id);
    const h = n?.home;
    const home = validRoom(h) ? h : undefined;
    return { id: m.id, name: n?.name || m.name, role: n?.identity || m.role, bio: m.bio, home: home ?? m.home, anchored: !!home, m };
  });
  const seen = new Set(out.map((w) => w.id));
  for (const n of roster ?? []) {
    const h = n.home;
    if (seen.has(n.id) || !validRoom(h)) continue;
    seen.add(n.id);
    out.push({ id: n.id, name: n.name, role: n.identity, bio: n.bio, home: h, anchored: true });
  }
  return hero ? out.filter((w) => w.id !== hero) : out; // 人物线路选中的预设主角由玩家操控，不再作为 NPC 上地图
}

/* 解析当前人物位置：老存档、首次进入或位置已失效（地点被删）时，从各自据点 / 常驻地点落座 */
export function resolveMobs(s: SimState, roster?: readonly MapNpc[]): Record<string, string> {
  const cur = s.mobs ?? {};
  const out: Record<string, string> = {};
  for (const w of walkers(roster, s.hero)) out[w.id] = validRoom(cur[w.id]) ? cur[w.id] : w.home;
  return out;
}

/* 换了常驻地点：人物当即落座到新的常驻地点；清空则回内容池据点，没有据点的退出地图 */
export function seatAtHome(s: SimState, id: string, home?: string): SimState {
  const to = validRoom(home) ? home : PERSON_BY_ID[id]?.home;
  const mobs = { ...(s.mobs ?? {}) };
  if (to) mobs[id] = to;
  else delete mobs[id];
  return { ...s, mobs };
}

/* 一拍里此人往哪走（undefined = 原地不动）。
 * 设了常驻地点：在常驻地点时约 22% 概率出门到相邻处；在外时约 60% 回来、20% 逗留、20% 就近再走一步——长期七成多时间待在常驻地点。
 * 内容池 roam 人物：约 42% 概率在活动范围内走一步；被带离活动范围（如同行）的人，择机回据点。 */
function stepOf(w: Walker, from: string, tick: number): string | undefined {
  const roll = (k: string) => hash(`${w.id}:${k}:${tick}`);
  const pickOf = (cand: { to: string }[]) => (cand.length ? cand[Math.floor(roll("dir") * cand.length)].to : undefined);
  // NPC 可走的相邻处：方向出口 + 上下层地点，排除「不允许 NPC 自主到访」的地点
  // 底层规则：每隔 roamEvery 拍才走动一次；默认不许走出所在地点树（回常驻地点 / 据点不受限）
  const R = engineRules().npc;
  if (R.roamEvery > 1 && tick % R.roamEvery) return undefined;
  const near = linksOf(from).filter((e) => !ROOMS[e.to]?.noNpcVisit && (R.roamCrossRoot || insideTree(from, e.to)));
  if (w.anchored) {
    if (from === w.home) return roll("move") > 0.22 ? undefined : pickOf(near);
    const r = roll("home");
    return r < 0.6 ? w.home : r < 0.8 ? undefined : pickOf(near);
  }
  const m = w.m!;
  if (roll("move") > 0.42) return undefined; // 约 42% 概率移动一步
  // 活动范围：roam 里的地点连同其全部子地点（如写「梅花庵」= 整座庵里随处走）
  if (from !== m.home && !(m.kind === "roam" && inRange(m.roam, from))) return m.home;
  if (m.kind !== "roam") return undefined;
  return pickOf(near.filter((e) => e.to === m.home || inRange(m.roam, e.to)));
}

export type WorldEvent = { text: string };

/* 世界心跳：推进一拍，人物沿出口走动（规则见 stepOf）；产出与玩家所在房间相关的环境事件 */
export function tickWorld(s: SimState, roster?: readonly MapNpc[]): { mobs: Record<string, string>; tick: number; events: WorldEvent[] } {
  const prev = resolveMobs(s, roster);
  const tick = (s.tick ?? 0) + 1;
  const next: Record<string, string> = { ...prev };
  const events: WorldEvent[] = [];
  const playerRoom = s.room ?? getWorldStartRoom();

  for (const w of walkers(roster, s.hero)) {
    const from = prev[w.id];
    const to = stepOf(w, from, tick);
    if (!to || to === from) continue;
    next[w.id] = to;
    const known = s.metPeople?.includes(w.id) || (!!w.m && evalRequires(w.m.requires, s).ok);
    if (from === playerRoom && known) {
      const ex = exitsOf(from).find((e) => e.to === to);
      events.push({ text: ex ? `${w.name}起身离开，往${DIR_LABEL[ex.dir]}边的${ex.name}去了。` : `${w.name}起身离开，回${locOf(to)?.name ?? to}去了。` });
    } else if (to === playerRoom && known) events.push({ text: `${w.name}信步走了进来。` });
  }
  return { mobs: next, tick, events };
}

/* 当前房间在场人物（含履历与是否可交谈） */
export type HerePerson = { id: string; name: string; role: string; bio: string; present: boolean; hint: string; offerLabel?: string; resident: boolean };

export function mobsHere(s: SimState, roomId: string, roster?: readonly MapNpc[]): HerePerson[] {
  const pos = resolveMobs(s, roster);
  return walkers(roster, s.hero).filter((w) => pos[w.id] === roomId).map((w) => {
    const m = w.m;
    // 自定义 / 剧情新增人物：没有门槛与委托，碰上了就能搭话
    if (!m) return { id: w.id, name: w.name, role: w.role, bio: w.bio, present: true, hint: "", resident: w.home === roomId };
    // 功能注释：requires 可能是 AI 脏对象；evalRequires 内已 asModArray，length 也按数组判
    const reqs = Array.isArray(m.requires) ? m.requires : m.requires ? [m.requires] : [];
    const g = evalRequires(reqs, s);
    const hint = reqs.length ? g.hint : m.presentHint ?? "";
    return { id: m.id, name: w.name, role: w.role, bio: m.bio, present: g.ok, hint, offerLabel: m.offers?.label, resident: w.anchored ? w.home === roomId : m.kind !== "roam" || m.home === roomId };
  });
}

/* ═══════════════ 条件邂逅 · 同处一地方可触发 ═══════════════ */

export type EncounterView = { id: string; personId: string; label: string; seed: string; effects?: Encounter["effects"] };

/* 单条邂逅是否此刻可触发：须未触发过（once）、门槛达标、性格匹配、关系到位。 */
function encounterEligible(s: SimState, e: Encounter): boolean {
  if (e.once && (s.eventsFired ?? []).includes(e.id)) return false;
  // 可重复邂逅：同一天只触发一次，避免反复点按刷数值
  if (!e.once && (s.eventsFired ?? []).includes(`${e.id}@${s.day}`)) return false;
  if (e.minRel !== undefined && (s.rel?.[e.personId] ?? 0) < e.minRel) return false;
  if (e.requires?.length && !evalRequires(e.requires, s).ok) return false;
  return true;
}

/* 当前房间里、与玩家同处一地的人物身上此刻可触发的特殊事件（前端据此在人物行动条给出按钮）。
 * 传入存档人物（roster）时，位置按其常驻地点解析；自定义 / 剧情新增人物没有门槛，同处一地即算在场。 */
export function encountersHere(s: SimState, roomId: string, roster?: readonly MapNpc[]): EncounterView[] {
  const pos = resolveMobs(s, roster);
  const present = new Set(walkers(roster, s.hero).filter((w) => pos[w.id] === roomId && (!w.m || evalRequires(w.m.requires, s).ok)).map((w) => w.id));
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
    const cap = affinityCapOf(e.personId);
    n.rel[e.personId] = cl((n.rel[e.personId] ?? 0) + f.rel, 0, cap);
  }
  if (f.stress) n.stress = cl(n.stress + f.stress, 0, 100);
  if (f.energy) n.energy = cl(n.energy + f.energy, 0, 100);
  if (f.reputation) n.reputation = cl(n.reputation + f.reputation, 0, 100);
  if (f.fame) n.fame = Math.max(0, n.fame + f.fame);
  if (!n.metPeople.includes(e.personId)) n.metPeople = [...n.metPeople, e.personId];
  if (e.once) n.eventsFired.push(e.id);
  else n.eventsFired = [...n.eventsFired.filter((x) => !x.startsWith(`${e.id}@`)), `${e.id}@${s.day}`];
  const who = PEOPLE.find((p) => p.id === e.personId)?.name ?? e.personId;
  n.log = [...(s.log ?? []), `【第 ${s.week} 周 · 邂逅】${who}：${e.label}`].slice(-40);
  return { next: n, seed: e.seed };
}

/* ═══════════════ 情感线 · 当面发生 ═══════════════ */

/* TA 此刻是否就在你身边：与玩家同处一地，且已达出现门槛。 */
export function presentHere(s: SimState, roomId: string, pid: string, roster?: readonly MapNpc[]): boolean {
  return mobsHere(s, roomId, roster).some((p) => p.id === pid && p.present);
}

/* 情感线的下一段（或确认关系）只在见面时展开：已结识、可攻略、TA 就在身边、
 * 这一段条件达成且今天还没和 TA 经历过一段。不满足时返回 null，人物行动条里就不出现入口。 */
export function arcMomentHere(s: SimState, roomId: string, pid: string, roster?: readonly MapNpc[]): ArcView | null {
  if (!(s.metPeople ?? []).includes(pid) || !canRomance(s, pid)) return null;
  const v = arcView(s, pid);
  if (!v || !((v.stage && !v.locked && !v.today) || v.datingReady)) return null;
  return presentHere(s, roomId, pid, roster) ? v : null;
}

/* 已结识/可见人物此刻散落何处（营造世界在呼吸的感觉）；会走动的 = 内容池 roam 人物 + 设了常驻地点的人物 */
export function mobsElsewhere(s: SimState, roomId: string, roster?: readonly MapNpc[]): { name: string; where: string }[] {
  const pos = resolveMobs(s, roster);
  return walkers(roster, s.hero).filter((w) => (w.anchored || w.m?.kind === "roam") && pos[w.id] !== roomId && (s.metPeople?.includes(w.id) || (!!w.m && evalRequires(w.m.requires, s).ok)))
    .map((w) => ({ name: w.name, where: locOf(pos[w.id])?.name ?? pos[w.id] }));
}
