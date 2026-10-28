/* 线上 ↔ 线下联动中枢
 * - 手机时间 = 线下时间；手机操作记入流水并消耗线下时间，每回合把未同步的流水发给线下剧情
 * - 角色在网上的足迹（发帖 / 评论…）写入角色本人的记忆，线上线下都记得
 * - 线下剧情可让角色主动上线：发绿信、拉群、来电、发邮件、重新加好友（AI 输出 step.phone）
 * - 邮件：主角发给角色、对方未回复的邮件，线下剧情会择机回复
 * - 删除好友：被删的角色会在后续剧情里做出反应 */
import type { GameState, Npc } from "../lib/types";
import { ensurePhone, gameMinutes, gameTimeLabel, msgId, openThread, pushMsg, createGroup, threadFor, type Mail, type PhoneAct, type ChatMsg } from "./phone";
import { remember } from "./npcKnowledge";
import { findNpc } from "../lib/npcIdentity";
import { mobsHere } from "./mud";

const ACTS_MAX = 40;
const NET_MAX = 30;
const MAILS_MAX = 80;
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/* ───────────── 手机操作流水 ───────────── */

/** 记一条手机操作并让线下时间流动 min 分钟。key 相同、未同步且 30 分钟内的操作合并为一条（如连续发消息） */
export function logAct(g: GameState, a: { app: string; text: string; min?: number; pid?: string; key?: string; bit?: string }): GameState {
  const ph = ensurePhone(g).phone!;
  const acts = ph.acts ?? [];
  const gt = gameMinutes(g);
  const min = Math.max(0, Math.round(a.min ?? 2));
  const last = acts[acts.length - 1];
  let next: PhoneAct[];
  if (a.key && last && !last.sent && last.key === a.key && gt - last.gt <= 30 && last.text.length < 220) {
    next = [...acts.slice(0, -1), { ...last, text: a.bit ? `${last.text}「${clip(a.bit, 40)}」` : last.text, min: last.min + min }];
  } else {
    const text = a.bit ? `${a.text}「${clip(a.bit, 40)}」` : a.text;
    const row = { id: msgId(), gt, label: gameTimeLabel(g), app: a.app, text: clip(text, 200), min, ...(a.pid ? { pid: a.pid } : {}), ...(a.key ? { key: a.key } : {}) } as PhoneAct;
    next = [...acts, row];
  }
  // 超量先丢已同步的旧流水
  while (next.length > ACTS_MAX) {
    const i = next.findIndex((x) => x.sent);
    next.splice(i >= 0 ? i : 0, 1);
  }
  const clockMin = Math.min(1439, (g.sim.clockMin ?? 480) + min);
  return { ...g, sim: { ...g.sim, clockMin }, phone: { ...ph, acts: next } };
}

export const pendingActs = (g: GameState): PhoneAct[] => (g.phone?.acts ?? []).filter((x) => !x.sent);

export function markActsSent(g: GameState, ids: Set<string>): GameState {
  if (!ids.size || !g.phone?.acts) return g;
  return { ...g, phone: { ...g.phone, acts: g.phone.acts.map((x) => (ids.has(x.id) ? { ...x, sent: true } : x)) } };
}

/* 打开应用时记一笔（同一应用 20 分钟内不重复记） */
const OPEN_TEXT: Record<string, [string, number]> = {
  forum: ["刷了会儿论坛", 10], weibo: ["刷了会儿冲浪（热搜 / 博文）", 10], xhs: ["逛了会儿小粉书", 10],
  cloudmusic: ["听了会儿云音乐", 15], ticket: ["看了看票团团上的演出", 5], xianyu: ["逛了会儿咸鱼", 8],
  bosspin: ["翻了翻老板直聘上的招募", 8], peek: ["偷看了别人的手机（视监）", 10], couple: ["打开了情侣空间", 5],
  mail: ["查看了邮箱", 3], read: ["看了会儿小说", 10], video: ["刷了会儿视频", 12], wechat: ["刷了刷绿信和朋友圈", 3], sms: ["看了看短信", 2],
};
export function logAppOpen(g: GameState, app: string, label: string): GameState {
  const o = OPEN_TEXT[app];
  if (!o) return g;
  const gt = gameMinutes(g);
  const recent = [...(g.phone?.acts ?? [])].reverse().find((x) => x.app === label && x.text === o[0]);
  if (recent && gt - recent.gt < 20) return g;
  return logAct(g, { app: label, text: o[0], min: o[1] });
}

