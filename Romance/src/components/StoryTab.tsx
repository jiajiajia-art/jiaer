import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { rulesOf } from "../game/engineRules";
import { useGame, useLive } from "../store/gameCtx";
import type { Npc, Segment, Thought, Turn } from "../lib/types";
import { Avatar } from "./ui";
import { IconChevronDown, IconChevronUp, IconPencil, IconRefresh, IconSend, IconSparkle, IconThought } from "../lib/icons";
import { EntityText } from "./EntityText";
import { looksGarbled, repairSegments, proseToSegments } from "../lib/ai";
import { findNpc } from "../lib/npcIdentity";
import { resolveSpeakerLabel, sameSpeakerLabel } from "../lib/speakerLabel";
import { openPerson } from "./NpcTab";

/* 流式实时文本：单独订阅 LiveCtx，AI 逐帧吐字只重渲染这一小块，
 * 并让它自己把滚动容器滚到底，避免整页跟着刷新。 */
/** 功能注释：叠图旁白半透明底；小说内容卡用普通段落（plain）；对白仍走气泡 */
export function LiveNarration({ scrollRef, overlay, plain }: { scrollRef: RefObject<HTMLDivElement | null>; overlay?: boolean; plain?: boolean }) {
  const live = useLive();
  const { game } = useGame();
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live, scrollRef]);
  // 阶段 / 构思提示原样显示；正文一边流式输出一边解析成旁白与对话框
  const status = /^（[^）\n]*…… \d+s）/.test(live);
  const segs = useMemo(() => (live && !status ? proseToSegments(live) : []), [live, status]);
  return (
    <div className="animate-pop">
      {segs.length && game ? (
        <Segments segments={segs} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} overlay={overlay} plain={plain} />
      ) : live ? (
        <p className={overlay
          ? "story-prose story-narration-panel rounded-xl px-3 py-2 leading-relaxed"
          : plain
            ? "story-prose whitespace-pre-line leading-[1.8] tracking-[0.02em] text-[color:var(--story-ink)]"
            : "story-prose border-l-2 border-jade/25 pl-3 leading-relaxed text-ink-soft"}>
          <EntityText text={live} />
        </p>
      ) : (
        <p className={`flex gap-1 ${overlay ? "story-narration-panel rounded-full px-3 py-1.5" : plain ? "text-jade" : "pl-3 text-jade"}`}>
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
    return <img src={(src) || undefined} alt={name} className="dlg-avatar h-8 w-8 shrink-0 rounded-[8px] object-cover object-top ring-2 ring-white/70 shadow-sm" />;
  return (
    <span
      className={`dlg-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br ${gradFor(name)} text-[13px] font-semibold text-white ring-2 ring-white/70 shadow-sm`}
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

/* 解析括号里的属性/结算信息，如「（仪态 +4、压力 -4）」「（地铁 · 交通费 ¥42 · 行程点 -3）」，
 * 拆成彩色小标签：增益绿、损失红（压力等反向），金钱金色，数值灰底，纯文字作场景标签。 */
const DELTA_GROUP = /[（(]([^（）()]*?(?:\d|¥)[^（）()]*)[）)]/g;
const DELTA_ITEM = /^(.*?)\s*([+\-−])\s*(¥?)\s*(\d+(?:\.\d+)?%?)$/;
const VALUE_ITEM = /^(.*?)\s*(¥?)\s*(\d+(?:\.\d+)?%?)\s*(元|点|次|天|小时|分钟)?$/;
const INVERTED = /压力|疲劳|负面|黑料|焦虑|费|花费|支出|消耗/;
const MONEY = /¥|金钱|存款|钱|收入|片酬|工资/;
const chip = "mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-px text-[0.88em] font-semibold not-italic";
function DeltaChip({ item }: { item: string }) {
  const t = item.trim();
  const d = t.match(DELTA_ITEM);
  if (d) {
    const [, label, sign, yen, num] = d;
    const up = sign === "+";
    const good = INVERTED.test(label) ? !up : up;
    const tone = good ? "bg-jade/12 text-jade" : "bg-danger/12 text-danger";
    return <span className={`${chip} ${tone}`}>{label}<b>{up ? "+" : "−"}{yen}{num}</b></span>;
  }
  const v = t.match(VALUE_ITEM);
  if (v) {
    const [, label, yen, num, unit] = v;
    const money = !!yen || MONEY.test(label);
    const tone = money ? "bg-gold/15 text-gold" : "bg-ink/[0.06] text-ink";
    return <span className={`${chip} ${tone}`}>{label}<b>{yen}{num}{unit ?? ""}</b></span>;
  }
  return <span className={`${chip} bg-coral/12 text-coral font-medium`}>{t}</span>;
}
function StatText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(DELTA_GROUP)) {
    const items = m[1].split(/[、，,；;·•|｜]/).filter((x) => x.trim());
    if (!items.some((x) => DELTA_ITEM.test(x.trim()) || VALUE_ITEM.test(x.trim()))) continue;
    if (m.index! > last) out.push(<EntityText key={last} text={text.slice(last, m.index)} />);
    out.push(<span key={`d${m.index}`} className="inline">{items.map((it, i) => <DeltaChip key={i} item={it} />)}</span>);
    last = m.index! + m[0].length;
  }
  if (!out.length) return <EntityText text={text} />;
  if (last < text.length) out.push(<EntityText key={last} text={text.slice(last)} />);
  return <>{out}</>;
}

/* 单条剧情片段的呈现：旁白（左竖线斜体）/ 系统日志（终端风格居中）/ 人物对话（头像+气泡）。
 * tightTop 用于让连续的系统日志相互收紧。 */
/* 旁白内「动作 / 台词」分色：引号「」“”『』里是说出口的话（深色正文），其余为动作神态描写（主色斜体） */
const QUOTE_RE = /(「[^「」]*」|“[^“”]*”|『[^『』]*』)/g;
function ProseWithSpeech({ text }: { text: string }) {
  const parts = text.split(QUOTE_RE).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        /^[「“『]/.test(p) ? <span key={i} className="story-speech"><EntityText text={p} /></span> : <span key={i} className="story-action"><StatText text={p} /></span>,
      )}
    </>
  );
}

