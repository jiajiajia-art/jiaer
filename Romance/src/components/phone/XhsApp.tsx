/* 小红书：仿原生（品牌红 #ff2442、双列瀑布流笔记、多图轮播详情、点赞/收藏落地、关注流、我的收藏、商城扣款） */
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { CommentSheet, PullToRefresh, delay, LoadMoreButton, seenOf } from "./shared";
import { addPost, setFollow, toggleLike, toggleSave } from "../../game/phone";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";
import { IconHeart, IconStar, IconComment, IconSearch, IconPlus } from "./icons";
import { liveTerm as T } from "../../mods/live";
import { wallet } from "../../game/wallet";
import { logAct, logNpcNet } from "../../game/phoneLink";
import { loadData, saveData } from "../../lib/saveScope";

const XHS_RED = "#ff2442";

type Note = {
  id: string;
  title: string;
  body: string;
  cover: string; // 渐变封面（图片加载兜底）
  imgs: string[]; // 多图轮播
  ratio: number; // 封面高宽比，制造错落
  authorPid?: string;
  author: string;
  likes?: number;
  tags?: string[];
};

const COVERS = [
  "linear-gradient(135deg,#ffd9c0,#ff9a8b)",
  "linear-gradient(135deg,#c2e9fb,#a1c4fd)",
  "linear-gradient(135deg,#fbc2eb,#a6c1ee)",
  "linear-gradient(135deg,#fdeb71,#f8d800)",
  "linear-gradient(135deg,#d4fc79,#96e6a1)",
  "linear-gradient(135deg,#e0c3fc,#8ec5fc)",
  "linear-gradient(135deg,#ffdde1,#ee9ca7)",
  "linear-gradient(135deg,#c1dfc4,#deecdd)",
];

