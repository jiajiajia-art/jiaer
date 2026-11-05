import { IconChevronDown, IconChevronUp, IconDice } from "../lib/icons";
import { TIME_UNIT_LABEL, CMP_OPS, cmpSym, type CmpOp } from "../lib/types";
import { useState } from "react";
import AiEventWriter from "./AiEventWriter";
import { KwInput } from "./EditorKit";
import { useGame } from "../store/gameCtx";
import { liveFactions } from "../game/factions";
import { condBrief, effectBrief } from "./ruleText";
import { TriggerEditor, CondLogic, ChainEditor } from "./EventAdvanced";
import { TRIGGER_LABEL, eventToWorldBook } from "../game/eventTriggers";
import { loadTemplates, saveTemplate, removeTemplate, fromTemplate, type EventTemplate } from "../game/eventTemplates";
import type { FixedEvent, FixedCond, FixedEffect, FixedEventTime, QuestState, Sideline, SideState, Storyline } from "../lib/types";
import { PERIODIC_TIME } from "../lib/types";
import { STAT_ORDER, STAT_LABELS, type StatKey } from "../game/data";
import type { ValueSrc } from "../game/valueSources";
import { LIVE_LOCATIONS as LOCATIONS, getWorldEvents, getWorldEventGroups, getWorldSidelines, getWorldStorylines } from "../mods/registry";
import { SIDE_STATE_LABEL } from "../lib/sidelines";
import { LIVE_PEOPLE as PEOPLE, LIVE_ITEMS as ALL_ITEMS, allMods } from "../mods/registry";
import { FIXED_METRICS, RANDOM_CHANCE, randomGroupIds, QUEST_STATE_LABEL } from "../game/fixedEvents";
import { LIBRARY_KINDS, type LibraryGroup, type LibraryKind } from "../game/eventLibrary";
import { resolveModEventLibrary } from "../game/resolveEventLibrary";
import { EmptyState, ScopeBanner, SearchBox, matches, useConfirm } from "./EditorKit";
import { AuditBadge, AuditBar, AuditList, auditDomId } from "./EditorKit";
import { auditGame, auditStory, issuesAt } from "../game/refAudit";
import AudioPicker from "./AudioPicker";
import ModExportPicker, { ArgsEditor, exportOptions, firstExport } from "./ModExportPicker";
import { buildQuestOpts, type QuestOpt } from "../lib/questOpts";

/* 固定事件编辑器：创作者预设剧本桥段。满足条件后由代码判定触发，再交 AI 演绎。
 * 只有「编辑」「预览」两种模式：编辑可见全部事件；预览只见玩家已实际触发的事件。
 * 未触发的事件对玩家与 AI 完全隐藏——不进任务列表、不上地图、不入记忆、不写剧情志。
 * 功能注释：模组编辑的「事件库」只认本作品 content.events / eventGroups，禁止回退到当前生效世界（娱乐圈 123 条）。 */

