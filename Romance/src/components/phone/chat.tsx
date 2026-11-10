/* 通用聊天：useChat（发消息 → AI 逐条回复落库）+ ChatView（微信/短信共用视图） */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { useWxSettings, WX_FONT_PX } from "./wxSettings";
import {
  applyChatEffects,
  ensurePhone,
  gameMinutes,
  gameTimeLabel,
  markRead,
  msgId,
  needsDivider,
  pushMsg,
  setMsgStatus,
  togglePinned,
  setThreadCustom,
  logCall,
  bpmOf,
  type ChatMsg,
  type EmotionId,
  type Thread,
} from "../../game/phone";
import { EmotionBadge, IconClose, IconHeart, IconMessage, IconMic, IconMonitor, IconStar, IconUndo, IconUsers, InnerOsLabel } from "../../lib/icons";
import { requestChatReply, requestGroupReply, groupMemoryOf, notAMessage } from "../../lib/phoneChat";
import { moneyDecision, moneyStance, type Gift } from "../../lib/chatMoney";
import { relOf } from "../../game/relations";
import { isConfigured } from "../../lib/ai";
import type { GameState } from "../../lib/types";
import { delay, Dot, fmtDur } from "./shared";
import { CHAT_BGS, bgCss, chatLook, STICKER_SET, BUBBLE_STYLES, bubbleStyleOf, aiView, getStranger, speakerGender, isStrangerId, addStrangerMemory, useStrangers, patchMsg, patchThread, customOf, wxTime, addFav, msgPreview, giftMsg, isPendingMoney, isReceipt, moneyDesc, pendingMoney, settleMoney, type XMsg, type XCustom } from "./wxFeatures";
import { ShareSheet, speakOut, stopSpeech } from "./screenShare";
import { allowanceOn, payerId } from "../../game/npcKnowledge";
import { talkAllowance } from "../../lib/allowance";
import { IconPlus, IconArrowUp, IconSmiley } from "./icons";
import { walletDef, wallet } from "../../game/wallet";
import { emitInterrupt, logAct, removeFriend, rollInterrupt } from "../../game/phoneLink";
import { useCommsBrand } from "./commsBrand";

/* 发消息 → AI 回复逐条落库。每一步都在最新存档上修改（patchGame）：等 AI、逐条出气泡要好几秒，
   这期间人物页调过的爱慕 / 好感、别处落库的进度都要保留，不能被发送时的旧快照整档覆盖回去。 */
export function useChat() {
  const { game, cfg, patchGame } = useGame();
  const brand = useCommsBrand(); // P4.1：手机流水里的 App 名随世界题材（绿信 / 传讯）
  const gRef = useRef<GameState>(game!);
  gRef.current = game!;
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<string>("");

  async function send(threadId: string, text: string, img?: string, kind?: XMsg["kind"], extra?: Partial<XMsg>): Promise<boolean> {
    if (!text.trim() && !img && !extra?.amount) return false;
    if (!isConfigured(cfg)) {
      setBusyStatus("需要先在右上角接入 AI，对方才能回复你");
      setTimeout(() => setBusyStatus(""), 2600);
      return false;
    }
    let g = gRef.current;
    // 把本步改动应用到最新存档并落库；结果同步留在 g 里，供后面读取时间、会话等
    const step = (fn: (cur: GameState) => GameState) => patchGame((cur) => (g = fn(cur)));
    {
      const th0 = g.phone?.threads.find((t) => t.id === threadId);
      const pid0 = th0?.kind === "private" ? th0.personId : undefined;
      if (pid0 && !isStrangerId(pid0) && !(g.phone?.contacts ?? []).includes(pid0)) {
        setBusyStatus("你们还不是微信好友，消息发不出去，只能线下当面【对话】");
        setTimeout(() => setBusyStatus(""), 2800);
        return false;
      }
    }
    const amount = extra?.amount ?? 0;
    if (amount > 0) {
      if (wallet.balance(g) < amount) {
        setBusyStatus(`${wallet.name(g, "零钱")}余额不足`);
        setTimeout(() => setBusyStatus(""), 2200);
        return false;
      }
    }
    const gt = gameMinutes(g);
    const label = gameTimeLabel(g);
    const mine: XMsg = { id: msgId(), role: "me", text: text.trim(), ts: Date.now(), gt, label, status: "sending", ...(img ? { img } : {}), ...(kind ? { kind } : {}), ...extra };
    // 贴纸 / 相册图片 / 语音 / 红包转账：AI 只看到文字占位（不走识图），屏幕共享仍照原逻辑发图
    const t0 = text.trim();
    // 红包 / 转账只说「发了」：收不收由对方这次的回复决定（见下面的 settle）
    const gave = `${wallet.fmt(amount, g)}${extra?.note ? "：" + extra.note : ""}`;
    const inGroup = g.phone?.threads.find((t) => t.id === threadId)?.kind === "group";
    const aiText = kind === "sticker" ? `[表情包：${t0}]` : kind === "photo" ? `[图片]${t0 ? " " + t0 : ""}`
      : kind === "voice" ? `[语音消息] ${t0}`
      : kind === "redpacket" ? (inGroup ? `[主角在群里发了一个红包 ${gave}]` : `[主角给你发了一个红包 ${gave}]`)
      : kind === "transfer" ? `[主角给你转账 ${gave}]`
      : extra?.quote ? `[引用「${extra.quote}」] ${t0}` : t0;
    const aiImg = kind ? undefined : img;
    // 红包 / 转账先扣款，再写入这条消息
    step((cur) => pushMsg(amount > 0 ? wallet.add(cur, -amount) : cur, threadId, mine));
    await delay(350);
    step((cur) => setMsgStatus(cur, threadId, [mine.id], "unread"));
    // 主角之前给出、超过一天（游戏时间）还没人收的钱：像微信一样自动退回，不再拿去问
    for (const m of g.phone?.threads.find((t) => t.id === threadId)?.msgs ?? []) {
      if (m.id !== mine.id && m.role === "me" && isPendingMoney(m) && gameMinutes(g) - m.gt >= 1440) step((cur) => settleMoney(cur, threadId, m.id, false, []));
    }

    const thread = ensurePhone(g).phone!.threads.find((t) => t.id === threadId);
    // 给 AI 的上下文不含刚发的这条：它会作为最后一条 user 消息单独传入，带上就成了「同一句话连发两遍」
    const aiThread = thread && { ...thread, msgs: thread.msgs.filter((m) => m.id !== mine.id) };
    // 手机流水：和谁聊了什么（连续发送合并为一条）；聊天消耗线下时间，下回合线下剧情会知晓
    const bit = kind === "redpacket" ? `[红包 ${wallet.fmt(amount, g)}]` : kind === "transfer" ? `[转账 ${wallet.fmt(amount, g)}]`
      : kind === "sticker" ? "[表情包]" : kind === "photo" ? `[图片]${t0 ? " " + t0 : ""}` : kind === "voice" ? `[语音] ${t0}` : t0;
    step((cur) => logAct(cur, { app: brand.appName, text: thread?.kind === "group" ? `在群「${thread.title}」里说` : `和${thread?.title ?? "好友"}聊${brand.appName}`, pid: thread?.personId, key: `wx:${threadId}`, bit, min: 2 }));
    // 明明当面在一起，却低头给对方发消息：对方可能直接打断你，转入线下当面交谈
    if (thread?.kind === "private" && thread.personId && rollInterrupt(g, thread.personId)) {
      step((cur) => pushMsg(setMsgStatus(cur, threadId, [mine.id], "read"), threadId, { id: msgId(), role: "sys", text: `${thread.title}就在你身边，放下手机看向了你——`, ts: Date.now(), gt: gameMinutes(cur), label: gameTimeLabel(cur) }));
      emitInterrupt({ pid: thread.personId, name: thread.title, what: bit || "发消息" });
      return true;
    }
    // 发送失败：标红色叹号；红包 / 转账退回零钱
    const fail = (msg: string) => {
      step((cur) => {
        const x = patchMsg(cur, threadId, mine.id, { failed: true, status: undefined });
        return amount > 0 ? wallet.add(x, amount) : x;
      });
      setBusyStatus(msg);
      setTimeout(() => setBusyStatus(""), 2600);
    };
    // 这次要对方表态的钱：刚发的这笔；否则是之前留着没收的那笔（对方当时在忙 / 没拿定主意）
    const ask = kind === "redpacket" || kind === "transfer" ? mine : pendingMoney(aiThread);
    const money = ask ? moneyDesc(g, ask) : undefined;
    const fresh = ask?.id === mine.id;
    const nameOf = (id?: string) => (id && (gRef.current.npcs.find((n) => n.id === id)?.name ?? getStranger(id)?.name)) || (thread?.kind === "group" ? "群友" : thread?.title ?? "对方");
    // 收下 → 红包已领取 / 转账已收款；不收 → 原路退回钱包（settleMoney 只结算还没落定的，不会重复退款）
    const settle = async (x: XMsg, take: boolean, who: string[]) => {
      await delay(take ? 700 : 600);
      step((cur) => settleMoney(cur, threadId, x.id, take, who.map(nameOf)));
    };

    if (thread?.kind === "group") {
      setTypingIn(threadId);
      try {
        const r = await requestGroupReply(cfg, g, aiView(g, aiThread).thread!, aiText, aiImg, money ? { money } : undefined);
        step((cur) => setMsgStatus(cur, threadId, [mine.id], "read"));
        // 主角的红包：AI 点名领了的人依次领取；AI 没给 grab 时看谁说了收下的话；没人领就先留着，下次说话时再问
        if (ask) {
          const who = r.grab ?? r.lines.filter((l) => moneyStance(l.text) === "accept" && (fresh || /红包|抢|领/.test(l.text))).map((l) => l.id);
          if (who.length) await settle(ask, true, [...new Set(who)].slice(0, 8));
        }
        for (const l of r.lines) {
          await delay(600 + Math.min(1400, (l.text || "红包").length * 45));
          if (l.text) step((cur) => pushMsg(cur, threadId, {
            id: msgId(), role: "npc", from: l.id, text: l.text, ts: Date.now(), gt: gameMinutes(cur), label: gameTimeLabel(cur),
            ...(l.emotion ? { emo: l.emotion, bpm: bpmOf(l.emotion) } : {}), ...(l.inner_os ? { os: l.inner_os } : {}),
          }));
          // 成员当场发给主角的红包（频率、上限由 chatMoney 校正，不该发的不落卡片）
          if (l.gift) step((cur) => { const c = giftMsg(cur, l.id, l.gift, true); return c ? pushMsg(cur, threadId, c) : cur; });
        }
        // 群聊记忆逐人落账（同一场群聊每人并成一条）：AI 写了用 AI 的，漏写时本轮开口或被点名的人兜底记一句；只发表情包不兜底
        const said = kind === "sticker" ? "" : bit;
        step((cur) => {
          let x = cur;
          for (const m of thread.members ?? []) {
            const memory = groupMemoryOf(x, r, m, said);
            if (memory || r.rel[m] || r.love[m]) x = applyChatEffects(x, m, { memory: memory || undefined, group: thread.title, relDelta: r.rel[m], romanticDelta: r.love[m] });
          }
          return x;
        });
      } catch {
        fail("群里暂时没人回应，检查一下网络或 AI 配置");
      }
      setTypingIn(null);
      return true;
    }
    if (!thread || !thread.personId) return true;
    const pid = thread.personId;

    setTypingIn(threadId);
    let reply;
    try {
      const v = aiView(g, aiThread);
      reply = await requestChatReply(cfg, v.g, v.thread!, aiText, aiImg);
    } catch {
      setTypingIn(null);
      fail(aiImg ? "对方没能看到图片：当前 AI 模型可能不支持识图，换一个多模态模型试试" : "消息发送失败，检查一下网络或 AI 配置");
      return true;
    }

    step((cur) => setMsgStatus(cur, threadId, [mine.id], "read"));
    // 对方对那笔钱的态度：收下的先落定；不收的等话说完再退；没表态 / 在忙 → 先留着，下次说话时再问
    const verdict = ask && !reply.busy ? moneyDecision(reply.accept_money, reply.bubbles.join("\n"), fresh) : undefined;
    if (ask && verdict === "accept") await settle(ask, true, [pid]);

    if (reply.busy) {
      await delay(600);
      setTypingIn(null);
      step((cur) => setMsgStatus(cur, threadId, [mine.id], "busy"));
    }

    const stranger = isStrangerId(pid);
    const silent = reply.read_only || reply.bubbles.length === 0;
    for (const [bi, b] of (silent ? [] : reply.bubbles).entries()) {
      await delay(500 + Math.min(1400, b.length * 45));
      const lastOne = bi === reply.bubbles.length - 1;
      step((cur) => {
        const nm: ChatMsg = {
          id: msgId(), role: "npc", text: b, ts: Date.now(), gt: gameMinutes(cur), label: gameTimeLabel(cur),
          ...(lastOne && reply.emotion ? { emo: reply.emotion, bpm: bpmOf(reply.emotion) } : {}),
          ...(lastOne && reply.inner_os ? { os: reply.inner_os } : {}),
        };
        return pushMsg(cur, threadId, nm);
      });
    }
    setTypingIn(null);
    // TA 当场发给主角的红包 / 转账（JSON gift、话里夹的「[红包 ¥88]」、嘴上说的「给你发个红包」）：
    // 金额、频率、父母规则由 chatMoney 校正后落成可领取的卡片；只发了钱没说话也不丢
    if (reply.gift) {
      await delay(500);
      step((cur) => { const c = giftMsg(cur, pid, reply.gift); return c ? pushMsg(cur, threadId, c) : cur; });
    }
    if (ask && verdict === "refuse") await settle(ask, false, [pid]);
    if (silent) {
      if (!stranger && (reply.mood || reply.rel_delta || reply.love_delta || reply.stress_delta)) {
        step((cur) => applyChatEffects(cur, pid, { relDelta: reply.rel_delta, romanticDelta: reply.love_delta, mood: reply.mood, stressDelta: reply.stress_delta }));
      }
      return true;
    }
    if (stranger) { addStrangerMemory(pid, reply.memory); return true; }
    let loveD = 0; // 实际生效的爱慕变化（已钳制到上下限）
    step((cur) => {
      const next = applyChatEffects(cur, pid, { relDelta: reply.rel_delta, romanticDelta: reply.love_delta, mood: reply.mood, memory: reply.memory, stressDelta: reply.stress_delta, selfEvent: reply.self_event });
      loveD = relOf(next.sim, pid).romantic - relOf(cur.sim, pid).romantic;
      return next;
    });
    // 对话反馈：好感变化 / 被记住的事，以轻提示浮出，让玩家感到「说的话有分量」
    const fb = [
      reply.rel_delta ? `好感 ${reply.rel_delta > 0 ? "+" : ""}${reply.rel_delta}` : "",
      loveD ? `爱慕 ${loveD > 0 ? "+" : ""}${loveD}` : "",
      reply.memory ? `TA 记住了：${reply.memory.slice(0, 24)}${reply.memory.length > 24 ? "…" : ""}` : "",
    ].filter(Boolean);
    if (fb.length) window.dispatchEvent(new CustomEvent("phone:feedback", { detail: { threadId, lines: fb } }));
    return true;
  }

  return { send, typingIn, busyStatus };
}

