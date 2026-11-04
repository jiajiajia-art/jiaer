import { lazyPanel } from "../lib/lazyPanel";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { engineRules, mediaCheck } from "../game/engineRules";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getWorld, subscribeMods } from "../mods/registry";
import { platformTrack } from "../game/platformAudio";
import type { ModTrack } from "../mods/types";
import { setExternalPause, yieldBgm } from "../game/audioEngine";
import { IconMusic, IconPause, IconPlay, IconSkipBack, IconSkipForward, StatusMark } from "../lib/icons";
import { asModArray } from "../lib/asModArray";
const AudioMixer = lazyPanel(() => import("./AudioLibraryPanel").then((m) => ({ default: m.AudioMixer })));

/* 游戏设置 · 背景音乐：本地上传音频（存 IndexedDB，刷新不丢）、歌单点播、
 * 播放 / 暂停 / 上下首 / 循环模式 / 音量 / 进度 / 删除。
 * 播放器是模块级单例，切页签、关闭设置都不中断播放。 */

type Track = { id: string; name: string; size: number; blob: Blob };
type Mode = "list" | "one" | "shuffle";

const DB = "star:bgm", STORE = "tracks", PREF = "star:bgm:pref";
const MAX_MB = 30;

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const q = fn(d.transaction(STORE, mode).objectStore(STORE));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

/* ---------- 单例播放器 ---------- */
const pref0 = loadGlobal<Record<string, any>>(PREF, {}) || {};
let state = { tracks: [] as Track[], world: [] as ModTrack[], worldName: "", cur: null as string | null, playing: false, mode: (pref0.mode ?? "list") as Mode, volume: (pref0.volume ?? 0.6) as number, loaded: false, error: "" };
const subs = new Set<() => void>();
const set = (p: Partial<typeof state>) => { state = { ...state, ...p }; saveGlobal(PREF, { mode: state.mode, volume: state.volume }); subs.forEach((f) => f()); };
let audio: HTMLAudioElement | null = null;
let url = "";

function el() {
  if (!audio) {
    audio = new Audio();
    audio.volume = state.volume;
    audio.onended = () => { if (state.mode === "one") { audio!.currentTime = 0; void audio!.play(); } else step(1); };
    audio.onpause = () => set({ playing: false });
    audio.onplay = () => { yieldBgm(); set({ playing: true }); };
    setExternalPause(() => audio?.pause());
  }
  return audio;
}
async function load() {
  if (state.loaded) return;
  try { set({ tracks: await tx<Track[]>("readonly", (s) => s.getAll() as IDBRequest<Track[]>), loaded: true }); }
  catch { set({ loaded: true, error: "浏览器不支持本地存储音乐（可能处于无痕模式）" }); }
}
/* 模组内置音乐：随当前生效世界刷新；带 autoplay 的在未播放时自动开播 */
function syncWorld() {
  const w = getWorld();
  // 功能注释：AI 常把 bgm 写成单对象；asModArray 后再 flatMap，禁止预览 emit 时 is not iterable
  const world = w.chain.flatMap((m) => {
    const tracks = asModArray<ModTrack>(m.content.bgm).map((t) => ({ ...t, id: `w:${m.id}:${t.id}` }));
    const pid = m.content.platformAutoplay;
    const p = typeof pid === "string" ? platformTrack(pid) : undefined;
    if (p && !tracks.some((t) => t.autoplay)) tracks.push({ id: `w:${m.id}:${p.id}`, name: p.name, src: p.src, autoplay: true });
    return tracks;
  });
  if (JSON.stringify(world) === JSON.stringify(state.world)) return;
  set({ world, worldName: w.chain[0]?.name ?? "" });
  const auto = world.find((t) => t.autoplay);
  if (auto && !state.playing) playId(auto.id);
}
let worldHooked = false;
export function hookWorldBgm() {
  if (worldHooked || typeof window === "undefined") return;
  worldHooked = true;
  subscribeMods(syncWorld);
  void load().then(syncWorld);
}
/** 本机音乐库（供编辑器「从我的音乐」选择） */
export async function localTracks() { await load(); return state.tracks.map(({ id, name, size }) => ({ id, name, size })); }
/** 功能注释：编辑器试听本机曲时取出文件，不把 blob 写进模组 */
export async function localTrackBlob(id: string): Promise<Blob | null> {
  await load();
  return state.tracks.find((t) => t.id === id)?.blob ?? null;
}
export { load as loadBgm, add as addBgm };
/** 地点 BGM：按模组内置音乐的原始 id 切歌（已在放同一首则不打断） */
export function playWorldTrack(rawId: string) {
  const t = state.world.find((x) => x.id === rawId || x.id.endsWith(`:${rawId}`));
  if (t && state.cur !== t.id) playId(t.id);
}

