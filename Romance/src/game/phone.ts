import { affinityCapOf } from "../worlds/star2005/content";
/* ————— 手机系统：仿真通讯（微信/短信/电话）数据模型 + 纯函数 —————
 * 全部数据挂在 GameState.phone 上，随存档持久化（writeSave）。
 * 聊天由 AI 驱动，但「关系/心境/记忆」的落账走这里的确定性 reducer，
 * 与主线同一套好感轴（sim.rel）；单次交流封顶，杜绝凭空拉满。 */
import type { GameState } from "../lib/types";
import { canRomance, clockLabel, dayDateLabel, dayParts } from "./logic";
import { LIVE_PERSON_BY_ID as PERSON_BY_ID } from "../mods/registry";
import { joinGroupMem, remember } from "./npcKnowledge";
import { blankRel, ensureRelations } from "./relations";
import { romanticCapOf } from "../worlds/star2005/content";

import { lastOf } from "../lib/lastOf.ts";
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
  emo?: EmotionId; // 人设回复时的情绪
  bpm?: number; // 对应心跳
  os?: string; // 内心独白（UI 用 InnerOsLabel，禁止 Emoji）
  from?: string; // 群聊里发言人的 personId
  img?: string; // 屏幕共享 / 相册图片（已压缩的 dataURL）
};

/**
 * 人设情绪 → 心跳区间（BPM）。
 * icon：对应 EmotionIcon 映射键（线性 SVG），禁止再用 emoji 字段。
 */
export const EMOTIONS = {
  possessive: { label: "霸道占有", icon: "flame", range: [115, 135], hint: "强烈独占欲/查岗" },
  jealous: { label: "醋坛子打翻", icon: "frown", range: [105, 130], hint: "吃醋" },
  shy: { label: "心动害羞", icon: "blush", range: [100, 128], hint: "小鹿乱撞/被撩到" },
  tsundere: { label: "傲娇嘴硬", icon: "meh", range: [95, 118], hint: "口是心非/小脾气" },
  clingy: { label: "想念黏人", icon: "heart", range: [96, 120], hint: "时刻想黏着你/催促" },
  ecstatic: { label: "兴奋狂喜", icon: "spark", range: [115, 140], hint: "激动惊喜" },
  happy: { label: "欣喜开心", icon: "smile", range: [88, 110], hint: "心情甜滋滋" },
  worried: { label: "担心牵挂", icon: "cloud", range: [75, 90], hint: "心里挂念" },
  sad: { label: "委屈难过", icon: "droplet", range: [65, 80], hint: "小失落/需要哄" },
  calm: { label: "平静温和", icon: "leaf", range: [72, 85], hint: "日常放松" },
  surprised: { label: "惊讶", icon: "zap", range: [100, 125], hint: "没想到/吓一跳" },
  confused: { label: "困惑", icon: "help", range: [74, 88], hint: "看不懂/想问清楚" },
  curious: { label: "好奇", icon: "search", range: [82, 100], hint: "想知道更多" },
  moved: { label: "感动", icon: "heartHandshake", range: [90, 112], hint: "被触动/眼眶发热" },
} as const;
export type EmotionId = keyof typeof EMOTIONS;
export const isEmotion = (x: unknown): x is EmotionId => typeof x === "string" && x in EMOTIONS;
export function bpmOf(e: EmotionId): number {
  const [a, b] = EMOTIONS[e].range;
  return Math.round(a + Math.random() * (b - a));
}

