/* 通用聊天：useChat（发消息 → AI 逐条回复落库）+ ChatView（微信/短信共用视图） */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
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
  type ChatMsg,
  type Thread,
} from "../../game/phone";
import { requestChatReply } from "../../lib/phoneChat";
import { isConfigured } from "../../lib/ai";
import type { GameState } from "../../lib/types";
import { delay, Dot } from "./shared";
import { IconPlus, IconArrowUp, IconMic, IconSmiley } from "./icons";

/* 发消息 → AI 回复逐条落库。全程串行 thread 本地 game，避免异步中读到过期状态。 */
export function useChat() {
  const { game, cfg, commitGame } = useGame();
  const gRef = useRef<GameState>(game!);
  gRef.current = game!;
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<string>("");

  async function send(threadId: string, text: string): Promise<boolean> {
    if (!text.trim()) return false;
    if (!isConfigured(cfg)) {
      setBusyStatus("需要先在右上角接入 AI，对方才能回复你");
      setTimeout(() => setBusyStatus(""), 2600);
      return false;
    }
    let g = gRef.current;
    const gt = gameMinutes(g);
    const label = gameTimeLabel(g);
    const mine: ChatMsg = { id: msgId(), role: "me", text: text.trim(), ts: Date.now(), gt, label, status: "sending" };
    g = pushMsg(g, threadId, mine);
    commitGame(g);
    await delay(350);
    g = setMsgStatus(g, threadId, [mine.id], "unread");
    commitGame(g);

    const thread = ensurePhone(g).phone!.threads.find((t) => t.id === threadId);
    if (!thread || !thread.personId) return true;
    const pid = thread.personId;

    setTypingIn(threadId);
    let reply;
    try {
      reply = await requestChatReply(cfg, g, thread, text.trim());
    } catch {
      setTypingIn(null);
      setBusyStatus("消息发送失败，检查一下网络或 AI 配置");
      setTimeout(() => setBusyStatus(""), 2600);
      return true;
    }

    g = setMsgStatus(g, threadId, [mine.id], "read");
    commitGame(g);

    if (reply.busy) {
      await delay(600);
      setTypingIn(null);
      g = setMsgStatus(g, threadId, [mine.id], "busy");
      commitGame(g);
    }

    if (reply.read_only || reply.bubbles.length === 0) {
      setTypingIn(null);
      if (reply.mood || reply.rel_delta || reply.stress_delta) {
        g = applyChatEffects(g, pid, { relDelta: reply.rel_delta, mood: reply.mood, stressDelta: reply.stress_delta });
        commitGame(g);
      }
      return true;
    }

    for (const b of reply.bubbles) {
      await delay(500 + Math.min(1400, b.length * 45));
      const nm: ChatMsg = { id: msgId(), role: "npc", text: b, ts: Date.now(), gt: gameMinutes(g), label: gameTimeLabel(g) };
      g = pushMsg(g, threadId, nm);
      commitGame(g);
    }
    setTypingIn(null);
    g = applyChatEffects(g, pid, { relDelta: reply.rel_delta, mood: reply.mood, memory: reply.memory, stressDelta: reply.stress_delta });
    commitGame(g);
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

export function ChatView({ thread, onBack, sms }: { thread: Thread; onBack: () => void; sms?: boolean }) {
  const { game, commitGame } = useGame();
  const { send, typingIn, busyStatus } = useChat();
  const [draft, setDraft] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const pid = thread.personId!;
  const npc = game!.npcs.find((n) => n.id === pid);
  const typing = typingIn === thread.id;
  const hasReal = thread.msgs.some((m) => m.role !== "sys");
  const quicks = quickReplies(hasReal);
  const accent = sms ? "#0b8aff" : "#07c160";

  useEffect(() => {
    if (thread.unread > 0) commitGame(markRead(game!, thread.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [thread.msgs.length, typing]);

  const submit = () => {
    const t = draft;
    if (!t.trim()) return;
    setDraft("");
    setShowEmoji(false);
    void send(thread.id, t).then((ok) => { if (!ok) setDraft((d) => (d ? d : t)); });
  };
  // 快捷回复：一点即发（不经过输入框）
  const quickSend = (t: string) => {
    setShowEmoji(false);
    void send(thread.id, t);
  };

  return (
    <div className={`flex h-full flex-col ${sms ? "bg-[#f4f5f7]" : "bg-[#ededed]"}`}>
      <div className={`flex items-center gap-2 border-b border-black/5 px-3 py-2.5 backdrop-blur ${sms ? "bg-white/90" : "bg-[#ededed]"}`}>
        <button onClick={onBack} className="text-[15px]" style={{ color: sms ? "#0b8aff" : undefined }}>‹ 返回</button>
        <span className="flex-1 text-center text-[15px] font-semibold text-ink">{thread.title}</span>
        <button onClick={() => commitGame(togglePinned(game!, thread.id))} title="收藏/置顶" className={`text-[16px] ${thread.pinned ? "text-amber-500" : "text-ink-soft/50"}`}>{sms ? "ⓘ" : "···"}</button>
      </div>

      <div ref={scroller} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {thread.msgs.map((m, i) => {
          const prev = thread.msgs[i - 1];
          return (
            <div key={m.id}>
              {needsDivider(prev, m) && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[10.5px] text-ink-soft">{m.label}</span>
                </div>
              )}
              {m.role === "sys" ? (
                <p className="my-2 text-center"><span className="rounded bg-black/[0.06] px-2 py-0.5 text-[11px] text-ink-soft">{m.text}</span></p>
              ) : (
                <div className={`bubble-in flex items-start gap-2 py-0.5 ${m.role === "me" ? "flex-row-reverse" : ""}`}>
                  <div className="mt-0.5 overflow-hidden rounded-md">
                    {m.role === "npc"
                      ? <Avatar src={npc?.avatar} name={thread.title} size={36} editable={false} />
                      : <Avatar src={game!.player.avatar} name={game!.player.name} size={36} editable={false} />}
                  </div>
                  <div className={`flex max-w-[70%] flex-col ${m.role === "me" ? "items-end" : "items-start"}`}>
                    <div
                      className={`text-[14.5px] leading-[1.5] ${
                        sms
                          ? m.role === "me"
                            ? "rounded-[18px] rounded-br-md bg-[#0b8aff] px-3.5 py-2 text-white"
                            : "rounded-[18px] rounded-bl-md bg-[#e9e9eb] px-3.5 py-2 text-ink"
                          : m.role === "me"
                            ? "wx-bubble wx-bubble-right rounded-lg bg-[#95ec69] px-3 py-2 text-[#1a1a1a]"
                            : "wx-bubble wx-bubble-left rounded-lg bg-white px-3 py-2 text-ink shadow-sm"
                      }`}
                    >
                      {m.text}
                    </div>
                    {m.role === "me" && m.status && <span className="mt-1 pr-1 text-[10.5px] text-ink-soft/80">{STATUS_LABEL[m.status]}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {typing && (
          <div className="bubble-in flex items-start gap-2">
            <div className="mt-0.5 overflow-hidden rounded-md"><Avatar src={npc?.avatar} name={thread.title} size={36} editable={false} /></div>
            <div className="wx-bubble wx-bubble-left rounded-lg bg-white px-4 py-3 shadow-sm">
              <span className="inline-flex items-end gap-1"><Dot /><Dot /><Dot /></span>
            </div>
          </div>
        )}
      </div>

      {busyStatus && <p className="bg-amber-50 px-3 py-1.5 text-center text-[12px] text-amber-700">{busyStatus}</p>}

      {/* 快捷回复：输入框为空且对方未在输入时，横排可点即发的常用话 */}
      {!draft.trim() && !typing && !showEmoji && (
        <div className={`no-scrollbar flex gap-2 overflow-x-auto px-3 py-2 ${sms ? "bg-white/90" : "bg-[#f7f7f7]"}`}>
          {quicks.map((q) => (
            <button
              key={q}
              onClick={() => quickSend(q)}
              className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] transition active:scale-95"
              style={{ borderColor: `${accent}55`, color: accent, background: `${accent}12` }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* 表情面板：点一枚插入输入框 */}
      {showEmoji && (
        <div className={`grid grid-cols-8 gap-1 border-t px-2 py-2 ${sms ? "border-black/5 bg-white" : "border-black/10 bg-[#f7f7f7]"}`}>
          {CHAT_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setDraft((d) => d + e)}
              className="flex aspect-square items-center justify-center rounded-lg text-[22px] transition active:bg-black/10"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {sms ? (
        /* iMessage 输入条：圆框 + 蓝色上箭头发送 */
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
      ) : (
        /* 微信输入条：语音 / 输入框 / 表情 / 加号，有字才显示绿色「发送」 */
        <div className="flex items-center gap-2.5 border-t border-black/10 bg-[#f7f7f7] px-2.5 py-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-black/15 text-ink/70" aria-label="语音"><IconMic size={17} /></button>
          <input
            value={draft}
            onFocus={() => setShowEmoji(false)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="发条消息…"
            className="h-8 flex-1 rounded-[6px] bg-white px-2.5 text-[15px] text-ink outline-none"
          />
          <button onClick={() => setShowEmoji((v) => !v)} className={showEmoji ? "text-[#07c160]" : "text-ink/70"} aria-label="表情"><IconSmiley size={20} /></button>
          {draft.trim() ? (
            <button onClick={submit} className="rounded-[5px] px-3 py-1.5 text-[13px] font-medium text-white" style={{ background: "#07c160" }}>发送</button>
          ) : (
            <button onClick={() => setShowEmoji((v) => !v)} className="text-ink/70" aria-label="更多表情"><IconPlus size={22} /></button>
          )}
        </div>
      )}
    </div>
  );
}
