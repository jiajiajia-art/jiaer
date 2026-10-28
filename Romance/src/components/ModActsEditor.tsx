import { RAW_SIDE_JOBS, RAW_STAT_LABELS, RAW_STAT_ORDER, RAW_WEEKEND_ACTS, type GradeReq, type SideJob, type StatsSlot, type WeekendAct } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import type { AttrDef } from "../lib/types";

/* 模组编辑器 · 打工 / 周末活动：名称、收支、压力、自定义属性收益，以及解锁条件（任意属性门槛 + 打工前一档完成次数） */
type Range = [number, number];
type Opt = { v: string; l: string };
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const uid = (p: string) => `${p}_${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`;
const num = (v: string) => Number(v) || 0;

function ReqRows({ value, opts, onChange }: { value?: GradeReq[]; opts: Opt[]; onChange: (v?: GradeReq[]) => void }) {
  const list = value ?? [];
  const commit = (n: GradeReq[]) => onChange(n.length ? n : undefined);
  return (
    <div className="space-y-1">
      {list.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="shrink-0 text-[10.5px] text-ink-soft">解锁</span>
          <select className={inp} value={r.metric} onChange={(e) => commit(list.map((x, j) => (j === i ? { ...x, metric: e.target.value } : x)))}>
            {!opts.some((o) => o.v === r.metric) && <option value={r.metric}>{r.metric}（已删除）</option>}
            {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <span className="shrink-0 text-[11px] text-ink-soft">≥</span>
          <input type="number" className={`${inp} w-16 shrink-0`} value={r.min} onChange={(e) => commit(list.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)))} />
          <button className={`${btn} shrink-0`} onClick={() => commit(list.filter((_, j) => j !== i))} aria-label="删除条件">×</button>
        </div>
      ))}
      <button className={btn} disabled={!opts.length} onClick={() => commit([...list, { metric: opts[0].v, min: 10 }])}>＋ 解锁条件</button>
    </div>
  );
}

