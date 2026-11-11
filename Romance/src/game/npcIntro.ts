/* 剧情初遇：新人物登场不再自动算作「结识」，而是在本回合正文底部出一张人物名片，由玩家决定结识或暂不结识。
 * 状态记在 game.npcIntro：pending = 名片待决定；skip = 暂不结识（之后再登场不打扰）；结识后移除并记入 sim.metPeople。 */
import type { AIStep, GameState, Segment, Turn } from "../lib/types";
import { findNpc } from "../lib/npcIdentity";
import { FAMILY_NPC_IDS } from "./family";

export type IntroState = "pending" | "skip" | "met";

const MAX_PER_TURN = 6;

export const introState = (g: GameState, id: string): IntroState =>
  (g.sim?.metPeople ?? []).includes(id) ? "met" : g.npcIntro?.[id] === "skip" ? "skip" : "pending";

/* 本回合的初遇人物：新建档的人物 + 第一次开口说话 / 与主角有互动、但还没结识的已有人物；暂不结识过的不再打扰 */
function newcomersOf(prev: GameState, next: GameState, segments: Segment[], step?: AIStep | null): string[] {
  const before = new Map(prev.npcs.map((n) => [n.id, n]));
  const out: string[] = [];
  const add = (id?: string) => {
    if (!id || out.includes(id) || (FAMILY_NPC_IDS as readonly string[]).includes(id) || introState(next, id) !== "pending") return;
    // 已在花名册里的人：名片还没处理的再次登场照常出；早就打过交道（有互动记录，如老存档）的不算初遇
    const old = before.get(id);
    if (old && next.npcIntro?.[id] !== "pending" && (old.interactions ?? []).length) return;
    out.push(id);
  };
  for (const n of next.npcs) if (!before.has(n.id)) add(n.id);
  for (const s of segments) if (s.kind === "dialogue") add(findNpc(next.npcs, undefined, s.speaker)?.id);
  // 只被提到、没有和主角打照面（无 interaction）的人不算初遇
  for (const nc of step?.npc_changes ?? []) {
    if (!nc || typeof nc !== "object" || typeof nc.interaction !== "string" || !nc.interaction.trim()) continue;
    add(findNpc(next.npcs, typeof nc.id === "string" ? nc.id : undefined, typeof nc.name === "string" ? nc.name : "")?.id);
  }
  return out.slice(0, MAX_PER_TURN);
}

/* 回合落地时调用：把本回合初遇的人物标成 pending，返回名片名单（写进该回合的 Turn.newcomers） */
export function withNewcomers(prev: GameState, next: GameState, segments: Segment[], step?: AIStep | null): { g: GameState; ids: string[] } {
  const ids = newcomersOf(prev, next, segments, step);
  if (!ids.length) return { g: next, ids };
  const intro = { ...(next.npcIntro ?? {}) };
  for (const id of ids) intro[id] = "pending";
  return { g: { ...next, npcIntro: intro }, ids };
}

/* 名片挂在哪一回合：同一个人没处理就再次登场时，只在最近一次登场的回合底部出名片（turn.id → 人物 id） */
export function newcomerSlots(turns: readonly Turn[]): Map<string, string[]> {
  const slots = new Map<string, string[]>();
  const seen = new Set<string>();
  for (let i = turns.length - 1; i >= 0; i--) {
    const ids = (turns[i].newcomers ?? []).filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (ids.length) slots.set(turns[i].id, ids);
  }
  return slots;
}

/* 结识：记入已结识，清掉名片状态（重复调用无副作用；联系方式另走交换流程） */
export function meetPerson(g: GameState, id: string): GameState {
  const met = g.sim?.metPeople ?? [];
  const intro = { ...(g.npcIntro ?? {}) };
  delete intro[id];
  return { ...g, npcIntro: intro, sim: g.sim && !met.includes(id) ? { ...g.sim, metPeople: [...met, id] } : g.sim };
}

/* 暂不结识：不进人脉，之后再登场也不再弹名片（可随时改为结识） */
export function skipPerson(g: GameState, id: string): GameState {
  if (introState(g, id) === "met") return g;
  return { ...g, npcIntro: { ...(g.npcIntro ?? {}), [id]: "skip" } };
}
