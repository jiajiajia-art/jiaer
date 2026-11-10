/* 钱包货币绑定：把手机钱包绑到某个自定义属性（灵石 / 金币 / 微信钱包…），
 * 绑定后购物车、阅读打赏、视频充电 / 直播打赏、红包、转账、买票、咸鱼的收付款都记在该属性上。 */
import { useGame } from "../../store/gameCtx";
import { looksLikeCurrency, walletDef, customAttrValue, wallet } from "../../game/wallet";
import { IconWallet } from "./icons";
import { onClearPlayerMemory } from "../../lib/saveScope";

const WX_GREEN = "var(--wx-accent, #07c160)"; // 功能注释：古风「传讯」皮肤由 .comm-ancient 改写为朱砂

/* 桌面钱包卡片 → 打开绿信直达钱包页（一次性跳转标记） */
let pendingWallet = false;
onClearPlayerMemory(() => { pendingWallet = false; });
export const requestWallet = () => { pendingWallet = true; };
export const peekWalletRequest = () => pendingWallet;
export const takeWalletRequest = () => { const v = pendingWallet; pendingWallet = false; return v; };

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export default function WalletBinder() {
  const { game, patchGame } = useGame();
  if (!game) return null;
  const defs = game.attrDefs ?? [];
  const cur = game.walletAttr && walletDef(game) ? game.walletAttr : undefined;
  const bind = (id?: string) => patchGame((g) => ({ ...g, walletAttr: id }));
  const sorted = [...defs].sort((a, b) => Number(looksLikeCurrency(b)) - Number(looksLikeCurrency(a)));
  const Radio = ({ on }: { on: boolean }) => (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]" style={{ borderColor: on ? WX_GREEN : "#c8c8c8", background: on ? WX_GREEN : "transparent" }}>
      {on && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>}
    </span>
  );
  const row = "flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-black/[0.03]";
  return (
    <div>
      <p className="px-4 pb-1.5 pt-1 text-[12.5px] text-[#7f7f7f]">钱包货币</p>
      <div className="divide-y divide-black/[0.06] overflow-hidden rounded-[10px] bg-white">
        <button type="button" role="radio" aria-checked={!cur} onClick={() => bind(undefined)} className={row}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#f2f2f2] text-[16px] font-semibold text-[#181818]">¥</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] text-[#181818]">游戏资金</span>
            <span className="block truncate text-[12px] text-[#9a9a9a]">人民币（元）· 默认</span>
          </span>
          <span className="shrink-0 text-[13px] tabular-nums text-[#7f7f7f]">{yuan(game.sim.money)}</span>
          <Radio on={!cur} />
        </button>
        {sorted.map((d) => {
          const on = cur === d.id;
          return (
            <button key={d.id} type="button" role="radio" aria-checked={on} onClick={() => bind(d.id)} className={row}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#f2f2f2] text-[17px]">{d.icon || d.label.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[15.5px] text-[#181818]">
                  <span className="truncate">{d.label}</span>
                  {looksLikeCurrency(d) && <span className="shrink-0 rounded-[4px] px-1 text-[10.5px] font-medium" style={{ color: WX_GREEN, background: "color-mix(in srgb, var(--wx-accent, #07c160) 10%, transparent)" }}>货币</span>}
                </span>
                <span className="block truncate text-[12px] text-[#9a9a9a]">{d.desc || "自定义属性"}{d.max ? ` · 上限 ${d.max}` : " · 无上限"}</span>
              </span>
              <span className="shrink-0 text-[13px] tabular-nums text-[#7f7f7f]">{customAttrValue(game, d).toLocaleString("zh-CN")}</span>
              <Radio on={on} />
            </button>
          );
        })}
      </div>
      <p className="px-5 pt-3 text-[12px] leading-relaxed text-[#9a9a9a]">
        {defs.length
          ? <>当前使用「{wallet.name(game, "零钱")}」：小粉书商城下单与购物车结算、阅读里打赏作者、视频里给 UP 主充电与直播打赏、买票、咸鱼买卖、聊天里发 / 领红包和转账，都会自动增减这笔余额；主线剧情里的买卖与赚钱也由 AI 记在这里。属性值可在状态栏点数字直接修改，属性本身（名称、上限、说明）在世界观编辑的「建角」里改。</>
          : <>还没有自定义货币。到「世界观编辑 → ① 基础 → 建角」点「＋ 添加」选「货币」（名字随意：金币 / 灵石 / 微信钱包都行，说明里写「这是货币」，最大值留空即无上限），也可以在 AI 对话编辑里说「加一个叫灵石的货币」；开新局后回到这里绑定。</>}
      </p>
    </div>
  );
}

/* 桌面「钱包」卡片：余额一眼可见，点按直达绿信钱包页绑定货币 */
export function WalletWidget() {
  const { game } = useGame();
  const d = game ? walletDef(game) : undefined;
  const bal = game ? wallet.balance(game) : 0;
  return (
    <div className="[container-type:size] flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl p-3 text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]" style={{ background: "linear-gradient(145deg,#0ad06f 0%,#07a95a 100%)" }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-white/85">
        <IconWallet size={14} /> 钱包
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] text-white/75">{d ? `${d.icon ? d.icon + " " : ""}${d.label}` : "零钱（元）"}</p>
        <p className="truncate text-[min(26px,22cqh,17cqw)] font-semibold leading-tight tabular-nums">
          {game ? (d ? bal.toLocaleString("zh-CN") : bal.toLocaleString("zh-CN", { maximumFractionDigits: 2 })) : "—"}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-white/65">点按绑定货币</p>
      </div>
    </div>
  );
}
