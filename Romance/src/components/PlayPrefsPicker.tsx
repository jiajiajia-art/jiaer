import type { PlayMode, PlayPrefs, Pov } from "../lib/types";

/* 游玩偏好：游玩模式（游戏 / 小说）+ 叙事视角 + 可选屏幕方向（建角页）。
 * 建角页、游玩设置、编辑器共用；dense 用于编辑器里的紧凑版式；
 * showOrient 仅建角展示——局内改方向走「游戏设置 → 屏幕方向」，避免重复。 */
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
const ORIENTS: { v: "landscape" | "portrait"; l: string; d: string; box: string; ratio: string }[] = [
  { v: "landscape", l: "横屏", d: "16:9 等宽屏比例游戏", box: "h-5 w-8", ratio: "h-12 w-20" },
  { v: "portrait", l: "竖屏", d: "9:16 等竖向比例游戏", box: "h-8 w-5", ratio: "h-20 w-12" },
];

export default function PlayPrefsPicker({
  value,
  onChange,
  dense,
  showOrient = false,
}: {
  value: PlayPrefs;
  onChange: (v: PlayPrefs) => void;
  dense?: boolean;
  /** 功能注释：建角第二步展示横竖屏；局内设置用独立「屏幕方向」入口，此处默认隐藏 */
  showOrient?: boolean;
}) {
  const card = (on: boolean) =>
    `rounded-xl border px-2 text-left transition ${dense ? "py-1.5" : "py-2"} ${on ? "border-jade bg-jade/10 text-ink shadow-[0_4px_12px_-8px_var(--jade)]" : "border-line bg-paper text-ink-soft hover:border-jade/60"}`;
  const head = "mb-1 block text-[11px] font-bold tracking-[0.12em] text-ink-soft";
  return (
    <div className="space-y-2.5">
      {showOrient && (
        <div>
          <span className={head}>屏幕方向</span>
          <p className="mb-1.5 text-[11px] leading-snug text-ink-soft">开局按所选方向显示；之后可在游戏设置里随时切换。</p>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="屏幕方向">
            {ORIENTS.map((op) => {
              const on = (value.orient ?? "portrait") === op.v;
              return (
                <button key={op.v} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, orient: op.v })} className={`${card(on)} flex flex-col items-center text-center`}>
                  <span className={`mb-1.5 flex ${op.ratio} items-center justify-center rounded-lg border-2 ${on ? "border-jade bg-jade/15 text-jade" : "border-line bg-paper text-ink-soft"}`}>
                    <span className={`rounded-[3px] border-2 border-current ${op.box}`} aria-hidden />
                  </span>
                  <span className={`block text-[13px] font-bold ${on ? "text-jade" : "text-ink"}`}>{op.l}</span>
                  <span className="block text-[10.5px] leading-snug">{op.d}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <span className={head}>游玩模式</span>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="游玩模式">
          {MODES.map((m) => {
            const on = (value.mode ?? "game") === m.v;
            return (
              <button key={m.v} type="button" role="radio" aria-checked={on} onClick={() => onChange({ ...value, mode: m.v })} className={card(on)}>
                <span className={`block text-[13px] font-bold ${on ? "text-jade" : "text-ink"}`}>{m.l}</span>
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
