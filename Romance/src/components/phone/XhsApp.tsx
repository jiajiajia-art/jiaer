/* 小红书：仿原生（品牌红 #ff2442、双列瀑布流笔记、多图轮播详情、点赞/收藏落地、关注流、我的收藏、商城扣款） */
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { PERSON_BY_ID } from "../../worlds/star2005/content";
import { CommentSheet, PullToRefresh, delay } from "./shared";
import { setFollow, toggleLike, toggleSave } from "../../game/phone";
import { xhsPost } from "./persona";
import { IconHeart, IconStar, IconComment, IconSearch, IconPlus } from "./icons";

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
  likes: number;
};

const IMG = (id: string, w = 400, h = 500) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;

// 主题素材池（用于每条笔记的多图轮播）
const POOL = [
  "1612544409025-e1f6a56c1152", // 片场
  "1636936291087-2972edf08f14", // 港风妆
  "1532800783378-1bed60adaf58", // 窗边
  "1484251065541-c9770829890f", // 咖啡馆
  "1632187981988-40f3cbaeef5e", // 剧组
  "1748543668676-ea8241cb3886", // 护肤
  "1527189919029-aeb3d997547d", // 红毯
  "1547592180-85f173990554",    // 独食
  "1517841905240-472988babdf9", // 人像
  "1522798514-97ceb8c4f1c8",    // 街拍
];

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
  return (
    <div className="relative overflow-hidden bg-black" style={{ background: cover }}>
      <div className="flex transition-transform duration-300 ease-out" style={{ transform: `translateX(-${idx * 100}%)` }}>
        {imgs.map((src, i) => (
          <img key={i} src={src.replace(/w=\d+&h=\d+/, "w=560&h=680")} alt={`${title} ${i + 1}`} className="aspect-[7/8] w-full shrink-0 object-cover" />
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
  const commentCount = Math.round(note.likes / 7);
  return (
    <div className="relative flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-black/5 px-3 py-2">
        <button onClick={onBack} className="text-[15px] text-ink-soft">‹</button>
        <Avatar src={npc?.avatar} name={note.author} size={30} editable={false} />
        <span className="flex-1 truncate text-[14px] font-medium text-ink">{note.author}</span>
        <button onClick={onFollow} className="rounded-full border px-3 py-1 text-[12.5px] font-semibold" style={followed ? { borderColor: "#00000022", color: "#888" } : { background: XHS_RED, color: "white", borderColor: XHS_RED }}>{followed ? "已关注" : "关注"}</button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <Carousel imgs={note.imgs} cover={note.cover} title={note.title} />
        <div className="px-4 py-3">
          <p className="text-[16px] font-bold text-ink">{note.title}</p>
          <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink/90">{note.body}</p>
          <p className="mt-2 text-[12.5px]" style={{ color: XHS_RED }}>#今日分享 #娱乐圈 #vlog</p>
          <p className="mt-2 text-[12px] text-ink-soft">编辑于 今天 · 星城</p>
          <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-[12.5px] text-ink-soft">
            <span>共 {commentCount} 条评论</span>
            <button onClick={() => setComments(true)} className="ml-auto rounded-full bg-black/[0.05] px-3 py-1">查看评论</button>
          </div>
        </div>
      </div>
      {/* 底部互动条 */}
      <div className="flex items-center gap-3 border-t border-black/5 px-3 py-2">
        <button onClick={() => setComments(true)} className="flex flex-1 items-center rounded-full bg-black/[0.06] px-3.5 py-2 text-left text-[13px] text-ink-soft">说点什么…</button>
        <button onClick={onLike} className="flex items-center gap-1 text-[13px]" style={{ color: liked ? XHS_RED : undefined }}>
          <IconHeart size={18} filled={liked} />{note.likes + (liked ? 1 : 0)}
        </button>
        <button onClick={onSave} className="flex items-center gap-1 text-[13px]" style={{ color: saved ? "#f5a623" : undefined }}>
          <IconStar size={18} filled={saved} />{saved ? "已收藏" : "收藏"}
        </button>
        <button onClick={() => setComments(true)} className="flex items-center gap-1 text-[13px] text-ink-soft"><IconComment size={18} />{commentCount}</button>
      </div>

      {comments && <CommentSheet count={commentCount} onClose={() => setComments(false)} accent={XHS_RED} cid={`xhs:${note.id}`} />}
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

const money = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${n}`);

export default function XhsApp({ onBack }: { onBack: () => void }) {
  const { game, commitGame } = useGame();
  const [tab, setTab] = useState<"follow" | "explore" | "near">("explore");
  const [open, setOpen] = useState<Note | null>(null);
  const [nav, setNav] = useState<NavId>("home");
  const [toast, setToast] = useState("");
  // 落地状态：点赞 / 关注 / 收藏 全部跨会话持久（存 game.phone，与微博/抖音同一份）
  const likedIds = new Set(game!.phone?.likes ?? []);
  const followedPids = new Set(game!.phone?.follows ?? []);
  const savedIds = new Set(game!.phone?.saves ?? []);
  const flipLike = (id: string) => commitGame(toggleLike(game!, id));
  const flipFollow = (pid: string, on: boolean) => commitGame(setFollow(game!, pid, on));
  const flipSave = (id: string) => commitGame(toggleSave(game!, id));
  const bal = game!.sim.money;

  const notes = useMemo<Note[]>(() => {
    // 每条笔记由一位圈内人发布，内容随其职业/性格生成（演员发片场、经纪发选角、资本发出差、家人发家常…）
    const roster = game!.npcs.length ? game!.npcs : [];
    return Array.from({ length: 8 }, (_, i) => {
      const npc = roster.length ? roster[i % roster.length] : undefined;
      const sd = npc ? xhsPost(npc) : { title: "一个人也要好好吃饭", body: "简单煮的一餐，简单但治愈。" };
      const cnt = [3, 1, 2, 4, 3, 2, 4, 1][i % 8]; // 每条笔记的图片张数
      const imgs = Array.from({ length: cnt }, (_, k) => IMG(POOL[(i * 2 + k) % POOL.length]));
      return {
        id: `n${i}`,
        title: sd.title,
        body: sd.body,
        cover: COVERS[i % COVERS.length],
        imgs,
        ratio: [1.3, 0.85, 1.15, 1.4, 0.95, 1.25, 0.9, 1.1][i % 8],
        authorPid: npc?.id,
        author: npc?.name ?? PERSON_BY_ID[""]?.name ?? "小红薯",
        likes: (sd.title.length * 137 + i * 411) % 9000 + 120,
      };
    });
  }, [game]);

  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const buy = (it: (typeof SHOP_ITEMS)[number]) => {
    if (bal < it.price) { flash("余额不足，先去接活攒钱吧～"); return; }
    commitGame({ ...game!, sim: { ...game!.sim, money: bal - it.price } });
    flash(`已下单「${it.name}」，-¥${money(it.price)}`);
  };

  const savedNotes = notes.filter((n) => savedIds.has(`xhs:${n.id}`));
  const likedNotes = notes.filter((n) => likedIds.has(`xhs:${n.id}`));
  const followNotes = notes.filter((n) => n.authorPid && followedPids.has(n.authorPid));

  const NavBar = (
    <div className="flex items-center border-t border-black/5 bg-white py-2 text-[12px]">
      {([["home", "首页"], ["shop", "购物"]] as const).map(([id, l]) => (
        <button key={id} onClick={() => setNav(id)} className={`flex-1 text-center ${nav === id ? "font-semibold text-ink" : "text-ink-soft"}`}>{l}</button>
      ))}
      <button onClick={() => { setNav("shop"); }} className="flex-1 text-center">
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
                <img src={n.imgs[0]} alt={n.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="relative z-10 p-2 text-[13px] font-semibold leading-tight text-white drop-shadow line-clamp-2">{n.title}</span>
              </div>
              <div className="px-2 py-1.5">
                <p className="line-clamp-2 text-[13px] leading-snug text-ink">{n.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Avatar src={npc?.avatar} name={n.author} size={18} editable={false} />
                  <span className="flex-1 truncate text-[11px] text-ink-soft">{n.author}</span>
                  <span className="flex items-center gap-0.5 text-[11px] text-ink-soft"><IconHeart size={11} filled={likedIds.has(`xhs:${n.id}`)} /> {((n.likes + (likedIds.has(`xhs:${n.id}`) ? 1 : 0)) / 1000).toFixed(1)}k</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    )
  );

  if (nav === "shop") {
    return (
      <div className="relative flex h-full flex-col bg-[#f5f5f5]">
        <div className="flex items-center gap-2 bg-white px-3 py-2.5">
          <button onClick={() => setNav("home")} className="text-[15px] text-ink-soft">‹</button>
          <span className="flex-1 text-center text-[15px] font-semibold text-ink">购物 · 好物集</span>
          <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-white" style={{ background: XHS_RED }}>余额 ¥{money(bal)}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="grid grid-cols-2 gap-2">
            {SHOP_ITEMS.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <div style={{ background: it.cover, height: 92 }} />
                <div className="px-2 py-2">
                  <p className="line-clamp-2 text-[12.5px] leading-snug text-ink">{it.name}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[13px] font-bold" style={{ color: XHS_RED }}>¥{money(it.price)}</span>
                    <button onClick={() => buy(it)} className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-white" style={{ background: XHS_RED }}>购买</button>
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
              <span className="ml-auto rounded-full px-3 py-1 text-[11.5px] font-semibold text-white" style={{ background: XHS_RED }}>钱包 ¥{money(bal)}</span>
            </div>
            <div className="mt-3 flex text-center text-[13px]">
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{followedPids.size}</p><p className="text-ink-soft">关注</p></div>
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{likedNotes.length}</p><p className="text-ink-soft">获赞</p></div>
              <div className="flex-1"><p className="text-[16px] font-bold tabular-nums text-ink">{savedNotes.length}</p><p className="text-ink-soft">收藏</p></div>
            </div>
          </div>
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
        <button onClick={() => flash("搜索：试试「红毯造型」「试镜技巧」")} className="text-ink-soft"><IconSearch size={18} /></button>
      </div>

      {/* 内容区：关注流 / 发现瀑布流 / 附近（下拉刷新） */}
      <PullToRefresh
        className="flex-1"
        accent={XHS_RED}
        tint="light"
        onRefresh={async () => { await delay(700); flash("已经是最新啦～"); }}
      >
        {tab === "follow" && <MiniGrid list={followNotes} empty="还没有关注的人。点开任意笔记右上「关注」，TA 的笔记就会出现在这里。" />}
        {tab === "near" && <MiniGrid list={notes.slice(3)} empty="附近暂时没有笔记。" />}
        {tab === "explore" && <MiniGrid list={notes} empty="暂无笔记。" />}
      </PullToRefresh>

      {Toast}
      {/* 底部导航 */}
      {NavBar}
    </div>
  );
}
