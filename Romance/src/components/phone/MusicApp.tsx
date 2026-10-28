/* 云音乐：真实合成播放（Web Audio）+ 网易云风格歌单 / 播放页。
 * 署名与榜单实时映射到本局游戏中的真实艺人（NPC / 玩家本人）。 */
import { loadData, saveData } from "../../lib/saveScope";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { TRACKS, getSynth, getPlayerState, subscribePlayer, playIdx, togglePlay, nextTrack, prevTrack, rankTracks, setPlotTracks, type TrackArtist, type PlotSong } from "./music";
import { useWorldSync, syncJson, loadFeed, saveFeed } from "./worldSync";

/* 启动即恢复缓存的剧情联动新歌 */
const cachedSongs = loadFeed<PlotSong[]>("cloudmusic");
if (cachedSongs?.length && !TRACKS.some((t) => t.plot)) setPlotTracks(cachedSongs);
import { IconPlay, IconHeart, IconChevron, IconMusic } from "./icons";
import { IconArrowUp } from "../../lib/icons";
import { Avatar } from "../ui";
import { useGame } from "../../store/gameCtx";
import { logAct } from "../../game/phoneLink";

function useMusic() {
  return useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
}
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const LIKES_KEY = "star2005.phone.music.likes";
/* 兼容读取：叙事 NPC 类型上未必带 fame，退化用好感度做稳定代理，保证榜单可排序 */
const fameOf = (n: { affinity?: number } & { fame?: number }) =>
  typeof n.fame === "number" ? n.fame : (n.affinity ?? 0) + 60;

