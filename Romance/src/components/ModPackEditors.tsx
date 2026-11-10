import { StarRating } from "../lib/icons";
import { useMemo, useState } from "react";
import { STAT_LABELS, type Gig, type MealPlan, type PregnancySlot } from "../game/data";
import { DEFAULT_GIG_PRICES, type GigPriceTable } from "../game/gigLibrary";
import { BonusRow } from "./ModCarsEditor";
import type { AttrDef } from "../lib/types";

/* ═══ 玩法包专用编辑器：饮食生活 · 通告库与价目 · 孕育参数 ═══
 * 结构扁平、条目多的内容用专门的表单；嵌套很深的（合约 / 项目 / 舆情 / 行业）走通用的 DataForm。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const num = (v: string) => (v === "" ? 0 : Number(v) || 0);
const sid = (p: string) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 4)}`;
const clean = <T extends object>(o: T): T | undefined => { const e = Object.entries(o).filter(([, v]) => v !== undefined && v !== 0); return e.length ? (Object.fromEntries(e) as T) : undefined; };

function Num({ label, value, onChange, unit, placeholder }: { label: string; value?: number; onChange: (v: number | undefined) => void; unit?: string; placeholder?: string | number }) {
  return (
    <label className="block min-w-0 text-[10.5px] text-ink-soft">
      <span className="mb-0.5 block truncate">{label}{unit && <span className="opacity-70">（{unit}）</span>}</span>
      <input type="number" className={`${inp} tabular-nums`} value={value ?? ""} placeholder={placeholder === undefined ? "" : String(placeholder)} onChange={(e) => onChange(e.target.value === "" ? undefined : num(e.target.value))} />
    </label>
  );
}

/* —— 饮食生活：每周吃什么 —— */
/** 功能注释：玩法包编辑器统一的属性来源——只认作品建角属性（不含娱乐圈八维与内置数值） */
export function packAttrKeys(customAttrs?: AttrDef[]): Record<string, string> {
  return Object.fromEntries((customAttrs ?? []).filter((a) => a && String(a.id ?? "").trim()).map((a) => [a.id, String(a.label || a.id)]));
}

function NoAttrsHint() {
  return <p className="rounded-lg border border-dashed border-line px-2 py-1.5 text-[10.5px] text-ink-soft">本作品还没有建角属性。先在「建角」里添加属性，这里才能选择属性变化与门槛。</p>;
}