/* ───────────── 角色的网络足迹 ───────────── */

/** 角色在某个 App 留下的公开行为：记入足迹，并写进角色本人的记忆（线上私聊 / 线下剧情都会记得） */
export function logNpcNet(g: GameState, pid: string, app: string, text: string): GameState {
  if (!pid || !text.trim() || !g.npcs.some((n) => n.id === pid)) return g;
  const ph = ensurePhone(g).phone!;
  const row = { id: msgId(), gt: gameMinutes(g), label: gameTimeLabel(g), pid, app, text: clip(text.trim(), 120) };
  if ((ph.npcNet ?? []).some((x) => x.pid === pid && x.text === row.text)) return g;
  const npcNet = [...(ph.npcNet ?? []), row].slice(-NET_MAX);
  return remember({ ...g, phone: { ...ph, npcNet } }, pid, "self", `我在${app}上${row.text}`, row.label);
}

/* ───────────── 邮件 ───────────── */

export function sendMail(g: GameState, toPid: string, subject: string, body: string, replyTo?: string): GameState {
  const ph = ensurePhone(g).phone!;
  const toName = g.npcs.find((n) => n.id === toPid)?.name ?? toPid;
  const m: Mail = { id: msgId(), gt: gameMinutes(g), label: gameTimeLabel(g), ts: Date.now(), from: "me", fromName: g.player.name, to: toPid, toName, subject: subject.trim() || "（无主题）", body: body.trim(), read: true, awaiting: true, ...(replyTo ? { replyTo } : {}), kind: "person" };
  const mails = (ph.mails ?? []).map((x) => (replyTo && x.id === replyTo ? { ...x, read: true } : x));
  // 收件人记得读到过这封信（线上私聊、线下见面都会知道）
  const g2 = remember({ ...g, phone: { ...ph, mails: [m, ...mails].slice(0, MAILS_MAX) } }, toPid, "player", `主角给我发了封邮件《${m.subject}》：${clip(m.body, 100)}`, m.label);
  return logAct(g2, { app: "邮箱", text: `给${toName}写了封邮件《${clip(m.subject, 20)}》：${clip(m.body, 60)}`, min: 8, pid: toPid });
}

export function receiveMail(g: GameState, m: Omit<Mail, "id" | "gt" | "label" | "ts">): GameState {
  const ph = ensurePhone(g).phone!;
  const mail: Mail = { ...m, id: msgId(), gt: gameMinutes(g), label: gameTimeLabel(g), ts: Date.now() };
  const mails = (ph.mails ?? []).map((x) => (m.replyTo && x.id === m.replyTo ? { ...x, awaiting: false } : x));
  return { ...g, phone: { ...ph, mails: [mail, ...mails].slice(0, MAILS_MAX) } };
}

export const mailUnread = (g: GameState) => (g.phone?.mails ?? []).filter((m) => m.to === "me" && !m.read).length;

export function readMail(g: GameState, id: string): GameState {
  const ph = ensurePhone(g).phone!;
  if (!(ph.mails ?? []).some((m) => m.id === id && !m.read)) return g;
  return { ...g, phone: { ...ph, mails: (ph.mails ?? []).map((m) => (m.id === id ? { ...m, read: true } : m)) } };
}

/* ───────────── 删除好友 ───────────── */

