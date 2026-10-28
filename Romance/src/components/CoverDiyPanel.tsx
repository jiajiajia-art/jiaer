import FrameEditor from "./FrameDiy";
import { Fragment, useRef, useState, type ReactNode } from "react";
import { useGame } from "../store/gameCtx";
import type { CoverDiy } from "../lib/store";
import type { CoverCopy } from "../mods/types";
import AiImageGen from "./AiImageGen";
import { FONTS } from "../lib/skins";
import { selectedSlot } from "../mods/registry";
import ImagePicker from "./ImagePicker";
import { CoverView, cgKind } from "./Cover";
import CoverCgEditor from "./CoverCgEditor";
import { useConfirm } from "./EditorKit";
import CoverAiChat from "./CoverAiChat";
import { ViewSwitch, type GenView } from "./CodexChat";
import { COVER_CLASSES, CSS_MAX } from "../lib/coverAi";

/* 美化 · 封面 DIY：AI 对话生成 + 背景 / 文字 / 版式 / 按钮 / 特效 / CSS 自由搭配 + 风格预设 + 实时缩略预览。
 * 玩家填写的项优先于世界作者的封面；留空沿用。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-jade";
const chip = (on: boolean) => `rounded-[6px] border px-2.5 py-1.5 text-[12px] transition ${on ? "border-jade bg-jade/10 font-bold text-jade" : "border-line bg-paper text-ink hover:border-jade/60"}`;
const H = ({ t, d }: { t: string; d?: string }) => <p className="mb-1.5 mt-3.5 flex items-baseline gap-2 text-[12.5px] font-bold text-ink first:mt-0">{t}{d && <span className="text-[10.5px] font-normal text-ink-soft">{d}</span>}</p>;
function Opt<T extends string>({ value, opts, onPick }: { value?: T; opts: readonly (readonly [T, string])[]; onPick: (v: T) => void }) {
  return <div className="flex flex-wrap gap-1.5">{opts.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={chip(value === v)}>{l}</button>)}</div>;
}
function Range({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1 mt-3 flex items-center justify-between text-[12px] font-bold text-ink">{label}<span className="tabular-nums text-ink-soft">{value}{unit}</span></p>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="w-full accent-[var(--jade)]" aria-label={label} />
    </div>
  );
}

function Preview({ cv, d }: { cv: CoverCopy; d?: CoverDiy }) {
  const { look } = useGame();
  const land = look.orient === "landscape";
  const [w, h, k] = land ? [1100, 620, 0.34] : [390, 700, 0.42];
  const noop = () => {};
  return (
    <div className="mx-auto overflow-hidden rounded-2xl border border-line shadow-lg" style={{ width: w * k, height: h * k }}>
      <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: "top left" }}>
        <CoverView cv={cv} d={d} preview onStart={noop} onContinue={noop} onConfig={noop} />
      </div>
    </div>
  );
}

const TABS = ["AI 对话", "背景", "文字", "版式", "按钮", "边框", "特效", "CSS"] as const;

/* 通用封面 DIY 编辑器：玩家「装扮封面」与模组编辑器「开局封面」共用。
 * author=true 时编辑的是作者封面（所有玩家默认看到），没有「使用我的封面」开关，文字占位不再引用世界封面。 */