/* 多图轮播（左右切换 + 圆点 + 计数），公共交互惯例 */
function Carousel({ imgs, cover, title }: { imgs: string[]; cover: string; title: string }) {
  const [idx, setIdx] = useState(0);
  const n = imgs.length;
  const go = (d: number) => setIdx((i) => (i + d + n) % n);
  if (!n) return <div className="flex aspect-[7/8] w-full items-center justify-center p-8 text-center text-[20px] font-bold leading-snug text-white drop-shadow" style={{ background: cover }}>{title}</div>;
  return (
    <div className="relative overflow-hidden bg-black" style={{ background: cover }}>
      <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {imgs.map((src, i) => (
          <img key={i} src={(src.replace(/w=\d+&h=\d+/, "w=560&h=680")) || undefined} alt={`${title} ${i + 1}`} className="aspect-[7/8] w-full shrink-0 object-cover" />
        ))}
      </div>
      {n > 1 && (
        <>
          {/* 左右点触区 */}
          <button onClick={() => go(-1)} className="absolute inset-y-0 left-0 w-1/3" aria-label="上一张" />
          <button onClick={() => go(1)} className="absolute inset-y-0 right-0 w-1/3" aria-label="下一张" />
          {/* 计数 */}
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white">{idx + 1}/{n}</span>
          {/* 圆点 */}
          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {imgs.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`} />)}
          </div>
        </>
      )}
    </div>
  );
}

function NoteDetail({ note, onBack, liked, saved, followed, onLike, onSave, onFollow }: {
  note: Note; onBack: () => void;
  liked: boolean; saved: boolean; followed: boolean;
  onLike: () => void; onSave: () => void; onFollow: () => void;
}) {
  const { game } = useGame();
  const npc = note.authorPid ? game!.npcs.find((n) => n.id === note.authorPid) : undefined;
  const [comments, setComments] = useState(false);
  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="w-6 text-left text-[22px] leading-none text-ink-soft" aria-label="返回">‹</button>
        <Avatar src={npc?.avatar} name={note.author} size={30} editable={false} />
        <span className="flex-1 truncate text-[14px] font-medium text-ink">{note.author}</span>
        {note.authorPid && <button onClick={onFollow} className="rounded-full border px-3 py-1 text-[12.5px] font-semibold" style={followed ? { borderColor: "#00000022", color: "#888" } : { background: XHS_RED, color: "white", borderColor: XHS_RED }}>{followed ? "已关注" : "关注"}</button>}
      </div>
      <div className="flex-1 overflow-y-auto">
        <Carousel imgs={note.imgs} cover={note.cover} title={note.title} />
        <div className="px-4 py-3">
          <p className="text-[16px] font-bold text-ink">{note.title}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">{note.body}</p>
          <p className="mt-2 text-[12.5px]" style={{ color: XHS_RED }}>{(note.tags ?? []).map((t) => `#${t}`).join(" ")}</p>
          <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-[12.5px] text-ink-soft">
            <button onClick={() => setComments(true)} className="ml-auto rounded-full bg-black/[0.05] px-3 py-1">查看评论</button>
          </div>
        </div>
      </div>
      {/* 底部互动条 */}
      <div className="flex items-center gap-3 border-t border-black/5 px-3 py-2">
        <button onClick={() => setComments(true)} className="flex flex-1 items-center rounded-full bg-black/[0.06] px-3.5 py-2 text-left text-[13px] text-ink-soft">说点什么…</button>
        <button onClick={onLike} className="flex items-center gap-1 text-[13px]" style={{ color: liked ? XHS_RED : undefined }}>
          <IconHeart size={18} filled={liked} />{note.likes != null ? note.likes + (liked ? 1 : 0) : liked ? 1 : "赞"}
        </button>
        <button onClick={onSave} className="flex items-center gap-1 text-[13px]" style={{ color: saved ? "#f5a623" : undefined }}>
          <IconStar size={18} filled={saved} />{saved ? "已收藏" : "收藏"}
        </button>
        <button onClick={() => setComments(true)} className="flex items-center gap-1 text-[13px] text-ink-soft"><IconComment size={18} />评论</button>
      </div>

      {comments && <CommentSheet count={0} onClose={() => setComments(false)} accent={XHS_RED} cid={`xhs:${note.id}`} topic={`${note.title}\n${note.body}`} />}
    </div>
  );
}

type NavId = "home" | "shop" | "msg" | "me";

const SHOP_ITEMS = [
  { id: "s1", name: "栀子拿铁 · 白栀咖啡馆", price: 38, cover: COVERS[0] },
  { id: "s2", name: "复古港风口红礼盒", price: 260, cover: COVERS[2] },
  { id: "s3", name: "便携挂烫机（剧组神器）", price: 189, cover: COVERS[4] },
  { id: "s4", name: "熬夜修护精华套装", price: 520, cover: COVERS[5] },
  { id: "s5", name: "红毯高跟鞋", price: 1280, cover: COVERS[6] },
  { id: "s6", name: "限定应援手幅（为自己打 call）", price: 66, cover: COVERS[3] },
];

/* 旧存档里的笔记曾被塞入图库占位图：只保留真实附带的图片 */
const stripStock = (list: Note[]): Note[] => list.map((n) => ({ ...n, imgs: (n.imgs ?? []).filter((u) => !/images\.unsplash\.com/.test(u)) }));

const fmtK = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}w` : `${n}`);
const money = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);

export default function XhsApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame, cfg, patchGame } = useGame();
  const [tab, setTab] = useState<"follow" | "explore" | "near">("explore");
  const [open, setOpen] = useState<Note | null>(null);
  const [nav, setNav] = useState<NavId>("home");
  const [toast, setToast] = useState("");
  const [q, setQ] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [composing, setComposing] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cBody, setCBody] = useState("");
  // 落地状态：点赞 / 关注 / 收藏 全部跨会话持久（存 game.phone，与微博/抖音同一份）
  const likedIds = new Set(game!.phone?.likes ?? []);
  const followedPids = new Set(game!.phone?.follows ?? []);
  const savedIds = new Set(game!.phone?.saves ?? []);
  const flipLike = (id: string) => commitGame(toggleLike(game!, id));
  const flipFollow = (pid: string, on: boolean) => commitGame(setFollow(game!, pid, on));
  const flipSave = (id: string) => commitGame(toggleSave(game!, id));
  const bal = wallet.balance(game!);

  // 世界剧情联动生成的笔记（持久化，重进不丢）
  const [synced, setSynced] = useState<Note[]>(() => stripStock(loadFeed<Note[]>("xhs") ?? []));
  const parseNotes = (raw: unknown, pfx: string): Note[] => {
    const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    const stamp = Date.now();
    return (Array.isArray(raw) ? raw : []).map((x: any, i: number) => {
      const author = str(x?.author, 20);
      const npc = game!.npcs.find((n) => n.name === author);
      return {
        id: `${pfx}${stamp}-${i}`,
        title: str(x?.title, 40),
        body: str(x?.body, 600),
        cover: COVERS[(i + stamp) % COVERS.length],
        imgs: [],
        ratio: [1.3, 0.85, 1.15, 1.4, 0.95, 1.25][i % 6],
        authorPid: npc?.id,
        author,
        likes: x?.likes != null && Number.isFinite(Number(x.likes)) && Number(x.likes) >= 0 ? Math.round(Number(x.likes)) : undefined,
        tags: (Array.isArray(x?.tags) ? x.tags : []).map((t: unknown) => str(t, 12).replace(/^#/, "")).filter(Boolean).slice(0, 3),
      };
    }).filter((n) => n.author && n.title && n.body);
  };
  const syncNotes = async (): Promise<string> => {
    const r = await syncJson<{ notes?: unknown }>(cfg, game!, "xhs", "小粉书", `生成小粉书（类小红书）最新笔记，返回 JSON 对象：{"notes":[{"author":"作者(圈内人物名或网友昵称)","title":"笔记标题(≤20字，带小红书语气，可含 emoji)","body":"正文(60~200字)","tags":["话题词",...最多3个]}]}。给 6 篇：由圈内人物或网友发布，围绕最近剧情事件、主角近况与人物关系（探店、片场、穿搭、吃瓜、心情等），语气各异。`);
    if (!r) return "未配置 AI，无法联动剧情";
    const fresh = parseNotes(r.notes, "ws").slice(0, 8);
    if (!fresh.length) return "生成失败，请重试";
    const next = [...fresh, ...synced].slice(0, 40);
    setSynced(next); saveFeed("xhs", next); setSeed(0);
    // 角色以本名发的笔记：写进角色本人的记忆
    patchGame((g) => fresh.reduce((x, n) => (n.authorPid ? logNpcNet(x, n.authorPid, "小粉书", `发笔记《${n.title}》：${n.body}`) : x), g));
    return `已更新 ${fresh.length} 篇笔记`;
  };
  useWorldSync("xhs", syncNotes);

  const notes = useMemo<Note[]>(() => {
    const mine: Note[] = (game!.phone?.posts?.xhs ?? []).map((p, i) => {
      const [head, ...rest] = p.text.split("\n");
      return { id: `me${p.id}`, title: head.slice(0, 40), body: rest.join("\n").trim() || head, cover: COVERS[i % COVERS.length], imgs: [], ratio: 1.15, author: game!.player.name, likes: p.likes || undefined };
    });
    return [...mine, ...synced];
  }, [game, synced]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const price = (n: number) => wallet.fmt(n, game!, (x) => `¥${money(x)}`);
  const buy = (it: (typeof SHOP_ITEMS)[number]) => {
    if (bal < it.price) { flash(`${wallet.name(game!, "零钱")}不足，先去攒点吧～`); return; }
    commitGame(logAct(wallet.add(game!, -it.price), { app: "小粉书商城", text: `下单买了「${it.name}」（${price(it.price)}）`, min: 5 }));
    flash(`已下单「${it.name}」，-${price(it.price)}`);
  };

  // 购物车：按存档持久化（id → 件数），结算时一次性从钱包扣款
  const [cart, setCartRaw] = useState<Record<string, number>>(() => loadData<Record<string, number>>("xhs.cart", {}));
  const [cartOpen, setCartOpen] = useState(false);
  const setCart = (next: Record<string, number>) => { setCartRaw(next); saveData("xhs.cart", next); };
  const addCart = (it: (typeof SHOP_ITEMS)[number], d = 1) => {
    const n = Math.max(0, Math.min(99, (cart[it.id] ?? 0) + d));
    const next = { ...cart };
    if (n) next[it.id] = n; else delete next[it.id];
    setCart(next);
    if (d > 0 && !cartOpen) flash(`已加入购物车「${it.name}」`);
  };
  const cartLines = SHOP_ITEMS.filter((it) => cart[it.id]).map((it) => ({ it, n: cart[it.id] }));
  const cartCount = cartLines.reduce((t, l) => t + l.n, 0);
  const cartTotal = cartLines.reduce((t, l) => t + l.it.price * l.n, 0);
  const checkout = () => {
    if (!cartLines.length) return;
    if (bal < cartTotal) { flash(`${wallet.name(game!, "零钱")}不足，还差 ${price(cartTotal - bal)}`); return; }
    const list = cartLines.map((l) => `「${l.it.name}」×${l.n}`).join("、");
    commitGame(logAct(wallet.add(game!, -cartTotal), { app: "小粉书商城", text: `购物车结算：${list}（共 ${price(cartTotal)}）`, min: 5 }));
    setCart({}); setCartOpen(false);
    flash(`结算成功，共 ${cartCount} 件，-${price(cartTotal)}`);
  };

  const publish = () => {
    const t = cTitle.trim(), b = cBody.trim();
    if (!t) { flash("先写个标题吧～"); return; }
    commitGame(logAct(addPost(game!, "xhs", b ? `${t}\n${b}` : t), { app: "小粉书", text: `发了篇笔记《${t}》${b ? `：${b.slice(0, 60)}` : ""}`, min: 10 }));
    setCTitle(""); setCBody(""); setComposing(false); setNav("me"); flash("笔记已发布");
  };

  // 底部「查看更多」：结合剧情再生成一批笔记，接在信息流末尾（持久化）
  const [more, setMore] = useState<Note[]>(() => stripStock(loadFeed<Note[]>("xhs.more") ?? []));
  const [moreLoading, setMoreLoading] = useState(false);
  const loadMore = async () => {
    if (moreLoading) return;
    setMoreLoading(true);
    try {
      const seen = seenOf(notes.map((n) => n.title));
      const r = await syncJson<{ notes?: unknown }>(cfg, game!, "xhs", "小粉书", `再生成一批小粉书（类小红书）笔记，返回 JSON 对象：{"notes":[{"author":"作者(圈内人物名或网友昵称)","title":"笔记标题(≤20字，带小红书语气，可含 emoji)","body":"正文(60~200字)","tags":["话题词",...最多3个]}]}。给 6 篇，围绕主角近况与最近剧情，也可有圈内日常与路人分享，语气各异；不要与这些已有内容重复：${seen}`);
      if (!r) { flash("未配置 AI，暂无更多"); return; }
      const fresh = parseNotes(r.notes, "wm");
      if (!fresh.length) { flash("生成失败，请重试"); return; }
      const next = [...more, ...fresh].slice(-60);
      setMore(next); saveFeed("xhs.more", next);
      flash(`新加载 ${fresh.length} 篇`);
    } catch { flash("加载失败，请重试"); } finally { setMoreLoading(false); }
  };

  const savedNotes = [...notes, ...more].filter((n) => savedIds.has(`xhs:${n.id}`));
  const likedNotes = [...notes, ...more].filter((n) => likedIds.has(`xhs:${n.id}`));
  const myNotes = notes.filter((n) => n.id.startsWith("me"));
  const kw = (q ?? "").trim();
  const shown = (kw ? notes.filter((n) => `${n.title}${n.author}`.includes(kw)) : notes).map((n, i, a) => a[(i + seed) % a.length]).concat(kw ? more.filter((n) => `${n.title}${n.author}`.includes(kw)) : more);
  const followNotes = shown.filter((n) => n.authorPid && followedPids.has(n.authorPid));

  const NavBar = (
    <div className="flex items-center border-t border-black/5 bg-white py-2 text-[12px]">
      {([["home", "首页"], ["shop", "购物"]] as const).map(([id, l]) => (
        <button key={id} onClick={() => setNav(id)} className={`flex-1 text-center ${nav === id ? "font-semibold text-ink" : "text-ink-soft"}`}>{l}</button>
      ))}
      <button onClick={() => setComposing(true)} className="flex-1 text-center" aria-label="发布笔记">
        <span className="inline-flex h-6 w-9 items-center justify-center rounded-lg text-white" style={{ background: XHS_RED }}><IconPlus size={16} strokeWidth={3} /></span>
      </button>
      {([["msg", "消息"], ["me", "我"]] as const).map(([id, l]) => (
        <button key={id} onClick={() => setNav(id)} className={`flex-1 text-center ${nav === id ? "font-semibold text-ink" : "text-ink-soft"}`}>{l}</button>
      ))}
    </div>
  );

  const Toast = toast ? (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
      <span className="rounded-full bg-black/80 px-4 py-1.5 text-[12.5px] text-white shadow-lg">{toast}</span>
    </div>
  ) : null;

  // 通用小卡（用于关注流 / 收藏夹）
  const MiniGrid = ({ list, empty }: { list: Note[]; empty: string }) => (
    list.length === 0 ? (
      <p className="px-8 py-16 text-center text-[13px] text-ink-soft">{empty}</p>
    ) : (
      <div className="columns-2 gap-1.5 px-1.5 py-2 [column-fill:_balance]">
        {list.map((n) => {
          const npc = n.authorPid ? game!.npcs.find((x) => x.id === n.authorPid) : undefined;
          return (
            <button key={n.id} onClick={() => setOpen(n)} className="mb-1.5 block w-full break-inside-avoid overflow-hidden rounded-xl bg-white text-left shadow-sm">
              <div className="relative flex items-end overflow-hidden" style={{ background: n.cover, height: 110 * n.ratio }}>
                {n.imgs[0] && <img src={n.imgs[0]} alt={n.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="relative z-10 p-2 text-[13px] font-semibold leading-tight text-white drop-shadow line-clamp-2">{n.title}</span>
              </div>
              <div className="px-2 py-1.5">
                <p className="line-clamp-2 text-[13px] leading-snug text-ink">{n.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Avatar src={npc?.avatar} name={n.author} size={18} editable={false} />
                  <span className="flex-1 truncate text-[11px] text-ink-soft">{n.author}</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-ink-soft"><IconHeart size={11} filled={likedIds.has(`xhs:${n.id}`)} /> {n.likes != null ? fmtK(n.likes + (likedIds.has(`xhs:${n.id}`) ? 1 : 0)) : likedIds.has(`xhs:${n.id}`) ? 1 : ""}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    )
  );

  if (open) {
    const saved = savedIds.has(`xhs:${open.id}`);
    return (
      <NoteDetail
        note={open}
        onBack={() => setOpen(null)}
        liked={likedIds.has(`xhs:${open.id}`)}
        saved={saved}
        followed={!!open.authorPid && followedPids.has(open.authorPid)}
        onLike={() => flipLike(`xhs:${open.id}`)}
        onSave={() => { flipSave(`xhs:${open.id}`); flash(saved ? "已取消收藏" : "已加入收藏夹，可在「我」里查看"); }}
        onFollow={() => { if (open.authorPid) { const on = !followedPids.has(open.authorPid); flipFollow(open.authorPid, on); flash(on ? `已关注 @${open.author}` : "已取消关注"); } }}
      />
    );
  }

  if (composing) {
    return (
      <div className="relative flex h-full flex-col bg-white">
        <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2.5">
          <button onClick={() => setComposing(false)} className="text-[14px] text-ink-soft">取消</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">发布笔记</span>
          <button onClick={publish} className="rounded-full px-3.5 py-1 text-[13px] font-semibold text-white" style={{ background: XHS_RED }}>发布</button>
        </div>
        <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} maxLength={20} placeholder="填写标题会有更多赞哦～" className="border-b border-black/5 px-4 py-3 text-[16px] font-semibold text-ink outline-none" />
        <textarea value={cBody} onChange={(e) => setCBody(e.target.value)} maxLength={600} placeholder="添加正文" className="flex-1 resize-none px-4 py-3 text-[14px] leading-relaxed text-ink outline-none" />
        {Toast}
      </div>
    );
  }

  if (nav === "shop" && cartOpen) {
    return (
      <div className="relative flex h-full flex-col bg-[#f5f5f5]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <button onClick={() => setCartOpen(false)} className="text-[15px] text-ink-soft" aria-label="返回商城">‹</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">购物车{cartCount ? `（${cartCount}）` : ""}</span>
          <span className="w-4" />
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto p-2">
          {cartLines.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
              <p className="text-[13px] text-ink-soft">购物车空空的，去好物集挑几样吧～</p>
              <button onClick={() => setCartOpen(false)} className="rounded-full border border-black/10 px-4 py-1.5 text-[13px] text-ink">去逛逛</button>
            </div>
          ) : cartLines.map(({ it, n }) => (
            <div key={it.id} className="flex items-center gap-2.5 rounded-xl bg-white p-2 shadow-sm">
              <div className="h-14 w-14 shrink-0 rounded-lg" style={{ background: it.cover }} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">{it.name}</p>
                <p className="mt-1 text-[13px] font-bold" style={{ color: XHS_RED }}>{price(it.price)}</p>
              </div>
              <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-black/10 text-[13px]">
                <button onClick={() => addCart(it, -1)} className="px-2.5 py-1 text-ink-soft" aria-label={`减少${it.name}`}>−</button>
                <span className="min-w-6 text-center tabular-nums text-ink">{n}</span>
                <button onClick={() => addCart(it, 1)} className="px-2.5 py-1 text-ink-soft" aria-label={`增加${it.name}`}>＋</button>
              </div>
            </div>
          ))}
        </div>
        {cartLines.length > 0 && (
          <div className="flex items-center gap-2 border-t border-black/5 bg-white px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink">合计 <b style={{ color: XHS_RED }}>{price(cartTotal)}</b></p>
              <p className={`truncate text-[11px] ${bal < cartTotal ? "text-danger" : "text-ink-soft"}`}>{wallet.name(game!, "零钱")}余额 {price(bal)}{bal < cartTotal ? " · 不足" : ""}</p>
            </div>
            <button onClick={checkout} disabled={bal < cartTotal} className="shrink-0 rounded-full px-5 py-2 text-[13px] font-semibold text-white disabled:opacity-45" style={{ background: XHS_RED }}>结算（{cartCount}）</button>
          </div>
        )}
        {Toast}
      </div>
    );
  }

  if (nav === "shop") {
    return (
      <div className="relative flex h-full flex-col bg-[#f5f5f5]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <button onClick={() => setNav("home")} className="text-[15px] text-ink-soft">‹</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">购物 · 好物集</span>
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white" style={{ background: XHS_RED }}>余额 {price(bal)}</span>
          <button onClick={() => setCartOpen(true)} className="relative shrink-0 rounded-full border border-black/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink" aria-label={`购物车，${cartCount} 件`}>
            购物车
            {cartCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 text-white" style={{ background: XHS_RED }}>{cartCount}</span>}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-2">
            {SHOP_ITEMS.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div style={{ background: it.cover, height: 92 }} />
                <div className="px-2 py-2">
                  <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">{it.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="min-w-0 truncate text-[13px] font-bold" style={{ color: XHS_RED }}>{price(it.price)}</span>
                    <span className="flex shrink-0 gap-1">
                      <button onClick={() => addCart(it)} className="rounded-full border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: XHS_RED, color: XHS_RED }}>加购</button>
                      <button onClick={() => buy(it)} className="rounded-full px-2 py-1 text-[11px] font-semibold text-white" style={{ background: XHS_RED }}>购买</button>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {Toast}
        {NavBar}
      </div>
    );
  }

  if (nav === "msg") {
    return (
      <div className="relative flex h-full flex-col bg-[#f5f5f5]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <button onClick={() => setNav("home")} className="text-[15px] text-ink-soft">‹</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">消息</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Avatar src={game!.player.avatar} name={game!.player.name} size={64} editable={false} />
          <p className="text-[13px] text-ink-soft">还没有新的私信，去发现页逛逛吧～</p>
          <button onClick={() => setNav("home")} className="mt-1 rounded-full border border-black/10 px-4 py-1.5 text-[13px] text-ink">返回首页</button>
        </div>
        {NavBar}
      </div>
    );
  }

  if (nav === "me") {
    return (
      <div className="relative flex h-full flex-col bg-[#f5f5f5]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <button onClick={() => setNav("home")} className="text-[15px] text-ink-soft">‹</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">我的主页</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* 个人资料 + 数据 */}
          <div className="bg-white px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <Avatar src={game!.player.avatar} name={game!.player.name} size={60} editable={false} />
              <div className="min-w-0">
                <p className="text-[17px] font-bold text-ink">{game!.player.name}</p>
                <p className="mt-0.5 text-[12px] text-ink-soft">小粉书号：red_{game!.player.name}</p>
              </div>
              <span className="ml-auto rounded-full px-3 py-1 text-[11.5px] font-semibold text-white" style={{ background: XHS_RED }}>钱包 {wallet.fmt(bal, game!, (n) => `¥${money(n)}`)}</span>
            </div>
            <div className="mt-3 flex text-center text-[13px]">
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{followedPids.size}</p><p className="text-ink-soft">关注</p></div>
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{likedNotes.length}</p><p className="text-ink-soft">赞过</p></div>
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{savedNotes.length}</p><p className="text-ink-soft">收藏</p></div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 bg-white px-4 py-2 text-[13px] font-semibold text-ink">我的笔记 · {myNotes.length}</div>
          <MiniGrid list={myNotes} empty="还没有发布笔记，点底部「+」写一篇吧。" />
          {/* 收藏夹 */}
          <div className="mt-2 flex items-center gap-1.5 bg-white px-4 py-2 text-[13px] font-semibold text-ink">
            <IconStar size={15} style={{ color: "#f5a623" }} /> 我的收藏
          </div>
          <MiniGrid list={savedNotes} empty="还没有收藏。翻到喜欢的笔记，点右下「收藏」就会出现在这里。" />
        </div>
        {Toast}
        {NavBar}
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-[#f5f5f5]">
      {/* 顶栏：三 tab 居中 + 搜索 */}
      <div className="flex items-center gap-2 bg-white px-3 pb-2 pt-1">
        <button onClick={onBack} className="text-[14px] text-ink-soft">‹</button>
        <div className="flex flex-1 items-center justify-center gap-5 text-[15px]">
          {([["follow", "关注"], ["explore", "发现"], ["near", "附近"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className="relative py-1">
              <span className={tab === id ? "font-bold text-ink" : "text-ink-soft"}>{l}</span>
              {tab === id && <span className="absolute inset-x-1 -bottom-0.5 h-0.5 rounded-full" style={{ background: XHS_RED }} />}
            </button>
          ))}
        </div>
        <button onClick={() => setQ(q === null ? "" : null)} className="text-ink-soft"><IconSearch size={18} /></button>
      </div>
      {q !== null && (
        <div className="bg-white px-3 pb-2">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索笔记标题或作者" className="w-full rounded-full bg-[#f2f2f2] px-3.5 py-1.5 text-[13px] text-ink outline-none" />
        </div>
      )}

      {/* 内容区：关注流 / 发现瀑布流 / 附近（下拉刷新） */}
      <PullToRefresh
        className="flex-1"
        accent={XHS_RED}
        tint="light"
        onRefresh={async () => { const t = await syncNotes(); if (t) flash(t); if (t.startsWith("未配置")) { await delay(300); setSeed((v) => v + 1); } }}
      >
        {tab === "follow" && <MiniGrid list={followNotes} empty="还没有关注的人。点开任意笔记右上「关注」，TA 的笔记就会出现在这里。" />}
        {tab === "near" && <MiniGrid list={shown.slice(3)} empty="附近暂时没有笔记。" />}
        {tab === "explore" && <MiniGrid list={shown} empty={kw ? "没有找到相关笔记。" : "暂无笔记。"} />}
        {tab === "explore" && !kw && <LoadMoreButton loading={moreLoading} onClick={loadMore} color={XHS_RED} dark />}
      </PullToRefresh>

      {Toast}
      {/* 底部导航 */}
      {NavBar}
    </div>
  );
}
