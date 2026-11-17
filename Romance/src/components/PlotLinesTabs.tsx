import type { ReactNode } from "react";

/* 模组编辑器 · 剧情线：主线 / 支线 / 结局同页纵向合并；有账单时结局区可配破产线等经济规则。 */
export type PlotTab = "main" | "side" | "end";
export const PLOT_TABS: { k: PlotTab; label: string }[] = [
  { k: "main", label: "主线" },
  { k: "side", label: "支线" },
  { k: "end", label: "结局" },
];

export default function PlotLinesTabs({ counts, main, side, end }: { counts: Partial<Record<PlotTab, number>>; main: ReactNode; side: ReactNode; end: ReactNode }) {
  const body: Record<PlotTab, ReactNode> = { main, side, end };
  return (
    <div className="space-y-4" aria-label="剧情线">
      {PLOT_TABS.map((t) => (
        <section key={t.k} className="space-y-2">
          <div className="flex items-center gap-2 border-b border-line/50 pb-1">
            <h3 className="text-[12.5px] font-bold text-ink">{t.label}</h3>
            {counts[t.k] ? (
              <span className="rounded-full bg-jade/12 px-1.5 py-px text-[10.5px] font-bold tabular-nums text-jade">
                {counts[t.k]}
              </span>
            ) : null}
          </div>
          <div>{body[t.k]}</div>
        </section>
      ))}
    </div>
  );
}
