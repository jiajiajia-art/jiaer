/* 人物关系网：关系展示、关系编辑器与 AI 人物认知共用的唯一入口。
 *
 * 一段关系只有「明确设定、且两头都能找到真实人物」才算数，来源仅限三处：
 *   1. 存档 relNet：玩家在「人物 · 关系网」里设定的，或剧情新人物登场时 AI 按 id 明确交代的；
 *   2. 内容池档案里写明了对方 id 的 family / ex（玩家接管该人物之前作为默认值）；
 *   3. 系统锁定关系：主角与双亲、出生的孩子、配偶 / 恋人；孩子的另一位亲人；圈内艺人生态里的现任 / 前任。
 * 绝不按姓氏、称谓、年龄差或常识推导；只写了名字、找不到这个人的引用一律不算（父母显示「未知」）。 */
import type { GameState, RelEdge, RelKind, RelNet } from "../lib/types";
import type { FamilyRef } from "../worlds/star2005/content";
import { LIVE_PEOPLE, worldPersonById } from "../mods/registry";
import { FAMILY_NPC_IDS } from "./family";
import { npcGenderOf } from "./worldRules";
import { hasPartner } from "./logic";

export const PLAYER_REF = "__player__"; // 指向主角本人的引用 id：不当作 NPC 打开，也不进 relNet

export const REL_FIELDS = ["现任", "前任", "父母", "子女", "其他"] as const;
export type RelField = (typeof REL_FIELDS)[number];
export type RelRef = { id: string; name: string; note?: string; locked?: boolean };
export type RelSummary = Record<RelField, RelRef[]> & { noParents: boolean };

type G = Pick<GameState, "npcs" | "sim" | "player" | "relNet">;
const REL_KINDS: readonly RelKind[] = ["partner", "ex", "parent", "other"];

const rosterOf = (g: G) => g.sim?.npcs ?? [];
/* 关系网的端点：只认花名册里真实存在的人物（主角不算） */
export const inRoster = (g: G, id: string) => !!id && id !== PLAYER_REF && g.npcs.some((n) => n.id === id);
/* 关系目标真实存在：花名册人物或圈内艺人 */
export const personExists = (g: G, id: string) => inRoster(g, id) || rosterOf(g).some((x) => x.id === id);
export const personName = (g: G, id: string): string | undefined =>
  id === PLAYER_REF ? g.player.name : g.npcs.find((n) => n.id === id)?.name ?? rosterOf(g).find((x) => x.id === id)?.name;
/* 性别只用于「父亲 / 母亲」「儿子 / 女儿」的称呼，不参与关系判定 */
export function personGender(g: G, id: string): string | undefined {
  if (id === PLAYER_REF) return g.player.gender;
  const n = g.npcs.find((x) => x.id === id);
  const family = n && (FAMILY_NPC_IDS as readonly string[]).includes(id) ? (n.relation === "父亲" ? "男" : n.relation === "母亲" ? "女" : undefined) : undefined;
  return n?.persona?.gender ?? family ?? worldPersonById(id)?.gender ?? rosterOf(g).find((x) => x.id === id)?.gender ?? npcGenderOf(id);
}
const kinOfParent = (gender?: string) => (gender === "男" ? "父亲" : gender === "女" ? "母亲" : "");
const kinOfChild = (gender?: string) => (gender === "男" ? "儿子" : gender === "女" ? "女儿" : "");
// 备注本身已是称呼（养父、长子……）就不再叠加「父亲 · 」
const KIN_HEAD = /^(父|母|爸|妈|养|继|生|亲|儿|女儿|子|长|次|幼|独)/;
const withKin = (kin: string, note?: string) => (!note ? kin || undefined : !kin || KIN_HEAD.test(note) ? note : `${kin} · ${note}`);

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const otherOf = (e: RelEdge, pid: string) => (e.a === pid ? e.b : e.a);
const touches = (e: RelEdge, pid: string) => e.a === pid || e.b === pid;
// 备注带 noteSide 时是站在那一位的角度写的（对方是 TA 的「养母」「未婚夫」），只在 TA 的档案里显示
const noteOf = (e: RelEdge, pid: string) => (!e.noteSide || (e.noteSide === "a" ? e.a : e.b) === pid ? e.note : undefined);

