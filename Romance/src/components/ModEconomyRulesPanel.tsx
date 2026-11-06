import { bankruptLineFor, type EconomyRules, type TuningSlot } from "../game/data";
import { enabledChargeItems, type ChargeBasisItem } from "../game/chargeBasis";
import type { Mod } from "../mods/types";

/**
 * 功能注释：经济配置挂在「④ 剧情 → 结局」。
 * 含扣费依据 + 透支/破产/新手缓冲；养成页不再重复出现「经济与收支」。
 */
type C = Mod["content"];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const lbl = "mb-0.5 block text-[11px] font-semibold text-ink-soft";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const opt = (v: string) => (v === "" ? undefined : Number(v) || 0);
const uid = () => `ch_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;

export default function ModEconomyRulesPanel({
  c,
  showBills = true,
  onChange,
}: {
  c: C;
  /** 功能注释：有账单时破产线占位可估自动值；未勾账单则提示还没写 */
  showBills?: boolean;
  onChange: (p: Partial<C>) => void;
}) {
  const t: TuningSlot = c.tuning ?? {};
  const eco: EconomyRules = t.economy ?? {};
  const items = eco.chargeItems ?? [];
  const shown = enabledChargeItems(eco.chargeItems);
  const activeLabels = shown.filter((x) => x.mode === "active").map((x) => x.label.trim());
  const passiveLabels = shown.filter((x) => x.mode === "passive").map((x) => x.label.trim());
  const weekly = showBills ? (c.bills?.weekly ?? []).reduce((a, b) => a + b.amount, 0) : 0;
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
    <div className="space-y-3" data-author-section="economy-rules">
      <div className="rounded-xl border border-line bg-paper-2/60 p-3 text-[11.5px] leading-relaxed text-ink-soft">
        <p className="mb-1.5 font-bold text-ink">扣费依据</p>
        <p className="mb-2">按本作品实际有的开销勾选并填写；没有的项不要添加。主动消费余额不足会拒绝；被动扣费允许透支。开局资金在「① 基础 → 建角」。</p>
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

      <div className="rounded-xl border border-line bg-paper p-3">
        <p className="mb-2 text-[12px] font-bold text-ink">经济规则</p>
        <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
          透支超过破产线时是否收官、破产线与新手缓冲。开局资金在「① 基础 → 建角」。
        </p>
        <label className="mb-2 flex items-center gap-2 text-[12px] text-ink">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--jade)]"
            checked={eco.bankrupt !== false}
            onChange={(e) => setEco({ bankrupt: e.target.checked ? undefined : false })}
          />
          透支超过破产线时结束游戏
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={lbl}>破产线（透支金额）</span>
            <input
              type="number"
              min={0}
              className={inp}
              value={eco.bankruptLine ?? ""}
              placeholder={showBills && c.bills ? `自动 ${(-bankruptLineFor(weekly, {})).toLocaleString("zh-CN")}` : "还没写账单"}
              onChange={(e) => setEco({ bankruptLine: opt(e.target.value) })}
            />
          </label>
          <label>
            <span className={lbl}>透支每周压力</span>
            <input
              type="number"
              min={0}
              className={inp}
              value={eco.overdraftStress ?? ""}
              placeholder="还没写"
              onChange={(e) => setEco({ overdraftStress: opt(e.target.value) })}
            />
          </label>
          <label>
            <span className={lbl}>新手缓冲（前 N 周）</span>
            <input
              type="number"
              min={0}
              className={inp}
              value={eco.graceWeeks ?? ""}
              placeholder="0 = 关闭"
              onChange={(e) => setEco({ graceWeeks: opt(e.target.value) })}
            />
          </label>
          <label>
            <span className={lbl}>缓冲期账单倍率</span>
            <input
              type="number"
              min={0}
              step={0.1}
              className={inp}
              value={eco.graceBillMul ?? ""}
              placeholder="还没写"
              onChange={(e) => setEco({ graceBillMul: opt(e.target.value) })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
