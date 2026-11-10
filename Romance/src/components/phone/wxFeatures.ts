/* 绿信扩展：表情包贴纸 / 气泡样式 / 摇一摇陌生人 / AI 主动发消息 */
import { commTerm, isAncientComm } from "../../lib/commSkin";
import { msgPrefOf } from "../../game/msgPref";
import { loadData, saveData, onClearPlayerMemory, onLoadPlayerData } from "../../lib/saveScope";
import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import { withAlpha, type WxChatStyle } from "./wxSettings";
import { useGame } from "../../store/gameCtx";
import { ensurePhone, openThread, gameNow, gameMinutes, gameTimeLabel, msgId, pushMsg, bpmOf, type ChatMsg, type Thread } from "../../game/phone";
import { requestChatReply } from "../../lib/phoneChat";
import { isConfigured } from "../../lib/ai";
import type { AIConfig, GameState, Npc } from "../../lib/types";
import type { UserPost } from "../../game/phone";
import { wallet } from "../../game/wallet";
import { giftCard, moneyDecision, type Gift } from "../../lib/chatMoney";
import { personGender } from "../../game/relNet";
import { syncJson } from "./worldSync";
import { useWxSettings } from "./wxSettings";
import { liveTerm as T } from "../../mods/live";

/* 扩展消息：kind 区分贴纸 / 相册图片 / 通话记录（老消息无 kind，按原逻辑渲染） */
export type XMsg = ChatMsg & {
  kind?: "sticker" | "photo" | "call" | "voice" | "redpacket" | "transfer" | "recall";
  dur?: number; // 语音秒数
  amount?: number; // 红包 / 转账金额（游戏资金）
  note?: string; // 红包祝福语 / 转账说明
  pstate?: "pending" | "claimed" | "received" | "returned"; // 红包已领取 / 转账已收款 / 对方没收、已退回
  ack?: boolean; // 「已收款」「已退还」回执：只是状态，不是一笔新的钱
  failed?: boolean; // 发送失败（红色叹号，可重发）
  quote?: string; // 引用：「昵称：内容」
};
export type XCustom = NonNullable<Thread["custom"]> & { bubble?: string; muted?: boolean; markUnread?: boolean; hiddenAt?: number };

/* 改写某个会话（消息 / 自定义字段），返回新 game */
export function patchThread(g: GameState, threadId: string, fn: (t: Thread) => Thread): GameState {
  const ph = ensurePhone(g).phone!;
  return { ...g, phone: { ...ph, threads: ph.threads.map((t) => (t.id === threadId ? fn(t) : t)) } };
}
export const patchMsg = (g: GameState, threadId: string, id: string, p: Partial<XMsg>) =>
  patchThread(g, threadId, (t) => ({ ...t, msgs: t.msgs.map((m) => (m.id === id ? ({ ...m, ...p } as ChatMsg) : m)) }));
export const customOf = (t: Thread) => (t.custom ?? {}) as XCustom;

/* 微信式时间：会话列表「刚刚 / HH:mm / 昨天 / 星期X / yy/M/d」，聊天内分隔条带钟点 */
const WEEK = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
const dateAt = (g: GameState, gt: number) => gameNow({ ...g, sim: { ...g.sim, day: Math.floor(gt / 1440), clockMin: ((gt % 1440) + 1440) % 1440 } });
export function wxTime(g: GameState, gt: number, inChat = false): string {
  const now = gameMinutes(g);
  const d = dateAt(g, gt);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const days = Math.floor(now / 1440) - Math.floor(gt / 1440);
  if (days <= 0) return !inChat && now - gt < 2 ? "刚刚" : hm;
  if (days === 1) return inChat ? `昨天 ${hm}` : "昨天";
  if (days < 7) return inChat ? `${WEEK[d.getDay()]} ${hm}` : WEEK[d.getDay()];
  return inChat ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}` : `${String(d.getFullYear()).slice(2)}/${d.getMonth() + 1}/${d.getDate()}`;
}

/* 会话列表预览文字 */
export function msgPreview(m: ChatMsg): string {
  const x = m as XMsg;
  switch (x.kind) {
    case "sticker": return "[动画表情]";
    case "photo": return "[图片]";
    case "voice": return `[语音] ${x.dur ?? 1}"`;
    case "redpacket": return x.pstate === "returned" ? "[红包] 已退回" : `[红包] ${x.note || "恭喜发财，大吉大利"}`;
    case "transfer": return x.pstate === "received" ? "[转账] 已收款" : x.pstate === "returned" ? "[转账] 已退还" : "[转账] 请收款";
    case "call": return "[语音通话]";
    case "recall": return m.text;
  }
  return m.img ? "[屏幕共享]" : m.text;
}

