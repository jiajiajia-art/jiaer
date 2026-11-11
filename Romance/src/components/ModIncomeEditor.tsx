import { IconClose } from "../lib/icons";
import { STAT_LABELS, STAT_ORDER } from "../game/data";
import { FIXED_METRICS } from "../game/fixedEvents";
import type { FixedCond, IncomeRule } from "../lib/types";

/* 模组编辑器 · 周期收入：每次推进时间（周结算）按条件向数值发放固定/随机数额 */
type NumCond = Extract<FixedCond, { kind: "stat" | "metric" }>;
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const targets = () => [
  ...FIXED_METRICS.filter((m) => m.key !== "week").map((m) => ({ v: `metric:${m.key}`, l: m.label })),
  ...STAT_ORDER.map((k) => ({ v: `stat:${k}`, l: STAT_LABELS[k] })),
];
const label = (kind: string, key: string) => targets().find((t) => t.v === `${kind}:${key}`)?.l ?? key;
const parse = (v: string) => { const [kind, key] = v.split(":"); return { kind: kind as "stat" | "metric", key }; };
const uid = () => `inc_${Math.random().toString(36).slice(2, 8)}`;
const num = (v: string) => Number(v) || 0;

export default function ModIncomeEditor({ value, onChange }: { value?: IncomeRule[]; onChange: (v?: IncomeRule[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  const commit = (next: IncomeRule[]) => onChange(next.length ? next : undefined);
  const set = (id: string, p: Partial<IncomeRule>) => commit(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const conds = (r: IncomeRule) => (r.conds ?? []).filter((c): c is NumCond => c.kind === "stat" || c.kind === "metric");
  const setCond = (r: IncomeRule, i: number, p: Partial<NumCond>) => set(r.id, { conds: conds(r).map((c, j) => (j === i ? ({ ...c, ...p } as NumCond) : c)) });

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-ink-soft">每次主线推进时间（周结算）时逐条判定：条件全部满足即发放。最少 = 最多 为固定数额，否则在区间内随机；填负数即为周期支出。</p>
      <button className={btn} onClick={() => commit([...list, { id: uid(), label: "生活费", target: { kind: "metric", key: "money" }, min: 150, max: 150 }])}>＋ 添加规则</button>
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">未启用周期收入 · 如「口碑 ≥ 50 → 现金 80~120」</p>}

      {list.map((r) => {
        // 功能注释：AI 规则可能没有 target，缺省发到资金，避免 target.kind 崩页
        const target = r.target?.kind && r.target?.key ? r.target : { kind: "metric" as const, key: "money" };
        const min = typeof r.min === "number" ? r.min : 0;
        const max = typeof r.max === "number" ? r.max : min;
        return (
        <div key={r.id} className={`space-y-1.5 rounded-lg border border-line bg-paper p-2.5 ${r.enabled === false ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="accent-jade" checked={r.enabled !== false} onChange={(e) => set(r.id, { enabled: e.target.checked })} aria-label="启用" />
            <input className={inp} value={String(r.label ?? "")} onChange={(e) => set(r.id, { label: e.target.value })} placeholder="规则名" />
            <button className="text-[12px] text-ink-soft hover:text-coral" onClick={() => commit(list.filter((x) => x.id !== r.id))} aria-label="删除"><IconClose size={14} /></button>          </div>

          {conds(r).map((c, i) => (
            <div key={i} className="flex items-center gap-1 text-[11.5px] text-ink-soft">
              <span className="shrink-0">{i ? "且" : "当"}</span>
              <select className={inp} value={`${c.kind}:${c.key}`} onChange={(e) => setCond(r, i, parse(e.target.value))}>
                {targets().map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <select className={`${inp} w-14 shrink-0`} value={c.op} onChange={(e) => setCond(r, i, { op: e.target.value as "gte" | "lte" })}>
                <option value="gte">≥</option><option value="lte">≤</option>
              </select>
              <input type="number" className={`${inp} w-20 shrink-0`} value={c.value} onChange={(e) => setCond(r, i, { value: num(e.target.value) })} />
              <button className="shrink-0 hover:text-coral" onClick={() => set(r.id, { conds: conds(r).filter((_, j) => j !== i) })} aria-label="删除条件"><IconClose size={14} /></button>            </div>
          ))}
          <button className="text-[11px] font-semibold text-jade" onClick={() => set(r.id, { conds: [...conds(r), { kind: "metric", key: "reputation", op: "gte", value: 50 }] })}>＋ 条件{conds(r).length ? "" : "（不加 = 每周都发）"}</button>

          <div className="flex items-center gap-1 text-[11.5px] text-ink-soft">
            <span className="shrink-0">→</span>
            <select className={inp} value={`${target.kind}:${target.key}`} onChange={(e) => set(r.id, { target: parse(e.target.value) })}>
              {targets().map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <input type="number" className={`${inp} w-20 shrink-0`} value={min} onChange={(e) => set(r.id, { min: num(e.target.value) })} aria-label="最少" />
            <span>~</span>
            <input type="number" className={`${inp} w-20 shrink-0`} value={max} onChange={(e) => set(r.id, { max: num(e.target.value) })} aria-label="最多" />
          </div>
          <p className="text-right text-[10.5px] text-ink-soft">
            预览：{conds(r).length ? conds(r).map((c) => `${label(c.kind, c.key)}${c.op === "gte" ? "≥" : "≤"}${c.value}`).join(" 且 ") : "每周"} → {label(target.kind, target.key)} {min === max ? min : `${Math.min(min, max)}~${Math.max(min, max)}`}
          </p>
        </div>
      );})}
    </div>
  );
}
