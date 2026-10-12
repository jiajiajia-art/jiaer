/* 星城生活账单——每周/月末的固定开销明细（含餐饮美食）。精致仿旧账单排版，与支票、週報成套。
 * 金额均为引擎确定性结算，本组件只做呈现。 */
import type { WeekBill } from "../game/logic";

export default function Bill({ bill, payer }: { bill: WeekBill; payer: string }) {
  const title = bill.monthEnd ? "月末结算账单" : "本周生活账单";
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-paper font-serif text-ink shadow-[0_2px_12px_-8px_rgba(0,0,0,0.35)]">
      {/* 抬头 */}
      <div className="border-b-2 border-double border-ink px-4 py-2.5 text-center">
        <p className="text-[15px] font-black tracking-[0.2em]">星城生活账单</p>
        <p className="mt-0.5 text-[10px] uppercase tracking-[0.3em] text-ink-soft">Living Statement · 第 {bill.week} 周</p>
      </div>

      <div className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-ink-soft">
          <span>{title}</span>
          <span>{bill.monthEnd ? "含房租 · 宣传" : "日常开销"}</span>
        </div>

        {/* 明细：虚线牵引 */}
        <ul className="space-y-1.5">
          {bill.lines.map((l) => (
            <li key={l.label} className="flex items-baseline gap-2 text-[13px]">
              <span className="shrink-0">{l.label}</span>
              <span className="min-w-0 flex-1 translate-y-[-3px] border-b border-dotted border-line" />
              <span className="shrink-0 font-mono tabular-nums text-ink-soft">￥{l.amount.toLocaleString()}</span>
            </li>
          ))}
        </ul>

        {/* 合计 */}
        <div className="mt-3 flex items-center justify-between border-t-2 border-double border-ink pt-2">
          <span className="text-[13px] font-bold tracking-wide">合计支出</span>
          <span className="font-mono text-[17px] font-black tabular-nums text-danger">￥{bill.total.toLocaleString()}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-line px-4 py-1.5 text-center text-[10px] tracking-[0.15em] text-ink-soft">
        {payer} · 星城物业与生活服务　请于每月末结清
      </div>
    </div>
  );
}