function srcOf(id: string): string | null {
  const w = state.world.find((x) => x.id === id);
  if (w) {
    if (!w.src.startsWith("local:")) return w.src;
    const t = state.tracks.find((x) => x.id === w.src.slice(6));
    return t ? URL.createObjectURL(t.blob) : null;
  }
  const t = state.tracks.find((x) => x.id === id);
  return t ? URL.createObjectURL(t.blob) : null;
}
function playId(id: string) {
  const a = el();
  yieldBgm(); // 个人播放器与作品 BGM 互斥：同一时间只放一首
  if (state.cur !== id) {
    const u = srcOf(id);
    if (!u) { set({ error: "找不到该音乐（本机音乐库里可能已删除）" }); return; }
    if (url) URL.revokeObjectURL(url);
    url = u.startsWith("blob:") ? u : "";
    a.src = u; set({ cur: id });
    fadeIn(a);
  }
  a.play().catch(() => set({ error: "无法播放该文件，格式可能不受支持" }));
}
/* 底层规则 · 切歌淡入：音量在 fadeMs 内从 0 升到玩家设定的音量（单一播放器，天然不重叠） */
let fadeTimer = 0;
function fadeIn(a: HTMLAudioElement) {
  const ms = engineRules().media.fadeMs;
  window.clearInterval(fadeTimer);
  if (!(ms > 0)) { a.volume = state.volume; return; }
  const t0 = Date.now();
  a.volume = 0;
  fadeTimer = window.setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    a.volume = state.volume * k;
    if (k >= 1) window.clearInterval(fadeTimer);
  }, 40);
}
function toggle() {
  if (!state.cur) { const f = state.world[0]?.id ?? state.tracks[0]?.id; if (f) playId(f); return; }
  const a = el();
  if (a.paused) void a.play(); else a.pause();
}
function step(d: 1 | -1) {
  const all = [...state.world.map((t) => t.id), ...state.tracks.map((t) => t.id)];
  const n = all.length;
  if (!n) return;
  const i = all.indexOf(state.cur ?? "");
  const j = state.mode === "shuffle" && n > 1 ? (i + 1 + Math.floor(Math.random() * (n - 1))) % n : (i + d + n) % n;
  playId(all[j]);
}
async function add(files: FileList) {
  const ok: Track[] = []; const bad: string[] = [];
  for (const f of Array.from(files)) {
    if (!f.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|flac|opus)$/i.test(f.name)) { bad.push(`${f.name}（不是音频）`); continue; }
    if (f.size > MAX_MB * 1048576) { bad.push(`${f.name}（超过 ${MAX_MB}MB）`); continue; }
    const why = mediaCheck(f, "audio");
    if (why) { bad.push(`${f.name}（${why}）`); continue; }
    const t: Track = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: f.name.replace(/\.[^.]+$/, ""), size: f.size, blob: f };
    try { await tx("readwrite", (s) => s.put(t)); ok.push(t); } catch { bad.push(`${f.name}（存储空间不足）`); }
  }
  set({ tracks: [...state.tracks, ...ok], error: bad.length ? `未添加：${bad.join("、")}` : "" });
  return ok.length;
}
async function remove(id: string) {
  await tx("readwrite", (s) => s.delete(id)).catch(() => {});
  if (state.cur === id) { const a = el(); a.pause(); a.removeAttribute("src"); if (url) URL.revokeObjectURL(url); url = ""; set({ cur: null }); }
  set({ tracks: state.tracks.filter((t) => t.id !== id) });
}
function setVolume(v: number) { window.clearInterval(fadeTimer); el().volume = v; set({ volume: v }); }

const useBgm = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => state);
const fmt = (s: number) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00");
const MODE: Record<Mode, string> = { list: "列表循环", one: "单曲循环", shuffle: "随机播放" };

