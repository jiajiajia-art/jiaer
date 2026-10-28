import { IconChevronUp, IconClose, IconSpark } from "../lib/icons";
import { useState } from "react";
import type { AttrDef, AttrTier } from "../lib/types";
import { ColorPick } from "./EditorKit";
import { RAW_STAT_LABELS, RAW_STAT_ORDER, type StatKey, type StatsSlot } from "../game/data";

/* 模组编辑器 · 角色属性：新增自定义属性（名称/图标/初值/上限/分档/显示方式/AI 说明），
 * 并可给八维能力设分档。开新局生效；游玩中 AI 按剧情增减。 */
const inp = "min-w-0 rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const DISPLAY = [
  { v: "both", l: "数值 + 档位" },
  { v: "tier", l: "只显示档位" },
  { v: "num", l: "只显示数值" },
] as const;
const uid = () => `attr_${Math.random().toString(36).slice(2, 7)}`;
const num = (v: string) => Number(v) || 0;

function TierRows({ list, max, onChange, story }: { list: AttrTier[]; max: number; onChange: (l?: AttrTier[]) => void; story?: boolean }) {
  const commit = (l: AttrTier[]) => onChange(l.length ? l : undefined);
  const set = (i: number, p: Partial<AttrTier>) => commit(list.map((t, j) => (j === i ? { ...t, ...p } : t)));
  const sorted = [...list].sort((a, b) => a.min - b.min);
  return (
    <div className="space-y-1">
      {list.map((t, i) => (
        <div key={i} className="space-y-1">
        <div className="flex items-center gap-1 text-[11.5px] text-ink-soft">
          <span className="shrink-0">≥</span>
          <input type="number" className={`${inp} w-16`} value={t.min} onChange={(e) => set(i, { min: num(e.target.value) })} />
          <input className={`${inp} flex-1`} value={t.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="档名，如：初窥门径" />
          <button type="button" className="hover:text-coral" onClick={() => commit(list.filter((_, j) => j !== i))} aria-label="删除档位"><IconClose size={14} /></button>        </div>
        {story && (
          <textarea className={`${inp} w-full`} rows={2} value={t.prompt ?? ""} onChange={(e) => set(i, { prompt: e.target.value || undefined })}
            placeholder={`升到「${t.label || "此档"}」时的剧情：写清发生了什么、谁在场、带来什么变化…（留空则由 AI 自由发挥）`} />
        )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => commit([...list, { min: list.length ? Math.min(max, Math.max(...list.map((x) => x.min)) + Math.round(max / 5)) : 0, label: "" }])}>＋ 档位</button>
        {!list.length && (
          <button type="button" className={btn} onClick={() => commit(["入门", "熟练", "精通", "大成", "登峰造极"].map((label, i) => ({ min: Math.round((max / 5) * i), label })))}>一键五档</button>
        )}
      </div>
      {sorted.length > 0 && <p className="text-[10.5px] text-ink-soft">预览：{sorted.map((t) => `${t.min}+ ${t.label || "？"}`).join(" → ")}</p>}
    </div>
  );
}

export default function ModAttrsEditor({ attrs, onAttrs, stats, onStats }: {
  attrs?: AttrDef[];
  onAttrs: (v?: AttrDef[]) => void;
  stats?: StatsSlot;
  onStats: (v?: StatsSlot) => void;
}) {
  const list = attrs ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const [statKey, setStatKey] = useState<StatKey>(RAW_STAT_ORDER[0]);
  const commit = (l: AttrDef[]) => onAttrs(l.length ? l : undefined);
  const set = (id: string, p: Partial<AttrDef>) => commit(list.map((a) => (a.id === id ? { ...a, ...p } : a)));
  const label = (k: StatKey) => stats?.labels?.[k] || RAW_STAT_LABELS[k];
  const statTiers = stats?.tiers ?? {};
  const setStats = (p: Partial<StatsSlot>) => {
    const n = { ...(stats ?? {}), ...p };
    if (n.tiers && !Object.values(n.tiers).some((t) => t?.length)) delete n.tiers;
    if (!n.display || n.display === "num") delete n.display;
    onStats(Object.keys(n).length ? n : undefined);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-ink-soft">新增的属性会出现在主角档案「角色属性」里，开新局按初值写入；剧情中 AI 会按「说明」增减。设了分档就显示档名（如 修为 320 → 筑基期）。</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => { const a: AttrDef = { id: uid(), label: "新属性", init: 0, max: 100 }; commit([...list, a]); setOpen(a.id); }}>＋ 添加属性</button>
        {/* 货币模板：无上限 + 说明里写明是货币，开局后在手机钱包卡片里绑定即可通用 */}
        <button type="button" className={btn} title="无上限、已写好货币说明；开局后到手机钱包卡片绑定" onClick={() => { const a: AttrDef = { id: uid(), label: "金币", icon: "", init: 100, desc: "这是货币。主角购买、消费、打赏、发红包时减少；赚钱、收红包、收转账时增加。" }; commit([...list, a]); setOpen(a.id); }}>＋ 添加货币</button>
      </div>
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">暂无自定义属性 · 如「修为」「灵根」「心机」「体力」</p>}

      {list.map((a, i) => {
        const isOpen = open === a.id;
        return (
          <div key={a.id} className="rounded-lg border border-line bg-paper">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="flex w-5 items-center justify-center text-center text-[15px]">{a.icon || <IconSpark size={14} />}</span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : a.id)}>
                <p className="truncate text-[12.5px] font-bold text-ink">{a.label || "未命名"}</p>
                <p className="truncate text-[10.5px] text-ink-soft">范围 {a.min ?? 0}~{a.max ?? "无上限"} · 初值 {a.init}{a.tiers?.length ? ` · ${a.tiers.length} 档` : ""}{a.pin ? " · 顶栏" : ""}{a.tierEvent ? " · 升档剧情" : ""} · {DISPLAY.find((d) => d.v === (a.display ?? "both"))?.l}</p>
              </button>
              <button type="button" disabled={!i} className="text-[11px] text-ink-soft disabled:opacity-25" onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; commit(l); }} aria-label="上移"><IconChevronUp size={12} /></button>
              <button type="button" className="text-[12px] text-ink-soft hover:text-coral" onClick={() => commit(list.filter((x) => x.id !== a.id))} aria-label="删除"><IconClose size={14} /></button>            </div>
            {isOpen && (
              <div className="space-y-2 border-t border-line px-2.5 py-2">
                <div className="flex gap-1.5">
                  <input className={`${inp} w-12 text-center`} value={a.icon ?? ""} maxLength={2} onChange={(e) => set(a.id, { icon: e.target.value || undefined })} placeholder="" aria-label="图标" />
                  <input className={`${inp} flex-1`} value={a.label} onChange={(e) => set(a.id, { label: e.target.value })} placeholder="属性名" />
                </div>
                <div className="grid grid-cols-4 gap-1.5 text-[11px] text-ink-soft">
                  <label>最小<input type="number" className={`${inp} w-full`} value={a.min ?? 0} onChange={(e) => { const m = Math.max(0, num(e.target.value)); set(a.id, { min: m || undefined, init: Math.max(m, a.init), max: a.max === undefined ? undefined : Math.max(m + 1, a.max) }); }} /></label>
                  <label>初值<input type="number" className={`${inp} w-full`} value={a.init} onChange={(e) => set(a.id, { init: num(e.target.value) })} /></label>
                  <label>最大<input type="number" className={`${inp} w-full`} value={a.max ?? ""} placeholder="无上限" onChange={(e) => set(a.id, { max: e.target.value.trim() === "" ? undefined : Math.max((a.min ?? 0) + 1, num(e.target.value)) })} /></label>
                  <label>显示
                    <select className={`${inp} w-full`} value={a.display ?? "both"} onChange={(e) => set(a.id, { display: e.target.value as AttrDef["display"] })}>
                      {DISPLAY.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-ink-soft">颜色<ColorPick value={a.color} fallback="coral" onChange={(color) => set(a.id, { color })} /></div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-soft">
                  <label className="flex items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!a.pin} onChange={(e) => set(a.id, { pin: e.target.checked || undefined })} />显示在顶部状态栏</label>
                  <label className="flex items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!a.tierEvent} disabled={!a.tiers?.length} onChange={(e) => set(a.id, { tierEvent: e.target.checked || undefined })} />升档时触发剧情{a.tiers?.length ? "" : "（需先设分档）"}</label>
                </div>
                <textarea className={`${inp} w-full`} rows={2} value={a.desc ?? ""} onChange={(e) => set(a.id, { desc: e.target.value || undefined })} placeholder="给 AI 的说明：代表什么、什么情况下增减（如：打坐/服丹 +，受伤 −）。货币写「这是货币」，最大值留空即无上限，再到手机钱包里绑定" />
                <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">分档</p>
                <TierRows list={a.tiers ?? []} max={a.max ?? Math.max(100, a.init * 5)} story={!!a.tierEvent} onChange={(tiers) => set(a.id, { tiers })} />
              </div>
            )}
          </div>
        );
      })}

      {/* 八维分档 */}
      <div className="space-y-2 rounded-lg border border-line bg-paper p-2.5">
        <p className="text-[12px] font-bold text-ink">能力分档</p>
        <div className="flex flex-wrap gap-1">
          {RAW_STAT_ORDER.map((k) => (
            <button key={k} type="button" onClick={() => setStatKey(k)}
              className={`rounded-full border px-2.5 py-0.5 text-[11.5px] transition ${statKey === k ? "border-jade bg-jade/15 font-bold text-jade-deep" : "border-line text-ink-soft"}`}>
              {label(k)}{statTiers[k]?.length ? ` ·${statTiers[k]!.length}` : ""}
            </button>
          ))}
        </div>
        <TierRows list={(statTiers[statKey] ?? []).map((t) => ({ min: t.min, label: t.label }))} max={999}
          onChange={(l) => setStats({ tiers: { ...statTiers, [statKey]: l?.map((t) => ({ ...t, desc: "" })) } })} />
        <label className="flex items-center gap-2 text-[11.5px] text-ink-soft">八维显示
          <select className={inp} value={stats?.display ?? "num"} onChange={(e) => setStats({ display: e.target.value as StatsSlot["display"] })}>
            {DISPLAY.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </label>
        <p className="text-[10.5px] text-ink-soft">叫法、初值、顺序请到「数值调校」修改。</p>
      </div>
    </div>
  );
}
