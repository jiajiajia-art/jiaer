/* 云音乐：真实合成播放（Web Audio）+ 网易云风格歌单 / 播放页。
 * 署名与榜单实时映射到本局游戏中的真实艺人（NPC / 玩家本人）。 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TRACKS, getSynth, getPlayerState, subscribePlayer, playIdx, togglePlay, nextTrack, prevTrack, rankTracks, type TrackArtist } from "./music";
import { IconPlay, IconHeart, IconComment, IconChevron, IconMusic, IconShare } from "./icons";
import { Avatar } from "../ui";
import { useGame } from "../../store/gameCtx";

function useMusic() {
  return useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const LIKES_KEY = "star2005.phone.music.likes";
/* 兼容读取：叙事 NPC 类型上未必带 fame，退化用好感度做稳定代理，保证榜单可排序 */
const fameOf = (n: { affinity?: number } & { fame?: number }) =>
  typeof n.fame === "number" ? n.fame : (n.affinity ?? 0) + 60;

export default function MusicApp({ onBack }: { onBack: () => void }) {
  const { game } = useGame();
  const { idx, playing } = useMusic();
  const [view, setView] = useState<"list" | "player">("list");
  const [elapsed, setElapsed] = useState(0);
  const [likes, setLikes] = useState<string[]>(() => {
    try { const r = localStorage.getItem(LIKES_KEY); if (r) return JSON.parse(r); } catch { /* ignore */ }
    return [];
  });
  useEffect(() => { try { localStorage.setItem(LIKES_KEY, JSON.stringify(likes)); } catch { /* ignore */ } }, [likes]);
  const toggleLike = (id: string) => setLikes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const track = TRACKS[idx];

  /* —— 每首曲子确定性署名给本局真实艺人（玩家的本人单曲 + 各 NPC） —— */
  const artists = useMemo<TrackArtist[]>(() => {
    const npcs = game?.npcs ?? [];
    const playerIdx = 0; // 首推曲即玩家本人单曲
    return TRACKS.map((t, i) => {
      if (i === playerIdx) {
        return { name: game?.player.name ?? t.artist, avatar: game?.player.avatar, fame: game?.sim.fame ?? 0, isPlayer: true };
      }
      if (npcs.length === 0) return { name: t.artist, fame: (TRACKS.length - i) * 40 }; // NPC 不足时退回原署名
      const npc = npcs[i % npcs.length];
      return { name: npc.name, avatar: npc.avatar, fame: fameOf(npc) };
    });
  }, [game]);

  const chart = useMemo(() => rankTracks(artists), [artists]);
  const artist = artists[idx] ?? { name: track.artist, fame: 0 };

  useEffect(() => {
    const t = setInterval(() => {
      const s = getSynth();
      const e = s.elapsed();
      setElapsed(e);
      if (playing && s.duration > 0 && e >= s.duration - 0.05) nextTrack();
    }, 250);
    return () => clearInterval(t);
  }, [playing]);

  const dur = getSynth().duration || track.lead.reduce((a, [, b]) => a + b * track.spb, 0);
  const pct = dur ? Math.min(1, elapsed / dur) : 0;
  const lyricLine = track.lyric[Math.min(track.lyric.length - 1, Math.floor(pct * track.lyric.length))];

  /* —— 全屏播放页 —— */
  if (view === "player") {
    return (
      <div className="flex h-full flex-col text-white" style={{ background: `linear-gradient(165deg, ${track.color}, ${track.color2})` }}>
        <div className="flex items-center px-3 py-2.5">
          <button onClick={() => setView("list")} className="text-white/90"><IconChevron size={22} className="rotate-180" /></button>
          <div className="flex-1 text-center"><p className="text-[15px] font-semibold">{track.title}</p><p className="text-[11.5px] text-white/70">{artist.name}{artist.isPlayer ? " · 你的单曲" : ""}</p></div>
          <button className="text-white/70"><IconShare size={18} /></button>
        </div>

        {/* 黑胶唱片 */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative h-60 w-60">
            <div className="absolute inset-0 rounded-full bg-black shadow-2xl" style={{ animation: "dy-spin 12s linear infinite", animationPlayState: playing ? "running" : "paused" }}>
              <div className="absolute inset-0 rounded-full" style={{ background: "repeating-radial-gradient(circle, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)" }} />
              <div className="absolute inset-[26%] overflow-hidden rounded-full ring-4 ring-white/10">
                <img src={track.cover} alt={track.album} className="h-full w-full object-cover" />
              </div>
              <div className="absolute inset-[46%] rounded-full bg-white/20" />
            </div>
          </div>
        </div>

        {/* 署名艺人 */}
        <div className="flex items-center justify-center gap-2 pb-2">
          <Avatar src={artist.avatar} name={artist.name} size={24} editable={false} />
          <span className="text-[12.5px] text-white/85">{artist.name}</span>
        </div>

        {/* 歌词行 */}
        <p className="px-6 pb-4 text-center text-[15px] font-medium text-white/90 transition-all">{lyricLine}</p>

        {/* 进度条 */}
        <div className="flex items-center gap-2 px-6 text-[11px] tabular-nums text-white/70">
          <span>{fmt(elapsed)}</span>
          <div className="relative h-1 flex-1 rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct * 100}%` }} />
            <div className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `calc(${pct * 100}% - 5px)` }} />
          </div>
          <span>{fmt(dur)}</span>
        </div>

        {/* 控制 */}
        <div className="flex items-center justify-center gap-8 px-6 pb-10 pt-5">
          <button onClick={() => toggleLike(track.id)} className={likes.includes(track.id) ? "text-rose-400" : "text-white/80"}><IconHeart size={24} filled={likes.includes(track.id)} /></button>
          <button onClick={prevTrack} className="text-white"><IconChevron size={30} className="rotate-180" /></button>
          <button onClick={togglePlay} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg">
            {playing ? <PauseGlyph /> : <IconPlay size={30} />}
          </button>
          <button onClick={nextTrack} className="text-white"><IconChevron size={30} /></button>
          <button className="text-white/80"><IconComment size={22} /></button>
        </div>
      </div>
    );
  }

  /* —— 歌单列表（本周热歌榜，按艺人名气排序） —— */
  return (
    <div className="flex h-full flex-col bg-[#f6f6f6]">
      <div className="flex items-center px-3 py-2.5" style={{ background: "linear-gradient(90deg,#e21f27,#f0454b)" }}>
        <button onClick={onBack} className="w-14 text-left text-white/95"><IconChevron size={20} className="rotate-180" /></button>
        <span className="flex-1 text-center text-[16px] font-semibold text-white">云音乐</span>
        <span className="w-14" />
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* 每日推荐横幅 */}
        <button onClick={() => { playIdx(0); setView("player"); }} className="relative m-3 block h-32 w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl text-left" style={{ background: `linear-gradient(120deg, ${TRACKS[0].color}, ${TRACKS[0].color2})` }}>
          <img src={TRACKS[0].cover} alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-40" />
          <div className="relative p-4 text-white">
            <p className="text-[12px] font-bold uppercase tracking-widest text-white/80">每日推荐 · 私人歌单</p>
            <p className="mt-1 text-[22px] font-extrabold">今夜为你而歌</p>
            <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/25 px-3 py-1 text-[12px] font-semibold backdrop-blur"><IconPlay size={12} /> 播放全部 {TRACKS.length} 首</span>
          </div>
        </button>

        <p className="px-4 pb-1 pt-2 text-[16px] font-bold text-ink">本周热歌榜</p>
        <div className="bg-white">
          {chart.map(({ track: t, idx: i, artist: a, rank }) => {
            const active = i === idx;
            const top3 = rank <= 3;
            return (
              <button key={t.id} onClick={() => { playIdx(i); setView("player"); }} className="flex w-full items-center gap-3 border-b border-black/[0.05] px-3 py-2.5 text-left">
                <span className="flex w-6 flex-col items-center leading-none">
                  <span className={`text-[16px] font-semibold ${top3 ? "text-[#e21f27]" : "text-ink-soft"}`}>{active && playing ? <IconMusic size={16} /> : rank}</span>
                  {top3 && <span className="mt-0.5 text-[9px] font-bold text-[#e21f27]">▲</span>}
                </span>
                <Avatar src={a.avatar} name={a.name} size={44} editable={false} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[15px] ${active ? "font-semibold text-[#e21f27]" : "text-ink"}`}>{t.title}</p>
                  <p className="truncate text-[12px] text-ink-soft">{a.name}{a.isPlayer ? " · 你的单曲" : ""} · {t.album}</p>
                </div>
                <IconPlay size={18} className="text-ink-soft/60" />
              </button>
            );
          })}
        </div>
        <p className="px-4 py-4 text-center text-[11.5px] text-ink-soft/70">STAR 云音乐 · 曲目由本机实时合成演奏</p>
      </div>

      {/* 底部迷你播放条 */}
      <button onClick={() => setView("player")} className="absolute inset-x-2 bottom-2 flex items-center gap-3 rounded-full bg-white/95 px-2 py-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <div className="h-10 w-10 overflow-hidden rounded-full" style={{ animation: "dy-spin 12s linear infinite", animationPlayState: playing ? "running" : "paused" }}><img src={track.cover} alt="" className="h-full w-full object-cover" /></div>
        <div className="min-w-0 flex-1 text-left"><p className="truncate text-[13.5px] font-medium text-ink">{track.title}</p><p className="truncate text-[11px] text-ink-soft">{artist.name}</p></div>
        <span onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e21f27] text-white">{playing ? <PauseGlyph small /> : <IconPlay size={18} />}</span>
      </button>
    </div>
  );
}

function PauseGlyph({ small }: { small?: boolean }) {
  const w = small ? 4 : 6, h = small ? 14 : 22, gap = small ? 4 : 6;
  return (
    <svg width={w * 2 + gap} height={h} viewBox={`0 0 ${w * 2 + gap} ${h}`} fill="currentColor" aria-hidden>
      <rect x="0" y="0" width={w} height={h} rx="1.5" /><rect x={w + gap} y="0" width={w} height={h} rx="1.5" />
    </svg>
  );
}