/* 内容池默认关系：只认写明了对方 id 的引用；作者备注只在作者写下它的那份档案里显示 */
const refsOf = (r?: FamilyRef | FamilyRef[] | null): FamilyRef[] => (Array.isArray(r) ? r : r ? [r] : []).filter((x) => !!x && typeof x === "object");
export function authoredEdges(): RelEdge[] {
  const out: RelEdge[] = [];
  for (const p of LIVE_PEOPLE) {
    if (!p?.id) continue;
    const ids = (r?: FamilyRef | FamilyRef[] | null) => refsOf(r).filter((x) => typeof x.id === "string" && !!x.id && x.id !== p.id && x.id !== PLAYER_REF);
    const note = (x: FamilyRef) => x.note?.trim() || undefined;
    for (const x of ids(p.family?.spouse)) out.push({ a: p.id, b: x.id!, kind: "partner", note: note(x) });
    for (const x of ids(p.ex)) out.push({ a: p.id, b: x.id!, kind: "ex", note: note(x) });
    for (const x of ids(p.family?.parents)) out.push({ a: x.id!, b: p.id, kind: "parent", note: note(x), noteSide: "b" });
    for (const x of ids(p.family?.children)) out.push({ a: p.id, b: x.id!, kind: "parent", note: note(x), noteSide: "a" });
  }
  return out;
}

/* 当前生效的人际关系边 = 存档边 + 两头都没被玩家接管的内容池默认边；两头都得在花名册里，每对人物只取一条
 * （家庭系统只生成了主角的双亲，没写二人是否为夫妻，所以这里不替他们连线） */
export function netEdges(g: G): RelEdge[] {
  const owned = new Set(g.relNet?.owned ?? []);
  const seen = new Set<string>();
  const out: RelEdge[] = [];
  const take = (e: RelEdge) => {
    if (!e || typeof e.a !== "string" || typeof e.b !== "string" || e.a === e.b || !REL_KINDS.includes(e.kind)) return;
    if (!inRoster(g, e.a) || !inRoster(g, e.b)) return;
    const k = pairKey(e.a, e.b);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };
  (g.relNet?.edges ?? []).forEach(take);
  authoredEdges().filter((e) => !owned.has(e.a) && !owned.has(e.b)).forEach(take);
  return out;
}

/* 系统锁定关系：由家庭、生育、恋爱与艺人生态维护，关系网编辑器里只读 */
export function lockedRefs(g: G, pid: string): [RelField, RelRef][] {
  const out: [RelField, RelRef][] = [];
  const s = g.sim;
  if (!s || !pid || pid === PLAYER_REF) return out;
  const me = (kin: string, extra?: string): RelRef => ({ id: PLAYER_REF, name: g.player.name || "你", note: ["你", kin, extra].filter(Boolean).join(" · "), locked: true });
  // 系统生成的双亲：主角是 TA 的孩子
  if ((FAMILY_NPC_IDS as readonly string[]).includes(pid) && inRoster(g, pid)) out.push(["子女", me(kinOfChild(g.player.gender))]);
  // 主角的配偶 / 恋人
  if (s.spouses?.includes(pid)) out.push(["现任", me("", "配偶")]);
  else if (hasPartner(s, pid)) out.push(["现任", me("", "恋人")]);
  // 出生的孩子：父母 = 主角 + 另一位亲人；另一位亲人的子女 = 孩子
  const kids = s.children ?? [];
  const kid = kids.find((c) => c.id === pid);
  if (kid) {
    out.push(["父母", me(kinOfParent(g.player.gender))]);
    const other = kid.fatherId && kid.fatherId !== pid && personExists(g, kid.fatherId) ? personName(g, kid.fatherId) : undefined;
    if (other) out.push(["父母", { id: kid.fatherId, name: other, note: kinOfParent(personGender(g, kid.fatherId)) || undefined, locked: true }]);
  }
  for (const c of kids) {
    if (c.fatherId !== pid || c.id === pid || !personExists(g, c.id)) continue;
    out.push(["子女", { id: c.id, name: personName(g, c.id) ?? c.name, note: kinOfChild(c.gender) || undefined, locked: true }]);
  }
  // 圈内艺人：现任 / 前任来自生态模拟（老存档字段可能缺失）
  const roster = rosterOf(g);
  const star = roster.find((x) => x.id === pid);
  const partner = star?.partnerId ? roster.find((x) => x.id === star.partnerId) : undefined;
  const ex = star?.exId ? roster.find((x) => x.id === star.exId) : undefined;
  if (partner) out.push(["现任", { id: partner.id, name: partner.name, locked: true }]);
  if (ex) out.push(["前任", { id: ex.id, name: ex.name, locked: true }]);
  return out;
}

