import { useState } from "react";
import { useGame } from "../store/gameCtx";
import type { IconDiy } from "../lib/store";
import { GLYPHS, ICON_SLOTS } from "../lib/iconGlyphs";
import DiyIcon from "./DiyIcon";
import ImagePicker from "./ImagePicker";
import { IconSlot } from "./NavStylePanel";
import { SceneSpot, type Spot } from "./HomeTab";
import { useConfirm } from "./EditorKit";
import { IconFlag, IconMenu } from "../lib/icons";

/* 美化 · 图标与按钮：全局图标颜色 / 线宽 / 大小 · 圆按钮外形与填充 · 场景点位样式 · 逐个图标换图或换内置图标 */
const chip = (on: boolean) => `rounded-[6px] border px-2 py-1.5 text-[12px] transition ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;
const H = ({ t, d }: { t: string; d?: string }) => <p className="mb-1.5 mt-4 flex items-baseline gap-2 text-[12.5px] font-bold text-ink">{t}{d && <span className="text-[10.5px] font-normal text-ink-soft">{d}</span>}</p>;
function Opt<T extends string>({ value, opts, onPick }: { value?: T; opts: readonly (readonly [T, string])[]; onPick: (v: T) => void }) {
  return <div className="flex flex-wrap gap-1.5">{opts.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={chip(value === v)}>{l}</button>)}</div>;
}

const SPOTS = [["glint", "细小亮光"], ["dot", "小圆点"], ["glow", "呼吸光点"], ["ring", "光环"], ["star", "星星"], ["heart", "爱心"], ["diamond", "钻石"], ["sparkle", "闪光"], ["flower", "小花"], ["img", "自定义图片"]] as const;
const DEMO: Spot[] = [
  { key: "a", label: "查看新人资源", glyph: "", tone: "explore", onClick: () => {} },
  { key: "b", label: "通告公告栏", glyph: "", tone: "act", onClick: () => {} },
  { key: "c", label: "神秘来信", glyph: "", tone: "event", onClick: () => {} },
  { key: "d", label: "新人工牌", glyph: "", tone: "item", onClick: () => {} },
];

/* 内置图标选择浮层 */
function GlyphPick({ value, onPick }: { value?: string; onPick: (g?: string) => void }) {
  const [open, setOpen] = useState(false);
  const G = value ? GLYPHS[value] : undefined;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="换内置图标"
        className={`grid h-10 w-10 place-items-center rounded-lg border bg-paper-2 text-[10px] transition ${value ? "border-jade/60 text-jade" : "border-dashed border-line text-ink-soft hover:border-jade"}`}>
        {G ? <G.C width={20} height={20} /> : "图标"}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-64 rounded-xl border border-line bg-paper p-2 shadow-xl">
          <div className="mb-1.5 flex items-center gap-1">
            <span className="text-[11px] font-bold text-ink-soft">内置图标 · {Object.keys(GLYPHS).length}</span>
            {value && <button type="button" className={`${chip(false)} ml-auto !py-0.5`} onClick={() => { onPick(undefined); setOpen(false); }}>用原图标</button>}
            <button type="button" className={`${chip(false)} !py-0.5 ${value ? "" : "ml-auto"}`} onClick={() => setOpen(false)}>关闭</button>
          </div>
          <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
            {Object.entries(GLYPHS).map(([id, g]) => (
              <button key={id} type="button" title={g.label} aria-label={g.label} onClick={() => { onPick(id); setOpen(false); }}
                className={`grid aspect-square place-items-center rounded-lg border transition ${value === id ? "border-jade bg-jade/15 text-jade" : "border-line text-ink hover:border-jade hover:text-jade"}`}>
                <g.C width={18} height={18} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IconDiyPanel() {
  const { theme, setTheme } = useGame();
  const [confirm, confirmEl] = useConfirm();
  const d: IconDiy = theme.icons ?? {};
  const set = (p: Partial<IconDiy>) => {
    const n: IconDiy = { ...d, ...p };
    for (const k of Object.keys(n) as (keyof IconDiy)[]) if (n[k] === undefined) delete n[k];
    setTheme({ ...theme, icons: Object.keys(n).length ? n : undefined });
  };
  const setMap = (k: "imgs" | "glyphs", id: string, v?: string) => {
    const m = { ...(d[k] ?? {}) };
    if (v) m[id] = v; else delete m[id];
    set({ [k]: Object.keys(m).length ? m : undefined });
  };
  const color = (k: "color" | "btnColor" | "spotColor", label: string) => (
    <label className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${d[k] ? "border-jade/60 bg-jade/5" : "border-line bg-paper"}`}>
      <input type="color" value={d[k] ?? "#c0508a"} onChange={(e) => set({ [k]: e.target.value })} className="h-6 w-6 shrink-0 cursor-pointer border-0 bg-transparent p-0" aria-label={label} />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{label}</span>
      {d[k] ? <button type="button" onClick={(e) => { e.preventDefault(); set({ [k]: undefined }); }} className="text-[11px] text-ink-soft hover:text-danger" aria-label={`重置${label}`}>×</button> : <span className="text-[10px] text-ink-soft">默认</span>}
    </label>
  );
  const changed = Object.keys(d.imgs ?? {}).length + Object.keys(d.glyphs ?? {}).length;

  return (
    <div className="text-ink">
      {confirmEl}
      {/* 实时预览：与主界面同一套 class / 组件 */}
      <div className="relative overflow-hidden rounded-2xl border border-line">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-jade/70 via-coral/50 to-gold/50" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
        <div className="relative space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="ui-glass flex items-center gap-2 px-3 py-1.5 text-ink">
              <DiyIcon slot="scene.loc" size={16}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg></DiyIcon>
              <span className="font-serif text-[13px] font-black">启星事务所</span>
            </span>
            <span className="flex gap-1.5">
              <span className="diy-btn flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/60 bg-gradient-to-br from-paper/95 to-jade/15 text-[17px] text-jade-deep shadow-sm backdrop-blur-md"><DiyIcon slot="top.flag" size={18}><IconFlag size={18} /></DiyIcon></span>
              <span className="diy-btn flex h-10 w-10 items-center justify-center rounded-[8px] bg-gradient-to-br from-jade to-coral text-[18px] font-bold text-white shadow-[0_6px_16px_-8px_var(--coral)]"><DiyIcon slot="top.menu" size={19}><IconMenu size={18} /></DiyIcon></span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2.5 py-2">
            {DEMO.map((sp, i) => <SceneSpot key={sp.key} spot={sp} active={false} index={i} />)}
          </div>
          <div className="flex items-center gap-2">
            <span className="action-capsule flex flex-1 items-center gap-2 rounded-[8px] border border-line p-1 backdrop-blur-xl">
              <span className="flex h-7 w-7 items-center justify-center text-jade/80"><DiyIcon slot="input.pen" size={15}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L3 12.5V21h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></svg></DiyIcon></span>
              <span className="flex-1 truncate text-[11.5px] text-ink-soft/70">写下你的行动……</span>
              <span className="send-btn diy-btn flex h-7 w-7 items-center justify-center rounded-[6px] text-white"><DiyIcon slot="input.send" size={14}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 1z" /></svg></DiyIcon></span>
            </span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--coral)] to-[var(--jade)] text-white shadow-lg">
              <DiyIcon slot="adv.arrow" size={16}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h12M13 6l6 6-6 6" /></svg></DiyIcon>
            </span>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-soft">预览与主界面同步；底栏五个牌位的图标在「底栏选中态」里单独换。</p>

      <H t="图标整体" d="作用于顶栏、地点卡、输入框、推进、菜单里的图标" />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{color("color", "图标颜色")}</div>
      <p className="mb-1 mt-2.5 flex items-center justify-between text-[12px] font-bold text-ink">线条粗细 <span className="tabular-nums text-ink-soft">{d.stroke ?? "默认"}</span></p>
      <div className="flex items-center gap-2">
        <input type="range" min={1} max={3} step={0.2} value={d.stroke ?? 2} onChange={(e) => set({ stroke: +e.target.value })} className="min-w-0 flex-1 accent-[var(--jade)]" aria-label="线条粗细" />
        {d.stroke != null && <button type="button" className={chip(false)} onClick={() => set({ stroke: undefined })}>默认</button>}
      </div>
      <p className="mb-1 mt-2.5 flex items-center justify-between text-[12px] font-bold text-ink">图标大小 <span className="tabular-nums text-ink-soft">{d.scale ?? 100}%</span></p>
      <input type="range" min={70} max={150} step={5} value={d.scale ?? 100} onChange={(e) => set({ scale: +e.target.value === 100 ? undefined : +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="图标大小" />

      <H t="圆按钮外形" d="右上角待办 / 菜单、发送按钮" />
      <Opt value={d.btnShape ?? "rounded"} onPick={(v) => set({ btnShape: v === "rounded" ? undefined : v })} opts={[["rounded", "圆角方"], ["circle", "圆形"], ["square", "直角"], ["petal", "花瓣"]] as const} />
      <p className="mb-1.5 mt-2.5 text-[12px] font-bold text-ink">填充</p>
      <Opt value={d.btnFill} onPick={(v) => set({ btnFill: d.btnFill === v ? undefined : v })} opts={[["glass", "毛玻璃"], ["gradient", "渐变"], ["solid", "实色"], ["outline", "描边"]] as const} />
      <p className="mt-1 text-[10.5px] text-ink-soft">再点一次已选项恢复原样式。</p>
      {(d.btnFill === "solid" || d.btnFill === "outline" || d.btnFill === "gradient") && <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">{color("btnColor", "按钮颜色")}</div>}

      <H t="场景点位" d="场景图上那些可点的闪光标记" />
      <Opt value={d.spot ?? "glint"} onPick={(v) => set({ spot: v === "glint" ? undefined : v })} opts={SPOTS} />
      {d.spot === "img" && <div className="mt-2"><ImagePicker value={d.spotImg} label="点位图" max={160} onChange={(u) => set({ spotImg: u })} hint="建议透明底 PNG，如小星星、爱心贴纸" /></div>}
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">{color("spotColor", "点位颜色（缺省按类型着色）")}</div>
      <p className="mb-1 mt-2.5 flex items-center justify-between text-[12px] font-bold text-ink">点位大小 <span className="tabular-nums text-ink-soft">{d.spotSize ?? "自动"}{d.spotSize ? "px" : ""}</span></p>
      <input type="range" min={8} max={28} step={1} value={d.spotSize ?? 14} onChange={(e) => set({ spotSize: +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="点位大小" />
      <p className="mb-1.5 mt-2.5 text-[12px] font-bold text-ink">点位名牌</p>
      <Opt value={d.spotLabel ?? "dark"} onPick={(v) => set({ spotLabel: v === "dark" ? undefined : v })} opts={[["dark", "深色"], ["light", "浅色"], ["accent", "主色"], ["outline", "描边"], ["hidden", "只显示标记"]] as const} />

      <H t="逐个换图标" d={`每个位置可换内置图标，或上传图片（图片优先）${changed ? ` · 已改 ${changed} 处` : ""}`} />
      {(["main", "menu"] as const).map((g) => (
        <div key={g} className="mb-2 space-y-1.5">
          <p className="text-[11px] font-bold tracking-[0.14em] text-ink-soft">{g === "main" ? "主界面" : "菜单"}</p>
          {ICON_SLOTS.filter((x) => x.group === g).map((x) => (
            <div key={x.id} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-jade/15 to-coral/15 text-jade-deep"><DiyIcon slot={x.id} size={17}><span className="text-[10px] text-ink-soft">原</span></DiyIcon></span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{x.label}</span>
              <GlyphPick value={d.glyphs?.[x.id]} onPick={(v) => setMap("glyphs", x.id, v)} />
              <IconSlot src={d.imgs?.[x.id]} label="图片" onSet={(u) => setMap("imgs", x.id, u)} />
            </div>
          ))}
        </div>
      ))}

      <div className="mt-4 flex justify-end">
        <button type="button" className={`${chip(false)} hover:!border-danger hover:!text-danger`} onClick={async () => { if (await confirm("把图标与按钮恢复为默认？", { ok: "恢复默认" })) setTheme({ ...theme, icons: undefined }); }}>恢复默认</button>
      </div>
    </div>
  );
}
