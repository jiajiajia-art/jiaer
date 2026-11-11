import { wallet } from "../game/wallet";
import type { Diary } from "../store/gameCtx";

/* 推进手记：横格纸日记页，写明时间解析、这几天的日程，以及属性变化与缘由 */
export default function DiaryCard({ d }: { d: Diary }) {
  const fmt = (label: string, v: number) => (label === wallet.name() || label === "资金" ? wallet.fmt(v) : String(v));
  const up = (r: Diary["rows"][number]) => (r.label === "压力" ? r.to < r.from : r.to > r.from);
  return (
    <article className="opening-note relative mb-4 overflow-hidden rounded-[6px] border border-line bg-paper py-4 pl-11 pr-4">
      <span aria-hidden className="absolute inset-y-0 left-8 w-px bg-coral/45" />
      <div aria-hidden className="absolute inset-y-4 left-2.5 flex flex-col justify-around">
        {Array.from({ length: 5 }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full border border-line bg-paper-2" />)}
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-dashed border-line pb-1.5">
        <span className="font-serif text-[15px] font-bold text-ink">手记 · {d.date}</span>
        <span className="text-[11px] text-ink-soft">第 {d.week} 周 · {d.season}</span>
      </header>

      <section className="mt-2.5">
        <h4 className="text-[11px] font-bold tracking-[0.2em] text-coral">时间</h4>
        <ul className="mt-1 space-y-0.5 text-[12.5px] leading-relaxed text-ink">
          <li>{d.span}</li>
          <li>{d.toSettle === 7 ? "新的一周刚开始" : `再过 ${d.toSettle} 天迎来周结算`}{d.left != null ? ` · 主线还剩 ${d.left} 天` : ""}</li>
          {d.location && <li>此刻回到了「{d.location}」</li>}
        </ul>
      </section>

      {d.days.length > 0 && (
        <section className="mt-3">
          <h4 className="text-[11px] font-bold tracking-[0.2em] text-coral">这几天</h4>
          <div className="opening-note-body mt-1 !text-[13px]">
            {d.days.map((t, i) => <p key={i} className="font-serif !indent-0">{t}</p>)}
          </div>
        </section>
      )}

      <section className="mt-3">
        <h4 className="text-[11px] font-bold tracking-[0.2em] text-coral">属性解析</h4>
        {d.rows.length === 0 ? (
          <p className="mt-1 text-[12.5px] text-ink-soft">各项数值没有变化。</p>
        ) : (
          <ul className="mt-1 divide-y divide-dashed divide-line">
            {d.rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2 py-1 text-[12.5px]">
                <span className="w-12 shrink-0 font-bold text-ink">{r.label}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">{fmt(r.label, r.from)} → <b className={up(r) ? "text-jade" : "text-danger"}>{fmt(r.label, r.to)}</b></span>
                <span className="min-w-0 flex-1 truncate text-right text-[11.5px] text-ink-soft">{r.hint}</span>
              </li>
            ))}
          </ul>
        )}
        {d.sources.length > 0 && <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">来源：{d.sources.join(" · ")}</p>}
      </section>
    </article>
  );
}
