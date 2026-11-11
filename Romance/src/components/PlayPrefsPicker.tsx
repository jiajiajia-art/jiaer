import type { PlayMode, PlayPrefs, Pov } from "../lib/types";

/* 游玩偏好：游玩模式（目前固定游戏模式）+ 叙事视角。
 * 建角页、游玩设置、编辑器共用；dense 用于编辑器里的紧凑版式。横竖屏暂不支持选择，固定竖屏。 */
const MODES: { v: PlayMode; l: string; d: string }[] = [
  { v: "game", l: "游戏模式", d: "正文适中 · 重选项与数值反馈" },
  { v: "novel", l: "剧情模式", d: "长篇连续叙事 · 少系统提示" },
];
const POVS: { v?: Pov; l: string; d: string }[] = [
  { v: undefined, l: "跟随世界观", d: "按世界观的叙事口吻" },
  { v: "1", l: "第一人称", d: "「我」走进场景" },
  { v: "2", l: "第二人称", d: "「你」走进场景" },
  { v: "3", l: "第三人称", d: "「她」走进场景" },
];

export default function PlayPrefsPicker({
  value,
  onChange,
  dense,
}: {
  value: PlayPrefs;
  onChange: (v: PlayPrefs) => void;
  dense?: boolean;
}) {
  const card = (on: boolean) =>
    `rounded-xl border px-2 text-left transition ${dense ? "py-1.5" : "py-2"} ${on ? "border-jade bg-jade/10 text-ink shadow-[0_4px_12px_-8px_var(--jade)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`;
  const head = "mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-soft";
  return (
    <div className="space-y-2.5">
      <div>
        <span className={head}>游玩模式</span>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="游玩模式">
          {MODES.map((m) => {
            // 功能注释：剧情模式暂未开放——固定游戏模式，剧情模式卡片锁定
            const locked = m.v === "novel";
            const on = !locked;
            return (
              <button key={m.v} type="button" role="radio" aria-checked={on} aria-disabled={locked} disabled={locked} onClick={() => onChange({ ...value, mode: "game" })} className={`${card(on)} ${locked ? "cursor-not-allowed opacity-55" : ""}`}>
                <span className={`flex items-center gap-1.5 text-[13px] font-bold ${on ? "text-jade" : "text-ink"}`}>
                  {m.l}
                  {locked && <span className="rounded-full bg-ink-soft/12 px-1.5 py-px text-[10px] font-semibold text-ink-soft">暂未开放</span>}
                </span>
                <span className="block text-[10.5px] leading-snug">{m.d}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <span className={head}>叙事视角</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="叙事视角">
          {POVS.map((p) => {
            const on = value.pov === p.v;
            return (
              <button key={p.l} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, pov: p.v })} className={card(on)}>
                <span className={`block text-[12.5px] font-bold ${on ? "text-jade" : "text-ink"}`}>{p.l}</span>
                <span className="block truncate text-[10.5px]">{p.d}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