/* 台词气泡内的动作：（…）/(…)/*…* 抽出来以动作色显示，台词本身保持正文色 */
const ACTION_RE = /(（[^（）]*）|\([^()]*\)|\*[^*]+\*)/g;
export function SpeechWithActions({ text }: { text: string }) {
  const parts = text.split(ACTION_RE).filter(Boolean);
  return (
    <>
      {parts.map((p, i) =>
        /^[（(*]/.test(p) ? <span key={i} className="story-action text-[0.92em]">{p.replace(/^\*|\*$/g, "")}</span> : <EntityText key={i} text={p} />,
      )}
    </>
  );
}

function SegmentView({ s, npcs, tightTop, cont, player, overlay, plain }: {
  s: Segment; npcs: Npc[]; tightTop?: boolean; cont?: boolean; player?: { name: string; avatar: string }; overlay?: boolean; plain?: boolean;
}) {
  // 功能注释：叠图半透明底；小说内容卡=普通段落；其它纸面旁白保留竖线装饰
  // 功能注释：旁白字号跟设置 --story-font-size / dialogDiy，禁止写死 text-[Npx]；中文不斜体
  if (s.kind === "narration")
    return overlay ? (
      <p className="story-prose story-narration-panel rounded-xl px-3 py-2 leading-[1.85] tracking-[0.015em]">
        <ProseWithSpeech text={s.text} />
      </p>
    ) : plain ? (
      <p className="story-prose whitespace-pre-line leading-[1.8] tracking-[0.02em] text-[color:var(--story-ink)]">
        <ProseWithSpeech text={s.text} />
      </p>
    ) : (
      <p className="story-prose relative pl-3 leading-[1.85] tracking-[0.015em] text-ink/88 before:pointer-events-none before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-gradient-to-b before:from-jade/35 before:via-coral/25 before:to-transparent">
        <ProseWithSpeech text={s.text} />
      </p>
    );
  if (s.kind === "system")
    return (
      <div className={`flex items-center justify-center gap-2.5 text-gold/80 ${tightTop ? "-mt-2" : ""}`}>
        <span className="h-px w-6 shrink-0 bg-gradient-to-r from-transparent to-gold/30" aria-hidden />
        <span className="text-center text-[12px] font-mono leading-snug tracking-wide">
          <StatText text={s.text} />
        </span>
        <span className="h-px w-6 shrink-0 bg-gradient-to-l from-transparent to-gold/30" aria-hidden />
      </div>
    );
  // 人物对话：真实对话框——头像 + 名字 + 气泡；主角的台词靠右。
  // cont=同一人连续发言：省略头像与名字，气泡紧贴上一条
  // 功能注释：小说内容卡气泡只读皮肤变量，不写死白底/圆角；名字经别名解析成档案全名（姓+名）
  const who = resolveSpeakerLabel(s.speaker, npcs, player?.name);
  const me = who.me;
  const npc = me ? undefined : who.npc;
  const showName = who.label;
  const npcBubble = plain
    ? "dlg-bubble relative w-fit max-w-full rounded-[var(--radius-ui)] rounded-bl-[var(--radius-ui-sm)] border border-line bg-paper-2 px-3.5 py-2 text-[15px] leading-relaxed text-ink shadow-[var(--shadow-ui)]"
    : "dlg-bubble relative w-fit max-w-full rounded-2xl rounded-bl-md border border-white/60 bg-white/70 px-3.5 py-2 text-[14px] leading-relaxed text-ink shadow-[0_4px_14px_-8px_var(--dream-glow,rgba(0,0,0,0.15))] backdrop-blur-sm";
  const meBubble = plain
    ? "dlg-bubble-me max-w-[82%] rounded-[var(--radius-ui)] rounded-br-[var(--radius-ui-sm)] bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-3.5 py-2 text-[15px] leading-relaxed text-paper-2 shadow-[var(--shadow-ui)]"
    : "dlg-bubble-me max-w-[82%] rounded-2xl rounded-br-md bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-3.5 py-2 text-[14px] leading-relaxed text-white shadow-sm";
  if (me)
    return (
      <div className={`flex items-end justify-end gap-2 ${cont ? "-mt-2" : ""}`}>
        <div className={meBubble}>
          <SpeechWithActions text={s.text} />
        </div>
        {cont ? <span className="w-8 shrink-0" /> : <SpeakerAvatar name={showName} src={player!.avatar || undefined} />}
      </div>
    );
  return (
    <div className={`flex items-start gap-2 ${cont ? "-mt-2" : ""}`}>
      {cont ? <span className="w-8 shrink-0" /> : <SpeakerAvatar name={showName} src={npc?.avatar || undefined} />}
      <div className="min-w-0 max-w-[82%]">
        {!cont && (
          <p className={`dlg-name flex h-8 items-center pl-1 text-[12.5px] font-semibold leading-none ${plain ? "text-ink-soft" : "text-jade/80"}`}>
            <EntityText text={showName} />
          </p>
        )}
        <div className={npcBubble}>
          <SpeechWithActions text={s.text} />
        </div>
      </div>
    </div>
  );
}

/* 回合末尾的「心事」：默认折起，点开偷看在场角色没说出口的话 */
export function Thoughts({ thoughts, npcs }: { thoughts?: Thought[]; npcs: Npc[] }) {
  const [open, setOpen] = useState(false);
  if (!thoughts?.length) return null;
  return (
    <div className="mt-2.5">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-dashed border-coral/50 px-2.5 py-0.5 text-[11.5px] font-bold text-coral transition hover:bg-coral/10">
        <IconThought size={14} /> 心事 · {thoughts.length} {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {thoughts.map((t, i) => {
            const n = npcs.find((x) => x.name === t.name);
            return (
              <li key={i} className="flex items-start gap-2 rounded-xl bg-coral/[0.06] px-2.5 py-2">
                <Avatar src={n?.avatar ?? ""} name={t.name} size={26} square />
                <p className="story-thought min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink/85">
                  {/* 功能注释：心事不用斜体，中文斜体会掉成系统黑体；跟游戏字体 */}
                  <b className="mr-1 text-coral">{t.name}</b><span className="not-italic">{t.text}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** AI 请求失败提示条：右侧「重新生成」从失败前快照原样重跑（不重复扣点、不重复插入玩家气泡） */
/** 本段出场人物：从台词与「结识 X」「初遇 X」解析，点按查看人物资料 */
export function CastRow({ segments: raw, changes = [], npcs, onOpen }: { segments: Segment[]; changes?: string[]; npcs: Npc[]; onOpen?: () => void }) {
  const segments = repairSegments(raw);
  const names = [
    ...segments.filter((s) => s.kind === "dialogue").map((s) => (s as { speaker: string }).speaker),
    ...changes.map((c) => /^(?:结识|初遇) (.+)$/.exec(c)?.[1]).filter(Boolean) as string[],
  ];
  const seen = new Set<string>();
  const cast = names.map((n) => findNpc(npcs, n, n)).filter((n): n is Npc => !!n && !seen.has(n.id) && !!seen.add(n.id));
  if (!cast.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-ink-soft">出场人物</span>
      {cast.map((n) => (
        <button key={n.id} type="button" onClick={() => { onOpen?.(); openPerson(n.id); }} className="flex items-center gap-1.5 rounded-full border border-line bg-paper px-1 py-0.5 pr-2.5 text-[12px] text-ink transition hover:border-jade">
          <Avatar name={n.name} src={n.avatar || undefined} size={20} editable={false} />
          {n.name}
          {(changes.includes(`结识 ${n.name}`) || changes.includes(`初遇 ${n.name}`)) && <span className="text-[10px] text-coral">新</span>}
          <span className="text-ink-soft">›</span>
        </button>
      ))}
    </div>
  );
}

export function ErrorBanner({ error }: { error: { title: string; text: string; preview?: string } }) {
  const { regenerate, busy } = useGame();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[var(--danger)]">{error.title}</div>
        <div className="mt-0.5 whitespace-pre-line text-[12px] leading-relaxed text-ink-soft">{error.text}</div>
        {/* 功能注释：解析失败时已生成的正文只供查看，不算进剧情、不进提示词 */}
        {error.preview && (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-soft">查看这次生成的正文（未计入剧情）</summary>
            <div className="mt-1 max-h-48 overflow-y-auto whitespace-pre-line rounded-lg bg-paper/70 px-2.5 py-2 text-[12px] leading-relaxed text-ink-soft">{error.preview}</div>
          </details>
        )}
      </div>
      <button type="button" disabled={busy} onClick={() => regenerate()} className="shrink-0 rounded-full bg-[var(--danger)] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
        ↻ 重新生成
      </button>
    </div>
  );
}

export { SpeakerAvatar };
/** 功能注释：连续发言按解析后的全名判断，别名与档案名算同一人 */
const sameSpeaker = (a: Segment | undefined, b: Segment | undefined, npcs: Npc[], playerName: string) =>
  a?.kind === "dialogue" && b?.kind === "dialogue" && sameSpeakerLabel(a.speaker, b.speaker, npcs, playerName);
export function Segments({ segments: raw, npcs, playerAvatar, playerName, overlay, plain }: {
  segments: Segment[]; npcs: Npc[]; playerAvatar: string; playerName: string; overlay?: boolean; plain?: boolean;
}) {
  const segments = repairSegments(raw);
  // 乱码拦截：把所有文字拼起来判断，命中则整段替换为「重新生成」提示。
  const joined = segments.map((s) => s.text).join("\n");
  if (looksGarbled(joined)) return <GarbleNotice />;
  return (
    <div className="space-y-3">
      {segments.map((s, i) => (
        <SegmentView key={i} s={s} npcs={npcs} tightTop={segments[i - 1]?.kind === "system"} cont={sameSpeaker(segments[i - 1], s, npcs, playerName)} player={{ name: playerName, avatar: playerAvatar }} overlay={overlay} plain={plain} />
      ))}
    </div>
  );
}

/* 把一段旁白拆成「一句一句」的节拍：以中文/英文句末标点断句，保留标点。 */
function splitSentences(text: string): string[] {
  // 引号内不断句：先把「…」整体当作不可拆的块，避免一句台词被切到两拍、前半句失去引号而被误判为动作
  const out: string[] = [];
  const merged: string[] = [];
  let depth = 0;
  for (const piece of splitRaw(text)) {
    if (depth > 0 && merged.length) merged[merged.length - 1] += piece;
    else merged.push(piece);
    for (const ch of piece) {
      if ("「“『".includes(ch)) depth++;
      else if ("」”』".includes(ch)) depth = Math.max(0, depth - 1);
    }
  }
  out.push(...merged);
  return out.length ? out : [text];
}
function splitRaw(text: string): string[] {
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
  for (const s of repairSegments(segments)) {
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
          <SegmentView s={s} npcs={npcs} tightTop={beats[i - 1]?.kind === "system"} cont={sameSpeaker(beats[i - 1], s, npcs, playerName)} player={{ name: playerName, avatar: playerAvatar }} />
        </div>
      ))}
      {!complete && (
        <button
          onClick={advance}
          className="group flex w-full items-center justify-center gap-2 py-1.5 text-jade transition"
          aria-label="继续"
        >
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-jade/30" aria-hidden />
          <span className="inline-flex animate-pulse items-center gap-0.5 text-[12px] font-medium tracking-[0.25em]">轻触继续 <IconChevronDown size={12} /></span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-jade/30" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function StoryTab() {
  const { game, busy, submit } = useGame();
  const freeInput = rulesOf(game).interact.freeInput;
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
            null
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
              t.error ? <ErrorBanner key={t.id} error={t.error} /> :
              <div key={t.id} className={`animate-pop ${tight ? "-mt-4" : ""}`}>
                <Segments segments={t.segments} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} />
                <Thoughts thoughts={t.thoughts} npcs={game.npcs} />
                <CastRow segments={t.segments} npcs={game.npcs} />
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
          {!busy && (game.options?.length ?? 0) > 0 && !custom && (
            <div className="mb-2 grid gap-2">
              {(game.options ?? []).slice(0, 3).map((o, i) => (
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

          {/* 底层规则 · 选项模式：关闭自由输入后只能点选项（没有选项时仍允许输入，避免卡死） */}
          {!freeInput && (game.options?.length ?? 0) > 0 ? null : custom || (game.options?.length ?? 0) === 0 ? (
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
              <span className="inline-flex items-center justify-center gap-1"><IconPencil size={14} /> 自定义行动</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
