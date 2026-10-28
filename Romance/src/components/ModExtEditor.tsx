/* 功能扩展编辑器：MOD 元数据 + 声明式注册项 + 皮肤 / 动画 DIY（实时预览，样式限定在本 MOD 容器内） */
import { useState } from "react";
import type { AnimPreset, Mod, ModCategory, ModComponentDef, ModExt, ModSkin } from "../mods/types";
import { NATIVE_DEPS } from "../mods/types";
import { useMods } from "../mods/registry";
import { ANIM_LABEL, CATEGORY_LABEL, cssProblems, modHealth } from "../mods/nmod";
import { ModFeaturePanels } from "./ModCenter";
import { StatusMark } from "../lib/icons";

const inp = "w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const lab = "block text-[11px] text-ink-soft";
const NATIVE_LABEL: Record<string, string> = { phone: "手机", career: "职业", factions: "阵营", storylines: "主线", worldBook: "世界书", cgs: "CG", pregnancy: "孕育", cars: "座驾", transport: "交通" };
const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

function JsonField<T>({ label, value, onChange, hint }: { label: string; value: T | undefined; onChange: (v: T | undefined) => void; hint: string }) {
  const [text, setText] = useState(() => (value === undefined ? "" : JSON.stringify(value, null, 2)));
  const [err, setErr] = useState("");
  return (
    <label className={lab}>{label}<span className="ml-1 opacity-70">{hint}</span>
      <textarea rows={4} value={text} spellCheck={false}
        onChange={(e) => { setText(e.target.value); if (!e.target.value.trim()) { setErr(""); onChange(undefined); return; } try { const v = JSON.parse(e.target.value); if (!Array.isArray(v)) throw new Error("须为数组"); setErr(""); onChange(v as T); } catch (x) { setErr((x as Error).message); } }}
        className={`${inp} mt-0.5 font-mono text-[11px]`} />
      {err && <span className="text-danger">JSON：{err}（未应用）</span>}
    </label>
  );
}

