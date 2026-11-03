import { bankruptLineFor, type EconomyRules, type TuningSlot } from "../game/data";
import type { Mod } from "../mods/types";

/**
 * 功能注释：透支 / 破产 / 新手缓冲写在「结局」配置里。
 * 数据仍落在 tuning.economy（与扣费依据同对象），只是编辑入口从养成挪走，避免经济与收官堆一坨。
 */
type C = Mod["content"];
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/60 focus:border-jade focus:outline-none";
const lbl = "mb-0.5 block text-[11px] font-semibold text-ink-soft";
const opt = (v: string) => (v === "" ? undefined : Number(v) || 0);

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
  const weekly = showBills ? (c.bills?.weekly ?? []).reduce((a, b) => a + b.amount, 0) : 0;
  const setEco = (p: Partial<EconomyRules>) => {
    const next: EconomyRules = { ...eco, ...p };
    for (const k of Object.keys(next) as (keyof EconomyRules)[]) if (next[k] === undefined) delete next[k];
    const tt: TuningSlot = { ...t, economy: Object.keys(next).length ? next : undefined };
    if (!tt.economy) delete tt.economy;
    onChange({ tuning: Object.keys(tt).length ? tt : undefined });
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-3" data-author-section="economy-rules">
      <p className="mb-2 text-[12px] font-bold text-ink">经济规则</p>
      <p className="mb-2 text-[11.5px] leading-relaxed text-ink-soft">
        透支超过破产线时是否收官、破产线与新手缓冲。开销条目在「③ 养成 → 经济与收官」添加；开局资金在「① 基础 → 建角」。
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
  );
}
