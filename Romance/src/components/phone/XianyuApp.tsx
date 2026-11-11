import { useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { worldItemById as itemById } from "../../mods/registry";
import { listingBuzz, sellerRating, suggestPrice, type XianyuListing } from "../../game/xianyu";
import { TopBar, Empty, LoadMoreButton, seenOf } from "./shared";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";
import { wallet } from "../../game/wallet";
import { logAct } from "../../game/phoneLink";
import { IconHeart } from "../../lib/icons";

/* 剧情联动的「集市」宝贝：其他卖家挂出的应援周边 / 道具，可直接下单购买（扣余额） */
type MarketItem = { id: string; name: string; icon: string; price: number; seller: string; blurb: string; bought?: boolean };

const ACCENT = "#ffda00"; /* 闲鱼标志黄 */
const INK = "#1f1f1f";
const PRICE = "#ff4400"; /* 闲鱼价格橙红 */

/* 「咸鱼」二手集市：把背包里的物件挂出二次售卖，成交回款并收到买家评价。
 * 纯前端玩法层——挂卖/下架/成交都走 GameContext 的确定性回调，随存档持久化。 */

type Tab = "market" | "sell" | "onsale" | "sold";

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex" style={{ color: "#ffb020" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ opacity: i <= Math.round(n) ? 1 : 0.25 }} aria-hidden><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
      ))}
    </span>
  );
}

