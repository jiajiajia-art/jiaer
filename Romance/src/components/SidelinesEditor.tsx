import { useState } from "react";
import { IconChevronDown, IconChevronUp, IconClose } from "../lib/icons";
import { CondRow, EffectRow, defaultCond, defaultEffect, questOpts, sideOpts } from "./FixedEventsPanel";
import { EventPicks } from "./StorylinesEditor";
import { useConfirm } from "./EditorKit";
import type { FixedCond, FixedEffect, FixedEvent, Sideline, Storyline } from "../lib/types";

/* 模组编辑器 · 剧情线 · 支线：额外任务，触发 / 完成 / 失败复用固定事件的条件组件。
 * 功能注释：支线默认折叠只露名称；AI 生成世界不写支线，由创作者点「新建支线」添加。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const sel = "rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[11.5px]";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const link = "text-[11.5px] font-semibold text-jade hover:underline";
const uid = () => `sd_${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 5)}`;
export const SIDELINES_EMPTY_TEXT = "还没有支线。点「新建支线」添加；生成世界不会自动写支线。";
export const newSideline = (): Sideline => ({ id: uid(), name: "新支线", trigger: [defaultCond("event")], conds: [defaultCond("metric")] });

type Opts = { events: FixedEvent[]; quests: ReturnType<typeof questOpts>; sides: ReturnType<typeof sideOpts> };

/* 一组条件行：增删改都回写同一个数组，空数组收成 undefined */
function CondList({ list, add, addLabel, opts, onChange }: { list?: FixedCond[]; add: FixedCond["kind"]; addLabel: string; opts: Opts; onChange: (v?: FixedCond[]) => void }) {
  const cur = list ?? [];
  const commit = (n: FixedCond[]) => onChange(n.length ? n : undefined);
  return (
    <>
      {cur.map((c, i) => (
        <CondRow key={i} c={c} events={opts.events} selfId="" quests={opts.quests} sides={opts.sides}
          onChange={(x) => commit(cur.map((y, j) => (j === i ? x : y)))} onDelete={() => commit(cur.filter((_, j) => j !== i))} />
      ))}
      <button className={link} onClick={() => commit([...cur, defaultCond(add)])}>{addLabel}</button>
    </>
  );
}

/* 一组奖励行：与主线节点完成奖励同一个 EffectRow */
function RewardList({ list, addLabel, onChange }: { list?: FixedEffect[]; addLabel: string; onChange: (v?: FixedEffect[]) => void }) {
  const cur = list ?? [];
  const commit = (n: FixedEffect[]) => onChange(n.length ? n : undefined);
  return (
    <>
      {cur.map((f, i) => (
        <EffectRow key={i} ef={f} onChange={(x) => commit(cur.map((y, j) => (j === i ? x : y)))} onDelete={() => commit(cur.filter((_, j) => j !== i))} />
      ))}
      <button className={link} onClick={() => commit([...cur, defaultEffect("metric")])}>{addLabel}</button>
    </>
  );
}

