import { useGame } from "../store/gameCtx";
import { Modal } from "./ui";
import Check from "./Check";
import Bill from "./Bill";

/* 第 N 周的周日日期（第 1 周周一 = 2005.01.03） */
function sundayDate(week: number): string {
  const base = new Date(2005, 0, 3); // 第 1 周周一
  const d = new Date(base.getTime() + ((week - 1) * 7 + 6) * 86400000);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/* 财务 · 支票与账单：周日结算的演艺进账支票与生活账单。由右上角 ☰ 菜单唤出。 */
export default function Finance({ onClose }: { onClose: () => void }) {
  const { game } = useGame();
  if (!game) return null;

  const s = game.sim;
  const p = game.player;

  return (
    <Modal title="财务 · 支票与账单" onClose={onClose}>
      <div className="mb-3 flex items-baseline justify-between border-b border-dashed border-line pb-2">
        <span className="text-[12.5px] text-ink-soft">当前资金</span>
        <span className={`text-[16px] font-bold tabular-nums ${s.money < 0 ? "text-danger" : "text-jade"}`}>¥{s.money.toLocaleString("zh-CN")}</span>
      </div>
      <div className="space-y-3">
        {(s.checks ?? []).length > 0 ? (
          (s.checks ?? []).map((c, i) => (
            <div key={`${c.serial}-${i}`}>
              <p className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-ink-soft">
                <span className={`inline-block rounded-sm px-1.5 py-0.5 text-[10px] ${c.kind === "deposit" ? "bg-gold/15 text-gold" : "bg-jade/15 text-jade"}`}>
                  {c.kind === "deposit" ? "签约定金" : "拍毕尾款"}
                </span>
                第 {c.week} 周 · 《{c.gigName}》
              </p>
              <Check
                payee={p.name}
                amount={c.amount}
                dateStr={sundayDate(c.week)}
                memo={c.memo}
                serial={c.serial}
                drawer={c.drawer}
              />
            </div>
          ))
        ) : (
          <p className="rounded-sm border border-dashed border-line px-3 py-2.5 text-[12.5px] text-ink-soft">
            暂无通告支票。接取通告后，开机前的周日会收到「签约定金」，按时拍完则于杀青周日收到「拍毕尾款」。
          </p>
        )}
        {s.lastBill ? (
          <Bill bill={s.lastBill} payer={p.name} />
        ) : (
          <p className="rounded-sm border border-dashed border-line px-3 py-2.5 text-[12.5px] text-ink-soft">
            尚未产生生活账单。每周日会结算房租、饮食与日常开销。
          </p>
        )}
      </div>
    </Modal>
  );
}
