/* 事件编辑器的细化设定：触发类型 / 「且 · 或」条件组 / 事件链断点 / 分支的隐藏与失败 */
import type { ChainBreak, CondGroup, EventChoice, EventTrigger, FixedEvent } from "../lib/types";
import { CondRow, EffectRow, defaultCond, defaultEffect, type QuestOpt } from "./FixedEventsPanel";
import { LIVE_LOCATIONS as LOCATIONS, LIVE_PEOPLE as PEOPLE, LIVE_ITEMS as ITEMS } from "../mods/registry";
import { TRIGGER_LABEL } from "../game/eventTriggers";
import { CHAIN_STATE_LABEL, chainFlag, chainRun } from "../game/fixedEvents";
import type { GameState } from "../lib/types";
import AudioPicker from "./AudioPicker";
import ModExportPicker, { FilterEditor, exportOptions, firstExport } from "./ModExportPicker";

const sel = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";
const num = "w-16 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] tabular-nums text-ink";
const link = "text-[11.5px] font-semibold text-jade hover:underline";
const hint = "mt-1 text-[11px] leading-snug text-ink-soft";

function MatchSwitch({ value, onChange }: { value?: "all" | "any"; onChange: (v: "all" | "any") => void }) {
  return (
    <span className="inline-flex rounded-full border border-line p-0.5 text-[11px] font-bold">
      {(["all", "any"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)} aria-pressed={(value ?? "all") === m}
          className={`rounded-full px-2 py-0.5 transition ${(value ?? "all") === m ? "bg-jade text-white" : "text-ink-soft"}`}>{m === "all" ? "且 · 全部满足" : "或 · 任一满足"}</button>
      ))}
    </span>
  );
}

/* 一个条件组 */
export function GroupEditor({ g, events, selfId, quests, sides, onChange, onDelete, title }: { g: CondGroup; events: FixedEvent[]; selfId: string; quests?: QuestOpt[]; sides?: QuestOpt[]; onChange: (g: CondGroup) => void; onDelete?: () => void; title?: string }) {
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-line p-2">
      <div className="flex flex-wrap items-center gap-2">
        {title && <span className="text-[11.5px] font-bold text-ink">{title}</span>}
        <MatchSwitch value={g.match} onChange={(match) => onChange({ ...g, match })} />
        {onDelete && <button type="button" onClick={onDelete} className="ml-auto text-[11.5px] font-semibold text-danger">删除此组</button>}
      </div>
      {g.conds.map((c, i) => (
        <CondRow key={i} c={c} events={events} selfId={selfId} quests={quests} sides={sides} onChange={(x) => onChange({ ...g, conds: g.conds.map((y, j) => (j === i ? x : y)) })} onDelete={() => onChange({ ...g, conds: g.conds.filter((_, j) => j !== i) })} />
      ))}
      <button type="button" className={link} onClick={() => onChange({ ...g, conds: [...g.conds, defaultCond("metric")] })}>＋ 条件</button>
    </div>
  );
}

/* 基础条件的组合方式 + 额外条件组（组与组之间为「且」） */
export function CondLogic({ x, events, selfId, quests, sides, onChange }: { x: { condMatch?: "all" | "any"; condGroups?: CondGroup[]; conds?: unknown[] }; events: FixedEvent[]; selfId: string; quests?: QuestOpt[]; sides?: QuestOpt[]; onChange: (p: { condMatch?: "all" | "any"; condGroups?: CondGroup[] }) => void }) {
  const groups = x.condGroups ?? [];
  return (
    <div className="space-y-2">
      {(x.conds?.length ?? 0) > 1 && <div className="flex items-center gap-2 text-[11.5px] text-ink-soft">上面的条件之间：<MatchSwitch value={x.condMatch} onChange={(m) => onChange({ condMatch: m === "all" ? undefined : m })} /></div>}
      {groups.map((g, i) => (
        <GroupEditor key={i} g={g} events={events} selfId={selfId} quests={quests} sides={sides} title={`且 条件组 ${i + 1}`}
          onChange={(ng) => onChange({ condGroups: groups.map((y, j) => (j === i ? ng : y)) })}
          onDelete={() => { const n = groups.filter((_, j) => j !== i); onChange({ condGroups: n.length ? n : undefined }); }} />
      ))}
      <button type="button" className={link} onClick={() => onChange({ condGroups: [...groups, { match: "any", conds: [defaultCond("metric")] }] })}>＋ 条件组（如「A 或 B」，与上面的条件同时成立）</button>
    </div>
  );
}

