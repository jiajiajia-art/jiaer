import { useState } from "react";
import { normalizeRuleBranches } from "../lib/gameRuleShape";
import { GAME_RULE_PRESETS, linkedLibraryEventNames, materializeRulePreset } from "../lib/gameRulePresets";
import { IconClose } from "../lib/icons";
import { CondRow, EffectRow, defaultCond, defaultEffect } from "./FixedEventsPanel";
import { condsBrief, effectBrief } from "./ruleText";
import type { FixedEffect, FixedEvent, GameRule, RuleBranch } from "../lib/types";

/* 模组编辑器 · 玩法规则：列表默认一行（名 / 时机 / 开关 / 挂钩事件），点开再编条件与效果。
 * 预设写入事件库；「高压计数」等标成规则变量卡，不与事件同一种展开块。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const link = "text-[11.5px] font-semibold text-jade hover:underline";
const uid = () => `gr_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
const WHEN: Record<GameRule["when"], string> = { day: "每天结束", week: "每周结算" };

function BranchCard({
  b, idx, total, condEvents, libraryEvents, isFlag, onChange, onDelete,
}: {
  b: RuleBranch; idx: number; total: number;
  condEvents: FixedEvent[]; libraryEvents: FixedEvent[];
  isFlag: boolean;
  onChange: (b: RuleBranch) => void; onDelete?: () => void;
}) {
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
        {onDelete && <button type="button" className="text-[12px] text-ink-soft hover:text-danger" onClick={onDelete} aria-label="删除分支"><IconClose size={14} /></button>}
      </div>
      {conds.map((c, i) => (
        <CondRow key={i} c={c} events={condEvents} selfId="" onChange={(x) => onChange({ ...b, conds: conds.map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...b, conds: conds.filter((_, j) => j !== i) })} />
      ))}
      <button type="button" className={link} onClick={() => onChange({ ...b, conds: [...conds, defaultCond("metric")] })}>＋ 条件{!conds.length && idx > 0 ? "（不加 = 「否则」兜底）" : ""}</button>

      {!isFlag && (
        <label className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-soft">
          <span className="font-bold text-ink">调用事件库</span>
          <select
            className={`${inp} !w-auto min-w-[10rem]`}
            value={b.eventId ?? ""}
            onChange={(e) => onChange({ ...b, eventId: e.target.value || undefined })}
          >
            <option value="">（不调用）</option>
            {libraryEvents.map((e) => <option key={e.id} value={e.id}>{e.name || e.id}</option>)}
          </select>
        </label>
      )}

      <p className="pt-0.5 text-[11px] font-bold text-ink-soft">{isFlag ? "则改规则变量" : "则额外效果（规则变量等，可留空）"}</p>
      {effects.map((f, i) => (
        <EffectRow key={i} ef={f} onChange={(x: FixedEffect) => onChange({ ...b, effects: effects.map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...b, effects: effects.filter((_, j) => j !== i) })} />
      ))}
      <button type="button" className={link} onClick={() => onChange({ ...b, effects: [...effects, defaultEffect(isFlag ? "flag" : "metric")] })}>＋ {isFlag ? "规则变量" : "效果"}</button>
      <input className={inp} value={b.notice ?? ""} maxLength={60} placeholder="给玩家的提示（可留空；写进当天 / 本周结算）" onChange={(e) => onChange({ ...b, notice: e.target.value || undefined })} />
    </div>
  );
}

export default function GameRulesEditor({
  value,
  events = [],
  libraryEvents = [],
  onChange,
}: {
  value?: GameRule[];
  /** 条件编辑器用的固定事件列表 */
  events?: FixedEvent[];
  /** 本作品事件库：预设写入此处，规则分支挂钩 */
  libraryEvents?: FixedEvent[];
  onChange: (next: { gameRules?: GameRule[]; events?: FixedEvent[] }) => void;
}) {
  const list = Array.isArray(value) ? value : [];
  const lib = Array.isArray(libraryEvents) ? libraryEvents : [];
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const commitRules = (n: GameRule[], nextLib?: FixedEvent[]) => {
    onChange({
      gameRules: n.length ? n : undefined,
      ...(nextLib !== undefined ? { events: nextLib.length ? nextLib : undefined } : {}),
    });
  };
  const set = (id: string, p: Partial<GameRule>) => commitRules(list.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const setBranches = (r: GameRule, branches: RuleBranch[]) => set(r.id, { branches });
  const hasElse = (branches: RuleBranch[]) => branches.length > 1 && !branches[branches.length - 1].conds.length;
  const toggleOpen = (id: string) => setOpenIds((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const addBlank = () => {
    const id = uid();
    commitRules([...list, { id, name: "新规则", when: "week", role: "event", branches: [{ conds: [defaultCond("metric")], effects: [], eventId: undefined }] }]);
    setOpenIds((prev) => new Set(prev).add(id));
  };

  const addPreset = (name: string) => {
    const preset = GAME_RULE_PRESETS.find((t) => t.name === name);
    if (!preset) return;
    const { rule, events: created } = materializeRulePreset(preset, () => `${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`);
    commitRules([...list, rule], [...lib, ...created]);
    setOpenIds((prev) => new Set(prev).add(rule.id));
  };

  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        规则只决定「什么时候判定、条件是什么、命中后调用事件库哪一条、改哪个规则变量」。预设会写入事件库；列表默认一行，点开再编条件与效果。
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={addBlank}>＋ 空白规则</button>
        {GAME_RULE_PRESETS.map((t) => (
          <button type="button" key={t.name} className={`${btn} !font-normal`} title={t.desc} onClick={() => addPreset(t.name)}>{t.name}</button>
        ))}
      </div>
      {!list.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有玩法规则 · 点上方预设会写入事件库并生成一行规则</p>}

      <div className="space-y-1.5">
        {list.map((raw) => {
          const branches = normalizeRuleBranches(raw.branches) as RuleBranch[];
          const r: GameRule = { ...raw, branches };
          const isFlag = r.role === "flag";
          const open = openIds.has(r.id);
          const linked = linkedLibraryEventNames(r, lib);
          const hookLabel = isFlag ? "规则变量" : linked.length ? `事件「${linked.join("、")}」` : "未挂钩事件";

          return (
            <div
              key={r.id}
              className={`rounded-xl border border-line ${isFlag ? "bg-paper border-dashed" : "bg-paper-2"} ${r.enabled === false ? "opacity-60" : ""}`}
              data-rule-row={r.id}
              data-rule-role={r.role ?? "event"}
            >
              {/* 功能注释：默认单行摘要——规则名、判定时机、开关、挂钩事件/规则变量；点行展开。 */}
              <div
                className="flex cursor-pointer items-center gap-2 px-2.5 py-2"
                onClick={() => toggleOpen(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOpen(r.id); } }}
                role="button"
                tabIndex={0}
                aria-expanded={open}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 accent-[var(--jade)]"
                  checked={r.enabled !== false}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => set(r.id, { enabled: e.target.checked ? undefined : false })}
                  aria-label="启用"
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{r.name || "未命名规则"}</span>
                <span className="shrink-0 rounded-md bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">{WHEN[r.when] ?? "每周结算"}</span>
                <span className={`max-w-[40%] shrink truncate text-[11px] ${isFlag ? "font-semibold text-gold" : "text-ink-soft"}`} title={hookLabel}>{hookLabel}</span>
                <span className="shrink-0 text-[11px] text-ink-soft">{open ? "收起" : "展开"}</span>
                <button
                  type="button"
                  className="shrink-0 text-[12px] text-ink-soft hover:text-danger"
                  onClick={(e) => { e.stopPropagation(); commitRules(list.filter((x) => x.id !== r.id)); }}
                  aria-label="删除规则"
                >
                  <IconClose size={14} />
                </button>
              </div>

              {open && (
                <div className="space-y-2 border-t border-line px-2.5 pb-2.5 pt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className={`${inp} font-bold`} value={r.name} placeholder="规则名" onChange={(e) => set(r.id, { name: e.target.value })} />
                    <select className={`${inp} !w-28 shrink-0`} value={r.when} onChange={(e) => set(r.id, { when: e.target.value as GameRule["when"] })}>
                      {(Object.keys(WHEN) as GameRule["when"][]).map((k) => <option key={k} value={k}>{WHEN[k]}</option>)}
                    </select>
                    <select
                      className={`${inp} !w-28 shrink-0`}
                      value={r.role ?? "event"}
                      onChange={(e) => set(r.id, { role: e.target.value as GameRule["role"] })}
                      title="事件卡挂钩事件库；规则变量卡只改 flag"
                    >
                      <option value="event">事件规则</option>
                      <option value="flag">规则变量</option>
                    </select>
                  </div>
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
                      <BranchCard
                        key={i}
                        b={b}
                        idx={i}
                        total={branches.length}
                        condEvents={events}
                        libraryEvents={lib}
                        isFlag={isFlag}
                        onChange={(x) => setBranches(r, branches.map((y, j) => (j === i ? x : y)))}
                        onDelete={branches.length > 1 ? () => setBranches(r, branches.filter((_, j) => j !== i)) : undefined}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className={btn} onClick={() => {
                      const nb: RuleBranch = isFlag
                        ? { conds: [defaultCond("metric")], effects: [defaultEffect("flag")] }
                        : { conds: [defaultCond("metric")], effects: [] };
                      setBranches(r, hasElse(branches) ? [...branches.slice(0, -1), nb, branches[branches.length - 1]] : [...branches, nb]);
                    }}>＋ 否则如果</button>
                    <button type="button" className={btn} disabled={hasElse(branches)} onClick={() => setBranches(r, [...branches, { conds: [], effects: isFlag ? [defaultEffect("flag")] : [] }])}>＋ 否则</button>
                  </div>
                  <p className="rounded-lg bg-paper/70 px-2 py-1.5 text-[11px] leading-relaxed text-ink-soft">
                    <b className="text-ink">{WHEN[r.when] ?? "每周结算"}</b>{r.chance != null && r.chance < 100 ? `（${r.chance}% 概率）` : ""}：
                    {branches.map((b, i) => {
                      const evName = b.eventId ? (lib.find((e) => e.id === b.eventId)?.name || b.eventId) : "";
                      const then = [
                        evName ? `调用「${evName}」` : "",
                        b.effects.map(effectBrief).join("、"),
                      ].filter(Boolean).join(" + ") || "（无效果）";
                      return `${i === 0 ? (b.conds.length ? "如果" : "总是") : b.conds.length ? "；否则如果" : "；否则"}${b.conds.length ? ` ${condsBrief(b.conds, b.match, events)}` : ""} → ${then}`;
                    }).join("")}
                    {r.once ? "；一局一次" : r.cooldown ? `；冷却 ${r.cooldown} 天` : ""}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