const uid = () => `fx_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const newEvent = (): FixedEvent => ({ id: uid(), name: "", prompt: "", once: true });



// 条件切换类型时的默认值：始终指向一个已存在的库项，杜绝手填不存在的字段
export function defaultCond(kind: FixedCond["kind"]): FixedCond {
  switch (kind) {
    case "stat": return { kind: "stat", key: STAT_ORDER[0], op: "gte", value: 100 };
    case "metric": return { kind: "metric", key: FIXED_METRICS[0].key, op: "gte", value: 10 };
    case "rel": return { kind: "rel", key: PEOPLE[0]?.id ?? "", op: "gte", value: 20 };
    case "location": return { kind: "location", key: LOCATIONS[0]?.id ?? "" };
    case "item": return { kind: "item", key: ALL_ITEMS[0]?.id ?? "" };
    case "event": return { kind: "event", key: "" };
    case "time": return { kind: "time", unit: "year", op: "gte", value: 1 };
    case "date": return { kind: "date", op: "gte", date: "" };
    case "flag": return { kind: "flag", key: "", op: "gte", value: 1 };
    case "clock": return { kind: "clock", from: "22:00", to: "06:00" };
    case "quest": return { kind: "quest", key: getWorldStorylines()?.[0]?.id ?? "", state: "done" };
    case "side": return { kind: "side", key: getWorldSidelines()?.[0]?.id ?? "", state: "done" };
    case "faction": return { kind: "faction", key: liveFactions()[0]?.id ?? "", op: "gte", value: 25 };
    case "visited": return { kind: "visited", key: LOCATIONS[0]?.id ?? "" };
    case "relSet": return { kind: "relSet", keys: PEOPLE.slice(0, 2).map((p) => p.id), op: "gte", value: 50 };
    case "memory": return { kind: "memory", key: "" };
    case "flagSet": return { kind: "flagSet", key: "", exists: true };
    case "group": return { kind: "group", match: "any", conds: [] };
    case "modVar": { const m = firstExtMod("vars"); return { kind: "modVar", mod: m?.id ?? "", key: m?.ext?.vars?.[0]?.key ?? "", op: "gte", value: 1 }; }
    case "modCfg": { const m = firstExtMod("config"); return { kind: "modCfg", mod: m?.id ?? "", key: m?.ext?.config?.[0]?.key ?? "", op: "eq", value: 1 }; }
    case "modCond": { const m = firstExtMod("conds"); return { kind: "modCond", mod: m?.id ?? "", id: m?.ext?.conds?.[0]?.id ?? "" }; }
  }
}

/* 主线条件可选项：主线本身 + 各节点（可选目标单独标注） */
export type { QuestOpt };
/** 功能注释：AI/脏稿常缺 nodes；经 buildQuestOpts 防御，避免创建世界编辑器 reading 'map' */
export const questOpts = (lines: Storyline[] | undefined = getWorldStorylines()): QuestOpt[] =>
  buildQuestOpts(lines);
/* 支线条件可选项：每条支线一项 */
export const sideOpts = (lines: Sideline[] | undefined = getWorldSidelines()): QuestOpt[] =>
  (lines ?? []).map((l) => ({ id: l.id, label: `支线·${l.name || l.id}` }));
export function defaultEffect(kind: FixedEffect["kind"]): FixedEffect {
  switch (kind) {
    case "stat": return { kind: "stat", key: STAT_ORDER[0], delta: 10 };
    case "metric": return { kind: "metric", key: FIXED_METRICS[0].key, delta: 5 };
    case "rel": return { kind: "rel", key: PEOPLE[0]?.id ?? "", delta: 5 };
    case "addItem": return { kind: "addItem", key: ALL_ITEMS[0]?.id ?? "" };
    case "removeItem": return { kind: "removeItem", key: ALL_ITEMS[0]?.id ?? "" };
    case "unlockLocation": return { kind: "unlockLocation", key: LOCATIONS[0]?.id ?? "" };
    case "flag": return { kind: "flag", key: "", delta: 1 };
    case "faction": return { kind: "faction", key: liveFactions()[0]?.id ?? "", delta: 10 };
    case "memory": return { kind: "memory", key: "" };
    case "modVar": { const m = firstExtMod("vars"); return { kind: "modVar", mod: m?.id ?? "", key: m?.ext?.vars?.[0]?.key ?? "", delta: 1 }; }
    case "modAction": { const m = firstExtMod("actions"); return { kind: "modAction", mod: m?.id ?? "", id: m?.ext?.actions?.[0]?.id ?? "" }; }
    case "modCall": { const x = firstExport("actions"); return { kind: "modCall", mod: x?.mod ?? "", id: x?.id ?? "" }; }
    case "modEmit": return { kind: "modEmit", event: "" };
    case "audio": return { kind: "audio", op: "play" };
  }
}
/* 功能 MOD 可选项：所有带扩展的模组（含未启用的，便于提前搭配；未启用时判定为不成立） */
const extMods = () => allMods().filter((m) => m.ext);
const firstExtMod = (k: "vars" | "config" | "conds" | "actions") => extMods().find((m) => m.ext?.[k]?.length);
function ModRefPicker({ mod, value, list, onChange }: { mod: string; value: string; list: "vars" | "config" | "conds" | "actions"; onChange: (mod: string, v: string) => void }) {
  const mods = extMods().filter((m) => m.ext?.[list]?.length);
  const m = mods.find((x) => x.id === mod);
  const opts = (m?.ext?.[list] ?? []).map((d) => ("key" in d ? { v: d.key, l: d.label || d.key } : { v: d.id, l: d.label || d.id }));
  return (
    <>
      <select className={selCls} value={mod} onChange={(e) => { const nm = mods.find((x) => x.id === e.target.value); const d = nm?.ext?.[list]?.[0]; onChange(e.target.value, d ? ("key" in d ? d.key : d.id) : ""); }}>
        {!m && <option value={mod}>{mod ? `未安装：${mod}` : "（先导入功能 MOD）"}</option>}
        {mods.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select className={selCls} value={value} onChange={(e) => onChange(mod, e.target.value)}>
        {!opts.some((o) => o.v === value) && <option value={value}>{value ? `已失效：${value}` : "（请选择）"}</option>}
        {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </>
  );
}

const selCls = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";
const numCls = "w-16 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] tabular-nums text-ink";

/* value/onChange 传入时为「模组编辑器」模式：编辑模组预设剧本（开新局写入），不碰当前存档。
 * libraryEvents / libraryGroups：本作品事件库；模组模式禁止回退 getWorldEvents（娱乐圈预设）。 */
export default function FixedEventsPanel({ value, storylines, sidelines, libraryEvents, libraryGroups, worldContext, onChange }: {
  value?: FixedEvent[];
  storylines?: Storyline[];
  sidelines?: Sideline[];
  libraryEvents?: FixedEvent[];
  libraryGroups?: LibraryGroup[];
  /** 功能注释：模组编辑器传入本作品标题/设定/地点人物，供 AI 帮写贴合世界观 */
  worldContext?: import("../lib/aiFixedEvents").AiFixedEventsWorldContext;
  onChange?: (v: FixedEvent[]) => void;
} = {}) {
  const modMode = !!onChange;
  const { game, setFixedEvents, setRandomGroups, setWorldBook } = useGame();
  const [tpls, setTpls] = useState<EventTemplate[]>(() => loadTemplates());
  const [toast, setToast] = useState("");
  const [mode, setMode] = useState<Mode>("edit");
  const [openId, setOpenId] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState<string | null>(null);
  const [libKind, setLibKind] = useState<LibraryKind | "all">("all");
  const [q, setQ] = useState("");
  const [confirm, confirmEl] = useConfirm();
  if (!game && !modMode) return null;

  const events = (modMode ? value : game?.fixedEvents) ?? [];
  // 功能注释：模组模式只用本作品库（可空）；游玩态才读当前世界，避免新建作品带回娱乐圈预设
  const lib = modMode
    ? resolveModEventLibrary(libraryEvents, libraryGroups)
    : { events: getWorldEvents(), groups: getWorldEventGroups() };
  /* 模组编辑器必须用当前草稿的剧情线选项，避免条件误引用正在游玩的世界。 */
  const quests = questOpts(modMode ? (storylines ?? []) : storylines);
  const sides = sideOpts(modMode ? (sidelines ?? []) : sidelines);
  const fired = new Set(modMode ? [] : game?.sim.eventsFired ?? []);
  // 填错就提示：失效引用 / 死循环 / 无人激活 / 空提示词
  const audit = modMode || !game ? auditStory({ events, storylines: storylines ?? [], sidelines: sidelines ?? [], skip: ["item", "location", "npc", "flag"] }) : auditGame(game, { events });
  const evIssues = audit.issues.filter((x) => x.at?.startsWith("event:"));
  const personName = (id: string) => PEOPLE.find((p) => p.id === id)?.name ?? id;
  const itemName = (id: string) => ALL_ITEMS.find((i) => i.id === id)?.name ?? id;
  const locName = (id: string) => LOCATIONS.find((l) => l.id === id)?.name ?? id;

  const save = (next: FixedEvent[]) => (onChange ? onChange(next) : setFixedEvents(next));
  const patch = (id: string, part: Partial<FixedEvent>) => save(events.map((e) => (e.id === id ? { ...e, ...part } : e)));
  const add = () => { const ev = newEvent(); save([...events, ev]); setOpenId(ev.id); };
  const addFromTpl = (t: EventTemplate) => { const ev = fromTemplate(t, newEvent().id); save([...events, ev]); setOpenId(ev.id); };
  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(""), 2200); };
  /* 写进当前存档的世界书：同 id 的线索条目会被更新，其他条目原样保留 */
  const toWorldBook = (ev: FixedEvent) => {
    if (!game) return;
    const list = game.worldBook ?? [];
    const entry = eventToWorldBook(ev, 100);
    const i = list.findIndex((w) => w.id === entry.id);
    setWorldBook(i < 0 ? [...list, entry] : list.map((w, j) => (j === i ? { ...w, title: entry.title, keywords: entry.keywords, content: entry.content } : w)));
    flash(i < 0 ? "已作为剧情线索写入世界书" : "已更新世界书里的剧情线索");
  };
  const remove = async (id: string) => {
    const name = events.find((e) => e.id === id)?.name || "未命名事件";
    if (!(await confirm(`确定删除事件「${name}」？此操作不可撤销。`))) return;
    save(events.filter((e) => e.id !== id)); if (openId === id) setOpenId(null); };

  const move = (id: string, d: number) => {
    const i = events.findIndex((e) => e.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= events.length) return;
    const next = [...events]; [next[i], next[j]] = [next[j], next[i]]; save(next);
  };

  /* 触发时间摘要（编辑态展示） */
  const timeText = (t?: FixedEventTime) => {
    if (!t || t.kind === "none") return "仅凭条件";
    if (t.kind === "day") return `第 ${t.day} 天起`;
    if (t.kind === "date") return `${t.date} 起`;
    if (t.kind === "every") return `每 ${t.days} 天一次${t.start ? `（第 ${t.start} 天起）` : ""}`;
    if (t.kind === "weekly") return `每周${"一二三四五六日"[t.dow] ?? "一"}`;
    if (t.kind === "monthly") return `每月 ${t.d} 号`;
    return `每年 ${t.md}`;
  };
  const condText = (c: FixedCond): string => {
    const op = c.kind === "stat" || c.kind === "metric" || c.kind === "rel" ? cmpSym(c.op) : "";
    switch (c.kind) {
      case "stat": return `${STAT_LABELS[c.key as StatKey] ?? c.key} ${op} ${c.value}`;
      case "metric": return `${FIXED_METRICS.find((m) => m.key === c.key)?.label ?? c.key} ${op} ${c.value}`;
      case "rel": return `与${personName(c.key)}关系 ${op} ${c.value}`;
      case "location": return `位于 ${locName(c.key)}`;
      case "item": return `持有「${itemName(c.key)}」`;
      case "event": return `已触发「${events.find((e) => e.id === c.key)?.name || "（未选）"}」`;
      case "time": return `开局后 ${c.op === "lte" ? "≤" : "≥"} ${c.value} ${TIME_UNIT_LABEL[c.unit]}`;
      case "date": return `日期${c.op === "lte" ? "不晚于" : "不早于"} ${c.date || "（未填）"}`;
      case "flag": return `变量「${c.key || "未命名"}」${cmpSym(c.op)} ${c.value}`;
      case "clock": return `时段 ${c.from}~${c.to}`;
      case "quest": return `「${String(questOpts().find((q) => q.id === c.key)?.label ?? "").trim() || c.key || "未选"}」${QUEST_STATE_LABEL[c.state]}`;
      case "side": return `「${sideOpts().find((q) => q.id === c.key)?.label || c.key || "未选"}」${SIDE_STATE_LABEL[c.state]}`;
      default: return condBrief(c, events);
    }
  };

  const effectText = (f: FixedEffect): string => {
    const d = "delta" in f ? `${f.delta > 0 ? "+" : ""}${f.delta}` : "";
    switch (f.kind) {
      case "stat": return `${STAT_LABELS[f.key as StatKey] ?? f.key} ${d}`;
      case "metric": return `${FIXED_METRICS.find((m) => m.key === f.key)?.label ?? f.key} ${d}`;
      case "rel": return `与${personName(f.key)}关系 ${d}`;
      case "addItem": return `获得「${itemName(f.key)}」`;
      case "removeItem": return `失去「${itemName(f.key)}」`;
      case "unlockLocation": return `解锁 ${locName(f.key)}`;
      case "flag": return `变量「${f.key || "未命名"}」${f.set ? `设为 ${f.delta}` : d}`;
      default: return effectBrief(f);
    }
  };
  const libName = (id: string) => lib.events.find((e) => e.id === id)?.name ?? events.find((e) => e.id === id)?.name ?? id;

  /* ——— 事件库：仅本作品 / 当前世界自带的事件；新建作品为空，不带娱乐圈 123 条预设 ——— */
  if (mode === "library") {
    const have = new Set(events.map((e) => e.id));
    const importList = (list: FixedEvent[]) => {
      // NPC 之间的事件导入后默认「随机触发」
      const npcIds = new Set(lib.groups.filter((g) => g.kind === "npc").flatMap((g) => (Array.isArray(g.events) ? g.events : []).map((e) => e.id)));
      const fresh = list.filter((e) => !have.has(e.id)).map((e) => ({ ...structuredClone(e), random: e.random ?? npcIds.has(e.id) }));
      if (fresh.length) save([...events, ...fresh]);
    };
    const missingAll = lib.events.filter((e) => !have.has(e.id)).length;
    const emptyLib = lib.groups.length === 0;
    return (
      <div className="space-y-4">
        <ModeSwitch mode={mode} setMode={setMode} />
        {!modMode && <ScopeBanner scope="save">导入的事件写入当前存档。事件库内容来自当前世界观模组。</ScopeBanner>}
        {emptyLib ? (
          <EmptyState>
            {modMode
              ? "这部作品还没有事件库。请到「编辑」里新建事件，或用「我的模板」套用；不会预置娱乐圈事件，也不会出现「全部导入」。"
              : "当前世界观没有提供事件库。"}
          </EmptyState>
        ) : (
          <>
            <SearchBox value={q} onChange={setQ} placeholder="搜索事件名 / 提示词" />
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper-2/60 px-4 py-3">
              <p className="text-[12.5px] leading-relaxed text-ink-soft">
                共 <strong className="text-ink">{lib.events.length}</strong> 个事件，已加入 {lib.events.length - missingAll} 个。导入后可在「编辑」中逐条修改；人物链的后续节点默认「需激活」，由前一节点触发后解锁。
              </p>
              <button disabled={!missingAll} onClick={() => importList(lib.events)}
                className="shrink-0 rounded-full bg-gradient-to-r from-jade to-coral px-4 py-1.5 text-[12.5px] font-bold text-white shadow transition disabled:opacity-40">
                {missingAll ? `全部导入（${missingAll}）` : "已全部导入"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([{ id: "all", label: "全部" }, ...LIBRARY_KINDS] as { id: LibraryKind | "all"; label: string }[]).map((k) => {
                const n = (k.id === "all" ? lib.groups : lib.groups.filter((g) => g.kind === k.id)).reduce((t, g) => t + g.events.length, 0);
                if (k.id !== "all" && n === 0) return null;
                return (
                  <button key={k.id} onClick={() => setLibKind(k.id)}
                    className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${libKind === k.id ? "bg-jade text-white shadow" : "bg-paper-2 text-ink-soft ring-1 ring-line hover:text-ink"}`}>
                    {k.label} <span className="opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
            {q && !lib.events.some((e) => matches(q, e.name, e.prompt)) && <EmptyState>没有匹配「{q}」的事件。</EmptyState>}
            {lib.groups.filter((g) => libKind === "all" || g.kind === libKind).map((g) => {
              if (q && !g.events.some((e) => matches(q, e.name, e.prompt))) return null;
              const left = g.events.filter((e) => !have.has(e.id)).length;
              return (
                <section key={g.id} className="overflow-hidden rounded-2xl border border-line bg-paper-2/40">
                  <header className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-ink">{g.title}</span>
                      <span className="block truncate text-[11px] text-ink-soft">{g.desc}</span>
                    </span>
                    {!modMode && game && (() => {
                      const ids = randomGroupIds(lib.groups, game.randomGroups);
                      const on = ids.includes(g.id);
                      return (
                        <button onClick={() => setRandomGroups(on ? ids.filter((x) => x !== g.id) : [...ids, g.id])} aria-pressed={on}
                          title={`无需导入：满足条件时每回合约 ${Math.round(RANDOM_CHANCE * 100)}% 概率随机上演一桩`}
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${on ? "border-coral bg-coral/10 text-coral" : "border-line text-ink-soft hover:border-coral/50"}`}>
                          <span className="inline-flex items-center gap-1"><IconDice size={12} /> 随机{on ? "开" : "关"}</span>
                        </button>
                      );
                    })()}
                    <button disabled={!left} onClick={() => importList(g.events)}
                      className="shrink-0 rounded-full border border-jade/40 px-3 py-1 text-[11.5px] font-bold text-jade transition hover:bg-jade/10 disabled:border-line disabled:text-ink-soft/60">
                      {left ? `导入本组（${left}）` : "已导入"}
                    </button>
                  </header>
                  <ul className="divide-y divide-line/60">
                    {g.events.filter((e) => matches(q, e.name, e.prompt)).map((e) => {
                      const added = have.has(e.id);
                      return (
                        <li key={e.id} className="px-4 py-2.5">
                         <div className="flex items-start gap-3">
                          <button onClick={() => setLibOpen(libOpen === e.id ? null : e.id)} aria-expanded={libOpen === e.id} className="min-w-0 flex-1 text-left">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-semibold text-ink">{e.name}</span>
                              {e.locked && <span className="shrink-0 rounded bg-coral/12 px-1.5 py-px text-[10px] font-bold text-coral">需激活</span>}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-soft">
                              {g.kind === "npc" && <span className="mr-1 inline-flex items-center gap-0.5 font-bold text-coral"><IconDice size={12} /> 随机</span>}{timeText(e.time)}{(e.conds ?? []).map((c) => ` · ${condText(c)}`).join("")}
                            </span>
                            <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10.5px] font-bold text-jade/80">{libOpen === e.id ? <>收起详情 <IconChevronUp size={10} /></> : <>查看详情 <IconChevronDown size={10} /></>}</span>
                          </button>
                          <button disabled={added} onClick={() => importList([e])}
                            className="shrink-0 rounded-full bg-paper px-3 py-1 text-[11.5px] font-bold text-jade ring-1 ring-line transition hover:ring-jade/50 disabled:text-ink-soft/60">
                            {added ? "已加入" : "＋ 加入"}
                          </button>
                         </div>
                          {libOpen === e.id && (
                            <div className="mt-2.5 space-y-2.5 rounded-xl border border-line/70 bg-paper/70 p-3 text-[12px]">
                              <div className="flex flex-wrap gap-1.5">
                                <span className="rounded bg-jade/12 px-1.5 py-px text-[10px] font-bold text-jade">{e.once ? "一次性" : "可重复"}</span>
                                <span className={`rounded px-1.5 py-px text-[10px] font-bold ${e.locked ? "bg-coral/12 text-coral" : "bg-ink-soft/10 text-ink-soft"}`}>{e.locked ? "需前置事件激活" : "开局即可触发"}</span>
                                <span className="rounded bg-ink-soft/10 px-1.5 py-px text-[10px] font-bold text-ink-soft">{timeText(e.time)}</span>
                              </div>
                              <DetailRow label="触发条件">{e.conds?.length ? e.conds.map(condText).join("　·　") : "无（同时满足以上时间即可）"}</DetailRow>
                              <DetailRow label="属性变化">{e.effects?.length ? e.effects.map(effectText).join("　·　") : "无"}</DetailRow>
                              {e.nextIds?.length ? <DetailRow label="后续事件">{e.nextIds.map(libName).join("、")}</DetailRow> : null}
                              <DetailRow label="事件提示词"><span className="whitespace-pre-line leading-relaxed text-ink">{e.prompt}</span></DetailRow>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </div>
    );
  }

  /* ——— 预览模式：只呈现玩家已实际触发的事件（未触发者完全隐藏） ——— */
  if (mode === "preview") {
    const seen = events.filter((e) => fired.has(e.id));
    return (
      <div className="space-y-4">
        <ModeSwitch mode={mode} setMode={setMode} />
        <p className="text-[12.5px] leading-relaxed text-ink-soft">
          这是玩家视角：只显示已经实际触发过的固定事件。未满足条件的事件对玩家和 AI 完全不可见——不会出现在这里，也不会有任何「未解锁」提示。
        </p>
        {seen.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-paper-2/50 px-4 py-8 text-center text-[13px] text-ink-soft">
            玩家目前还没有触发任何固定事件。游戏照常自由进行。
          </div>
        ) : (
          <div className="space-y-2">
            {seen.map((e) => (
              <div key={e.id} className="rounded-2xl border border-line bg-paper-2/60 px-4 py-3">
                <p className="text-[14px] font-bold text-ink">{e.name || "（未命名事件）"}</p>
                <p className="mt-1 line-clamp-2 text-[12px] text-ink-soft">{e.prompt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ——— 编辑模式 ——— */
  return (
    <div className="space-y-4">
      {confirmEl}
      <ModeSwitch mode={mode} setMode={setMode} />
      {!modMode && <ScopeBanner scope="save">固定事件只作用于当前存档，修改即时保存。模组预设剧本只在新开局时写入。</ScopeBanner>}
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        固定事件是可选的：不配置任何事件时，玩家可一直自由游玩。除「事件名称」「事件提示词」外，其余字段皆可留空。
        所有条件默认需要<strong className="text-ink">同时满足</strong>；满足后由代码结算数值，再把提示词交 AI 演绎剧情与对白。
      </p>

      {tpls.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-paper-2/40 px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">我的模板</span>
          {tpls.map((t) => (
            <span key={t.id} className="inline-flex items-center overflow-hidden rounded-full border border-line bg-paper text-[12px]">
              <button onClick={() => addFromTpl(t)} className="px-2.5 py-1 font-semibold text-jade hover:bg-jade/10" title="用这个模板新建事件">＋ {t.name}</button>
              <button onClick={() => setTpls(removeTemplate(t.id))} className="border-l border-line px-1.5 py-1 text-ink-soft hover:text-danger" aria-label={`删除模板 ${t.name}`}></button>
            </span>
          ))}
        </div>
      )}
      {toast && <p role="status" className="rounded-xl bg-jade/10 px-3 py-2 text-[12.5px] font-semibold text-jade">{toast}</p>}

      <AiEventWriter
        existing={events}
        world={worldContext}
        onApply={(list) => { save(list); setOpenId(list[0]?.id ?? null); }}
      />

      {events.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-paper-2/50 px-4 py-6 text-center text-[13px] text-ink-soft">
          还没有固定事件。点下方「＋ 新增固定事件」开始编排剧本。
        </div>
      )}

      {events.length > 0 && <AuditBar issues={evIssues} onJump={(at) => { setQ(""); setOpenId(at.slice(6)); }} />}
      {events.length > 4 && <SearchBox value={q} onChange={setQ} placeholder="搜索事件名 / 提示词" count={events.filter((e) => matches(q, e.name, e.prompt)).length} />}
      {q && events.length > 0 && !events.some((e) => matches(q, e.name, e.prompt)) && <EmptyState>没有匹配「{q}」的事件。</EmptyState>}

      <div className="space-y-2">
        {events.map((e) => {
          if (!matches(q, e.name, e.prompt)) return null;
          const open = openId === e.id;
          return (
            <div key={e.id} id={auditDomId(`event:${e.id}`)} className="scroll-mt-3 overflow-hidden rounded-2xl border border-line bg-paper-2/60">
              <button onClick={() => setOpenId(open ? null : e.id)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-bold text-ink">{e.name || "（未命名事件）"}</span>
                    <AuditBadge issues={issuesAt(audit, `event:${e.id}`)} />
                    {e.once && <span className="shrink-0 rounded bg-jade/12 px-1.5 py-px text-[10px] font-bold text-jade">一次性</span>}
                    {e.locked && <span className="shrink-0 rounded bg-coral/12 px-1.5 py-px text-[10px] font-bold text-coral">需激活</span>}
                    {fired.has(e.id) && <span className="shrink-0 rounded bg-gold/15 px-1.5 py-px text-[10px] font-bold text-gold">已触发</span>}
                    {(game?.sim.eventsActive ?? []).includes(e.id) && <span className="shrink-0 rounded bg-coral/15 px-1.5 py-px text-[10px] font-bold text-coral">进行中</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                    {e.random && <span className="mr-1 inline-flex items-center gap-0.5 font-bold text-coral"><IconDice size={12} /> 随机</span>}
                    {e.trigger && e.trigger.kind !== "auto" && <span className="mr-1 font-bold text-jade">{TRIGGER_LABEL[e.trigger.kind]} ·</span>}
                    {String(e.chain ?? "").trim() && <span className="mr-1 font-bold text-gold">链「{String(e.chain ?? "").trim()}」·</span>}
                    {e.keywords?.length ? <span className="mr-1 font-bold text-jade">关键词：{e.keywords.slice(0, 3).join("、")}{e.keywords.length > 3 ? "…" : ""} ·</span> : null}{timeText(e.time)}
                    {(e.conds?.length ?? 0) > 0 ? ` · ${e.conds!.length} 项条件` : " · 无条件"}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-ink-soft">{open ? <>收起 <IconChevronUp size={12} /></> : <>展开 <IconChevronDown size={12} /></>}</span>
              </button>

              {open && (
                <div className="space-y-4 border-t border-line px-4 py-3">
                  <AuditList issues={issuesAt(audit, `event:${e.id}`)} />
                  {/* 名称 */}
                  <Field label="事件名称">
                    <input value={String(e.name ?? "")} onChange={(ev) => patch(e.id, { name: ev.target.value })}
                      placeholder="如：第一次试镜" className={`w-full rounded-lg border bg-paper-2 px-2.5 py-1.5 text-[13px] text-ink ${String(e.name ?? "").trim() ? "border-line" : "border-danger"}`} />
                    {!String(e.name ?? "").trim() && <p className="mt-0.5 text-[11px] text-danger">必填：事件名称。</p>}
                  </Field>

                  <Field label="触发方式">
                    <TriggerEditor ev={e} events={events} onChange={(trigger) => patch(e.id, { trigger })} />
                  </Field>

                  <Field label="剧情 BGM（可不填）">
                    <div className="flex flex-wrap items-center gap-2">
                      <AudioPicker value={e.bgm} kind="bgm" empty="（不切换，沿用当前音乐）" className={selCls} onChange={(bgm) => patch(e.id, { bgm })} />
                      <span className="text-[11px] text-ink-soft">上演时淡出当前曲目、淡入这首</span>
                    </div>
                  </Field>

                  {/* 触发时间 */}
                  <Field label="触发时间（可不填）">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className={selCls} value={e.time?.kind ?? "none"}
                        onChange={(ev) => {
                          const k = ev.target.value as FixedEventTime["kind"];
                          const time: FixedEventTime = k === "day" ? { kind: "day", day: 1 } : k === "date" ? { kind: "date", date: "" }
                            : k === "every" ? { kind: "every", days: 7 } : k === "weekly" ? { kind: "weekly", dow: 5 } : k === "monthly" ? { kind: "monthly", d: 1 } : k === "yearly" ? { kind: "yearly", md: "01.01" } : { kind: "none" };
                          // 周期事件天然可重复：切到周期触发时自动取消「只触发一次」
                          patch(e.id, PERIODIC_TIME.has(k) ? { time, once: false } : { time });
                        }}>
                        <option value="none">不设时间 · 仅凭条件</option>
                        <option value="day">开始后第几天</option>
                        <option value="date">固定游戏日期</option>
                        <optgroup label="周期触发（可重复）">
                          <option value="every">每隔 N 天</option>
                          <option value="weekly">每周固定一天</option>
                          <option value="monthly">每月固定一天</option>
                          <option value="yearly">每年固定日期</option>
                        </optgroup>
                      </select>
                      {e.time?.kind === "every" && (() => { const t = e.time; return (
                        <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-soft">每隔
                          <input type="number" min={1} className={numCls} value={t.days} onChange={(ev) => patch(e.id, { time: { ...t, days: Math.max(1, Number(ev.target.value) || 1) } })} />天一次，从第
                          <input type="number" min={0} className={numCls} value={t.start ?? 0} onChange={(ev) => patch(e.id, { time: { ...t, start: Math.max(0, Number(ev.target.value) || 0) || undefined } })} />天起
                        </span>
                      ); })()}
                      {e.time?.kind === "weekly" && (() => { const t = e.time; return (
                        <select className={selCls} value={t.dow} onChange={(ev) => patch(e.id, { time: { kind: "weekly", dow: Number(ev.target.value) } })} aria-label="每周几">
                          {"一二三四五六日".split("").map((d, i) => <option key={i} value={i}>每周{d}</option>)}
                        </select>
                      ); })()}
                      {e.time?.kind === "monthly" && (() => { const t = e.time; return (
                        <span className="flex items-center gap-1 text-[12.5px] text-ink-soft">每月
                          <input type="number" min={1} max={31} className={numCls} value={t.d} onChange={(ev) => patch(e.id, { time: { kind: "monthly", d: Math.min(31, Math.max(1, Number(ev.target.value) || 1)) } })} />号
                        </span>
                      ); })()}
                      {e.time?.kind === "yearly" && (() => { const t = e.time; return (<>
                        <input className={selCls + " w-24"} placeholder="12.25" value={t.md ?? ""} onChange={(ev) => patch(e.id, { time: { kind: "yearly", md: ev.target.value } })} aria-label="每年几月几日" />
                        {(() => { const m = /^(\d{1,2})[-./](\d{1,2})$/.exec((t.md ?? "").trim()); return !m || +m[1] < 1 || +m[1] > 12 || +m[2] < 1 || +m[2] > 31; })() && <span className="text-[11px] text-danger">格式须为 月.日，如 12.25</span>}
                      </>); })()}
                      {e.time?.kind === "day" && (
                        <span className="flex items-center gap-1 text-[12.5px] text-ink-soft">第
                          <input type="number" className={numCls} value={e.time.day}
                            onChange={(ev) => patch(e.id, { time: { kind: "day", day: Math.max(0, Number(ev.target.value) || 0) } })} />天起
                        </span>
                      )}
                      {e.time?.kind === "date" && (
                        <input className={selCls + " w-32"} placeholder="2005.03.15" value={e.time.date}
                          onChange={(ev) => patch(e.id, { time: { kind: "date", date: ev.target.value } })} />
                      )}
                      {e.time?.kind === "date" && !/^\d{4}[-./]\d{2}[-./]\d{2}$/.test(e.time.date) && <span className="text-[11px] text-danger">日期格式须为 2005.03.15</span>}
                    </div>
                    {e.time && PERIODIC_TIME.has(e.time.kind) && <p className="mt-1 text-[11px] leading-snug text-ink-soft">周期事件每个周期最多上演一次；到点时条件还不满足，会在本周期内等条件满足再上演，过了这个周期就等下一次。开局之前已过的日子不会补演。</p>}
                  </Field>

                  {/* 属性条件 */}
                  <Field label="属性条件（可不填 · 默认全部满足）">
                    <div className="space-y-2">
                      {(e.conds ?? []).map((c, i) => (
                        <CondRow key={i} c={c} events={events} selfId={e.id} quests={quests} sides={sides}
                          onChange={(nc) => patch(e.id, { conds: (e.conds ?? []).map((x, j) => (j === i ? nc : x)) })}
                          onDelete={() => patch(e.id, { conds: (e.conds ?? []).filter((_, j) => j !== i) })} />
                      ))}
                      <select className={selCls} value=""
                        onChange={(ev) => { const k = ev.target.value as FixedCond["kind"]; if (k) patch(e.id, { conds: [...(e.conds ?? []), defaultCond(k)] }); }}>
                        <option value="">＋ 添加条件…</option>
                        <option value="stat">主角属性</option>
                        <option value="metric">名气/口碑/压力等</option>
                        <option value="rel">与 NPC 的关系</option>
                        <option value="location">当前地点</option>
                        <option value="item">持有物品</option>
                        <option value="event">已触发事件</option>
                        <option value="flag">规则变量（含事件链状态）</option>
                        <option value="quest">主线节点</option>
                        <option value="side">支线进度</option>
                      </select>
                      <CondLogic x={e} events={events} selfId={e.id} quests={quests} sides={sides} onChange={(p) => patch(e.id, p)} />
                    </div>
                  </Field>

                  {/* 事件提示词 */}
                  <Field label="事件提示词（交 AI 演绎）">
                    <textarea value={String(e.prompt ?? "")} onChange={(ev) => patch(e.id, { prompt: ev.target.value })} rows={3}
                      placeholder="描述这一幕的情境、要发生什么。AI 只负责剧情描写与人物对白，不决定是否触发。"
                      className={`w-full resize-y rounded-lg border bg-paper-2 px-2.5 py-1.5 text-[13px] leading-relaxed text-ink ${String(e.prompt ?? "").trim() ? "border-line" : "border-danger"}`} />
                    {!String(e.prompt ?? "").trim() && <p className="mt-0.5 text-[11px] text-danger">必填：没有提示词时 AI 无从演绎。</p>}
                  </Field>

                  {/* 触发后果 */}
                  <Field label="触发后的属性变化（可不填 · 由代码结算）">
                    <div className="space-y-2">
                      {(e.effects ?? []).map((ef, i) => (
                        <EffectRow key={i} ef={ef}
                          onChange={(ne) => patch(e.id, { effects: (e.effects ?? []).map((x, j) => (j === i ? ne : x)) })}
                          onDelete={() => patch(e.id, { effects: (e.effects ?? []).filter((_, j) => j !== i) })} />
                      ))}
                      <select className={selCls} value=""
                        onChange={(ev) => { const k = ev.target.value as FixedEffect["kind"]; if (k) patch(e.id, { effects: [...(e.effects ?? []), defaultEffect(k)] }); }}>
                        <option value="">＋ 添加后果…</option>
                        <option value="stat">增减主角属性</option>
                        <option value="metric">增减名气/口碑/压力等</option>
                        <option value="rel">增减 NPC 关系</option>
                        <option value="addItem">获得物品</option>
                        <option value="removeItem">移除物品</option>
                        <option value="unlockLocation">解锁地点</option>
                      </select>
                    </div>
                  </Field>

                  {/* 后续事件 */}
                  <Field label="后续事件（触发后激活，可不填）">
                    <div className="flex flex-wrap gap-1.5">
                      {events.filter((o) => o.id !== e.id).length === 0 && <span className="text-[12px] text-ink-soft">暂无其他事件可关联。</span>}
                      {events.filter((o) => o.id !== e.id).map((o) => {
                        const on = (e.nextIds ?? []).includes(o.id);
                        return (
                          <button key={o.id}
                            onClick={() => patch(e.id, { nextIds: on ? (e.nextIds ?? []).filter((x) => x !== o.id) : [...(e.nextIds ?? []), o.id] })}
                            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${on ? "border-transparent bg-jade text-white" : "border-line bg-paper-2 text-ink-soft"}`}>
                            {o.name || "（未命名）"}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  {/* 功能注释：事件选项 / 结束关键词编辑入口已下线；旧稿字段仍可读，运行时兼容 */}
                  <Field label="事件链（可不填）">
                    <ChainEditor ev={e} events={events} game={modMode ? null : game} onChange={(p) => patch(e.id, p)} />
                  </Field>

                  <Field label="关键词触发（可不填）">
                    <KwInput value={e.keywords} onChange={(keywords) => patch(e.id, { keywords })} placeholder="如：婚礼、求婚（用顿号或逗号分隔）" />
                    <p className="mt-0.5 text-[11px] text-ink-soft">填了关键词，事件就不再按顺序自动上演：玩家发言或最近两回合剧情里出现任一词时才触发，且仍需满足上面的时间与条件。</p>
                  </Field>

                  {/* 开关 */}
                  <div className="flex flex-wrap gap-4">
                    <Toggle checked={!!e.once} label="只触发一次" onChange={(v) => patch(e.id, { once: v })} />
                    <Toggle checked={!!e.locked} label="需由前置事件激活" onChange={(v) => patch(e.id, { locked: v })} />
                    <Toggle checked={!!e.inline} label="插入对话流（不弹剧情幕，直接写进主剧情）" onChange={(v) => patch(e.id, { inline: v || undefined })} />
                    <Toggle checked={!!e.random} label={`随机触发（满足条件时约 ${Math.round(RANDOM_CHANCE * 100)}% 概率上演）`} onChange={(v) => patch(e.id, { random: v })} />
                    {!e.once && (
                      <label className="flex items-center gap-1.5 text-[12.5px] text-ink">
                        冷却
                        <input type="number" min={0} className="w-16 rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px]" value={e.cooldown ?? ""} placeholder="0"
                          onChange={(ev) => { const n = Math.max(0, Math.round(Number(ev.target.value)) || 0); patch(e.id, { cooldown: n || undefined }); }} />
                        天
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <span className="flex gap-1.5">
                      <button onClick={() => move(e.id, -1)} disabled={events[0]?.id === e.id} className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-ink disabled:opacity-30" aria-label="上移">↑</button>
                      <button onClick={() => move(e.id, 1)} disabled={events[events.length - 1]?.id === e.id} className="rounded-lg border border-line px-2 py-1.5 text-[12px] text-ink disabled:opacity-30" aria-label="下移">↓</button>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                    <button onClick={() => { setTpls(saveTemplate(e)); flash(`已存为模板「${e.name || "未命名事件"}」`); }} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-jade hover:text-jade">存为模板</button>
                    {!modMode && <button onClick={() => toWorldBook(e)} disabled={!String(e.prompt ?? "").trim()} className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40">写入世界书</button>}
                    <button onClick={() => remove(e.id)} className="rounded-lg border border-danger/50 px-3 py-1.5 text-[12.5px] font-bold text-danger transition hover:bg-danger/10">
                      删除事件
                    </button>
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-ink-soft">
                    「预览演绎」会临时演绎这一幕，仅供你查看效果——不会结算数值、不登记触发、不写入正式存档。
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={add} className="w-full rounded-2xl border border-dashed border-jade/60 bg-jade/5 py-3 text-[13px] font-bold text-jade transition hover:bg-jade/10">
        ＋ 新增固定事件
      </button>
    </div>
  );
}

type Mode = "edit" | "library" | "preview";
const MODE_LABEL: Record<Mode, string> = { edit: "编辑", library: "事件库", preview: "预览" };
function ModeSwitch({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-paper-2/60 p-0.5 text-[12.5px] font-bold">
      {(["edit", "library", "preview"] as const).map((m) => (
        <button key={m} onClick={() => setMode(m)}
          className={`rounded-full px-4 py-1.5 transition ${mode === m ? "bg-gradient-to-r from-jade to-coral text-white shadow" : "text-ink-soft"}`}>
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      <div className="text-ink">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">{label}</p>
      {children}
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[var(--jade)]" />
      {label}
    </label>
  );
}

/* srcs / people：调用方（如结局编辑器）传入「正在编辑的作品」的数值来源与人物；不传则用当前世界 */
/* sides：剧情线编辑器传入「正在编辑的作品」的支线；不传则用当前世界 */
export function CondRow({ c, events, selfId, onChange, onDelete, srcs, people, quests, sides }: { c: FixedCond; events: FixedEvent[]; selfId: string; onChange: (c: FixedCond) => void; onDelete: () => void; srcs?: ValueSrc[]; people?: { id: string; name: string }[]; quests?: QuestOpt[]; sides?: QuestOpt[] }) {
  const qOpts = quests ?? questOpts();
  const sOpts = sides ?? sideOpts();
  const statOpts = srcs ? srcs.filter((x) => x.kind === "stat").map((x) => ({ v: x.key, l: x.label })) : STAT_ORDER.map((k) => ({ v: k as string, l: STAT_LABELS[k] }));
  const metricOpts = srcs ? srcs.filter((x) => x.kind === "metric").map((x) => ({ v: x.key, l: x.label })) : FIXED_METRICS.map((m) => ({ v: m.key, l: m.label }));
  const peopleOpts = (people ?? PEOPLE).map((p) => ({ v: p.id, l: p.name }));
  const ck = "key" in c ? c.key : "";
  const keyOpts = (opts: { v: string; l: string }[]) => (
    <>
      {!opts.some((o) => o.v === ck) && <option value={ck}>{ck ? `已失效：${ck}` : "（请选择）"}</option>}
      {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
    </>
  );
  const numeric = c.kind === "stat" || c.kind === "metric" || c.kind === "rel";
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-paper/50 px-2 py-1.5">
      <select className={selCls} value={c.kind} onChange={(e) => onChange(defaultCond(e.target.value as FixedCond["kind"]))}>
        <option value="stat">主角属性</option>
        <option value="metric">指标</option>
        <option value="rel">NPC 关系</option>
        <option value="location">当前地点</option>
        <option value="item">持有物品</option>
        <option value="event">已触发事件</option>
        <option value="time">已过时间</option>
        <option value="date">游戏日期</option>
        <option value="clock">当日时段</option>
        <option value="flag">规则变量</option>
        <option value="quest">主线进度</option>
        <option value="side">支线进度</option>
        <option value="faction">阵营声望</option>
        <option value="visited">去过的地点</option>
        <option value="relSet">多人好感</option>
        <option value="memory">记忆标记</option>
        <option value="flagSet">标记是否存在</option>
        <option value="group">（ ）括号子组</option>
        <option value="modVar">MOD 私有变量</option>
        <option value="modCfg">MOD 配置分支</option>
        <option value="modCond">MOD 条件算子</option>
      </select>
      {(c.kind === "modVar" || c.kind === "modCfg") && (
        <>
          <ModRefPicker mod={c.mod} value={c.key} list={c.kind === "modVar" ? "vars" : "config"} onChange={(mod, key) => onChange({ ...c, mod, key })} />
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })}>
            {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <input type="number" className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })} />
        </>
      )}
      {c.kind === "modCond" && <ModRefPicker mod={c.mod} value={c.id} list="conds" onChange={(mod, id) => onChange({ ...c, mod, id })} />}

      {c.kind === "flagSet" && (
        <>
          <input className={`${numCls} !w-28`} placeholder="标记名" value={c.key} maxLength={24} onChange={(e) => onChange({ ...c, key: e.target.value.trim() })} />
          <select className={selCls} value={c.exists === false ? "no" : "yes"} onChange={(e) => onChange({ ...c, exists: e.target.value === "yes" })}>
            <option value="yes">存在</option>
            <option value="no">不存在</option>
          </select>
        </>
      )}
      {c.kind === "group" && (
        <div className="w-full space-y-1.5 border-l-2 border-jade/40 pl-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" aria-pressed={!!c.not} onClick={() => onChange({ ...c, not: !c.not || undefined })}
              className={`rounded-full border px-2 py-0.5 text-[11.5px] font-bold transition ${c.not ? "border-transparent bg-coral text-white" : "border-line bg-paper-2 text-ink-soft"}`}>非</button>
            <select className={selCls} value={c.match} onChange={(e) => onChange({ ...c, match: e.target.value as "all" | "any" })}>
              <option value="all">以下全部满足（且）</option>
              <option value="any">以下任一满足（或）</option>
            </select>
            <button type="button" onClick={() => onChange({ ...c, conds: [...(c.conds ?? []), defaultCond("flag")] })} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">+ 条件</button>
            <button type="button" onClick={() => onChange({ ...c, conds: [...(c.conds ?? []), defaultCond("group")] })} className="rounded-lg border border-line px-2 py-1 text-[12px] text-ink-soft hover:text-ink">+ 子组</button>
          </div>
          {/* 功能注释：脏稿/AI 条件组常缺 conds；兜底空数组，避免④剧情展开条件行时 .length 崩页 */}
          {!(c.conds ?? []).length && <p className="text-[11.5px] text-ink-soft">空组视为成立。</p>}
          {(c.conds ?? []).map((x, i) => (
            <CondRow key={i} c={x} events={events} selfId={selfId} srcs={srcs} people={people} quests={quests} sides={sides}
              onChange={(nx) => onChange({ ...c, conds: (c.conds ?? []).map((y, j) => (j === i ? nx : y)) })}
              onDelete={() => onChange({ ...c, conds: (c.conds ?? []).filter((_, j) => j !== i) })} />
          ))}
        </div>
      )}
      {c.kind === "stat" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {keyOpts(statOpts)}
        </select>
      )}
      {c.kind === "metric" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {keyOpts(metricOpts)}
        </select>
      )}
      {c.kind === "rel" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {keyOpts(peopleOpts)}
        </select>
      )}
      {c.kind === "location" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}
      {c.kind === "item" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {ALL_ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      )}
      {c.kind === "event" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          <option value="">（选择事件）</option>
          {events.filter((o) => o.id !== selfId).map((o) => <option key={o.id} value={o.id}>{o.name || "（未命名）"}</option>)}
        </select>
      )}

      {c.kind === "time" && (
        <>
          <span className="text-[12px] text-ink-soft">开局后</span>
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as "gte" | "lte" })}>
            <option value="gte">满</option>
            <option value="lte">不超过</option>
          </select>
          <input type="number" min={0} step={0.5} className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Math.max(0, Number(e.target.value) || 0) })} />
          <select className={selCls} value={c.unit} onChange={(e) => onChange({ ...c, unit: e.target.value as typeof c.unit })}>
            {(["day", "week", "month", "year"] as const).map((u) => <option key={u} value={u}>{TIME_UNIT_LABEL[u]}</option>)}
          </select>
        </>
      )}
      {c.kind === "date" && (
        <>
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as "gte" | "lte" })}>
            <option value="gte">不早于</option>
            <option value="lte">不晚于</option>
          </select>
          <input className={`${numCls} !w-28`} placeholder="2006.09.01" value={c.date} maxLength={10} onChange={(e) => onChange({ ...c, date: e.target.value.trim() })} />
          {c.date && !/^\d{4}\.\d{2}\.\d{2}$/.test(c.date) && <span className="text-[11px] text-danger">格式 YYYY.MM.DD</span>}
        </>
      )}

      {c.kind === "quest" && (
        <>
          <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
            {!qOpts.some((q) => q.id === c.key) && <option value={c.key}>{c.key ? `已失效：${c.key}` : "（请先在「剧情线 · 主线」添加）"}</option>}
            {qOpts.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
          <select className={selCls} value={c.state} onChange={(e) => onChange({ ...c, state: e.target.value as QuestState })}>
            {(Object.keys(QUEST_STATE_LABEL) as QuestState[]).map((k) => <option key={k} value={k}>{QUEST_STATE_LABEL[k]}</option>)}
          </select>
        </>
      )}
      {c.kind === "side" && (
        <>
          <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
            {!sOpts.some((q) => q.id === c.key) && <option value={c.key}>{c.key ? `已失效：${c.key}` : "（请先在「剧情线 · 支线」添加）"}</option>}
            {sOpts.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}
          </select>
          <select className={selCls} value={c.state} onChange={(e) => onChange({ ...c, state: e.target.value as SideState })}>
            {(Object.keys(SIDE_STATE_LABEL) as SideState[]).map((k) => <option key={k} value={k}>{SIDE_STATE_LABEL[k]}</option>)}
          </select>
        </>
      )}
      {c.kind === "clock" && (
        <>
          <input type="time" className={`${numCls} !w-24`} value={c.from} onChange={(e) => onChange({ ...c, from: e.target.value })} aria-label="开始" />
          <span className="text-[12px] text-ink-soft">至</span>
          <input type="time" className={`${numCls} !w-24`} value={c.to} onChange={(e) => onChange({ ...c, to: e.target.value })} aria-label="结束" />
          <span className="text-[11px] text-ink-soft">可跨午夜</span>
        </>
      )}
      {c.kind === "faction" && (
        <>
          <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
            {keyOpts(liveFactions().map((f) => ({ v: f.id, l: f.name || "（未命名阵营）" })))}
          </select>
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })}>
            {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <input type="number" min={-100} max={100} className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Math.max(-100, Math.min(100, Number(e.target.value) || 0)) })} />
        </>
      )}
      {c.kind === "visited" && (
        <select className={selCls} value={c.key} onChange={(e) => onChange({ ...c, key: e.target.value })}>
          {keyOpts(LOCATIONS.map((l) => ({ v: l.id, l: l.name })))}
        </select>
      )}
      {c.kind === "memory" && (
        <input className={`${numCls} !w-36`} placeholder="标记名，如 救过流浪猫" value={c.key} maxLength={24} onChange={(e) => onChange({ ...c, key: e.target.value.trim() })} />
      )}
      {c.kind === "relSet" && (
        <>
          <span className="flex flex-wrap gap-1">
            {peopleOpts.map((p) => { const on = c.keys.includes(p.v); return (
              <button key={p.v} type="button" aria-pressed={on} onClick={() => onChange({ ...c, keys: on ? c.keys.filter((k) => k !== p.v) : [...c.keys, p.v] })}
                className={`rounded-full border px-2 py-0.5 text-[11.5px] transition ${on ? "border-transparent bg-jade text-white" : "border-line bg-paper-2 text-ink-soft"}`}>{p.l}</button>
            ); })}
          </span>
          <span className="text-[12px] text-ink-soft">中</span>
          <select className={selCls} value={c.need ?? 0} onChange={(e) => onChange({ ...c, need: Number(e.target.value) || undefined })}>
            <option value={0}>全部</option>
            {c.keys.slice(0, -1).map((_, i) => <option key={i} value={i + 1}>至少 {i + 1} 人</option>)}
          </select>
          <span className="text-[12px] text-ink-soft">好感</span>
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })}>
            {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <input type="number" className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })} />
        </>
      )}
      {c.kind === "flag" && (
        <>
          <input className={`${numCls} !w-28`} placeholder="变量名，如 连续加班" value={c.key} maxLength={24} onChange={(e) => onChange({ ...c, key: e.target.value.trim() })} />
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })}>
            {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <input type="number" className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })} />
        </>
      )}

      {numeric && (
        <>
          <select className={selCls} value={c.op} onChange={(e) => onChange({ ...c, op: e.target.value as CmpOp })}>
            {CMP_OPS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <input type="number" className={numCls} value={c.value} onChange={(e) => onChange({ ...c, value: Number(e.target.value) || 0 })} />
        </>
      )}

      <button onClick={onDelete} className="ml-auto rounded px-2 py-1 text-[12px] font-bold text-danger"></button>
    </div>
  );
}