function SidelineCard({ l, idx, total, opts, onChange, onMove, onDelete }: {
  l: Sideline; idx: number; total: number; opts: Opts;
  onChange: (l: Sideline) => void; onMove: (d: -1 | 1) => void; onDelete: () => void;
}) {
  // 功能注释：默认折起，只露支线名称；点标题条展开/再点收起。刚「新建」的空支线先展开方便填。
  const [open, setOpen] = useState(() => !String(l.name ?? "").trim() || l.name === "新支线");
  const set = (p: Partial<Sideline>) => onChange({ ...l, ...p });
  const head = "pt-1 text-[11.5px] font-black text-ink";
  return (
    <div className={`space-y-1.5 rounded-2xl border border-line border-l-[3px] border-l-gold/70 bg-paper-2/60 p-2.5 ${l.enabled === false ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="shrink-0 rounded-md bg-gold/15 px-1.5 py-0.5 text-[11px] font-black text-gold">支线 {idx + 1}</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-ink">{l.name?.trim() || "未命名支线"}</span>
          {open ? <IconChevronUp size={14} className="shrink-0 text-ink-soft" /> : <IconChevronDown size={14} className="shrink-0 text-ink-soft" />}
        </button>
        <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink-soft" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={l.enabled !== false} onChange={(e) => set({ enabled: e.target.checked ? undefined : false })} />启用
        </label>
        <button type="button" className="text-[12px] text-ink-soft hover:text-jade disabled:opacity-30" disabled={idx === 0} onClick={() => onMove(-1)} aria-label="上移">↑</button>
        <button type="button" className="text-[12px] text-ink-soft hover:text-jade disabled:opacity-30" disabled={idx === total - 1} onClick={() => onMove(1)} aria-label="下移">↓</button>
        <button type="button" className="text-[12px] text-ink-soft hover:text-danger" onClick={onDelete} aria-label="删除支线"><IconClose size={14} /></button>
      </div>
      {open ? (
        <>
          <input className={`${inp} !text-[13px] font-bold`} value={l.name} maxLength={24} placeholder="支线名称" onChange={(e) => set({ name: e.target.value })} />
          <input className={inp} value={l.desc ?? ""} maxLength={80} placeholder="任务说明（给玩家与 AI 看，如：帮老街书店找回丢失的旧书）" onChange={(e) => set({ desc: e.target.value || undefined })} />
          <p className="text-[10.5px] text-ink-soft">ID：{l.id}</p>

          <p className={head}>触发 · 何时出现（全部满足才出现；留空 = 开局即出现）</p>
          <CondList list={l.trigger} add="event" addLabel="＋ 触发条件" opts={opts} onChange={(trigger) => set({ trigger })} />
          <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-soft">
            <label className="flex items-center gap-1">
              <select className={sel} value={l.repeat ? "repeat" : "once"} onChange={(e) => set({ repeat: e.target.value === "repeat" || undefined })}>
                <option value="once">只触发一次</option>
                <option value="repeat">可重复</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={!!l.hidden} onChange={(e) => set({ hidden: e.target.checked || undefined })} />触发前对玩家隐藏
            </label>
          </div>

          <div className="flex items-center gap-2">
            <p className={head}>完成 · 怎样算完成</p>
            {(l.conds ?? []).length > 1 && (
              <select className={sel} value={l.match ?? "all"} onChange={(e) => set({ match: e.target.value as "all" | "any" })}>
                <option value="all">全部满足</option><option value="any">任一满足</option>
              </select>
            )}
          </div>
          <CondList list={l.conds} add="metric" addLabel="＋ 完成条件" opts={opts} onChange={(conds) => set({ conds })} />
          {!(l.conds ?? []).length && <p className="text-[11px] text-danger">没有完成条件的支线不会自动完成</p>}

          <p className={head}>奖励 · 完成后发放并记「该支线已完成」</p>
          <RewardList list={l.rewards} addLabel="＋ 奖励" onChange={(rewards) => set({ rewards })} />
          <EventPicks label="完成后激活事件" ids={l.unlockIds} events={opts.events} onChange={(unlockIds) => set({ unlockIds })} />

          <p className={head}>失败（可选 · 任一满足即失败；不配 = 只会成功或一直挂着）</p>
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-soft">
            <span>出现后</span>
            <input type="number" min={0} className="w-16 rounded-md border border-line bg-paper-2 px-1.5 py-0.5 text-[12px]" value={l.limitDays ?? ""} placeholder="不限"
              onChange={(e) => { const v = Math.floor(Number(e.target.value)); set({ limitDays: v > 0 ? v : undefined }); }} />
            <span>天内未完成即失败（超时）</span>
          </div>
          <CondList list={l.failConds} add="quest" addLabel="＋ 失败条件（如主线中断、关键人物相关标记）" opts={opts} onChange={(failConds) => set({ failConds })} />
          {(!!l.failConds?.length || !!l.limitDays) && (
            <>
              <p className="text-[11px] font-bold text-ink-soft">失败安慰奖（可留空 = 无奖励）</p>
              <RewardList list={l.failRewards} addLabel="＋ 安慰奖" onChange={(failRewards) => set({ failRewards })} />
              <EventPicks label="失败后激活事件" ids={l.failUnlockIds} events={opts.events} onChange={(failUnlockIds) => set({ failUnlockIds })} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function SidelinesEditor({ value, events = [], storylines, onChange }: { value?: Sideline[]; events?: FixedEvent[]; storylines?: Storyline[]; onChange: (v?: Sideline[]) => void }) {
  const list = value ?? [];
  const opts: Opts = { events, quests: questOpts(storylines), sides: sideOpts(list) };
  const commit = (n: Sideline[]) => onChange(n.length ? n : undefined);
  const [confirm, confirmEl] = useConfirm();
  return (
    <div className="space-y-2.5">
      {confirmEl}
      <p className="text-[11px] leading-relaxed text-ink-soft">
        支线是高级手配任务：生成世界不会自动写支线。每条默认折起，点名称展开任务说明 / 触发 / 完成 / 奖励 / 失败。失败或没接都不会打断主线。
        结局如果要看支线，在结局条件里加「支线进度」。
      </p>
      <button className={btn} onClick={() => commit([...list, newSideline()])}>＋ 新建支线</button>
      {!list.length && <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">{SIDELINES_EMPTY_TEXT}</p>}
      {list.map((l, i) => (
        <SidelineCard key={l.id} l={l} idx={i} total={list.length} opts={opts}
          onChange={(x) => commit(list.map((y) => (y.id === l.id ? x : y)))}
          onMove={(d) => { const a = [...list]; [a[i], a[i + d]] = [a[i + d], a[i]]; commit(a); }}
          onDelete={async () => { if (await confirm(`删除支线「${l.name || l.id}」？已开局存档里这条支线的进度会失效。`)) commit(list.filter((y) => y.id !== l.id)); }} />
      ))}
    </div>
  );
}
