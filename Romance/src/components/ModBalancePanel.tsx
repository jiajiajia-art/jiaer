import { type EconomyRules, type TuningSlot } from "../game/data";
import { enabledChargeItems, type ChargeBasisItem } from "../game/chargeBasis";
import type { Mod } from "../mods/types";

/**
 * 模组编辑器 · ③ 养成 · 经济与收官：只保留「扣费依据」。
 * 功能注释：透支/破产/新手缓冲改在④剧情 → 结局配置，这里不要再堆收官规则。
 */
type C = Mod["content"];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const uid = () => `ch_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;

export default function ModBalancePanel({
  c,
  kind: _kind,
  onChange,
}: {
  c: C;
  kind: Mod["kind"];
  onChange: (p: Partial<C>) => void;
}) {
  const t: TuningSlot = c.tuning ?? {};
  const eco: EconomyRules = t.economy ?? {};
  const items = eco.chargeItems ?? [];
  const shown = enabledChargeItems(eco.chargeItems);
  const activeLabels = shown.filter((x) => x.mode === "active").map((x) => x.label.trim());
  const passiveLabels = shown.filter((x) => x.mode === "passive").map((x) => x.label.trim());

  const setEco = (p: Partial<EconomyRules>) => {
    const next: EconomyRules = { ...eco, ...p };
    for (const k of Object.keys(next) as (keyof EconomyRules)[]) if (next[k] === undefined) delete next[k];
    const tt: TuningSlot = { ...t, economy: Object.keys(next).length ? next : undefined };
    if (!tt.economy) delete tt.economy;
    onChange({ tuning: Object.keys(tt).length ? tt : undefined });
  };
  const setItems = (next: ChargeBasisItem[]) => setEco({ chargeItems: next.length ? next : undefined });
  const patchItem = (id: string, p: Partial<ChargeBasisItem>) => setItems(items.map((x) => (x.id === id ? { ...x, ...p } : x)));

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-paper-2/60 p-3 text-[11.5px] leading-relaxed text-ink-soft">
        <p className="mb-1.5 font-bold text-ink">扣费依据</p>
        <p className="mb-2">按本作品实际有的开销勾选并填写；没有的项不要添加。主动消费余额不足会拒绝；被动扣费允许透支。破产线与透支收官请到「④ 剧情 → 结局」配置。</p>
        {!items.length ? (
          <p className="rounded-lg border border-dashed border-line bg-paper px-2.5 py-2 text-[12px] text-ink-soft">还没有扣费依据。点下方添加；未勾选的项不会出现在说明里。</p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-1.5">
                <label className="flex shrink-0 items-center gap-1 text-[12px] text-ink">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--jade)]" checked={it.on !== false} onChange={(e) => patchItem(it.id, { on: e.target.checked ? undefined : false })} />
                  启用
                </label>
                <select className={`${inp} !w-auto shrink-0`} value={it.mode} aria-label="扣费类型" onChange={(e) => patchItem(it.id, { mode: e.target.value as ChargeBasisItem["mode"] })}>
                  <option value="active">主动消费</option>
                  <option value="passive">被动扣费</option>
                </select>
                <input className={`${inp} min-w-[8rem] flex-1`} value={it.label} placeholder="例如：学费、房租、路费…" maxLength={40} onChange={(e) => patchItem(it.id, { label: e.target.value })} />
                <button type="button" className={`${btn} shrink-0`} aria-label="删除" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>×</button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={`${btn} mt-2`} onClick={() => setItems([...items, { id: uid(), label: "", mode: "active" }])}>＋ 添加扣费项</button>
        {shown.length > 0 && (
          <div className="mt-2 space-y-0.5 border-t border-line/70 pt-2 text-[11.5px]">
            {!!activeLabels.length && <p><b className="text-ink">主动消费</b>：{activeLabels.join("、")}。按标价扣，余额不足直接拒绝。</p>}
            {!!passiveLabels.length && <p><b className="text-ink">被动扣费</b>：{passiveLabels.join("、")}。允许透支。</p>}
          </div>
        )}
      </div>
    </div>
  );
}
