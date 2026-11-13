import { useMemo, useState } from "react";
import { useGame } from "../store/gameCtx";
import { isConfigured } from "../lib/ai";
import { IconChevronLeft, IconChevronRight, IconScroll } from "../lib/icons";
import { splitWeekDiary } from "../lib/weekReview";

/** 功能注释：打字光标——跟在流式文字末尾 */
function Caret() {
  return <span aria-hidden className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-coral align-baseline" />;
}

/**
 * 功能注释：日记本——每周结算后 AI 以主角口吻写的周记（约 800 字），随存档保存，可按周翻看。
 * 周属性总结在周报卡里由代码结算；这里只放 AI 写的叙事周记。
 */
export default function DiaryBook() {
  const { game, cfg, retryWeekDiary, weekDiaryLive } = useGame();
  // 功能注释：写到一半刷新 / 关页会卡在 writing；超过 3 分钟未完成视为没写成，可重写
  const list = useMemo(() => [...(game?.weekDiaries ?? [])]
    .map((x) => (x.status === "writing" && weekDiaryLive[x.id] == null && Date.now() - x.ts > 180_000 ? { ...x, status: "failed" as const } : x))
    .sort((a, b) => a.week - b.week), [game?.weekDiaries, weekDiaryLive]);
  const [pick, setPick] = useState<string | null>(null);
  const idx = Math.max(0, pick ? list.findIndex((e) => e.id === pick) : list.length - 1);
  const e = list[idx];
  const aiOn = isConfigured(cfg);

  if (!list.length) {
    return (
      <div className="ui-card px-4 py-8 text-center">
        <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold"><IconScroll size={18} /></span>
        <p className="text-[13.5px] font-bold text-ink">日记本还是空的</p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
          {aiOn ? "每到周结算，主角会把这一周写成一篇日记，收在这里。" : "需要先配置 AI，周结算时才会写日记。"}
        </p>
      </div>
    );
  }

  const label = (w: number, to?: number) => (to && to > w ? `第 ${w}～${to} 周` : `第 ${w} 周`);
  const paras = (e?.text ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
  // 功能注释：正在写——直接渲染流式收到的真实文字（标题 + 正文），末尾闪烁光标
  const live = e?.status === "writing" ? weekDiaryLive[e.id] : undefined;
  const liveSplit = live != null ? splitWeekDiary(live) : null;
  const liveParas = (liveSplit?.body ?? "").split(/\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-3">
      {/* 目录 */}
      <nav aria-label="日记目录" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {list.map((x, i) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setPick(x.id)}
            aria-current={i === idx ? "page" : undefined}
            className={`ui-chip shrink-0 ${i === idx ? "!border-jade !bg-jade/12 !text-jade font-bold" : ""}`}
          >
            {label(x.week, x.weekTo)}
            {x.status === "writing" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" aria-label="正在写" />}
            {x.status === "failed" && <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="没写成" />}
          </button>
        ))}
      </nav>

      {/* 日记页 */}
      {e && (
        <article className="relative overflow-hidden rounded-[var(--radius-ui-sm)] border border-line bg-paper py-5 pl-12 pr-5 shadow-[var(--shadow-ui)]">
          <span aria-hidden className="absolute inset-y-0 left-9 w-px bg-coral/45" />
          <div aria-hidden className="absolute inset-y-6 left-3 flex flex-col justify-around">
            {Array.from({ length: 7 }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full border border-line bg-paper-2" />)}
          </div>

          <header className="mb-1 border-b border-dashed border-line pb-2">
            <p className="text-[11px] tracking-[0.2em] text-ink-soft">{label(e.week, e.weekTo)} · {e.date}</p>
            <h3 className="mt-1 font-serif text-[18px] font-black leading-snug text-ink">
              {e.status === "done" ? e.title : e.status === "failed" ? "这一周的日记没写成" : liveSplit?.title ? <>{liveSplit.title}{!liveSplit.hasTitle && <Caret />}</> : "正在落笔…"}
            </h3>
          </header>

          {e.status === "done" && (
            <div className="opening-note-body font-serif text-ink" style={{ color: "var(--story-ink)" }}>
              {paras.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}
          {e.status === "writing" && liveSplit?.hasTitle && (
            <div className="opening-note-body font-serif text-ink" style={{ color: "var(--story-ink)" }} aria-live="polite" aria-busy="true">
              {liveParas.length ? liveParas.map((p, i) => <p key={i}>{p}{i === liveParas.length - 1 && <Caret />}</p>) : <p><Caret /></p>}
            </div>
          )}
          {e.status === "writing" && !liveSplit?.hasTitle && (
            <div className="space-y-3 py-3" aria-busy="true" aria-label="正在写这一周的日记">
              {[92, 100, 86, 97, 70].map((w, i) => <div key={i} className="h-3 animate-pulse rounded bg-line/70" style={{ width: `${w}%` }} />)}
              <p className="pt-1 text-[11.5px] text-ink-soft">主角正在回想这一周，写好会自动出现在这里。</p>
            </div>
          )}
          {e.status === "failed" && (
            <div className="py-3">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">可能是网络或 AI 服务出了问题。本周的数值结算不受影响。</p>
              <button type="button" disabled={!aiOn} onClick={() => retryWeekDiary(e.id)} className="ui-btn ui-btn-sm mt-3">重写这一篇</button>
            </div>
          )}

          {e.status === "done" && (
            <footer className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-2 text-[11px] text-ink-soft">
              <span>{e.text?.replace(/\s/g, "").length ?? 0} 字</span>
              <button type="button" disabled={!aiOn} onClick={() => retryWeekDiary(e.id)} className="font-semibold text-jade disabled:opacity-40">重写</button>
            </footer>
          )}
        </article>
      )}

      {/* 翻页 */}
      <div className="flex items-center justify-between">
        <button type="button" disabled={idx <= 0} onClick={() => setPick(list[idx - 1].id)} className="ui-btn ui-btn-sm"><IconChevronLeft size={13} />上一周</button>
        <span className="text-[11.5px] tabular-nums text-ink-soft">{idx + 1} / {list.length}</span>
        <button type="button" disabled={idx >= list.length - 1} onClick={() => setPick(list[idx + 1].id)} className="ui-btn ui-btn-sm">下一周<IconChevronRight size={13} /></button>
      </div>
    </div>
  );
}
