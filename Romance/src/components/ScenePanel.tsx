import ImagePicker from "./ImagePicker";
import { useGame } from "../store/gameCtx";
import type { ThemePref } from "../lib/store";

/* 设置 · 场景背景与立绘：自定义背景 / 遮罩浓度 / 模糊 / 滤镜 / 对话立绘。
 * 全部走 ThemePref → <html> 变量，主界面实时生效，也会被打进美化主题包。 */
const TONES: [NonNullable<ThemePref["sceneTone"]>, string][] = [["none", "原色"], ["warm", "暖阳"], ["cool", "清冷"], ["dusk", "黄昏"], ["vintage", "旧胶片"], ["mono", "黑白"]];
// 只有两种模式；旧值 "stage" 视为立绘模式
const PORTRAITS: [NonNullable<ThemePref["portrait"]>, string, string][] = [["side", "立绘模式", "逐句播放 · 立绘在人物资料里上传"], ["off", "纯文字模式", "整段显示 · 不用立绘"]];

export default function ScenePanel() {
  const { theme, setTheme } = useGame();
  const set = (p: Partial<ThemePref>) => setTheme({ ...theme, ...p });
  const dim = theme.sceneDim ?? 45, blur = theme.sceneBlur ?? 0;
  const chip = (on: boolean) => `rounded-[6px] border py-1.5 text-[12px] transition ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`;
  const label = "mb-1 mt-3 flex items-center justify-between text-[12px] font-bold text-ink";

  return (
    <div>
      {/* 预览：复用主界面的 scene-* class */}
      <div className="relative h-28 overflow-hidden rounded-xl border border-line bg-jade-deep/80">
        {theme.sceneBg
          ? <img src={theme.sceneBg} alt="" className="scene-img absolute inset-0 h-full w-full object-cover" />
          : <div className="scene-img absolute inset-0 bg-gradient-to-br from-jade via-coral/70 to-gold/60" />}
        <div className="scene-dim absolute inset-0 bg-black" />
        <div className="scene-shade absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80" />
        <p className="absolute bottom-2 left-3 font-serif text-[15px] font-black text-white [text-shadow:0_1px_8px_rgba(0,0,0,.7)]">{theme.sceneBg ? "自定义背景" : "地点原图"}</p>
      </div>

      <p className={label}>自定义背景</p>
      <ImagePicker value={theme.sceneBg} label="场景背景" onChange={(u) => set({ sceneBg: u })} hint="剧情里指定的场景图仍优先；清除后恢复地点原图" />

      <p className={label}>遮罩浓度 <span className="tabular-nums text-ink-soft">{dim}%</span></p>
      <input type="range" min={0} max={90} step={5} value={dim} onChange={(e) => set({ sceneDim: +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="遮罩浓度" />
      <p className={label}>背景模糊 <span className="tabular-nums text-ink-soft">{blur}px</span></p>
      <input type="range" min={0} max={12} step={1} value={blur} onChange={(e) => set({ sceneBlur: +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="背景模糊" />

      <p className={label}>色调滤镜</p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {TONES.map(([v, l]) => <button key={v} aria-pressed={(theme.sceneTone ?? "none") === v} onClick={() => set({ sceneTone: v })} className={chip((theme.sceneTone ?? "none") === v)}>{l}</button>)}
      </div>

      <p className={label}>对话模式 <span className="text-[10.5px] font-normal text-ink-soft">剧情的显示方式</span></p>
      <div className="grid grid-cols-2 gap-1.5">
        {PORTRAITS.map(([v, l, d]) => {
          const on = ((theme.portrait ?? "side") === "off" ? "off" : "side") === v;
          return (
            <button key={v} aria-pressed={on} onClick={() => set({ portrait: v })} className={`${chip(on)} px-2 text-left`}>
              <span className="block text-center">{l}</span>
              <span className={`block truncate text-center text-[10px] font-normal ${on ? "text-jade/80" : "text-ink-soft"}`}>{d}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