export function EffectRow({ ef, onChange, onDelete }: { ef: FixedEffect; onChange: (e: FixedEffect) => void; onDelete: () => void }) {
  const numeric = ef.kind === "stat" || ef.kind === "metric" || ef.kind === "rel";
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-paper/50 px-2 py-1.5">
      <select className={selCls} value={ef.kind} onChange={(e) => onChange(defaultEffect(e.target.value as FixedEffect["kind"]))}>
        <option value="stat">主角属性</option>
        <option value="metric">指标</option>
        <option value="rel">NPC 关系</option>
        <option value="addItem">获得物品</option>
        <option value="removeItem">移除物品</option>
        <option value="unlockLocation">解锁地点</option>
        <option value="flag">规则变量</option>
        <option value="faction">阵营声望</option>
        <option value="memory">记忆标记</option>
        <option value="modVar">MOD 私有变量</option>
        <option value="modAction">MOD 内部动作（仅本 MOD / 工程）</option>
        <option value="modCall">调用 MOD 导出动作</option>
        <option value="audio">音频</option>
      </select>
      {ef.kind === "modVar" && (
        <>
          <ModRefPicker mod={ef.mod} value={ef.key} list="vars" onChange={(mod, key) => onChange({ ...ef, mod, key })} />
          <select className={selCls} value={ef.set ? "set" : "add"} onChange={(e) => onChange({ ...ef, set: e.target.value === "set" || undefined })}>
            <option value="add">增减</option>
            <option value="set">设为</option>
          </select>
          <input type="number" className={numCls} value={ef.delta} onChange={(e) => onChange({ ...ef, delta: Number(e.target.value) || 0 })} />
        </>
      )}
      {ef.kind === "modAction" && <ModRefPicker mod={ef.mod} value={ef.id} list="actions" onChange={(mod, id) => onChange({ ...ef, mod, id })} />}
      {ef.kind === "modCall" && (
        <>
          <ModExportPicker kind="actions" mod={ef.mod} id={ef.id} onChange={(mod, id) => onChange({ kind: "modCall", mod, id })} />
          <ArgsEditor params={exportOptions("actions").find((o) => o.mod === ef.mod && o.id === ef.id)?.params ?? []} value={ef.args} onChange={(args) => onChange({ ...ef, args })} />
        </>
      )}
      {ef.kind === "audio" && (
        <>
          <select className={selCls} value={ef.op} onChange={(e) => onChange({ ...ef, op: e.target.value as typeof ef.op })} aria-label="音频动作">
            <option value="play">播放音频</option>
            <option value="stop">停止指定音频</option>
            <option value="stopAll">停止全部音频</option>
            <option value="switchBgm">平滑切换 BGM</option>
            <option value="volume">调整音量</option>
          </select>
          {ef.op !== "stopAll" && <AudioPicker value={ef.id} kind={ef.op === "switchBgm" ? "bgm" : undefined} empty={ef.op === "volume" ? "（当前 BGM）" : "（请选择音频）"} className={selCls} onChange={(id) => onChange({ ...ef, id })} />}
          {(ef.op === "play" || ef.op === "switchBgm" || ef.op === "volume") && (
            <label className="flex items-center gap-1 text-[11.5px] text-ink-soft">音量
              <input type="number" min={0} max={100} className={numCls} value={Math.round((ef.volume ?? 1) * 100)} onChange={(e) => onChange({ ...ef, volume: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 })} />%</label>
          )}
          <label className="flex items-center gap-1 text-[11.5px] text-ink-soft">{ef.op === "volume" ? "渐变" : ef.op === "play" || ef.op === "switchBgm" ? "淡入" : "淡出"}
            <input type="number" min={0} step={100} className={numCls} placeholder="默认" value={ef.fade ?? ""} onChange={(e) => onChange({ ...ef, fade: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value) || 0) })} />ms</label>
        </>
      )}
      {ef.kind === "modEmit" && <span className="text-[11.5px] text-ink-soft">广播「{ef.event || "未选"}」：只能在 MOD 内部动作里使用</span>}

      {ef.kind === "faction" && (
        <>
          <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
            {!liveFactions().some((f) => f.id === ef.key) && <option value={ef.key}>{ef.key ? `已失效：${ef.key}` : "（先在「阵营派系」添加）"}</option>}
            {liveFactions().map((f) => <option key={f.id} value={f.id}>{f.name || "（未命名阵营）"}</option>)}
          </select>
          <input type="number" className={numCls} value={ef.delta} onChange={(e) => onChange({ ...ef, delta: Number(e.target.value) || 0 })} />
        </>
      )}
      {ef.kind === "memory" && (
        <>
          <select className={selCls} value={ef.clear ? "clear" : "set"} onChange={(e) => onChange({ ...ef, clear: e.target.value === "clear" || undefined })}>
            <option value="set">记下</option>
            <option value="clear">抹去</option>
          </select>
          <input className={`${numCls} !w-36`} placeholder="标记名，如 救过流浪猫" value={ef.key} maxLength={24} onChange={(e) => onChange({ ...ef, key: e.target.value.trim() })} />
        </>
      )}
      {ef.kind === "flag" && (
        <>
          <input className={`${numCls} !w-28`} placeholder="变量名" value={ef.key} maxLength={24} onChange={(e) => onChange({ ...ef, key: e.target.value.trim() })} />
          <select className={selCls} value={ef.set ? "set" : "add"} onChange={(e) => onChange({ ...ef, set: e.target.value === "set" || undefined })}>
            <option value="add">增减</option>
            <option value="set">设为</option>
          </select>
          <input type="number" className={numCls} value={ef.delta} onChange={(e) => onChange({ ...ef, delta: Number(e.target.value) || 0 })} />
        </>
      )}
      {ef.kind === "stat" && (
        <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
          {STAT_ORDER.map((k) => <option key={k} value={k}>{STAT_LABELS[k]}</option>)}
        </select>
      )}
      {ef.kind === "metric" && (
        <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
          {FIXED_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      )}
      {ef.kind === "rel" && (
        <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
          {PEOPLE.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      {(ef.kind === "addItem" || ef.kind === "removeItem") && (
        <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
          {ALL_ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      )}
      {ef.kind === "unlockLocation" && (
        <select className={selCls} value={ef.key} onChange={(e) => onChange({ ...ef, key: e.target.value })}>
          {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      )}

      {numeric && (
        <input type="number" className={numCls} value={ef.delta} onChange={(e) => onChange({ ...ef, delta: Number(e.target.value) || 0 })} />
      )}

      <button onClick={onDelete} className="ml-auto rounded px-2 py-1 text-[12px] font-bold text-danger"></button>
    </div>
  );
}

