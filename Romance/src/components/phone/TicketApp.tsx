/* 票务：仿真演出票务 App（大麦/猫眼式）——首页轮播 + 分类 + 海报卡；详情选座下单（余票/概率/扣款）；电子票夹（含二维码卡） */
import { useEffect, useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { PERSON_BY_ID } from "../../worlds/star2005/content";
import { addTicket } from "../../game/phone";
import type { HeldTicket } from "../../game/phone";
import { IconSearch, IconClock, IconPin, IconTicket, IconStar, IconFire, IconChevron, IconFolder } from "./icons";

const ACCENT = "#ff2d55";
const IMG = (id: string, w = 480, h = 640) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;

type Tier = { label: string; price: number; stock: number };
type Show = {
  id: string;
  name: string;
  category: "演唱会" | "音乐节" | "话剧音乐剧" | "电影首映" | "Livehouse";
  artist: string;
  poster: string;
  when: string;
  date: string;
  venue: string;
  city: string;
  rating: number;
  wanted: number; // 想看人数
  hot: boolean;
  tiers: Tier[];
  desc: string;
};
type Held = HeldTicket;

const CATS = ["全部", "演唱会", "音乐节", "话剧音乐剧", "电影首映", "Livehouse"] as const;
type Cat = (typeof CATS)[number];

const POSTERS = [
  "1501139083538-0139583c060f", // 演唱会灯海
  "1470225620780-dba8ba36b745", // 打碟/电子
  "1540039155733-5bb30b53aa14", // 舞台聚光
  "1516450360452-9312f5e86fc7", // 乐队现场
  "1524368535928-5b5e00ddc76b", // 剧场舞台
  "1493225457124-a3eb161ffa5f", // 音乐节人群
];
const seatOf = (tier: string, i: number) => {
  const zone = tier.includes("VIP") ? "A" : tier.includes("看台") ? "C" : "B";
  return `${zone} 区 ${(i % 12) + 1} 排 ${((i * 7) % 30) + 1} 座`;
};

export default function TicketApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame } = useGame();
  const [tab, setTab] = useState<"home" | "mine">("home");
  const [cat, setCat] = useState<Cat>("全部");
  const [detail, setDetail] = useState<string | null>(null);
  const held = game!.phone?.tickets ?? []; // 票夹随存档持久（花了钱就得留下来）
  const [banner, setBanner] = useState(0);
  const [toast, setToast] = useState("");

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2400); };

  const shows = useMemo<Show[]>(() => {
    const n = game!.npcs;
    const nm = (i: number) => n[i % Math.max(1, n.length)]?.name ?? "神秘嘉宾";
    const film = PERSON_BY_ID[n[1]?.id ?? ""]?.works?.[0] ?? "银河来信";
    return [
      { id: "e1", name: `${nm(0)} 世界巡回演唱会「星火 STARFIRE」`, category: "演唱会", artist: nm(0), poster: IMG(POSTERS[0]), when: "本周六 19:30", date: "周六 · 今晚开抢", venue: "星城体育中心 · 主馆", city: "星城", rating: 9.6, wanted: 128000, hot: true,
        tiers: [{ label: "内场 VIP", price: 1880, stock: 2 }, { label: "看台 A", price: 1280, stock: 6 }, { label: "看台 B", price: 680, stock: 12 }],
        desc: "阔别两年重返舞台，全新舞美与乐队编制，两小时二十首金曲连唱。今夜，只为与你重逢。" },
      { id: "e2", name: "跨年群星盛典 2005", category: "演唱会", artist: `${nm(0)}、${nm(2)} 等`, poster: IMG(POSTERS[2]), when: "12.31 20:00", date: "12 月 31 日", venue: "云津大剧院", city: "星城", rating: 9.1, wanted: 86000, hot: true,
        tiers: [{ label: "钻石座", price: 1580, stock: 3 }, { label: "贵宾座", price: 980, stock: 8 }, { label: "普通座", price: 480, stock: 20 }],
        desc: "二十组人气艺人同台跨年，零点钟声与漫天焰火，陪你告别旧年、迎接新岁。" },
      { id: "e3", name: `电影《${film}》全球首映礼`, category: "电影首映", artist: nm(1), poster: IMG(POSTERS[4]), when: "下周三 18:00", date: "下周三", venue: "星光 IMAX 剧场", city: "星城", rating: 8.8, wanted: 42000, hot: false,
        tiers: [{ label: "红毯 + 观影", price: 800, stock: 2 }, { label: "首映观影", price: 380, stock: 10 }],
        desc: "主创集体亮相红毯，映后见面会与签名环节，抢先看到年度最受期待的大银幕之作。" },
      { id: "e4", name: "仲夏音乐节 · 复古之夜", category: "音乐节", artist: "多组乐队 / DJ", poster: IMG(POSTERS[5]), when: "下月 05 14:00", date: "下月 5 日", venue: "城郊阳光草坪", city: "星城", rating: 9.0, wanted: 51000, hot: true,
        tiers: [{ label: "两日通票", price: 980, stock: 30 }, { label: "单日票", price: 580, stock: 60 }],
        desc: "十小时不间断演出，草地、市集与落日舞台。带上朋友，来一场夏夜的自由狂欢。" },
      { id: "e5", name: `音乐剧《不眠之城》${nm(3)} 主演`, category: "话剧音乐剧", artist: nm(3), poster: IMG(POSTERS[3]), when: "本月 20-25 19:15", date: "本月 20 日起", venue: "大都会歌剧院", city: "星城", rating: 9.3, wanted: 33000, hot: false,
        tiers: [{ label: "池座前区", price: 780, stock: 5 }, { label: "楼座", price: 380, stock: 15 }],
        desc: "百老汇原版授权中文制作，十二人现场乐队伴奏。一座城的欲望与救赎，六场限定。" },
      { id: "e6", name: `${nm(4)} Livehouse 巡演 · 星城站`, category: "Livehouse", artist: nm(4), poster: IMG(POSTERS[1]), when: "本周五 20:30", date: "本周五", venue: "MAO Livehouse", city: "星城", rating: 8.9, wanted: 18000, hot: false,
        tiers: [{ label: "前排站票", price: 380, stock: 8 }, { label: "普通站票", price: 260, stock: 40 }],
        desc: "小场地、大能量，与偶像零距离。限量站票，先到先得，唱到嗓子哑也不肯散场。" },
    ];
  }, [game]);

  useEffect(() => {
    const hot = shows.filter((s) => s.hot);
    const t = setInterval(() => setBanner((b) => (b + 1) % Math.max(1, hot.length)), 3800);
    return () => clearInterval(t);
  }, [shows]);

  const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);
  const money = game!.sim.money;

  // 一次性买 qty 张：单次落账（扣总价 + 入夹 qty 张），避免同一渲染内多次 commit 相互覆盖
  const buy = (s: Show, tier: Tier, qty: number): number => {
    const want = Math.max(1, Math.min(qty, tier.stock));
    if (money < tier.price * want) { flash("余额不足，付款失败"); return 0; }
    const ok = Math.random() < Math.min(0.9, tier.stock / 8 + 0.3);
    if (!ok) { flash("手慢了，该票档已被抢空"); return 0; }
    let next = { ...game!, sim: { ...game!.sim, money: money - tier.price * want } };
    for (let i = 0; i < want; i++) {
      const ticket: HeldTicket = { id: `t${Date.now()}${i}${Math.floor(Math.random() * 1000)}`, name: s.name, poster: s.poster, when: s.when, venue: s.venue, tier: tier.label, price: tier.price, seat: seatOf(tier.label, held.length + i + s.name.length), ts: Date.now() };
      next = addTicket(next, ticket);
    }
    commitGame(next);
    flash(`出票成功！${tier.label} × ${want} · 已支付 ¥${tier.price * want}`);
    return want;
  };

  /* —— 演出详情 —— */
  if (detail) {
    const s = shows.find((x) => x.id === detail);
    if (s) return <ShowDetail show={s} money={money} onBuy={buy} onBack={() => setDetail(null)} toBook={() => setTab("mine")} held={held} fmt={fmt} />;
  }

  const hotShows = shows.filter((x) => x.hot);
  const list = cat === "全部" ? shows : shows.filter((s) => s.category === cat);

  return (
    <div className="flex h-full flex-col bg-[#f5f6f8]">
      {/* 顶栏 —— 品牌渐变 + 柔光 */}
      <div className="relative overflow-hidden px-4 pb-3.5 pt-3 text-white" style={{ background: "linear-gradient(135deg,#ff2d55 0%,#ff4e6a 45%,#ff6a3d 100%)" }}>
        <div className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/20 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -left-8 top-2 h-20 w-20 rounded-full bg-[#ffd0b0]/30 blur-2xl" aria-hidden />
        <div className="relative flex items-center justify-between">
          <button onClick={onBack} aria-label="返回" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px] leading-none backdrop-blur-sm transition active:scale-90">‹</button>
          <p className="flex items-center gap-1.5 text-[16px] font-black tracking-wide drop-shadow-sm">
            <IconTicket size={17} className="-rotate-12 opacity-95" />星票
          </p>
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-medium backdrop-blur-sm"><IconPin size={12} /> 星城</span>
        </div>
        <p className="relative mt-1.5 text-center text-[10.5px] font-medium tracking-[0.32em] text-white/75">现场娱乐 · 票团团</p>
        <div className="relative mt-2.5 flex items-center gap-2 rounded-full bg-white/95 px-3.5 py-2 text-ink-soft shadow-[0_6px_16px_-8px_rgba(255,45,85,0.6)]">
          <IconSearch size={16} style={{ color: ACCENT }} /><span className="text-[13px]">搜索演唱会 · 艺人 · 场馆</span>
        </div>
      </div>

      {tab === "home" ? (
        <div className="flex-1 overflow-y-auto pb-4">
          {/* 轮播 banner */}
          {hotShows.length > 0 && (
            <div className="px-4 pt-3">
              <button onClick={() => setDetail(hotShows[banner].id)} className="relative block h-36 w-full overflow-hidden rounded-2xl bg-black text-left shadow-sm">
                <img src={hotShows[banner].poster} alt={hotShows[banner].name} className="h-full w-full object-cover opacity-85" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-600">热销 HOT</span>
                <div className="absolute inset-x-3 bottom-3 text-white">
                  <p className="line-clamp-1 text-[15px] font-bold drop-shadow">{hotShows[banner].name}</p>
                  <p className="mt-0.5 text-[11.5px] text-white/85">{hotShows[banner].date} · {hotShows[banner].venue}</p>
                </div>
              </button>
              <div className="mt-2 flex justify-center gap-1.5">
                {hotShows.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === banner ? "w-4 bg-rose-500" : "w-1.5 bg-black/15"}`} />)}
              </div>
            </div>
          )}

          {/* 分类 chips */}
          <div className="no-scrollbar mt-1 flex gap-2 overflow-x-auto px-4 py-2">
            {CATS.map((c) => (
              <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${cat === c ? "text-white" : "bg-white text-ink-soft ring-1 ring-black/[0.06]"}`} style={cat === c ? { background: ACCENT } : undefined}>{c}</button>
            ))}
          </div>

          <p className="px-4 pb-1 pt-1 text-[13px] font-bold text-ink">{cat === "全部" ? "正在热卖" : cat}</p>
          <div className="px-4">
            {list.map((s) => {
              const from = Math.min(...s.tiers.map((t) => t.price));
              const left = s.tiers.reduce((a, t) => a + t.stock, 0);
              return (
                <button key={s.id} onClick={() => setDetail(s.id)} className="mb-2.5 flex w-full gap-3 rounded-2xl bg-white p-2.5 text-left shadow-sm ring-1 ring-black/[0.04]">
                  <div className="relative h-[104px] w-[78px] shrink-0 overflow-hidden rounded-xl bg-black/5">
                    <img src={s.poster} alt={s.name} className="h-full w-full object-cover" />
                    {s.hot && <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-rose-500 px-1 py-0.5 text-[9px] font-bold text-white"><IconFire size={9} />热</span>}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{s.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-soft"><IconStar size={11} className="text-amber-500" /><span className="font-semibold text-amber-600">{s.rating}</span> · {fmt(s.wanted)}人想看</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-soft"><IconClock size={11} /> {s.when}</p>
                    <p className="line-clamp-1 flex items-center gap-1 text-[11.5px] text-ink-soft"><IconPin size={11} /> {s.venue}</p>
                    <div className="mt-auto flex items-end justify-between pt-1">
                      <span className="text-[15px] font-bold" style={{ color: ACCENT }}>¥{from}<span className="text-[10px] font-normal text-ink-soft"> 起</span></span>
                      <span className={`rounded-full px-3 py-1 text-[12px] font-semibold text-white ${left > 0 ? "" : "bg-black/25"}`} style={left > 0 ? { background: ACCENT } : undefined}>{left > 0 ? "购票" : "售罄"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <p className="pb-2 text-[13px] font-bold text-ink">我的电子票（{held.length}）</p>
          {held.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center text-ink-soft">
              <IconTicket size={40} className="opacity-30" />
              <p className="mt-3 text-[13px]">票夹还是空的</p>
              <button onClick={() => setTab("home")} className="mt-3 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white" style={{ background: ACCENT }}>去看看演出</button>
            </div>
          ) : held.map((t) => <TicketCard key={t.id} t={t} />)}
        </div>
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center px-6">
          <span className="rounded-full bg-black/85 px-4 py-2 text-center text-[12.5px] font-medium text-white shadow-lg">{toast}</span>
        </div>
      )}

      {/* 底部导航 */}
      <div className="flex border-t border-black/5 bg-white">
        <button onClick={() => setTab("home")} className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[12px] font-medium" style={{ color: tab === "home" ? ACCENT : "#9aa0a6" }}>
          <IconTicket size={19} />购票
        </button>
        <button onClick={() => setTab("mine")} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[12px] font-medium" style={{ color: tab === "mine" ? ACCENT : "#9aa0a6" }}>
          <IconFolder size={19} />票夹
          {held.length > 0 && <span className="absolute right-[30%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{held.length}</span>}
        </button>
      </div>
    </div>
  );
}

/* —— 演出详情 + 下单 —— */
function ShowDetail({ show, money, onBuy, onBack, toBook, held, fmt }: {
  show: Show; money: number; onBuy: (s: Show, t: Tier, qty: number) => number; onBack: () => void; toBook: () => void; held: Held[]; fmt: (n: number) => string;
}) {
  const [sel, setSel] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [qty, setQty] = useState(1);
  const tier = show.tiers[sel];
  const owned = held.some((h) => h.name === show.name);

  return (
    <div className="relative flex h-full flex-col bg-[#f5f6f8]">
      {/* 海报头图与详情同处一个滚动容器，整体可上下滑动、不会被固定头图遮挡 */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* 海报头图 */}
        <div className="relative h-56 bg-black">
          <img src={show.poster} alt={show.name} className="h-full w-full object-cover opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f6f8] via-black/20 to-black/40" />
          <span className="absolute right-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">{show.category}</span>
        </div>

        <div className="relative z-10 -mt-6 px-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h1 className="text-[17px] font-bold leading-snug text-ink">{show.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-[12px]">
            <span className="flex items-center gap-1 font-semibold text-amber-600"><IconStar size={13} className="text-amber-500" /> {show.rating}</span>
            <span className="text-ink-soft">· {fmt(show.wanted)} 人想看</span>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-black/[0.06] pt-3 text-[13px] text-ink-soft">
            <p className="flex items-center gap-2"><IconClock size={14} /> {show.when}</p>
            <p className="flex items-center gap-2"><IconPin size={14} /> {show.venue} · {show.city}</p>
            <p className="flex items-center gap-2"><IconStar size={14} /> 主演 / 阵容：{show.artist}</p>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[14px] font-bold text-ink">票档 · 选座</p>
          <div className="mt-2.5 space-y-2">
            {show.tiers.map((t, i) => {
              const active = i === sel;
              const sold = t.stock <= 0;
              return (
                <button key={t.label} disabled={sold} onClick={() => { setSel(i); setQty(1); }}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${active ? "border-rose-500 bg-rose-50" : "border-black/[0.08] bg-white"} ${sold ? "opacity-40" : ""}`}>
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{t.label}</p>
                    <p className="mt-0.5 text-[11px] text-ink-soft">{sold ? "已售罄" : t.stock <= 3 ? `仅剩 ${t.stock} 张` : "余票充足"}</p>
                  </div>
                  <span className="text-[15px] font-bold" style={{ color: ACCENT }}>¥{t.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[14px] font-bold text-ink">演出详情</p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/80">{show.desc}</p>
          <p className="mt-3 text-[11.5px] text-ink-soft">· 电子票，入场刷二维码 · 一人一票 · 演出票不支持退换</p>
        </div>
        </div>
      </div>

      {/* 悬浮返回按钮：始终可点，不随头图滚走 */}
      <button onClick={onBack} className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"><IconChevron size={18} className="rotate-180" /></button>

      {/* 底部购买栏 */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 border-t border-black/5 bg-white px-4 py-3">
        <div className="flex-1">
          <p className="text-[11px] text-ink-soft">{tier.label} · 余额 ¥{fmt(money)}</p>
          <p className="text-[18px] font-bold leading-tight" style={{ color: ACCENT }}>¥{tier.price}</p>
        </div>
        <button onClick={() => setSheet(true)} disabled={tier.stock <= 0}
          className="rounded-full px-8 py-3 text-[15px] font-bold text-white shadow disabled:bg-black/25" style={tier.stock > 0 ? { background: ACCENT } : undefined}>
          {tier.stock > 0 ? "立即购买" : "已售罄"}
        </button>
      </div>

      {/* 确认下单 sheet */}
      {sheet && (
        <div className="absolute inset-0 z-40 flex items-end bg-black/45" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full rounded-t-3xl bg-white p-5 pb-7">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/15" />
            <p className="text-[15px] font-bold text-ink">确认订单</p>
            <div className="mt-3 flex gap-3">
              <img src={show.poster} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[13.5px] font-semibold text-ink">{show.name}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-soft">{show.when} · {tier.label}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">购买数量</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[16px]">−</button>
                <span className="w-5 text-center font-semibold">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(Math.max(1, tier.stock), q + 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-[16px]">＋</button>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-black/[0.06] pt-3">
              <span className="text-[12px] text-ink-soft">应付</span>
              <span className="text-[20px] font-bold" style={{ color: ACCENT }}>¥{tier.price * qty}</span>
            </div>
            <button onClick={() => {
              setSheet(false);
              const bought = onBuy(show, tier, qty);
              if (bought > 0) setTimeout(toBook, 400);
            }} className="mt-4 w-full rounded-full py-3 text-[15px] font-bold text-white" style={{ background: ACCENT }}>
              确认支付 ¥{tier.price * qty}
            </button>
            {owned && <p className="mt-2 text-center text-[11px] text-ink-soft">你已购买过该场次，可在票夹查看</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* —— 电子票卡（含二维码方阵） —— */
function TicketCard({ t }: { t: Held }) {
  // 由票据 id 派生的伪二维码方阵，稳定不变
  const cells = useMemo(() => {
    let h = 0; for (const c of t.id + t.seat) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 49 }, (_, i) => { h = (h * 1103515245 + 12345) >>> 0; return (h >> (i % 16)) & 1; });
  }, [t.id, t.seat]);
  return (
    <div className="mb-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
      <div className="flex gap-3 p-3">
        <img src={t.poster} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-ink">{t.name}</p>
          <p className="mt-1 flex items-center gap-1 text-[11.5px] text-ink-soft"><IconClock size={11} /> {t.when}</p>
          <p className="line-clamp-1 flex items-center gap-1 text-[11.5px] text-ink-soft"><IconPin size={11} /> {t.venue}</p>
          <span className="mt-1.5 inline-block rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600">{t.tier} · {t.seat}</span>
        </div>
      </div>
      {/* 撕裂线 */}
      <div className="relative flex items-center">
        <span className="absolute -left-2 h-4 w-4 rounded-full bg-[#f5f6f8]" />
        <div className="mx-4 flex-1 border-t border-dashed border-black/15" />
        <span className="absolute -right-2 h-4 w-4 rounded-full bg-[#f5f6f8]" />
      </div>
      <div className="flex items-center gap-3 p-3">
        <div className="grid shrink-0 grid-cols-7 gap-[2px] rounded-lg bg-white p-1.5 ring-1 ring-black/10">
          {cells.map((on, i) => <span key={i} className={`h-[5px] w-[5px] rounded-[1px] ${on ? "bg-ink" : "bg-transparent"}`} />)}
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-semibold text-emerald-600">● 电子票 · 待入场</p>
          <p className="mt-0.5 text-[11px] text-ink-soft">入场时向工作人员出示此二维码</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-ink-soft">票号 {t.id.slice(-8).toUpperCase()} · 已付 ¥{t.price}</p>
        </div>
      </div>
    </div>
  );
}
