import { StarRating } from "../lib/icons";
import { DEFAULT_GIG_CATS, DEFAULT_GIG_ROLES, DEFAULT_GIG_TIER_NAMES, normalizeGigConfig, type GigCatDef, type GigConfig, type GigRoleDef } from "../game/gigConfig";
import { liveTerm as T } from "../mods/live";

/**
 * 功能注释：通告（工作单）结构设置——分类、阵容角色、星级称号。
 * 让同一套接单玩法在任何题材复用：仙侠可设「斩妖 / 护送 / 采药」，职场可设「项目 / 出差 / 培训」。
 * 未改动时不写 gigConfig，沿用原版结构。
 */
const inp = "w-full min-w-0 rounded-xl border border-line bg-paper-2 px-2.5 py-1.5 text-[12.5px] text-ink placeholder:text-ink-soft/55 transition focus:border-jade focus:outline-none focus:ring-2 focus:ring-jade/20";
const btn = "inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const head = "text-[12px] font-bold text-ink";
const PUBLISH: { v: NonNullable<GigCatDef["publish"]>; l: string }[] = [
  { v: "always", l: "每周" }, { v: "odd", l: "单周" }, { v: "even", l: "双周" },
];
const uid = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;

export default function GigConfigEditor({ value, onChange }: { value?: GigConfig; onChange: (v?: GigConfig) => void }) {
  const cfg = normalizeGigConfig(value);
  const commit = (patch: Partial<GigConfig>) => {
    const next: GigConfig = { ...(value ?? {}), ...patch };
    for (const k of Object.keys(next) as (keyof GigConfig)[]) if (next[k] === undefined) delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  const setCats = (cats: GigCatDef[]) => commit({ cats });
  const setRoles = (roles: GigRoleDef[]) => commit({ roles });
  const pc = (i: number, p: Partial<GigCatDef>) => setCats(cfg.cats.map((c, j) => (j === i ? { ...c, ...p } : c)));
  const pr = (i: number, p: Partial<GigRoleDef>) => setRoles(cfg.roles.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <details className="group rounded-2xl border border-line bg-paper-2/40" open={!!value}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
        <span>
          <span className={head}>{T("gig")}设置</span>
          <span className="ml-2 text-[11px] text-ink-soft">分类 · 阵容角色 · 星级称号{value ? " · 已自定义" : " · 使用默认"}</span>
        </span>
        <span aria-hidden className="text-ink-soft transition group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-4 border-t border-line/60 px-3 py-3">
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className={head}>分类</p>
            <p className="text-[10.5px] text-ink-soft">通告的「类型」含关键词即归入该类；都不中归入最后一类</p>
          </div>
          {cfg.cats.map((c, i) => (
            <div key={c.id} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-1.5 rounded-xl border border-line bg-paper p-2 sm:grid-cols-[1fr_1.6fr_auto_auto_auto]">
              <input className={`${inp} font-semibold`} value={c.label} placeholder="分类名" onChange={(e) => pc(i, { label: e.target.value })} aria-label="分类名" />
              <input className={inp} value={c.match ?? ""} placeholder={i === cfg.cats.length - 1 ? "兜底类，可留空" : "关键词，用 | 分隔"} onChange={(e) => pc(i, { match: e.target.value })} aria-label="匹配关键词" />
              <select className={`${inp} !w-auto`} value={c.publish ?? "always"} onChange={(e) => pc(i, { publish: e.target.value as GigCatDef["publish"] })} aria-label="发布节奏">
                {PUBLISH.map((p) => <option key={p.v} value={p.v}>{p.l}发布</option>)}
              </select>
              <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-ink-soft" title={`判定成功率时是否计入${T("fame")}`}>
                <input type="checkbox" className="accent-jade" checked={c.fameJudge !== false} onChange={(e) => pc(i, { fameJudge: e.target.checked })} />
                计{T("fame")}
              </label>
              <button type="button" className={btn} disabled={cfg.cats.length <= 1} onClick={() => setCats(cfg.cats.filter((_, j) => j !== i))} aria-label="删除分类">×</button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => setCats([...cfg.cats.slice(0, -1), { id: uid("gc_"), label: "", match: "", publish: "always", fameJudge: true }, cfg.cats[cfg.cats.length - 1]])}>＋ 分类</button>
            {value?.cats && <button type="button" className={btn} onClick={() => commit({ cats: undefined })}>恢复默认（{DEFAULT_GIG_CATS.map((c) => c.label).join(" / ")}）</button>}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className={head}>阵容角色</p>
            <p className="text-[10.5px] text-ink-soft">每条{T("gig")}可填这些角色由谁担任；清空 = 不显示阵容</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cfg.roles.map((r, i) => (
              <span key={r.key} className="inline-flex items-center gap-1 rounded-full border border-line bg-paper py-0.5 pl-2.5 pr-1">
                <input className="w-16 bg-transparent text-[12px] font-semibold text-ink focus:outline-none" value={r.label} onChange={(e) => pr(i, { label: e.target.value })} aria-label="角色名" />
                <button type="button" className="h-5 w-5 rounded-full text-[12px] text-ink-soft hover:bg-paper-2 hover:text-danger" onClick={() => setRoles(cfg.roles.filter((_, j) => j !== i))} aria-label="删除角色">×</button>
              </span>
            ))}
            <button type="button" className={btn} onClick={() => setRoles([...cfg.roles, { key: uid("r_"), label: "新角色" }])}>＋ 角色</button>
            {value?.roles && <button type="button" className={btn} onClick={() => commit({ roles: undefined })}>恢复默认（{DEFAULT_GIG_ROLES.map((r) => r.label).join(" / ")}）</button>}
          </div>
        </section>

        <section className="space-y-2">
          <p className={head}>星级称号</p>
          <div className="grid grid-cols-5 gap-1.5">
            {cfg.tierNames.map((n, i) => (
              <label key={i} className="block text-center text-[10.5px] font-semibold text-gold"><StarRating n={i + 1} />
                <input className={`${inp} mt-0.5 text-center`} value={value?.tierNames?.[i] ?? ""} placeholder={DEFAULT_GIG_TIER_NAMES[i]} onChange={(e) => {
                  const arr = [...(value?.tierNames ?? ["", "", "", "", ""])];
                  arr[i] = e.target.value;
                  commit({ tierNames: arr.some((x) => x.trim()) ? arr : undefined });
                }} aria-label={`${i + 1} 星称号`} />
              </label>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}
