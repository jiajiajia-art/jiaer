/* ═══════════════ 音频播放器（运行时单例）═══════════════
 * 多声道：同一时间最多一首 BGM（切换时淡出旧曲 + 淡入新曲）；音效 / 氛围音可叠加。
 * 音量分层相乘、互不覆盖：平台全局音量 × 作品音量 × 单条音频音量 × 本次指令音量。
 * 发出信号：播放结束 / 淡入完成 / 淡出完成 —— 供原生触发器（trigger.kind = "audio"）消费。 */
import { useSyncExternalStore } from "react";
import type { AudioCmd, AudioSignal } from "../lib/types";
import { loadGlobal, saveGlobal } from "../lib/saveScope";
import { loopOf, playableSrc, resolveAudio } from "./audioLib";

type Ch = { id: string; a: HTMLAudioElement; mult: number; k: number; timer: number; vt: number; bgm: boolean };
const K_VOL = "star:audio:global";
const st = { global: loadGlobal<number>(K_VOL, 1), work: 1, bgm: null as string | null, playing: [] as string[] };
const chans = new Map<string, Ch>();
const ls = new Set<() => void>();
let ver = 0;
const emitUi = () => { ver++; st.playing = [...chans.keys()]; ls.forEach((f) => f()); };
export const useAudioEngine = () => { useSyncExternalStore((f) => { ls.add(f); return () => { ls.delete(f); }; }, () => ver); return st; };

/* —— 信号 —— */
let signals: { on: AudioSignal; id: string }[] = [];
const sigL = new Set<() => void>();
function signal(on: AudioSignal, id: string) { signals = [...signals, { on, id }].slice(-20); sigL.forEach((f) => f()); }
export const takeAudioSignals = () => { const s = signals; signals = []; return s; };
export const onAudioSignal = (f: () => void) => { sigL.add(f); return () => { sigL.delete(f); }; };

/* —— 与「游戏设置 · 背景音乐」个人播放器互斥：作品 BGM 开播时暂停它 —— */
let pauseExternal: (() => void) | null = null;
export const setExternalPause = (f: () => void) => { pauseExternal = f; };

const vol = (c: Ch) => Math.max(0, Math.min(1, st.global * st.work * (resolveAudio(c.id)?.volume ?? 1) * c.mult * c.k));
const apply = (c: Ch) => { c.a.volume = vol(c); };
export const globalVolume = () => st.global;
export function setGlobalVolume(v: number) { st.global = v; saveGlobal(K_VOL, v); chans.forEach(apply); emitUi(); }
export function setWorkVolume(v: number) { if (st.work === v) return; st.work = v; chans.forEach(apply); emitUi(); }

function ramp(c: Ch, to: number, ms: number, done?: () => void) {
  window.clearInterval(c.timer);
  if (!(ms > 0)) { c.k = to; apply(c); done?.(); return; }
  const from = c.k, t0 = Date.now();
  c.timer = window.setInterval(() => {
    const p = Math.min(1, (Date.now() - t0) / ms);
    c.k = from + (to - from) * p; apply(c);
    if (p >= 1) { window.clearInterval(c.timer); done?.(); }
  }, 40);
}
function kill(c: Ch) { window.clearInterval(c.timer); window.clearInterval(c.vt); c.a.pause(); c.a.removeAttribute("src"); chans.delete(c.id); if (st.bgm === c.id) st.bgm = null; emitUi(); }