/* ── 新的朋友：NPC 主动发来的好友申请（phone.pending 只记玩家发出的申请）。
 * ensurePhone 会丢弃未知字段，故借用持久化的 phone.posts["wx:incoming"] 存档（id = 对方 pid）。 */
export type FriendReq = { pid: string; text: string; ts: number; state: "pending" | "accepted" | "rejected" };
const REQ_KEY = "wx:incoming";
type ReqRow = UserPost & { state?: FriendReq["state"] };
export function incomingReqs(g: GameState): FriendReq[] {
  const rows = (ensurePhone(g).phone!.posts[REQ_KEY] ?? []) as ReqRow[];
  return rows.map((r) => ({ pid: r.id, text: r.text, ts: r.ts, state: r.state ?? "pending" }));
}
function writeReqs(g: GameState, list: FriendReq[]): GameState {
  const ph = ensurePhone(g).phone!;
  const rows: ReqRow[] = list.slice(0, 40).map((r) => ({ id: r.pid, text: r.text, ts: r.ts, likes: 0, state: r.state }));
  return { ...g, phone: { ...ph, posts: { ...ph.posts, [REQ_KEY]: rows } } };
}
/* 对方发来好友申请：已是好友 / 已有待处理申请则忽略 */
export function addIncomingReq(g: GameState, pid: string, text: string): GameState {
  const ph = ensurePhone(g).phone!;
  const cur = incomingReqs(g);
  if (ph.contacts.includes(pid) || cur.some((r) => r.pid === pid && r.state === "pending")) return g;
  return writeReqs(g, [{ pid, text: text.trim().slice(0, 60) || "你好，加个好友吧", ts: Date.now(), state: "pending" }, ...cur.filter((r) => r.pid !== pid)]);
}
/* 接受：真正加为好友（contacts + 私聊会话），并把验证消息落进会话；拒绝：仅标记 */
export function resolveIncomingReq(g: GameState, pid: string, accept: boolean): GameState {
  const req = incomingReqs(g).find((r) => r.pid === pid);
  if (!req) return g;
  let next = writeReqs(g, incomingReqs(g).map((r) => (r.pid === pid ? { ...r, state: accept ? "accepted" : "rejected" } : r)));
  if (!accept) return next;
  next = openThread(next, pid);
  const ph = ensurePhone(next).phone!;
  const now = Date.now();
  const sysText = "你已添加了对方，现在可以开始聊天了。";
  next = {
    ...next,
    phone: {
      ...ph,
      pending: (ph.pending ?? []).filter((x) => x !== pid),
      contacts: ph.contacts.includes(pid) ? ph.contacts : [...ph.contacts, pid],
      threads: ph.threads.map((t) => (t.kind === "private" && t.personId === pid
        ? { ...t, msgs: [...t.msgs, { id: msgId(), role: "npc" as const, text: req.text, ts: now - 1, gt: gameMinutes(next), label: gameTimeLabel(next) }, { id: msgId(), role: "sys" as const, text: sysText, ts: now, gt: gameMinutes(next), label: gameTimeLabel(next) }], lastTs: now }
        : t)),
    },
  };
  return next;
}

/* NPC 回复里的「[红包 ¥88：xx]」「[转账 ¥100]」「[转账 100 灵石]」转成可领取的红包 / 转账卡片（金额记入当前钱包货币） */
export function moneyFromText(text: string): Partial<XMsg> | null {
  const m = text.trim().match(/^\[(红包|转账)\s*[¥￥]?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|[\u4e00-\u9fa5A-Za-z]{1,4})?(?:[：:]\s*([^\]]*))?\]$/);
  if (!m) return null;
  const red = m[1] === "红包";
  const amount = Math.round(Number(m[2]) * 100) / 100;
  if (!(amount > 0) || amount > (red ? 200 : 50000)) return null;
  const note = (m[3] ?? "").replace(/（.*?）/g, "").trim().slice(0, 20);
  return { kind: red ? "redpacket" : "transfer", amount, note, pstate: "pending", text: red ? note || "恭喜发财，大吉大利" : note };
}