const defaultTrigger = (k: EventTrigger["kind"], events: FixedEvent[]): EventTrigger | undefined => {
  switch (k) {
    case "enter": return { kind: "enter", room: LOCATIONS[0]?.id ?? "" };
    case "action": return { kind: "action", text: "" };
    case "choice": { const e = events.find((x) => x.choices?.length); return { kind: "choice", event: e?.id ?? "", choice: e?.choices?.[0]?.id ?? "" }; }
    case "rel": return { kind: "rel", npc: PEOPLE[0]?.id ?? "", delta: 5 };
    case "item": return { kind: "item", item: ITEMS[0]?.id ?? "" };
    case "round": return { kind: "round", every: 10 };
    case "audio": return { kind: "audio", on: "ended" };
    case "modEvent": { const x = firstExport("events"); return { kind: "modEvent", mod: x?.mod ?? "", event: x?.id ?? "" }; }
    default: return undefined;
  }
};

export function TriggerEditor({ ev, events, onChange }: { ev: FixedEvent; events: FixedEvent[]; onChange: (t?: EventTrigger) => void }) {
  const t = ev.trigger;
  const withChoices = events.filter((x) => x.id !== ev.id && x.choices?.length);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={t?.kind ?? "auto"} onChange={(e) => onChange(defaultTrigger(e.target.value as EventTrigger["kind"], withChoices))} aria-label="触发类型">
          {(Object.keys(TRIGGER_LABEL) as EventTrigger["kind"][]).map((k) => <option key={k} value={k}>{TRIGGER_LABEL[k]}</option>)}
        </select>
        {t?.kind === "enter" && (
          <select className={sel} value={t.room} onChange={(e) => onChange({ ...t, room: e.target.value })} aria-label="地点">
            {!LOCATIONS.some((l) => l.id === t.room) && <option value={t.room}>{t.room ? `已失效：${t.room}` : "（请选择）"}</option>}
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {t?.kind === "action" && <input className={`${sel} w-48`} value={t.text} placeholder="行动包含的文字，如：去片场" onChange={(e) => onChange({ ...t, text: e.target.value })} />}
        {t?.kind === "choice" && (<>
          <select className={sel} value={t.event} onChange={(e) => { const x = withChoices.find((y) => y.id === e.target.value); onChange({ ...t, event: e.target.value, choice: x?.choices?.[0]?.id ?? "" }); }} aria-label="事件">
            {!withChoices.some((x) => x.id === t.event) && <option value={t.event}>{withChoices.length ? "（选择事件）" : "（还没有带选项的事件）"}</option>}
            {withChoices.map((x) => <option key={x.id} value={x.id}>{x.name || "（未命名）"}</option>)}
          </select>
          <select className={sel} value={t.choice} onChange={(e) => onChange({ ...t, choice: e.target.value })} aria-label="选项">
            {(withChoices.find((x) => x.id === t.event)?.choices ?? []).map((c) => <option key={c.id} value={c.id}>{c.label || c.id}{c.hidden ? "（隐藏）" : ""}</option>)}
          </select>
        </>)}
        {t?.kind === "rel" && (<>
          <select className={sel} value={t.npc} onChange={(e) => onChange({ ...t, npc: e.target.value })} aria-label="人物">
            {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className={sel} value={t.delta < 0 ? "down" : "up"} onChange={(e) => onChange({ ...t, delta: (e.target.value === "down" ? -1 : 1) * Math.abs(t.delta || 5) })}>
            <option value="up">上升至少</option><option value="down">下降至少</option>
          </select>
          <input type="number" min={1} className={num} value={Math.abs(t.delta)} onChange={(e) => onChange({ ...t, delta: Math.sign(t.delta || 1) * Math.max(1, Math.abs(Number(e.target.value)) || 1) })} />
        </>)}
        {t?.kind === "item" && (
          <select className={sel} value={t.item} onChange={(e) => onChange({ ...t, item: e.target.value })} aria-label="道具">
            {ITEMS.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        )}
        {t?.kind === "modEvent" && (<>
          <ModExportPicker kind="events" mod={t.mod} id={t.event} onChange={(mod, event) => onChange({ kind: "modEvent", mod, event })} />
          <FilterEditor params={exportOptions("events").find((o) => o.mod === t.mod && o.id === t.event)?.params ?? []} value={t.filter} onChange={(filter) => onChange({ ...t, filter })} />
        </>)}
        {t?.kind === "audio" && (<>
          <select className={sel} value={t.on} onChange={(e) => onChange({ ...t, on: e.target.value as typeof t.on })} aria-label="音频信号">
            <option value="ended">播放结束</option><option value="fadeIn">淡入完成</option><option value="fadeOut">淡出完成</option>
          </select>
          <AudioPicker value={t.id} empty="（任意音频）" className={sel} onChange={(id) => onChange({ ...t, id })} />
        </>)}
        {t?.kind === "round" && (
          <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-soft">
            <select className={sel} value={t.at ? "at" : "every"} onChange={(e) => onChange(e.target.value === "at" ? { kind: "round", at: t.every || 10 } : { kind: "round", every: t.at || 10 })}>
              <option value="every">每隔</option><option value="at">第</option>
            </select>
            <input type="number" min={1} className={num} value={t.at ?? t.every ?? 1} onChange={(e) => { const n = Math.max(1, Math.round(Number(e.target.value)) || 1); onChange(t.at ? { kind: "round", at: n } : { kind: "round", every: n }); }} />
            轮{t.at ? "时" : "一次"}
          </span>
        )}
      </div>
      <p className={hint}>
        {!t || t.kind === "auto" ? "按下方「触发时间」与条件，到点即按顺序上演。"
          : t.kind === "round" ? "按主线对话轮数计（每次 AI 回复算一轮）。"
          : t.kind === "rel" ? "两次检查之间（通常是一回合）关系的变化量。"
          : t.kind === "action" ? "主角在主线里的一次行动落地成功、且行动内容包含这段文字时。"
          : t.kind === "audio" ? "播放器发出该信号时（循环播放的音频不会「播放结束」）。"
          : t.kind === "modEvent" ? "该 MOD 广播这个导出事件（且满足过滤条件）时；MOD 关闭后不再触发。"
          : "在那一刻判定一次。"}
        {t && t.kind !== "auto" && " 仍需满足下方时间与条件，不满足就错过这一次。"}
      </p>
    </div>
  );
}

/* 事件链：链 id + 断点；同一条链的断点合并生效 */
export function ChainEditor({ ev, events, game, onChange }: { ev: FixedEvent; events: FixedEvent[]; game?: GameState | null; onChange: (p: Partial<FixedEvent>) => void }) {
  const chains = Array.from(new Set(events.map((e) => e.chain?.trim()).filter((x): x is string => !!x)));
  const breaks = ev.chainBreaks ?? [];
  const run = ev.chain?.trim() && game ? chainRun(game.sim, ev.chain) : null;
  const setB = (i: number, b: ChainBreak) => onChange({ chainBreaks: breaks.map((x, j) => (j === i ? b : x)) });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input list={`chains-${ev.id}`} className={`${sel} w-44`} value={ev.chain ?? ""} maxLength={20} placeholder="事件链名，如：初恋线" onChange={(e) => onChange({ chain: e.target.value || undefined })} />
        <datalist id={`chains-${ev.id}`}>{chains.map((c) => <option key={c} value={c} />)}</datalist>
        {run && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${run === "running" ? "bg-jade/12 text-jade" : run === "paused" ? "bg-gold/15 text-gold" : "bg-danger/12 text-danger"}`}>当前：{CHAIN_STATE_LABEL[run]}</span>}
      </div>
      {ev.chain?.trim() && (<>
        {breaks.map((b, i) => (
          <div key={i} className="space-y-1.5 rounded-xl bg-paper/60 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] text-ink-soft">满足以下条件时，整条链</span>
              <select className={sel} value={b.state} onChange={(e) => setB(i, { ...b, state: e.target.value as ChainBreak["state"] })}>
                <option value="paused">暂停（不满足后自动恢复）</option>
                <option value="interrupted">中断</option>
                <option value="failed">永久失败</option>
              </select>
              <input className={`${sel} min-w-0 flex-1`} value={b.note ?? ""} placeholder="说明（可选），如：主角搬离了城市" onChange={(e) => setB(i, { ...b, note: e.target.value || undefined })} />
            </div>
            <GroupEditor g={b.group} events={events} selfId={ev.id} onChange={(group) => setB(i, { ...b, group })} onDelete={() => { const n = breaks.filter((_, j) => j !== i); onChange({ chainBreaks: n.length ? n : undefined }); }} />
          </div>
        ))}
        <button type="button" className={link} onClick={() => onChange({ chainBreaks: [...breaks, { state: "interrupted", group: { match: "all", conds: [defaultCond("rel")] } }] })}>＋ 断点</button>
        <p className={hint}>
          链状态写在规则变量 <code className="text-jade">{chainFlag(ev.chain)}</code>：0 进行中 · 2 暂停 · -1 中断 · -2 永久失败。主线节点、结局、其他事件都可以用「规则变量」条件识别它；
          中断后用「规则变量 设为 0」的效果即可恢复，永久失败不会再恢复。链不在「进行中」时，链上所有事件都不会触发。
        </p>
      </>)}
    </div>
  );
}

/* 选项的细化：隐藏分支 / 条件组 / 成功判定与失败分支 */
export function ChoiceAdvanced({ c, ev, events, set }: { c: EventChoice; ev: FixedEvent; events: FixedEvent[]; set: (p: Partial<EventChoice>) => void }) {
  const others = events.filter((o) => o.id !== ev.id);
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-[12px] text-ink">
        <input type="checkbox" className="accent-[var(--jade)]" checked={!!c.hidden} onChange={(e) => set({ hidden: e.target.checked || undefined })} />
        隐藏分支 <span className="text-[11px] text-ink-soft">不显示选项；事件上演时条件满足就自动走这条</span>
      </label>
      <CondLogic x={c} events={events} selfId={ev.id} onChange={(p) => set(p)} />
      {!c.hidden && (c.check ? (
        <div className="space-y-1.5 rounded-xl border-l-[3px] border-danger/60 bg-danger/5 py-2 pl-3 pr-2">
          <GroupEditor g={c.check} events={events} selfId={ev.id} title="成功判定" onChange={(check) => set({ check })} onDelete={() => set({ check: undefined, failPrompt: undefined, failEffects: undefined, failNextIds: undefined })} />
          <p className="text-[11px] font-bold text-danger">判定不通过 → 失败分支</p>
          <input className="w-full rounded-lg border border-line bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink" value={c.failPrompt ?? ""} maxLength={200} placeholder="失败时交给 AI 的续写指引，如：被拒之门外" onChange={(x) => set({ failPrompt: x.target.value || undefined })} />
          {(c.failEffects ?? []).map((f, i) => (
            <EffectRow key={i} ef={f} onChange={(x) => set({ failEffects: c.failEffects!.map((y, j) => (j === i ? x : y)) })} onDelete={() => { const n = c.failEffects!.filter((_, j) => j !== i); set({ failEffects: n.length ? n : undefined }); }} />
          ))}
          <button type="button" className={link} onClick={() => set({ failEffects: [...(c.failEffects ?? []), defaultEffect("metric")] })}>＋ 失败效果</button>
          {others.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-ink-soft">失败后激活</span>
              {others.map((o) => { const on = (c.failNextIds ?? []).includes(o.id); return (
                <button key={o.id} type="button" onClick={() => { const n = on ? c.failNextIds!.filter((x) => x !== o.id) : [...(c.failNextIds ?? []), o.id]; set({ failNextIds: n.length ? n : undefined }); }}
                  className={`rounded-full border px-2 py-0.5 text-[11.5px] transition ${on ? "border-transparent bg-danger text-white" : "border-line bg-paper-2 text-ink-soft"}`}>{o.name || "（未命名）"}</button>
              ); })}
            </div>
          )}
        </div>
      ) : (
        <button type="button" className={link} onClick={() => set({ check: { match: "all", conds: [defaultCond("stat")] } })}>＋ 成功判定 / 失败分支</button>
      ))}
    </div>
  );
}
