import type { ReactNode } from "react";
import { fmtRouteOptionLabel, fmtRoutePriceBadge, useAiRoutes, type AiCapability } from "../lib/platformAiRoutes";

/* AI 线路选择：列出运营后台配置的线路与计价，玩家点选后全局生效（同能力共用）。
 * 生图展示后台固定花费；文本仍展示倍率。
 * compact = 一行下拉；embedded = 嵌进生成世界等卡片（不重复标题，跟 world-gen 皮肤）；
 * asCard = 自带「创作引擎」整卡（含空态：写明需联系平台配置）；
 * 默认 = 独立卡片列表。接口没有线路时：非 asCard/embedded 不渲染。 */
export default function AiRoutePicker({
  capability,
  compact = false,
  embedded = false,
  asCard = false,
  title,
}: {
  capability: AiCapability;
  compact?: boolean;
  embedded?: boolean;
  asCard?: boolean;
  title?: string;
}) {
  const { routes, loading, current, select, reload } = useAiRoutes(capability);
  const label = title ?? (capability === "image" ? "生图线路" : capability === "tts" ? "语音线路" : "AI 线路");

  const wrapCard = (body: ReactNode) => {
    if (!asCard) return body;
    return (
      <section className="world-gen-card">
        <div className="world-gen-card-head">
          <h2 className="world-gen-card-title">{label}</h2>
        </div>
        {body}
      </section>
    );
  };

  if (loading) {
    if (asCard || embedded) {
      return wrapCard(
        <div className="world-gen-route-empty" role="status">
          <p>正在加载平台线路…</p>
        </div>,
      );
    }
    return null;
  }

  if (!routes.length) {
    // 功能注释：无线路须写清「联系平台配置」，禁止静默消失或只说「用默认」
    if (asCard || embedded) {
      return wrapCard(
        <div className="world-gen-route-empty" role="status">
          <p>暂无可用创作引擎，请联系平台在后台配置 AI 线路后再使用。</p>
          <button type="button" className="world-gen-chip" onClick={() => reload()}>
            重新加载
          </button>
        </div>,
      );
    }
    return null;
  }

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
              {fmtRouteOptionLabel(r, capability)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (embedded || asCard) {
    const list = (
      <div className="world-gen-route-list" role="radiogroup" aria-label={label}>
        <p className="world-gen-route-hint">
          {capability === "image" ? "按次扣费，金额见线路右侧" : "倍率由平台设定，按实际用量 × 倍率扣积分"}
        </p>
        {routes.map((r) => {
          const on = current?.id === r.id;
          const off = r.available === false;
          const badge = fmtRoutePriceBadge(r, capability);
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              onClick={() => select(r.id)}
              className={`world-gen-choice ${on ? "is-on" : ""}${off ? " is-disabled" : ""}`}
            >
              <span className="world-gen-choice-mark" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13.5px] font-bold text-ink">{r.name}</span>
                  {r.tag ? <span className="world-gen-chip !px-2 !py-0.5 text-[10.5px]">{r.tag}</span> : null}
                  {r.isDefault ? <span className="world-gen-chip world-gen-chip-accent !px-2 !py-0.5 text-[10.5px]">推荐</span> : null}
                  {off ? <span className="text-[10.5px] text-ink-soft">维护中</span> : null}
                </span>
                {r.desc ? <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-soft">{r.desc}</span> : null}
              </span>
              <span className={`world-gen-route-rate${capability !== "image" && r.multiplier > 1 ? " is-up" : capability !== "image" && r.multiplier < 1 ? " is-down" : ""}`}>
                {badge}
              </span>
            </button>
          );
        })}
      </div>
    );
    return wrapCard(list);
  }

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">{label}</p>
        <p className="text-[11px] text-ink-soft">
          {capability === "image" ? "按次扣费，见线路单价" : "倍率由平台设定，按实际用量 × 倍率扣积分"}
        </p>
      </div>
      <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
        {routes.map((r) => {
          const on = current?.id === r.id;
          const off = r.available === false;
          const badge = fmtRoutePriceBadge(r, capability);
          const up = capability !== "image" && r.multiplier > 1;
          const down = capability !== "image" && r.multiplier < 1;
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
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums ${up ? "bg-coral/10 text-coral" : down ? "bg-jade/10 text-jade" : "bg-paper-2 text-ink"}`}>
                {badge}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
