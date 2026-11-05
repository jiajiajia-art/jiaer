/**
 * 功能注释：对白气泡展示姓名——别名/昵称解析成档案全名（姓+名）。
 * 独立于 npcIdentity，避免单测拖入 mods/registry。
 */
import type { Npc } from "./types";

function norm(name: string | undefined): string {
  return (name ?? "").replace(/[（(][^）)]*[）)]/g, "").replace(/[\s·・.,，。、"'“”‘’「」『』]/g, "").toLowerCase();
}

function findByNameOrAlias(npcs: Npc[], name: string): Npc | undefined {
  const nn = norm(name);
  if (!nn) return undefined;
  return npcs.find((x) => norm(x.name) === nn || (x.aliases ?? []).some((a) => norm(a) === nn));
}

/**
 * 功能注释：说话人展示标签。主角回落主角名；NPC 别名回落档案 name（应含姓+名）。
 */
export function resolveSpeakerLabel(
  speaker: string,
  npcs: Npc[],
  playerName?: string,
): { label: string; npc?: Npc; me: boolean } {
  const raw = (speaker ?? "").trim();
  if (!raw) return { label: "", me: false };
  if (playerName && norm(raw) === norm(playerName)) {
    return { label: playerName, me: true };
  }
  const npc = findByNameOrAlias(npcs, raw);
  if (npc?.name?.trim()) return { label: npc.name.trim(), npc, me: false };
  return { label: raw, me: false };
}

export function sameSpeakerLabel(a: string, b: string, npcs: Npc[], playerName?: string): boolean {
  const la = resolveSpeakerLabel(a, npcs, playerName).label;
  const lb = resolveSpeakerLabel(b, npcs, playerName).label;
  return !!la && norm(la) === norm(lb);
}