export function ModMealsEditor({ value, onChange, customAttrs }: {
  value?: MealPlan[];
  onChange: (v?: MealPlan[]) => void;
  /** 功能注释：本作品建角属性；能力变化 / 门槛只认这些属性，不出现娱乐圈八维、压力、造型 */
  customAttrs?: AttrDef[];
}) {
  const list = value ?? [];
  const set = (i: number, p: Partial<MealPlan>) => onChange(list.map((m, j) => (j === i ? { ...m, ...p } : m)));
  const attrKeys = packAttrKeys(customAttrs);
  const hasAttrs = Object.keys(attrKeys).length > 0;
  const reqOpts = [
    ...Object.entries(attrKeys).map(([id, l]) => ({ v: `c:${id}`, l })),
    { v: "money", l: "资金" },
  ];
  const defaultReqMetric = reqOpts[0]?.v ?? "money";
  if (!value) {
    return (
      <div className="rounded-xl border border-dashed border-line p-3 text-center text-[11.5px] text-ink-soft">
            本模组还没写「每周吃什么」。还没写，开局不会生效。
            <button className={`${btn} ml-2`} onClick={() => onChange([
              { id: sid("meal_"), name: "简单凑合", desc: "能省则省", cost: 300 },
              { id: sid("meal_"), name: "家常饭菜", desc: "踏实养人", cost: 1000, default: true },
              { id: sid("meal_"), name: "吃顿好的", desc: "犒劳自己", cost: 3000 },
            ])}>用通用模板开始</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-ink-soft">玩家在日程板「本周伙食」里选一档，一直沿用到改为止；周日随账单扣伙食费并结算效果。钱不够时自动降到付得起的最便宜一档。</p>
      {list.map((m, i) => (
        <div key={m.id + i} className={`space-y-1.5 rounded-xl border p-2 ${m.default ? "border-jade/60 bg-jade/5" : "border-line bg-paper-2"}`}>
          <div className="flex items-center gap-1.5">
            <input className={`${inp} ${String(m.name ?? "").trim() ? "" : "!border-danger"}`} value={String(m.name ?? "")} placeholder="伙食名（如：家常自炊）" onChange={(e) => set(i, { name: e.target.value })} />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft" title="未选择时默认这一档">
              <input type="radio" name="meal-default" checked={!!m.default} onChange={() => onChange(list.map((x, j) => ({ ...x, default: j === i || undefined })))} className="accent-[var(--jade)]" />默认
            </label>
            <button className={`${btn} shrink-0`} disabled={i === 0} onClick={() => { const a = [...list]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; onChange(a); }} aria-label="上移">↑</button>
            <button className={`${btn} shrink-0 hover:!border-danger hover:!text-danger`} onClick={() => { const a = list.filter((_, j) => j !== i); onChange(a.length ? a : undefined); }} aria-label="删除">×</button>
          </div>
          <input className={inp} value={m.desc ?? ""} placeholder="一句话说明（玩家选择时看到）" onChange={(e) => set(i, { desc: e.target.value || undefined })} />
          <Num label="每周伙食费" unit="元" value={m.cost} onChange={(v) => set(i, { cost: v ?? 0 })} />
          <div className="text-[10.5px] text-ink-soft">每周属性变化（本作品建角属性，可为负）
            {hasAttrs ? <div className="mt-0.5"><BonusRow value={m.cgain} keys={attrKeys} onChange={(g) => set(i, { cgain: g })} /></div> : <NoAttrsHint />}
            {(() => {
              // 功能注释：旧数据里的娱乐圈八维 / 压力 / 造型不会出现在编辑器选项里 → 提示并可一键清除
              const stale = [
                ...Object.keys(m.gain ?? {}).filter((k) => !(k in attrKeys)).map((k) => (STAT_LABELS as Record<string, string>)[k] ?? k),
                ...(m.stress ? ["压力"] : []),
                ...(m.styling ? ["造型 / 气色"] : []),
              ];
              if (!stale.length) return null;
              return (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/5 px-2 py-1 text-[10.5px] text-danger">
                  「{stale.join("、")}」是娱乐圈内置数值，不属于本作品
                  <button className={btn} onClick={() => set(i, { gain: undefined, stress: undefined, styling: undefined })}>清除</button>
                </div>
              );
            })()}
          </div>
          <div className="space-y-1 text-[10.5px] text-ink-soft">解锁门槛（全部满足才可选，可留空）
            {(m.reqs ?? []).map((r, ri) => (
              <div key={ri} className="flex items-center gap-1.5">
                <select className={inp} value={r.metric} onChange={(e) => set(i, { reqs: m.reqs!.map((x, j) => (j === ri ? { ...x, metric: e.target.value } : x)) })}>
                  {!reqOpts.some((o) => o.v === r.metric) && <option value={r.metric}>{r.metric}</option>}
                  {reqOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <span className="shrink-0">≥</span>
                <input type="number" className={`${inp} !w-20 shrink-0`} value={r.min} onChange={(e) => set(i, { reqs: m.reqs!.map((x, j) => (j === ri ? { ...x, min: num(e.target.value) } : x)) })} />
                <button className={`${btn} shrink-0`} onClick={() => { const rs = m.reqs!.filter((_, j) => j !== ri); set(i, { reqs: rs.length ? rs : undefined }); }} aria-label="删除条件">×</button>
              </div>
            ))}
            <button className={btn} onClick={() => set(i, { reqs: [...(m.reqs ?? []), { metric: defaultReqMetric, min: defaultReqMetric === "money" ? 1000 : 10 }] })}>＋ 解锁条件</button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => onChange([...list, { id: sid("meal_"), name: "", cost: 1000 }])}>＋ 添加伙食</button>
        <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => onChange(undefined)}>移除此玩法</button>
      </div>
    </div>
  );
}

/* —— 通告库：搜索 / 星级与类型筛选 / 分页；每条可改门槛、收益、成长 —— */
const PAGE = 15;
export function ModGigsEditor({ value, prices, onChange, onPrices, customAttrs }: {
  value?: Gig[]; prices?: GigPriceTable;
  /** 功能注释：能力门槛 / 成长只认作品建角属性 */
  customAttrs?: AttrDef[];
  /** @deprecated 已无用 */
  defaults?: () => Gig[];
  onChange: (v?: Gig[]) => void; onPrices: (v?: GigPriceTable) => void;
}) {
  const list = value ?? [];
  const attrKeys = packAttrKeys(customAttrs);
  const [q, setQ] = useState("");
  const [star, setStar] = useState(0);
  const [type, setType] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const types = useMemo(() => [...new Set(list.map((g) => g.type).filter(Boolean))], [list]);
  const shown = useMemo(() => {
    const s = String(q ?? "").trim().toLowerCase();
    return list.map((g, i) => ({ g, i })).filter(({ g }) => (!star || g.star === star) && (!type || g.type === type) && (!s || `${g.name} ${g.type} ${g.note ?? ""} ${g.genre ?? ""}`.toLowerCase().includes(s)));
  }, [list, q, star, type]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const set = (i: number, p: Partial<Gig>) => onChange(list.map((g, j) => (j === i ? { ...g, ...p } : g)));
  const add = () => {
    const g: Gig = { id: sid("gig_"), name: "新通告", type: type || types[0] || "平面广告", star: star || 1, fameReq: 0, statReq: {}, fame: 0, pay: 30000, energy: 10, days: 1, grow: {} };
    onChange([...list, g]); setOpen(g.id); setQ(""); setStar(0); setType(""); setPage(Math.floor(list.length / PAGE));
  };
  const pt = { ...DEFAULT_GIG_PRICES, ...prices };
  const setPrice = (k: keyof GigPriceTable, i: number, v: number | undefined) => {
    const arr = [...pt[k]]; arr[i] = v ?? DEFAULT_GIG_PRICES[k][i];
    const next = { ...prices, [k]: arr } as GigPriceTable;
    if (arr.every((x, j) => x === DEFAULT_GIG_PRICES[k][j])) delete next[k];
    onPrices(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="space-y-2">
      <details className="rounded-xl border border-line bg-paper-2/60">
        <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[12px] font-bold text-ink">通告价目表 <span className="font-normal text-ink-soft">· 按星级统一的门槛 / 酬劳基准（通告库自动生成的通告用它）{prices ? " · 已改" : ""}</span></summary>
        <div className="overflow-x-auto border-t border-line/50 px-2.5 py-2">
          <table className="w-full text-[11px]">
            <thead><tr className="text-ink-soft"><th className="pr-2 text-left font-semibold">星级</th>{[1, 2, 3, 4, 5].map((s) => <th key={s} className="px-0.5 font-semibold text-gold"><StarRating n={s} /></th>)}</tr></thead>
            <tbody>
              {([["payBase", "酬劳基准（元）"], ["days", "天数"], ["energy", "每日体力"]] as const).map(([k, l]) => (
                <tr key={k}>
                  <td className="whitespace-nowrap pr-2 text-ink-soft">{l}</td>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <td key={i} className="px-0.5 py-0.5"><input type="number" className={`${inp} !px-1 text-center tabular-nums ${pt[k][i] !== DEFAULT_GIG_PRICES[k][i] ? "!border-jade" : ""}`} value={pt[k][i]} onChange={(e) => setPrice(k, i, e.target.value === "" ? undefined : num(e.target.value))} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {prices && <button className={`${btn} mt-1.5`} onClick={() => onPrices(undefined)}>价目恢复默认</button>}
        </div>
      </details>

      {!value ? (
        <div className="rounded-xl border border-dashed border-line p-3 text-center text-[11.5px] text-ink-soft">
          本模组还没写通告。还没写，开局不会生效。
          <button className={`${btn} ml-2`} onClick={() => onChange([])}>从空白开始</button>
        </div>
      ) : (<>
        <div className="flex flex-wrap items-center gap-1.5">
          <input className={`${inp} !w-auto min-w-[8rem] flex-1`} value={q} placeholder={`在 ${list.length} 条通告里搜索…`} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select className={`${inp} !w-auto`} value={star} onChange={(e) => { setStar(Number(e.target.value)); setPage(0); }}>
            <option value={0}>全部星级</option>{[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} 星</option>)}
          </select>
          <select className={`${inp} !w-auto max-w-[9rem]`} value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
            <option value="">全部类型</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          {shown.slice(pg * PAGE, pg * PAGE + PAGE).map(({ g, i }) => {
            const on = open === g.id;
            return (
              <div key={g.id + i} className={`rounded-lg border ${on ? "border-jade/60 bg-paper" : "border-line/70 bg-paper-2/60"}`}>
                <button type="button" onClick={() => setOpen(on ? null : g.id)} aria-expanded={on} className="flex w-full items-center gap-2 px-2 py-1.5 text-left">
                  <span className="w-12 shrink-0 text-[10.5px] text-gold"><StarRating n={Math.max(1, Math.min(5, g.star))} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{g.name || <i className="font-normal text-ink-soft">未命名</i>}<span className="ml-1.5 font-normal text-ink-soft">{g.type}</span></span>
                  <span className="shrink-0 text-[10.5px] tabular-nums text-ink-soft">¥{g.pay.toLocaleString()}</span>
                  <span className={`shrink-0 text-[11px] text-ink-soft transition ${on ? "rotate-90" : ""}`}>›</span>
                </button>
                {on && (
                  <div className="space-y-1.5 border-t border-line/50 px-2 py-2">
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      <label className="block text-[10.5px] text-ink-soft">名称<input className={inp} value={g.name} onChange={(e) => set(i, { name: e.target.value })} /></label>
                      <label className="block text-[10.5px] text-ink-soft">类型<input className={inp} list="gig-types" value={g.type} onChange={(e) => set(i, { type: e.target.value })} /></label>
                      <label className="block text-[10.5px] text-ink-soft">星级
                        <select className={inp} value={g.star} onChange={(e) => set(i, { star: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} 星</option>)}</select>
                      </label>
                      <Num label="酬劳" unit="元" value={g.pay} onChange={(v) => set(i, { pay: v ?? 0 })} />
                      <Num label="每日体力" value={g.energy} onChange={(v) => set(i, { energy: v ?? 0 })} />
                      <Num label="天数" value={g.days} onChange={(v) => set(i, { days: Math.max(1, v ?? 1) })} />
                      <Num label="固定开机周" value={g.fixedWeek} placeholder="不固定" onChange={(v) => set(i, { fixedWeek: v || undefined })} />
                      <label className="block text-[10.5px] text-ink-soft">题材 / 品类<input className={inp} value={g.genre ?? ""} placeholder="如 古风 / 美妆" onChange={(e) => set(i, { genre: e.target.value || undefined })} /></label>
                      <label className="block text-[10.5px] text-ink-soft">出演角色<input className={inp} value={g.role ?? ""} placeholder="影视类，如 女配角" onChange={(e) => set(i, { role: e.target.value || undefined })} /></label>
                    </div>
                    <label className="block text-[10.5px] text-ink-soft">简介<textarea rows={2} className={inp} value={g.note ?? ""} onChange={(e) => set(i, { note: e.target.value || undefined })} /></label>
                    <div className="text-[10.5px] text-ink-soft">能力门槛<div className="mt-0.5"><BonusRow value={g.statReq as Record<string, number>} keys={attrKeys} onChange={(v) => set(i, { statReq: (clean(v ?? {}) ?? {}) as Gig["statReq"] })} /></div></div>
                    <div className="text-[10.5px] text-ink-soft">完成后成长<div className="mt-0.5"><BonusRow value={g.grow as Record<string, number>} keys={attrKeys} onChange={(v) => set(i, { grow: (clean(v ?? {}) ?? {}) as Gig["grow"] })} /></div></div>
                    <div className="flex gap-1.5">
                      <button className={btn} onClick={() => { const c = { ...structuredClone(g), id: sid("gig_"), name: `${g.name}（副本）` }; const a = [...list]; a.splice(i + 1, 0, c); onChange(a); setOpen(c.id); }}>复制</button>
                      <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => onChange(list.filter((_, j) => j !== i))}>删除</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!shown.length && <p className="py-2 text-center text-[11px] text-ink-soft">没有符合条件的通告。</p>}
        </div>
        <datalist id="gig-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
        <div className="flex flex-wrap items-center gap-1.5">
          <button className={btn} onClick={add}>＋ 新增通告</button>
          <button className={`${btn} hover:!border-danger hover:!text-danger`} onClick={() => onChange(undefined)}>移除</button>
          {pages > 1 && <>
            <span className="ml-auto text-[10.5px] tabular-nums text-ink-soft">第 {pg + 1} / {pages} 页 · {shown.length} 条</span>
            <button className={btn} disabled={pg === 0} onClick={() => setPage(pg - 1)}>‹</button>
            <button className={btn} disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>›</button>
          </>}
        </div>
      </>)}
    </div>
  );
}

/* —— 孕育参数 —— */
export function ModPregnancyEditor({ value, onChange }: { value?: PregnancySlot; onChange: (v?: PregnancySlot) => void }) {
  const v = value ?? {};
  const set = (p: Partial<PregnancySlot>) => {
    const n: PregnancySlot = { ...v, ...p };
    for (const k of Object.keys(n) as (keyof PregnancySlot)[]) { const x = n[k]; if (x === undefined || (Array.isArray(x) && !x.length)) delete n[k]; }
    onChange(Object.keys(n).length ? n : undefined);
  };
  const [names, setNames] = useState((v.childNames ?? []).join("、"));
  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-ink-soft">留空 = 引擎默认（灰字）。受孕率 = 隐藏生育率/100 × 基础受孕率，压力超过门槛后逐步降低，且不超过上限。谁能怀孕、孩子随谁姓，在「世界规则」里设。</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <Num label="孕期" unit="天" value={v.gestationDays} placeholder={300} onChange={(x) => set({ gestationDays: x })} />
        <Num label="基础受孕率" unit="%" value={v.baseChance} placeholder={25} onChange={(x) => set({ baseChance: x })} />
        <Num label="单次受孕上限" unit="%" value={v.maxChance} placeholder={50} onChange={(x) => set({ maxChance: x })} />
        <Num label="压力超过此值降低受孕" value={v.stressFrom} placeholder={50} onChange={(x) => set({ stressFrom: x })} />
        <Num label="最早第几天察觉" value={v.revealMin} placeholder={14} onChange={(x) => set({ revealMin: x })} />
        <Num label="最晚第几天察觉" value={v.revealMax} placeholder={30} onChange={(x) => set({ revealMax: x })} />
        <Num label="生育率下限" value={v.fertilityMin} placeholder={20} onChange={(x) => set({ fertilityMin: x })} />
        <Num label="生育率上限" value={v.fertilityMax} placeholder={80} onChange={(x) => set({ fertilityMax: x })} />
        <Num label="分娩压力" value={v.birthStress} placeholder={10} onChange={(x) => set({ birthStress: x })} />
      </div>
      <label className="block text-[10.5px] text-ink-soft">孩子名字池（不含姓，顿号或逗号分隔；留空用默认）
        <input className={inp} value={names} placeholder="安、念、朝、知夏、星禾、以宁…" onChange={(e) => { setNames(e.target.value); set({ childNames: e.target.value.split(/[、,，\s]+/).map((x) => x.trim()).filter(Boolean) }); }} />
      </label>
      {value && <button className={btn} onClick={() => { setNames(""); onChange(undefined); }}>全部恢复默认</button>}
    </div>
  );
}
