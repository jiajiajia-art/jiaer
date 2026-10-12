/* 星城银行·转账支票——周日结算时的演艺进账凭证。精致仿旧支票排版，与《星城娱樂週報》成套。
 * 金额为引擎确定性结算，本组件只做呈现（含人民币大写转换，纯前端格式化）。 */

const D = "零壹贰叁肆伍陆柒捌玖";
const U = ["", "拾", "佰", "仟"];
const G = ["", "万", "亿", "兆"];

/* 整数金额 → 人民币大写（用于支票金额栏） */
function rmbUpper(num: number): string {
  let n = Math.floor(Math.abs(num));
  if (n === 0) return "零元整";
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 10000);
    n = Math.floor(n / 10000);
  }
  let out = "";
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const g = groups[gi];
    if (g === 0) {
      if (out && !out.endsWith("零")) out += "零";
      continue;
    }
    let gs = "";
    let zero = false;
    for (let u = 3; u >= 0; u--) {
      const d = Math.floor(g / Math.pow(10, u)) % 10;
      if (d === 0) zero = true;
      else {
        if (zero) { gs += "零"; zero = false; }
        gs += D[d] + U[u];
      }
    }
    if (out && g < 1000) out += "零";
    out += gs + G[gi];
  }
  return out + "元整";
}

export default function Check({
  payee,
  amount,
  dateStr,
  memo,
  serial,
  drawer = "启星文化传媒有限公司",
}: {
  payee: string;
  amount: number;
  dateStr: string;
  memo: string;
  serial: string;
  drawer?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-sm border border-jade/60 bg-gradient-to-br from-jade/5 via-paper to-gold/5 font-serif text-ink shadow-[0_2px_14px_-8px_rgba(0,0,0,0.4)]">
      {/* 底纹水印 */}
      <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 select-none text-[110px] font-black leading-none text-jade/5">￥</div>

      {/* 抬头 */}
      <div className="flex items-center justify-between border-b border-dashed border-jade/40 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-black tracking-[0.15em] text-jade-deep">星城银行</span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-ink-soft">Transfer Cheque</span>
        </div>
        <span className="font-mono text-[11px] text-ink-soft">No. {serial}</span>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="shrink-0 text-ink-soft">出票日期</span>
          <span className="flex-1 border-b border-dotted border-line pb-0.5 tracking-wide">{dateStr}</span>
        </div>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="shrink-0 text-ink-soft">收款人</span>
          <span className="flex-1 border-b border-dotted border-line pb-0.5 font-bold">{payee}</span>
        </div>

        {/* 金额栏 */}
        <div className="flex items-stretch gap-2">
          <div className="flex flex-1 items-baseline gap-2 rounded-sm border border-jade/30 bg-paper/60 px-2.5 py-1.5">
            <span className="shrink-0 text-[11px] text-ink-soft">人民币（大写）</span>
            <span className="flex-1 text-[14px] font-bold tracking-wide text-jade-deep">{rmbUpper(amount)}</span>
          </div>
          <div className="flex items-center gap-1 rounded-sm border border-gold/50 bg-gold/10 px-3 py-1.5">
            <span className="text-[13px] font-bold text-gold">￥</span>
            <span className="font-mono text-[16px] font-black tabular-nums text-ink">{amount.toLocaleString()}</span>
          </div>
        </div>

        {/* 摘要 + 签章 */}
        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="flex items-baseline gap-2 text-[12px]">
            <span className="shrink-0 text-ink-soft">用途</span>
            <span className="border-b border-dotted border-line pb-0.5 text-ink">{memo}</span>
          </div>
          <div className="text-right">
            <span className="inline-block -rotate-6 rounded-full border-2 border-coral/70 px-2.5 py-1 text-[10px] font-black leading-tight text-coral/80">
              {drawer.slice(0, 2)}<br />财务专用章
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-jade/40 px-4 py-1.5 text-[10px] tracking-[0.15em] text-ink-soft">
        出票单位 · {drawer}　凭此支票于每周日入账
      </div>
    </div>
  );
}
