/* 朋友圈：好友动态流（可点赞），微信「发现」与独立 App 共用 */
import { useMemo, useState } from "react";
import { useGame } from "../../store/gameCtx";
import { toggleLike, addComment } from "../../game/phone";
import { Avatar } from "../ui";
import { PERSON_BY_ID } from "../../worlds/star2005/content";
import { TopBar, Lightbox } from "./shared";
import { IconHeart, IconComment } from "./icons";
import ProfileView from "./ProfileView";

const MM_IMG = (id: string, w = 300, h = 300) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format&q=75`;
const COVER = "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=560&h=280&fit=crop&auto=format&q=75";
// 与九宫格配图对齐的素材池（片场 / 港风 / 咖啡 / 红毯 / 夜景 / 花絮）
const GRID_POOL = [
  "1612544409025-e1f6a56c1152", "1636936291087-2972edf08f14", "1532800783378-1bed60adaf58",
  "1527189919029-aeb3d997547d", "1484251065541-c9770829890f", "1547592180-85f173990554",
  "1748543668676-ea8241cb3886", "1522798514-97ceb8c4f1c8", "1517841905240-472988babdf9",
];

export function Moments({ onOpenProfile }: { onOpenProfile?: (pid: string) => void }) {
  const { game, commitGame } = useGame();
  const likeSet = new Set(game!.phone?.likes ?? []);
  const [openComment, setOpenComment] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const posts = useMemo(() => {
    return game!.npcs.slice(0, 6).map((n, i) => {
      const p = PERSON_BY_ID[n.id];
      const w = p?.works?.[0];
      const text = w
        ? `新戏《${w}》杀青，谢谢每一个熬夜陪我的人。`
        : n.bio ? n.bio.slice(0, 40) + "…" : "今天也要好好生活呀。";
      // 图片数量制造九宫格错落：1 / 3 / 4 / 6 张
      const counts = [1, 3, 4, 6, 3, 1];
      const cnt = counts[i % counts.length];
      const imgs = Array.from({ length: cnt }, (_, k) => MM_IMG(GRID_POOL[(i * 3 + k) % GRID_POOL.length]));
      return {
        who: n.name,
        pid: n.id,
        text,
        imgs,
        when: `${(n.name.charCodeAt(0) % 12) + 1} 小时前`,
        seedLikes: game!.npcs.slice(0, (n.name.charCodeAt(0) % 4) + 1).map((x) => x.name),
      };
    });
  }, [game]);

  const submit = (pid: string) => {
    const t = draft.trim();
    if (!t) return;
    commitGame(addComment(game!, `mm:${pid}`, t));
    setDraft("");
    setOpenComment(null);
  };

  return (
    <div className="bg-white">
      {/* 相册封面 + 头像 */}
      <div className="relative h-40 bg-[#2b2f36]">
        <img src={COVER} alt="朋友圈封面" className="h-full w-full object-cover" />
        <div className="absolute -bottom-6 right-3 flex items-end gap-2.5">
          <span className="pb-8 text-right text-[15px] font-semibold text-white drop-shadow">{game!.player.name}</span>
          <div className="overflow-hidden rounded-[8px] ring-2 ring-white"><Avatar shape="rounded" src={game!.player.avatar} name={game!.player.name} size={60} editable={false} /></div>
        </div>
      </div>
      <div className="mt-9 divide-y divide-black/[0.06]">
        {posts.map((p, i) => {
          const npc = p.pid ? game!.npcs.find((n) => n.id === p.pid) : undefined;
          const liked = likeSet.has(`mm:${p.pid}`);
          const likeNames = [...(liked ? [game!.player.name] : []), ...p.seedLikes];
          const cs = (game!.phone?.comments?.[`mm:${p.pid}`] ?? []).map((c) => `${game!.player.name}：${c.text}`);
          return (
            <div key={i} className="flex gap-3 px-3 py-3.5">
              <button onClick={() => onOpenProfile?.(p.pid)} className="overflow-hidden rounded-[6px]"><Avatar shape="rounded" src={npc?.avatar} name={p.who} size={42} editable={false} /></button>
              <div className="min-w-0 flex-1">
                <button onClick={() => onOpenProfile?.(p.pid)} className="text-[15px] font-semibold text-[#5b6b8c] active:opacity-70">{p.who}</button>
                <p className="mt-1 text-[14.5px] leading-snug text-ink">{p.text}</p>
                {/* 九宫格配图 */}
                {p.imgs.length > 0 && (
                  <div className={`mt-2 grid gap-1 ${p.imgs.length === 1 ? "w-2/3 grid-cols-1" : "w-full max-w-[232px] grid-cols-3"}`}>
                    {p.imgs.map((src, k) => (
                      <button key={k} onClick={() => setLightbox(src)} className={`overflow-hidden bg-black/5 ${p.imgs.length === 1 ? "aspect-[4/3]" : "aspect-square"}`}>
                        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition active:scale-95" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center">
                  <span className="text-[12px] text-ink-soft">{p.when}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => commitGame(toggleLike(game!, `mm:${p.pid}`))} className={`flex items-center gap-1 rounded bg-black/[0.05] px-2 py-1 text-[12px] ${liked ? "text-coral" : "text-ink-soft"}`}><IconHeart size={13} filled={liked} /></button>
                    <button onClick={() => setOpenComment(openComment === i ? null : i)} className="flex items-center gap-1 rounded bg-black/[0.05] px-2 py-1 text-[12px] text-ink-soft"><IconComment size={13} /></button>
                  </div>
                </div>
                {/* 点赞 + 评论区（浅底块） */}
                {(likeNames.length > 0 || cs.length > 0) && (
                  <div className="mt-2 space-y-1 rounded-md bg-[#f5f6f8] px-2.5 py-2">
                    {likeNames.length > 0 && (
                      <p className="flex items-center gap-1.5 text-[12.5px] text-[#5b6b8c]">
                        <IconHeart size={12} filled /> <span className="text-ink/80">{likeNames.join("，")}</span>
                      </p>
                    )}
                    {cs.map((c, k) => {
                      const [name, ...rest] = c.split("：");
                      return <p key={k} className="text-[12.5px] text-ink"><span className="text-[#5b6b8c]">{name}</span>：{rest.join("：")}</p>;
                    })}
                  </div>
                )}
                {/* 评论输入 */}
                {openComment === i && (
                  <div className="mt-2 flex items-center gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(p.pid); }} autoFocus placeholder="评论…" className="flex-1 rounded-md bg-black/[0.06] px-3 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-soft/60" />
                    <button onClick={() => submit(p.pid)} disabled={!draft.trim()} className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-40" style={{ background: "#07c160" }}>发送</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

export default function MomentsApp({ onBack }: { onBack: () => void }) {
  const [profile, setProfile] = useState<string | null>(null);
  if (profile) return <ProfileView pid={profile} onBack={() => setProfile(null)} />;
  return (
    <div className="flex h-full flex-col bg-[#ededed]">
      <TopBar title="朋友圈" onBack={onBack} />
      <div className="flex-1 overflow-y-auto"><Moments onOpenProfile={setProfile} /></div>
    </div>
  );
}
