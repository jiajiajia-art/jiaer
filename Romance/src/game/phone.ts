/* ————— 手机系统：仿真通讯（微信/短信/电话）数据模型 + 纯函数 —————
 * 全部数据挂在 GameState.phone 上，随存档持久化（writeSave）。
 * 聊天由 AI 驱动，但「关系/心境/记忆」的落账走这里的确定性 reducer，
 * 与主线同一套好感轴（sim.rel）；单次交流封顶，杜绝凭空拉满。 */
import type { GameState } from "../lib/types";
import { clockLabel, dayDateLabel } from "./logic";
import { PERSON_BY_ID } from "../worlds/star2005/content";

export type ChatStatus = "sending" | "unread" | "read" | "busy";
export type ChatRole = "me" | "npc" | "sys";

export type ChatMsg = {
  id: string;
  role: ChatRole;
  text: string;
  ts: number; // 真实时间戳（排序用）
  gt: number; // 游戏内时间（分钟绝对值：day*1440 + clockMin），插时间胶囊用
  label: string; // 人类可读游戏时间
  status?: ChatStatus;
};

export type Thread = {
  id: string;
  kind: "private" | "group";
  personId?: string; // 私聊对象
  title: string;
  members?: string[]; // 群聊成员 personId
  msgs: ChatMsg[];
  unread: number;
  lastTs: number;
  pinned?: boolean;
};

export type CallRecord = {
  id: string;
  personId?: string;
  name: string;
  number: string;
  ts: number;
  durationSec: number;
  outcome: "connected" | "missed" | "declined";
  transcript?: ChatMsg[]; // 通话中的对话记录（供「通话记录」回看）
};

export type UserComment = { id: string; text: string; ts: number };
export type UserPost = { id: string; text: string; ts: number; likes: number };
export type HeldTicket = { id: string; name: string; poster: string; when: string; venue: string; tier: string; price: number; seat: string; ts: number };

export type PhoneState = {
  contacts: string[]; // 已交换联系方式的 personId
  threads: Thread[];
  calls: CallRecord[];
  seenMoments: number; // 朋友圈已读游标（仅前端体验）
  follows: string[]; // 在社交 App（微博/小红书/抖音）关注的 personId，跨 App 一致且持久
  likes: string[]; // 已点赞的内容 id（稳定 id），跨会话保留
  saves: string[]; // 收藏的内容 id（小红书收藏等），跨会话保留
  comments: Record<string, UserComment[]>; // 按内容 id 存玩家发出的评论，跨会话保留
  posts: Record<string, UserPost[]>; // 玩家在各 App 发布的内容（key: weibo / moments …）
  tickets: HeldTicket[]; // 已购票夹（花了钱就得留下来）
};

/* 单次聊天/通话对好感的封顶（与主线 AFFINITY_TURN_CAP 同理，稍收敛）。 */
export const CHAT_REL_CAP = 6;

/* 号码：由 personId 确定性派生，稳定不变（同一存档同一号码）。 */
export function phoneNumber(personId: string): string {
  let h = 0;
  for (let i = 0; i < personId.length; i++) h = (h * 31 + personId.charCodeAt(i)) >>> 0;
  const a = 130 + (h % 59); // 130~188 号段
  const mid = String(1000 + (Math.floor(h / 97) % 9000));
  const tail = String(1000 + (Math.floor(h / 991) % 9000));
  return `${a} ${mid} ${tail}`;
}

export function emptyPhone(): PhoneState {
  return { contacts: [], threads: [], calls: [], seenMoments: 0, follows: [], likes: [], saves: [], comments: {}, posts: {}, tickets: [] };
}

/* 老档兼容：确保 phone 存在并结构完整。 */
export function ensurePhone(g: GameState): GameState {
  const p = g.phone;
  if (!p || !Array.isArray(p.threads) || !Array.isArray(p.contacts)) {
    return { ...g, phone: emptyPhone() };
  }
  return {
    ...g,
    phone: {
      contacts: p.contacts ?? [],
      threads: p.threads ?? [],
      calls: p.calls ?? [],
      seenMoments: p.seenMoments ?? 0,
      follows: Array.isArray(p.follows) ? p.follows : [],
      likes: Array.isArray(p.likes) ? p.likes : [],
      saves: Array.isArray(p.saves) ? p.saves : [],
      comments: p.comments && typeof p.comments === "object" ? p.comments : {},
      posts: p.posts && typeof p.posts === "object" ? p.posts : {},
      tickets: Array.isArray(p.tickets) ? p.tickets : [],
    },
  };
}

