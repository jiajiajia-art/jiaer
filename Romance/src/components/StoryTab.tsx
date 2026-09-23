import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useGame, useLive } from "../store/gameCtx";
import type { Npc, Segment, Turn } from "../lib/types";
import { IconRefresh, IconSend, IconSparkle } from "../lib/icons";
import { EntityText } from "./EntityText";
import { looksGarbled } from "../lib/ai";

/* 流式实时文本：单独订阅 LiveCtx，AI 逐帧吐字只重渲染这一小块，
 * 并让它自己把滚动容器滚到底，避免整页跟着刷新。 */
export function LiveNarration({ scrollRef }: { scrollRef: RefObject<HTMLDivElement | null> }) {
  const live = useLive();
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live, scrollRef]);
  return (
    <div className="animate-pop">
      {live ? (
        <p className="story-prose border-l-2 border-jade/25 pl-3 text-[14.5px] italic leading-relaxed text-ink-soft"><EntityText text={live} /></p>
      ) : (
        <p className="flex gap-1 pl-3 text-jade">
          <span className="typing-dot">●</span>
          <span className="typing-dot" style={{ animationDelay: "0.2s" }}>●</span>
          <span className="typing-dot" style={{ animationDelay: "0.4s" }}>●</span>
        </p>
      )}
    </div>
  );
}

/* 依名字取一个稳定的柔和渐变，作头像占位底色 */
const AVATAR_GRADS = [
  "from-[#a68bec] to-[#e2a6d6]",
  "from-[#8fb8f0] to-[#b6a6ec]",
  "from-[#e2a6d6] to-[#f0b7a0]",
  "from-[#9fd8c8] to-[#8fb8f0]",
  "from-[#eebb8f] to-[#e79ac9]",
];
function gradFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_GRADS[h % AVATAR_GRADS.length];
}

function SpeakerAvatar({ name, src }: { name: string; src?: string }) {
  if (src)
    return <img src={src} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-white/70 shadow-sm" />;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradFor(name)} text-[13px] font-semibold text-white ring-2 ring-white/70 shadow-sm`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/* AI 输出异常（一大段连续汉字、无标点）时的拦截卡片：不把乱码渲染给玩家，
 * 直接引导重新生成。regenerate 会用上一回合的输入原样重跑。 */
function GarbleNotice() {
  const { regenerate, busy } = useGame();
  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-danger/30 bg-danger/[0.06] px-3.5 py-3">
      <p className="text-[13px] font-semibold text-danger">AI 输出异常，请点击重新生成</p>
      <p className="text-[12px] leading-relaxed text-ink-soft">这段回复解析异常（疑似乱码），已为你拦截。点下方按钮用同样的行动重新生成。</p>
      <button
        onClick={() => regenerate()}
        disabled={busy}
        className="mt-0.5 flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-[#a68bec] to-[#e2a6d6] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
      >
        <IconRefresh width={14} height={14} /> {busy ? "重新生成中…" : "重新生成"}
      </button>
    </div>
  );
}

/* 单条剧情片段的呈现：旁白（左竖线斜体）/ 系统日志（终端风格居中）/ 人物对话（头像+气泡）。
 * tightTop 用于让连续的系统日志相互收紧。 */
function SegmentView({ s, npcs, tightTop }: { s: Segment; npcs: Npc[]; tightTop?: boolean }) {
  if (s.kind === "narration")
    return (
      <p className="story-prose border-l-2 border-jade/25 pl-3 text-[14.5px] italic leading-relaxed text-ink-soft">
        <EntityText text={s.text} />
      </p>
    );
  if (s.kind === "system")
    return (
      <div className={`flex items-center justify-center gap-2.5 text-gold/80 ${tightTop ? "-mt-2" : ""}`}>
        <span className="h-px w-6 shrink-0 bg-gradient-to-r from-transparent to-gold/30" aria-hidden />
        <span className="text-center text-[12px] font-mono leading-snug tracking-wide">
          <EntityText text={s.text} />
        </span>
        <span className="h-px w-6 shrink-0 bg-gradient-to-l from-transparent to-gold/30" aria-hidden />
      </div>
    );
  // 人物对话：真实对话框——左侧头像 + 名字 + 气泡（带小尖角）
  const npc = npcs.find((n) => n.name === s.speaker);
  return (
    <div className="flex items-end gap-2">
      <SpeakerAvatar name={s.speaker} src={npc?.avatar || undefined} />
      <div className="min-w-0 max-w-[82%]">
        <p className="mb-0.5 ml-1 text-[11.5px] font-medium text-jade/80">
          <EntityText text={s.speaker} />
        </p>
        <div className="relative w-fit max-w-full rounded-2xl rounded-bl-md border border-white/60 bg-white/70 px-3.5 py-2 text-[14px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_var(--dream-glow,rgba(0,0,0,0.15))] backdrop-blur-sm">
          <EntityText text={s.text} />
        </div>
      </div>
    </div>
  );
}

export function Segments({ segments, npcs, playerAvatar, playerName }: { segments: Segment[]; npcs: Npc[]; playerAvatar: string; playerName: string }) {
  // 乱码拦截：把所有文字拼起来判断，命中则整段替换为「重新生成」提示。
  const joined = segments.map((s) => s.text).join("\n");
  if (looksGarbled(joined)) return <GarbleNotice />;
  return (
    <div className="space-y-3">
      {segments.map((s, i) => (
        <SegmentView key={i} s={s} npcs={npcs} tightTop={segments[i - 1]?.kind === "system"} />
      ))}
    </div>
  );
}

