/* 抖音：仿原生（全屏竖向短视频流、右侧互动栏、顶部 关注/推荐/直播、底部导航；直播并入本 App） */
import { useMemo, useRef, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { Avatar } from "../ui";
import { PERSON_BY_ID } from "../../worlds/star2005/content";
import { CommentSheet } from "./shared";
import { setFollow, toggleLike } from "../../game/phone";
import { douyinPost } from "./persona";
import LiveApp from "./LiveApp";
import type { ReactNode } from "react";
import { IconHeart, IconComment, IconGift, IconShare, IconMusic, IconPlay, IconPlus, IconSearch } from "./icons";

type Clip = {
  id: string;
  authorPid?: string;
  author: string;
  caption: string;
  music: string;
  bg: string;
  img: string;
  likes: number;
  comments: number;
  shares: number;
};

const BGS = [
  "linear-gradient(160deg,#2b1055,#7597de)",
  "linear-gradient(160deg,#0f2027,#2c5364)",
  "linear-gradient(160deg,#42275a,#734b6d)",
  "linear-gradient(160deg,#1f1c2c,#928dab)",
  "linear-gradient(160deg,#3a1c71,#d76d77)",
  "linear-gradient(160deg,#000428,#004e92)",
];

const DY_IMG = (id: string) => `https://images.unsplash.com/photo-${id}?w=440&h=900&fit=crop&auto=format&q=75`;
// 与 seeds 顺序对齐的竖版封面
const CLIP_IMAGES = [
  DY_IMG("1632187989763-c9c620420b4d"), // 杀青花絮 · 剧组
  DY_IMG("1762430790606-bf626757a00b"), // 红毯路透 · 走秀
  DY_IMG("1722110813281-594c2f6c1dbd"), // 上镜技巧 · 人像
  DY_IMG("1612544409025-e1f6a56c1152"), // 凌晨片场
  DY_IMG("1547153760-18fc86324498"),    // 翻跳舞蹈
  DY_IMG("1529229504105-4ea795dcbf59"), // 对手戏 · 舞台动感
];

function VideoCard({ clip, onFlash }: { clip: Clip; onFlash: (t: string) => void }) {
  const { game, commitGame } = useGame();
  const npc = clip.authorPid ? game!.npcs.find((n) => n.id === clip.authorPid) : undefined;
  // 点赞 / 关注 跨会话持久（存 game.phone，与微博/小红书同一份）
  const liked = (game!.phone?.likes ?? []).includes(`dy:${clip.id}`);
  const followed = !!clip.authorPid && (game!.phone?.follows ?? []).includes(clip.authorPid);
  const setLiked = () => commitGame(toggleLike(game!, `dy:${clip.id}`));
  const doFollow = () => { if (clip.authorPid) commitGame(setFollow(game!, clip.authorPid, true)); };
  const [comments, setComments] = useState(false);
  const [paused, setPaused] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; r: number }[]>([]);
  const lastTap = useRef(0);
  const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}w` : `${n}`);

  // 单击暂停/播放；双击（350ms 内）点赞并在指尖迸出爱心
  const onSurface = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (now - lastTap.current < 350) {
      if (!liked) commitGame(toggleLike(game!, `dy:${clip.id}`));
      const id = now;
      setBursts((b) => [...b, { id, x, y, r: (Math.random() - 0.5) * 40 }]);
      setTimeout(() => setBursts((b) => b.filter((h) => h.id !== id)), 800);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      setTimeout(() => { if (lastTap.current === now) setPaused((p) => !p); }, 360);
    }
  };

  const tip = () => {
    const cost = 66;
    if (game!.sim.money < cost) { onFlash("余额不足，攒够钱再来打赏～"); return; }
    commitGame({ ...game!, sim: { ...game!.sim, money: game!.sim.money - cost } });
    onFlash(`已为 @${clip.author} 打赏 ¥66`);
  };

  const Rail = ({ icon, label, onClick, active }: { icon: ReactNode; label: string; onClick?: () => void; active?: boolean }) => (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className="leading-none drop-shadow" style={{ color: active ? "#fe2c55" : "white" }}>{icon}</span>
      <span className="text-[11px] text-white drop-shadow">{label}</span>
    </button>
  );

  return (
    <div className="relative h-full w-full snap-start overflow-hidden text-white" style={{ background: clip.bg }}>
      <img src={clip.img} alt={clip.caption} className="absolute inset-0 h-full w-full object-cover" />
      {/* 上下暗角，保证文案与图标可读 */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />

      {/* 手势层：单击暂停/播放，双击点赞 */}
      <div className="absolute inset-0" onClick={onSurface} />
      {/* 暂停态才显示的大播放键 */}
      {paused && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/70"><IconPlay size={72} /></div>}
      {/* 双击迸出的爱心 */}
      {bursts.map((h) => (
        <span key={h.id} className="dy-burst pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 text-[#fe2c55]" style={{ left: h.x, top: h.y, ["--r" as string]: `${h.r}deg` }}>
          <IconHeart size={80} filled />
        </span>
      ))}

      {/* 右侧互动栏 */}
      <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <Avatar src={npc?.avatar} name={clip.author} size={46} editable={false} />
          {!followed && (
            <button onClick={doFollow} className="absolute -bottom-2 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-white" style={{ background: "#fe2c55" }}><IconPlus size={13} strokeWidth={3} /></button>
          )}
        </div>
        <Rail icon={<IconHeart size={30} filled={liked} />} label={fmt(clip.likes + (liked ? 1 : 0))} onClick={() => setLiked()} active={liked} />
        <Rail icon={<IconComment size={30} />} label={fmt(clip.comments)} onClick={() => setComments(true)} />
        <Rail icon={<IconGift size={30} />} label="打赏" onClick={tip} />
        <Rail icon={<IconShare size={30} />} label={fmt(clip.shares)} onClick={() => onFlash("已复制分享链接")} />
        {/* 旋转唱片 */}
        <div className="dy-disc mt-1 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-black text-white"><IconMusic size={16} /></div>
      </div>

      {/* 左下文案 + 音乐 */}
      <div className="absolute inset-x-3 bottom-20 pr-14">
        <p className="text-[15px] font-bold drop-shadow">@{clip.author}</p>
        <p className="mt-1 text-[13.5px] leading-snug drop-shadow">{clip.caption}</p>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] drop-shadow">
          <IconMusic size={13} /><span className="dy-marquee inline-block max-w-[220px] overflow-hidden whitespace-nowrap">{clip.music}</span>
        </p>
      </div>

      {/* 底部播放进度条（暂停时停住） */}
      <div className="absolute inset-x-0 bottom-[52px] h-[3px] bg-white/20">
        <div className={`dy-progress h-full bg-white/85 ${paused ? "dy-progress-paused" : ""}`} />
      </div>

      {comments && <CommentSheet count={clip.comments} onClose={() => setComments(false)} accent="#fe2c55" cid={`dy:${clip.id}`} />}
    </div>
  );
}

export default function DouyinApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const [tab, setTab] = useState<"follow" | "reco" | "live">("reco");
  const [me, setMe] = useState(false);
  const [toast, setToast] = useState("");
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); };

  const clips = useMemo<Clip[]>(() => {
    // 每条短视频由一位圈内人发布，文案/配乐随其职业性格生成，杜绝「资本大佬翻跳热舞」的违和
    const roster = game!.npcs.length ? game!.npcs : [];
    return Array.from({ length: 6 }, (_, i) => {
      const npc = roster.length ? roster[i % roster.length] : undefined;
      const sd = npc ? douyinPost(npc) : { caption: "记录生活的一天 #日常", music: "轻音乐 · 追光者" };
      return {
        id: `c${i}`,
        authorPid: npc?.id,
        author: npc?.name ?? PERSON_BY_ID[""]?.name ?? "云抖用户",
        caption: sd.caption,
        music: sd.music,
        bg: BGS[i % BGS.length],
        img: CLIP_IMAGES[i % CLIP_IMAGES.length],
        likes: (sd.caption.length * 733 + i * 1201) % 120000 + 3200,
        comments: (sd.caption.length * 91 + i * 77) % 4000 + 88,
        shares: (sd.caption.length * 53 + i * 31) % 2000 + 30,
      };
    });
  }, [game]);

  if (me) return <DouyinMe onBack={() => setMe(false)} onFlash={flash} toast={toast} />;

  if (tab === "live") {
    return (
      <div className="flex h-full flex-col bg-black">
        <TopTabs tab={tab} onPick={setTab} onBack={onBack} />
        <div className="min-h-0 flex-1">
          <LiveApp onBack={() => setTab("reco")} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-black">
      <TopTabs tab={tab} onPick={setTab} onBack={onBack} overlay onSearch={() => flash("搜索：试试「红毯」「杀青」")} />
      <div className="min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto">
        {(tab === "follow" ? clips.slice(0, 3) : clips).map((c) => (
          <div key={c.id} className="h-full w-full">
            <VideoCard clip={c} onFlash={flash} />
          </div>
        ))}
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
          <span className="rounded-full bg-white/90 px-4 py-1.5 text-[12.5px] font-medium text-black shadow-lg">{toast}</span>
        </div>
      )}
      {/* 底部导航（抖音黑底红点） */}
      <div className="absolute inset-x-0 bottom-0 flex items-center bg-black py-2 text-[11px] text-white/85">
        <button className="flex-1 text-center font-semibold text-white">首页</button>
        <button onClick={() => setTab("follow")} className="flex-1 text-center">朋友</button>
        <button onClick={() => flash("拍摄功能还在路上～")} className="flex-1 text-center">
          <span className="inline-flex h-6 w-9 items-center justify-center rounded-lg bg-white text-black"><IconPlus size={16} strokeWidth={3} /></span>
        </button>
        <button onClick={() => flash("暂时没有新消息")} className="flex-1 text-center">消息</button>
        <button onClick={() => setMe(true)} className="flex-1 text-center">我</button>
      </div>
    </div>
  );
}

/* 抖音 · 我的主页：玩家资料 + 数据 + 作品宫格（粉丝/获赞随名气派生） */
function DouyinMe({ onBack, onFlash, toast }: { onBack: () => void; onFlash: (t: string) => void; toast: string }) {
  const { game } = useGame();
  const [tab, setTab] = useState<"works" | "likes">("works");
  const fame = game!.sim.fame;
  const fans = fame * 1280 + 3600;
  const likes = fame * 4200 + 12000;
  const following = 60 + (fame % 40) + (game!.phone?.follows?.length ?? 0);
  const fmt = (n: number) => (n >= 10000 ? `${(n / 10000).toFixed(1)}w` : `${n}`);
  const name = game!.player.name;
  const worksImgs = CLIP_IMAGES.slice(0, tab === "works" ? 6 : 3);
  return (
    <div className="relative flex h-full flex-col bg-black text-white">
      {/* 头部 */}
      <div className="flex items-center px-3 py-2.5">
        <button onClick={onBack} className="w-10 text-left text-[20px] text-white/85">‹</button>
        <span className="flex-1 text-center text-[15px] font-semibold">{name}</span>
        <span className="w-10" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-4 px-4 pt-1">
          <div className="overflow-hidden rounded-[8px] ring-2 ring-white/20"><Avatar src={game!.player.avatar} name={name} size={64} editable={false} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[18px] font-bold">{name}</p>
            <p className="mt-0.5 text-[12px] text-white/50">云抖号：star_{name}</p>
          </div>
        </div>
        <p className="px-4 pt-3 text-[13px] leading-relaxed text-white/80">努力发光的新人演员 🎬 记录片场与生活的每一刻，谢谢你的每一次点赞。</p>
        {/* 数据 */}
        <div className="mt-3 flex px-4 text-center">
          <div className="flex-1"><p className="text-[17px] font-bold">{following}</p><p className="text-[11px] text-white/50">关注</p></div>
          <div className="flex-1"><p className="text-[17px] font-bold">{fmt(fans)}</p><p className="text-[11px] text-white/50">粉丝</p></div>
          <div className="flex-1"><p className="text-[17px] font-bold">{fmt(likes)}</p><p className="text-[11px] text-white/50">获赞</p></div>
        </div>
        <div className="mt-3 flex gap-2 px-4">
          <button onClick={() => onFlash("资料已保存")} className="flex-1 rounded-md bg-[#fe2c55] py-2 text-[13px] font-semibold">编辑资料</button>
          <button onClick={() => onFlash("已复制主页链接")} className="rounded-md bg-white/15 px-4 py-2 text-[13px] font-semibold">分享</button>
        </div>
        {/* 作品 / 喜欢 切换 */}
        <div className="mt-4 flex border-b border-white/10 text-[13px]">
          {([["works", "作品"], ["likes", "喜欢"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)} className={`relative flex-1 py-2.5 ${tab === id ? "font-semibold text-white" : "text-white/45"}`}>
              {l}
              {tab === id && <span className="absolute inset-x-[42%] -bottom-px h-0.5 rounded-full bg-[#fe2c55]" />}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {worksImgs.map((src, i) => (
            <button key={i} onClick={() => onFlash("播放作品")} className="relative aspect-[3/4] overflow-hidden bg-white/5">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-1 left-1.5 text-[11px] font-medium drop-shadow">▶ {fmt((i + 1) * 3100 + fame * 60)}</span>
            </button>
          ))}
          {worksImgs.length === 0 && <p className="col-span-3 py-10 text-center text-[13px] text-white/40">还没有发布作品</p>}
        </div>
      </div>
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
          <span className="rounded-full bg-white/90 px-4 py-1.5 text-[12.5px] font-medium text-black shadow-lg">{toast}</span>
        </div>
      )}
    </div>
  );
}

function TopTabs({ tab, onPick, onBack, overlay, onSearch }: { tab: string; onPick: (t: "follow" | "reco" | "live") => void; onBack: () => void; overlay?: boolean; onSearch?: () => void }) {
  return (
    <div className={`z-10 flex items-center px-3 py-2 text-[15px] ${overlay ? "absolute inset-x-0 top-0" : ""}`}>
      <button onClick={onBack} className="w-10 text-left text-white/85">‹</button>
      <div className="flex flex-1 items-center justify-center gap-5">
        {([["follow", "关注"], ["reco", "推荐"], ["live", "直播"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => onPick(id)} className="relative py-0.5">
            <span className={tab === id ? "font-bold text-white" : "text-white/60"}>{l}</span>
            {tab === id && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full bg-white" />}
          </button>
        ))}
      </div>
      <button onClick={onSearch} className="flex w-10 justify-end text-white/85"><IconSearch size={20} /></button>
    </div>
  );
}