function GainRows({ value, attrs, onChange }: { value?: Record<string, Range>; attrs: AttrDef[]; onChange: (v?: Record<string, Range>) => void }) {
  const rows = Object.entries(value ?? {});
  const commit = (r: [string, Range][]) => onChange(r.length ? Object.fromEntries(r) : undefined);
  if (!attrs.length) return null;
  const used = new Set(rows.map(([k]) => k));
  return (
    <div className="space-y-1">
      {rows.map(([k, r], i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select className={inp} value={k} onChange={(e) => commit(rows.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}>
            {!attrs.some((a) => a.id === k) && <option value={k}>{k}（已删除）</option>}
            {attrs.map((a) => <option key={a.id} value={a.id} disabled={a.id !== k && used.has(a.id)}>{a.label || a.id}</option>)}
          </select>
          <span className="shrink-0 text-[11px] text-ink-soft">+</span>
          <input type="number" className={`${inp} w-14 shrink-0`} value={r[0]} onChange={(e) => commit(rows.map((x, j) => (j === i ? [x[0], [num(e.target.value), x[1][1]]] : x)))} />
          <span className="shrink-0 text-[11px] text-ink-soft">~</span>
          <input type="number" className={`${inp} w-14 shrink-0`} value={r[1]} onChange={(e) => commit(rows.map((x, j) => (j === i ? [x[0], [x[1][0], num(e.target.value)]] : x)))} />
          <button className={`${btn} shrink-0`} onClick={() => commit(rows.filter((_, j) => j !== i))} aria-label="删除收益">×</button>
        </div>
      ))}
      <button className={btn} disabled={used.size >= attrs.length} onClick={() => { const f = attrs.find((a) => !used.has(a.id)); if (f) commit([...rows, [f.id, [1, 3]]]); }}>＋ 自定义属性收益</button>
    </div>
  );
}

export default function ModActsEditor({ jobs, acts, stats, attrs, onChange }: {
  jobs?: SideJob[]; acts?: WeekendAct[]; stats?: StatsSlot; attrs?: AttrDef[];
  onChange: (p: { sideJobs?: SideJob[]; weekendActs?: WeekendAct[] }) => void;
}) {
  const hidden = new Set(stats?.hidden ?? []);
  const opts: Opt[] = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...FIXED_METRICS.filter((m) => !m.key.startsWith("c:") && m.key !== "week").map((m) => ({ v: m.key, l: m.label })),
    ...(attrs ?? []).map((a) => ({ v: `c:${a.id}`, l: `${a.label || a.id}（自定义）` })),
  ];
  const jl = jobs ?? [];
  const al = acts ?? [];
  const setJobs = (n: SideJob[]) => onChange({ sideJobs: n.length ? n : undefined });
  const setActs = (n: WeekendAct[]) => onChange({ weekendActs: n.length ? n : undefined });
  const pj = (i: number, p: Partial<SideJob>) => setJobs(jl.map((j, k) => (k === i ? { ...j, ...p } : j)));
  const pa = (i: number, p: Partial<WeekendAct>) => setActs(al.map((a, k) => (k === i ? { ...a, ...p } : a)));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[12px] font-bold text-ink">打工 <span className="font-normal text-ink-soft">· 按列表顺序为档位，可要求上一档先做满 N 次</span></p>
        {!jl.length && <button className={btn} onClick={() => setJobs(RAW_SIDE_JOBS.map((j) => ({ ...j })))}>以默认 4 档为起点自定义</button>}
        {jl.map((j, i) => (
          <div key={j.id} className="space-y-1.5 rounded-xl border border-line bg-paper p-2.5">
            <div className="flex items-center gap-1.5">
              <input className={inp} value={j.label} placeholder="名称，如：便利店夜班" onChange={(e) => pj(i, { label: e.target.value })} />
              <button className={`${btn} shrink-0`} onClick={() => setJobs(jl.filter((_, k) => k !== i))} aria-label="删除">×</button>
            </div>
            <input className={inp} value={j.note} placeholder="说明" onChange={(e) => pj(i, { note: e.target.value })} />
            <div className="grid grid-cols-3 gap-1.5">
              {([["pay", "收入"], ["stress", "压力"], ["fameReq", "名气门槛"]] as const).map(([k, l]) => (
                <label key={k} className="block text-[10.5px] text-ink-soft">{l}
                  <input type="number" className={`${inp} mt-0.5`} value={j[k]} onChange={(e) => pj(i, { [k]: num(e.target.value) } as Partial<SideJob>)} />
                </label>
              ))}
            </div>
            {i > 0 && (
              <label className="flex items-center gap-1.5 text-[10.5px] text-ink-soft">
                需先做满「{jl[i - 1].label}」
                <input type="number" min={0} className={`${inp} w-14`} value={j.needPrev ?? 0} onChange={(e) => pj(i, { needPrev: Math.max(0, Math.round(num(e.target.value))) || undefined })} />
                次
              </label>
            )}
            <GainRows value={j.cgain} attrs={attrs ?? []} onChange={(cgain) => pj(i, { cgain })} />
            <ReqRows value={j.reqs} opts={opts} onChange={(reqs) => pj(i, { reqs })} />
          </div>
        ))}
        {jl.length > 0 && <button className={btn} onClick={() => setJobs([...jl, { id: uid("sj"), label: "新打工", pay: 3000, stress: 4, fameReq: 0, note: "", needPrev: jl.length ? 3 : undefined }])}>＋ 添加打工</button>}
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-bold text-ink">周末活动</p>
        {!al.length && <button className={btn} onClick={() => setActs(RAW_WEEKEND_ACTS.map((a) => ({ ...a })))}>以默认活动为起点自定义</button>}
        {al.map((a, i) => (
          <div key={a.id} className="space-y-1.5 rounded-xl border border-line bg-paper p-2.5">
            <div className="flex items-center gap-1.5">
              <input className={inp} value={a.name} placeholder="活动名" onChange={(e) => pa(i, { name: e.target.value })} />
              <button className={`${btn} shrink-0`} onClick={() => setActs(al.filter((_, k) => k !== i))} aria-label="删除">×</button>
            </div>
            <input className={inp} value={a.effect} placeholder="效果说明" onChange={(e) => pa(i, { effect: e.target.value })} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {([["cost", "花费"], ["stress", "压力"], ["fame", "名气"], ["reputation", "口碑"]] as const).map(([k, l]) => (
                <label key={k} className="block text-[10.5px] text-ink-soft">{l}
                  <input type="number" className={`${inp} mt-0.5`} value={(a[k] as number | undefined) ?? 0} onChange={(e) => pa(i, { [k]: num(e.target.value) } as Partial<WeekendAct>)} />
                </label>
              ))}
            </div>
            <GainRows value={a.cgain} attrs={attrs ?? []} onChange={(cgain) => pa(i, { cgain })} />
            <ReqRows value={a.reqs} opts={opts} onChange={(reqs) => pa(i, { reqs })} />
          </div>
        ))}
        {al.length > 0 && <button className={btn} onClick={() => setActs([...al, { id: uid("wk"), name: "新活动", effect: "", icon: "", cost: 0, energy: 0, stress: -4 }])}>＋ 添加活动</button>}
      </div>
    </div>
  );
}
