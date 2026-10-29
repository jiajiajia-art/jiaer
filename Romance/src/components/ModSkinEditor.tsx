/**
 * ⑥美化「皮肤美化」下半：只写 ext.skin（底色、字体、阴影、动画、CSS）。
 * 仍与 content.theme 分开存，合并只是编辑器入口；已配内容不丢。
 */
import type { AnimPreset, Mod, ModSkin } from "../mods/types";
import { ANIM_LABEL, cssProblems } from "../mods/nmod";
import { ModFeaturePanels } from "./ModCenter";

const inp = "w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade";
const lab = "block text-[11px] text-ink-soft";

export default function ModSkinEditor({ m, setM }: { m: Mod; setM: (m: Mod) => void }) {
  const e = m.ext ?? {};
  const skin: ModSkin = e.skin ?? {};
  const setSkin = (p: Partial<ModSkin>) => setM({ ...m, ext: { ...e, skin: { ...skin, ...p } } });
  const cssErr = skin.css ? cssProblems(skin.css) : [];
  return (
    <div className="space-y-1.5 text-[12px]">
      <p className="text-[11px] leading-relaxed text-ink-soft">只作用于本 MOD 的面板，不会改游戏主题，也不会动变量、算子或面板注册。</p>
      <div className="grid gap-1.5 sm:grid-cols-4">
        {([["bg", "底色"], ["fg", "文字"], ["accent", "强调"], ["border", "描边"]] as const).map(([k, t]) => (
          <label key={k} className={lab}>{t}
            <span className="mt-0.5 flex gap-1"><input type="color" value={/^#[0-9a-f]{6}$/i.test(skin[k] ?? "") ? skin[k] : "#888888"} onChange={(x) => setSkin({ [k]: x.target.value })} className="h-7 w-8 shrink-0 rounded border border-line" />
              <input className={inp} value={skin[k] ?? ""} placeholder="默认" onChange={(x) => setSkin({ [k]: x.target.value || undefined })} /></span>
          </label>
        ))}
        <label className={lab}>圆角 {skin.radius ?? 16}px<input type="range" min={0} max={32} value={skin.radius ?? 16} onChange={(x) => setSkin({ radius: Number(x.target.value) })} className="mt-1 w-full accent-[var(--jade)]" /></label>
        <label className={lab}>字体<select className={`${inp} mt-0.5`} value={skin.font ?? "inherit"} onChange={(x) => setSkin({ font: x.target.value as ModSkin["font"] })}><option value="inherit">跟随</option><option value="serif">衬线</option><option value="sans">无衬线</option><option value="round">圆体</option><option value="mono">等宽</option></select></label>
        <label className={lab}>阴影<select className={`${inp} mt-0.5`} value={skin.shadow ?? "soft"} onChange={(x) => setSkin({ shadow: x.target.value as ModSkin["shadow"] })}><option value="none">无</option><option value="soft">柔和</option><option value="lift">悬浮</option><option value="neon">霓虹</option></select></label>
        <label className={lab}>底纹<select className={`${inp} mt-0.5`} value={skin.pattern ?? "none"} onChange={(x) => setSkin({ pattern: x.target.value as ModSkin["pattern"] })}><option value="none">无</option><option value="dots">波点</option><option value="grid">网格</option><option value="stripes">斜纹</option><option value="paper">纸感</option></select></label>
        <label className={lab}>面板动画<select className={`${inp} mt-0.5`} value={skin.panelAnim ?? "none"} onChange={(x) => setSkin({ panelAnim: x.target.value as AnimPreset })}>{Object.entries(ANIM_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className={lab}>组件动画<select className={`${inp} mt-0.5`} value={skin.componentAnim ?? "none"} onChange={(x) => setSkin({ componentAnim: x.target.value as AnimPreset })}>{Object.entries(ANIM_LABEL).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <label className={`${lab} sm:col-span-2`}>动画时长 {skin.duration ?? 520}ms<input type="range" min={100} max={4000} step={20} value={skin.duration ?? 520} onChange={(x) => setSkin({ duration: Number(x.target.value) })} className="mt-1 w-full accent-[var(--jade)]" /></label>
      </div>
      <label className={lab}>自定义 CSS<span className="ml-1 opacity-70">自动加本 MOD 前缀隔离；禁止 @import / url() 外链 / expression</span>
        <textarea rows={3} spellCheck={false} value={skin.css ?? ""} onChange={(x) => setSkin({ css: x.target.value || undefined })} className={`${inp} mt-0.5 font-mono text-[11px]`} placeholder=".nm-panel { letter-spacing: .02em }" />
      </label>
      {cssErr.map((t, i) => <p key={i} className="text-[11px] text-danger">· {t}</p>)}
      {!!e.panels?.length && <div><p className={lab}>实时预览</p><div className="mt-1"><ModFeaturePanels previewMod={m} /></div></div>}
    </div>
  );
}
