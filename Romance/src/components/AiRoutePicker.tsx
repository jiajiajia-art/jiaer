import { fmtMultiplier, useAiRoutes, type AiCapability } from "../lib/platformAiRoutes";

/* AI 线路选择：列出运营后台配置的线路与倍率，玩家点选后全局生效（同能力共用）。
 * compact = 一行下拉（生图弹窗等窄处）；默认 = 卡片列表。接口没有线路时不渲染。 */
export default function AiRoutePicker({ capability, compact = false, title }: { capability: AiCapability; compact?: boolean; title?: string }) {
  const { routes, loading, current, select } = useAiRoutes(capability);
  if (loading || !routes.length) return null;
  const label = title ?? (capability === "image" ? "生图线路" : "AI 线路");

  if (compact) {
    return (
      <label className="flex items-center gap-2 text-[11.5px] text-ink-soft">
        <span className="shrink-0 font-bold">{label}</span>
        <select
          value={current?.id ?? ""}
          onChange={(e) => select(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade"
        >
          {routes.map((r) => (
            <option key={r.id} value={r.id} disabled={r.available === false}>
              {r.name} · 倍率 {fmtMultiplier(r.multiplier)}{r.available === false ? "（维护中）" : ""}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">{label}</p>
        <p className="text-[11px] text-ink-soft">倍率由平台设定，按实际用量 × 倍率扣积分</p>
      </div>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {routes.map((r) => {
          const on = current?.id === r.id;
          const off = r.available === false;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              onClick={() => select(r.id)}
              className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-coral bg-coral/[0.07] ring-1 ring-coral/30" : "border-line bg-paper hover:border-coral/50"}`}
            >
              <span aria-hidden className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? "border-coral" : "border-line"}`}>
                {on && <span className="h-2 w-2 rounded-full bg-coral" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-bold text-ink">{r.name}</span>
                  {r.tag && <span className="rounded-full bg-paper-2 px-1.5 py-px text-[10px] font-semibold text-ink-soft ring-1 ring-line">{r.tag}</span>}
                  {r.isDefault && <span className="rounded-full bg-jade/10 px-1.5 py-px text-[10px] font-semibold text-jade">推荐</span>}
                  {off && <span className="text-[10px] text-ink-soft">维护中</span>}
                </span>
                {r.desc && <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">{r.desc}</span>}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 font-serif text-[13px] font-bold tabular-nums ${r.multiplier > 1 ? "bg-coral/10 text-coral" : r.multiplier < 1 ? "bg-jade/10 text-jade" : "bg-paper-2 text-ink"}`}>
                {fmtMultiplier(r.multiplier)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