/* ── 聊天里的钱：收不收、发不发由 lib/chatMoney 判定，这里负责落成消息 ── */
/* 收款 / 退还回执（老存档没有 ack 标记，按文字认） */
export const isReceipt = (m: ChatMsg) => !!(m as XMsg).ack || /^已(收款|退还|退回)$/.test(m.text);
/* 还没落定的钱：没领、没收、没退回，也没发送失败（重发的红包没有 pstate，同样算待收） */
export function isPendingMoney(m: ChatMsg): boolean {
  const x = m as XMsg;
  return (x.kind === "redpacket" || x.kind === "transfer") && !x.failed && (x.amount ?? 0) > 0 && !isReceipt(x) && (!x.pstate || x.pstate === "pending");
}
/* 主角给出、对方还没收的最近一笔钱 */
export function pendingMoney(t?: Thread): XMsg | undefined {
  const msgs = t?.msgs ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "me" && isPendingMoney(msgs[i])) return msgs[i] as XMsg;
  return undefined;
}
/* 给 AI 看的一笔钱：「红包 ¥88（恭喜发财）」 */
export const moneyDesc = (g: GameState, m: XMsg) => `${m.kind === "redpacket" ? "红包" : "转账"} ${wallet.fmt(m.amount ?? 0, g)}${m.note ? `（${m.note}）` : ""}`;

/* TA 当场发给主角的钱 → 一张待领取的卡片；金额、频率、父母规则由 chatMoney.giftCard 校正，不该发 → null。group：群聊里记下发言人 */
export function giftMsg(g: GameState, pid: string, gift?: Gift, group = false): XMsg | null {
  const c = gift ? giftCard(g, pid, gift) : null;
  if (!c) return null;
  return { id: msgId(), role: "npc", ...(group ? { from: pid } : {}), text: c.text, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g), kind: c.kind, amount: c.amount, note: c.note, pstate: "pending" };
}

/* 主角给出的钱落定：take → 红包已领取（names 里的人逐个领取）/ 转账已收款；否则原路退回钱包（names 为空：超时没人收，自动退回）。
 * 只结算还没落定的：连发几条、几路回复同时表态时不会重复入账或重复退款 */
export function settleMoney(g: GameState, threadId: string, id: string, take: boolean, names: string[]): GameState {
  const x = ensurePhone(g).phone!.threads.find((t) => t.id === threadId)?.msgs.find((m) => m.id === id) as XMsg | undefined;
  if (!x || x.role !== "me" || !isPendingMoney(x)) return g;
  const red = x.kind === "redpacket";
  const amt = x.amount ?? 0;
  const at = { ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g) };
  const receipt = (text: string, pstate: XMsg["pstate"]): XMsg => ({ id: msgId(), role: "npc", text, ...at, kind: "transfer", amount: amt, pstate, ack: true });
  if (!take) {
    const y = wallet.add(patchMsg(g, threadId, id, { pstate: "returned" }), amt);
    return red
      ? pushMsg(y, threadId, { id: msgId(), role: "sys", text: names.length ? `${names[0]}没有收下你的红包，${wallet.fmt(amt, y)}已退回` : `红包超过一天没人领，${wallet.fmt(amt, y)}已退回`, ...at })
      : pushMsg(y, threadId, receipt("已退还", "returned"));
  }
  const y = patchMsg(g, threadId, id, { pstate: red ? "claimed" : "received" });
  if (!red) return pushMsg(y, threadId, receipt("已收款", "received"));
  return names.reduce((acc, n) => pushMsg(acc, threadId, { id: msgId(), role: "sys", text: `${n}领取了你的红包`, ...at }), y);
}

/* 通讯录拼音首字母（借助 ICU 拼音排序的分界字） */
const PY_BOUND = "阿八嚓哒妸发旮哈讥咔垃妈拏噢妑七呥仨它穵夕丫帀";
const PY_LETTERS = "ABCDEFGHJKLMNOPQRSTWXYZ";
const zh = new Intl.Collator("zh-CN");
export function initialOf(name: string): string {
  const c = name.trim()[0] ?? "#";
  if (/[a-z]/i.test(c)) return c.toUpperCase();
  if (!/[\u4e00-\u9fff]/.test(c)) return "#";
  let k = -1;
  for (let i = 0; i < PY_BOUND.length; i++) if (zh.compare(c, PY_BOUND[i]) >= 0) k = i;
  return k >= 0 ? PY_LETTERS[k] : "#";
}
export const zhCompare = zh.compare;

/* 收藏：长按消息「收藏」，在「我 → 收藏」查看 */
export type FavItem = { id: string; from: string; text: string; img?: string; ts: number };
const FAV_KEY = "star2005.wx.favs";
let favs: FavItem[] = loadData<FavItem[]>(FAV_KEY, []);
const favSubs = new Set<() => void>();
function saveFavs(next: FavItem[]) {
  favs = next;
  saveData(FAV_KEY, favs);
  favSubs.forEach((f) => f());
}
export const addFav = (f: FavItem) => saveFavs([f, ...favs.filter((x) => x.id !== f.id)].slice(0, 200));
export const removeFav = (id: string) => saveFavs(favs.filter((x) => x.id !== id));
export function useFavs(): FavItem[] {
  return useSyncExternalStore((f) => { favSubs.add(f); return () => { favSubs.delete(f); }; }, () => favs);
}

