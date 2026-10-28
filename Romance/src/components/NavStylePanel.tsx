import { useRef, useState } from "react";
import { useGame } from "../store/gameCtx";
import type { NavActiveStyle } from "../lib/store";
import { NavGlyph, navPool } from "./MudChrome";
import { compressImage, loadAssets } from "../lib/freeStyle";
import ImagePicker from "./ImagePicker";

/* 美化 · 底栏选中态：底衬形状 / 填充 / 颜色 / 动效 / 底衬贴图 / 每个牌位的自定义图标 */
const chip = (on: boolean) => `rounded-[6px] border px-2 py-1.5 text-[12px] transition ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink"}`;
const H = ({ t, d }: { t: string; d?: string }) => <p className="mb-1.5 mt-4 flex items-baseline gap-2 text-[12.5px] font-bold text-ink">{t}{d && <span className="text-[10.5px] font-normal text-ink-soft">{d}</span>}</p>;

function Opt<T extends string>({ value, opts, onPick }: { value: T; opts: readonly (readonly [T, string])[]; onPick: (v: T) => void }) {
  return <div className="flex flex-wrap gap-1.5">{opts.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onPick(v)} className={chip(value === v)}>{l}</button>)}</div>;
}

/* 图标位：从素材库选 / 上传（压成 128px）/ 清除 */
export function IconSlot({ src, label, onSet }: { src?: string; label: string; onSet: (u?: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState(false);
  const assets = loadAssets();
  return (
    <div className="relative">
      <button onClick={() => setPick((v) => !v)} aria-label={`${label}图标`}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg border border-dashed border-line bg-paper-2 text-[10px] text-ink-soft hover:border-jade">
        {src ? <img src={src} alt="" className="h-7 w-7 object-contain" /> : label}
      </button>
      {pick && (
        <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-line bg-paper p-2 shadow-xl">
          <div className="mb-1.5 flex gap-1">
            <button className={chip(false)} onClick={() => ref.current?.click()}>上传</button>
            {src && <button className={chip(false)} onClick={() => { onSet(undefined); setPick(false); }}>清除</button>}
            <button className={`${chip(false)} ml-auto`} onClick={() => setPick(false)}>关闭</button>
          </div>
          {assets.length ? (
            <div className="grid max-h-40 grid-cols-5 gap-1 overflow-y-auto">
              {assets.map((a) => <button key={a.id} onClick={() => { onSet(a.url); setPick(false); }} className="aspect-square overflow-hidden rounded border border-line"><img src={a.url} alt={a.name} className="h-full w-full object-cover" /></button>)}
            </div>
          ) : <p className="text-[11px] text-ink-soft">素材库为空，可直接上传，或在「素材与代码 · 素材库」批量添加。</p>}
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { onSet(await compressImage(f, 128, 0.9)); setPick(false); } }} />
        </div>
      )}
    </div>
  );
}

