/* 云音乐引擎：用 Web Audio 合成真实可听的旋律（原创曲、无版权素材）。 */

const N = {
  R: 0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0, B5: 987.77,
};
type Beat = [number, number]; // [频率, 拍数]

/* 每首曲子：主旋律 + 低音伴奏，节奏由 spb（每拍秒数）决定 */
export type Track = {
  id: string; title: string; artist: string; album: string; cover: string;
  color: string; color2: string; spb: number; lead: Beat[]; bass: Beat[]; lyric: string[];
};

const CV = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&h=400&fit=crop&auto=format&q=75`;

export const TRACKS: Track[] = [
  {
    id: "t1", title: "今夜她是主角", artist: "林望舒", album: "STARLIGHT 2005", color: "#3a1c5e", color2: "#c2467e",
    cover: CV("1470225620780-dba8ba36b745"), spb: 0.34,
    lead: [[N.E4,1],[N.G4,1],[N.A4,1],[N.C5,1],[N.B4,1],[N.A4,1],[N.G4,2],[N.E4,1],[N.G4,1],[N.C5,1],[N.D5,1],[N.E5,2],[N.D5,1],[N.C5,1],[N.A4,2],[N.G4,2]],
    bass: [[N.C4,2],[N.A4,2],[N.F4,2],[N.G4,2],[N.C4,2],[N.A4,2],[N.F4,2],[N.G4,2]],
    lyric: ["聚光灯亮起的那一刻", "全世界安静下来", "今夜 她就是主角", "把所有委屈唱成掌声"],
  },
  {
    id: "t2", title: "星河夜行", artist: "苏晚", album: "夜航班", color: "#0f2a4a", color2: "#2f9e8f",
    cover: CV("1500530855697-b586d89ba3ee"), spb: 0.30,
    lead: [[N.A4,1],[N.B4,1],[N.C5,2],[N.B4,1],[N.A4,1],[N.G4,2],[N.A4,1],[N.C5,1],[N.E5,2],[N.D5,1],[N.C5,1],[N.B4,2],[N.A4,4]],
    bass: [[N.A4,2],[N.E4,2],[N.F4,2],[N.G4,2],[N.A4,2],[N.E4,2],[N.F4,2],[N.G4,2]],
    lyric: ["末班的车厢空荡荡", "霓虹在窗外流淌", "我把梦想装进背包", "一路开往星河"],
  },
  {
    id: "t3", title: "散场以后", artist: "陈屿", album: "谢幕", color: "#3d2b1f", color2: "#d98c4a",
    cover: CV("1511671782779-c97d3d27a1d4"), spb: 0.38,
    lead: [[N.G4,2],[N.F4,1],[N.E4,1],[N.D4,2],[N.E4,1],[N.F4,1],[N.G4,2],[N.C5,2],[N.B4,1],[N.A4,1],[N.G4,4]],
    bass: [[N.C4,2],[N.G4,2],[N.A4,2],[N.F4,2],[N.C4,2],[N.G4,2],[N.C4,4]],
    lyric: ["灯光一盏盏熄灭", "掌声退成了潮汐", "散场以后的街角", "才是最真的自己"],
  },
  {
    id: "t4", title: "追光者", artist: "夜光合唱团", album: "逆光", color: "#4a0f2a", color2: "#f0a63a",
    cover: CV("1493225457124-a3eb161ffa5f"), spb: 0.28,
    lead: [[N.C5,1],[N.C5,1],[N.D5,1],[N.E5,2],[N.D5,1],[N.C5,1],[N.G4,2],[N.C5,1],[N.E5,1],[N.G5,2],[N.E5,1],[N.D5,1],[N.C5,4]],
    bass: [[N.C4,2],[N.E4,2],[N.G4,2],[N.C4,2],[N.F4,2],[N.G4,2],[N.C4,4]],
    lyric: ["我是追着光的人", "哪怕影子被拉得很长", "总有一天站上舞台", "成为别人的光"],
  },
];

/* —— 榜单（纯函数、与游戏无关）：调用方传入每首曲子的署名艺人，按名气排名 —— */
export type TrackArtist = { name: string; avatar?: string; fame: number; isPlayer?: boolean };
export type ChartRow = { track: Track; idx: number; artist: TrackArtist; rank: number };

/* artists[i] 对应 TRACKS[i] 的署名；按 fame 降序给出排名（含原始 idx，便于播放） */
export function rankTracks(artists: TrackArtist[]): ChartRow[] {
  return TRACKS.map((track, idx) => ({ track, idx, artist: artists[idx] ?? { name: track.artist, fame: 0 } }))
    .sort((a, b) => b.artist.fame - a.artist.fame)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/* 单例合成器 */
class Synth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  nodes: OscillatorNode[] = [];
  startAt = 0;
  duration = 0;

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private schedule(notes: Beat[], spb: number, type: OscillatorType, gain: number, start: number) {
    const ctx = this.ctx!, master = this.master!;
    let t = start;
    for (const [f, beats] of notes) {
      const d = beats * spb;
      if (f > 0) {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0008, t + d * 0.92);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + d);
        this.nodes.push(o);
      }
      t += d;
    }
    return t - start;
  }

  play(track: Track) {
    this.stop();
    const ctx = this.ensure();
    if (ctx.state === "suspended") ctx.resume();
    const start = ctx.currentTime + 0.06;
    this.startAt = start;
    const leadDur = this.schedule(track.lead, track.spb, "triangle", 0.9, start);
    this.schedule(track.bass, track.spb, "sine", 0.55, start);
    this.duration = leadDur;
  }
  pause() { this.ctx?.suspend(); }
  resume() { this.ctx?.resume(); }
  stop() { for (const o of this.nodes) { try { o.stop(); } catch { /* ignore */ } } this.nodes = []; }
  elapsed() { return this.ctx ? Math.min(this.duration, Math.max(0, this.ctx.currentTime - this.startAt)) : 0; }
  get running() { return this.ctx?.state === "running"; }
}

let _synth: Synth | null = null;
export function getSynth() { return (_synth ??= new Synth()); }

/* —— 全局播放状态（App 与桌面小组件共享） —— */
type PlayerState = { idx: number; playing: boolean };
let state: PlayerState = { idx: 0, playing: false };
const listeners = new Set<() => void>();
function emit() { state = { ...state }; listeners.forEach((f) => f()); }

export function getPlayerState() { return state; }
export function subscribePlayer(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function playIdx(i: number) { getSynth().play(TRACKS[i]); state = { idx: i, playing: true }; emit(); }
export function togglePlay() {
  const s = getSynth();
  if (state.playing) { s.pause(); state = { ...state, playing: false }; }
  else { if (s.elapsed() > 0 && s.duration > 0) s.resume(); else s.play(TRACKS[state.idx]); state = { ...state, playing: true }; }
  emit();
}
export function nextTrack() { playIdx((state.idx + 1) % TRACKS.length); }
export function prevTrack() { playIdx((state.idx - 1 + TRACKS.length) % TRACKS.length); }
export function markEnded() { nextTrack(); }
