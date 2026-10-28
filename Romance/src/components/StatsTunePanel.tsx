import { useMemo, useState } from "react";
import { SectionHead } from "./ui";
import { ColorPick, Dirty, Help } from "./EditorKit";
import { BlockBar, toneChip } from "./ui";
import { importModJson, toggleAddon, useMods } from "../mods/registry";
import { RAW_FAME_TIERS, RAW_LOOKS_TIERS, RAW_STAT_LABELS, RAW_STAT_ORDER, RAW_STATS_BASE, type FameTier, type StatKey, type StatsSlot } from "../game/data";
import type { Mod } from "../mods/types";
import { StatusMark } from "../lib/icons";

/* 数值调校：为所选世界观生成 / 编辑一个叠加包「tune-<世界id>」，可改八维叫法·初值·顺序、
 * 名气/容貌/压力叫法、名气分档、容貌分档。保存即启用，开新局生效。 */

type Draft = {
  labels: Record<StatKey, string>;
  base: Record<StatKey, number>;
  order: StatKey[];
  hidden: StatKey[];
  range: Record<StatKey, { min: number; max: number }>;
  colors: Partial<Record<StatKey, string>>;
  tiers: Partial<Record<StatKey, FameTier[]>>;
  meta: { fame: string; looks: string; stress: string };
  fame: FameTier[];
  looks: FameTier[];
};

function initial(world: Mod | undefined, tune: Mod | undefined): Draft {
  const w = (world?.content.stats ?? {}) as StatsSlot;
  const t = (tune?.content.stats ?? {}) as StatsSlot;
  const pick = <T,>(a: T | undefined, b: T | undefined, c: T) => a ?? b ?? c;
  const order = pick(t.order, w.order, RAW_STAT_ORDER);
  return {
    labels: { ...RAW_STAT_LABELS, ...(w.labels ?? {}), ...(t.labels ?? {}) },
    base: { ...RAW_STATS_BASE, ...(w.base ?? {}), ...(t.base ?? {}) },
    order: [...order, ...RAW_STAT_ORDER.filter((k) => !order.includes(k))],
    hidden: [...(t.hidden ?? w.hidden ?? [])],
    range: Object.fromEntries(RAW_STAT_ORDER.map((k) => [k, { min: 0, max: 999, ...(w.range?.[k] ?? {}), ...(t.range?.[k] ?? {}) }])) as Draft["range"],
    colors: { ...(w.colors ?? {}), ...(t.colors ?? {}) },
    tiers: Object.fromEntries(Object.entries({ ...(w.tiers ?? {}), ...(t.tiers ?? {}) }).map(([k, l]) => [k, (l ?? []).map((x) => ({ ...x }))])),
    meta: { fame: "名气", looks: "容貌", stress: "压力", ...(w.metaLabels ?? {}), ...(t.metaLabels ?? {}) } as Draft["meta"],
    fame: [...(tune?.content.fameTiers ?? world?.content.fameTiers ?? RAW_FAME_TIERS)].map((x) => ({ ...x })),
    looks: [...(t.looksTiers ?? w.looksTiers ?? RAW_LOOKS_TIERS)].map((x) => ({ ...x })),
  };
}

const inp = "min-w-0 rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";

function Tiers({ title, list, onChange, minLen = 1, step = 100 }: { title: string; list: FameTier[]; onChange: (l: FameTier[]) => void; minLen?: number; step?: number }) {
  const set = (i: number, p: Partial<FameTier>) => onChange(list.map((t, j) => (j === i ? { ...t, ...p } : t)));
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-bold text-ink">{title}<span className="ml-1 font-normal text-ink-soft">（达到门槛即进入该档）</span></p>
      {list.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-1.5">
          <input type="number" min={0} value={t.min} onChange={(e) => set(i, { min: Math.max(0, Number(e.target.value) || 0) })} className={`${inp} w-16`} aria-label="门槛" />
          <input value={t.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="档位名" className={`${inp} w-24`} />
          <input value={t.desc} onChange={(e) => set(i, { desc: e.target.value })} placeholder="说明（可空）" className={`${inp} min-w-[6rem] flex-1`} />
          <button className={btn} disabled={list.length <= minLen} onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="删除档位">×</button>
        </div>
      ))}
      <button className={btn} onClick={() => onChange([...list, { min: list.length ? Math.max(...list.map((x) => x.min)) + step : 0, label: "新档位", desc: "" }])}>＋ 添加档位</button>
    </div>
  );
}