export default function NavStylePanel() {
  const { theme, setTheme } = useGame();
  const n: NavActiveStyle = theme.navActive ?? {};
  const set = (p: Partial<NavActiveStyle>) => setTheme({ ...theme, navActive: { ...n, ...p } });
  const pool = navPool();
  const [cur, setCur] = useState(pool[1]?.id ?? pool[0]?.id);
  const setIcon = (id: string, k: "on" | "off", u?: string) => set({ icons: { ...(n.icons ?? {}), [id]: { ...(n.icons?.[id] ?? {}), [k]: u } } });
  const color = (k: "color" | "iconColor" | "labelColor", label: string) => (
    <label className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${n[k] ? "border-jade/60 bg-jade/5" : "border-line bg-paper"}`}>
      <input type="color" value={n[k] ?? "#a855f7"} onChange={(e) => set({ [k]: e.target.value })} className="h-6 w-6 shrink-0 cursor-pointer border-0 bg-transparent p-0" aria-label={label} />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink">{label}</span>
      {n[k] ? <button type="button" onClick={(e) => { e.preventDefault(); set({ [k]: undefined }); }} className="text-[11px] text-ink-soft hover:text-danger" aria-label={`重置${label}`}>×</button> : <span className="text-[10px] text-ink-soft">默认</span>}
    </label>
  );

  return (
    <div className="text-ink">
      {/* 预览：与真实底栏同一套 class，点一下切换选中 */}
      <div className="flex rounded-2xl border border-line bg-paper-2/90 px-1 py-1 shadow-inner">
        {pool.slice(0, 5).map((p) => {
          const active = cur === p.id;
          const ic = n.icons?.[p.id];
          const src = active ? ic?.on || ic?.off : ic?.off || ic?.on;
          const sz = n.iconSize ?? (src ? 24 : 20);
          return (
            <button key={`${p.id}-${active ? JSON.stringify(n) : ""}`} onClick={() => setCur(p.id)} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-2 pt-2 ${active ? "text-jade-deep" : "text-ink-soft"}`}>
              <span className="relative grid h-7 w-12 place-items-center">
                <span className={`nav-hl pointer-events-none absolute inset-0 rounded-full transition-all duration-300 ${active ? "nav-hl-on nav-pill bg-gradient-to-r from-jade/22 to-coral/18 opacity-100 shadow-[0_0_14px_-3px_var(--crystal-glow)]" : "scale-75 opacity-0"}`} />
                <span className={`nav-ico relative grid place-items-center ${active ? "nav-ico-on" : ""}`}>
                  {src ? <img src={src} alt="" style={{ width: sz, height: sz }} className={`object-contain ${active || ic?.off ? "" : "opacity-60 grayscale"}`} /> : <NavGlyph name={p.glyph} active={active} size={sz} />}
                </span>
              </span>
              <span className={`nav-txt truncate text-[11px] leading-none ${active ? "nav-txt-on font-bold text-jade-deep" : "font-medium"}`}>{p.label}</span>
            </button>
          );
        })}
      </div>

      <H t="底衬形状" />
      <Opt value={n.shape ?? "pill"} onPick={(v) => set({ shape: v })} opts={[["pill", "胶囊"], ["circle", "圆形"], ["square", "圆角方"], ["underline", "下划线"], ["dot", "小圆点"], ["none", "无底衬"]] as const} />
      <H t="底衬填充" />
      <Opt value={n.fill ?? "gradient"} onPick={(v) => set({ fill: v })} opts={[["gradient", "渐变柔光"], ["solid", "实色"], ["outline", "描边"], ["glass", "毛玻璃"]] as const} />
      <H t="选中动效" />
      <Opt value={n.anim ?? "pop"} onPick={(v) => set({ anim: v })} opts={[["pop", "弹跳一下"], ["bounce", "持续轻跳"], ["float", "上浮放大"], ["glow", "呼吸发光"], ["none", "无"]] as const} />
      <label className="mt-2 flex items-center gap-2 text-[12px] text-ink">
        <input type="checkbox" checked={n.ripple !== false} onChange={(e) => set({ ripple: e.target.checked })} className="accent-[var(--jade)]" /> 点击时扩散光晕
      </label>

      <H t="颜色" d="不设则跟随皮肤" />
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {color("color", "底衬色")}{color("iconColor", "选中图标色")}{color("labelColor", "选中文字色")}
      </div>

      <H t="底衬贴图" d="用一张图代替底衬，如贴纸、光斑" />
      <ImagePicker value={n.bgImg} label="底衬贴图" max={400} onChange={(u) => set({ bgImg: u })} hint="形状仍按上方「底衬形状」裁切" />

      <H t="自定义图标" d="每个按钮可设「选中 / 未选中」两张，只设一张则两态共用" />
      <div className="space-y-1.5">
        {pool.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-paper px-2.5 py-1.5">
            <span className="grid h-8 w-8 place-items-center text-ink-soft"><NavGlyph name={p.glyph} active={false} /></span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{p.label}</span>
            <IconSlot src={n.icons?.[p.id]?.off} label="未选" onSet={(u) => setIcon(p.id, "off", u)} />
            <IconSlot src={n.icons?.[p.id]?.on} label="选中" onSet={(u) => setIcon(p.id, "on", u)} />
          </div>
        ))}
      </div>
      <p className="mb-1 mt-3 flex items-center justify-between text-[12px] font-bold text-ink">图标尺寸 <span className="tabular-nums text-ink-soft">{n.iconSize ?? "自动"}{n.iconSize ? "px" : ""}</span></p>
      <input type="range" min={16} max={32} step={1} value={n.iconSize ?? 20} onChange={(e) => set({ iconSize: +e.target.value })} className="w-full accent-[var(--jade)]" aria-label="图标尺寸" />

      <div className="mt-4 flex justify-end">
        <button className={`${chip(false)} hover:!border-danger hover:!text-danger`} onClick={() => setTheme({ ...theme, navActive: undefined })}>恢复默认</button>
      </div>
    </div>
  );
}