/* 某人的全部关系（人脉详情 / 场景人物资料 / 艺人资料共用）：系统锁定关系在前，同一人只出现一次 */
export function relationsOf(g: G | null | undefined, pid: string): RelSummary {
  const out: RelSummary = { 现任: [], 前任: [], 父母: [], 子女: [], 其他: [], noParents: false };
  if (!g || !pid || pid === PLAYER_REF) return out;
  const seen = new Set<string>();
  const add = (f: RelField, r: RelRef) => {
    if (!r.id || !r.name?.trim() || r.id === pid || seen.has(r.id)) return;
    seen.add(r.id);
    out[f].push(r);
  };
  for (const [f, r] of lockedRefs(g, pid)) add(f, r);
  for (const e of netEdges(g)) {
    if (!touches(e, pid)) continue;
    const other = otherOf(e, pid);
    const name = personName(g, other);
    if (!name) continue;
    const note = noteOf(e, pid);
    if (e.kind === "parent") {
      if (e.b === pid) add("父母", { id: other, name, note: withKin(kinOfParent(personGender(g, other)), note) });
      else add("子女", { id: other, name, note: withKin(kinOfChild(personGender(g, other)), note) });
    } else add(e.kind === "partner" ? "现任" : e.kind === "ex" ? "前任" : "其他", { id: other, name, note });
  }
  out.noParents = !out.父母.length && !!g.relNet?.noParents?.includes(pid);
  return out;
}

/* ═══ 关系网编辑 ═══ 行的 kind 以「对方是 TA 的什么人」表述 */
export type RelRowKind = "partner" | "ex" | "parent" | "child" | "other";
export const REL_ROW_LABEL: Record<RelRowKind, string> = { partner: "现任", ex: "前任", parent: "父母", child: "子女", other: "其他" };
export type RelRow = { kind: RelRowKind; id: string; note?: string; edge?: RelEdge };
const rowKindOf = (e: RelEdge, pid: string): RelRowKind => (e.kind === "parent" ? (e.b === pid ? "parent" : "child") : e.kind);
/* 按「对方是 TA 的什么人」建边；备注是 TA 这边的称呼，只在 TA 的档案里显示（「其他」写的是关系本身，两边都显示） */
function rowEdge(pid: string, other: string, kind: RelRowKind, note?: string): RelEdge {
  const base: RelEdge = kind === "parent" ? { a: other, b: pid, kind: "parent" } : kind === "child" ? { a: pid, b: other, kind: "parent" } : { a: pid, b: other, kind };
  if (!note) return base;
  return kind === "other" ? { ...base, note } : { ...base, note, noteSide: base.a === pid ? "a" : "b" };
}