const STATUS_LABEL: Record<string, string> = { sending: "发送中", unread: "已送达", read: "已读", busy: "对方忙碌未查看" };

/* 聊天表情面板（点一枚即插入输入框，不再是「[表情]」占位符） */
const CHAT_EMOJIS = ["😀", "😂", "🥰", "😊", "😍", "😘", "😎", "🤔", "😭", "😳", "😅", "🙈", "😴", "😡", "🥺", "😉", "👍", "🙏", "👏", "💪", "🤝", "🌹", "❤️", "💕", "✨", "🎉", "🔥", "🍜", "☕", "🍰", "🌙", "⭐"];

/* 常用快捷回复：首句破冰 vs 日常接话，一点即发，减少手机端打字 */
function quickReplies(hasReal: boolean): string[] {
  return hasReal
    ? ["哈哈哈，你也是～", "好呀，都听你的", "在的，怎么啦？", "辛苦啦，早点休息", "改天当面聊", "抱抱你"]
    : ["在忙吗？", "最近还好吗？", "有空一起吃个饭？", "刚收工，有点想你", "方便打个电话吗？"];
}

function Sec({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <p className="mb-2 text-[12px] font-semibold text-ink-soft">{t}</p>
      {children}
    </div>
  );
}

function ChatSettingsSheet({ thread, onClose }: { thread: Thread; onClose: () => void }) {
  const { game, commitGame } = useGame();
  const c = (thread.custom ?? {}) as XCustom;
  const patch = (p: Partial<XCustom>) => commitGame(setThreadCustom(game!, thread.id, p as Partial<NonNullable<Thread["custom"]>>));
  const curBubble = bubbleStyleOf(c.bubble).id;
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => patch({ bg: String(r.result) });
    r.readAsDataURL(f);
  };
  const pill = (on: boolean) => `rounded-full border px-3 py-1 text-[12.5px] transition ${on ? "border-[#07c160] bg-[#07c160]/10 font-semibold text-[#07a050]" : "border-black/10 text-ink"}`;
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#ededed]">
      <div className="flex items-center border-b border-black/5 px-3 py-2.5">
        <button onClick={onClose} className="text-[15px]">‹ 返回</button>
        <span className="flex-1 text-center text-[15px] font-semibold text-ink">聊天背景与气泡</span>
        <span className="w-12" />
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3">
        <Sec t="聊天背景">
          <div className="grid grid-cols-4 gap-2">
            {CHAT_BGS.map((b) => {
              const on = (c.bg ?? "") === b.id;
              return (
                <button key={b.id || "def"} onClick={() => patch({ bg: b.id || undefined })} className="flex flex-col items-center gap-1">
                  <span className={`h-14 w-full rounded-lg border ${on ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/10"}`} style={{ background: b.css }} />
                  <span className={`text-[11px] ${on ? "font-semibold text-[#07a050]" : "text-ink-soft"}`}>{b.label}</span>
                </button>
              );
            })}
            <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1">
              <span className={`flex h-14 w-full items-center justify-center rounded-lg border border-dashed text-[20px] text-ink-soft ${c.bg?.startsWith("data:") ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/20"}`}
                style={c.bg?.startsWith("data:") ? { background: bgCss(c.bg) } : undefined}>{c.bg?.startsWith("data:") ? "" : "+"}</span>
              <span className="text-[11px] text-ink-soft">相册</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </Sec>
        <Sec t="聊天气泡">
          <div className="grid grid-cols-3 gap-2">
            {BUBBLE_STYLES.map((b) => {
              const on = curBubble === b.id;
              return (
                <button key={b.id} onClick={() => patch({ bubble: b.id })} className={`flex flex-col items-center gap-1.5 rounded-lg border p-2 ${on ? "border-[#07c160] ring-2 ring-[#07c160]/40" : "border-black/10"} ${b.id === "dark" ? "bg-[#1d2028]" : "bg-[#f3f3f3]"}`}>
                  <span className={`self-start rounded-lg px-2 py-0.5 text-[11px] ${b.them}`} style={b.themStyle}>你好</span>
                  <span className={`self-end rounded-lg px-2 py-0.5 text-[11px] ${b.me}`} style={b.meStyle}>在呢～</span>
                  <span className={`text-[11px] ${on ? "font-semibold text-[#07a050]" : b.id === "dark" ? "text-white/70" : "text-ink-soft"}`}>{b.label}</span>
                </button>
              );
            })}
          </div>
        </Sec>
      </div>
    </div>
  );
}

/* 相册图片：压缩为 ≤720px 的 JPEG dataURL，避免存档过大 */
export function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("read"));
    r.onload = () => {
      const src = String(r.result);
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 720 / Math.max(im.width, im.height));
        const c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      im.onerror = () => resolve(src);
      im.src = src;
    };
    r.readAsDataURL(f);
  });
}

