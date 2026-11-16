import type { PlayMode, PlayPrefs, Pov } from "../lib/types";

/* 游玩偏好：游玩模式（目前固定剧情模式，游戏模式暂未开放）+ 叙事视角。
 * 建角页不传 showOrient（开局固定竖屏）；局内设置可选手方向。dense 用于编辑器紧凑版式。 */
const MODES: { v: PlayMode; l: string }[] = [
  { v: "game", l: "游戏模式" },
  { v: "novel", l: "剧情模式" },
];
const POVS: { v?: Pov; l: string }[] = [
  { v: undefined, l: "跟随世界观" },
  { v: "1", l: "第一人称" },
  { v: "2", l: "第二人称" },
  { v: "3", l: "第三人称" },
];
const ORIENTS: { v: "portrait" | "landscape"; l: string; d: string }[] = [
  { v: "portrait", l: "竖屏", d: "9:16 手机" },
  { v: "landscape", l: "横屏", d: "宽屏" },
];

export default function PlayPrefsPicker({
  value,
  onChange,
  dense,
  showOrient,
}: {
  value: PlayPrefs;
  onChange: (v: PlayPrefs) => void;
  dense?: boolean;
  /** 功能注释：建角不传；只有明确要选手方向的入口才打开 */
  showOrient?: boolean;
}) {
  const card = (on: boolean) =>
    `rounded-xl border px-2.5 text-left transition ${dense ? "py-1.5" : "py-2"} ${on ? "border-jade bg-jade/10 text-ink" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`;
  const head = "mb-1.5 block text-[11px] font-semibold text-ink-soft";
  return (
    <div className="space-y-3">
      <div>
        <span className={head}>游玩模式</span>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="游玩模式">
          {MODES.map((m) => {
            // 功能注释：游戏模式暂未开放——固定剧情模式，游戏模式卡片锁定
            const locked = m.v === "game";
            const on = !locked;
            return (
              <button key={m.v} type="button" role="radio" aria-checked={on} aria-disabled={locked} disabled={locked} onClick={() => onChange({ ...value, mode: "novel" })} className={`${card(on)} ${locked ? "cursor-not-allowed opacity-55" : ""}`}>
                <span className={`flex items-center gap-1.5 text-[13px] font-bold ${on ? "text-jade" : "text-ink"}`}>
                  {m.l}
                  {locked && <span className="rounded-full bg-ink-soft/12 px-1.5 py-px text-[10px] font-semibold text-ink-soft">未开放</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className={head}>叙事视角</span>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="叙事视角">
          {POVS.map((p) => {
            const on = value.pov === p.v;
            return (
              <button key={p.l} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, pov: p.v })} className={card(on)}>
                <span className={`block text-[12.5px] font-bold ${on ? "text-jade" : "text-ink"}`}>{p.l}</span>
              </button>
            );
          })}
        </div>
      </div>
      {showOrient && (
        <div>
          <span className={head}>屏幕方向</span>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="屏幕方向">
            {ORIENTS.map((o) => {
              const on = (value.orient ?? "portrait") === o.v;
              return (
                <button key={o.v} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, orient: o.v })} className={card(on)}>
                  <span className={`block text-[12.5px] font-bold ${on ? "text-jade" : "text-ink"}`}>{o.l}</span>
                  <span className="block truncate text-[10.5px]">{o.d}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
