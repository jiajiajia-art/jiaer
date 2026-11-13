import { useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import { proseToSegments } from "../lib/ai";
import { relDay } from "../lib/chronicle";
import { IconClose, IconRefresh } from "../lib/icons";
import { Avatar, Modal } from "./ui";
import { Segments } from "./StoryTab";
import { useConfirm } from "./EditorKit";
import { theaterFormatOf, theaterSrcDoc, type TheaterFormatId } from "../lib/theaterFormats";
import { THEATER_ICON } from "./theaterIcons";

/* 功能注释：HTML 小剧场卡片——无脚本沙盒（只允许同源读取高度），加载后按内容自适应高度 */
function TheaterCard({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(480);
  const fit = () => {
    const doc = ref.current?.contentDocument;
    const next = doc ? Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0) : 0;
    if (next > 0) setH(Math.min(next + 4, 2400));
  };
  return (
    <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-[var(--radius-ui-lg)] border border-line bg-paper shadow-[var(--shadow-ui-lift)]">
      <iframe ref={ref} title={title} sandbox="allow-same-origin" srcDoc={theaterSrcDoc(html)} onLoad={() => { fit(); setTimeout(fit, 300); }} style={{ height: h }} className="block w-full border-0 bg-transparent" />
    </div>
  );
}

/**
 * 功能注释：小剧场舞台——单场观看（幕布头 + 演员表 + 剧本正文）与「小剧场合集」两种视图。
 * 颜色全部读皮肤变量（coral / jade / paper / ink），随皮肤与明暗自动适配。
 */
export default function TheaterStage({ openId, onClose, onEncore }: { openId: string | "shelf"; onClose: () => void; onEncore: (topic?: string, format?: string) => void }) {
  const { game, busy, removeTheater } = useGame();
  const [viewId, setViewId] = useState<string | "shelf">(openId);
  const [confirm, confirmEl] = useConfirm();
  if (!game) return null;
  const list = [...(game.theaters ?? [])].reverse();
  const piece = viewId === "shelf" ? undefined : list.find((t) => t.id === viewId);
  const now = game.sim?.day ?? 0;
  const nameOf = (id: string) => game.npcs.find((n) => n.id === id);

  return (
    <Modal title={piece ? "小剧场" : "小剧场合集"} onClose={onClose} panelClassName="theater-stage">
      {confirmEl}
      {piece ? (
        <article className="space-y-4">
          {/* 幕布头 */}
          <header className="relative -mx-1 overflow-hidden rounded-[var(--radius-ui-lg)] border border-coral/25 px-4 pb-4 pt-5 text-center shadow-[var(--shadow-ui)]"
            style={{ background: "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--coral) 34%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in srgb, var(--coral) 14%, var(--paper)), var(--paper))" }}>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-coral/30 to-transparent" />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-coral/30 to-transparent" />
            <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-2 rounded-b-full bg-coral/35" />
            <p className="flex items-center justify-center gap-1.5 text-[10.5px] font-bold tracking-[0.32em] text-coral/80">
              {(() => { const FIcon = THEATER_ICON[theaterFormatOf(piece.format).id as TheaterFormatId]; return <FIcon width={13} height={13} aria-hidden />; })()} 番外 · {theaterFormatOf(piece.format).label}
            </p>
            <h2 className="mt-1.5 font-serif text-[22px] font-black leading-tight text-ink">《{piece.title}》</h2>
            <p className="mt-1 text-[11px] text-ink-soft">{relDay(now, piece.day)}上演{piece.topic ? ` · 主题「${piece.topic}」` : ""}</p>
            {/* 演员表 */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {[{ id: "__me", name: game.player.name, avatar: game.player.avatar }, ...piece.cast.map((id) => ({ id, name: nameOf(id)?.name ?? "", avatar: nameOf(id)?.avatar ?? "" }))]
                .filter((c) => c.name)
                .map((c) => (
                  <span key={c.id} className="flex items-center gap-1.5 rounded-full border border-line bg-paper/80 py-0.5 pl-0.5 pr-2.5 shadow-sm">
                    <Avatar src={c.avatar} name={c.name} size={22} editable={false} square={false} />
                    <span className="text-[11.5px] font-bold text-ink">{c.name}</span>
                  </span>
                ))}
            </div>
          </header>

          {/* 剧本：HTML 卡片（朋友圈 / 群聊 / 论坛…）或纯文字番外 */}
          {piece.html ? (
            <TheaterCard html={piece.html} title={piece.title} />
          ) : (
            <div className="rounded-[var(--radius-ui)] px-1 text-[13.5px] leading-relaxed text-[color:var(--story-ink)]">
              <Segments segments={proseToSegments(piece.prose)} npcs={game.npcs} playerAvatar={game.player.avatar} playerName={game.player.name} plain />
            </div>
          )}
          <p className="text-center font-serif text-[12px] tracking-[0.4em] text-ink-soft/70">— 完 —</p>

          <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-line/70 pt-3">
            <button type="button" disabled={busy} onClick={() => onEncore(piece.topic, piece.format)}
              className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_var(--coral)] transition hover:brightness-110 active:scale-95 disabled:opacity-50">
              <IconRefresh width={14} height={14} aria-hidden /> 再演一场
            </button>
            <button type="button" onClick={() => setViewId("shelf")} className="rounded-full border border-line bg-paper px-4 py-2 text-[13px] font-semibold text-ink transition hover:border-coral hover:text-coral">
              小剧场合集{list.length > 1 ? ` · ${list.length}` : ""}
            </button>
          </footer>
        </article>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[11.5px] text-ink-soft">番外不影响正式剧情；每一场的梗概会记进剧情记忆，人物偶尔会当作玩笑提起。</p>
          {!list.length && <p className="rounded-[var(--radius-ui)] border border-dashed border-line px-3 py-8 text-center text-[12.5px] text-ink-soft">还没有小剧场，点魔法棒里的「小剧场」开演第一场吧。</p>}
          <ul className="grid gap-2">
            {list.map((t) => (
              <li key={t.id} className="group relative flex items-stretch overflow-hidden rounded-[var(--radius-ui)] border border-line bg-paper/80 shadow-sm transition hover:border-coral/50">
                <span aria-hidden className="w-1.5 shrink-0 bg-gradient-to-b from-coral to-jade" />
                <button type="button" onClick={() => setViewId(t.id)} className="min-w-0 flex-1 px-3 py-2.5 text-left">
                  <p className="flex items-center gap-1.5 truncate font-serif text-[14.5px] font-black text-ink">
                    {(() => { const FIcon = THEATER_ICON[theaterFormatOf(t.format).id as TheaterFormatId]; return <FIcon width={13} height={13} className="shrink-0 text-coral" aria-hidden />; })()}《{t.title}》
                    <span className="ml-auto shrink-0 rounded-full bg-coral/10 px-1.5 py-px font-sans text-[10px] font-bold text-coral">{theaterFormatOf(t.format).label}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-soft">{t.summary}</p>
                  <p className="mt-1 text-[10.5px] text-ink-soft/70">{relDay(now, t.day)} · {[game.player.name, ...t.cast.map((id) => nameOf(id)?.name).filter(Boolean)].join("、")}</p>
                </button>
                <button type="button" aria-label={`删除《${t.title}》`}
                  onClick={async () => { if (await confirm(`删除小剧场《${t.title}》？（已记进剧情记忆的梗概不会一起删除）`)) removeTheater(t.id); }}
                  className="grid shrink-0 place-items-center px-3 text-ink-soft/50 transition hover:bg-coral/10 hover:text-coral"><IconClose width={14} height={14} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
