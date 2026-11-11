import type { ReactNode } from "react"
import { useGame } from "../store/gameCtx"
import type { DialogDiy } from "../lib/freeStyle"
import { SlotImage } from "./FreeStylePanel"

/* 美化 · 对话框 DIY：在「对话框样式」预设之上逐项微调；每项留空 = 跟随预设与皮肤。
 * 背景图 / 气泡底纹走 theme.free.imgs（与主题包一起导出）。 */
const chip = (on: boolean) =>
  `rounded-[6px] border px-2 py-1 text-[11.5px] transition ${
    on
      ? "border-jade bg-jade/10 font-bold text-jade"
      : "border-line bg-paper text-ink"
  }`
const Sec = ({ t, children }: { t: string; children: ReactNode }) => (
  <div className="rounded-xl border border-line bg-paper p-3">
    <p className="mb-2 text-[12px] font-bold tracking-[0.08em] text-ink">{t}</p>
    <div className="space-y-2.5">{children}</div>
  </div>
)

type Ctl = {
  d: DialogDiy
  set: (p: Partial<DialogDiy>) => void
  clr: (k: keyof DialogDiy) => void
}
function Color({
  c: { d, set, clr },
  k,
  label,
  fb = "#ffffff",
}: {
  c: Ctl
  k: "bg" | "border" | "text" | "textSoft" | "nameBg" | "nameText" | "bubbleBg" | "bubbleText" | "bubbleBorder" | "meBg" | "meText"
  label: string
  fb?: string
}) {
  return (
    <label
      className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${
        d[k] ? "border-jade/60 bg-jade/5" : "border-line bg-paper-2/50"
      }`}
    >
      <input
        type="color"
        value={d[k] ?? fb}
        onChange={(e) => set({ [k]: e.target.value })}
        className="h-5 w-5 shrink-0 cursor-pointer border-0 bg-transparent p-0"
        aria-label={label}
      />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">
        {label}
      </span>
      {d[k] ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            clr(k)
          }}
          className="text-[11px] text-ink-soft hover:text-danger"
          aria-label={`重置${label}`}
        >
          ×
        </button>
      ) : (
        <span className="text-[10px] text-ink-soft">默认</span>
      )}
    </label>
  )
}
function Range({
  c: { d, set, clr },
  k,
  label,
  min,
  max,
  step = 1,
  unit = "",
  dflt,
}: {
  c: Ctl
  k: "bgAlpha" | "blur" | "borderW" | "fontSize" | "lineHeight" | "letter" | "pad" | "bubbleRadius"
  label: string
  min: number
  max: number
  step?: number
  unit?: string
  dflt: number
}) {
  return (
    <div>
      <p className="mb-0.5 flex items-center justify-between text-[11.5px] text-ink">
        <span>{label}</span>
        <span className="flex items-center gap-1.5 tabular-nums text-ink-soft">
          {d[k] != null ? `${d[k]}${unit}` : "默认"}
          {d[k] != null && (
            <button
              type="button"
              onClick={() => clr(k)}
              className="hover:text-danger"
              aria-label={`重置${label}`}
            >
              ×
            </button>
          )}
        </span>
      </p>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={d[k] ?? dflt}
        onChange={(e) => set({ [k]: +e.target.value })}
        className="w-full accent-[var(--jade)]"
        aria-label={label}
      />
    </div>
  )
}

/* 对话框实时预览：与真实对话框同一套 class（样式预设 / 气泡头像 / DIY 共用） */
export function DialogPreview() {
  const { theme } = useGame()
  return (
      <div
        data-dstyle={theme.dialogStyle ?? "soft"}
        className="dialogue-panel relative overflow-hidden border border-line px-4 py-3 text-ink"
        style={{ borderRadius: theme.dialogRadius ?? 8 }}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <span className="dlg-nametag rounded-md bg-jade px-2.5 py-0.5 text-[12.5px] font-bold text-white shadow-sm">
            林导演
          </span>
          <span className="text-[11px] text-ink-soft">星城电影制片厂</span>
        </div>
        <p className="story-prose text-[15px] leading-[1.85] text-ink">
          「今晚的戏，就看你了。」
          <span className="text-ink-soft/75">（他把剧本递了过来）</span>
        </p>
        <div className="mt-2 flex items-end gap-2">
          <span className="dlg-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-jade to-coral text-[13px] font-semibold text-white shadow-sm ring-2 ring-white/70">林</span>
          <div className="dlg-bubble relative w-fit rounded-2xl rounded-bl-md border border-white/60 bg-white/70 px-3.5 py-2 text-[14px] leading-relaxed text-ink">
            台词气泡
          </div>
          <div className="dlg-bubble-me ml-auto rounded-2xl rounded-tr-sm bg-gradient-to-r from-[var(--jade)] to-[var(--coral)] px-3.5 py-2 text-[13.5px] font-medium text-white">
            我的气泡
          </div>
        </div>
      </div>

  )
}

export default function DialogDiyPanel() {
  const { theme, setTheme } = useGame()
  const d: DialogDiy = theme.dialogDiy ?? {}
  const set = (p: Partial<DialogDiy>) =>
    setTheme({ ...theme, dialogDiy: { ...d, on: true, ...p } })
  const clr = (k: keyof DialogDiy) => {
    const n = { ...d }
    delete n[k]
    setTheme({ ...theme, dialogDiy: n })
  }
  const c: Ctl = { d, set, clr }

  return (
    <div className="space-y-3 text-ink">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11.5px] text-ink-soft">
          在「样式预设」基础上逐项微调，没改的项跟随预设与皮肤。
        </p>
        <button
          role="switch"
          aria-checked={d.on !== false}
          aria-label="启用对话框 DIY"
          onClick={() =>
            setTheme({ ...theme, dialogDiy: { ...d, on: d.on === false } })
          }
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            d.on !== false ? "bg-jade" : "bg-line"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              d.on !== false ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <Sec t="底色与背景">
        <div className="grid grid-cols-2 gap-1.5">
          <Color c={c} k="bg" label="底色" />
        </div>
        <Range
          c={c}
          k="bgAlpha"
          label="不透明度"
          min={0}
          max={100}
          step={5}
          unit="%"
          dflt={100}
        />
        <Range
          c={c}
          k="blur"
          label="背景模糊"
          min={0}
          max={24}
          unit="px"
          dflt={0}
        />
        <div>
          <p className="mb-1 text-[11.5px] text-ink">背景图</p>
          <SlotImage slot="dialog" label="对话框背景图" />
        </div>
      </Sec>

      <Sec t="边框与阴影">
        <div className="grid grid-cols-2 gap-1.5">
          <Color c={c} k="border" label="边框色" fb="#cccccc" />
        </div>
        <Range
          c={c}
          k="borderW"
          label="边框粗细"
          min={0}
          max={6}
          unit="px"
          dflt={1}
        />
        <div className="flex flex-wrap gap-1.5">
          {([
            ["solid", "实线"],
            ["dashed", "虚线"],
            ["dotted", "点线"],
            ["double", "双线"],
            ["none", "无"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={d.borderStyle === v}
              onClick={() => set({ borderStyle: v })}
              className={chip(d.borderStyle === v)}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="self-center text-[11.5px] text-ink-soft">阴影</span>
          {([
            ["none", "无"],
            ["soft", "柔和"],
            ["strong", "浓重"],
            ["glow", "主色光晕"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={d.shadow === v}
              onClick={() => set({ shadow: v })}
              className={chip(d.shadow === v)}
            >
              {l}
            </button>
          ))}
        </div>
      </Sec>

      <Sec t="文字">
        <div className="grid grid-cols-2 gap-1.5">
          <Color c={c} k="text" label="正文色" fb="#333333" />
          <Color c={c} k="textSoft" label="次要色" fb="#888888" />
        </div>
        <Range
          c={c}
          k="fontSize"
          label="字号"
          min={12}
          max={22}
          unit="px"
          dflt={15}
        />
        <Range
          c={c}
          k="lineHeight"
          label="行距"
          min={1.3}
          max={2.4}
          step={0.05}
          dflt={1.85}
        />
        <Range
          c={c}
          k="letter"
          label="字间距"
          min={0}
          max={20}
          unit="%"
          dflt={0}
        />
        <Range
          c={c}
          k="pad"
          label="内边距"
          min={4}
          max={32}
          unit="px"
          dflt={12}
        />
      </Sec>

      <Sec t="名字牌">
        <div className="grid grid-cols-2 gap-1.5">
          <Color c={c} k="nameBg" label="底色" fb="#7c4dff" />
          <Color c={c} k="nameText" label="文字色" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ["tag", "标签"],
            ["pill", "胶囊"],
            ["underline", "下划线"],
            ["plain", "纯文字"],
          ] as const).map(([v, l]) => (
            <button
              key={v}
              aria-pressed={(d.nameShape ?? "tag") === v}
              onClick={() => set({ nameShape: v })}
              className={chip((d.nameShape ?? "tag") === v)}
            >
              {l}
            </button>
          ))}
        </div>
      </Sec>

      <Sec t="气泡">
        <div className="grid grid-cols-2 gap-1.5">
          <Color c={c} k="bubbleBg" label="台词气泡底色" />
          <Color c={c} k="bubbleText" label="台词气泡文字" fb="#333333" />
          <Color c={c} k="bubbleBorder" label="台词气泡边框" fb="#dddddd" />
          <Color c={c} k="meBg" label="我的气泡底色" fb="#7c4dff" />
          <Color c={c} k="meText" label="我的气泡文字" />
        </div>
        <Range
          c={c}
          k="bubbleRadius"
          label="气泡圆角"
          min={0}
          max={28}
          unit="px"
          dflt={16}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="mb-1 text-[11.5px] text-ink">台词气泡底纹</p><SlotImage slot="bubble" label="台词气泡底纹" /></div>
          <div><p className="mb-1 text-[11.5px] text-ink">我的气泡底纹</p><SlotImage slot="me" label="我的气泡底纹" /></div>
        </div>
      </Sec>

      <div className="flex justify-end">
        <button
          className={`${chip(false)} hover:!border-danger hover:!text-danger`}
          onClick={() => setTheme({ ...theme, dialogDiy: undefined })}
        >
          恢复默认
        </button>
      </div>
    </div>
  )
}
