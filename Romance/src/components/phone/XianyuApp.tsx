import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { itemById } from "../../worlds/star2005/content";
import { listingBuzz, sellerRating, suggestPrice, type XianyuListing } from "../../game/xianyu";
import { TopBar, Empty } from "./shared";

const ACCENT = "#1a9b98";

/* 「咸鱼」二手集市：把背包里的物件挂出二次售卖，成交回款并收到买家评价。
 * 纯前端玩法层——挂卖/下架/成交都走 GameContext 的确定性回调，随存档持久化。 */

type Tab = "sell" | "onsale" | "sold";

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ color: "#ffb020" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ fontSize: size, opacity: i <= Math.round(n) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  );
}

export default function XianyuApp({ onBack }: { onBack: () => void }) {
  const { game, xianyuList, xianyuDelist, xianyuSell } = useGame();
  const [tab, setTab] = useState<Tab>("sell");
  const [composing, setComposing] = useState<string | null>(null); // 正在定价的背包物件 id
  const [price, setPrice] = useState(0);

  if (!game) return null;
  const s = game.sim;
  const listings = s.xianyu ?? [];
  const active = listings.filter((l) => l.status === "active");
  const sold = listings.filter((l) => l.status === "sold");
  const listedIds = new Set(active.map((l) => l.itemId));
  const bagItems = (s.bag ?? []).filter((id) => !listedIds.has(id)).map((id) => itemById(id)).filter(Boolean);
  const credit = sellerRating(listings);

  const openCompose = (itemId: string, base?: number) => {
    setComposing(itemId);
    setPrice(suggestPrice(base));
  };
  const confirmList = () => {
    if (!composing) return;
    xianyuList(composing, price);
    setComposing(null);
    setTab("onsale");
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "sell", label: `我的闲置 ${bagItems.length}` },
    { id: "onsale", label: `在售 ${active.length}` },
    { id: "sold", label: `已售 ${sold.length}` },
  ];

  return (
    <div className="flex h-full flex-col bg-[#f5f6f7]">
      <TopBar title="咸鱼" onBack={onBack} />

      {/* 卖家名片 + 信用 */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#1a9b98] to-[#25c0b0] px-4 py-3 text-white">
        <Avatar src={game.player.avatar} name={game.player.name} size={44} editable={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{game.player.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/90">
            {credit.count > 0 ? (
              <><Stars n={credit.avg} size={11} /> <span>{credit.avg.toFixed(1)} · 成交 {credit.count} 笔</span></>
            ) : (
              <span>新卖家 · 还没有成交记录</span>
            )}
          </p>
        </div>
        <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium">余额 ¥{s.money.toLocaleString("zh-CN")}</span>
      </div>

      {/* 分段 Tab */}
      <div className="flex border-b border-black/5 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="relative flex-1 py-2.5 text-[13px] font-medium"
            style={{ color: tab === t.id ? ACCENT : "#8a9099" }}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-[30%] -bottom-px h-0.5 rounded-full" style={{ background: ACCENT }} />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* —— 我的闲置：可从背包挂卖 —— */}
        {tab === "sell" && (
          bagItems.length === 0 ? (
            <Empty text="背包里暂时没有可挂卖的闲置。去世界各处逛逛、拾取些物件再来吧。" />
          ) : (
            <div className="space-y-2 p-3">
              {bagItems.map((it) => it && (
                <div key={it.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eef7f6] text-[26px]">{it.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{it.name}</p>
                      <p className="truncate text-[11.5px] text-ink-soft">{it.desc}</p>
                    </div>
                    {composing !== it.id && (
                      <button
                        onClick={() => openCompose(it.id, it.price)}
                        className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                        style={{ background: ACCENT }}
                      >
                        挂上去卖
                      </button>
                    )}
                  </div>
                  {composing === it.id && (
                    <div className="mt-3 border-t border-black/5 pt-3">
                      <p className="mb-1.5 text-[12px] text-ink-soft">给它定个价（建议 ¥{suggestPrice(it.price)}）</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold" style={{ color: ACCENT }}>¥</span>
                        <button onClick={() => setPrice((p) => Math.max(1, p - 5))} className="h-8 w-8 rounded-full bg-black/[0.05] text-[16px] text-ink-soft">−</button>
                        <input
                          type="number"
                          value={price}
                          onChange={(e) => setPrice(Math.max(1, Math.round(Number(e.target.value) || 0)))}
                          className="w-24 rounded-lg border border-black/10 px-2 py-1.5 text-center text-[15px] font-semibold text-ink outline-none"
                        />
                        <button onClick={() => setPrice((p) => p + 5)} className="h-8 w-8 rounded-full bg-black/[0.05] text-[16px] text-ink-soft">＋</button>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setComposing(null)} className="flex-1 rounded-full bg-black/[0.05] py-2 text-[13px] font-medium text-ink-soft">取消</button>
                        <button onClick={confirmList} className="flex-1 rounded-full py-2 text-[13px] font-semibold text-white" style={{ background: ACCENT }}>确认挂卖</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* —— 在售：可成交或下架 —— */}
        {tab === "onsale" && (
          active.length === 0 ? (
            <Empty text="还没有在售的宝贝。去「我的闲置」挂几件出来吧。" />
          ) : (
            <div className="space-y-2 p-3">
              {active.map((l) => {
                const buzz = listingBuzz(l, s.day);
                return (
                  <div key={l.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eef7f6] text-[26px]">{l.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">{l.name}</p>
                        <p className="mt-0.5 text-[11px] text-ink-soft">👀 {buzz.views} 浏览 · ❤ {buzz.wants} 想要 · 💬 {buzz.msgs} 留言</p>
                      </div>
                      <span className="shrink-0 text-[16px] font-bold" style={{ color: ACCENT }}>¥{l.price.toLocaleString("zh-CN")}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => xianyuDelist(l.id)} className="rounded-full bg-black/[0.05] px-4 py-1.5 text-[12.5px] font-medium text-ink-soft">下架</button>
                      <button onClick={() => xianyuSell(l.id)} className="flex-1 rounded-full py-1.5 text-[12.5px] font-semibold text-white" style={{ background: ACCENT }}>
                        {buzz.wants > 0 ? `有买家想要 · 确认卖出` : "确认卖出"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* —— 已售：成交价 + 买家评价 —— */}
        {tab === "sold" && (
          sold.length === 0 ? (
            <Empty text="还没有成交记录。卖出第一单，就能收到买家评价啦。" />
          ) : (
            <div className="space-y-2 p-3">
              {sold.map((l) => (
                <SoldCard key={l.id} l={l} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function SoldCard({ l }: { l: XianyuListing }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f0f1f2] text-[26px] grayscale">
          {l.icon}
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-[11px] font-bold text-white">已售</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{l.name}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-soft">
            挂价 ¥{l.price.toLocaleString("zh-CN")} · 成交 <span className="font-semibold" style={{ color: ACCENT }}>¥{(l.soldPrice ?? l.price).toLocaleString("zh-CN")}</span>
          </p>
        </div>
      </div>
      {l.review && (
        <div className="mt-2.5 rounded-lg bg-[#faf9f5] px-3 py-2">
          <div className="flex items-center gap-2">
            <Stars n={l.review.rating} />
            <span className="text-[11.5px] text-ink-soft">买家 · {l.review.buyer}</span>
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-ink">{l.review.text}</p>
        </div>
      )}
    </div>
  );
}