export function removeFriend(g: GameState, pid: string): GameState {
  const ph = ensurePhone(g).phone!;
  if (!ph.contacts.includes(pid)) return g;
  const name = g.npcs.find((n) => n.id === pid)?.name ?? pid;
  const removed = [...(ph.removed ?? []).filter((r) => r.pid !== pid), { pid, gt: gameMinutes(g), label: gameTimeLabel(g) }].slice(-10);
  const g2 = { ...g, phone: { ...ph, contacts: ph.contacts.filter((x) => x !== pid), removed } };
  return logAct(g2, { app: "绿信", text: `删除了${name}的绿信好友`, min: 1, pid });
}

/* ───────────── 同处一地 ───────────── */

export function peopleHere(g: GameState): { id: string; name: string }[] {
  try { return mobsHere(g.sim, g.sim.room, g.npcs).filter((p) => p.present).map((p) => ({ id: p.id, name: p.name })); } catch { return []; }
}
export const isHere = (g: GameState, pid?: string) => !!pid && peopleHere(g).some((p) => p.id === pid);

/* 当面却在用手机找对方：按概率被打断（同一人每个游戏小时最多一次） */
const lastInterrupt: Record<string, number> = {};
export function rollInterrupt(g: GameState, pid: string | undefined, chance = 0.35): boolean {
  if (!pid || !isHere(g, pid)) return false;
  const hour = Math.floor(gameMinutes(g) / 60);
  const k = `${g.id}:${pid}`;
  if (lastInterrupt[k] === hour) return false;
  if (Math.random() >= chance) return false;
  lastInterrupt[k] = hour;
  return true;
}
export type PhoneInterrupt = { pid: string; name: string; what: string };
/** 通知游戏层：关掉手机、转入线下剧情 */
export function emitInterrupt(d: PhoneInterrupt) {
  window.dispatchEvent(new CustomEvent<PhoneInterrupt>("phone:interrupt", { detail: d }));
}

/* ───────────── 给线下剧情的提示块 ───────────── */

export function phoneLinkPrompt(g: GameState): string {
  const ph = g.phone;
  if (!ph) return "";
  const name = (pid: string) => g.npcs.find((n) => n.id === pid)?.name ?? pid;
  const acts = pendingActs(g);
  const spent = acts.reduce((a, x) => a + (x.min || 0), 0);
  const parts: string[] = [];
  if (acts.length) {
    parts.push(`〈上回合以来主角在手机上做的事（线下同步知晓；可让知情的人自然提起或做出反应，共耗时约 ${spent} 分钟）〉\n${acts.map((x) => `· ${x.label.split(" ").pop()} ${x.app}：${x.text}`).join("\n")}`);
  }
  const net = (ph.npcNet ?? []).slice(-8);
  if (net.length) parts.push(`〈角色的网络足迹（角色本人记得自己做过，可在剧情中提起）〉\n${net.map((x) => `· ${name(x.pid)} 在${x.app}：${x.text}`).join("\n")}`);
  const waiting = (ph.mails ?? []).filter((m) => m.from === "me" && m.awaiting).slice(0, 4);
  if (waiting.length) parts.push(`〈主角发出、对方还没回复的邮件（对方可在合适的时机用 phone.mails 回复，reply_to 填邮件 id；不必立刻回）〉\n${waiting.map((m) => `· id=${m.id} ${m.label} 发给 ${m.toName ?? name(m.to)}《${m.subject}》：${clip(m.body, 80)}`).join("\n")}`);
  const removed = (ph.removed ?? []).filter((r) => !r.reacted && gameMinutes(g) - r.gt < 7 * 1440);
  if (removed.length) parts.push(`〈被主角删除了绿信好友的人（TA 迟早会察觉并做出反应：重新发好友申请、打电话、拉群质问，或线下当面提起）〉\n${removed.map((r) => `· ${name(r.pid)}（${r.label} 被删）`).join("\n")}`);
  const here = peopleHere(g);
  const friends = ph.contacts.map(name);
  parts.push(`〈让角色主动上线联络（剧情自然需要时才用，不必每回合）〉在 JSON 里加：
"phone":{"messages":[{"from":"角色名","text":["一条","两条"]}],"group":{"title":"群名","from":"发起人","members":["角色名"],"text":["开场白"]},"call":{"from":"角色名","video":false,"reason":"打来想说的事"},"mails":[{"from":"角色名或机构名","subject":"","body":"","reply_to":""}],"friend_requests":[{"from":"角色名","text":"验证消息"}]}
规则：messages / group 只能来自绿信好友（${friends.join("、") || "暂无"}）；不是好友的人只能 call、mails 或 friend_requests；每回合 messages ≤3 条、mails ≤2 封、call ≤1 个；${here.length ? `此刻和主角当面在一起的（${here.map((p) => p.name).join("、")}）有话直接当面说，不要发消息或来电；` : ""}平台与机构（订单、快递、平台通知、工作邀约、粉丝来信等）也能发邮件，可以紧扣主角最近的手机操作。正文里不必复述手机内容。`);
  return `\n【手机 ↔ 线下】手机时间与线下同步（现在 ${gameTimeLabel(g)}）。\n${parts.join("\n")}\n`;
}

