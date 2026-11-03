import type { ReactNode } from "react";

/* 模组编辑器 · 剧情线：主线 / 支线 / 结局同页纵向合并；扣费依据在③养成，透支破产在结局。 */
export type PlotTab = "main" | "side" | "end";
export const PLOT_TABS: { k: PlotTab; label: string; hint: string }[] = [
  { k: "main", label: "主线", hint: "推进故事；卡住或中断会影响结局" },
  { k: "side", label: "支线", hint: "额外任务；成败不影响主线" },
  { k: "end", label: "结局", hint: "时限、自定义结局、评级与经济规则（破产线 / 透支缓冲）" },
];

export default function PlotLinesTabs({ counts, main, side, end }: { counts: Partial<Record<PlotTab, number>>; main: ReactNode; side: ReactNode; end: ReactNode }) {
  const body: Record<PlotTab, ReactNode> = { main, side, end };
  return (
    <div className="space-y-5" aria-label="剧情线">
      {PLOT_TABS.map((t) => (
        <section key={t.k} className="space-y-2">
          {/* 功能注释：只用小节标题，避免再出现「主线与目标 / 结局与时限 / 经济收官」三块大 Section */}
          <div>
            <h3 className="text-[13.5px] font-bold text-ink">
              {t.label}{counts[t.k] ? <span className="ml-1.5 text-[12px] font-semibold text-ink-soft">{counts[t.k]}</span> : null}
            </h3>
            <p className="text-[11px] text-ink-soft">{t.hint}</p>
          </div>
          <div>{body[t.k]}</div>
        </section>
      ))}
    </div>
  );
}