/* 语音通话（文字模拟）：响铃 → 接通计时 → AI 台词以字幕呈现 → 挂断写入「通话时长」 */
/* incoming：对方主动打来（线下剧情触发），值为 TA 打来想说的事；video 仅改称呼为视频通话 */
export function VoiceCall({ thread, name, avatar, onClose, incoming, video }: { thread: Thread; name: string; avatar?: string; onClose: () => void; incoming?: string; video?: boolean }) {
  const { game, cfg, commitGame } = useGame();
  const brand = useCommsBrand();
  const gRef = useRef<GameState>(game!);
  gRef.current = game!;
  const callWord = video ? "视频通话" : "语音通话";
  const [phase, setPhase] = useState<"ringing" | "live" | "ended">(incoming !== undefined ? "live" : "ringing");
  const [sec, setSec] = useState(0);
  const [lines, setLines] = useState<ChatMsg[]>([]);
  const linesRef = useRef<ChatMsg[]>([]);
  linesRef.current = lines;
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const lastMem = useRef<{ memory?: string; rel?: number; love?: number; mood?: string }>({});
  const callGift = useRef<Gift | undefined>(undefined); // 通话里答应给的钱：挂断后落成卡片
  const pid = thread.personId!;
  const stranger = isStrangerId(pid);
  const scroller = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [lines.length, busy]);

  const line = (role: "me" | "npc", text: string): ChatMsg => ({ id: msgId(), role, text, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current) });

  async function talk(said: string) {
    setBusy(true);
    let out: string[] = [];
    let emo: EmotionId | undefined;
    if (isConfigured(cfg)) {
      try {
        const g = gRef.current;
        const callThread = { ...thread, msgs: [...thread.msgs, ...linesRef.current] };
        const v = aiView(g, callThread);
        const prompt = said ? `【${callWord}中，主角对你说】${said}`
          : incoming !== undefined ? `【${callWord}】你主动给主角打了${brand.appName}${callWord}，主角接起来了。${incoming ? `你打来是想说：${incoming}。` : ""}请你先开口。`
          : `【${callWord}】主角刚给你打来${brand.appName}${callWord}，你接起了电话。请说出接通后的第一句话。`;
        const r = await requestChatReply(cfg, v.g, v.thread!, `${prompt}\n（这是语音通话，bubbles 就是你说出口的话，口语化，1~3 句；read_only 与 busy 必须为 false）`);
        out = r.bubbles.slice(0, 3);
        emo = r.emotion;
        lastMem.current = { memory: r.memory, rel: r.rel_delta, love: r.love_delta, mood: r.mood };
        callGift.current ??= r.gift;
      } catch { /* 兜底 */ }
    }
    if (!out.length) out = said ? ["嗯嗯，我在听。", "你继续说～"] : [`喂？是${game!.player.name}吗？`];
    for (const [i, t] of out.entries()) {
      if (!alive.current) return;
      await delay(500 + Math.min(1200, t.length * 40));
      if (!alive.current) return;
      setLines((ls) => [...ls, line("npc", t)]);
      // 第一句出现时整段一起念：逐句调用的话每次朗读都会先停掉上一段，前面几句全被后一句打断
      if (i === 0) speakOut(out.join("\n"), speakerGender(gRef.current, pid), pid, gRef.current.npcs.find((n) => n.id === pid)?.persona?.ttsVoice, emo);
    }
    setBusy(false);
  }

  useEffect(() => {
    if (incoming !== undefined) { void talk(""); return; }
    const t = setTimeout(() => {
      if (!alive.current) return;
      // 明明当面在一起还打电话：对方可能直接挂掉、转身跟你说话
      if (rollInterrupt(gRef.current, pid, 0.5)) {
        alive.current = false;
        let g = pushMsg(gRef.current, thread.id, { id: msgId(), role: "sys", text: `${name}就在你身边，没接电话，直接看向了你`, ts: Date.now(), gt: gameMinutes(gRef.current), label: gameTimeLabel(gRef.current) });
        g = logAct(g, { app: brand.appName, text: `当着${name}的面给 TA 打${callWord}`, min: 1, pid });
        commitGame(g);
        setPhase("ended");
        emitInterrupt({ pid, name, what: `打${callWord}` });
        setTimeout(onClose, 300);
        return;
      }
      setPhase("live"); void talk("");
    }, 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const say = () => {
    const t = draft.trim();
    if (!t || busy) return;
    setDraft("");
    setLines((ls) => [...ls, line("me", t)]);
    void talk(t);
  };
  const hangup = () => {
    if (phase === "ended") return;
    alive.current = false;
    stopSpeech();
    let g = gRef.current;
    const connected = phase === "live";
    const now = Date.now();
    const text = connected ? `${callWord} · 通话时长 ${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}` : `${callWord} · 已取消`;
    g = pushMsg(g, thread.id, { id: msgId(), role: "sys", text, ts: now, gt: gameMinutes(g), label: gameTimeLabel(g), kind: "call" } as XMsg);
    g = logCall(g, { id: msgId(), personId: pid, name, number: `${brand.appName}${video ? "视频" : "语音"}`, ts: now, durationSec: connected ? sec : 0, outcome: connected ? "connected" : "declined", transcript: linesRef.current });
    // 电话里说了「给你转点钱」的：挂断后照说的发过来（金额、频率由 chatMoney 校正）
    const card = connected ? giftMsg(g, pid, callGift.current) : null;
    if (card) g = pushMsg(g, thread.id, card);
    if (connected) {
      const gist = linesRef.current.slice(0, 4).map((l) => `${l.role === "me" ? "我" : name}：${l.text}`).join(" / ");
      g = logAct(g, { app: brand.appName, text: `${incoming !== undefined ? `接了${name}打来的` : `给${name}打了`}${callWord}（${fmtDur(sec)}）${gist ? `：${gist}` : ""}`, min: Math.max(1, Math.ceil(sec / 60)), pid });
    }
    const m = lastMem.current;
    if (connected && linesRef.current.length) {
      if (stranger) addStrangerMemory(pid, m.memory ? `[语音通话] ${m.memory}` : undefined);
      else g = applyChatEffects(g, pid, { relDelta: m.rel, romanticDelta: m.love, mood: m.mood, memory: m.memory ? `[语音通话] ${m.memory}` : undefined });
    }
    commitGame(g);
    setPhase("ended");
    setTimeout(onClose, 600);
  };
  const live = phase === "live";

  return (
    <div className="absolute inset-0 z-50 flex flex-col text-white" style={{ background: "linear-gradient(180deg,#1f2a36,#121820)" }}>
      <div className="flex flex-col items-center pt-12">
        <div className={`overflow-hidden rounded-2xl ring-4 ring-white/10 ${phase === "ringing" ? "animate-pulse" : ""}`}><Avatar src={avatar} name={name} size={88} editable={false} /></div>
        <p className="mt-4 text-[22px] font-semibold">{name}</p>
        <p className="mt-1 text-[13px] tabular-nums text-white/60">{phase === "ringing" ? "正在等待对方接听…" : phase === "ended" ? "通话已结束" : fmtDur(sec)}</p>
      </div>
      <div ref={scroller} className="mt-6 flex-1 space-y-2 overflow-y-auto px-6">
        {lines.slice(-8).map((l) => (
          <p key={l.id} className={`text-center text-[14.5px] leading-relaxed ${l.role === "me" ? "text-[#9be7b4]" : "text-white"}`}>
            <span className="mr-1 text-[11px] text-white/40">{l.role === "me" ? "我" : name}</span>{l.text}
          </p>
        ))}
        {busy && live && <p className="text-center text-[12px] text-white/50">对方正在说话…</p>}
      </div>
      {live && (
        <div className="flex items-center gap-2 px-4 pb-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) say(); }}
            placeholder="说点什么…" className="flex-1 rounded-full bg-white/10 px-4 py-2 text-[14px] text-white outline-none placeholder:text-white/40" />
          <button onClick={say} disabled={!draft.trim() || busy} className="rounded-full bg-[#07c160] px-4 py-2 text-[13px] font-medium disabled:opacity-40">说</button>
        </div>
      )}
      <div className="flex justify-center pb-10 pt-2">
        <button onClick={hangup} aria-label="挂断" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fa5151] shadow-lg active:scale-95">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" style={{ transform: "rotate(135deg)" }}><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" /></svg>
        </button>
      </div>
    </div>
  );
}

/* —— 绿信聊天页零件 —— */
const WX_GREEN = "#07c160";
type SpeechRec = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; abort: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const SR: (new () => SpeechRec) | undefined = typeof window !== "undefined"
  ? ((window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition)
  : undefined;
const yuan = (n: number) => `¥${n.toFixed(2)}`;

/* 输入条圆圈图标（描边，仿原生） */
function CircleIco({ children }: { children: ReactNode }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="14" cy="14" r="12.25" />
      {children}
    </svg>
  );
}
const IcoVoice = () => <CircleIco><path d="M11 10.5a5 5 0 0 1 0 7M14.2 8a8.6 8.6 0 0 1 0 12" /><circle cx="8.6" cy="14" r="0.9" fill="currentColor" /></CircleIco>;
const IcoKeyboard = () => <CircleIco><rect x="7.5" y="9.5" width="13" height="9" rx="1.5" /><path d="M10 12.5h.01M12.7 12.5h.01M15.3 12.5h.01M18 12.5h.01M11 15.6h6" /></CircleIco>;
const IcoEmoji = () => <CircleIco><path d="M9.6 16.3a5.2 5.2 0 0 0 8.8 0" /><circle cx="10.7" cy="11.6" r="0.9" fill="currentColor" /><circle cx="17.3" cy="11.6" r="0.9" fill="currentColor" /></CircleIco>;
const IcoPlus = () => <CircleIco><path d="M14 8.5v11M8.5 14h11" /></CircleIco>;

/* ⊕ 面板图标 */
function TileIco({ k, size = 28 }: { k: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (k) {
    case "photo": return <svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="9.5" r="1.6" /><path d="m3.5 17 5-4.5 4 3.5 3-2.5 5 4" /></svg>;
    case "camera": return <svg {...p}><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.3" r="3.6" /></svg>;
    case "call": return <svg {...p}><path d="M20.5 16.4v2.7a1.8 1.8 0 0 1-2 1.8A17.6 17.6 0 0 1 3.1 5.5a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.8.3 1.6.6 2.4a1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.1 5.1l1.1-1.1a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.4.6a1.8 1.8 0 0 1 1.5 1.8Z" /></svg>;
    case "red": return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 8.5c2.2 1.6 4.5 2.4 7 2.4s4.8-.8 7-2.4" /><circle cx="12" cy="11" r="1.8" /></svg>;
    case "transfer": return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 10h8l-2.5-2.5M16 14H8l2.5 2.5" /></svg>;
    case "sticker": return <svg {...p}><path d="M20 12.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7.5" /><path d="M12.5 20 20 12.5h-6.5a1 1 0 0 0-1 1Z" /><path d="M8.5 13.5c1 1 2.3 1.3 3.5 1" /><circle cx="9" cy="9" r=".8" fill="currentColor" /><circle cx="15" cy="9" r=".8" fill="currentColor" /></svg>;
    case "watch": return <svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>;
    default: return <svg {...p}><rect x="3" y="4.5" width="18" height="12" rx="1.5" /><path d="M8.5 20h7M12 16.5V20" /></svg>;
  }
}

/* 长按：pointer 按住 450ms 或右键 */
function useLongPress(cb: () => void) {
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  return {
    onPointerDown: () => { clear(); t.current = setTimeout(() => { t.current = null; cb(); }, 450); },
    onPointerUp: clear, onPointerLeave: clear, onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clear(); cb(); },
  };
}

/* 气泡外壳：长按弹出深色菜单 */
function Pressable({ children, menu, open, onOpen, onClose, right }: { children: ReactNode; menu: { label: string; on: () => void }[]; open: boolean; onOpen: () => void; onClose: () => void; right: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  const lp = useLongPress(() => {
    const el = box.current;
    const sc = el?.closest(".overflow-y-auto");
    if (el && sc) setBelow(el.getBoundingClientRect().top - sc.getBoundingClientRect().top < 56);
    onOpen();
  });
  return (
    <div ref={box} className="relative select-none" {...lp}>
      {children}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
          <div className={`absolute z-50 flex overflow-hidden rounded-[8px] bg-[#4c4c4c] shadow-lg ${below ? "top-full mt-2" : "bottom-full mb-2"} ${right ? "right-0" : "left-0"}`}>
            {menu.map((it) => (
              <button key={it.label} onClick={(e) => { e.stopPropagation(); onClose(); it.on(); }} className="whitespace-nowrap px-3 py-2 text-[13px] text-white active:bg-white/10">{it.label}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* 红包 / 转账 气泡 */
function MoneyBubble({ m, mine, onOpen }: { m: XMsg; mine: boolean; onOpen: () => void }) {
  const { game } = useGame();
  const brand = useCommsBrand();
  const red = m.kind === "redpacket";
  const back = m.pstate === "returned";
  const done = back || (red ? m.pstate === "claimed" : m.pstate === "received");
  const own = mine && !isReceipt(m); // 自己发出的原卡片（不是自己点的收款回执）
  const bg = done ? "#fde3c8" : "#fa9d3b";
  return (
    <div onClick={onOpen} role="button" className="relative w-[210px] max-w-full cursor-pointer rounded-[4px] active:brightness-95" style={{ background: bg }}>
      <span className={`absolute top-[14px] h-2.5 w-2.5 rotate-45 ${mine ? "-right-1" : "-left-1"}`} style={{ background: bg }} />
      <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3 text-white">
        {red ? (
          <svg width="30" height="36" viewBox="0 0 30 36" aria-hidden><rect width="30" height="36" rx="3" fill={done ? "#fbd1a6" : "#f3533d"} /><path d="M0 9c5 4 10 6 15 6s10-2 15-6" stroke={done ? "#f8bf86" : "#d8402b"} strokeWidth="1.6" fill="none" /><circle cx="15" cy="15" r="4.2" fill="#fcd68a" /></svg>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-white/90">
            {done ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 9h12l-3-3M18 15H6l3 3" /></svg>}
          </span>
        )}
        <div className="min-w-0 leading-tight">
          {red ? (
            <>
              <p className="truncate text-[15px]">{m.note || "恭喜发财，大吉大利"}</p>
              {done && <p className="mt-0.5 text-[12px] text-white/90">{back ? "已退回" : mine ? "已被领取" : "已领取"}</p>}
            </>
          ) : (
            <>
              <p className="text-[16px] font-medium">{game ? wallet.fmt(m.amount ?? 0, game, yuan) : yuan(m.amount ?? 0)}</p>
              <p className="mt-0.5 truncate text-[12px] text-white/90">{back ? (own ? "已被退还" : "已退还") : m.pstate === "received" ? (own ? "已被接收" : "已收款") : m.note || "请收款"}</p>
            </>
          )}
        </div>
      </div>
      <p className="mx-3 border-t border-white/30 py-1 text-[11px]" style={{ color: done ? "#c99a6b" : "#fde6cd" }}>{brand.appName}{red ? "红包" : "转账"}</p>
    </div>
  );
}

/* 点开红包 / 转账：对方发来的可领取（真实入账游戏资金），自己发的查看状态 */
function MoneyOpenSheet({ m, from, onClose, onClaim }: { m: XMsg; from: string; onClose: () => void; onClaim: () => void }) {
  const { game } = useGame();
  const purse = game ? wallet.name(game, "零钱") : "零钱";
  const red = m.kind === "redpacket";
  const mine = m.role === "me";
  const receipt = isReceipt(m);
  const back = m.pstate === "returned";
  const done = back || (red ? m.pstate === "claimed" : m.pstate === "received");
  const canClaim = !mine && !done && !receipt;
  const status = receipt ? (back ? `已退回你的${purse}` : mine ? `已存入${purse}` : "对方已收款")
    : back ? (red ? `对方没有领取，已退回${purse}` : `对方已退还，已退回${purse}`)
    : done ? (mine ? (red ? "对方已领取" : "对方已收款") : `已存入${purse}`)
    : mine ? (red ? "等待对方领取" : "等待对方收款") : red ? "" : `确认收款后，将存入${purse}`;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 px-8" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[280px] overflow-hidden rounded-[10px] text-center" style={{ background: red ? "#f25542" : "#fff" }}>
        <div className={`px-5 pb-6 pt-8 ${red ? "text-[#fde6cd]" : "text-ink"}`}>
          <p className="text-[15px]">{receipt ? (back ? `${from}已退还` : `${mine ? "你" : from}已收款`) : red ? `${from}的红包` : mine ? "你发起的转账" : `${from}向你转账`}</p>
          <p className={`mt-2 truncate text-[17px] ${red ? "text-[#fff3e0]" : "text-ink-soft"}`}>{m.note || (red ? "恭喜发财，大吉大利" : "转账")}</p>
          {(done || mine || !red) && <p className={`mt-4 text-[32px] font-semibold tabular-nums ${red ? "text-[#fff6e5]" : "text-ink"}`}>{game ? wallet.fmt(m.amount ?? 0, game, yuan) : yuan(m.amount ?? 0)}</p>}
          <p className={`mt-2 text-[12.5px] ${red ? "text-[#fde6cd]/80" : "text-ink-soft"}`}>{status}</p>
        </div>
        {canClaim && (red ? (
          <button onClick={() => { onClaim(); onClose(); }} className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#e9c27b] text-[30px] font-semibold text-[#3a2a12] shadow-lg active:scale-95">開</button>
        ) : (
          <button onClick={() => { onClaim(); onClose(); }} className="mx-auto mb-6 block w-[180px] rounded-[6px] py-2.5 text-[16px] font-medium text-white" style={{ background: WX_GREEN }}>确认收款</button>
        ))}
        <button onClick={onClose} className={`block w-full border-t py-3 text-[14px] ${red ? "border-white/20 text-[#fde6cd]" : "border-black/10 text-[#576b95]"}`}>关闭</button>
      </div>
    </div>
  );
}

/* 发红包 / 转账：真实扣除游戏资金 */
function MoneySheet({ kind, to, balance, unit, onClose, onSend }: { kind: "redpacket" | "transfer"; to: string; balance: number; unit?: string; onClose: () => void; onSend: (amount: number, note: string) => void }) {
  const red = kind === "redpacket";
  // 绑定了自定义货币（灵石 / 金币…）：整数记账、不设红包 200 上限
  const fmt = (x: number) => (unit ? `${Math.round(x).toLocaleString("zh-CN")} ${unit}` : yuan(x));
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const n = unit ? Math.round(Number(amt)) : Math.round(Number(amt) * 100) / 100;
  const cap = red && !unit ? 200 : Infinity;
  const max = Math.min(cap, balance);
  const err = !amt ? "" : !(n > 0) ? "请输入金额" : n > balance ? `${unit ?? "零钱"}余额不足` : n > cap ? "单个红包金额不可超过 200 元" : "";
  const ok = n > 0 && n <= max;
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-[#ededed]">
      <div className="relative flex h-11 items-center px-3">
        <button onClick={onClose} className="text-[16px] text-ink">取消</button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-ink">{red ? "发红包" : `转账给${to}`}</span>
      </div>
      <div className="flex-1 space-y-3 px-4 pt-3">
        <div className="flex items-center rounded-[6px] bg-white px-4 py-3.5">
          <span className="text-[16px] text-ink">金额</span>
          <input autoFocus inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))} placeholder={unit ? "0" : "0.00"} className="flex-1 bg-transparent text-right text-[16px] text-ink outline-none placeholder:text-ink-soft/40" />
          <span className="ml-1 text-[16px] text-ink">{unit ?? "元"}</span>
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 20))} placeholder={red ? "恭喜发财，大吉大利" : "添加转账说明"} className="w-full rounded-[6px] bg-white px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-ink-soft/50" />
        <p className={`px-1 text-[12.5px] ${err ? "text-[#fa5151]" : "text-ink-soft"}`}>{err || `${unit ?? "零钱"}余额 ${fmt(balance)}`}</p>
        <p className="pt-6 text-center text-[40px] font-medium tabular-nums text-ink">{fmt(n > 0 ? n : 0)}</p>
        <button disabled={!ok} onClick={() => onSend(n, note.trim())} className="mx-auto block w-[180px] rounded-[6px] py-3 text-[16px] font-medium text-white disabled:opacity-40" style={{ background: red ? "#f25542" : WX_GREEN }}>
          {red ? "塞钱进红包" : "转账"}
        </button>
      </div>
      <p className="pb-6 text-center text-[11px] text-ink-soft/70">从钱包余额中扣除，对方不收会原路退回</p>
    </div>
  );
}

/* 聊天信息（右上 ···） */
function InfoToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${on ? "bg-[#07c160]" : "bg-[#e5e5e5]"}`} aria-pressed={on}>
      <span className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-[2px]"}`} />
    </button>
  );
}
function InfoRow({ label, right, onClick, center, last }: { label: string; right?: ReactNode; onClick?: () => void; center?: boolean; last?: boolean }) {
  return (
    <div onClick={onClick} role={onClick ? "button" : undefined} className={`flex min-h-[56px] items-center bg-white pl-4 ${onClick ? "cursor-pointer active:bg-[#f2f2f2]" : ""}`}>
      <div className={`flex min-h-[56px] flex-1 items-center pr-4 ${last ? "" : "border-b border-[#e5e5e5]"}`}>
        <span className={`flex-1 text-[16px] ${center ? "text-center text-[#fa5151]" : "text-ink"}`}>{label}</span>
        {right}
        {onClick && !center && !right && <span className="text-[18px] text-black/25">›</span>}
      </div>
    </div>
  );
}