export default function StatsTunePanel() {
  const { mods, selection } = useMods();
  const world = mods.find((m) => m.id === selection.world);
  const tuneId = `tune-${selection.world}`;
  const tune = mods.find((m) => m.id === tuneId);
  const seed = useMemo(() => initial(world, tune), [world, tune]);
  const [d, setD] = useState<Draft>(seed);
  const [key, setKey] = useState(`${selection.world}:${tune?.version}`);
  const [open, setOpen] = useState<StatKey | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (key !== `${selection.world}:${tune?.version}`) { setKey(`${selection.world}:${tune?.version}`); setD(seed); }
  const dirty = JSON.stringify(d) !== JSON.stringify(seed);
  const emptyLabel = RAW_STAT_ORDER.some((k) => !d.hidden.includes(k) && !d.labels[k].trim());

  const move = (i: number, dir: -1 | 1) => {
    const o = [...d.order]; const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    setD({ ...d, order: o });
  };

  const save = () => {
    const errs: string[] = [];
    if (RAW_STAT_ORDER.some((k) => !d.hidden.includes(k) && !d.labels[k].trim())) errs.push("八维叫法不能为空");
    for (const k of RAW_STAT_ORDER) {
      const g = d.range[k], n = d.labels[k] || k;
      if (g.min >= g.max) errs.push(`${n}的下限须小于上限`);
      if (d.base[k] < g.min || d.base[k] > g.max) errs.push(`${n}的初值须在 ${g.min}~${g.max} 之间`);
      const l = d.tiers[k] ?? [];
      if (l.some((t) => !t.label.trim())) errs.push(`${n}分档有空的档位名`);
      if (new Set(l.map((t) => t.min)).size !== l.length) errs.push(`${n}分档门槛有重复`);
    }
    for (const [n, l] of [["名气分档", d.fame], ["容貌分档", d.looks]] as const) {
      if (l.some((t) => !t.label.trim())) errs.push(`${n}有空的档位名`);
      if (new Set(l.map((t) => t.min)).size !== l.length) errs.push(`${n}门槛有重复`);
    }
    if (errs.length) { setMsg({ ok: false, text: errs.join("；") }); return; }
    const sort = (l: FameTier[]) => [...l].sort((a, b) => a.min - b.min).map((t) => ({ ...t, label: t.label.trim() }));
    const v = tune ? tune.version.replace(/(\d+)$/, (n) => String(Number(n) + 1)) : "1.0.0";
    const mod = {
      id: tuneId, name: `${world?.name ?? selection.world} · 数值调校`, version: v, kind: "addon",
      description: "由「数值调校」编辑器生成：八维、名气/容貌分档", dependencies: [selection.world],
      content: {
        stats: {
          labels: d.labels, base: d.base, order: d.order, hidden: d.hidden, metaLabels: d.meta, looksTiers: sort(d.looks),
          range: d.range, colors: d.colors,
          tiers: Object.fromEntries(Object.entries(d.tiers).filter(([, l]) => l?.length).map(([k, l]) => [k, sort(l!)])),
          display: (tune?.content.stats as StatsSlot | undefined)?.display ?? (world?.content.stats as StatsSlot | undefined)?.display ?? (Object.values(d.tiers).some((l) => l?.length) ? "both" : undefined),
        },
        fameTiers: sort(d.fame),
      },
    };
    const r = importModJson(JSON.stringify(mod));
    if (!r.ok) { setMsg({ ok: false, text: r.errors.join("；") }); return; }
    if (!selection.addons.includes(tuneId)) toggleAddon(tuneId, true);
    setMsg({ ok: true, text: "已保存并启用（下次开新局生效）" });
  };

  return (
    <div className="space-y-3 text-ink">
      <SectionHead code="STATS" cn="数值调校" hint={`作用于「${world?.name ?? selection.world}」`} right={<Dirty on={dirty} />} />
      <p className="text-[12px] leading-relaxed text-ink-soft">能力项数量不限：内置最多八个槽，可停用不需要的（点「启用」切换），可改叫法、初值、顺序；还想要更多就在「角色属性」里自定义添加，以及名气 / 容貌的分档。保存后生成叠加包「{tuneId}」并自动启用，可在上方开关或导出分享。</p>

      <div className="space-y-1.5">
        <div className="flex gap-1.5 text-[10.5px] text-ink-soft"><span className="w-14 shrink-0">内部键</span><span className="flex-1">显示叫法</span><span className="w-16">开局初值</span><span className="w-[60px]">顺序</span><span className="w-12">启用</span></div>
        {d.order.map((k, i) => (
          <div key={k} className={`flex items-center gap-1.5 ${d.hidden.includes(k) ? "opacity-45" : ""}`}>
            <span className="w-14 shrink-0 font-mono text-[10.5px] text-ink-soft">{k}</span>
            <input value={d.labels[k]} onChange={(e) => setD({ ...d, labels: { ...d.labels, [k]: e.target.value } })} className={`${inp} flex-1 ${d.labels[k].trim() ? "" : "!border-danger"}`} aria-label={`${k} 叫法`} />
            <input type="number" min={d.range[k].min} max={d.range[k].max} value={d.base[k]} onChange={(e) => setD({ ...d, base: { ...d.base, [k]: Math.min(d.range[k].max, Math.max(d.range[k].min, Number(e.target.value) || 0)) } })} className={`${inp} w-16`} aria-label={`${k} 初值`} />
            <button className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="上移">↑</button>
            <button className={btn} disabled={i === d.order.length - 1} onClick={() => move(i, 1)} aria-label="下移">↓</button>
            <button className={`${btn} w-12 ${d.hidden.includes(k) ? "" : "!border-jade !text-jade"}`} disabled={!d.hidden.includes(k) && d.hidden.length >= 7} onClick={() => setD({ ...d, hidden: d.hidden.includes(k) ? d.hidden.filter((x) => x !== k) : [...d.hidden, k] })}>{d.hidden.includes(k) ? "停用" : "启用"}</button>
            <button className={`${btn} ${open === k ? "!border-jade !text-jade" : ""}`} onClick={() => setOpen(open === k ? null : k)} aria-label={`${k} 详细设置`}>{open === k ? "收起" : "范围·分档"}</button>
          </div>
        ))}
      </div>

      {open && (() => {
        const k = open, g = d.range[k], l = d.tiers[k] ?? [], col = d.colors[k];
        const setR = (p: Partial<{ min: number; max: number }>) => {
          const n = { ...g, ...p };
          setD({ ...d, range: { ...d.range, [k]: n }, base: { ...d.base, [k]: Math.min(n.max, Math.max(n.min, d.base[k])) } });
        };
        const sorted = [...l].sort((a, b) => a.min - b.min);
        const cur = [...sorted].reverse().find((t) => d.base[k] >= t.min) ?? sorted[0];
        return (
          <div className="space-y-3 rounded-lg border border-jade/40 bg-paper-2 p-3">
            <p className="text-[12.5px] font-bold text-ink">「{d.labels[k] || k}」详细设置</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-ink-soft">最小值<input type="number" min={0} value={g.min} onChange={(e) => setR({ min: Math.max(0, Number(e.target.value) || 0) })} className={`${inp} mt-0.5 w-full ${g.min >= g.max ? "!border-danger" : ""}`} /></label>
              <label className="text-[11px] text-ink-soft">最大值<input type="number" min={1} value={g.max} onChange={(e) => setR({ max: Math.max(1, Number(e.target.value) || 0) })} className={`${inp} mt-0.5 w-full ${g.min >= g.max ? "!border-danger" : ""}`} /></label>
            </div>
            <div>
              <p className="mb-1 text-[11px] text-ink-soft">颜色</p>
              <ColorPick value={col} onChange={(c) => { const cs = { ...d.colors }; if (c) cs[k] = c; else delete cs[k]; setD({ ...d, colors: cs }); }} />
            </div>
            <Tiers title={`${d.labels[k] || k}分档`} list={l} minLen={0} step={Math.max(1, Math.round((g.max - g.min) / 5))} onChange={(nl) => setD({ ...d, tiers: { ...d.tiers, [k]: nl } })} />
            {!l.length && (
              <button className={btn} onClick={() => setD({ ...d, tiers: { ...d.tiers, [k]: ["入门", "熟练", "精通", "大成", "登峰造极"].map((label, i) => ({ min: Math.round(g.min + ((g.max - g.min) / 5) * i), label, desc: "" })) } })}>一键均分五档</button>
            )}
            <div className="rounded-lg border border-line bg-paper p-2">
              <p className="mb-1 text-[10.5px] text-ink-soft">预览（按开局初值 {d.base[k]}）</p>
              <div className="flex items-center gap-2 text-[12.5px]">
                <span className="w-14 shrink-0 text-ink">{d.labels[k] || k}</span>
                <BlockBar value={d.base[k]} min={g.min} max={g.max} tone={col} />
                {cur && <span className="shrink-0 rounded-full border px-1.5 text-[10.5px] font-bold" style={toneChip(col)}>{cur.label}</span>}
                <span className="w-9 shrink-0 text-right tabular-nums text-ink">{d.base[k]}</span>
              </div>
              {sorted.length > 0 && <p className="mt-1 text-[10.5px] text-ink-soft">{sorted.map((t) => `${t.min}+ ${t.label}`).join(" → ")}</p>}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-3 gap-1.5">
        {(["fame", "looks", "stress"] as const).map((k) => (
          <label key={k} className="text-[11px] text-ink-soft">
            {{ fame: "名气", looks: "容貌", stress: "压力" }[k]}叫法
            <input value={d.meta[k]} onChange={(e) => setD({ ...d, meta: { ...d.meta, [k]: e.target.value } })} className={`${inp} mt-0.5 w-full`} />
          </label>
        ))}
      </div>

      {emptyLabel && <p className="text-[11px] text-danger">八维叫法不能为空（红框处）。</p>}
      <p className="text-[11.5px] text-ink-soft">当前启用 {8 - d.hidden.length} 项能力{d.hidden.length ? `，已停用 ${d.hidden.map((k) => d.labels[k] || k).join("、")}` : ""}。</p>
      <Help>点每项右侧「范围·分档」可改该能力的最小 / 最大值、颜色与分档；初值须落在范围内。分档按门槛从低到高自动排序，门槛不可重复。</Help>
      <Tiers title={`${d.meta.fame}分档`} list={d.fame} onChange={(fame) => setD({ ...d, fame })} />
      <Tiers title={`${d.meta.looks}分档`} list={d.looks} onChange={(looks) => setD({ ...d, looks })} />

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={save} disabled={emptyLabel} className="rounded-full bg-jade px-4 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40">保存并启用</button>
        {dirty && <button className={btn} onClick={() => { setD(seed); setMsg(null); }}>放弃修改</button>}
        <button className={btn} onClick={() => { setD(initial(world, undefined)); setMsg(null); }}>恢复世界观默认</button>
        {msg && <span className={`text-[12px] ${msg.ok ? "text-jade" : "text-danger"}`}><StatusMark kind={msg.ok ? "ok" : "warn"}>{msg.text}</StatusMark></span>}
      </div>
    </div>
  );
}