/* ───────────── 应用线下剧情下发的手机指令 ───────────── */

export type PhoneStep = {
  messages?: { from?: string; text?: string[] | string }[];
  group?: { title?: string; from?: string; members?: string[]; text?: string[] | string };
  call?: { from?: string; video?: boolean; reason?: string };
  mails?: { from?: string; subject?: string; body?: string; reply_to?: string }[];
  friend_requests?: { from?: string; text?: string }[];
};
export type PhoneHooks = { addReq: (g: GameState, pid: string, text: string) => GameState };

const lines = (t: unknown): string[] => (Array.isArray(t) ? t : typeof t === "string" ? [t] : []).map((x) => (typeof x === "string" ? x.trim().slice(0, 200) : "")).filter(Boolean).slice(0, 4);

export function applyPhoneStep(g0: GameState, p: PhoneStep | undefined, hooks: PhoneHooks): { g: GameState; notes: string[] } {
  if (!p || typeof p !== "object") return { g: g0, notes: [] };
  let g = ensurePhone(g0);
  const notes: string[] = [];
  const who = (n?: string): Npc | undefined => (typeof n === "string" && n.trim() ? findNpc(g.npcs, n.trim(), n.trim()) : undefined);
  const isFriend = (pid: string) => g.phone!.contacts.includes(pid);
  const wasRemoved = (pid: string) => (g.phone!.removed ?? []).some((r) => r.pid === pid && !r.reacted);
  const reacted = (pid: string) => {
    if (!wasRemoved(pid)) return;
    g = { ...g, phone: { ...g.phone!, removed: (g.phone!.removed ?? []).map((r) => (r.pid === pid ? { ...r, reacted: true } : r)) } };
  };
  const here = new Set(peopleHere(g).map((x) => x.id));
  const stamp = (i: number): Pick<ChatMsg, "ts" | "gt" | "label"> => ({ ts: Date.now() + i, gt: gameMinutes(g), label: gameTimeLabel(g) });

  // 好友申请（含被删后重新加回）
  const req = (n: Npc, text: string) => {
    if (isFriend(n.id)) return;
    g = hooks.addReq(g, n.id, text || "加回来好吗？");
    reacted(n.id);
    notes.push(`${n.name} 发来好友申请`);
  };

  // 私聊
  let sent = 0;
  for (const m of Array.isArray(p.messages) ? p.messages : []) {
    if (sent >= 3) break;
    const n = who(m?.from);
    const txt = lines(m?.text);
    if (!n || !txt.length || here.has(n.id)) continue;
    if (!isFriend(n.id)) { if (wasRemoved(n.id)) req(n, txt[0]); continue; }
    g = openThread(g, n.id);
    const th = threadFor(g.phone!, n.id)!;
    txt.forEach((text, i) => { g = pushMsg(g, th.id, { id: msgId(), role: "npc", text, ...stamp(i) }); });
    sent++;
    notes.push(`${n.name} 发来绿信`);
  }

  // 群聊：发起人 + 成员都得是好友
  const gp = p.group;
  if (gp && typeof gp === "object") {
    const from = who(gp.from);
    const members = Array.from(new Set([...(from ? [from] : []), ...(Array.isArray(gp.members) ? gp.members.map(who) : [])].filter((n): n is Npc => !!n && isFriend(n.id)).map((n) => n.id)));
    const txt = lines(gp.text);
    if (from && isFriend(from.id) && members.length >= 1) {
      const title = typeof gp.title === "string" ? gp.title.trim().slice(0, 20) : "";
      let th = title ? g.phone!.threads.find((t) => t.kind === "group" && t.title === title) : undefined;
      if (!th) {
        const made = createGroup(g, members, title || undefined);
        g = made.g;
        const others = members.filter((x) => x !== from.id).map((x) => g.npcs.find((n) => n.id === x)?.name ?? x);
        g = { ...g, phone: { ...g.phone!, threads: g.phone!.threads.map((t) => (t.id === made.id ? { ...t, msgs: t.msgs.map((m, i) => (i === 0 ? { ...m, text: `${from.name}邀请你${others.length ? `和${others.join("、")}` : ""}加入了群聊` } : m)) } : t)) } };
        th = g.phone!.threads.find((t) => t.id === made.id);
        notes.push(`${from.name} 拉你进群「${th?.title ?? title}」`);
      }
      if (th) {
        const id = th.id;
        txt.forEach((text, i) => { g = pushMsg(g, id, { id: msgId(), role: "npc", text, from: from.id, ...stamp(i) }); });
      }
    }
  }

  // 来电（当面在场的人不打电话）
  const c = p.call;
  if (c && typeof c === "object" && !g.phone!.ringing) {
    const n = who(c.from);
    if (n && !here.has(n.id) && (isFriend(n.id) || wasRemoved(n.id))) {
      g = { ...g, phone: { ...g.phone!, ringing: { id: msgId(), pid: n.id, name: n.name, video: !!c.video, reason: typeof c.reason === "string" ? c.reason.trim().slice(0, 200) : "", gt: gameMinutes(g) } } };
      reacted(n.id);
      notes.push(`${n.name} 打来${c.video ? "视频" : "语音"}电话`);
    }
  }

  // 邮件
  let mailed = 0;
  for (const m of Array.isArray(p.mails) ? p.mails : []) {
    if (mailed >= 2) break;
    const subject = typeof m?.subject === "string" ? m.subject.trim().slice(0, 40) : "";
    const body = typeof m?.body === "string" ? m.body.trim().slice(0, 1200) : "";
    if (!subject && !body) continue;
    const n = who(m?.from);
    const fromName = n?.name ?? (typeof m?.from === "string" && m.from.trim() ? m.from.trim().slice(0, 20) : "系统通知");
    const replyTo = typeof m?.reply_to === "string" && (g.phone!.mails ?? []).some((x) => x.id === m.reply_to) ? m.reply_to : undefined;
    g = receiveMail(g, { from: n?.id ?? fromName, fromName, to: "me", subject: subject || "（无主题）", body, kind: n ? "person" : "org", ...(replyTo ? { replyTo } : {}) });
    if (n) { reacted(n.id); g = remember(g, n.id, "player", `我${replyTo ? "回了主角的邮件" : "给主角发了封邮件"}《${subject || "无主题"}》：${clip(body, 100)}`, gameTimeLabel(g)); }
    mailed++;
    notes.push(`收到邮件《${clip(subject || "无主题", 14)}》`);
  }

  // 好友申请
  for (const r of Array.isArray(p.friend_requests) ? p.friend_requests.slice(0, 2) : []) {
    const n = who(r?.from);
    if (n) req(n, typeof r?.text === "string" ? r.text : "");
  }

  return { g, notes };
}
