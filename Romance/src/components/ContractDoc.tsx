/* 经纪合约·全文档（点开背包里的合约后以「正式合约文书」形式全屏展开）
 * 数据取自签署时固化的 game.contract 快照，纯只读展示；版式为一纸 2005 年份的经纪合约。 */
import { useGame } from "../store/gameCtx";
import type { SignedContract } from "../lib/types";

/* 合约是一纸固定米色文书，文字颜色写死为深墨色（不随界面皮肤/暗色变化），
 * 否则「梦幻」皮肤下的浅紫文字会在米黄纸上糊成一片、看不清。 */
const INK = "text-[#2c2116]"; // 正文墨色
const INK_SOFT = "text-[#8a6f4e]"; // 次要/标注墨色

function Clause({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className={`mb-1 text-[13.5px] font-bold ${INK}`}>
        第{["一", "二", "三", "四", "五", "六", "七", "八"][n - 1]}条 · {title}
      </p>
      <p className="text-[13px] leading-relaxed text-[#3a2c1d]">{children}</p>
    </div>
  );
}

export default function ContractDoc({ contract, onClose }: { contract: SignedContract; onClose: () => void }) {
  const { game } = useGame();
  const artist = game!.player.name;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/55" onClick={onClose}>
      {/* 顶栏 */}
      <div className="flex items-center px-3 py-2.5 text-white" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="text-[14px] text-white/85">‹ 收起</button>
        <span className="flex-1 text-center text-[15px] font-semibold tracking-wide">经纪合约 · 文书</span>
        <span className="w-12" />
      </div>

      {/* 合约纸 */}
      <div className="flex-1 overflow-y-auto px-3 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="relative mx-auto max-w-md overflow-hidden rounded-sm bg-[#fbf7ee] shadow-2xl ring-1 ring-black/10">
          {/* 纸张竖纹 + 印油底纹 */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#000 0 1px,transparent 1px 26px)" }} />

          <div className="relative px-7 pb-10 pt-8">
            {/* 报头 */}
            <p className="text-center text-[11px] tracking-[0.4em] text-[#9a7b3f]">CONTRACT · 2005</p>
            <h1 className={`mt-1.5 text-center text-[22px] font-black tracking-widest ${INK}`}>艺人经纪合约</h1>
            <div className="mx-auto mt-2 h-px w-24 bg-[#c8a24a]" />
            <p className={`mt-3 text-center text-[12px] ${INK_SOFT}`}>
              {contract.company}　·　{contract.focusLabel}
              <span className="ml-1 text-[#b08a3a]">（{contract.companyStyle}）</span>
            </p>

            {/* 缔约方 */}
            <div className={`mt-5 space-y-1.5 border-y border-dashed border-[#d8c79a] py-3 text-[13px] ${INK}`}>
              <p><span className={INK_SOFT}>甲方（经纪公司）：</span><span className="font-semibold">{contract.company}</span></p>
              <p><span className={INK_SOFT}>乙方（签约艺人）：</span><span className="font-semibold">{artist}</span></p>
              <p className={`text-[12px] ${INK_SOFT}`}>兹经甲乙双方友好协商，就艺人经纪事宜达成如下条款，双方共同遵照执行。</p>
            </div>

            {/* 核心条款数字栏 */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                { k: "保底月薪", v: `¥${contract.baseSalary.toLocaleString()}`, tone: "text-[#2c2116]" },
                { k: "分成比例", v: `${contract.revenueShare}%`, tone: "text-[#1f7a52]" },
                { k: "违约金", v: `¥${contract.penalty.toLocaleString()}`, tone: "text-[#a83232]" },
              ].map((c) => (
                <div key={c.k} className="rounded-sm bg-white/60 px-1 py-2.5 ring-1 ring-[#e2d3a6]">
                  <p className={`text-[10.5px] tracking-wide ${INK_SOFT}`}>{c.k}</p>
                  <p className={`mt-0.5 text-[16px] font-bold tabular-nums ${c.tone}`}>{c.v}</p>
                </div>
              ))}
            </div>

            {/* 条文 */}
            <div className="mt-6">
              <Clause n={1} title="经纪授权">
                乙方独家授权甲方为其在演艺事业范围内之唯一经纪代理人。合约期内，乙方一切戏约、代言、商演及公开活动，均须经甲方统一报备与安排，不得私自承接。
              </Clause>
              <Clause n={2} title="酬劳与分成">
                甲方按月向乙方支付保底月薪 <b>¥{contract.baseSalary.toLocaleString()}</b>；乙方演艺所得收益，甲方按 <b>{contract.revenueShare}%</b> 比例参与分成，余额于每周日结算入账。
              </Clause>
              <Clause n={3} title="独家条款">
                {contract.exclusive}。合约存续期间，乙方不得与任何第三方另行签订经纪或代理协议。
              </Clause>
              <Clause n={4} title="考核与回本">
                甲方对乙方设季度考核，须完成约定之通告与营收指标以回收投入。连续未达标者，甲方有权调整资源配置或依约处置。
              </Clause>
              <Clause n={5} title="违约责任">
                任何一方擅自解约或违反本约主要义务，须向对方支付违约金 <b>¥{contract.penalty.toLocaleString()}</b>，并赔偿由此造成之实际损失。
              </Clause>
            </div>

            {/* 落款 + 印章 */}
            <div className="mt-8 flex items-end justify-between">
              <div className={`text-[12px] leading-relaxed ${INK}`}>
                <p className={INK_SOFT}>甲方（盖章）：</p>
                <p className="mt-3 font-semibold">{contract.company}</p>
                <p className={`mt-4 ${INK_SOFT}`}>乙方（签名）：</p>
                <p className={`mt-2 font-serif text-[18px] italic ${INK}`}>{artist}</p>
              </div>
              {/* 红色印章 */}
              <div className="relative flex h-24 w-24 shrink-0 rotate-[-14deg] items-center justify-center">
                <div className="flex h-full w-full items-center justify-center rounded-full border-[3px] border-[#b0342d] text-center text-[10px] font-bold leading-tight text-[#b0342d] opacity-85">
                  <span className="px-2">{contract.company}<br />经纪专用章</span>
                </div>
                <span className="absolute text-[26px] text-[#b0342d] opacity-70">★</span>
              </div>
            </div>

            <p className={`mt-6 text-center text-[11px] tracking-widest ${INK_SOFT}`}>— 二〇〇五年 · 于星城 —</p>
          </div>
        </div>
      </div>
    </div>
  );
}
