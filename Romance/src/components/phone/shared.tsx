/* 手机 App 通用小组件与工具（各 App 复用） */
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Avatar } from "../ui";
import { useGame } from "../../store/gameCtx";
import { addComment } from "../../game/phone";
import { IconHeart, IconClose } from "./icons";

export const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

export function TopBar({ title, onBack, dark }: { title: string; onBack: () => void; dark?: boolean }) {
  return (
    <div className={`flex items-center border-b px-3 py-2.5 ${dark ? "border-white/10 bg-white/5 text-white" : "border-black/5 bg-white text-ink"}`}>
      <button onClick={onBack} className={`text-[14px] ${dark ? "text-white/80" : "text-ink-soft"}`}>‹ 主屏</button>
      <span className="flex-1 text-center text-[15px] font-semibold">{title}</span>
      <span className="w-12" />
    </div>
  );
}

export function BottomTabs<T extends string>({ tabs, active, onPick }: { tabs: { id: T; label: string }[]; active: T; onPick: (id: T) => void }) {
  return (
    <div className="flex border-t border-black/5 bg-white">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onPick(t.id)} className={`flex-1 py-2.5 text-[12px] font-medium ${active === t.id ? "text-emerald-600" : "text-ink-soft"}`}>{t.label}</button>
      ))}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="px-6 py-16 text-center text-[13px] text-ink-soft">{text}</p>;
}

/* 图片查看器：点开配图后全屏预览，点任意处或右上角关闭 */
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/92" onClick={onClose}>
      <button onClick={onClose} aria-label="关闭" className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white">
        <IconClose size={20} />
      </button>
      <img src={src.replace(/w=\d+&h=\d+/, "w=900&h=900")} alt="" className="max-h-[86%] max-w-[92%] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/* 下拉刷新：仿原生手势——在滚动容器顶部下拉，越过阈值松手即触发 onRefresh。
 * onRefresh 可返回 Promise，期间显示「刷新中」，完成后回弹。纯前端体验层。 */
export function PullToRefresh({
  onRefresh,
  children,
  className = "",
  accent = "#fe2c55",
  tint = "dark",
}: {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  accent?: string;
  tint?: "dark" | "light";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0); // 当前下拉距离（已带阻尼）
  const [busy, setBusy] = useState(false);
  const THRESHOLD = 64;

  const onStart = (y: number) => {
    if (busy) return;
    startY.current = (ref.current?.scrollTop ?? 0) <= 0 ? y : null;
  };
  const onMove = (y: number) => {
    if (startY.current == null || busy) return;
    const d = y - startY.current;
    if (d <= 0) { setPull(0); return; }
    setPull(Math.min(96, d * 0.5)); // 阻尼
  };
  const onEnd = async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= THRESHOLD && !busy) {
      setBusy(true);
      setPull(THRESHOLD);
      try { await onRefresh(); } finally { setBusy(false); setPull(0); }
    } else {
      setPull(0);
    }
  };

  const ready = pull >= THRESHOLD;
  const label = busy ? "刷新中…" : ready ? "松手刷新" : "下拉刷新";
  const textColor = tint === "dark" ? "text-white/80" : "text-ink-soft";

  return (
    <div
      ref={ref}
      className={`relative overflow-y-auto overscroll-contain ${className}`}
      onTouchStart={(e) => onStart(e.touches[0].clientY)}
      onTouchMove={(e) => onMove(e.touches[0].clientY)}
      onTouchEnd={onEnd}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 text-[12px] ${textColor}`} style={{ height: pull, opacity: pull > 8 ? 1 : 0 }}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent ${busy ? "animate-spin" : ""}`} style={{ color: accent, transform: busy ? undefined : `rotate(${pull * 3}deg)` }} />
        {label}
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: startY.current == null ? "transform 0.25s ease-out" : undefined }}>
        {children}
      </div>
    </div>
  );
}

type Comment = { id: string; pid?: string; name: string; text: string; likes: number };

const COMMENT_SEEDS = [
  "太真实了，追梦的路上真的不容易",
  "姐姐好美！求同款妆容教程",
  "已经三刷了，每次看都想哭",
  "这段演技绝了，等正片！",
  "谢谢你分享，被治愈到了",
  "第一时间赶到，冲鸭！",
  "求链接求链接，好想要同款",
  "默默支持，会一直在的",
];

/* 通用评论面板：真实展示 + 可点赞 + 可发布。
 * 传入 cid 时，玩家评论落地到 game.phone.comments[cid]，跨会话保留（微博/小红书/抖音/朋友圈共用）。 */
export function CommentSheet({ count, onClose, accent = "#fe2c55", cid }: { count: number; onClose: () => void; accent?: string; cid?: string }) {
  const { game, commitGame } = useGame();
  const seeded = useMemo<Comment[]>(() => {
    const npcs = game!.npcs;
    return COMMENT_SEEDS.map((t, i) => {
      const n = npcs[(i * 3 + 1) % Math.max(1, npcs.length)];
      return { id: `seed${i}`, pid: n?.id, name: n?.name ?? "热心网友", text: t, likes: (t.length * 37 + i * 91) % 800 };
    });
  }, [game]);
  // 已落地的玩家评论（置顶展示），随存档持久化
  const mine = cid ? (game!.phone?.comments?.[cid] ?? []) : [];
  const list: Comment[] = [
    ...mine.map((c) => ({ id: c.id, name: game!.player.name, text: c.text, likes: 0 })),
    ...seeded,
  ];
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");

  const post = () => {
    const t = draft.trim();
    if (!t) return;
    if (cid) commitGame(addComment(game!, cid, t));
    setDraft("");
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-[72%] flex-col rounded-t-2xl bg-white">
        <div className="flex items-center justify-center border-b border-black/5 py-2.5 text-[14px] font-semibold text-ink">
          {count + mine.length} 条评论
          <button onClick={onClose} className="absolute right-4 text-ink-soft"><IconClose size={18} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {list.map((c) => {
            const npc = c.pid ? game!.npcs.find((n) => n.id === c.pid) : undefined;
            const on = liked[c.id];
            return (
              <div key={c.id} className="flex gap-2.5">
                <Avatar src={c.pid ? npc?.avatar : game!.player.avatar} name={c.name} size={34} editable={false} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-ink-soft">{c.name}</p>
                  <p className="mt-0.5 text-[14px] leading-snug text-ink">{c.text}</p>
                </div>
                <button onClick={() => setLiked((s) => ({ ...s, [c.id]: !s[c.id] }))} className="flex flex-col items-center gap-0.5 text-[11px]" style={{ color: on ? accent : "#9aa0a6" }}>
                  <IconHeart size={15} filled={on} />{c.likes + (on ? 1 : 0)}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-2 border-t border-black/5 px-3 py-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") post(); }}
            placeholder="留下你的评论…"
            className="flex-1 rounded-full bg-black/[0.06] px-4 py-2 text-[13.5px] text-ink outline-none placeholder:text-ink-soft/70"
          />
          <button onClick={post} disabled={!draft.trim()} className="rounded-full px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: accent }}>发送</button>
        </div>
      </div>
    </div>
  );
}

let dotSeq = 0;
export function Dot() {
  const d = (dotSeq++ % 3) * 0.16;
  return <span className="type-dot h-1.5 w-1.5 rounded-full bg-ink-soft/70" style={{ animationDelay: `${d}s` }} />;
}