/* 单个聊天的自定义：聊天背景（人设/性别/口吻统一在「固定人物」编辑器，存在 npc.persona） */
export type ThreadCustom = { bg?: string };

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
  custom?: ThreadCustom;
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
  contacts: string[]; // 已交换联系方式的 personId（= 微信好友 friend）
  pending?: string[]; // 已发出微信好友申请、对方尚未处理（pending）
  threads: Thread[];
  calls: CallRecord[];
  seenMoments: number; // 朋友圈已读游标（仅前端体验）
  follows: string[]; // 在社交 App（微博/小红书/抖音）关注的 personId，跨 App 一致且持久
  likes: string[]; // 已点赞的内容 id（稳定 id），跨会话保留
  saves: string[]; // 收藏的内容 id（小红书收藏等），跨会话保留
  comments: Record<string, UserComment[]>; // 按内容 id 存玩家发出的评论，跨会话保留
  posts: Record<string, UserPost[]>; // 玩家在各 App 发布的内容（key: weibo / moments …）
  tickets: HeldTicket[]; // 已购票夹（花了钱就得留下来）
  // —— 线上 ↔ 线下联动（见 game/phoneLink.ts）——
  acts?: PhoneAct[]; // 主角的手机操作流水：每回合把未同步的部分发给线下剧情
  npcNet?: NpcNetAct[]; // 角色在网上的足迹（发帖 / 评论 / 写书…），角色本人记得
  mails?: Mail[]; // 邮箱
  removed?: RemovedFriend[]; // 被主角删除的好友（线下剧情会对此做出反应）
  ringing?: IncomingCall; // 线下剧情触发的来电（等待主角接听）
  msgPref?: Record<string, import("./msgPref").MsgPref>; // 好友消息权限（缺省 = 随剧情），见 game/msgPref.ts
};

export type PhoneAct = { id: string; gt: number; label: string; app: string; text: string; pid?: string; min: number; sent?: boolean; key?: string };
export type NpcNetAct = { id: string; gt: number; label: string; pid: string; app: string; text: string };
export type Mail = {
  id: string; gt: number; label: string; ts: number;
  from: string; // 发件人 personId；机构 / 平台邮件为显示名
  fromName: string;
  to: string; // "me" 或收件人 personId
  toName?: string;
  subject: string; body: string;
  read?: boolean;
  replyTo?: string; // 回复的是哪封
  awaiting?: boolean; // 主角发给角色、对方尚未回复
  kind?: "person" | "org";
};
export type RemovedFriend = { pid: string; gt: number; label: string; reacted?: boolean };
export type IncomingCall = { id: string; pid: string; name: string; video?: boolean; reason: string; gt: number };

/* 单次聊天/通话对好感的封顶（与主线 AFFINITY_TURN_CAP 同理，稍收敛）。 */
export const CHAT_REL_CAP = 6;
/* 单次聊天/通话对爱慕（心动轴）的封顶：比「主动联系」的 +2 略高，留给真正心动的时刻。 */
export const CHAT_LOVE_CAP = 3;
/* 同一人每个游戏日经聊天 / 语音 / 当面交谈最多涨的爱慕（下降不限）：聊天不耗时，没有日上限就能连发撩拨刷满 */
export const CHAT_LOVE_DAILY = 6;

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
      pending: Array.isArray(p.pending) ? p.pending : [],
      threads: p.threads ?? [],
      calls: p.calls ?? [],
      seenMoments: p.seenMoments ?? 0,
      follows: Array.isArray(p.follows) ? p.follows : [],
      likes: Array.isArray(p.likes) ? p.likes : [],
      saves: Array.isArray(p.saves) ? p.saves : [],
      comments: p.comments && typeof p.comments === "object" ? p.comments : {},
      posts: p.posts && typeof p.posts === "object" ? p.posts : {},
      tickets: Array.isArray(p.tickets) ? p.tickets : [],
      ...(Array.isArray(p.acts) ? { acts: p.acts } : {}),
      ...(Array.isArray(p.npcNet) ? { npcNet: p.npcNet } : {}),
      ...(Array.isArray(p.mails) ? { mails: p.mails } : {}),
      ...(Array.isArray(p.removed) ? { removed: p.removed } : {}),
      ...(p.ringing ? { ringing: p.ringing } : {}),
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
  return npc?.name ?? PERSON_BY_ID[personId]?.name ?? g.sim?.npcs?.find((n) => n.id === personId)?.name ?? "神秘联系人";
}