/* ── 表情包：SVG 贴纸（emoji + 配字，渲染为图片消息） ── */
const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
function stickerSvg(emoji: string, caption: string, c1: string, c2: string) {
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="8" y="8" width="224" height="224" rx="44" fill="url(#g)"/><text x="120" y="138" font-size="108" text-anchor="middle">${emoji}</text><text x="120" y="206" font-size="30" font-weight="700" text-anchor="middle" fill="#fff" stroke="#3a2a3a" stroke-width="5" paint-order="stroke" font-family="sans-serif">${caption}</text></svg>`);
}
export const STICKER_SET: { id: string; name: string; src: string }[] = [
  ["🐱", "贴贴", "#ffd6e7", "#ff9ec4"], ["🐶", "在吗", "#d6ecff", "#8ec5ff"], ["🥺", "求求了", "#fff1c9", "#ffcf6e"],
  ["😤", "哼！", "#ffd9d0", "#ff8a73"], ["🤣", "笑死", "#e3ffd6", "#8fe07a"], ["😴", "晚安", "#e4dcff", "#a996ff"],
  ["🥰", "爱你", "#ffe0ec", "#ff7fa8"], ["🙄", "无语", "#e9eef3", "#a8b6c4"], ["👌", "收到", "#d9fff3", "#5fd8b0"],
  ["🍵", "喝茶", "#eef6d8", "#b6d36b"], ["😭", "哭哭", "#d8f0ff", "#62b7f5"], ["🎉", "冲鸭", "#fff0d6", "#ffb257"],
  ["🙈", "害羞", "#ffe6dc", "#ffa98a"], ["💪", "加油", "#ffe3d3", "#ff9a5a"], ["🌹", "送你", "#ffd8de", "#ef5a77"],
  ["🤔", "嗯？", "#f1e8ff", "#c19bff"],
].map(([e, n, a, b], i) => ({ id: `st${i}`, name: n, src: stickerSvg(e, n, a, b) }));

/* ── 聊天气泡样式 ── */
/* 聊天背景预设（纯 CSS，无外链素材） */
export const CHAT_BGS: { id: string; label: string; css: string; ancient?: boolean }[] = [
  { id: "", label: "默认", css: "var(--wx-chat-bg, #ededed)" },
  { id: "peach", label: "蜜桃", css: "linear-gradient(160deg,#ffe4e1,#fff5ee)" },
  { id: "lilac", label: "薰衣草", css: "linear-gradient(160deg,#e9e1ff,#f7f2ff)" },
  { id: "mint", label: "薄荷", css: "linear-gradient(160deg,#dff7ec,#f3fff9)" },
  { id: "sky", label: "晴空", css: "linear-gradient(160deg,#dcecff,#f4f9ff)" },
  { id: "night", label: "星夜", css: "radial-gradient(circle at 20% 15%,#ffffff22 0 1px,transparent 2px),radial-gradient(circle at 70% 40%,#ffffff22 0 1px,transparent 2px),linear-gradient(180deg,#2b2d4a,#4a3d63)" },
  { id: "dots", label: "波点", css: "radial-gradient(#ffc0cb66 1.5px,transparent 1.5px) 0 0/16px 16px,#fffafa" },
  // 功能注释：古风背景只在「传讯」皮肤下可选；已选过的旧存档在现代皮肤下仍能正常显示
  { id: "shanshui", label: "水墨山水", ancient: true, css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 640' preserveAspectRatio='xMidYMax slice'%3E%3Cpath d='M0 470 C60 420 90 380 140 400 S230 330 280 360 S340 340 360 350 V640 H0Z' fill='%23574a3a' opacity='.10'/%3E%3Cpath d='M0 530 C50 490 110 470 160 500 S250 450 300 480 S350 470 360 475 V640 H0Z' fill='%233e3428' opacity='.16'/%3E%3Cpath d='M0 590 C70 560 120 570 180 585 S280 560 360 575 V640 H0Z' fill='%232b2118' opacity='.22'/%3E%3Ccircle cx='280' cy='120' r='34' fill='%23b5432f' opacity='.16'/%3E%3Cpath d='M60 200 q20 -8 40 0 M90 225 q14 -6 28 0' stroke='%233e3428' stroke-width='1.6' fill='none' opacity='.3'/%3E%3C/svg%3E") center bottom/cover no-repeat,#f2e8d3` },
  { id: "zhuying", label: "竹影", ancient: true, css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 640' preserveAspectRatio='xMidYMax slice'%3E%3Crect x='30' y='0' width='9' height='640' fill='%234f6b4a' opacity='0.14'/%3E%3Crect x='29' y='60' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='29' y='170' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='29' y='280' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='29' y='390' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='29' y='500' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='29' y='610' width='11' height='3' fill='%233f5a3b' opacity='0.14'/%3E%3Crect x='78' y='0' width='6' height='640' fill='%234f6b4a' opacity='0.1'/%3E%3Crect x='77' y='60' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='77' y='170' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='77' y='280' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='77' y='390' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='77' y='500' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='77' y='610' width='8' height='3' fill='%233f5a3b' opacity='0.1'/%3E%3Crect x='300' y='0' width='11' height='640' fill='%234f6b4a' opacity='0.16'/%3E%3Crect x='299' y='60' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='299' y='170' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='299' y='280' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='299' y='390' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='299' y='500' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='299' y='610' width='13' height='3' fill='%233f5a3b' opacity='0.16'/%3E%3Crect x='330' y='0' width='6' height='640' fill='%234f6b4a' opacity='0.09'/%3E%3Crect x='329' y='60' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Crect x='329' y='170' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Crect x='329' y='280' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Crect x='329' y='390' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Crect x='329' y='500' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Crect x='329' y='610' width='8' height='3' fill='%233f5a3b' opacity='0.09'/%3E%3Cpath d='M39 140 q30 -6 52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M39 150 q30 -6 52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M84 330 q30 -6 52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M300 220 q-30 -6 -52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M300 232 q-30 -6 -52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M300 470 q-30 -6 -52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3Cpath d='M39 520 q30 -6 52 8' stroke='%234f6b4a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.16'/%3E%3C/svg%3E") center/cover no-repeat,#f2e8d3` },
  { id: "meihua", label: "梅花", ancient: true, css: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 360 640' preserveAspectRatio='xMidYMax slice'%3E%3Cpath d='M360 40 C300 70 260 60 220 110 S170 170 120 180 M250 90 C240 130 260 150 250 190 M180 150 C190 120 170 100 160 80' stroke='%233a2a1a' stroke-width='5' stroke-linecap='round' fill='none' opacity='.55'/%3E%3Cg transform='translate%28222 110%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28255 150%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28170 100%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28130 178%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28300 72%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28250 190%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3Cg transform='translate%28190 140%29' opacity='.75'%3E%3Ccircle cx='0' cy='-5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-3' cy='4.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle cx='-5' cy='-1.5' r='4.5' fill='%23c2443a'/%3E%3Ccircle r='2' fill='%23f2c96b'/%3E%3C/g%3E%3C/svg%3E") right top/cover no-repeat,#f2e8d3` },
];
/** 背景选择器的可选项：古风皮肤显示古风背景，现代皮肤隐藏 */
export const chatBgOptions = () => CHAT_BGS.filter((b) => !b.ancient || isAncientComm());
export const bgCss = (bg?: string) => (bg?.startsWith("data:") ? `center/cover no-repeat url(${bg})` : CHAT_BGS.find((b) => b.id === (bg ?? ""))?.css ?? CHAT_BGS[0].css);

export type BubbleStyle = { id: string; label: string; me: string; meStyle?: CSSProperties; them: string; themStyle?: CSSProperties; tail: boolean };
export const BUBBLE_STYLES: BubbleStyle[] = [
  { id: "classic", label: "经典绿", me: "bg-[#95ec69] text-[#1a1a1a]", them: "bg-white text-[#1a1a1a]", tail: true },
  { id: "cream", label: "奶油", me: "bg-[#fff1d6] text-[#5a4320] shadow-sm", them: "bg-[#fffaf0] text-[#5a4320] shadow-sm", tail: false },
  { id: "pink", label: "渐变粉", me: "text-white shadow", meStyle: { background: "linear-gradient(135deg,#ff8fb1,#c86bff)" }, them: "bg-white text-[#1a1a1a] shadow-sm", tail: false },
  { id: "line", label: "极简描边", me: "border border-[#07c160] bg-transparent text-[#07a050]", them: "border border-black/25 bg-transparent text-[#1a1a1a]", tail: false },
  { id: "frost", label: "磨砂玻璃", me: "border-[1.5px] border-[#8fa8cc]/70 text-[#34445f] backdrop-blur-md", meStyle: { background: "rgba(236,243,255,0.72)" }, them: "border-[1.5px] border-[#8fa8cc]/70 text-[#34445f] backdrop-blur-md", themStyle: { background: "rgba(255,255,255,0.7)" }, tail: false },
  { id: "dark", label: "暗夜", me: "bg-[#2b2f3a] text-[#e8ecf5]", them: "bg-[#3d4250] text-[#e8ecf5]", tail: false },
];
export const bubbleStyleOf = (id?: string) => BUBBLE_STYLES.find((b) => b.id === id) ?? BUBBLE_STYLES[0];

/** 聊天外观：全局「聊天样式」+ 会话自定义（会话优先）→ 气泡类名 / 内联样式 / 背景 / 头像圆角 */
export function chatLook(g: WxChatStyle, threadCustom?: { bubble?: string; bg?: string }) {
  const b = bubbleStyleOf(threadCustom?.bubble ?? g.bubble);
  const tail = b.tail && g.radius <= 6 && !g.border && !g.meColor && !g.themColor;
  const cls = (mine: boolean) => `${tail ? `wx-bubble ${mine ? "wx-bubble-right" : "wx-bubble-left"}` : ""} px-3 py-[9px] ${mine ? b.me : b.them}`;
  const style = (mine: boolean, fontPx?: number): CSSProperties => {
    const col = mine ? g.meColor : g.themColor, txt = mine ? g.meText : g.themText;
    return {
      ...(fontPx ? { fontSize: fontPx } : {}),
      ...(mine ? b.meStyle : b.themStyle),
      borderRadius: g.radius,
      ...(col ? { background: withAlpha(col, g.alpha) } : {}),
      ...(txt ? { color: txt } : {}),
      ...(g.border ? { border: `1.5px solid ${g.borderColor}` } : {}),
      ...(g.alpha < 100 && col ? { backdropFilter: "blur(8px)" } : {}),
    };
  };
  return { bubble: b, cls, style, bg: bgCss(threadCustom?.bg ?? (g.chatBg || undefined)), avatarRadius: g.avatarRadius };
}

/* ── 陌生人（摇一摇）：资料存 localStorage，会话/联系人存 game.phone ── */
export type Stranger = { id: string; name: string; age: number; gender: "男" | "女"; occupation: string; persona: string; signature: string; avatar: string; mem: string[] };
const ST_KEY = "star2005.wx.strangers";
function loadSt(): Record<string, Stranger> {
  return loadData<Record<string, Stranger>>(ST_KEY, {}) || {};
}
let strangers = loadSt();
const stSubs = new Set<() => void>();
function saveSt() {
  saveData(ST_KEY, strangers);
  stSubs.forEach((f) => f());
}
// 切档：清空模块级缓存（收藏 / 陌生人），新存档激活后从其专属数据重新装载
onClearPlayerMemory(() => { favs = []; strangers = {}; favSubs.forEach((f) => f()); stSubs.forEach((f) => f()); });
onLoadPlayerData(() => { favs = loadData<FavItem[]>(FAV_KEY, []); strangers = loadSt(); favSubs.forEach((f) => f()); stSubs.forEach((f) => f()); });
export const isStrangerId = (pid?: string) => !!pid && pid.startsWith("stg_");
export const getStranger = (pid?: string): Stranger | undefined => (pid ? strangers[pid] : undefined);
/* 说话人性别（朗读挑男女声用）：陌生人看自身设定，其余走人物档案 personGender（玩家覆盖 → 家人 → 内容池 → 花名册）。
 * 不能只读 persona.gender：那是人物卡上手填的覆盖项，内置人物默认都没填，会被一律当成女声 */
export const speakerGender = (g: GameState, pid?: string): string | undefined => (pid ? getStranger(pid)?.gender ?? personGender(g, pid) : undefined);
export function useStrangers(): Record<string, Stranger> {
  return useSyncExternalStore((f) => { stSubs.add(f); return () => { stSubs.delete(f); }; }, () => strangers);
}
export function saveStranger(s: Stranger) { strangers = { ...strangers, [s.id]: s }; saveSt(); }
export function addStrangerMemory(pid: string, mem?: string) {
  const s = strangers[pid];
  if (!s || !mem) return;
  saveStranger({ ...s, mem: [...s.mem, mem].slice(-8) });
}

const AV_COLORS = [["#ffd1dc", "#ff8fab"], ["#cde7ff", "#6fb1ff"], ["#d9f7d6", "#6ccf7d"], ["#fff0c2", "#ffc24b"], ["#e6dcff", "#9c7bff"], ["#ffe0cc", "#ff9966"], ["#d4f4f2", "#4fc3bd"], ["#f0e0d0", "#b98a62"]];
const AV_FACES = ["👩", "👨", "👱‍♀️", "🧑", "👩‍🦰", "👨‍🦱", "🧔", "👩‍🎤", "👨‍🎨", "👩‍💼", "🧑‍🍳", "👨‍💻"];
export const AVATAR_POOL: string[] = AV_FACES.map((f, i) => {
  const [a, b] = AV_COLORS[i % AV_COLORS.length];
  return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><text x="60" y="84" font-size="66" text-anchor="middle">${f}</text></svg>`);
});


function newStrangerId() { return `stg_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`; }

export async function generateStranger(cfg: AIConfig, game: GameState): Promise<Stranger> {
  const avatarIdx = Math.floor(Math.random() * AVATAR_POOL.length);
  const r = await syncJson<{ name?: unknown; age?: unknown; gender?: unknown; occupation?: unknown; persona?: unknown; signature?: unknown; avatar?: unknown }>(
    cfg, game, "wx_shake", `${commTerm("app")}·摇一摇`,
    `「摇一摇」随机匹配到一位${T("city")}的普通陌生人（不是已有的圈内人物，不要与之重名）。返回 {"name":"中文姓名","age":18~40的整数,"gender":"男或女","occupation":"职业","persona":"≤60字的性格与说话风格","signature":"≤20字个性签名","avatar":0~${AVATAR_POOL.length - 1}的整数头像编号}。每次风格要不同。`,
  ).catch(() => null);
  const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  if (r && str(r.name, 8)) {
    const age = Math.round(Number(r.age));
    const av = Math.round(Number(r.avatar));
    return {
      id: newStrangerId(), name: str(r.name, 8), age: age >= 16 && age <= 60 ? age : 24, gender: r.gender === "男" ? "男" : "女",
      occupation: str(r.occupation, 16) || "自由职业", persona: str(r.persona, 120) || "随和健谈", signature: str(r.signature, 30) || "你好呀",
      avatar: AVATAR_POOL[av >= 0 && av < AVATAR_POOL.length ? av : avatarIdx], mem: [],
    };
  }
  // 没有 AI / 生成失败：不拿预设人物顶替
  throw new Error(isConfigured(cfg) ? "附近暂时没人，再摇一次试试" : "接入 AI 后才能摇到附近的人");
}

/* 把陌生人包装成临时 Npc，复用 requestChatReply 的人设扮演 */
export function strangerNpc(s: Stranger): Npc {
  return {
    id: s.id, name: s.name, age: String(s.age), identity: s.occupation, relation: "摇一摇认识的网友", avatar: s.avatar,
    bio: `${s.age} 岁，${s.occupation}。个性签名：${s.signature}`, mood: "平常", affinity: 0, dims: [], tags: ["网友"], attrs: [],
    affinityHistory: [], interactions: s.mem.map((t) => ({ turn: 0, time: "", text: t })),
    persona: { gender: s.gender, text: `${s.persona}（你们只是通过「摇一摇」认识的陌生网友，并非${T("industry")}中人，聊天要符合刚认识的分寸）` },
  } as Npc;
}
/* AI 视角的游戏：补入陌生人；并把贴纸 / 相册图片换成文字占位，避免误当「屏幕共享」 */
export function aiView(g: GameState, thread?: Thread): { g: GameState; thread?: Thread } {
  let gg = g;
  const s = getStranger(thread?.personId);
  if (s && !g.npcs.some((n) => n.id === s.id)) gg = { ...g, npcs: [...g.npcs, strangerNpc(s)] };
  const t = thread && {
    ...thread,
    msgs: thread.msgs.filter((m) => (m as XMsg).kind !== "recall").map((m) => {
      const x = m as XMsg;
      if (x.kind === "voice") return { ...m, text: `[语音消息] ${m.text}` };
      if (x.kind === "redpacket" || x.kind === "transfer") {
        // 钱的状态一并写清：AI 才知道哪笔还没收、哪笔被退回了（抄回状态文字也不会被当成一笔新的钱）
        const red = x.kind === "redpacket";
        const st = x.failed ? "（没发出去）"
          : x.pstate === "returned" ? (red ? "（没领，已退回）" : "（已退还）")
          : x.pstate === "claimed" ? "（已领取）" : x.pstate === "received" ? "（已收款）"
          : isReceipt(x) ? "" : red ? "（还没领）" : "（还没收）";
        return { ...m, text: `[${red ? "红包" : "转账"} ${wallet.fmt(x.amount ?? 0, g)}${x.note ? "：" + x.note : ""}${st}]` };
      }
      if (x.kind === "sticker") return { ...m, img: undefined, text: `[表情包：${m.text}]` };
      if (x.kind === "photo") return { ...m, img: undefined, text: `[图片]${m.text ? " " + m.text : ""}` };
      return m;
    }),
  };
  return { g: gg, thread: t };
}

/* ── AI 主动发消息 ── */
const LAST_KEY = "star2005.wx.proactive.last";
const MIN_GAP = 4 * 60 * 1000; // 至少间隔 4 分钟（真实时间）
const getLast = () => Number(loadData<number>(LAST_KEY, 0)) || 0;
const setLast = (t: number) => { saveData(LAST_KEY, t); };


export function useProactiveMessages() {
  const { game, cfg, commitGame } = useGame();
  const { proactive } = useWxSettings();
  const gRef = useRef(game);
  gRef.current = game;
  const busy = useRef(false);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  async function fire(chance: number) {
    const g0 = gRef.current;
    if (!g0 || busy.current || Date.now() - getLast() < MIN_GAP || Math.random() > chance) return;
    const ph = ensurePhone(g0).phone!;
    // 只有玩家设为「主动联系」的好友才会在剧情之外主动来消息；其余人只随剧情（phoneLink）联络
    const pool = ph.threads.filter((t) => t.kind === "private" && t.personId && msgPrefOf(g0, t.personId) === "active" && ((g0.npcs.some((n) => n.id === t.personId) && ph.contacts.includes(t.personId!)) || getStranger(t.personId)));
    if (!pool.length) return;
    const w = pool.map((t) => Math.max(1, (g0.sim.rel[t.personId!] ?? 0) + 5));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    let th = pool[0];
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { th = pool[i]; break; } }
    busy.current = true;
    setLast(Date.now());
    let bubbles: string[] = [];
    let emo: XMsg["emo"];
    let os: string | undefined;
    let gift: Gift | undefined;
    let verdict: "accept" | "refuse" | undefined;
    // 主角给 TA、TA 还没收的钱（之前在忙没顾上）：主动来消息时顺带表态
    const ask = pendingMoney(th);
    try {
      if (isConfigured(cfgRef.current)) {
        const v = aiView(g0, th);
        const rep = await requestChatReply(cfgRef.current, v.g, v.thread!, "【系统提示，非主角发言】主角此刻没有给你发消息。请结合当前剧情、你的心情和你们的过往，由你主动给她发 1~2 条微信（问候、分享近况、找她有事或想她都行），自然不突兀。read_only 与 busy 必须为 false。", undefined, ask ? { money: moneyDesc(g0, ask) } : undefined);
        bubbles = rep.bubbles.slice(0, 2);
        emo = rep.emotion;
        os = rep.inner_os;
        gift = rep.gift;
        if (ask) verdict = moneyDecision(rep.accept_money, bubbles.join("\n"), false);
      }
    } catch { /* 失败则本次不发 */ }
    // 未接入 AI / 生成失败：不发套话消息，静默跳过
    if (!bubbles.length && !gift && !verdict) { busy.current = false; return; }
    let g = gRef.current!;
    if (!ensurePhone(g).phone!.threads.some((t) => t.id === th.id)) { busy.current = false; return; }
    bubbles.forEach((b, i) => {
      g = pushMsg(g, th.id, { id: msgId(), role: "npc", text: b, ts: Date.now() + i, gt: gameMinutes(g), label: gameTimeLabel(g), ...(emo && i === bubbles.length - 1 ? { emo, bpm: bpmOf(emo) } : {}), ...(os && i === bubbles.length - 1 ? { os } : {}) });
    });
    // TA 主动发来的红包 / 转账（经 chatMoney 校正）；对之前那笔钱的表态（收下 / 退回）
    const card = giftMsg(g, th.personId!, gift);
    if (card) g = pushMsg(g, th.id, card);
    if (ask && verdict) g = settleMoney(g, th.id, ask.id, verdict === "accept", [g.npcs.find((n) => n.id === th.personId)?.name ?? getStranger(th.personId)?.name ?? th.title]);
    commitGame(g);
    busy.current = false;
  }

  // 不再按真实时间定时乱发：只在游戏内进入新的一天时，按概率让「主动联系」的好友来消息
  // 主线推进（回合 / 天数变化）：较高概率触发
  const stamp = game ? `${game.sim.day}` : "";
  useEffect(() => {
    const SK = "star2005.wx.proactive.stamp";
    let prev = "";
    prev = loadData<string>(SK, ""); saveData(SK, stamp);
    if (!stamp || !prev || prev === stamp) return;
    if (proactive) void fire(0.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, proactive]);
}