function ChatInfoPage({ thread, onClose, onBg, onJump }: { thread: Thread; onClose: () => void; onBg: () => void; onJump: (id: string) => void }) {
  const { game, commitGame } = useGame();
  const strangers = useStrangers();
  const c = customOf(thread);
  const [q, setQ] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<false | "clear" | "delete">(false);
  const isGroup = thread.kind === "group";
  const canDelete = !isGroup && !!thread.personId && (game!.phone?.contacts ?? []).includes(thread.personId);
  const people = (isGroup ? thread.members ?? [] : [thread.personId!]).map((id) => {
    const n = game!.npcs.find((x) => x.id === id) ?? strangers[id];
    return { id, name: n?.name ?? "成员", avatar: n?.avatar };
  });
  const setC = (p: Partial<XCustom>) => commitGame(setThreadCustom(game!, thread.id, p as Partial<NonNullable<Thread["custom"]>>));
  const nameOf = (m: ChatMsg) => (m.role === "me" ? game!.player.name : isGroup ? people.find((p) => p.id === m.from)?.name ?? "成员" : thread.title);

  if (q !== null) {
    const k = q.trim();
    const hits = k ? thread.msgs.filter((m) => m.role !== "sys" && (m as XMsg).kind !== "recall" && m.text.includes(k)) : [];
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-white">
        <div className="flex items-center gap-2 bg-[#ededed] px-3 py-2">
          <div className="flex flex-1 items-center gap-1.5 rounded-[6px] bg-white px-2.5 py-1.5 text-ink-soft">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" className="flex-1 bg-transparent text-[15px] text-ink outline-none" />
          </div>
          <button onClick={() => setQ(null)} className="text-[16px] text-[#576b95]">取消</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!k && <p className="pt-10 text-center text-[13px] text-ink-soft">搜索指定内容</p>}
          {k && !hits.length && <p className="pt-10 text-center text-[13px] text-ink-soft">无结果</p>}
          {[...hits].reverse().map((m) => (
            <button key={m.id} onClick={() => { onJump(m.id); }} className="flex w-full gap-3 pl-4 text-left active:bg-[#f2f2f2]">
              <div className="flex min-w-0 flex-1 flex-col border-b border-[#e5e5e5] py-2.5 pr-4">
                <div className="flex text-[13px] text-ink-soft"><span className="flex-1 truncate">{nameOf(m)}</span><span>{wxTime(game!, m.gt)}</span></div>
                <p className="mt-0.5 truncate text-[15px] text-ink">{m.text.split(k).flatMap((s, i) => (i ? [<span key={i} className="text-[#07c160]">{k}</span>, s] : [s]))}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#ededed]">
      <div className="relative flex h-11 shrink-0 items-center px-2">
        <button onClick={onClose} className="flex items-center text-ink" aria-label="返回"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7" /></svg></button>
        <span className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-ink">{isGroup ? `聊天信息(${people.length + 1})` : "聊天信息"}</span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto pb-8">
        <div className="grid grid-cols-5 gap-y-3 bg-white px-3 py-4">
          {[...people, ...(isGroup ? [{ id: "me", name: game!.player.name, avatar: game!.player.avatar }] : [])].map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-1">
              <div className="overflow-hidden rounded-[4px]"><Avatar src={p.avatar} name={p.name} size={50} editable={false} /></div>
              <span className="w-full truncate text-center text-[11.5px] text-ink-soft">{p.name}</span>
            </div>
          ))}
        </div>
        {isGroup && <div><InfoRow label="群聊名称" right={<span className="max-w-[60%] truncate text-[15px] text-ink-soft">{thread.title}</span>} last /></div>}
        <div><InfoRow label="查找聊天记录" onClick={() => setQ("")} last /></div>
        <div>
          <InfoRow label="消息免打扰" right={<InfoToggle on={!!c.muted} onChange={(v) => setC({ muted: v })} />} />
          <InfoRow label="置顶聊天" right={<InfoToggle on={!!thread.pinned} onChange={() => commitGame(togglePinned(game!, thread.id))} />} last />
        </div>
        <div><InfoRow label="设置当前聊天背景" onClick={onBg} last /></div>
        <div><InfoRow label="清空聊天记录" onClick={() => setConfirm("clear")} last /></div>
        {canDelete && (
          <button onClick={() => setConfirm("delete")} className="block w-full bg-white py-3.5 text-center text-[16px] font-medium text-[#fa5151] active:bg-[#f2f2f2]">删除好友</button>
        )}
      </div>
      {confirm && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setConfirm(false)}>
          <div className="bg-[#f7f7f7]" onClick={(e) => e.stopPropagation()}>
            {confirm === "delete" ? (<>
              <p className="bg-white px-6 py-4 text-center text-[13px] leading-relaxed text-ink-soft">将「{thread.title}」从好友里删除，之后无法再给 TA 发消息。<br />TA 迟早会察觉，并在之后的剧情里做出反应。</p>
              <button onClick={() => { commitGame(removeFriend(game!, thread.personId!)); setConfirm(false); onClose(); }} className="block w-full border-t border-[#e5e5e5] bg-white py-3.5 text-[17px] text-[#fa5151]">删除好友</button>
            </>) : (<>
              <p className="bg-white px-6 py-4 text-center text-[13px] text-ink-soft">将删除与「{thread.title}」的聊天记录</p>
              <button onClick={() => { commitGame(patchThread(game!, thread.id, (t) => ({ ...t, msgs: [], unread: 0 }))); setConfirm(false); onClose(); }} className="block w-full border-t border-[#e5e5e5] bg-white py-3.5 text-[17px] text-[#fa5151]">清空聊天记录</button>
            </>)}
            <button onClick={() => setConfirm(false)} className="mt-2 block w-full bg-white py-3.5 pb-5 text-[17px] text-ink">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* 旁观群聊：复用 requestGroupReply，这段作为最后一条「旁白」传入，不是主角的发言 */
const WATCH_CUE =
  "【旁白，不是主角的发言】主角此刻没有在群里说话，也不会回复。请让群成员之间自然地接着聊一小段：顺着聊天记录往下说，冷场或刚建群时由最活跃的人起个话题；本轮 3~5 条，至少两位成员彼此接话、有来有回。不要对主角喊话、不要等主角回复，也不要提到有人在看群。memories 只给开口的成员、用其第一人称记下成员之间聊到的值得记住的具体的事，没有就留空；rel 与 love 留空对象。";

export function ChatView({ thread, onBack, sms, autoSend }: { thread: Thread; onBack: () => void; sms?: boolean; autoSend?: string }) {
  const wxSet = useWxSettings();
  const { game, commitGame, patchGame, cfg } = useGame();
  const { send, typingIn, busyStatus } = useChat();
  const liveRef = useRef(game);
  liveRef.current = game;
  const [allowOpen, setAllowOpen] = useState(false);
  const [allowAsk, setAllowAsk] = useState("");
  const [allowMsg, setAllowMsg] = useState("");
  const [allowBusy, setAllowBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const pid = thread.personId!;
  const strangers = useStrangers();
  const st = strangers[pid];
  const npc = game!.npcs.find((n) => n.id === pid) ?? (st ? { id: st.id, name: st.name, avatar: st.avatar, persona: { gender: st.gender } } as unknown as GameState["npcs"][number] : undefined);
  const [panel, setPanel] = useState<"emoji" | "sticker">("emoji");
  const [moreOpen, setMoreOpen] = useState(false);
  const [calling, setCalling] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [money, setMoney] = useState<"redpacket" | "transfer" | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [rec, setRec] = useState<{ text: string; cancel: boolean } | null>(null);
  const [showTr, setShowTr] = useState<Record<string, boolean>>({});
  const [flashId, setFlashId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  // 旁观群聊：每次请求一个序号；卸载 / 切换会话会让在途结果作废
  const [watching, setWatching] = useState(false);
  const watchSeq = useRef(0);
  const stopWatch = () => { watchSeq.current++; setWatching(false); };
  useEffect(() => () => stopWatch(), [thread.id]);
  // 主角在群里开口：本轮旁观立即收尾（剩下的发言本来也不会再写入）
  useEffect(() => {
    if (watching && thread.msgs[thread.msgs.length - 1]?.role === "me") stopWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.msgs.length]);
  const [feedback, setFeedback] = useState<string[]>([]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ threadId: string; lines: string[] }>).detail;
      if (d?.threadId !== thread.id) return;
      setFeedback(d.lines); clearTimeout(t); t = setTimeout(() => setFeedback([]), 3600);
    };
    window.addEventListener("phone:feedback", on);
    return () => { window.removeEventListener("phone:feedback", on); clearTimeout(t); };
  }, [thread.id]);
  const [quote, setQuote] = useState<string | null>(null);
  const [openMoney, setOpenMoney] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const look = chatLook(wxSet.chat, (thread.custom ?? {}) as XCustom);
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 1600); };
  const pickPhoto = async (f?: File) => {
    if (!f) return;
    try {
      const url = await fileToDataUrl(f);
      const cap = draft;
      setDraft("");
      setMoreOpen(false);
      void send(thread.id, cap, url, "photo");
    } catch { setShareErr("图片读取失败，换一张试试"); setTimeout(() => setShareErr(""), 2400); }
  };
  const sendSticker = (sid: string) => {
    const sk = STICKER_SET.find((x) => x.id === sid);
    if (sk) void send(thread.id, sk.name, sk.src, "sticker");
  };
  const isGroup = thread.kind === "group";
  const speaker = (m: ChatMsg) => (isGroup ? game!.npcs.find((n) => n.id === m.from) : npc);
  const typing = typingIn === thread.id || watching; // 旁观等待中复用「正在输入」气泡
  const hasReal = thread.msgs.some((m) => m.role !== "sys");
  const quicks = quickReplies(hasReal);
  const accent = sms ? "#0b8aff" : WX_GREEN;
  const lastEmo = [...thread.msgs].reverse().find((m) => m.role === "npc" && m.emo);
  const setMyAvatar = (src: string) => commitGame({ ...game!, player: { ...game!.player, avatar: src } });
  const ph = ensurePhone(game!).phone!;
  const otherUnread = sms ? 0 : ph.threads.reduce((a, t) => a + (t.id !== thread.id && !customOf(t).muted ? t.unread : 0), 0);

  // 「以下为新消息」：进入时的未读数
  const unreadAtOpen = useRef(thread.unread);
  const newFromIdx = (() => {
    let n = unreadAtOpen.current;
    if (n < 2) return -1;
    for (let i = thread.msgs.length - 1; i >= 0; i--) if (thread.msgs[i].role === "npc" && --n === 0) return i;
    return -1;
  })();

  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSend && !autoSent.current) { autoSent.current = true; void send(thread.id, autoSend); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);
  // 停在聊天页时，新消息即视为已读
  useEffect(() => {
    if (thread.unread > 0 || customOf(thread).markUnread) commitGame(setThreadCustom(markRead(game!, thread.id), thread.id, { markUnread: false } as Partial<NonNullable<Thread["custom"]>>));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, thread.msgs.length]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [thread.msgs.length, typing]);

  // 旁观群聊：主角不发言，让群成员之间自然聊一小轮，逐条写回本群
  const watchGroup = async () => {
    setMoreOpen(false);
    if (typing) return; // 正在回复或正在旁观：忽略重复点击
    if (!isConfigured(cfg)) { flash("需要先在右上角接入 AI，群里才会聊起来"); return; }
    const g0 = liveRef.current!;
    const th0 = g0.phone?.threads.find((t) => t.id === thread.id);
    const members = th0?.members ?? [];
    if (!th0 || members.length < 2) { flash("群里至少要有两位成员才能聊起来"); return; }
    const seq = ++watchSeq.current;
    const live = () => seq === watchSeq.current;
    let tail = th0.msgs[th0.msgs.length - 1]?.id;
    // 只在群里没有别的新消息时追加：主角中途开口或有新动静，本轮剩下的作废（也避免与 send 的本地状态互相覆盖）
    // make 返回 null：这条不用发（如成员想发的红包被频率限制拦下），不算作废
    const append = (make: (g: GameState) => ChatMsg | null): boolean => {
      let ok = false;
      patchGame((g) => {
        const th = g.phone?.threads.find((t) => t.id === th0.id);
        if (!live() || !th || th.msgs[th.msgs.length - 1]?.id !== tail) return g;
        ok = true;
        const m = make(g);
        if (!m) return g;
        tail = m.id;
        return pushMsg(g, th0.id, m);
      });
      return ok;
    };
    setWatching(true);
    try {
      const r = await requestGroupReply(cfg, g0, aiView(g0, th0).thread!, WATCH_CUE);
      if (!live()) return;
      let done = true;
      for (const [i, l] of r.lines.entries()) {
        await delay(i ? 600 + Math.min(1400, (l.text || "红包").length * 45) : 300); // 首条紧跟请求返回，后面按字数模拟打字
        const ok = (!l.text || append((g) => ({
          id: msgId(), role: "npc", from: l.id, text: l.text, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g),
          ...(l.emotion ? { emo: l.emotion, bpm: bpmOf(l.emotion) } : {}), ...(l.inner_os ? { os: l.inner_os } : {}),
        }))) && (!l.gift || append((g) => giftMsg(g, l.id, l.gift, true)));
        if (!ok) { done = false; break; }
      }
      // 记忆逐人写入（同一场群聊并成一条）；旁观不是互动，不结算好感 / 爱慕，也不把「主角在看群」记成成员知道的事
      if (done && live()) {
        patchGame((g) => members.reduce((next, id) => {
          const mem = r.memories[id]?.trim();
          return mem && !/旁观|围观|潜水|看群|不发言|没说话/.test(mem) ? applyChatEffects(next, id, { memory: mem, group: th0.title }) : next;
        }, g));
      }
    } catch {
      if (live()) flash("群里暂时没动静，检查一下网络或 AI 配置");
    } finally {
      if (live()) setWatching(false);
    }
  };

  const submit = () => {
    const t = draft;
    if (!t.trim()) return;
    const q = quote;
    setDraft("");
    setQuote(null);
    setShowEmoji(false);
    void send(thread.id, t, undefined, undefined, q ? { quote: q } : undefined).then((ok) => { if (!ok) { setDraft((d) => (d ? d : t)); if (q) setQuote(q); } });
  };
  // 快捷回复：一点即发（不经过输入框）
  const quickSend = (t: string) => {
    setShowEmoji(false);
    void send(thread.id, t);
  };
  // 失败重发：移除原消息后重发
  const resend = (m: XMsg) => {
    commitGame(patchThread(game!, thread.id, (t) => ({ ...t, msgs: t.msgs.filter((x) => x.id !== m.id) })));
    const { kind, img, text, dur, amount, note } = m;
    setTimeout(() => void send(thread.id, text, img, kind, { ...(dur ? { dur } : {}), ...(amount ? { amount, note } : {}) }), 0);
  };
  const jumpTo = (id: string) => {
    setInfoOpen(false);
    setTimeout(() => {
      scroller.current?.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({ block: "center" });
      setFlashId(id);
      setTimeout(() => setFlashId(null), 1500);
    }, 30);
  };
  const msgMenu = (m: XMsg) => {
    const items: { label: string; on: () => void }[] = [];
    if (m.text && !m.kind?.match(/sticker|redpacket|transfer/)) items.push({ label: "复制", on: () => { void navigator.clipboard?.writeText(m.text).then(() => flash("已复制"), () => {}); } });
    if (!m.kind?.match(/redpacket|transfer/)) items.push({ label: "引用", on: () => { const who = m.role === "me" ? game!.player.name : speaker(m)?.name ?? thread.title; setQuote(`${who}：${msgPreview(m).slice(0, 60)}`); setVoiceMode(false); setShowEmoji(false); setMoreOpen(false); setTimeout(() => taRef.current?.focus(), 0); } });
    if (!m.kind?.match(/redpacket|transfer/)) items.push({ label: "收藏", on: () => { addFav({ id: m.id, from: m.role === "me" ? game!.player.name : speaker(m)?.name ?? thread.title, text: m.kind === "voice" ? `[语音] ${m.text}` : m.text, img: m.kind === "photo" || m.kind === "sticker" ? m.img : undefined, ts: Date.now() }); flash("已收藏"); } });
    if (m.role === "me" && !m.failed && Date.now() - m.ts < 2 * 60 * 1000 && !m.amount) {
      items.push({ label: "撤回", on: () => commitGame(patchMsg(game!, thread.id, m.id, { role: "sys", kind: "recall", text: "你撤回了一条消息", note: m.kind ? undefined : m.text, img: undefined, status: undefined } as Partial<XMsg>)) });
    }
    items.push({ label: "删除", on: () => commitGame(patchThread(game!, thread.id, (t) => ({ ...t, msgs: t.msgs.filter((x) => x.id !== m.id) }))) });
    return items;
  };

  /* 按住说话：浏览器语音识别 → 语音气泡 + 转文字 */
  const recRef = useRef<{ r: SpeechRec; text: string; t0: number; y0: number; cancel: boolean } | null>(null);
  const holdStart = (e: React.PointerEvent) => {
    if (!SR || recRef.current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const r = new SR();
    r.lang = "zh-CN"; r.continuous = true; r.interimResults = true;
    const cur = { r, text: "", t0: Date.now(), y0: e.clientY, cancel: false };
    recRef.current = cur;
    r.onresult = (ev) => { cur.text = Array.from(ev.results).map((x) => x[0].transcript).join(""); setRec({ text: cur.text, cancel: cur.cancel }); };
    r.onerror = () => { /* 交给 onend */ };
    r.onend = () => {
      recRef.current = null;
      setRec(null);
      const text = cur.text.trim();
      const dur = Math.max(1, Math.min(60, Math.round((Date.now() - cur.t0) / 1000)));
      if (cur.cancel) return;
      if (!text) { flash("说话时间太短或未识别到内容"); return; }
      void send(thread.id, text, undefined, "voice", { dur });
    };
    try { r.start(); setRec({ text: "", cancel: false }); } catch { recRef.current = null; }
  };
  const holdMove = (e: React.PointerEvent) => {
    const cur = recRef.current;
    if (!cur) return;
    const c = cur.y0 - e.clientY > 60;
    if (c !== cur.cancel) { cur.cancel = c; setRec({ text: cur.text, cancel: c }); }
  };
  const holdEnd = () => { const cur = recRef.current; if (cur) { cur.t0 = cur.t0 || Date.now(); cur.r.stop(); } };

  const lastMineId = [...thread.msgs].reverse().find((x) => x.role === "me")?.id;
  const fontPx = WX_FONT_PX[wxSet.font];
  const textCls = (mine: boolean) => sms
    ? mine ? "rounded-[18px] rounded-br-md bg-[#0b8aff] px-3.5 py-2 text-white" : "rounded-[18px] rounded-bl-md bg-[#e9e9eb] px-3.5 py-2 text-ink"
    : look.cls(mine);
  const textStyle = (mine: boolean) => (sms ? undefined : look.style(mine, fontPx));
  const timeLabel = (m: ChatMsg) => (sms ? m.label : wxTime(game!, m.gt, true));
  const divider = (prev: ChatMsg | undefined, m: ChatMsg) => (sms ? needsDivider(prev, m) : !prev || m.gt - prev.gt > 5);
  const meCount = (n: number) => (n > 99 ? "99+" : String(n));

  return (
    <div className={`relative flex h-full flex-col ${sms ? "bg-[#f4f5f7]" : ""}`} style={sms ? undefined : { background: look.bg }} data-wx-chat-bg={!sms && !(thread.custom as XCustom | undefined)?.bg && !wxSet.chat.chatBg ? "default" : undefined}>
      {infoOpen && <ChatInfoPage thread={thread} onClose={() => setInfoOpen(false)} onBg={() => setSetOpen(true)} onJump={jumpTo} />}
      {setOpen && <ChatSettingsSheet thread={thread} onClose={() => setSetOpen(false)} />}
      {calling && <VoiceCall thread={thread} name={thread.title} avatar={npc?.avatar} onClose={() => setCalling(false)} />}
      {money && (
        <MoneySheet kind={money} to={thread.title} balance={wallet.balance(game!)} unit={walletDef(game!)?.label} onClose={() => setMoney(null)}
          onSend={(amount, note) => { const k = money; setMoney(null); setMoreOpen(false); void send(thread.id, k === "redpacket" ? note || "恭喜发财，大吉大利" : note, undefined, k, { amount, note, pstate: "pending" }); }} />
      )}
      {openMoney && (() => {
        const mm = thread.msgs.find((x) => x.id === openMoney) as XMsg | undefined;
        if (!mm) return null;
        const from = mm.role === "me" ? game!.player.name : speaker(mm)?.name ?? thread.title;
        return <MoneyOpenSheet m={mm} from={from} onClose={() => setOpenMoney(null)} onClaim={() => {
          const amt = mm.amount ?? 0;
          let g = patchMsg(game!, thread.id, mm.id, { pstate: mm.kind === "redpacket" ? "claimed" : "received" });
          g = wallet.add(g, amt);
          g = mm.kind === "redpacket"
            ? pushMsg(g, thread.id, { id: msgId(), role: "sys", text: `你领取了${from}的红包`, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g) })
            : pushMsg(g, thread.id, { id: msgId(), role: "me", text: "已收款", ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g), kind: "transfer", amount: amt, pstate: "received", ack: true } as XMsg);
          commitGame(g);
          flash(`${wallet.fmt(amt, game!, yuan)} 已存入${wallet.name(game!, "零钱")}`);
        }} />;
      })()}
      {zoom && (
        <div onClick={() => setZoom(null)} className="absolute inset-0 z-50 flex items-center justify-center bg-black p-0">
          <img src={(zoom) || undefined} alt="查看大图" className="max-h-full max-w-full object-contain" />
        </div>
      )}
      {rec && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          <div className={`flex w-40 flex-col items-center gap-2 rounded-[10px] px-3 py-4 text-white ${rec.cancel ? "bg-[#fa5151]/90" : "bg-black/70"}`}>
            <span>{rec.cancel ? <IconUndo size={34} /> : <IconMic size={34} />}</span>
            {rec.text && <span className="line-clamp-3 text-center text-[12.5px]">{rec.text}</span>}
            <span className="text-[12px] text-white/80">{rec.cancel ? "松开手指，取消发送" : "手指上滑，取消发送"}</span>
          </div>
        </div>
      )}
      {feedback.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-40 flex flex-col items-center gap-1 animate-[phoneBanner_.35s_cubic-bezier(.22,1,.36,1)]">
          {feedback.map((l) => (
            <span key={l} className={`rounded-full px-3 py-1 text-[12px] font-medium shadow-sm backdrop-blur ${/^好感 -/.test(l) ? "bg-[#ff3b30]/85 text-white" : /^好感/.test(l) ? "bg-[#07c160]/85 text-white" : "bg-black/65 text-white"}`}>{l}</span>
          ))}
        </div>
      )}
      {toast && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
          <span className="rounded-[8px] bg-black/75 px-4 py-2.5 text-[14px] text-white">{toast}</span>
        </div>
      )}
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }} />
      {shareOpen && (
        <ShareSheet
          onClose={() => setShareOpen(false)}
          onError={(m) => { setShareErr(m); setTimeout(() => setShareErr(""), 2400); }}
          onPick={(img) => { void send(thread.id, draft, img); setDraft(""); }}
        />
      )}
      {sms ? (
        <div className="flex items-center gap-2 border-b border-black/5 bg-white/90 px-3 py-2 backdrop-blur">
          <button onClick={onBack} className="text-[15px]" style={{ color: "#0b8aff" }}>‹ 返回</button>
          <div className="flex flex-1 flex-col items-center leading-tight"><span className="text-[15px] font-semibold text-ink">{thread.title}</span></div>
          <button onClick={() => commitGame(togglePinned(game!, thread.id))} title="置顶" className={`text-[16px] ${thread.pinned ? "text-amber-500" : "text-ink-soft/50"}`}><IconStar size={16} /></button>
        </div>
      ) : (
        <div className="relative flex h-11 shrink-0 items-center border-b border-black/[0.06] bg-[#ededed] px-2">
          <button onClick={onBack} className="z-10 flex items-center text-ink" aria-label="返回">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 5-7 7 7 7" /></svg>
            {otherUnread > 0 && <span className="text-[16px]">{meCount(otherUnread)}</span>}
          </button>
          <div className="pointer-events-none absolute inset-x-16 flex flex-col items-center leading-tight">
            <span className="max-w-full truncate text-[17px] font-semibold text-ink">{thread.title}{isGroup ? `(${(thread.members?.length ?? 0) + 1})` : ""}</span>
            {!isGroup && (typing ? <span className="text-[10.5px] text-ink-soft">对方正在输入...</span> : lastEmo?.emo && (
              <span className="flex items-center gap-1 text-[10.5px] text-ink-soft">
                <EmotionBadge id={lastEmo.emo} />
                <span className="heart-beat inline-flex text-[#fa5151]"><IconHeart size={12} /></span>
                <span className="tabular-nums">{lastEmo.bpm}</span>
              </span>
            ))}
          </div>
          <button onClick={() => setInfoOpen(true)} aria-label="聊天信息" className="z-10 ml-auto px-1 text-ink">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </button>
        </div>
      )}

      <div ref={scroller} onClick={() => { setShowEmoji(false); setMoreOpen(false); }} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {thread.msgs.map((m0, i) => {
          const m = m0 as XMsg;
          // 旧记录里模型写成的「（已读不回）」/第三人称旁白：不当消息显示
          if (m.role === "npc" && !m.kind && !m.img && notAMessage(m.text, speaker(m)?.name ?? "")) return null;
          const prev = thread.msgs[i - 1];
          const mine = m.role === "me";
          const isCall = m.role === "sys" && m.kind === "call";
          const right = mine || isCall;
          return (
            <div key={m.id} data-mid={m.id} className={`rounded transition-colors ${flashId === m.id ? "bg-black/[0.06]" : ""}`}>
              {i === newFromIdx && (
                <div className="my-2 flex items-center gap-2 text-[12px] text-ink-soft/80"><span className="h-px flex-1 bg-black/10" />以下为新消息<span className="h-px flex-1 bg-black/10" /></div>
              )}
              {divider(prev, m) && (
                <p className="mb-3 mt-1 text-center text-[12px] text-[#b2b2b2]">{sms ? <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[10.5px] text-ink-soft">{m.label}</span> : timeLabel(m)}</p>
              )}
              {m.role === "sys" && !isCall ? (
                <p className="px-6 text-center text-[12px] leading-relaxed text-[#9a9a9a]">
                  {m.kind === "redpacket" || /领取了你的红包$/.test(m.text) ? <><span className="mr-1 inline-block h-3 w-2.5 rounded-[2px] bg-[#f3533d] align-[-1px]" />{m.text.replace("红包", "")}<span className="text-[#fa9d3b]">红包</span></> : m.text}
                  {m.kind === "recall" && m.note && <button onClick={() => setDraft(m.note!)} className="ml-1.5 text-[#576b95]">重新编辑</button>}
                </p>
              ) : (
                <div className={`bubble-in flex items-start gap-2.5 ${right ? "flex-row-reverse" : ""}`}>
                  <div className="shrink-0 overflow-hidden" style={{ borderRadius: sms ? 4 : look.avatarRadius }}>
                    {!right
                      ? <Avatar src={speaker(m)?.avatar} name={speaker(m)?.name ?? thread.title} size={40} editable={false} />
                      : <Avatar src={game!.player.avatar} name={game!.player.name} size={40} onPick={setMyAvatar} />}
                  </div>
                  <div className={`flex max-w-[70%] flex-col ${right ? "items-end" : "items-start"}`}>
                    {isGroup && !right && <span className="mb-1 text-[12px] text-[#9a9a9a]">{speaker(m)?.name ?? "成员"}</span>}
                    <div className="flex items-center gap-2" style={{ flexDirection: right ? "row-reverse" : "row" }}>
                    <Pressable right={right} open={menuFor === m.id} onOpen={() => !sms && !isCall && setMenuFor(m.id)} onClose={() => setMenuFor(null)} menu={menuFor === m.id ? msgMenu(m) : []}>
                    {isCall ? (
                      <div onClick={() => !isGroup && setCalling(true)} style={textStyle(true)} className={`${textCls(true)} flex cursor-pointer items-center gap-1.5`}>
                        <span>{m.text.replace(/^语音通话 · /, "")}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 15.5c-1.2 0-2.5-.2-3.6-.6a1 1 0 0 0-1 .25l-2.2 2.2a15 15 0 0 1-6.6-6.6l2.2-2.2a1 1 0 0 0 .25-1A11.4 11.4 0 0 1 8.5 4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-3.5a1 1 0 0 0-1-1Z" /></svg>
                      </div>
                    ) : (m.kind === "redpacket" || m.kind === "transfer") ? (
                      <MoneyBubble m={m} mine={mine} onOpen={() => setOpenMoney(m.id)} />
                    ) : m.kind === "voice" ? (
                      <div onClick={() => {
                        // 点开语音：用说话人的声音念出来（性别 / 音色 / 情绪与文字气泡一致）并显示文字；再点一下收起并停播
                        const open = !showTr[m.id];
                        setShowTr((s) => ({ ...s, [m.id]: open }));
                        if (!open) stopSpeech();
                        else if (mine) speakOut(m.text, game!.player.gender, "player");
                        else speakOut(m.text, speakerGender(game!, speaker(m)?.id), speaker(m)?.id, speaker(m)?.persona?.ttsVoice, m.emo);
                      }} style={{ ...textStyle(mine), width: `min(100%, ${Math.round(64 + Math.min(60, m.dur ?? 1) * 2.6)}px)` }}
                        className={`${textCls(mine)} flex cursor-pointer items-center gap-1.5 ${mine ? "justify-end" : ""}`}>
                        {mine && <span>{m.dur ?? 1}"</span>}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={mine ? { transform: "scaleX(-1)" } : undefined}><circle cx="6" cy="12" r="1.2" fill="currentColor" /><path d="M10 8.5a5 5 0 0 1 0 7M13.5 5.5a9.5 9.5 0 0 1 0 13" /></svg>
                        {!mine && <span>{m.dur ?? 1}"</span>}
                      </div>
                    ) : m.kind === "sticker" && m.img ? (
                      <img src={(m.img) || undefined} alt={m.text} onClick={() => setZoom(m.img!)} className="h-28 w-28 cursor-zoom-in object-contain" draggable={false} />
                    ) : m.kind === "photo" && m.img ? (
                      <div className="flex flex-col gap-1" style={{ alignItems: mine ? "flex-end" : "flex-start" }}>
                        <img src={(m.img) || undefined} alt="图片" onClick={() => setZoom(m.img!)} className="max-h-52 max-w-[160px] cursor-zoom-in rounded-[4px] object-cover" draggable={false} />
                        {m.text && <div style={textStyle(mine)} className={`whitespace-pre-wrap break-words leading-[1.45] ${textCls(mine)}`}>{m.text}</div>}
                      </div>
                    ) : (<>
                      {m.img && <span className="mb-1 inline-flex items-center gap-1 text-[10.5px] text-ink-soft"><IconMonitor size={12} /> 屏幕共享</span>}
                      <div
                        onClick={!mine && !sms ? () => speakOut(m.text, speakerGender(game!, speaker(m)?.id), speaker(m)?.id, speaker(m)?.persona?.ttsVoice, m.emo) : undefined}
                        style={textStyle(mine)}
                        className={`whitespace-pre-wrap break-words text-[15px] leading-[1.45] ${textCls(mine)}`}
                      >
                        {m.img && <img src={(m.img) || undefined} alt="屏幕共享" onClick={(e) => { e.stopPropagation(); setZoom(m.img!); }} className={`max-h-56 cursor-zoom-in rounded-[4px] object-contain ${m.text ? "mb-1.5" : ""}`} />}
                        {m.text}
                      </div>
                    </>)}
                    </Pressable>
                    {m.failed && (
                      <button onClick={() => resend(m)} aria-label="重新发送" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fa5151] text-[13px] font-bold text-white">!</button>
                    )}
                    </div>
                    {m.quote && (
                      <div className="mt-1 max-w-full truncate rounded-[3px] bg-black/[0.06] px-2 py-1 text-[12px] text-[#7f7f7f]">{m.quote}</div>
                    )}
                    {m.kind === "voice" && showTr[m.id] && (
                      <div className="mt-1.5 max-w-full rounded-[4px] bg-white px-3 py-2 text-[14px] leading-snug text-ink">{m.text}</div>
                    )}
                    {m.role === "npc" && m.emo && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10.5px] text-ink-soft">
                        <EmotionBadge id={m.emo} bpm={m.bpm} />
                      </span>
                    )}
                    {m.role === "npc" && m.os && (
                      <div className="mt-1 max-w-full rounded-xl border border-dashed border-[#c9a3ff] bg-[#f6f0ff]/95 px-2.5 py-1.5 text-[12px] leading-snug text-[#5b3f86]">
                        <InnerOsLabel text={m.os} />
                      </div>
                    )}
                    {mine && m.status && !m.failed && (m.id === lastMineId || m.status === "busy") && <span className="mt-0.5 text-[10.5px] text-[#b2b2b2]">{STATUS_LABEL[m.status]}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="bubble-in flex items-start gap-2.5">
            <div className="overflow-hidden rounded-[4px]">{isGroup ? <span className="flex h-10 w-10 items-center justify-center bg-black/10 text-ink-soft" aria-hidden><IconUsers size={18} /></span> : <Avatar src={npc?.avatar} name={thread.title} size={40} editable={false} />}</div>
            <div className={sms ? "rounded-[18px] bg-[#e9e9eb] px-4 py-3" : "wx-bubble wx-bubble-left rounded-[4px] bg-white px-4 py-3"}>
              <span className="inline-flex items-end gap-1"><Dot /><Dot /><Dot /></span>
            </div>
          </div>
        )}
      </div>

      {shareErr && <p className="bg-amber-50 px-3 py-1.5 text-center text-[12px] text-amber-700">{shareErr}</p>}
      {busyStatus && <p className="bg-amber-50 px-3 py-1.5 text-center text-[12px] text-amber-700">{busyStatus}</p>}

      {/* 旁观中：群友们在聊，可随时停止（主角直接开口也会自动结束） */}
      {watching && (
        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12.5px] text-[#7f7f7f]">
          <TileIco k="watch" size={14} />
          <span>旁观中，群友们正在聊</span>
          <button onClick={stopWatch} className="ml-1 font-medium text-[#576b95]">停止</button>
        </div>
      )}

      {/* 快捷回复：输入框为空且对方未在输入时，横排可点即发的常用话 */}
      {!draft.trim() && !typing && !showEmoji && !moreOpen && !voiceMode && (
        <div className={`no-scrollbar flex gap-2 overflow-x-auto px-3 py-1.5 ${sms ? "bg-white/90" : ""}`}>
          {isGroup && (
            <button onClick={() => void watchGroup()} className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] transition active:scale-95" style={{ background: "rgba(255,255,255,0.85)", color: "#576b95" }}>
              <TileIco k="watch" size={14} />旁观一会
            </button>
          )}
          {quicks.map((q) => (
            <button
              key={q}
              onClick={() => quickSend(q)}
              className="shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] transition active:scale-95"
              style={sms ? { border: `1px solid ${accent}55`, color: accent, background: `${accent}12` } : { background: "rgba(255,255,255,0.85)", color: "#576b95" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 父母：聊聊生活费（成败与金额由代码判定，AI 只负责说话） */}
      {!sms && thread.kind === "private" && allowanceOn() && pid === payerId() && (
        <div className="border-t border-black/5 bg-[#f7f7f7] px-3 py-1.5">
          {!allowOpen ? (
            <button type="button" onClick={() => { setAllowOpen(true); setAllowMsg(""); }} className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-3 py-1 text-[12.5px] font-bold text-[#07c160] active:bg-black/5"><IconMessage size={14} /> 聊聊生活费</button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <input autoFocus value={allowAsk} onChange={(e) => setAllowAsk(e.target.value.slice(0, 80))} placeholder="怎么开口？如：这个月要买教材，能不能多给点…"
                  className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#07c160]" />
                <button type="button" disabled={allowBusy || !allowAsk.trim()} onClick={async () => {
                  setAllowBusy(true);
                  const err = await talkAllowance({ cfg, get: () => liveRef.current, commit: commitGame }, allowAsk.trim());
                  setAllowBusy(false); setAllowMsg(err ?? ""); if (!err) { setAllowAsk(""); setAllowOpen(false); }
                }} className="shrink-0 rounded-lg bg-[#07c160] px-3 text-[13px] font-bold text-white disabled:opacity-40">{allowBusy ? "…" : "开口"}</button>
                <button type="button" onClick={() => setAllowOpen(false)} className="shrink-0 px-1 text-[12px] text-black/45">取消</button>
              </div>
              {allowMsg && <p className="text-[11.5px] text-[#fa5151]">{allowMsg}</p>}
            </div>
          )}
        </div>
      )}

      {sms ? (
        /* iMessage 输入条：圆框 + 蓝色上箭头发送 */
        <>
        {showEmoji && (
          <div className="grid grid-cols-8 gap-1 border-t border-black/5 bg-white px-2 py-2">
            {CHAT_EMOJIS.map((e) => <button key={e} onClick={() => setDraft((d) => d + e)} className="flex aspect-square items-center justify-center rounded-lg text-[22px] active:bg-black/10">{e}</button>)}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2">
          <button onClick={() => setShowEmoji((v) => !v)} aria-label="表情" className={showEmoji ? "text-[#0b8aff]" : "text-ink-soft/50"}><IconSmiley size={22} /></button>
          <div className="flex flex-1 items-center rounded-[18px] border border-black/15 py-1 pl-3 pr-1">
            <input
              value={draft}
              onFocus={() => setShowEmoji(false)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="发条信息…"
              className="flex-1 bg-transparent text-[14.5px] text-ink outline-none placeholder:text-ink-soft/50"
            />
            <button onClick={submit} disabled={!draft.trim()} aria-label="发送" className="flex h-7 w-7 items-center justify-center rounded-full text-white disabled:opacity-30" style={{ background: "#0b8aff" }}><IconArrowUp size={16} /></button>
          </div>
        </div>
        </>
      ) : (
        <div className="border-t border-black/[0.08] bg-[#f7f7f7]">
          {/* 微信输入条：语音 / 输入框 / 表情 / 加号，有字才显示绿色「发送」 */}
          <div className="flex items-end gap-2 px-2 py-2 text-[#181818]">
            {SR && (
              <button onClick={() => { setVoiceMode((v) => !v); setShowEmoji(false); setMoreOpen(false); }} className="mb-[4px] shrink-0" aria-label={voiceMode ? "键盘" : "语音"}>{voiceMode ? <IcoKeyboard /> : <IcoVoice />}</button>
            )}
            {voiceMode ? (
              <button onPointerDown={holdStart} onPointerMove={holdMove} onPointerUp={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => e.preventDefault()}
                className={`h-9 flex-1 select-none rounded-[6px] text-[15px] font-medium ${rec ? "bg-[#c7c7c7] text-ink" : "bg-white text-ink"}`}>
                {rec ? "松开 发送" : "按住 说话"}
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
              <textarea
                ref={taRef}
                rows={1}
                value={draft}
                onFocus={() => { setShowEmoji(false); setMoreOpen(false); }}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && wxSet.enterSend) { e.preventDefault(); submit(); }
                }}
                className="max-h-24 min-h-9 w-full resize-none rounded-[6px] bg-white px-2.5 py-[6px] text-[16px] leading-[1.5] text-ink outline-none"
              />
              {quote && (
                <div className="flex items-center gap-1 rounded-[4px] bg-[#e6e6e6] px-2 py-1 text-[12px] text-[#7f7f7f]">
                  <span className="min-w-0 flex-1 truncate">{quote}</span>
                  <button onClick={() => setQuote(null)} aria-label="取消引用" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#b2b2b2] text-[10px] leading-none text-white"><IconClose size={14} /></button>                </div>
              )}
              </div>
            )}
            <button onClick={() => { setMoreOpen(false); setVoiceMode(false); setShowEmoji((v) => !v); }} className="mb-[4px] shrink-0" aria-label={showEmoji ? "键盘" : "表情"}>{showEmoji ? <IcoKeyboard /> : <IcoEmoji />}</button>
            {draft.trim() && !voiceMode ? (
              <button onClick={submit} className="mb-[2px] shrink-0 rounded-[4px] px-3 py-[7px] text-[14px] font-medium text-white" style={{ background: WX_GREEN }}>发送</button>
            ) : (
              <button onClick={() => { setShowEmoji(false); setMoreOpen((v) => !v); }} className="mb-[4px] shrink-0" aria-label="更多功能"><IcoPlus /></button>
            )}
          </div>

          {/* 表情面板：表情插入输入框 / 表情包直接发送 */}
          {showEmoji && (
            <div className="border-t border-black/[0.06]">
              {panel === "sticker" ? (
                <div className="grid max-h-52 grid-cols-4 gap-2 overflow-y-auto px-3 py-2">
                  {STICKER_SET.map((sk) => (
                    <button key={sk.id} onClick={() => sendSticker(sk.id)} className="rounded-lg p-1 transition active:scale-95 active:bg-black/10" title={sk.name}>
                      <img src={(sk.src) || undefined} alt={sk.name} className="aspect-square w-full" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid max-h-52 grid-cols-8 gap-1 overflow-y-auto px-2 py-2">
                  {CHAT_EMOJIS.map((e) => (
                    <button key={e} onClick={() => setDraft((d) => d + e)} className="flex aspect-square items-center justify-center rounded-lg text-[24px] transition active:bg-black/10">{e}</button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 border-t border-black/[0.06] bg-white px-2 py-1">
                {(["emoji", "sticker"] as const).map((k) => (
                  <button key={k} onClick={() => setPanel(k)} className={`rounded-[6px] px-3 py-1 text-[13px] ${panel === k ? "bg-[#ededed]" : ""}`} aria-label={k === "emoji" ? "表情" : "表情包"}>{k === "emoji" ? "表情" : "表情包"}</button>
                ))}
                <button onClick={submit} disabled={!draft.trim()} className="ml-auto rounded-[4px] px-4 py-1.5 text-[14px] font-medium text-white disabled:bg-[#e5e5e5] disabled:text-[#b2b2b2]" style={draft.trim() ? { background: WX_GREEN } : undefined}>发送</button>
              </div>
            </div>
          )}

          {/* ⊕ 功能面板 */}
          {moreOpen && (
            <div className="grid grid-cols-4 gap-x-4 gap-y-4 border-t border-black/[0.06] px-6 pb-6 pt-5">
              {[
                { k: "photo", label: "相册", on: () => photoRef.current?.click() },
                { k: "camera", label: "拍摄", on: () => camRef.current?.click() },
                ...(!isGroup ? [{ k: "call", label: "语音通话", on: () => { setMoreOpen(false); setCalling(true); } }] : [{ k: "watch", label: "旁观群聊", on: () => void watchGroup() }]),
                { k: "red", label: "红包", on: () => setMoney("redpacket") },
                ...(!isGroup ? [{ k: "transfer", label: "转账", on: () => setMoney("transfer") }] : []),
                { k: "sticker", label: "表情包", on: () => { setMoreOpen(false); setPanel("sticker"); setShowEmoji(true); } },
                { k: "share", label: "屏幕共享", on: () => { setMoreOpen(false); setShareOpen(true); } },
              ].map((a) => (
                <button key={a.k} onClick={a.on} className="flex flex-col items-center gap-1.5">
                  <span className="flex h-[58px] w-[58px] items-center justify-center rounded-[14px] bg-white text-[#3c3c3c]"><TileIco k={a.k} /></span>
                  <span className="text-[12px] text-[#7f7f7f]">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