export function CoverDiyEditor(props: CoverDiyProps) {
  // switch：同一页面内用顶部开关在「实时预览 / AI 对话」间切换
  const [view, setView] = useState<GenView>("preview");
  if (props.mode !== "switch") return <CoverDiyBody {...props} />;
  return (
    <div className="space-y-3">
      <ViewSwitch value={view} onChange={setView} />
      <CoverDiyBody key={view} {...props} mode={view === "preview" ? "live" : "chat"} />
    </div>
  );
}
type CoverDiyProps = {
  value: CoverDiy; onChange: (v?: CoverDiy) => void;
  cvText: CoverCopy; // 文字 / 压暗的灰色占位来源（玩家端 = 世界封面）
  previewCv: CoverCopy; previewD?: CoverDiy; // 预览用的封面与玩家 DIY
  author?: boolean; chatKey: string; cover?: CoverCopy; // cover：AI 对话参考的世界封面
  mode?: "all" | "live" | "chat" | "switch"; // live：实时预览 + 手动搭配；chat：纯对话；all：两者合一；switch：顶部切换 live / chat
};
function CoverDiyBody({ value, onChange, cvText, previewCv, previewD, author, chatKey, cover, mode = "all" }: CoverDiyProps) {
  const { look } = useGame();
  const [confirm, confirmEl] = useConfirm();
  const d = value;
  const cv = cvText;
  const [tab, setTab] = useState<(typeof TABS)[number]>(mode === "live" ? "背景" : "AI 对话");
  const tabs = mode === "live" ? TABS.filter((t) => t !== "AI 对话") : TABS;
  const clean = (n: CoverDiy) => { for (const k of Object.keys(n) as (keyof CoverDiy)[]) if (n[k] === undefined || n[k] === "") delete n[k]; return Object.keys(n).length ? n : undefined; };
  const set = (p: Partial<CoverDiy>) => onChange(clean({ ...d, ...p, on: undefined }));
  const on = true; // 编辑器内封面 DIY 始终生效
  const toggle = (k: "continue" | "config") => set({ hide: { ...(d.hide ?? {}), [k]: !d.hide?.[k] || undefined } });
  const [vidMsg, setVidMsg] = useState("");
  const pickVideo = (f?: File) => {
    if (!f) return;
    const mb = f.size / 1048576;
    if (mb > 6) return setVidMsg(`视频 ${mb.toFixed(1)}MB 太大了，本地最多 6MB；大文件请贴直链`);
    setVidMsg("");
    const r = new FileReader();
    r.onload = () => set({ video: String(r.result) });
    r.readAsDataURL(f);
  };

  const page: Record<(typeof TABS)[number], ReactNode> = {
    "AI 对话": <CoverAiChat d={d} setCover={onChange} author={author} storeKey={chatKey} cover={cover} />,
    背景: <>
      <H t="背景类型" d="都不填则用默认封面背景" />
      <Opt value={cgKind(d)} onPick={(v) => set({ cgMode: v, ...(v === "carousel" && !d.cgs?.length && d.image ? { cgs: [d.image] } : {}) })}
        opts={[["fixed", "固定 CG"], ["carousel", "轮播 CG"], ["video", "视频"]] as const} />
      {cgKind(d) === "fixed" && <>
        <H t="固定 CG" d="始终显示这一张" />
        <ImagePicker value={d.image} label="封面 CG" max={1920} onChange={(u) => set({ image: u })} hint="竖屏建议 9:16，横屏建议 16:9" />
      </>}
      {cgKind(d) === "carousel" && <div className="mt-3"><CoverCgEditor v={d} set={set} /></div>}
      {cgKind(d) !== "video" && (
        <div className="mt-3">
          <AiImageGen size="1024x1792" onPick={(image) => (cgKind(d) === "carousel" ? set({ cgs: [...(d.cgs ?? []), image].slice(0, 8) }) : set({ image }))}
            placeholder={`描述封面背景：主体、场景、光线、画风，竖版构图，画面里不要文字${d.title || cv.title ? `（作品名「${d.title || cv.title}」）` : ""}`} />
        </div>
      )}
      {cgKind(d) === "video" && <>
      <H t="背景视频" d="静音循环播放" />
      <div className="flex gap-1.5">
        <label className={`${chip(false)} cursor-pointer`}>上传视频<input type="file" accept="video/*" hidden onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {d.video && <button type="button" className={`${chip(false)} hover:!text-danger`} onClick={() => set({ video: undefined })}>清除</button>}
        <input className={`${inp} font-mono text-[11.5px]`} value={d.video?.startsWith("data:") ? "" : d.video ?? ""} onChange={(e) => set({ video: e.target.value || undefined })} placeholder={d.video?.startsWith("data:") ? "已上传本地视频（可改贴直链）" : "或粘贴视频直链 https://…"} />
      </div>
      {vidMsg && <p className="mt-1 text-[11px] text-danger">{vidMsg}</p>}
      <H t="加载封面" d="视频加载出来之前显示的图（可选）" />
      <ImagePicker value={d.image} label="加载封面" max={1920} onChange={(u) => set({ image: u })} />
      </>}
      <Range label="压暗" value={d.dim ?? cv.dim ?? 40} min={0} max={80} unit="%" onChange={(v) => set({ dim: v })} />
      <Range label="模糊" value={d.blur ?? 0} min={0} max={16} unit="px" onChange={(v) => set({ blur: v || undefined })} />
      <H t="压暗颜色" d="压暗背景时叠加的颜色" />
      <div className="flex flex-wrap items-center gap-1.5">
        <Opt value={d.tint ?? "night"} onPick={(v) => set({ tint: v === "night" ? undefined : v })} opts={[["night", "紫色"], ["rose", "粉色"], ["ocean", "蓝色"], ["gold", "暖黄"], ["none", "黑色"], ["custom", "自定义"]] as const} />
        {d.tint === "custom" && <input type="color" value={d.tintColor ?? "#2b1d47"} onChange={(e) => set({ tintColor: e.target.value })} className="h-8 w-9 cursor-pointer rounded border border-line" aria-label="叠色" />}
      </div>
    </>,
    文字: <>
      <p className="mb-2 text-[11px] text-ink-soft">留空的项不会显示在封面上；标题留空时用当前作品名。</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="text-[11px] font-bold text-ink-soft">顶部小字</span><input className={inp} value={d.kicker ?? ""} maxLength={40} placeholder={cv.kicker || "例如：作品类型 / 英文副标（可不填）"} onChange={(e) => set({ kicker: e.target.value })} /></label>
        <label className="block"><span className="text-[11px] font-bold text-ink-soft">副标题</span><input className={inp} value={d.subtitle ?? ""} maxLength={30} placeholder={cv.subtitle || "一句话说明作品（可不填）"} onChange={(e) => set({ subtitle: e.target.value })} /></label>
      </div>
      <label className="mt-2 block"><span className="text-[11px] font-bold text-ink-soft">标题</span><input className={inp} value={d.title ?? ""} maxLength={20} placeholder={cv.title || "作品名（留空用当前作品名）"} onChange={(e) => set({ title: e.target.value })} /></label>
      <label className="mt-2 block"><span className="text-[11px] font-bold text-ink-soft">简介</span><textarea className={inp} rows={3} value={d.intro ?? ""} placeholder={cv.intro || "作品简介，显示在标题下方（可不填）"} onChange={(e) => set({ intro: e.target.value })} /></label>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-ink">
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={!!d.hideKicker} onChange={(e) => set({ hideKicker: e.target.checked || undefined })} />隐藏顶部小字</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--jade)]" checked={!!d.hideIntro} onChange={(e) => set({ hideIntro: e.target.checked || undefined })} />隐藏简介</label>
      </div>
      <H t="标题图" d="上传艺术字 / Logo，替代文字标题（透明底 PNG 最佳）" />
      <ImagePicker value={d.logo} label="标题图" max={1200} onChange={(u) => set({ logo: u })} />
      {!d.logo && <>
        <H t="标题字体" />
        <Opt value={d.titleFont ?? "default"} onPick={(v) => set({ titleFont: v === "default" ? undefined : v })} opts={[["default", "跟随界面"], ...FONTS.map((f) => [f.id, f.label] as const)] as const} />
        <H t="标题颜色" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Opt value={d.titleColor ?? "white"} onPick={(v) => set({ titleColor: v === "white" ? undefined : v })} opts={[["white", "白色"], ["gold", "金色渐变"], ["pink", "粉色渐变"], ["accent", "主题色渐变"], ["custom", "自定义"]] as const} />
          {d.titleColor === "custom" && <input type="color" value={d.titleCustom ?? "#ffffff"} onChange={(e) => set({ titleCustom: e.target.value })} className="h-8 w-9 cursor-pointer rounded border border-line" aria-label="标题颜色" />}
        </div>
        <H t="标题大小" />
        <Opt value={d.titleSize ?? "m"} onPick={(v) => set({ titleSize: v === "m" ? undefined : v })} opts={[["s", "小"], ["m", "标准"], ["l", "大"], ["xl", "特大"]] as const} />
      </>}
    </>,
    版式: <>
      <H t="对齐" />
      <Opt value={d.align ?? "left"} onPick={(v) => set({ align: v === "left" ? undefined : v })} opts={[["left", "居左"], ["center", "居中"], ["right", "居右"]] as const} />
      <H t="位置" d="文字与按钮在画面中的高度" />
      <Opt value={d.vpos ?? "center"} onPick={(v) => set({ vpos: v === "center" ? undefined : v })} opts={[["top", "偏上"], ["center", "居中"], ["bottom", "偏下"]] as const} />
      <H t="文字底板" d="背景图较花时更易读" />
      <Opt value={d.panel ?? "none"} onPick={(v) => set({ panel: v === "none" ? undefined : v })} opts={[["none", "无"], ["glass", "半透明底板"], ["dark", "深色底板"]] as const} />
    </>,
    按钮: <>
      <H t="按钮风格" />
      <Opt value={d.btnStyle ?? "dream"} onPick={(v) => set({ btnStyle: v === "dream" ? undefined : v })} opts={[["dream", "渐变"], ["solid", "纯色"], ["glass", "半透明"], ["outline", "线框"], ["text", "纯文字"]] as const} />
      {d.btnStyle !== "text" && <>
        <H t="按钮形状" />
        <Opt value={d.btnShape ?? "pill"} onPick={(v) => set({ btnShape: v === "pill" ? undefined : v })} opts={[["pill", "胶囊"], ["rounded", "圆角"], ["square", "直角"]] as const} />
        <H t="排列" />
        <Opt value={d.btnLayout ?? "grid"} onPick={(v) => set({ btnLayout: v === "grid" ? undefined : v })} opts={[["grid", "主按钮 + 两列"], ["stack", "竖排"], ["row", "横排一行"]] as const} />
      </>}
      <H t="按钮文字与显示" d="留空用默认文字；关掉的按钮不显示" />
      <div className="space-y-1.5">
        {([["start", "开始游戏"], ["continue", "继续游戏"], ["config", "配置 AI"]] as const).map(([k, def]) => (
          <div key={k} className="flex items-center gap-2">
            <input className={inp} value={d.labels?.[k] ?? ""} maxLength={10} placeholder={def} disabled={k !== "start" && !!d.hide?.[k]} onChange={(e) => set({ labels: { ...(d.labels ?? {}), [k]: e.target.value || undefined } })} />
            {k === "start" ? <span className="w-14 shrink-0 text-center text-[11px] text-ink-soft">常驻</span> : (
              <label className="flex w-14 shrink-0 items-center gap-1 text-[11.5px] text-ink"><input type="checkbox" className="accent-[var(--jade)]" checked={!d.hide?.[k]} onChange={() => toggle(k)} />显示</label>
            )}
          </div>
        ))}
      </div>
    </>,
    边框: <>
      <p className="mb-2 text-[11px] text-ink-soft">给封面加一圈装饰边框，不影响按钮点击。</p>
      <FrameEditor value={d.frame} onChange={(frame) => set({ frame })} />
    </>,
    特效: <>
      <H t="动态特效" d="叠加在背景上，默认不开" />
      <Opt value={d.fx ?? "none"} onPick={(v) => set({ fx: v === "none" ? undefined : v })} opts={[["none", "无"], ["stars", "星光"], ["petals", "花瓣"], ["snow", "雪花"], ["fireflies", "光点"], ["hearts", "爱心"]] as const} />
      <p className="mt-2 text-[11px] text-ink-soft">系统开启「减少动态效果」时自动静止。需要更细的调整可以在「CSS」页里自己写样式。</p>
    </>,
    CSS: <>
      <H t="封面专属 CSS" d="自动只作用于封面，不影响游戏其它界面；改完预览即时生效" />
      <textarea className={`${inp} font-mono text-[11.5px] leading-relaxed`} rows={10} spellCheck={false} maxLength={CSS_MAX} value={typeof d.css === "string" ? d.css : ""}
        placeholder={".cover-title {\n  letter-spacing: 0.05em;\n}\n.cover-btn-main {\n  border-radius: 8px;\n}"}
        onChange={(e) => set({ css: e.target.value })} />
      <p className="mt-1 flex justify-between text-[10.5px] text-ink-soft"><span>支持 @keyframes · @media · @import Google Fonts</span><span className="tabular-nums">{(typeof d.css === "string" ? d.css.length : 0)} / {CSS_MAX}</span></p>
      <H t="可用类名" d="点一下插入" />
      <div className="flex flex-wrap gap-1">
        {COVER_CLASSES.map((c) => (
          <button key={c} type="button" onClick={() => set({ css: `${typeof d.css === "string" && d.css ? `${d.css.trimEnd()}\n` : ""}.${c} {\n  \n}` })}
            className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink ring-1 ring-line transition hover:text-jade hover:ring-jade">.{c}</button>
        ))}
      </div>
    </>,
  };

  const resetBtn = <button type="button" className={`${chip(false)} w-full hover:!border-danger hover:!text-danger`} onClick={async () => { if (await confirm("清空封面的文字、背景与样式，恢复默认封面？", { ok: "恢复默认" })) onChange(undefined); }}>恢复默认封面</button>;
  const previewEl = <>
    <Preview cv={previewCv} d={previewD} />
    <p className="mt-1 text-center text-[10.5px] text-ink-soft">实时预览 · {look.orient === "landscape" ? "横屏" : "竖屏"}</p>
  </>;

  // 对话为主：纯对话式界面，不带预览（预览在「实时预览」里看）
  if (mode === "chat") return <div className="text-ink">{confirmEl}<CoverAiChat d={d} setCover={onChange} author={author} storeKey={chatKey} cover={cover} full /></div>;

  // 实时预览：左侧预览常驻（宽屏吸顶），右侧分组编辑；改动即时反映在预览上
  return (
    <div className="flex flex-col gap-4 text-ink sm:flex-row sm:items-start">
      {confirmEl}
      <div className="flex shrink-0 flex-col items-center gap-2 sm:sticky sm:top-16 sm:w-auto">
        {previewEl}
        <div className="w-full">{resetBtn}</div>
      </div>

      <div className={`min-w-0 flex-1 ${on || tab === "AI 对话" ? "" : "pointer-events-none opacity-50"}`}>
        <div role="tablist" aria-label="封面编辑项" className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${tab === t ? "bg-coral text-white shadow-sm" : "bg-paper text-ink-soft ring-1 ring-line hover:text-ink hover:ring-coral/50"}`}>
              {t}
            </button>
          ))}
        </div>
        <div role="tabpanel" aria-label={tab} className="rounded-[var(--radius-ui-lg)] border border-line bg-paper/60 p-3 sm:p-4">{page[tab]}</div>
      </div>
    </div>
  );
}

/* 玩家 · 装扮封面：写进外观设置（theme.cover），世界作者的封面打底 */
export default function CoverDiyPanel({ mode = "all" }: { mode?: CoverDiyProps["mode"] }) {
  const { theme, setTheme } = useGame();
  // AI 生图是异步的：写回时用最新的 theme，免得覆盖期间的手动修改
  const themeRef = useRef(theme); themeRef.current = theme;
  const cv = selectedSlot("cover") ?? {};
  const d = theme.cover ?? {};
  return <CoverDiyEditor value={d} onChange={(cover) => setTheme({ ...themeRef.current, cover })} cvText={cv} previewCv={cv} previewD={d} chatKey="player" cover={cv} mode={mode} />;
}
