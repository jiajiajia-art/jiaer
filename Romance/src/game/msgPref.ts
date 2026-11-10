/* 好友消息权限：玩家逐人设定 TA 能不能主动给自己发消息（存进 phone.msgPref，随存档走）。
 * story  随剧情（默认）：只有线下剧情需要时才会发消息 / 来电，没有随机闲聊；
 * active 主动联系：除剧情外，每到新的一天还可能主动来找你聊天；
 * quiet  不主动发：不会主动发消息、来电或拉你进群，但你找 TA 时照常回复；
 * block  禁止发消息：同「不主动发」，并且群聊里 TA 的发言与好友申请也一并屏蔽。 */
import type { GameState } from "../lib/types";

export type MsgPref = "story" | "active" | "quiet" | "block";
export const MSG_PREFS: { id: MsgPref; label: string; desc: string }[] = [
  { id: "story", label: "随剧情", desc: "只在剧情需要时联系你" },
  { id: "active", label: "主动联系", desc: "剧情之外，也会不时主动找你聊天" },
  { id: "quiet", label: "不主动发", desc: "不会主动发消息或来电，你找 TA 时照常回复" },
  { id: "block", label: "禁止发消息", desc: "完全不给你发消息、来电、群聊发言或好友申请" },
];
export const msgPrefLabel = (p: MsgPref) => MSG_PREFS.find((x) => x.id === p)?.label ?? "随剧情";

export const msgPrefOf = (g: GameState | null | undefined, pid: string): MsgPref => g?.phone?.msgPref?.[pid] ?? "story";
/** 剧情 / 系统能否让 TA 主动联系主角（私聊、来电、发起群聊） */
export const canInitiate = (g: GameState, pid: string) => { const p = msgPrefOf(g, pid); return p === "story" || p === "active"; };
export const isBlocked = (g: GameState, pid: string) => msgPrefOf(g, pid) === "block";

export function setMsgPref(g: GameState, pid: string, pref: MsgPref): GameState {
  const cur = { ...(g.phone?.msgPref ?? {}) };
  if (pref === "story") delete cur[pid]; else cur[pid] = pref;
  return { ...g, phone: { ...g.phone!, msgPref: cur } };
}
