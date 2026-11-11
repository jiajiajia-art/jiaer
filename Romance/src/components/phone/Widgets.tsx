/* 桌面美化小组件：大字号时钟横幅 / 照片（可上传） / 便签 / 时钟 / 音乐迷你播放。
 * 组件与应用图标混排在主屏网格中，可拖动到任意位置，尺寸可在 小(2×2) / 大(整行) 间切换。 */
import { loadData, saveData } from "../../lib/saveScope";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { TRACKS, getPlayerState, subscribePlayer, togglePlay, nextTrack } from "./music";
import { IconPlay, IconImage, IconMusic } from "./icons";
import { IconSkipForward } from "../../lib/icons";
import { useGame } from "../../store/gameCtx";
import { gameNow } from "../../game/phone";
import { liveTerm as T } from "../../mods/live";
import { WalletWidget } from "./WalletBinder";

/* 游戏内「现在」：随游戏时间推进而变化（无游戏时退回现实时间） */
export function useGameNow(): Date {
  const { game } = useGame();
  return game ? gameNow(game) : new Date();
}

/* 统一的 iOS 毛玻璃小组件底板 */
const GLASS = "bg-white/16 ring-1 ring-inset ring-white/20 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150";

// 桌面小组件里的照片 / 便签是玩家在这一局写下的内容 → 存档私有
const ls = {
  get(k: string, d: string) { return loadData<string>(k, d); },
  set(k: string, v: string) { saveData(k, v); },
};

/* 大字号日期时钟横幅 —— 从固定顶栏解放出来，玩家可随意移动 / 移除 */
function HeroClockWidget() {
  const now = useGameNow();
  return (
    /* 功能注释：只用一层深色投影；避免 text-white/95 + 多层 shadow 在深壁纸上叠出「重影/白边字」 */
    <div className="[container-type:size] flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl px-1 text-center text-white">
      <p className="text-[min(15px,13cqh)] leading-tight font-semibold tracking-[0.12em] text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.45)]">
        {now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}
      </p>
      <p className="mt-[2cqh] text-[min(78px,58cqh,24cqw)] font-semibold leading-none tabular-nums tracking-[-0.03em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
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
    <div className={`relative h-full w-full overflow-hidden rounded-2xl ${GLASS}`}>
      <label className="block h-full w-full cursor-pointer">
        <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        {img ? (
          <img src={(img) || undefined} alt={cap} className="h-full w-full object-cover" />
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
  const [text, setText] = useState(() => ls.get("star2005.widget.note", "今天也要闪闪发光\n· 09:00 定妆\n· 14:00 剧本围读"));
  return (
    <div className="h-full w-full overflow-hidden rounded-2xl bg-[#fff6d6]/92 p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#c98a00]">便签</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); ls.set("star2005.widget.note", e.target.value); }}
        className="h-[calc(100%-1.2rem)] w-full resize-none bg-transparent text-[12.5px] leading-snug text-[#3a2f12] outline-none placeholder:text-black/30" />
    </div>
  );
}

/* 时钟小组件 */
function ClockWidget() {
  const now = useGameNow();
  return (
    <div className={`flex h-full w-full flex-col justify-between rounded-2xl p-3 text-white ${GLASS}`}>
      <p className="text-[11px] font-medium text-white/60">{now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}</p>
      <p className="text-[40px] font-thin tabular-nums leading-none">{String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}</p>
      <p className="text-[11px] tabular-nums text-white/50">{T("city")}时间</p>
    </div>
  );
}

/* 音乐迷你小组件 */
function MusicWidget() {
  const { idx, playing } = useSyncExternalStore(subscribePlayer, getPlayerState, getPlayerState);
  const t = TRACKS[idx];
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-black text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <img src={(t.cover) || undefined} alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-xl" />
      <div className="absolute inset-0 bg-black/25" />
      <div className="relative flex h-full flex-col justify-between p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/80"><IconMusic size={12} /> 正在播放</div>
        <div>
          <p className="truncate text-[14px] font-bold">{t.title}</p>
          <p className="truncate text-[11px] text-white/75">{t.artist}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-black">{playing ? <span className="flex gap-0.5"><i className="block h-3 w-1 rounded-sm bg-black" /><i className="block h-3 w-1 rounded-sm bg-black" /></span> : <IconPlay size={16} />}</button>
          <button onClick={nextTrack} className="text-white/85" aria-label="下一首"><IconSkipForward size={18} /></button>
        </div>
      </div>
    </div>
  );
}

const WIDGETS: Record<string, () => ReactNode> = {
  "w-hero-clock": HeroClockWidget, "w-photo": PhotoWidget, "w-note": NoteWidget, "w-clock": ClockWidget, "w-music": MusicWidget, "w-wallet": WalletWidget,
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