/* 关注/取关某人（微博/小红书/抖音 共用同一份关注关系，跨 App 一致且持久）。 */
export function setFollow(g: GameState, personId: string, on: boolean): GameState {
  const ph = ensurePhone(g).phone!;
  const has = ph.follows.includes(personId);
  if (on === has) return { ...g, phone: ph };
  const follows = on ? [...ph.follows, personId] : ph.follows.filter((id) => id !== personId);
  return { ...g, phone: { ...ph, follows } };
}

/* 点赞/取消点赞某条内容（以稳定 id 记账，跨会话保留）。 */
export function toggleLike(g: GameState, likeId: string): GameState {
  const ph = ensurePhone(g).phone!;
  const has = ph.likes.includes(likeId);
  const likes = has ? ph.likes.filter((id) => id !== likeId) : [...ph.likes, likeId];
  return { ...g, phone: { ...ph, likes } };
}

/* 收藏/取消收藏某条内容（以稳定 id 记账，跨会话保留）。 */
export function toggleSave(g: GameState, saveId: string): GameState {
  const ph = ensurePhone(g).phone!;
  const has = ph.saves.includes(saveId);
  const saves = has ? ph.saves.filter((id) => id !== saveId) : [...ph.saves, saveId];
  return { ...g, phone: { ...ph, saves } };
}

/* 在某条内容下发布一条玩家评论，跨会话保留（按内容 id 归档）。 */
export function addComment(g: GameState, cid: string, text: string): GameState {
  const t = text.trim();
  if (!t) return g;
  const ph = ensurePhone(g).phone!;
  const c: UserComment = { id: msgId(), text: t, ts: Date.now() };
  const comments = { ...ph.comments, [cid]: [c, ...(ph.comments[cid] ?? [])] };
  return { ...g, phone: { ...ph, comments } };
}

/* 发布一条玩家原创内容（微博/朋友圈…），跨会话保留（按 key 归档）。 */
export function addPost(g: GameState, key: string, text: string, likes = 0): GameState {
  const t = text.trim();
  if (!t) return g;
  const ph = ensurePhone(g).phone!;
  const p: UserPost = { id: msgId(), text: t, ts: Date.now(), likes };
  const posts = { ...ph.posts, [key]: [p, ...(ph.posts[key] ?? [])] };
  return { ...g, phone: { ...ph, posts } };
}

/* 出票入夹（购票成功后调用），跨会话保留。 */
export function addTicket(g: GameState, ticket: HeldTicket): GameState {
  const ph = ensurePhone(g).phone!;
  return { ...g, phone: { ...ph, tickets: [ticket, ...ph.tickets].slice(0, 60) } };
}

export function gameMinutes(g: GameState): number {
  const s = g.sim;
  return (s.day ?? 0) * 1440 + (s.clockMin ?? 480);
}
export function gameTimeLabel(g: GameState): string {
  const s = g.sim;
  return `${dayDateLabel(s.day ?? 0)} ${clockLabel(s.clockMin ?? 480)}`;
}

/* 时间分隔判定：跨日 / 相隔 ≥ 90 分钟（约一个时辰）即另起分段。 */
export function needsDivider(prev: ChatMsg | undefined, cur: ChatMsg): boolean {
  if (!prev) return true;
  const prevDay = Math.floor(prev.gt / 1440);
  const curDay = Math.floor(cur.gt / 1440);
  if (prevDay !== curDay) return true;
  return Math.abs(cur.gt - prev.gt) >= 90;
}

let seq = 0;
export function msgId(): string {
  seq = (seq + 1) % 1e6;
  return `m${Date.now().toString(36)}${seq.toString(36)}`;
}

export function threadFor(p: PhoneState, personId: string): Thread | undefined {
  return p.threads.find((t) => t.kind === "private" && t.personId === personId);
}

export function displayName(g: GameState, personId: string): string {
  const npc = g.npcs.find((n) => n.id === personId);
  return npc?.name ?? PERSON_BY_ID[personId]?.name ?? "神秘联系人";
}