export async function play(id: string, o: { volume?: number; fade?: number } = {}) {
  const asset = resolveAudio(id);
  if (!asset) return false;
  if (asset.kind === "bgm") return switchBgm(id, o);
  const old = chans.get(id);
  if (old) kill(old);
  return start(id, o, false);
}
async function start(id: string, o: { volume?: number; fade?: number }, bgm: boolean) {
  const asset = resolveAudio(id)!;
  const src = await playableSrc(asset.src);
  if (!src) return false;
  const a = new Audio(src);
  a.loop = loopOf(asset);
  const c: Ch = { id, a, mult: o.volume ?? 1, k: 0, timer: 0, vt: 0, bgm };
  chans.set(id, c);
  if (bgm) { st.bgm = id; pauseExternal?.(); }
  a.onended = () => { signal("ended", id); if (chans.get(id) === c) kill(c); };
  apply(c);
  try { await a.play(); } catch { kill(c); return false; }
  ramp(c, 1, o.fade ?? asset.fadeIn ?? 0, () => signal("fadeIn", id));
  emitUi();
  return true;
}
export function stop(id: string, fade?: number) {
  const c = chans.get(id);
  if (!c) return;
  ramp(c, 0, fade ?? resolveAudio(id)?.fadeOut ?? 0, () => { kill(c); signal("fadeOut", id); });
}
export function stopAll(fade?: number) { for (const c of [...chans.values()]) stop(c.id, fade); }
/** 平滑切换 BGM：淡出上一首 + 淡入下一首（已在放同一首则不打断） */
export async function switchBgm(id: string, o: { volume?: number; fade?: number } = {}) {
  if (st.bgm === id && chans.has(id)) { if (o.volume != null) setVolume(id, o.volume); return true; }
  if (st.bgm) stop(st.bgm, o.fade);
  return start(id, o, true);
}
export function setVolume(id: string | undefined, v: number, fade = 0) {
  const c = chans.get(id || st.bgm || "");
  if (!c) return;
  window.clearInterval(c.vt);
  const from = c.mult, t0 = Date.now();
  if (!(fade > 0)) { c.mult = v; apply(c); return; }
  c.vt = window.setInterval(() => { const p = Math.min(1, (Date.now() - t0) / fade); c.mult = from + (v - from) * p; apply(c); if (p >= 1) window.clearInterval(c.vt); }, 40);
}
/** 外部（个人播放器）开播时让出 BGM 声道 */
export function yieldBgm() { if (st.bgm) stop(st.bgm, 300); }

/* —— 场景 BGM：地点 / RP 房间 / 皮肤。进入自动播放；离开到没有 BGM 的场景时停止由场景开的那首 —— */
let sceneBgm: string | null = null;
export function enterScene(id: string | undefined) {
  if (id && resolveAudio(id)) { sceneBgm = id; void switchBgm(id); return; }
  if (sceneBgm && st.bgm === sceneBgm) stop(sceneBgm);
  sceneBgm = null;
}

/* —— 执行触发器排进 sim.audioQ 的指令（按存档 + 序号去重，读档 / 重复落盘不会重放）—— */
const done = new Set<string>();
export function runAudioCmds(saveId: string, q: AudioCmd[] | undefined) {
  for (const c of q ?? []) {
    const k = `${saveId}:${c.n}`;
    if (done.has(k)) continue;
    done.add(k); if (done.size > 500) done.delete(done.values().next().value!);
    if (c.op === "play" && c.id) void play(c.id, c);
    else if (c.op === "switchBgm" && c.id) void switchBgm(c.id, c);
    else if (c.op === "stop" && c.id) stop(c.id, c.fade);
    else if (c.op === "stopAll") stopAll(c.fade);
    else if (c.op === "volume") setVolume(c.id, c.volume ?? 1, c.fade);
  }
}

/* —— 编辑器试听（不进声道、不发信号）—— */
let preview: HTMLAudioElement | null = null;
let previewId: string | null = null;
export async function previewAudio(id: string | null, src?: string, volume = 1) {
  preview?.pause(); preview = null;
  if (!id || previewId === id || !src) { previewId = null; emitUi(); return true; }
  const u = await playableSrc(src);
  if (!u) return false;
  preview = new Audio(u); preview.volume = Math.min(1, st.global * st.work * volume);
  preview.onended = () => { previewId = null; emitUi(); };
  previewId = id;
  try { await preview.play(); emitUi(); return true; } catch { previewId = null; emitUi(); return false; }
}
export const previewing = () => previewId;
