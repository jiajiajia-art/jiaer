import { useEffect, useMemo, useRef } from "react";
import { useState } from "react";
import { RAW_STAT_LABELS, RAW_STAT_ORDER, type CourseGrade, type StatKey, type StatsSlot, type Training } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import type { AttrDef } from "../lib/types";

/* 模组编辑器 · 培训课程：每门课可给「八维能力」或「自定义属性」加成（下拉直接读本模组的属性表，改名自动同步）。
 * 课程说明（effect）按收益自动生成，作者也可手写覆盖。 */
type Range = [number, number];
const inp = "w-full min-w-0 rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const uid = () => `tr_${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`;

export default function ModTrainingsEditor({ value, stats, attrs, onChange, builtinFame = false }: {
  value?: Training[]; stats?: StatsSlot; attrs?: AttrDef[];
  /** 功能注释：作品基于娱乐圈底座时才露出内置「名气 / 口碑」字段 */
  builtinFame?: boolean;
  onChange: (v?: Training[]) => void;
}) {
  const list = value ?? [];
  // 可选属性：作者在属性里真正配置过（改过叫法或设了初值）且未停用的八维 + 自定义属性（键加 c: 前缀区分）；不再默认塞娱乐圈的演技等八维
  const hiddenKey = (stats?.hidden ?? []).join("|");
  const opts = useMemo(() => {
    const hidden = new Set(stats?.hidden ?? []);
    return [
      ...RAW_STAT_ORDER.filter((k) => !hidden.has(k) && (String(stats?.labels?.[k] ?? "").trim() || typeof stats?.base?.[k] === "number")).map((k) => ({ v: k as string, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
      ...(Array.isArray(attrs) ? attrs : []).map((a) => ({ v: `c:${a.id}`, l: a.label || a.id })),
    ];
  }, [attrs, hiddenKey, stats?.base, stats?.hidden, stats?.labels]);
  const enabled = useMemo(() => new Set(opts.map((o) => o.v)), [opts]);
  const optsKey = opts.map((o) => o.v).join("|");
  const labelOf = (v: string) => opts.find((o) => o.v === v)?.l ?? RAW_STAT_LABELS[v as StatKey] ?? v;
  const rawRows = (t: Training): { k: string; r: Range }[] => [
    ...Object.entries(t.gain ?? {}).filter(([, r]) => r).map(([k, r]) => ({ k, r: r as Range })),
    ...Object.entries(t.cgain ?? {}).map(([k, r]) => ({ k: `c:${k}`, r })),
  ];
  // 功能注释：只展示当前启用的属性；残留的演技等未启用项不渲染
  const rowsOf = (t: Training) => rawRows(t).filter(({ k }) => enabled.has(k));
  const packRows = (rows: { k: string; r: Range }[]) => {
    const gain: Partial<Record<StatKey, Range>> = {};
    const cgain: Record<string, Range> = {};
    for (const { k, r } of rows) {
      const rr: Range = [Math.min(r[0], r[1]), Math.max(r[0], r[1])];
      if (k.startsWith("c:")) cgain[k.slice(2)] = rr;
      else gain[k as StatKey] = rr;
    }
    return { gain, cgain: Object.keys(cgain).length ? cgain : undefined };
  };
  const autoEffect = (rows: { k: string; r: Range }[]) => rows.map(({ k, r }) => `${labelOf(k)} +${r[0]}${r[1] !== r[0] ? `~${r[1]}` : ""}`).join(" · ");
  const commit = (next: Training[]) => onChange(next.length ? next : undefined);
  const set = (i: number, p: Partial<Training>) => commit(list.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const setRows = (i: number, rows: { k: string; r: Range }[]) => {
    const kept = rows.filter(({ k }) => enabled.has(k));
    const t = list[i];
    const wasAuto = !t.effect || t.effect === autoEffect(rowsOf(t)) || t.effect === autoEffect(rawRows(t));
    set(i, { ...packRows(kept), ...(wasAuto ? { effect: autoEffect(kept) } : {}) });
  };
  const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));

  // 功能注释：属性停用后把残留 gain/cgain 从存档里清掉，避免界面再露出「演技（未启用）」
  const scrubbing = useRef(false);
  useEffect(() => {
    if (scrubbing.current || !list.length) return;
    let dirty = false;
    const next = list.map((t) => {
      const all = rawRows(t);
      const kept = all.filter(({ k }) => enabled.has(k));
      if (kept.length === all.length) return t;
      dirty = true;
      const wasAuto = !t.effect || t.effect === autoEffect(all);
      return { ...t, ...packRows(kept), ...(wasAuto ? { effect: autoEffect(kept) } : {}) };
    });
    if (!dirty) return;
    scrubbing.current = true;
    commit(next);
    scrubbing.current = false;
  }, [optsKey, list]); // eslint-disable-line react-hooks/exhaustive-deps -- 仅在启用集或列表变化时清残留

  const metricFields = (builtinFame
    ? [["cost", "学费"], ["energy", "体力"], ["stress", "压力"], ["fame", "名气"], ["reputation", "口碑"]]
    : [["cost", "学费"], ["energy", "体力"], ["stress", "压力"]]) as readonly (readonly ["cost" | "energy" | "stress" | "fame" | "reputation", string])[];

  return (
    <div className="space-y-1.5">
      {!list.length && <p className="text-[11.5px] text-ink-soft">还没有课程；点下方添加。开局不会套用娱乐圈表情/发声课表。</p>}
      {list.map((t, i) => {
        const rows = rowsOf(t);
        const used = new Set(rows.map((x) => x.k));
        const showFame = builtinFame || !!(t.fame || t.reputation);
        const fields = showFame
          ? ([["cost", "学费"], ["energy", "体力"], ["stress", "压力"], ["fame", "名气"], ["reputation", "口碑"]] as const)
          : metricFields;
        return (
          <div key={t.id} className="space-y-1 rounded-lg border border-line bg-paper p-2">
            <div className="flex items-center gap-1.5">
              <input className={inp} value={t.name} placeholder="课程名，如：表情训练" onChange={(e) => set(i, { name: e.target.value })} />
              <button className={`${btn} shrink-0`} onClick={() => commit(list.filter((_, j) => j !== i))} aria-label="删除课程">×</button>
            </div>
            <div className={`grid gap-1 ${fields.length > 3 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"}`}>
              {fields.map(([k, l]) => (
                <label key={k} className="block text-[10px] text-ink-soft">{l}
                  <input type="number" min={0} className={`${inp} mt-0.5`} value={(t[k] as number | undefined) ?? 0} onChange={(e) => set(i, { [k]: num(e.target.value) } as Partial<Training>)} />
                </label>
              ))}
            </div>
            {/* 收益：选属性 + 最小~最大 */}
            <div className="space-y-1">
              {rows.map((row, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <select className={`${inp} flex-1`} value={row.k} onChange={(e) => setRows(i, rows.map((x, j) => (j === ri ? { ...x, k: e.target.value } : x)))}>
                    {opts.map((o) => <option key={o.v} value={o.v} disabled={o.v !== row.k && used.has(o.v)}>{o.l}{o.v.startsWith("c:") ? "（自定义）" : ""}</option>)}
                  </select>
                  <span className="shrink-0 text-[11px] text-ink-soft">+</span>
                  <input type="number" className={`${inp} w-12 shrink-0`} value={row.r[0]} aria-label="最小加成" onChange={(e) => setRows(i, rows.map((x, j) => (j === ri ? { ...x, r: [Number(e.target.value) || 0, x.r[1]] } : x)))} />
                  <span className="shrink-0 text-[11px] text-ink-soft">~</span>
                  <input type="number" className={`${inp} w-12 shrink-0`} value={row.r[1]} aria-label="最大加成" onChange={(e) => setRows(i, rows.map((x, j) => (j === ri ? { ...x, r: [x.r[0], Number(e.target.value) || 0] } : x)))} />
                  <button className={`${btn} shrink-0`} onClick={() => setRows(i, rows.filter((_, j) => j !== ri))} aria-label="删除收益">×</button>
                </div>
              ))}
              {!opts.length && <p className="text-[11px] text-ink-soft">还没有可加成的属性，先到「属性」里添加自定义属性。</p>}
              <button className={btn} disabled={used.size >= opts.length} onClick={() => { const free = opts.find((o) => !used.has(o.v)); if (free) setRows(i, [...rows, { k: free.v, r: [1, 3] }]); }}>＋ 加一项收益</button>
            </div>
            <input className={inp} value={t.effect} placeholder="课程说明（留空自动生成）" onChange={(e) => set(i, { effect: e.target.value })} />
            <GradesEditor
              value={t.grades}
              reqOpts={[
                ...opts.filter((o) => !o.v.startsWith("c:")).map((o) => ({ v: `stat:${o.v}`, l: o.l })),
                ...FIXED_METRICS.filter((m) => !m.key.startsWith("c:") && m.key !== "week").map((m) => ({ v: m.key, l: m.label })),
                ...opts.filter((o) => o.v.startsWith("c:")),
              ]}
              onChange={(grades) => set(i, { grades })}
            />
          </div>
        );
      })}
      <button className={btn} onClick={() => commit([...list, { id: uid(), name: "新课程", effect: "", gain: {}, cost: 1000, energy: 6, stress: 1 }])}>＋ 添加课程</button>
    </div>
  );
}

/* 课程等级：名称、学费/收益倍率、能力上限，以及解锁条件（属性门槛 + 上一级完成次数） */
function GradesEditor({ value, reqOpts, onChange }: { value?: CourseGrade[]; reqOpts: { v: string; l: string }[]; onChange: (v?: CourseGrade[]) => void }) {
  const [open, setOpen] = useState(false);
  const list = value ?? [];
  const custom = list.length > 0;
  const commit = (next: CourseGrade[]) => onChange(next.length ? next : undefined);
  const set = (i: number, p: Partial<CourseGrade>) => commit(list.map((g, j) => (j === i ? { ...g, ...p } : g)));
  const n = (v: string) => Number(v) || 0;
  return (
    <div className="rounded-md border border-dashed border-line px-1.5 py-1">
      <button type="button" className="flex w-full items-center justify-between text-[11px] font-semibold text-ink" onClick={() => setOpen(!open)}>
        <span>等级与解锁 <span className="font-normal text-ink-soft">· {custom ? `${list.length} 级（自定义）` : "未设专属（用引擎通用等级）"}</span></span>
        <span className="text-ink-soft">{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {!custom && (
            // 功能注释：从空白等级起填，不复制某一打工剧本的 4 级学费曲线。
            <button className={btn} onClick={() => commit([{ id: `g_${Date.now().toString(36).slice(-5)}`, label: "", costMul: 0, gainMul: 0, cap: 0, stressAdd: 0 }])}>添加自定义等级（空白）</button>
          )}
          {list.map((g, i) => (
            <div key={g.id} className="space-y-1 rounded-md bg-paper-2 p-1.5">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-ink-soft">Lv{i + 1}</span>
                <input className={inp} value={g.label} placeholder="等级名" onChange={(e) => set(i, { label: e.target.value })} />
                <button className={`${btn} shrink-0`} onClick={() => commit(list.filter((_, j) => j !== i))} aria-label="删除等级">×</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {([["costMul", "学费×"], ["gainMul", "收益×"], ["cap", "能力上限"], ["stressAdd", "额外压力"]] as const).map(([k, l]) => (
                  <label key={k} className="block text-[10px] text-ink-soft">{l}
                    <input type="number" step={k.endsWith("Mul") ? 0.1 : 1} className={`${inp} mt-0.5`} value={g[k]} onChange={(e) => set(i, { [k]: n(e.target.value) } as Partial<CourseGrade>)} />
                  </label>
                ))}
              </div>
              {i > 0 && (
                <label className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
                  需先上完「{list[i - 1].label || `Lv${i}`}」
                  <input type="number" min={0} className={`${inp} w-14`} value={g.needPrev ?? 0} onChange={(e) => set(i, { needPrev: Math.max(0, Math.round(n(e.target.value))) || undefined })} />
                  次（0 = 不限）
                </label>
              )}
              {(g.reqs ?? []).map((r, ri) => (
                <div key={ri} className="flex items-center gap-1">
                  <select className={inp} value={r.metric} onChange={(e) => set(i, { reqs: g.reqs!.map((x, j) => (j === ri ? { ...x, metric: e.target.value } : x)) })}>
                    {!reqOpts.some((o) => o.v === r.metric) && <option value={r.metric}>{r.metric}（已删除）</option>}
                    {reqOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                  <span className="shrink-0 text-[11px] text-ink-soft">≥</span>
                  <input type="number" className={`${inp} w-14 shrink-0`} value={r.min} onChange={(e) => set(i, { reqs: g.reqs!.map((x, j) => (j === ri ? { ...x, min: n(e.target.value) } : x)) })} />
                  <button className={`${btn} shrink-0`} onClick={() => { const rs = g.reqs!.filter((_, j) => j !== ri); set(i, { reqs: rs.length ? rs : undefined }); }} aria-label="删除条件">×</button>
                </div>
              ))}
              <button className={btn} disabled={!reqOpts.length} onClick={() => set(i, { reqs: [...(g.reqs ?? []), { metric: reqOpts[0].v, min: 10 }] })}>＋ 解锁条件</button>
            </div>
          ))}
          {custom && (
            <div className="flex gap-1.5">
              <button className={btn} onClick={() => { const last = list[list.length - 1]; commit([...list, { id: `g_${Date.now().toString(36).slice(-5)}`, label: `Lv${list.length + 1}`, costMul: (last?.costMul ?? 1) * 2, gainMul: Math.max(0.1, (last?.gainMul ?? 1) * 0.75), cap: (last?.cap ?? 250) + 250, stressAdd: (last?.stressAdd ?? 0) + 1, needPrev: 3 }]); }}>＋ 添加等级</button>
              <button className={btn} onClick={() => commit([])}>恢复通用等级</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
