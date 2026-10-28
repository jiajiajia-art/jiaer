/* 支线选角：按 SIDEQUEST_CAST 的角色定位，从玩家人脉里挑出真实 NPC 出演。
 * 同一位 NPC 不会在同一段里分饰两角；匹配多人时取与你好感最高的那位。 */
import type { Npc } from "../lib/types";
import { SIDEQUEST_CAST } from "../worlds/star2005/content";

export type CastSlot = { role: string; npc?: Npc; stranger: string };

export function castOf(questId: string, npcs: Npc[]): CastSlot[] {
  const used = new Set<string>();
  return (SIDEQUEST_CAST[questId] ?? []).map((r) => {
    const npc = npcs
      .filter((n) => !used.has(n.id) && (typeof r.match === "string" ? new RegExp(r.match) : r.match).test(`${n.identity} ${n.relation}`))
      .sort((a, b) => b.affinity - a.affinity)[0];
    if (npc) used.add(npc.id);
    return { role: r.role, npc, stranger: r.stranger };
  });
}

/* 交给叙事层的人物表：真实 NPC 带上身份 / 好感 / 最近记忆，陌生配角标明首次见面 */
export function castPrompt(slots: CastSlot[], playerName: string): string {
  const lines = slots.map((c) => {
    if (!c.npc) return `· ${c.role}：${c.stranger}（陌生配角，与${playerName}初次打交道，可自拟姓名）`;
    const n = c.npc;
    const mem = n.interactions.slice(-2).map((i) => i.text).join("；");
    return `· ${c.role}：${n.name}（${n.identity}｜与你：${n.relation || "相识"}｜好感 ${n.affinity}｜近况 ${n.mood || "平常"}${mem ? `｜近况记忆：${mem}` : ""}）`;
  });
  return `【本段出场人物】（模板里的「她 / 女主」即主角${playerName}；以下角色须由对应人物出演，口吻、亲疏须与其好感和记忆一致）\n${lines.join("\n")}`;
}