/* 某人当前可编辑的关系（系统锁定关系不在其中） */
export function editableRows(g: G, pid: string): RelRow[] {
  const locked = new Set(lockedRefs(g, pid).map(([, r]) => r.id));
  return netEdges(g).filter((e) => touches(e, pid) && !locked.has(otherOf(e, pid))).map((e) => ({ kind: rowKindOf(e, pid), id: otherOf(e, pid), note: noteOf(e, pid), edge: e }));
}

/* 接管：把此刻对 TA 生效的内容池默认关系落进存档，之后 TA 的关系只以存档为准（删掉的不会复活） */
function adopt(g: G, pid: string): RelNet {
  const net = g.relNet ?? { edges: [] };
  const owned = net.owned ?? [];
  if (owned.includes(pid)) return { ...net, edges: [...net.edges] };
  const have = new Set(net.edges.map((e) => pairKey(e.a, e.b)));
  const inherit = authoredEdges().filter((e) => touches(e, pid) && !owned.includes(e.a) && !owned.includes(e.b) && inRoster(g, e.a) && inRoster(g, e.b) && !have.has(pairKey(e.a, e.b)));
  return { ...net, edges: [...net.edges, ...inherit], owned: [...owned, pid] };
}

/* 用编辑器里的 rows 整体替换 TA 的可编辑关系；noParents = 明确设定「没有父母」（有父母行时自动失效） */
export function withRows(g: G, pid: string, rows: RelRow[], noParents: boolean): RelNet {
  const net = adopt(g, pid);
  const locked = new Set(lockedRefs(g, pid).map(([, r]) => r.id));
  const seen = new Set<string>();
  const mine: RelEdge[] = [];
  for (const r of rows) {
    if (!r.id || r.id === pid || !inRoster(g, r.id) || locked.has(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const note = r.note?.trim() || undefined;
    // 没改动的行原样保留（含对方那一侧写的备注）
    if (r.edge && otherOf(r.edge, pid) === r.id && rowKindOf(r.edge, pid) === r.kind && (noteOf(r.edge, pid)?.trim() || undefined) === note) { mine.push(r.edge); continue; }
    mine.push(rowEdge(pid, r.id, r.kind, note));
  }
  // 整体换掉 TA 名下的旧边（新边都连着 TA，不会与别人之间的边重复）
  const edges = [...net.edges.filter((e) => !touches(e, pid)), ...mine];
  const hasParent = mine.some((e) => e.kind === "parent" && e.b === pid);
  const gained = new Set(mine.filter((e) => e.kind === "parent" && e.a === pid).map((e) => e.b)); // 新认的子女不再算「没有父母」
  const none = (net.noParents ?? []).filter((id) => id !== pid && !gained.has(id));
  if (noParents && !hasParent) none.push(pid);
  return { ...net, edges, noParents: none };
}

/* 剧情新人物登场时 AI 按 id 明确交代的关系：两头都得真实存在，不覆盖已有关系，不违背「明确没有父母」 */
const LINK_KIND: Record<string, RelRowKind> = {
  partner: "partner", 现任: "partner", 伴侣: "partner", 配偶: "partner", 恋人: "partner",
  ex: "ex", 前任: "ex", parent: "parent", 父母: "parent", 父亲: "parent", 母亲: "parent",
  child: "child", 子女: "child", 儿子: "child", 女儿: "child", other: "other", 其他: "other",
};
export function linkNewcomer(g: G, pid: string, links: unknown): RelNet | undefined {
  if (!Array.isArray(links) || !inRoster(g, pid)) return undefined;
  let net: RelNet = g.relNet ?? { edges: [] };
  const taken = new Set(netEdges(g).filter((e) => touches(e, pid)).map((e) => otherOf(e, pid)));
  let changed = false;
  for (const l of links.slice(0, 6)) {
    if (!l || typeof l !== "object") continue;
    const { id, kind, note } = l as { id?: unknown; kind?: unknown; note?: unknown };
    const k = typeof kind === "string" ? LINK_KIND[kind.trim().toLowerCase()] ?? LINK_KIND[kind.trim()] : undefined;
    if (typeof id !== "string" || !k || id === pid || !inRoster(g, id) || taken.has(id)) continue;
    if ((k === "parent" && net.noParents?.includes(pid)) || (k === "child" && net.noParents?.includes(id))) continue;
    if (k === "child" && relationsOf({ ...g, relNet: net }, id).父母.length >= 2) continue; // 已有的人物父母已齐，不再认亲
    const n = typeof note === "string" && note.trim() ? note.trim().slice(0, 24) : undefined;
    net = { ...net, edges: [...net.edges, rowEdge(pid, id, k, n)] };
    taken.add(id);
    changed = true;
  }
  return changed ? net : undefined;
}

/* ═══ 给 AI 的关系认知 ═══ */
/* 主线 GM：全局关系网摘要（只列明确关系，限量防止提示词膨胀） */
export function relNetPromptLines(g: G, limit = 30): string[] {
  const name = (id: string) => personName(g, id) ?? id;
  // 带 noteSide 的备注写明是谁的称呼，免得 AI 把「养母」「未婚夫」安到另一头
  const sideNote = (e: RelEdge) => {
    const side = e.noteSide === "a" ? e.a : e.b;
    return `（${name(otherOf(e, side))}是${name(side)}的${e.note}）`;
  };
  const lines: string[] = [];
  for (const e of netEdges(g)) {
    const note = !e.note ? "" : e.noteSide ? sideNote(e) : `（${e.note}）`;
    const kin = kinOfParent(personGender(g, e.a)) || "父亲或母亲";
    if (e.kind === "parent") lines.push(e.note && e.noteSide === "b" ? `${name(e.a)}是${name(e.b)}的${withKin(kin, e.note)}` : `${name(e.a)}是${name(e.b)}的${kin}${note}`);
    else if (e.kind === "partner") lines.push(`${name(e.a)}与${name(e.b)}是现任伴侣${note}`);
    else if (e.kind === "ex") lines.push(`${name(e.a)}与${name(e.b)}是前任${note}`);
    else lines.push(`${name(e.a)}与${name(e.b)}：${e.note || "相识"}`);
  }
  for (const c of g.sim?.children ?? []) {
    const other = c.fatherId && personExists(g, c.fatherId) ? personName(g, c.fatherId) : undefined;
    if (other && personExists(g, c.id)) lines.push(`${other}是${personName(g, c.id) ?? c.name}（主角的孩子）的另一位${kinOfParent(personGender(g, c.fatherId)) || "家长"}`);
  }
  // 「明确没有父母」与「父母未设定」是两回事：只有前者写进来
  for (const id of g.relNet?.noParents ?? []) if (inRoster(g, id) && !relationsOf(g, id).父母.length) lines.push(`${name(id)}明确没有父母`);
  return lines.slice(0, limit);
}

/* NPC 视角：这一位人物明确知道的人际关系（私聊 / 通话 / 当面交谈 / 打听共用） */
export function relationPromptFor(g: G, pid: string): string {
  const r = relationsOf(g, pid);
  const who = (x: RelRef) => {
    if (x.id !== PLAYER_REF) return `${x.name}${x.note ? `（${x.note}）` : ""}`;
    const n = (x.note ?? "").replace(/^你\s*(·\s*)?/, "");
    return `主角${n ? `（${n}）` : ""}`;
  };
  const parents = r.父母.length ? `父母：${r.父母.map(who).join("、")}` : r.noParents ? "父母：没有（已明确设定）" : "父母：未设定";
  const rest = (["现任", "前任", "子女", "其他"] as const).filter((f) => r[f].length).map((f) => `${f}：${r[f].map(who).join("、")}`);
  return `〈你的人际关系（只以这里为准）〉\n${[parents, ...rest].join("\n")}\n（没列出的伴侣、前任、亲属一律视为没有设定：不要凭姓氏、称谓、年龄或常识认亲，也不要编造具体的家人姓名与身份，被问起时含糊带过即可。）\n`;
}