export default function BgmPanel() {
  const s = useBgm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { hookWorldBgm(); }, []);
  useEffect(() => {
    const a = el();
    const tick = () => setPos({ t: a.currentTime, d: a.duration || 0 });
    a.addEventListener("timeupdate", tick); a.addEventListener("loadedmetadata", tick);
    tick();
    return () => { a.removeEventListener("timeupdate", tick); a.removeEventListener("loadedmetadata", tick); };
  }, []);

  const cur = s.tracks.find((t) => t.id === s.cur) ?? s.world.find((t) => t.id === s.cur);
  const any = s.tracks.length + s.world.length > 0;
  const btn = "grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

  return (
    <div className="space-y-3">
      {/* 正在播放 */}
      <div className="rounded-2xl border border-line bg-paper p-3">
        <p className="truncate text-[13.5px] font-bold text-ink">{cur ? cur.name : any ? "未在播放 · 点歌单或播放键开始" : "还没有音乐，先上传一首吧"}</p>
        <div className="mt-2 flex items-center gap-2 text-[10.5px] tabular-nums text-ink-soft">
          <span>{fmt(pos.t)}</span>
          <input type="range" min={0} max={pos.d || 0} step={0.1} value={Math.min(pos.t, pos.d || 0)} disabled={!cur || !pos.d}
            onChange={(e) => { el().currentTime = Number(e.target.value); }} className="h-1 flex-1 accent-[var(--jade)]" aria-label="播放进度" />
          <span>{fmt(pos.d)}</span>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button className={`${btn} w-auto px-3 text-[11px]`} onClick={() => set({ mode: s.mode === "list" ? "one" : s.mode === "one" ? "shuffle" : "list" })} title="切换播放模式">
            {MODE[s.mode]}
          </button>
          <button className={btn} disabled={!any} onClick={() => step(-1)} aria-label="上一首"><IconSkipBack size={16} /></button>
          <button className="grid h-11 w-11 place-items-center rounded-full bg-jade text-[16px] text-white shadow disabled:opacity-40" disabled={!any} onClick={toggle} aria-label={s.playing ? "暂停" : "播放"}>
            {s.playing ? <IconPause size={18} /> : <IconPlay size={18} />}
          </button>
          <button className={btn} disabled={!any} onClick={() => step(1)} aria-label="下一首"><IconSkipForward size={16} /></button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-ink-soft">
          音量
          <input type="range" min={0} max={1} step={0.01} value={s.volume} onChange={(e) => setVolume(Number(e.target.value))} className="h-1 flex-1 accent-[var(--jade)]" aria-label="音量" />
          <span className="w-8 text-right tabular-nums">{Math.round(s.volume * 100)}</span>
        </label>
      </div>

      <AudioMixer />

      {/* 上传 */}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={() => fileRef.current?.click()} className="rounded-full bg-jade px-4 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50">
          {busy ? "上传中…" : "＋ 上传音乐"}
        </button>
        <span className="text-[11px] text-ink-soft">支持 mp3 / m4a / wav / ogg / flac，单首 ≤ {MAX_MB}MB，保存在本机浏览器</span>
        <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus" multiple className="hidden"
          onChange={async (e) => {
            const fs = e.target.files; if (!fs?.length) return;
            setBusy(true);
            const first = state.tracks.length;
            const n = await add(fs);
            e.target.value = ""; setBusy(false);
            if (n && !state.playing && !state.cur) playId(state.tracks[first].id);
          }} />
      </div>
      {s.error && <p className="text-[11.5px] text-danger"><StatusMark kind="warn">{s.error}</StatusMark></p>}

      {/* 模组内置 */}
      {s.world.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-ink-soft">本世界内置 · {s.worldName}</p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {s.world.map((t, i) => {
              const on = t.id === s.cur;
              return (
                <li key={t.id}>
                  <button onClick={() => (on ? toggle() : playId(t.id))} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${on ? "bg-jade/10" : ""}`}>
                    <span className={`flex w-5 shrink-0 items-center justify-center text-center text-[11px] tabular-nums ${on ? "text-jade" : "text-ink-soft"}`}>{on && s.playing ? <IconMusic size={12} /> : i + 1}</span>
                    <span className={`truncate text-[13px] ${on ? "font-bold text-jade" : "text-ink"}`}>{t.name}</span>
                    {t.autoplay && <span className="ml-auto shrink-0 rounded-full bg-jade/10 px-1.5 text-[10px] text-jade">开局播放</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 歌单 */}
      {s.tracks.length > 0 && <p className="text-[11px] font-semibold text-ink-soft">我的音乐</p>}
      {s.tracks.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {s.tracks.map((t, i) => {
            const on = t.id === s.cur;
            return (
              <li key={t.id} className={`flex items-center gap-2 px-3 py-2 ${on ? "bg-jade/10" : ""}`}>
                <button onClick={() => (on ? toggle() : playId(t.id))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                  <span className={`flex w-5 shrink-0 items-center justify-center text-center text-[11px] tabular-nums ${on ? "text-jade" : "text-ink-soft"}`}>{on && s.playing ? <IconMusic size={12} /> : i + 1}</span>
                  <span className={`truncate text-[13px] ${on ? "font-bold text-jade" : "text-ink"}`}>{t.name}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-ink-soft">{(t.size / 1048576).toFixed(1)}MB</span>
                </button>
                {confirm === t.id ? (
                  <span className="flex shrink-0 gap-1">
                    <button onClick={() => { void remove(t.id); setConfirm(null); }} className="rounded-full bg-danger px-2.5 py-0.5 text-[11px] text-white">删除</button>
                    <button onClick={() => setConfirm(null)} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-soft">取消</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirm(t.id)} className="shrink-0 px-1 text-[15px] text-ink-soft hover:text-danger" aria-label={`删除 ${t.name}`}>×</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
