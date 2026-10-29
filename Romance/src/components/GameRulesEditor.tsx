import { normalizeRuleBranches } from "../lib/gameRuleShape";
import { IconClose } from "../lib/icons";
import { CondRow, EffectRow, defaultCond, defaultEffect } from "./FixedEventsPanel";
import { condsBrief, effectBrief } from "./ruleText";
import type { FixedCond, FixedEffect, FixedEvent, GameRule, RuleBranch } from "../lib/types";

/* 模组编辑器 · 玩法规则：「如果…否则如果…否则」自由组合。
 * 每天结束 / 每周结算时逐条判定，分支按顺序比对，命中第一个即执行。
 * 规则变量（flag）可在规则之间、规则与事件之间传递状态，组合出连击、计数、阶段等玩法。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const link = "text-[11.5px] font-semibold text-jade hover:underline";
const uid = () => `gr_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
const WHEN: Record<GameRule["when"], string> = { day: "每天结束", week: "每周结算" };

const m = (key: string, opv: "gte" | "lte", value: number): FixedCond => ({ kind: "metric", key, op: opv, value });
const TEMPLATES: { name: string; desc: string; make: () => Omit<GameRule, "id"> }[] = [
  { name: "过劳惩罚", desc: "精力见底的那天压力陡增", make: () => ({ name: "过劳惩罚", when: "day", branches: [{ conds: [m("energy", "lte", 15)], effects: [{ kind: "metric", key: "stress", delta: 8 }], notice: "体力透支，压力陡增" }] }) },
  { name: "名气分段流动", desc: "按名气高低给不同的周增长", make: () => ({ name: "名气自然流动", when: "week", branches: [
    { conds: [m("fame", "gte", 500)], effects: [{ kind: "metric", key: "fame", delta: 12 }], notice: "热度持续发酵" },
    { conds: [m("fame", "gte", 100)], effects: [{ kind: "metric", key: "fame", delta: 4 }], notice: "小有名气" },
    { conds: [], effects: [{ kind: "metric", key: "fame", delta: 1 }] },
  ] }) },
  { name: "高压计数", desc: "用规则变量累计连续高压天数", make: () => ({ name: "高压计数", when: "day", branches: [
    { conds: [m("stress", "gte", 70)], effects: [{ kind: "flag", key: "高压天数", delta: 1 }] },
    { conds: [], effects: [{ kind: "flag", key: "高压天数", delta: 0, set: true }] },
  ] }) },
  { name: "长期高压警报", desc: "配合「高压计数」：连续 5 天高压就罚", make: () => ({ name: "长期高压警报", when: "day", cooldown: 7, branches: [
    { conds: [{ kind: "flag", key: "高压天数", op: "gte", value: 5 }], effects: [{ kind: "metric", key: "reputation", delta: -3 }, { kind: "flag", key: "高压天数", delta: 0, set: true }], notice: "长期高压，状态下滑被人看在眼里" },
  ] }) },
  { name: "幸运日", desc: "每天 10% 概率小赚一笔", make: () => ({ name: "幸运日", when: "day", chance: 10, branches: [{ conds: [], effects: [{ kind: "metric", key: "money", delta: 200 }], notice: "路边捡到一张中奖彩票" }] }) },
];

function BranchCard({ b, idx, total, events, onChange, onDelete }: { b: RuleBranch; idx: number; total: number; events: FixedEvent[]; onChange: (b: RuleBranch) => void; onDelete?: () => void }) {
  const conds = Array.isArray(b.conds) ? b.conds : [];
  const effects = Array.isArray(b.effects) ? b.effects : [];
  const isElse = idx > 0 && !conds.length;
  const head = idx === 0 ? (conds.length ? "如果" : "总是") : isElse ? "否则" : "否则如果";
  return (
    <div className={`relative space-y-1.5 rounded-xl border-l-[3px] bg-paper/60 py-2 pl-3 pr-2 ${isElse ? "border-gold/70" : "border-jade/70"}`}>
      <div className="flex items-center gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-black tracking-[0.1em] ${isElse ? "bg-gold/15 text-gold" : "bg-jade/15 text-jade"}`}>{head}</span>
        {conds.length > 1 && (
          <select className="rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[11.5px]" value={b.match ?? "all"} onChange={(e) => onChange({ ...b, match: e.target.value as "all" | "any" })}>
            <option value="all">全部满足</option><option value="any">任一满足</option>
          </select>
        )}
        <span className="ml-auto text-[10.5px] text-ink-soft">分支 {idx + 1}/{total}</span>
        {onDelete && <button className="text-[12px] text-ink-soft hover:text-danger" onClick={onDelete} aria-label="删除分支"><IconClose size={14} /></button>}
      </div>
      {conds.map((c, i) => (
        <CondRow key={i} c={c} events={events} selfId="" onChange={(x) => onChange({ ...b, conds: conds.map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...b, conds: conds.filter((_, j) => j !== i) })} />
      ))}
      <button className={link} onClick={() => onChange({ ...b, conds: [...conds, defaultCond("metric")] })}>＋ 条件{!conds.length && idx > 0 ? "（不加 = 「否则」兜底）" : ""}</button>
      <p className="pt-0.5 text-[11px] font-bold text-ink-soft">则</p>
      {effects.map((f, i) => (
        <EffectRow key={i} ef={f} onChange={(x: FixedEffect) => onChange({ ...b, effects: effects.map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...b, effects: effects.filter((_, j) => j !== i) })} />
      ))}
      <button className={link} onClick={() => onChange({ ...b, effects: [...effects, defaultEffect("metric")] })}>＋ 效果</button>
      <input className={inp} value={b.notice ?? ""} maxLength={60} placeholder="给玩家的提示（可留空；写进当天 / 本周结算）" onChange={(e) => onChange({ ...b, notice: e.target.value || undefined })} />
    </div>
  );
}

export default function GameRulesEditor({ value, events = [], onChange }: { value?: GameRule[]; events?: FixedEvent[]; onChange: (v?: GameRule[]) => void }) {
  const list = Array.isArray(value) ? value : [];
  const commit = (n: GameRule[]) => onChange(n.length ? n : undefined);
  const set = (id: string, p: Partial<GameRule>) => commit(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setBranches = (r: GameRule, branches: RuleBranch[]) => set(r.id, { branches });
  const hasElse = (branches: RuleBranch[]) => branches.length > 1 && !branches[branches.length - 1].conds.length;

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        像搭积木一样组合玩法：选时机 → 写「如果 / 否则如果 / 否则」分支 → 每个分支配条件与效果。分支从上往下比对，命中第一个就执行。
        「规则变量」是你自己起名的计数器，可在规则之间、规则与固定事件之间传递状态，做出连击、阶段、倒计时等玩法；剧情美化也能读取它。
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button className={btn} onClick={() => commit([...list, { id: uid(), name: "新规则", when: "week", branches: [{ conds: [defaultCond("metric")], effects: [defaultEffect("metric")] }] }])}>＋ 空白规则</button>
        {TEMPLATES.map((t) => (
          <button key={t.name} className={`${btn} !font-normal`} title={t.desc} onClick={() => commit([...list, { id: uid(), ...t.make() }])}>{t.name}</button>
        ))}
      </div>
      {!list.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有玩法规则 · 点上方模板快速开始，例如「名气分段流动」</p>}

      {list.map((raw) => {
        const branches = normalizeRuleBranches(raw.branches) as RuleBranch[];
        const r: GameRule = { ...raw, branches };
        return (
        <div key={r.id} className={`space-y-2 rounded-2xl border border-line bg-paper-2 p-2.5 ${r.enabled === false ? "opacity-60" : ""}`}>
          <div className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--jade)]" checked={r.enabled !== false} onChange={(e) => set(r.id, { enabled: e.target.checked ? undefined : false })} aria-label="启用" />
            <input className={`${inp} font-bold`} value={r.name} placeholder="规则名" onChange={(e) => set(r.id, { name: e.target.value })} />
            <select className={`${inp} !w-24 shrink-0`} value={r.when} onChange={(e) => set(r.id, { when: e.target.value as GameRule["when"] })}>
              {(Object.keys(WHEN) as GameRule["when"][]).map((k) => <option key={k} value={k}>{WHEN[k]}</option>)}
            </select>
            <button className="shrink-0 text-[12px] text-ink-soft hover:text-danger" onClick={() => commit(list.filter((x) => x.id !== r.id))} aria-label="删除规则"><IconClose size={14} /></button>          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-soft">
            <label className="flex items-center gap-1">概率
              <input type="number" min={1} max={100} className={`${inp} !w-16`} value={r.chance ?? 100} onChange={(e) => { const v = Math.max(1, Math.min(100, Number(e.target.value) || 100)); set(r.id, { chance: v >= 100 ? undefined : v }); }} />%
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" className="accent-[var(--jade)]" checked={!!r.once} onChange={(e) => set(r.id, { once: e.target.checked || undefined })} />一局只触发一次
            </label>
            {!r.once && (
              <label className="flex items-center gap-1">冷却
                <input type="number" min={0} className={`${inp} !w-16`} value={r.cooldown ?? 0} onChange={(e) => set(r.id, { cooldown: Math.max(0, Number(e.target.value) || 0) || undefined })} />天
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            {branches.map((b, i) => (
              <BranchCard key={i} b={b} idx={i} total={branches.length} events={events}
                onChange={(x) => setBranches(r, branches.map((y, j) => (j === i ? x : y)))}
                onDelete={branches.length > 1 ? () => setBranches(r, branches.filter((_, j) => j !== i)) : undefined} />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button className={btn} onClick={() => {
              const nb: RuleBranch = { conds: [defaultCond("metric")], effects: [defaultEffect("metric")] };
              // 已有「否则」时插在它前面，保持兜底在最后
              setBranches(r, hasElse(branches) ? [...branches.slice(0, -1), nb, branches[branches.length - 1]] : [...branches, nb]);
            }}>＋ 否则如果</button>
            <button className={btn} disabled={hasElse(branches)} onClick={() => setBranches(r, [...branches, { conds: [], effects: [defaultEffect("metric")] }])}>＋ 否则</button>
          </div>
          <p className="rounded-lg bg-paper/70 px-2 py-1.5 text-[11px] leading-relaxed text-ink-soft">
            <b className="text-ink">{WHEN[r.when] ?? "每周结算"}</b>{r.chance != null && r.chance < 100 ? `（${r.chance}% 概率）` : ""}：
            {branches.map((b, i) => `${i === 0 ? (b.conds.length ? "如果" : "总是") : b.conds.length ? "；否则如果" : "；否则"}${b.conds.length ? ` ${condsBrief(b.conds, b.match, events)}` : ""} → ${b.effects.map(effectBrief).join("、") || "（无效果）"}`).join("")}
            {r.once ? "；一局一次" : r.cooldown ? `；冷却 ${r.cooldown} 天` : ""}
          </p>
        </div>
        );
      })}
    </div>
  );
}