function Rows<T>({ items, onChange, blank, render, add }: { items: T[]; onChange: (v: T[]) => void; blank: () => T; render: (x: T, set: (p: Partial<T>) => void) => React.ReactNode; add: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((x, i) => (
        <div key={i} className="flex items-start gap-1.5 rounded-xl border border-line/70 p-1.5">
          <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-4">{render(x, (p) => onChange(items.map((y, j) => (j === i ? { ...y, ...p } : y))))}</div>
          <button className={`${btn} hover:!border-danger hover:!text-danger`} aria-label="删除" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button className={btn} onClick={() => onChange([...items, blank()])}>＋ {add}</button>
    </div>
  );
}

export default function ModExtEditor({ m, setM }: { m: Mod; setM: (m: Mod) => void }) {
  const { mods } = useMods();
  const e: ModExt = m.ext ?? {};
  const setE = (p: Partial<ModExt>) => setM({ ...m, ext: { ...e, ...p } });
  const setX = (p: Partial<NonNullable<ModExt["exports"]>>) => setE({ exports: { ...(e.exports ?? {}), ...p } });
  const skin: ModSkin = e.skin ?? {};
  const setSkin = (p: Partial<ModSkin>) => setE({ skin: { ...skin, ...p } });
  const others = mods.filter((x) => x.id !== m.id);
  const cssErr = skin.css ? cssProblems(skin.css) : [];
  const [health, setHealth] = useState<ReturnType<typeof modHealth> | null>(null);
  const deps = m.deps ?? [];
  return (
    <div className="space-y-3 text-[12px]">
      <section className="space-y-1.5">
        <p className="font-bold">包信息</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <label className={lab}>MOD 类别
            <select className={`${inp} mt-0.5`} value={m.kind === "world" ? "world" : m.category ?? ""} disabled={m.kind === "world"} onChange={(x) => setM({ ...m, category: (x.target.value || undefined) as ModCategory | undefined })}>
              <option value="">自动判断</option>
              {(["template", "feature"] as const).map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
              {m.kind === "world" && <option value="world">{CATEGORY_LABEL.world}</option>}
            </select>
          </label>
          <label className={lab}>封面图 URL / data:image
            <input className={`${inp} mt-0.5`} value={m.cover ?? ""} onChange={(x) => setM({ ...m, cover: x.target.value || undefined })} placeholder="https://…" />
          </label>
        </div>
        <p className={lab}>前置 MOD（可填最低版本）</p>
        <Rows<{ id: string; min?: string }> items={deps} onChange={(v) => setM({ ...m, deps: v.length ? v : undefined })} blank={() => ({ id: others[0]?.id ?? "" })} add="添加前置"
          render={(d, set) => <>
            <select className={`${inp} sm:col-span-3`} value={d.id} onChange={(x) => set({ id: x.target.value })}>{!others.some((o) => o.id === d.id) && <option value={d.id}>{d.id || "（选择）"}（未安装）</option>}{others.map((o) => <option key={o.id} value={o.id}>{o.name}（{o.id}）</option>)}</select>
            <input className={inp} value={d.min ?? ""} placeholder="≥ 版本" onChange={(x) => set({ min: x.target.value || undefined })} />
          </>} />
        <p className={lab}>需要的原生组件</p>
        <div className="flex flex-wrap gap-1">
          {NATIVE_DEPS.map((n) => { const on = m.nativeDeps?.includes(n); return (
            <button key={n} aria-pressed={on} onClick={() => { const s = new Set(m.nativeDeps ?? []); if (on) s.delete(n); else s.add(n); setM({ ...m, nativeDeps: s.size ? [...s] : undefined }); }}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{NATIVE_LABEL[n] ?? n}</button>
          ); })}
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="font-bold">私有变量 <span className="font-normal text-ink-soft">存在本 MOD 的数据域，与原生 flag 隔离</span></p>
        <Rows items={e.vars ?? []} onChange={(v) => setE({ vars: v })} blank={() => ({ key: `v${(e.vars?.length ?? 0) + 1}`, init: 0 })} add="变量"
          render={(v, set) => <>
            <input className={inp} value={v.key} placeholder="key" onChange={(x) => set({ key: x.target.value.replace(/[^a-z0-9_]/gi, "") })} />
            <input className={inp} value={v.label ?? ""} placeholder="显示名" onChange={(x) => set({ label: x.target.value || undefined })} />
            <input className={inp} type="number" value={v.init ?? ""} placeholder="初值" onChange={(x) => set({ init: num(x.target.value) })} />
            <div className="flex gap-1"><input className={inp} type="number" value={v.min ?? ""} placeholder="下限" onChange={(x) => set({ min: num(x.target.value) })} /><input className={inp} type="number" value={v.max ?? ""} placeholder="上限" onChange={(x) => set({ max: num(x.target.value) })} /></div>
          </>} />
        <p className="font-bold">配置项 <span className="font-normal text-ink-soft">玩家可在 MOD 管理里调整</span></p>
        <Rows items={e.config ?? []} onChange={(v) => setE({ config: v })} blank={() => ({ key: `c${(e.config?.length ?? 0) + 1}`, type: "toggle" as const, def: 1 })} add="配置项"
          render={(c, set) => <>
            <input className={inp} value={c.key} placeholder="key" onChange={(x) => set({ key: x.target.value.replace(/[^a-z0-9_]/gi, "") })} />
            <input className={inp} value={c.label ?? ""} placeholder="显示名" onChange={(x) => set({ label: x.target.value || undefined })} />
            <select className={inp} value={c.type} onChange={(x) => set({ type: x.target.value as "toggle" })}><option value="toggle">开关</option><option value="number">数值</option><option value="choice">选择</option></select>
            <input className={inp} type="number" value={c.def} placeholder="默认" onChange={(x) => set({ def: Number(x.target.value) || 0 })} />
            {c.type === "choice" && <input className={`${inp} sm:col-span-4`} placeholder="选项：0=简单, 1=普通, 2=困难" defaultValue={(c.options ?? []).map((o) => `${o.v}=${o.t}`).join(", ")}
              onBlur={(x) => set({ options: x.target.value.split(/[,，]/).map((s) => s.split("=")).filter((p) => p.length === 2 && p[1].trim()).map(([v, t]) => ({ v: Number(v) || 0, t: t.trim() })) })} />}
          </>} />
        <p className="font-bold">跨 MOD 授权（旧版） <span className="font-normal text-ink-soft">视同包内预设：仅对 exports 里声明、且对方在 imports 申请的条目生效</span></p>
        <Rows items={e.grants ?? []} onChange={(v) => setE({ grants: v })} blank={() => ({ mod: others[0]?.id ?? "", access: "read" as const })} add="授权"
          render={(g, set) => <>
            <select className={`${inp} sm:col-span-3`} value={g.mod} onChange={(x) => set({ mod: x.target.value })}>{others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            <select className={inp} value={g.access} onChange={(x) => set({ access: x.target.value as "read" })}><option value="read">只读</option><option value="rw">读写</option></select>
          </>} />
      </section>

      <section className="space-y-1.5">
        <p className="font-bold">对外接口 exports <span className="font-normal text-ink-soft">未列出的变量 / 动作一律私有；对外名称为 mod.{m.id}.名称</span></p>
        <Rows items={e.exports?.fields ?? []} onChange={(v) => setX({ fields: v })} blank={() => ({ key: e.vars?.[0]?.key ?? "", access: "read" as const })} add="导出字段"
          render={(f, set) => <>
            <select className={inp} value={f.key} onChange={(x) => set({ key: x.target.value })}>{!(e.vars ?? []).some((v) => v.key === f.key) && <option value={f.key}>{f.key || "（选择私有变量）"}</option>}{(e.vars ?? []).map((v) => <option key={v.key} value={v.key}>{v.label || v.key}</option>)}</select>
            <input className={inp} value={f.label ?? ""} placeholder="对外显示名" onChange={(x) => set({ label: x.target.value || undefined })} />
            <select className={inp} value={f.access} onChange={(x) => set({ access: x.target.value as "read" })}><option value="read">只读</option><option value="rw">可读写</option></select>
            <span className="self-center font-mono text-[10.5px] text-ink-soft">mod.{m.id}.{f.key}</span>
          </>} />
        <JsonField key={`xa${m.id}`} label="导出动作 exports.actions" hint='[{ "id": "对外名", "action": "内部动作 id", "params": [{ "name", "type": "number|boolean|string|id|list" }] }]' value={e.exports?.actions} onChange={(actions) => setX({ actions })} />
        <JsonField key={`xe${m.id}`} label="导出事件 exports.events" hint='[{ "id", "label", "params": [{ "name", "type" }] }]（在内部动作里用 { "kind": "modEmit", "event", "args" } 广播）' value={e.exports?.events} onChange={(events) => setX({ events })} />
        <JsonField key={`xp${m.id}`} label="包内预设授权 exports.presets" hint='[{ "mod": "使用方 id", "items": ["名称" | "*"], "perms": ["read","write","call","subscribe"] }]' value={e.exports?.presets} onChange={(presets) => setX({ presets })} />
        <p className="font-bold">导入申请 imports 与订阅 subs <span className="font-normal text-ink-soft">只是申请：需对方预设或工程作者在 MOD 管理里授权</span></p>
        <JsonField key={`im${m.id}`} label="导入 imports" hint='[{ "mod": "目标 id", "range": "^1.2.0", "items": [{ "name", "perms": ["read"] }] }]' value={e.imports} onChange={(imports) => setE({ imports })} />
        <JsonField key={`sb${m.id}`} label="订阅 subs" hint='[{ "id", "mod": "来源 id", "event", "action": "本 MOD 动作 id", "filter": [{ "param", "op": "eq", "value" }], "priority": 0 }]' value={e.subs} onChange={(subs) => setE({ subs })} />
      </section>

      <section className="space-y-1.5">
        <p className="font-bold">组件与面板 <span className="font-normal text-ink-soft">在游戏 MOD 管理页以独立面板显示</span></p>
        <Rows<ModComponentDef> items={e.components ?? []} onChange={(v) => setE({ components: v })} blank={() => ({ id: `comp${(e.components?.length ?? 0) + 1}`, type: "meter", var: e.vars?.[0]?.key })} add="组件"
          render={(c, set) => <>
            <input className={inp} value={c.id} placeholder="id" onChange={(x) => set({ id: x.target.value.replace(/[^a-z0-9_-]/gi, "") })} />
            <input className={inp} value={c.label ?? ""} placeholder="标签" onChange={(x) => set({ label: x.target.value || undefined })} />
            <select className={inp} value={c.type} onChange={(x) => set({ type: x.target.value as ModComponentDef["type"] })}><option value="meter">进度条</option><option value="counter">计数</option><option value="badge">徽章</option><option value="table">数据表</option><option value="text">文本</option></select>
            {c.type === "table" ? <select className={inp} value={c.table ?? ""} onChange={(x) => set({ table: x.target.value })}><option value="">（选择表）</option>{(e.tables ?? []).map((t) => <option key={t.id} value={t.id}>{t.label || t.id}</option>)}</select>
              : c.type === "text" ? <input className={inp} value={c.text ?? ""} placeholder="文本" onChange={(x) => set({ text: x.target.value })} />
                : <select className={inp} value={c.var ?? ""} onChange={(x) => set({ var: x.target.value })}><option value="">（绑定变量）</option>{(e.vars ?? []).map((v) => <option key={v.key} value={v.key}>{v.label || v.key}</option>)}</select>}
          </>} />
        <Rows items={e.panels ?? []} onChange={(v) => setE({ panels: v })} blank={() => ({ id: `panel${(e.panels?.length ?? 0) + 1}`, title: "新面板", components: [] })} add="面板"
          render={(p, set) => <>
            <input className={inp} value={p.title} placeholder="标题" onChange={(x) => set({ title: x.target.value })} />
            <div className="flex flex-wrap gap-1 sm:col-span-3">{(e.components ?? []).map((c) => { const on = p.components.includes(c.id); return (
              <button key={c.id} aria-pressed={on} onClick={() => set({ components: on ? p.components.filter((x) => x !== c.id) : [...p.components, c.id] })} className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft"}`}>{c.label || c.id}</button>
            ); })}</div>
          </>} />
      </section>

      <section className="space-y-1.5">
        <p className="font-bold">逻辑注册（JSON） <span className="font-normal text-ink-soft">动作 / 条件算子在「固定事件」的条件与效果里用「MOD 动作 / MOD 条件」调用</span></p>
        <JsonField key={`a${m.id}`} label="触发器动作 actions" hint='[{ "id", "label", "branches": [{ "conds": [], "effects": [] }] }]' value={e.actions} onChange={(actions) => setE({ actions })} />
        <JsonField key={`c${m.id}`} label="条件算子 conds" hint='[{ "id", "label", "match": "all", "conds": [] }]' value={e.conds} onChange={(conds) => setE({ conds })} />
        <JsonField key={`t${m.id}`} label="数据表 tables" hint='[{ "id", "label", "columns": [], "rows": [] }]' value={e.tables} onChange={(tables) => setE({ tables })} />
      </section>

      <section className="space-y-1.5">
        <p className="font-bold">皮肤与动画 DIY <span className="font-normal text-ink-soft">只作用于本 MOD 的面板，不会影响编辑器或其他 MOD</span></p>
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
      </section>

      <section className="space-y-1">
        <button className={btn} onClick={() => setHealth(modHealth(m))}>运行 MOD 体检</button>
        {health && <ul className="space-y-0.5 text-[11.5px]">{health.map((h, i) => <li key={i} className={h.level === "error" ? "text-danger" : h.level === "warn" ? "text-gold" : "text-jade"}><StatusMark kind={h.level === "ok" ? "ok" : h.level === "error" ? "err" : "warn"}>{h.text}</StatusMark></li>)}</ul>}
      </section>
    </div>
  );
}