/* 建群：把若干联系人拉进同一个群聊 */
export function createGroup(g: GameState, members: string[], title?: string): { g: GameState; id: string } {
  const ph = ensurePhone(g).phone!;
  const now = Date.now();
  const id = `grp_${now.toString(36)}`;
  const names = members.map((m) => displayName(g, m));
  const t: Thread = {
    id,
    kind: "group",
    title: title?.trim() || `${names.slice(0, 3).join("、")}${names.length > 3 ? "…" : ""}（${members.length + 1}）`,
    members,
    msgs: [{ id: msgId(), role: "sys", text: `你邀请${names.join("、")}加入了群聊`, ts: now, gt: gameMinutes(g), label: gameTimeLabel(g) }],
    unread: 0,
    lastTs: now,
  };
  return { g: { ...g, phone: { ...ph, threads: [t, ...ph.threads] } }, id };
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
export function pushMsg(g: GameState, threadId: string, msg0: ChatMsg): GameState {
  const ph = ensurePhone(g).phone!;
  const threads = ph.threads.map((t) => {
    if (t.id !== threadId) return t;
    // 聊天时游戏时钟不走：消息时间 = 上一条时间 + 真实流逝（≤3 小时，回复至少 +1 分钟），且不早于游戏时钟。
    // 这样隔一阵再聊会自然出现时间分隔，标签仍是游戏内钟点
    const last = t.msgs[t.msgs.length - 1];
    let msg = msg0;
    if (last && typeof last.gt === "number" && typeof msg0.gt === "number") {
      const real = Math.max(0, Math.round((msg0.ts - last.ts) / 60000));
      const gt = Math.max(msg0.gt, last.gt + Math.max(msg0.role === "npc" ? 1 : 0, Math.min(real, 180)));
      if (gt !== msg0.gt) msg = { ...msg0, gt, label: `${dayDateLabel(Math.floor(gt / 1440))} ${clockLabel(gt % 1440)}` };
    }
    return {
          ...t,
          msgs: [...t.msgs, msg],
          lastTs: msg.ts,
          unread: msg.role === "npc" ? t.unread + 1 : t.unread,
        };
  });
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

export function setThreadCustom(g: GameState, threadId: string, patch: Partial<ThreadCustom>): GameState {
  const ph = ensurePhone(g).phone!;
  const threads = ph.threads.map((t) => (t.id === threadId ? { ...t, custom: { ...t.custom, ...patch } } : t));
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

/* ————— 聊天效果落账：与主线同一套好感轴 / 爱慕轴，单次封顶 —————
 * relDelta：AI 建议的好感变动（钳制到 ±CHAT_REL_CAP）；
 * romanticDelta：AI 建议的爱慕变动（钳制到 ±CHAT_LOVE_CAP、每日涨幅封顶 CHAT_LOVE_DAILY，写 sim.relations[pid].romantic，家人不计）；
 * mood：NPC 新心情；memory：写入互动记录的一句话；
 * group：群名——给了就按群聊记忆落账：memory 加「[群聊「群名」]」前缀，同一场群聊的后几轮并进上一条（joinGroupMem）；
 * moodShift：主角自身压力变动（暖聊降压 / 争执增压）。 */
export function applyChatEffects(
  g: GameState,
  personId: string,
  eff: { relDelta?: number; romanticDelta?: number; mood?: string; memory?: string; group?: string; stressDelta?: number; selfEvent?: string },
): GameState {
  let next = structuredClone(g) as GameState;
  const s = next.sim;
  const npc = next.npcs.find((n) => n.id === personId);
  const cap = affinityCapOf(personId);
  const tag = eff.group ? `[群聊「${eff.group}」]` : "";
  const memory = eff.memory && tag ? `${tag} ${eff.memory.trim()}` : eff.memory;
  if (typeof eff.relDelta === "number" && eff.relDelta !== 0) {
    const d = Math.max(-CHAT_REL_CAP, Math.min(CHAT_REL_CAP, Math.round(eff.relDelta)));
    const before = s.rel[personId] ?? npc?.affinity ?? 0; // 无引擎条目的人物从展示值起算，不把原有好感冲成 0
    const after = Math.max(0, Math.min(cap, before + d));
    const real = after - before;
    if (real !== 0) {
      s.rel[personId] = after;
      if (npc) {
        npc.affinity = Math.max(0, Math.min(100, after));
        npc.affinityHistory.push({ turn: next.turnCount, delta: real, reason: memory || tag || "私聊往来" });
      }
    }
  }
  if (typeof eff.romanticDelta === "number" && Number.isFinite(eff.romanticDelta) && eff.romanticDelta !== 0 && canRomance(s, personId)) {
    const relations = ensureRelations(s.relations);
    const r = relations[personId] ?? blankRel();
    const day = s.day ?? 0;
    const used = r.chatLove?.day === day ? r.chatLove.gain : 0;
    let d = Math.max(-CHAT_LOVE_CAP, Math.min(CHAT_LOVE_CAP, Math.round(eff.romanticDelta)));
    if (d > 0) d = Math.min(d, Math.max(0, CHAT_LOVE_DAILY - used));
    const romantic = Math.max(0, Math.min(romanticCapOf(personId), r.romantic + d));
    const real = romantic - r.romantic;
    if (real !== 0) s.relations = { ...relations, [personId]: { ...r, romantic, ...(real > 0 ? { chatLove: { day, gain: used + real } } : {}) } };
  }
  if (npc) {
    if (eff.mood) npc.mood = eff.mood;
    if (memory) {
      const last = lastOf(npc.interactions);
      const joined = tag ? joinGroupMem(last, last?.time, memory, tag, next.turnCount, gameTimeLabel(g)) : undefined;
      if (last && joined !== undefined) last.text = joined;
      else npc.interactions.push({ turn: next.turnCount, time: gameTimeLabel(g), text: memory });
    }
  }
  if (typeof eff.stressDelta === "number" && eff.stressDelta !== 0) {
    s.stress = Math.max(0, Math.min(100, s.stress + Math.round(eff.stressDelta)));
  }
  // 写入该 NPC 的私有知识库（交互 → playerMemory，自身事件 → selfMemory）
  if (memory) next = remember(next, personId, "player", memory, gameTimeLabel(g), tag || undefined);
  if (eff.selfEvent) next = remember(next, personId, "self", eff.selfEvent, gameTimeLabel(g));
  next.updatedAt = Date.now();
  return next;
}

/* 手机里的「现在」：一律取游戏内时间（星城日期 + 当日钟点），不走现实时钟，
 * 保证状态栏、主屏时钟、锁屏、时钟 App 显示同一个时间。 */
export function gameNow(g: GameState): Date {
  const { y, m, d } = dayParts(g.sim.day ?? 0);
  const min = Math.max(0, Math.round(g.sim.clockMin ?? 480)) % 1440;
  return new Date(y, m - 1, d, Math.floor(min / 60), min % 60, 0);
}

/* 微信关系：friend（contacts 内）/ pending（已申请未处理）/ non_friend */
export type WxRelation = "friend" | "pending" | "non_friend";
export function wxRelation(g: GameState, pid: string): WxRelation {
  const ph = g.phone;
  if (ph?.contacts?.includes(pid)) return "friend";
  if (ph?.pending?.includes(pid)) return "pending";
  return "non_friend";
}
/* 申请 / agree / reject / shelve：只有明确指令才改变关系 */
export function wxApply(g: GameState, pid: string): GameState {
  const ph = ensurePhone(g).phone!;
  if (ph.contacts.includes(pid) || (ph.pending ?? []).includes(pid)) return g;
  return { ...g, phone: { ...ph, pending: [...(ph.pending ?? []), pid] } };
}
export function wxResolve(g: GameState, pid: string, cmd: "agree" | "reject" | "shelve"): GameState {
  if (cmd === "shelve") return g;
  const ph = ensurePhone(g).phone!;
  const pending = (ph.pending ?? []).filter((x) => x !== pid);
  const contacts = cmd === "agree" && !ph.contacts.includes(pid) ? [...ph.contacts, pid] : ph.contacts;
  return { ...g, phone: { ...ph, pending, contacts } };
}