/* 把一段旁白拆成「一句一句」的节拍：以中文/英文句末标点断句，保留标点。 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const re = /[^。！？…!?\n]*(?:[。！？…!?]+[」』”）\)]?|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const piece = m[0].trim();
    if (piece) out.push(piece);
    if (m.index === re.lastIndex) re.lastIndex++; // 防空匹配死循环
  }
  return out.length ? out : [text];
}

/* 把片段展开为「节拍」：对话/系统各占一拍，旁白按句拆成多拍——
 * 用于传统文字游戏式的「一句一句」逐拍显示。 */
function toBeats(segments: Segment[]): Segment[] {
  const beats: Segment[] = [];
  for (const s of segments) {
    if (s.kind === "narration") {
      for (const sent of splitSentences(s.text)) beats.push({ kind: "narration", text: sent });
    } else {
      beats.push(s);
    }
  }
  return beats;
}

/* 传统文字游戏式的分句逐拍显示：本回合的旁白与台词一拍一拍地出现，
 * 玩家轻触「继续」推进；全部读完后回调 onComplete，让下方选项浮现。 */
export function PacedSegments({
  segments,
  npcs,
  playerAvatar,
  playerName,
  onAdvance,
  onComplete,
}: {
  segments: Segment[];
  npcs: Npc[];
  playerAvatar: string;
  playerName: string;
  onAdvance?: () => void;
  onComplete?: () => void;
}) {
  const joined = segments.map((s) => s.text).join("\n");
  const beats = useMemo(() => toBeats(segments), [segments]);
  const [revealed, setRevealed] = useState(1);
  const doneRef = useRef(false);

  // 换了一回合（beats 变化）就从头开始逐拍显示
  useEffect(() => {
    setRevealed(1);
    doneRef.current = false;
  }, [beats]);

  const total = beats.length;
  const complete = revealed >= total;

  useEffect(() => {
    if (complete && !doneRef.current) {
      doneRef.current = true;
      onComplete?.();
    }
  }, [complete, onComplete]);

  if (looksGarbled(joined)) return <GarbleNotice />;

  const advance = () => {
    if (revealed < total) {
      setRevealed((r) => Math.min(r + 1, total));
      onAdvance?.();
    }
  };

  return (
    <div className="space-y-3">
      {beats.slice(0, revealed).map((s, i) => (
        <div key={i} className={i === revealed - 1 && revealed > 1 ? "animate-pop" : ""}>
          <SegmentView s={s} npcs={npcs} tightTop={beats[i - 1]?.kind === "system"} />
        </div>
      ))}
      {!complete && (
        <button
          onClick={advance}
          className="group flex w-full items-center justify-center gap-2 py-1.5 text-jade transition"
          aria-label="继续"
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-jade/30" aria-hidden />
          <span className="animate-pulse text-[12px] font-medium tracking-[0.25em]">轻触继续 ▾</span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-jade/30" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function StoryTab() {
  const { game, busy, submit } = useGame();
  const [input, setInput] = useState("");
  const [custom, setCustom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [game?.story.length, busy]);

  if (!game) return null;

  const send = (text: string) => {
    if (!text.trim() || busy) return;
    setInput("");
    setCustom(false);
    void submit(text.trim());
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto max-w-2xl space-y-6">
          {game.story.length === 0 && !busy && (
            <p className="py-16 text-center text-sm text-ink-soft">序幕即将拉开……</p>
          )}
          {game.story.map((t, idx) => {
            if (t.role === "player")
              return (
                <div key={t.id} className="flex items-end justify-end gap-2 animate-pop">
                  <div className="max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-br from-jade to-jade-deep px-3.5 py-2 text-[14px] leading-relaxed text-white shadow-[0_4px_16px_-8px_var(--dream-glow,rgba(0,0,0,0.2))]">
                    {t.segments.map((s) => (s.kind === "narration" ? s.text : "")).join("")}
                  </div>
                  <SpeakerAvatar name={game.player.name} src={game.player.avatar || undefined} />
                </div>
              );
            // 连续的「纯系统日志」turn 相互收紧，避免每条动作提示都隔开一大截
            const isSysTurn = (x?: Turn) => !!x && x.role === "ai" && x.segments.length > 0 && x.segments.every((s) => s.kind === "system");
            const tight = isSysTurn(t) && isSysTurn(game.story[idx - 1]);
            return (
              <div key={t.id} className={`animate-pop ${tight ? "-mt-4" : ""}`}>
                <Segments segments={t.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
              </div>
            );
          })}

          {/* 流式实时文本（独立订阅，不牵动整页） */}
          {busy && <LiveNarration scrollRef={scrollRef} />}
        </div>
      </div>

      {/* 选项 / 自定义输入 */}
      <div className="shrink-0 border-t border-line bg-paper-2/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          {!busy && game.options.length > 0 && !custom && (
            <div className="mb-2 grid gap-2">
              {game.options.map((o, i) => (
                <button
                  key={i}
                  onClick={() => send(o.value)}
                  className="group flex items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-left text-[14px] text-ink transition hover:border-jade hover:bg-jade/8"
                >
                  <IconSparkle width={15} height={15} className="shrink-0 text-jade opacity-60 transition group-hover:opacity-100" />
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {custom || game.options.length === 0 ? (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="写下你的行动或台词……（Enter 发送 / Shift+Enter 换行）"
                rows={1}
                disabled={busy}
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-paper px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-jade disabled:opacity-60"
              />
              <button
                onClick={() => send(input)}
                disabled={busy || !input.trim()}
                aria-label="发送"
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-jade text-paper-2 transition hover:brightness-110 disabled:opacity-40"
              >
                <IconSend width={18} height={18} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCustom(true)}
              disabled={busy}
              className="w-full rounded-xl border border-dashed border-line py-2 text-[13px] text-ink-soft transition hover:border-jade hover:text-jade disabled:opacity-50"
            >
              ✎ 自定义行动
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
