import { FIXED_METRICS } from "../game/fixedEvents";
import type { AttrDef } from "../lib/types";
import { RAW_BILLS, RAW_STAT_LABELS, RAW_STAT_ORDER, type StatsSlot, RAW_FAME_TIERS, RAW_TITLES, type BillLine, type BillsSlot, type FameTier, type TitleDef, type TitleReq, type TitleTier } from "../game/data";

/* 模组编辑器 · 养成规则：名气分档、头衔（达成条件）、固定账单。留空 = 沿用默认。 */
const inp = "w-full min-w-0 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12px] text-ink placeholder:text-ink-soft/70 focus:border-jade focus:outline-none";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const head = "text-[12px] font-bold text-ink";
const num = (v: string) => Number(v) || 0;
const TIERS: TitleTier[] = ["青铜", "白银", "黄金", "钻石"];
const REQ_KEYS: [keyof TitleReq, string][] = [["fame", "名气"], ["reputation", "口碑"], ["works", "作品数"], ["awards", "奖项数"]];
const del = (on: () => void) => <button className={`${btn} shrink-0`} onClick={on} aria-label="删除">×</button>;

type V = { fameTiers?: FameTier[]; titles?: TitleDef[]; bills?: BillsSlot };
export default function ModRulesEditor({ value, stats, attrs, onChange }: { value: V; stats?: StatsSlot; attrs?: AttrDef[]; onChange: (p: V) => void }) {
  // 头衔「其他条件」可选：八维（模组叫法）、其余指标、自定义属性
  const hidden = new Set(stats?.hidden ?? []);
  const fixed = new Set(REQ_KEYS.map(([k]) => k as string));
  const extra = [
    ...RAW_STAT_ORDER.filter((k) => !hidden.has(k)).map((k) => ({ v: `stat:${k}`, l: (typeof stats?.labels?.[k] === "string" ? stats.labels![k]!.trim() : "") || RAW_STAT_LABELS[k] })),
    ...FIXED_METRICS.filter((m) => !m.key.startsWith("c:") && m.key !== "week" && !fixed.has(m.key)).map((m) => ({ v: m.key, l: m.label })),
    ...(attrs ?? []).map((a) => ({ v: `c:${a.id}`, l: `${a.label || a.id}（自定义）` })),
  ];
  const tiers = value.fameTiers ?? [];
  const titles = value.titles ?? [];
  const bills = value.bills;
  const setTiers = (n: FameTier[]) => onChange({ fameTiers: n.length ? [...n].sort((a, b) => a.min - b.min) : undefined });
  const setTitles = (n: TitleDef[]) => onChange({ titles: n.length ? n : undefined });
  const setBills = (k: keyof BillsSlot, n: BillLine[]) => onChange({ bills: { ...(bills ?? {}), [k]: n } });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className={head}>名气分档 <span className="font-normal text-ink-soft">· 名气达到下限即进入该档</span></p>
        {!tiers.length && <button className={btn} onClick={() => setTiers(RAW_FAME_TIERS.map((t) => ({ ...t })))}>以默认分档为起点自定义</button>}
        {tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input type="number" className={`${inp} w-16 shrink-0`} value={t.min} aria-label="下限" onBlur={() => setTiers(tiers)} onChange={(e) => onChange({ fameTiers: tiers.map((x, j) => (j === i ? { ...x, min: num(e.target.value) } : x)) })} />
            <input className={`${inp} w-28 shrink-0`} value={t.label} placeholder="档名" onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input className={inp} value={t.desc} placeholder="说明" onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} />
            {del(() => setTiers(tiers.filter((_, j) => j !== i)))}
          </div>
        ))}
        {tiers.length > 0 && <button className={btn} onClick={() => setTiers([...tiers, { min: (tiers[tiers.length - 1]?.min ?? 0) + 100, label: "新分档", desc: "" }])}>＋ 添加分档</button>}
      </div>

      <div className="space-y-1.5">
        <p className={head}>头衔 <span className="font-normal text-ink-soft">· 条件全部满足即自动获得</span></p>
        {!titles.length && <button className={btn} onClick={() => setTitles(RAW_TITLES.map((t) => ({ ...t, req: { ...t.req } })))}>以默认头衔为起点自定义</button>}
        {titles.map((t, i) => {
          const set = (p: Partial<TitleDef>) => setTitles(titles.map((x, j) => (j === i ? { ...x, ...p } : x)));
          return (
            <div key={t.id} className="space-y-1 rounded-xl border border-line bg-paper p-2">
              <div className="flex items-center gap-1.5">
                <input className={inp} value={t.name} placeholder="头衔名" onChange={(e) => set({ name: e.target.value })} />
                <select className={`${inp} w-20 shrink-0`} value={t.tier} onChange={(e) => set({ tier: e.target.value as TitleTier })}>
                  {TIERS.map((x) => <option key={x}>{x}</option>)}
                </select>
                {del(() => setTitles(titles.filter((_, j) => j !== i)))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {REQ_KEYS.map(([k, l]) => (
                  <label key={k} className="block text-[10px] text-ink-soft">{l} ≥
                    <input type="number" className={`${inp} mt-0.5`} value={t.req[k] ?? ""} placeholder="不限" onChange={(e) => { const req = { ...t.req }; if (e.target.value === "") delete req[k]; else req[k] = num(e.target.value); set({ req }); }} />
                  </label>
                ))}
              </div>
              {Object.entries(t.req).filter(([k]) => !fixed.has(k)).map(([k, v]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <select className={inp} value={k} onChange={(e) => { const req = { ...t.req }; delete req[k]; req[e.target.value] = v; set({ req }); }}>
                    {!extra.some((o) => o.v === k) && <option value={k}>{k}（已删除）</option>}
                    {extra.map((o) => <option key={o.v} value={o.v} disabled={o.v !== k && o.v in t.req}>{o.l}</option>)}
                  </select>
                  <span className="shrink-0 text-[11px] text-ink-soft">≥</span>
                  <input type="number" className={`${inp} w-16 shrink-0`} value={v ?? 0} onChange={(e) => set({ req: { ...t.req, [k]: num(e.target.value) } })} />
                  {del(() => { const req = { ...t.req }; delete req[k]; set({ req }); })}
                </div>
              ))}
              <button className={btn} disabled={!extra.some((o) => !(o.v in t.req))} onClick={() => { const f = extra.find((o) => !(o.v in t.req)); if (f) set({ req: { ...t.req, [f.v]: 10 } }); }}>＋ 其他条件（八维 / 自定义属性等）</button>
              <input className={inp} value={t.desc} placeholder="说明（显示给玩家）" onChange={(e) => set({ desc: e.target.value })} />
            </div>
          );
        })}
        {titles.length > 0 && <button className={btn} onClick={() => setTitles([...titles, { id: `t_${Date.now().toString(36).slice(-5)}`, name: "新头衔", tier: "青铜", req: { fame: 50 }, desc: "" }])}>＋ 添加头衔</button>}
      </div>

      <div className="space-y-1.5">
        <p className={head}>固定账单 <span className="font-normal text-ink-soft">· 每周 / 每 4 周自动扣款</span></p>
        {!bills && <button className={btn} onClick={() => onChange({ bills: JSON.parse(JSON.stringify(RAW_BILLS)) })}>以默认账单为起点自定义</button>}
        {bills && (["weekly", "monthly"] as const).map((k) => {
          const lines = bills[k] ?? [];
          return (
            <div key={k} className="space-y-1">
              <p className="text-[11px] text-ink-soft">{k === "weekly" ? "每周" : "每 4 周"}</p>
              {lines.map((b, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input className={inp} value={b.label} placeholder="项目" onChange={(e) => setBills(k, lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <input type="number" className={`${inp} w-24 shrink-0`} value={b.amount} onChange={(e) => setBills(k, lines.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)))} />
                  {del(() => setBills(k, lines.filter((_, j) => j !== i)))}
                </div>
              ))}
              <button className={btn} onClick={() => setBills(k, [...lines, { label: "", amount: 1000 }])}>＋ 添加</button>
            </div>
          );
        })}
        {bills && <button className={btn} onClick={() => onChange({ bills: undefined })}>恢复默认账单</button>}
      </div>
    </div>
  );
}