export default function XianyuApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, commitGame, xianyuList, xianyuDelist, xianyuSell } = useGame();
  const [tab, setTab] = useState<Tab>("sell");
  const [market, setMarket] = useState<MarketItem[]>(() => loadFeed<MarketItem[]>("xianyu") ?? []);
  const [tip, setTip] = useState("");
  const saveMarket = (m: MarketItem[]) => { setMarket(m); saveFeed("xianyu", m); };

  const parseItems = (raw: unknown, pfx: string): MarketItem[] => {
    const str = (v: unknown, d: string, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);
    const now = Date.now();
    return (Array.isArray(raw) ? raw : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, 8).map((x, i) => {
      const p = Number(x.price);
      return { id: `${pfx}${now}${i}`, name: str(x.name, "", 24), icon: str(x.icon, "", 4), price: Number.isFinite(p) ? Math.min(99999, Math.max(1, Math.round(p))) : 50, seller: str(x.seller, "闲鱼网友", 16), blurb: str(x.blurb, "", 80) };
    }).filter((x) => x.name);
  };
  // 底部「查看更多」：结合剧情再生成一批在售宝贝，接在集市末尾（持久化）
  const [more, setMore] = useState<MarketItem[]>(() => loadFeed<MarketItem[]>("xianyu.more") ?? []);
  const [moreLoading, setMoreLoading] = useState(false);
  const flash = (t: string) => { setTip(t); setTimeout(() => setTip(""), 2000); };
  const loadMore = async () => {
    if (moreLoading) return;
    setMoreLoading(true);
    try {
      const seen = seenOf([...market, ...more].map((m) => m.name));
      const r = await syncJson<{ items?: unknown }>(cfg, game!, "xianyu", "咸鱼", `再生成 5 件二手集市在售宝贝，可紧扣最近剧情（人物/活动相关周边、签名物、票根、道具、同款等），也可是圈内日常闲置，卖家为网友；不要与这些已有宝贝重复：${seen}。返回 {"items":[{"name":"宝贝名≤20字","price":120,"seller":"卖家昵称","blurb":"描述≤50字"}]}`);
      if (!r) { flash("未配置 AI，暂无更多"); return; }
      const fresh = parseItems(r.items, "mkm");
      if (!fresh.length) { flash("生成失败，请重试"); return; }
      const next = [...more, ...fresh].slice(-60);
      setMore(next); saveFeed("xianyu.more", next);
      flash(`新加载 ${fresh.length} 件`);
    } catch { flash("加载失败，请重试"); } finally { setMoreLoading(false); }
  };

  useWorldSync("xianyu", async () => {
    const r = await syncJson<{ items?: unknown }>(cfg, game!, "xianyu", "咸鱼", `生成 4 件紧扣当前世界剧情的二手集市在售宝贝（如剧情中人物/活动的应援周边、签名物、演出票根、剧组道具、同款服饰等），卖家为网友。返回 {"items":[{"name":"宝贝名≤20字","price":120,"seller":"卖家昵称","blurb":"描述≤50字"}]}`);
    if (!r) return "未配置 AI，无法联动剧情";
    const fresh = parseItems(r.items, "mk").slice(0, 6);
    if (!fresh.length) return "这次没有新宝贝，请稍后再试";
    saveMarket([...fresh, ...market].slice(0, 20));
    setTab("market");
    return `集市上新 ${fresh.length} 件剧情相关宝贝`;
  });

  const buyMarket = (m: MarketItem) => {
    if (!game || m.bought) return;
    if (wallet.balance(game) < m.price) { setTip(`${wallet.name(game, "零钱")}余额不足`); setTimeout(() => setTip(""), 2000); return; }
    commitGame(logAct(wallet.add(game, -m.price), { app: "咸鱼", text: `拍下了「${m.name}」（${wallet.fmt(m.price, game)}，卖家 ${m.seller}）`, min: 5 }));
    if (more.some((x) => x.id === m.id)) { const next = more.map((x) => (x.id === m.id ? { ...x, bought: true } : x)); setMore(next); saveFeed("xianyu.more", next); }
    else saveMarket(market.map((x) => (x.id === m.id ? { ...x, bought: true } : x)));
    setTip(`已拍下「${m.name}」，支付 ${wallet.fmt(m.price, game)}`); setTimeout(() => setTip(""), 2000);
  };
  const [composing, setComposing] = useState<string | null>(null); // 正在定价的背包物件 id
  const [price, setPrice] = useState(0);
  const [detail, setDetail] = useState<MarketItem | null>(null);

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
    { id: "market", label: `集市 ${[...market, ...more].filter((m) => !m.bought).length}` },
    { id: "sell", label: `我的闲置 ${bagItems.length}` },
    { id: "onsale", label: `在售 ${active.length}` },
    { id: "sold", label: `已售 ${sold.length}` },
  ];

  return (
    <div className="relative flex h-full flex-col bg-[#f5f6f7]">
      <TopBar title="咸鱼" onBack={onBack} />

      {/* 卖家名片 + 信用 */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#ffe60f] to-[#ffd000] px-4 py-3 text-[#1f1f1f]">
        <Avatar src={game.player.avatar} name={game.player.name} size={44} editable={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{game.player.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-black/70">
            {credit.count > 0 ? (
              <><Stars n={credit.avg} size={11} /> <span>{credit.avg.toFixed(1)} · 成交 {credit.count} 笔</span></>
            ) : (
              <span>新卖家 · 还没有成交记录</span>
            )}
          </p>
        </div>
        <span className="rounded-full shrink-0 bg-white/60 px-2.5 py-1 text-[11px] font-medium">余额 {wallet.fmt(wallet.balance(game), game, (x) => `¥${x.toLocaleString("zh-CN")}`)}</span>
      </div>

      {/* 分段 Tab */}
      <div className="flex border-b border-black/5 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex-1 whitespace-nowrap py-2.5 text-[12.5px] ${tab === t.id ? "font-bold" : "font-medium"}`}
            style={{ color: tab === t.id ? INK : "#8a9099" }}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-[30%] -bottom-px h-0.5 rounded-full" style={{ background: ACCENT }} />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tip && <p className="bg-[#fff8cc] py-1.5 text-center text-[12px]" style={{ color: INK }}>{tip}</p>}
        {/* —— 集市：剧情联动的他人在售宝贝 —— */}
        {tab === "market" && (
          market.length + more.length === 0 ? (
            <>
              <Empty text="集市暂时空空。点右上角刷新，看看圈里最近在流通什么好物。" />
              <LoadMoreButton loading={moreLoading} onClick={loadMore} color={PRICE} dark />
            </>
          ) : (
            <div className="space-y-2 p-3">
              {[...market, ...more].map((m) => (
                <div key={m.id} role="button" tabIndex={0} onClick={() => setDetail(m)} onKeyDown={(e) => { if (e.key === "Enter") setDetail(m); }} className="flex cursor-pointer items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition active:scale-[0.99]">
                  <GoodsIcon name={m.name + m.blurb} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink">{m.name}</p>
                    <p className="line-clamp-2 text-[11.5px] text-ink-soft">{m.blurb}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft/80">卖家 · {m.seller}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[15px] font-bold" style={{ color: PRICE }}>¥{m.price.toLocaleString("zh-CN")}</span>
                    <button disabled={m.bought} onClick={(e) => { e.stopPropagation(); buyMarket(m); }} className="rounded-full px-3 py-1 text-[12px] font-semibold disabled:opacity-40" style={{ background: ACCENT, color: INK }}>{m.bought ? "已拍下" : "我想要"}</button>
                  </div>
                </div>
              ))}
              <LoadMoreButton loading={moreLoading} onClick={loadMore} color={PRICE} dark />
            </div>
          )
        )}
        {/* —— 我的闲置：可从背包挂卖 —— */}
        {tab === "sell" && (
          bagItems.length === 0 ? (
            <Empty text="背包里暂时没有可挂卖的闲置。去世界各处逛逛、拾取些物件再来吧。" />
          ) : (
            <div className="space-y-2 p-3">
              {bagItems.map((it) => it && (
                <div key={it.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <GoodsIcon name={it.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-ink">{it.name}</p>
                      <p className="truncate text-[11.5px] text-ink-soft">{it.desc}</p>
                    </div>
                    {composing !== it.id && (
                      <button
                        onClick={() => openCompose(it.id, it.price)}
                        className="shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold"
                        style={{ background: ACCENT, color: INK }}
                      >
                        挂上去卖
                      </button>
                    )}
                  </div>
                  {composing === it.id && (
                    <div className="mt-3 border-t border-black/5 pt-3">
                      <p className="mb-1.5 text-[12px] text-ink-soft">给它定个价（建议 ¥{suggestPrice(it.price)}）</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-semibold" style={{ color: PRICE }}>¥</span>
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
                        <button onClick={confirmList} className="flex-1 rounded-full py-2 text-[13px] font-semibold" style={{ background: ACCENT, color: INK }}>确认挂卖</button>
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
                      <GoodsIcon name={l.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-ink">{l.name}</p>
                        <p className="mt-0.5 inline-flex flex-wrap items-center gap-x-1 text-[11px] text-ink-soft">{buzz.views} 浏览 · <IconHeart size={12} /> {buzz.wants} 想要 · {buzz.msgs} 留言</p>
                      </div>
                      <span className="shrink-0 text-[16px] font-bold" style={{ color: PRICE }}>¥{l.price.toLocaleString("zh-CN")}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => xianyuDelist(l.id)} className="rounded-full bg-black/[0.05] px-4 py-1.5 text-[12.5px] font-medium text-ink-soft">下架</button>
                      <button onClick={() => xianyuSell(l.id)} className="flex-1 rounded-full py-1.5 text-[12.5px] font-semibold" style={{ background: ACCENT, color: INK }}>
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
      {detail && (() => {
        const d = [...market, ...more].find((x) => x.id === detail.id) ?? detail;
        return (
          <div className="absolute inset-0 z-40 flex flex-col bg-[#f5f6f7]">
            <div className="flex items-center gap-2 bg-white px-3 py-2.5">
              <button onClick={() => setDetail(null)} aria-label="返回" className="flex h-8 w-8 items-center justify-center rounded-full text-ink active:bg-black/5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="text-[15px] font-semibold text-ink">宝贝详情</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-[#fff6c2] to-[#ffe98a]">
                <GoodsIcon name={d.name + d.blurb} size={128} />
              </div>
              <div className="bg-white px-4 pb-4 pt-3">
                <p className="text-[24px] font-bold leading-none" style={{ color: PRICE }}><span className="text-[15px]">¥</span>{d.price.toLocaleString("zh-CN")}</p>
                <h3 className="mt-2.5 text-[16px] font-semibold leading-snug text-ink">{d.name}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.75] text-ink/80">{d.blurb || "卖家很懒，什么都没写。"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  {["二手闲置", "同城可面交", "不讲价"].map((t) => <span key={t} className="rounded bg-black/[0.04] px-2 py-0.5 text-ink-soft">{t}</span>)}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 bg-white px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffe60f] text-[15px] font-bold text-[#1f1f1f]">{d.seller.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{d.seller}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-soft"><Stars n={4.6} size={10} /> 信用极好 · 回复很快</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2.5">
              <span className="flex-1 text-[11.5px] text-ink-soft">余额 {wallet.fmt(wallet.balance(game), game, (x) => `¥${x.toLocaleString("zh-CN")}`)}</span>
              <button disabled={d.bought} onClick={() => buyMarket(d)} className="rounded-full px-6 py-2 text-[14px] font-bold disabled:opacity-40" style={{ background: ACCENT, color: INK }}>{d.bought ? "已拍下" : "我想要"}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function SoldCard({ l }: { l: XianyuListing }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0 grayscale">
          <GoodsIcon name={l.name} />
          <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 text-[11px] font-bold text-white">已售</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink">{l.name}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-soft">
            挂价 ¥{l.price.toLocaleString("zh-CN")} · 成交 <span className="font-semibold" style={{ color: PRICE }}>¥{(l.soldPrice ?? l.price).toLocaleString("zh-CN")}</span>
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

/* 商品插画：按名称关键词选一枚线性 SVG（不再用 emoji），统一黄色调 */
const GOODS: { re: RegExp; d: string }[] = [
  { re: /笔记|本子|手账|书|剧本|日记|教材/, d: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6M9 11h4" },
  { re: /票|门票|票根|入场/, d: "M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4 2 2 0 0 0 0-4V6H3zM14 6v12" },
  { re: /衣|裙|外套|T恤|卫衣|同款|帽|鞋|服/, d: "M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z" },
  { re: /签名|照片|拍立得|海报|写真|小卡/, d: "M4 4h16v16H4zM4 15l4-4 4 4 3-3 5 5M15 8.5h.01" },
  { re: /CD|唱片|专辑|磁带|录像带|DVD/i, d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5" },
  { re: /灯牌|应援|荧光棒|手幅|横幅/, d: "M9 3h6v9H9zM12 12v9M8 21h8M11 6h2" },
  { re: /麦|耳机|话筒/, d: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4" },
  { re: /化妆|口红|香水|镜/, d: "M10 3h4v6h-4zM8 9h8v12H8z" },
];
function GoodsIcon({ name, size = 48 }: { name: string; size?: number }) {
  const d = GOODS.find((g) => g.re.test(name))?.d ?? "M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z";
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg bg-[#fff8d6] text-[#c99a00]" style={{ width: size, height: size }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={size > 64 ? 1.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
    </span>
  );
}
