/* 桌面美化小组件：大字号时钟横幅 / 照片（可上传） / 便签 / 时钟 / 音乐迷你播放。
 * 组件与应用图标混排在主屏网格中，可拖动到任意位置，尺寸可在 小(2×2) / 大(整行) 间切换。 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { TRACKS, getPlayerState, subscribePlayer, togglePlay, nextTrack } from "./music";
import { IconPlay, IconImage, IconMusic } from "./icons";

const ls = {
  get(k: string, d: string) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

/* 大字号日期时钟横幅 —— 从固定顶栏解放出来，玩家可随意移动 / 移除 */
function HeroClockWidget() {
  const [now, setNow] = useState(new Date());
  // 只显示到分钟：每 15 秒探一次，分钟没变就返回原对象让 React 跳过重渲染。
  useEffect(() => {
    const t = setInterval(() => setNow((n) => {
      const d = new Date();
      return d.getMinutes() === n.getMinutes() && d.getHours() === n.getHours() ? n : d;
    }), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl px-1 text-center text-white drop-shadow">
      <p className="text-[15px] font-medium tracking-widest text-white/80">
        {now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
      </p>
      <p className="mt-0.5 text-7xl font-thin leading-none tabular-nums tracking-tight">
        {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
      </p>
    </div>
  );
}

/* 照片小组件：上传本地图片美化桌面 */
function PhotoWidget() {
  const [img, setImg] = useState(() => ls.get("star2005.widget.photo", ""));
  const [cap, setCap] = useState(() => ls.get("star2005.widget.photo.cap", "我的封面"));
  const pick = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { const url = String(r.result); setImg(url); ls.set("star2005.widget.photo", url); };
    r.readAsDataURL(f);
  };
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#232323] shadow-md">
      <label className="block h-full w-full cursor-pointer">
        <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {img ? (
          <img src={img} alt={cap} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-white/80">
            <IconImage size={26} /><span className="text-[11px]">点按上传照片</span>
          </span>
        )}
      </label>
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2.5 pb-2 pt-6">
        <input value={cap} onChange={(e) => { setCap(e.target.value); ls.set("star2005.widget.photo.cap", e.target.value); }}
          className="w-full bg-transparent text-[12px] font-semibold text-white outline-none" />
      </span>
    </div>
  );
}

/* 便签小组件 */
function NoteWidget() {
  const [text, setText] = useState(() => ls.get("star2005.widget.note", "今天也要闪闪发光 ✷\n· 09:00 定妆\n· 14:00 剧本围读"));
  return (
    <div className="h-full w-full overflow-hidden rounded-2xl bg-[#232323] p-3 shadow-md">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/80">便签</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); ls.set("star2005.widget.note", e.target.value); }}
        className="h-[calc(100%-1.2rem)] w-full resize-none bg-transparent text-[12.5px] leading-snug text-white outline-none placeholder:text-white/40" />
    </div>
  );
}

/* 时钟小组件 */
function ClockWidget() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-[#232323] p-3 text-white shadow-md">
      <p className="text-[11px] font-medium text-white/60">{now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}</p>
      <p className="text-[40px] font-thin tabular-nums leading-none">{String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}</p>
      <p className="text-[11px] tabular-nums text-white/50">星城 · {String(now.getSeconds()).padStart(2, "0")} 秒</p>
    </div>
  );
}

/* 音乐迷你小组件 */
function MusicWidget() {
  const { idx, playing } = useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
  const t = TRACKS[idx];
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#232323] text-white shadow-md">
      <img src={t.cover} alt="" className="absolute right-0 top-0 h-full w-full object-cover opacity-25" />
      <div className="relative flex h-full flex-col justify-between p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80"><IconMusic size={12} /> 正在播放</div>
        <div>
          <p className="truncate text-[14px] font-bold">{t.title}</p>
          <p className="truncate text-[11px] text-white/75">{t.artist}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black">{playing ? <span className="flex gap-0.5"><i className="block h-3 w-1 rounded-sm bg-black" /><i className="block h-3 w-1 rounded-sm bg-black" /></span> : <IconPlay size={16} />}</button>
          <button onClick={nextTrack} className="text-white/85 text-[18px]">⏭</button>
        </div>
      </div>
    </div>
  );
}

const WIDGETS: Record<string, () => ReactNode> = {
  "w-hero-clock": HeroClockWidget, "w-photo": PhotoWidget, "w-note": NoteWidget, "w-clock": ClockWidget, "w-music": MusicWidget,
};

export type WidgetSize = "sm" | "md" | "lg";
export type WidgetShape = "rounded" | "squircle" | "circle";
/* 默认尺寸：时钟横幅整行，其余方形 */
export const DEFAULT_WIDGET_SIZE: Record<string, WidgetSize> = { "w-hero-clock": "md" };
/* 形状 → 圆角值（作用于组件外层裁剪容器） */
export const SHAPE_RADIUS: Record<WidgetShape, string> = { rounded: "1rem", squircle: "34%", circle: "50%" };
export const SHAPE_LABEL: Record<WidgetShape, string> = { rounded: "圆角", squircle: "方圆", circle: "圆形" };
export const nextShape = (s: WidgetShape): WidgetShape => (s === "rounded" ? "squircle" : s === "squircle" ? "circle" : "rounded");
export const nextSize = (s: WidgetSize): WidgetSize => (s === "sm" ? "md" : s === "md" ? "lg" : "sm");
export const isWidget = (id: string) => id in WIDGETS;
export function renderWidget(id: string): ReactNode {
  const C = WIDGETS[id];
  return C ? <C /> : null;
}