export default function MusicApp({ onBack }: { onBack: () => void }) {
  const { game, cfg, patchGame } = useGame();
  const { idx, playing } = useMusic();
  // 线上联动：听了哪首歌记入手机流水（连续切歌合并为一条）
  const listen = (i: number) => { playIdx(i); const t = TRACKS[i]; if (t) patchGame((g) => logAct(g, { app: "云音乐", text: "听了", bit: `${t.title} - ${t.artist}`, key: "music", min: 4 })); };

  useWorldSync("cloudmusic", async () => {
    const r = await syncJson<{ songs?: unknown }>(cfg, game!, "cloudmusic", "云音乐", `生成 3 首紧扣当前世界剧情的新歌/影视 OST/新单曲（署名尽量用剧情中的真实人物或主角），附一条网友热评。返回 {"songs":[{"title":"歌名","artist":"演唱者","album":"专辑或影视OST名","lyric":["4 句歌词，每句≤14字"],"hot":"热评≤40字"}]}`);
    if (!r) return "未配置 AI，无法联动剧情";
    const str = (v: unknown, d: string, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : d);
    const fresh: PlotSong[] = (Array.isArray(r.songs) ? r.songs : []).filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, 4).map((x) => ({
      title: str(x.title, "", 24), artist: str(x.artist, "佚名", 20), album: str(x.album, "单曲", 24),
      lyric: (Array.isArray(x.lyric) ? x.lyric : []).filter((l): l is string => typeof l === "string" && !!l.trim()).slice(0, 6).map((l) => l.trim().slice(0, 24)),
      hot: str(x.hot, "", 60) || undefined,
    })).filter((x) => x.title);
    if (!fresh.length) return "这次没有生成新歌，请稍后再试";
    const prev = TRACKS.filter((t) => t.plot).map((t) => ({ title: t.title, artist: t.artist, album: t.album, lyric: t.lyric, hot: t.hot }));
    const all = [...fresh, ...prev.filter((p) => !fresh.some((f) => f.title === p.title))].slice(0, 8);
    setPlotTracks(all); saveFeed("cloudmusic", all);
    return `新上榜 ${fresh.length} 首剧情相关歌曲`;
  });
  const [view, setView] = useState<"list" | "player">("list");
  const [elapsed, setElapsed] = useState(0);
  const [likes, setLikes] = useState<string[]>(() => {
    return loadData<string[]>(LIKES_KEY, []);
  });
  useEffect(() => { saveData(LIKES_KEY, likes); }, [likes]);
  const toggleLike = (id: string) => setLikes((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const track = TRACKS[idx];

  /* —— 每首曲子确定性署名给本局真实艺人（玩家的本人单曲 + 各 NPC） —— */
  const artists = useMemo<TrackArtist[]>(() => {
    const npcs = game?.npcs ?? [];
    const playerIdx = 0; // 首推曲即玩家本人单曲
    return TRACKS.map((t, i) => {
      if (t.plot) {
        if (game && t.artist === game.player.name) return { name: t.artist, avatar: game.player.avatar, fame: game.sim.fame ?? 0, isPlayer: true };
        const npc = npcs.find((n) => n.name === t.artist);
        return { name: t.artist, avatar: npc?.avatar, fame: npc ? fameOf(npc) + 20 : 80 };
      }
      if (i === playerIdx) {
        return { name: game?.player.name ?? t.artist, avatar: game?.player.avatar, fame: game?.sim.fame ?? 0, isPlayer: true };
      }
      if (npcs.length === 0) return { name: t.artist, fame: (TRACKS.length - i) * 40 }; // NPC 不足时退回原署名
      const npc = npcs[i % npcs.length];
      return { name: npc.name, avatar: npc.avatar, fame: fameOf(npc) };
    });
  }, [game, TRACKS.length, idx]);

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
          <span className="w-[22px]" />
        </div>

        {/* 黑胶唱片 */}
        <div className="flex flex-1 items-center justify-center">
          <div className="relative h-56 w-56 max-w-[70vw]">
            <div className="absolute inset-0 rounded-full bg-black shadow-2xl" style={{ animation: "dy-spin 12s linear infinite", animationPlayState: playing ? "running" : "paused" }}>
              <div className="absolute inset-0 rounded-full" style={{ background: "repeating-radial-gradient(circle, rgba(255,255,255,0.05) 0 2px, transparent 2px 6px)" }} />
              <div className="absolute inset-[26%] overflow-hidden rounded-full ring-4 ring-white/10">
                <img src={(track.cover) || undefined} alt={track.album} className="h-full w-full object-cover" />
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
          <button onClick={prevTrack} aria-label="上一首" className="text-white"><SkipGlyph prev /></button>
          <button onClick={togglePlay} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-lg">
            {playing ? <PauseGlyph /> : <IconPlay size={30} />}
          </button>
          <button onClick={nextTrack} aria-label="下一首" className="text-white"><SkipGlyph /></button>
          <span className="w-6" />
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
        <button onClick={() => { listen(0); setView("player"); }} className="relative m-3 block h-32 w-[calc(100%-1.5rem)] overflow-hidden rounded-2xl text-left" style={{ background: `linear-gradient(120deg, ${TRACKS[0].color}, ${TRACKS[0].color2})` }}>
          <img src={(TRACKS[0].cover) || undefined} alt="" className="absolute right-0 top-0 h-full w-1/2 object-cover opacity-40" />
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
              <button key={t.id} onClick={() => { listen(i); setView("player"); }} className="flex w-full items-center gap-3 border-b border-black/[0.05] px-3 py-2.5 text-left">
                <span className="flex w-6 flex-col items-center leading-none">
                  <span className={`text-[16px] font-semibold ${top3 ? "text-[#e21f27]" : "text-ink-soft"}`}>{active && playing ? <IconMusic size={16} /> : rank}</span>
                  {top3 && <span className="mt-0.5 text-[#e21f27]"><IconArrowUp size={9} /></span>}
                </span>
                <Avatar src={a.avatar} name={a.name} size={44} editable={false} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[15px] ${active ? "font-semibold text-[#e21f27]" : "text-ink"}`}>{t.title}</p>
                  <p className="truncate text-[12px] text-ink-soft">{a.name}{a.isPlayer ? " · 你的单曲" : ""} · {t.album}</p>
                  {t.hot && <p className="truncate text-[11px] text-[#e21f27]/80">{t.plot ? "新 · " : ""}热评：{t.hot}</p>}
                </div>
                <IconPlay size={18} className="text-ink-soft/60" />
              </button>
            );
          })}
        </div>
        <p className="px-4 py-4 text-center text-[11.5px] text-ink-soft/70">STAR 云音乐 · 曲目由本机实时合成演奏</p>
      </div>

      {/* 底部迷你播放条 */}
      <button onClick={() => setView("player")} className="absolute inset-x-2 bottom-2 z-20 flex items-center gap-3 rounded-full bg-white/95 px-2 py-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur">
        <div className="h-10 w-10 overflow-hidden rounded-full" style={{ animation: "dy-spin 12s linear infinite", animationPlayState: playing ? "running" : "paused" }}><img src={(track.cover) || undefined} alt="" className="h-full w-full object-cover" /></div>
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

function SkipGlyph({ prev }: { prev?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={prev ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M5 4.5v15a1 1 0 0 0 1.5.86L18 13v6a1 1 0 0 0 2 0V5a1 1 0 0 0-2 0v6L6.5 3.64A1 1 0 0 0 5 4.5z" />
    </svg>
  );
}