/* 开通私聊通道（交换联系方式成功后调用）。已存在则原样返回。 */
export function openThread(g: GameState, personId: string): GameState {
  const ph = ensurePhone(g).phone!;
  if (threadFor(ph, personId)) {
    if (ph.contacts.includes(personId)) return { ...g, phone: ph };
    return { ...g, phone: { ...ph, contacts: [...ph.contacts, personId] } };
  }
  const now = Date.now();
  const t: Thread = {
    id: `th_${personId}`,
    kind: "private",
    personId,
    title: displayName(g, personId),
    msgs: [
      {
        id: msgId(),
        role: "sys",
        text: `你与${displayName(g, personId)}交换了联系方式，可以随时私聊了。`,
        ts: now,
        gt: gameMinutes(g),
        label: gameTimeLabel(g),
      },
    ],
    unread: 0,
    lastTs: now,
  };
  return {
    ...g,
    phone: {
      ...ph,
      contacts: ph.contacts.includes(personId) ? ph.contacts : [...ph.contacts, personId],
      threads: [t, ...ph.threads],
    },
  };
}

/* 追加一条消息到指定会话，返回新 game。 */
export function pushMsg(g: GameState, threadId: string, msg: ChatMsg): GameState {
  const ph = ensurePhone(g).phone!;
  const threads = ph.threads.map((t) =>
    t.id === threadId
      ? {
          ...t,
          msgs: [...t.msgs, msg],
          lastTs: msg.ts,
          unread: msg.role === "npc" ? t.unread + 1 : t.unread,
        }
      : t,
  );
  return { ...g, phone: { ...ph, threads } };
}

/* 更新某条消息状态（如 sending → read）。 */
export function setMsgStatus(g: GameState, threadId: string, msgIds: string[], status: ChatStatus): GameState {
  const ph = ensurePhone(g).phone!;
  const idset = new Set(msgIds);
  const threads = ph.threads.map((t) =>
    t.id === threadId ? { ...t, msgs: t.msgs.map((m) => (idset.has(m.id) ? { ...m, status } : m)) } : t,
  );
  return { ...g, phone: { ...ph, threads } };
}

export function markRead(g: GameState, threadId: string): GameState {
  const ph = ensurePhone(g).phone!;
  const threads = ph.threads.map((t) => (t.id === threadId ? { ...t, unread: 0 } : t));
  return { ...g, phone: { ...ph, threads } };
}

export function togglePinned(g: GameState, threadId: string): GameState {
  const ph = ensurePhone(g).phone!;
  const threads = ph.threads.map((t) => (t.id === threadId ? { ...t, pinned: !t.pinned } : t));
  return { ...g, phone: { ...ph, threads } };
}

export function logCall(g: GameState, rec: CallRecord): GameState {
  const ph = ensurePhone(g).phone!;
  return { ...g, phone: { ...ph, calls: [rec, ...ph.calls].slice(0, 80) } };
}

/* ————— 聊天效果落账：与主线同一套好感轴，单次封顶 —————
 * relDelta：AI 建议的关系变动（钳制到 ±CHAT_REL_CAP）；
 * mood：NPC 新心情；memory：写入互动记录的一句话；
 * moodShift：主角自身压力变动（暖聊降压 / 争执增压）。 */
export function applyChatEffects(
  g: GameState,
  personId: string,
  eff: { relDelta?: number; mood?: string; memory?: string; stressDelta?: number },
): GameState {
  const next = structuredClone(g) as GameState;
  const s = next.sim;
  const npc = next.npcs.find((n) => n.id === personId);
  const cap = personId === "guchen" || personId === "songshixu" ? 1000 : 100;
  if (typeof eff.relDelta === "number" && eff.relDelta !== 0) {
    const d = Math.max(-CHAT_REL_CAP, Math.min(CHAT_REL_CAP, Math.round(eff.relDelta)));
    const before = s.rel[personId] ?? 0;
    const after = Math.max(0, Math.min(cap, before + d));
    const real = after - before;
    if (real !== 0) {
      s.rel[personId] = after;
      if (npc) {
        npc.affinity = Math.max(0, Math.min(100, after));
        npc.affinityHistory.push({ turn: next.turnCount, delta: real, reason: eff.memory || "私聊往来" });
      }
    }
  }
  if (npc) {
    if (eff.mood) npc.mood = eff.mood;
    if (eff.memory) npc.interactions.push({ turn: next.turnCount, time: gameTimeLabel(g), text: eff.memory });
  }
  if (typeof eff.stressDelta === "number" && eff.stressDelta !== 0) {
    s.stress = Math.max(0, Math.min(100, s.stress + Math.round(eff.stressDelta)));
  }
  next.updatedAt = Date.now();
  return next;
}
