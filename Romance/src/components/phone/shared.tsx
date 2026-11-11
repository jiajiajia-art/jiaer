/* 手机 App 通用小组件与工具（各 App 复用） */
import { useEffect, useMemo, useRef, useState } from "react";
import { syncJson, loadFeed, saveFeed } from "./worldSync";
import { isConfigured } from "../../lib/ai";
import type { ReactNode } from "react";
import { Avatar } from "../ui";
import { useGame } from "../../store/gameCtx";
import { addComment } from "../../game/phone";
import { IconHeart, IconClose } from "./icons";
import { logAct } from "../../game/phoneLink";

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
      <img src={(src.replace(/w=\d+&h=\d+/, "w=900&h=900")) || undefined} alt="" className="max-h-[86%] max-w-[92%] rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
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

type Comment = { id: string; pid?: string; name: string; text: string; likes?: number };


/* 通用评论面板：真实展示 + 可点赞 + 可发布。
 * 传入 cid 时，玩家评论落地到 game.phone.comments[cid]，跨会话保留（微博/小红书/抖音/朋友圈共用）。 */
export function CommentSheet({ count: _count, onClose, accent = "#fe2c55", cid, topic }: { count: number; onClose: () => void; accent?: string; cid?: string; topic?: string }) {
  const { game, cfg, commitGame } = useGame();
  /* 网友 / 圈内人评论：按这条内容与当前世界由 AI 生成，按 cid 缓存在本存档；没有 AI 就不显示任何预设评论 */
  const fkey = `cm.${cid ?? topic ?? "_"}`;
  const [gen, setGen] = useState<Comment[] | null>(() => loadFeed<Comment[]>(fkey));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const canGen = !!topic?.trim() && isConfigured(cfg);
  // 只在玩家点「生成评论」时调用 AI
  const genComments = () => {
    if (busy || !canGen) return;
    let dead = false;
    setBusy(true);
    setNote("正在生成评论…");
    syncJson<{ comments?: unknown }>(cfg, game!, "comments", "评论区", `为这条内容生成评论区：「${topic!.slice(0, 300)}」。返回 {"comments":[{"name":"评论者(圈内人物用本名，否则网友昵称)","text":"评论≤40字"}]}，5~8 条，贴合这条内容、人物身份与最近剧情，观点各异。`)
      .then((r) => {
        if (dead) return;
        if (!r) { setNote("接入 AI 后会有其他人的评论"); return; }
        const list: Comment[] = (Array.isArray(r.comments) ? r.comments : []).map((x: any, i: number) => {
          const name = String(x?.name ?? "").trim().slice(0, 16), text = String(x?.text ?? "").trim().slice(0, 80);
          return { id: `ai${i}`, name, text, pid: game!.npcs.find((n) => n.name === name)?.id, likes: undefined };
        }).filter((c) => c.name && c.text);
        if (!list.length) { setNote("评论加载失败"); return; }
        setGen([...(gen ?? []), ...list.map((c, i) => ({ ...c, id: `ai${Date.now()}-${i}` }))]); saveFeed(fkey, [...(gen ?? []), ...list.map((c, i) => ({ ...c, id: `ai${Date.now()}-${i}` }))]); setNote("");
      }).catch(() => { if (!dead) setNote("评论加载失败"); }).finally(() => setBusy(false));
  };
  // 已落地的玩家评论（置顶展示），随存档持久化
  const mine = cid ? (game!.phone?.comments?.[cid] ?? []) : [];
  const list: Comment[] = [
    ...mine.map((c) => ({ id: c.id, name: game!.player.name, text: c.text })),
    ...(gen ?? []),
  ];
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");

  const post = () => {
    const t = draft.trim();
    if (!t) return;
    if (cid) commitGame(logAct(addComment(game!, cid, t), { app: "评论区", text: "发表了评论", bit: t, key: `cm:${cid}`, min: 2 }));
    setDraft("");
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div onClick={(e) => e.stopPropagation()} className="relative flex max-h-[72%] flex-col rounded-t-2xl bg-white">
        <div className="flex items-center justify-center border-b border-black/5 py-2.5 text-[14px] font-semibold text-ink">
          {list.length} 条评论
          <button onClick={onClose} className="absolute right-4 text-ink-soft"><IconClose size={18} /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {note && <p className="py-4 text-center text-[12.5px] text-ink-soft">{note}</p>}
          {!list.length && !note && <p className="py-4 text-center text-[12.5px] text-ink-soft">{isConfigured(cfg) ? "还没有评论" : "还没有评论 · 接入 AI 后可生成其他人的评论"}</p>}
          {canGen && <div className="flex justify-center"><button onClick={genComments} disabled={busy} className="rounded-full border px-3 py-1 text-[12px] disabled:opacity-50" style={{ borderColor: accent, color: accent }}>{busy ? "生成中…" : gen?.length ? "再生成一些评论" : "生成评论"}</button></div>}
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
                  <IconHeart size={15} filled={on} />{c.likes != null ? c.likes + (on ? 1 : 0) : on ? 1 : ""}
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

/* 列表底部「查看更多」：点击后由 AI 结合剧情再生成一批内容接在末尾 */
export function LoadMoreButton({ loading, onClick, color = "#666", className = "", dark }: { loading: boolean; onClick: () => void; color?: string; className?: string; dark?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={loading} className={`flex w-full items-center justify-center gap-1 py-3.5 text-[13px] font-medium leading-none disabled:opacity-60 ${dark ? "bg-transparent" : "bg-white"} ${className}`} style={{ color }}>
      {loading ? "正在刷新更多…" : <>查看更多<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="shrink-0"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
    </button>
  );
}

/* 生成「不要重复」提示用的近期内容摘要 */
export const seenOf = (texts: string[], n = 12) => texts.slice(-n).map((t) => (t || "").slice(0, 30)).join("｜");

/* 未接入 AI 时的统一提示：不再展示与剧情无关的模板内容，引导玩家去接入 AI */
export const openAiConfig = () => window.dispatchEvent(new CustomEvent("star:openaicfg"));
export function NeedAI({ what, accent = "#07c160", dark, compact }: { what: string; accent?: string; dark?: boolean; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-4 py-5" : "px-6 py-12"}`}>
      <span className="grid h-12 w-12 place-items-center rounded-[14px] text-[22px] font-black text-white shadow-md" style={{ background: accent }}>AI</span>
      <p className={`mt-3 text-[14.5px] font-bold ${dark ? "text-white" : "text-[#1a1a1a]"}`}>需要接入 AI</p>
      <p className={`mt-1 max-w-[260px] text-[12.5px] leading-relaxed ${dark ? "text-white/70" : "text-[#888]"}`}>{what}会由 AI 结合当前剧情、人物与记忆实时生成。接入后即可使用。</p>
      <button onClick={openAiConfig} className="mt-4 rounded-full px-5 py-2 text-[13px] font-semibold text-white shadow-sm active:scale-95" style={{ background: accent }}>去接入 AI</button>
    </div>
  );
}
