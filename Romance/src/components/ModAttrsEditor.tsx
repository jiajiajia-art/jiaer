import { IconChevronUp, IconClose, IconSpark } from "../lib/icons";
import { useState } from "react";
import type { AttrDef, AttrTier } from "../lib/types";
import { attrChoiceOptions, attrDiceProblem, attrStartMode, attrUsesRandomStart } from "../lib/attrInit";
import { ColorPick } from "./EditorKit";
import { CURRENCY_ATTR_DESC, newCurrencyAttr, newNumberAttr } from "../lib/creationItems";

/* 模组编辑器 · 数值/货币项详情（建角字段统一列表复用）。
 * 开局取值：勾选「固定数值」用 init；不勾则在最小～最大之间随机。列表壳已并入 ModCreationFieldsEditor。 */
const inp = "min-w-0 rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const DISPLAY = [
  { v: "both", l: "数值 + 档位" },
  { v: "tier", l: "只显示档位" },
  { v: "num", l: "只显示数值" },
] as const;
const START_MODES = [
  { v: "random", l: "开局随机", d: "开局在最小～最大之间由代码随机，不交给生成文本的模型；玩家可在建角页单独重掷或整组重掷。" },
  { v: "locked", l: "作者锁定", d: "固定为你填的开局值，玩家在建角页只能看、不能改。" },
  { v: "choice", l: "玩家选择", d: "你列出几个选项（每项对应一个开局值），玩家在建角页选一个；选项名会写进主角档案。" },
  { v: "custom", l: "玩家自定义", d: "玩家在建角页自己填一个数（限制在最小～最大之间）。" },
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

/**
 * 功能注释：单条数值/货币的展开表单——范围、开局值、是否隐藏、是否上状态栏，以及分档等进阶项。
 * 由统一「建角字段」列表展开调用，不再单独出现「添加属性」入口。
 */
export function AttrDefForm({ a, onChange }: { a: AttrDef; onChange: (p: Partial<AttrDef>) => void }) {
  const set = (p: Partial<AttrDef>) => onChange(p);
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <input className={`${inp} w-12 text-center`} value={a.icon ?? ""} maxLength={2} onChange={(e) => set({ icon: e.target.value || undefined })} placeholder="" aria-label="图标" />
        <input className={`${inp} flex-1`} value={a.label} onChange={(e) => set({ label: e.target.value })} placeholder="名称" />
      </div>
      <div className="grid grid-cols-3 gap-1.5 text-[11px] text-ink-soft">
        <label>最小<input type="number" className={`${inp} w-full`} value={a.min ?? 0} onChange={(e) => { const m = Math.max(0, num(e.target.value)); set({ min: m || undefined, init: attrUsesRandomStart(a) ? a.init : Math.max(m, a.init), max: a.max === undefined ? undefined : Math.max(m + 1, a.max) }); }} /></label>
        <label>最大<input type="number" className={`${inp} w-full`} value={a.max ?? ""} placeholder="无上限" onChange={(e) => set({ max: e.target.value.trim() === "" ? undefined : Math.max((a.min ?? 0) + 1, num(e.target.value)) })} /></label>
        <label>显示
          <select className={`${inp} w-full`} value={a.display ?? "both"} onChange={(e) => set({ display: e.target.value as AttrDef["display"] })}>
            {DISPLAY.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          </select>
        </label>
      </div>
      {/* 功能注释：开局取值四种：随机（玩家可重掷）/ 作者锁定 / 玩家从选项里选 / 玩家自填 */}
      <div className="space-y-1.5 rounded-lg border border-line/70 bg-paper-2/40 px-2 py-1.5" data-attr-start-mode>
        <p className="text-[11px] font-semibold text-ink">开局取值</p>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {START_MODES.map((m) => {
            const on = attrStartMode(a) === m.v || (m.v === "choice" && a.initMode === "choice");
            return (
              <button key={m.v} type="button" title={m.d}
                className={`rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition ${on ? "border-jade bg-jade/10 text-jade" : "border-line bg-paper text-ink-soft hover:border-jade/50"}`}
                onClick={() => {
                  const lo = a.min ?? 0;
                  const hi = typeof a.max === "number" && a.max > lo ? a.max : Math.max(lo + 1, 100);
                  if (m.v === "locked") set({ initMode: undefined, dice: undefined });
                  else if (m.v === "random") set({ initMode: "random", max: hi, dice: undefined });
                  else if (m.v === "custom") set({ initMode: "custom", dice: undefined });
                  else set({ initMode: "choice", dice: undefined, options: a.options?.length ? a.options : [{ label: "", value: a.init }] });
                }}>
                {m.l}
              </button>
            );
          })}
        </div>
        <p className="text-[10.5px] leading-snug text-ink-soft">{START_MODES.find((m) => m.v === (a.initMode === "choice" ? "choice" : attrStartMode(a)))?.d}</p>
        {(a.initMode === undefined || a.initMode === "fixed" || a.initMode === "custom") && (
          <label className="block text-[11px] text-ink-soft">{a.initMode === "custom" ? "默认值（玩家可改）" : "锁定的开局值"}
            <input type="number" className={`${inp} mt-0.5 w-full`} value={a.init} onChange={(e) => set({ init: num(e.target.value) })} />
          </label>
        )}
        {attrUsesRandomStart(a) && attrDiceProblem(a) && <p className="text-[10.5px] text-danger">{attrDiceProblem(a)}</p>}
        {a.initMode === "choice" && (
          <div className="space-y-1">
            {(a.options ?? []).map((o, i) => (
              <div key={i} className="flex items-center gap-1">
                <input className={`${inp} flex-1`} value={o.label} placeholder="选项名，如：书香门第" onChange={(e) => set({ options: (a.options ?? []).map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                <input type="number" className={`${inp} w-20`} value={o.value} aria-label="开局值" onChange={(e) => set({ options: (a.options ?? []).map((x, j) => (j === i ? { ...x, value: num(e.target.value) } : x)) })} />
                <button type="button" className="text-ink-soft hover:text-coral" aria-label="删除选项" onClick={() => set({ options: (a.options ?? []).filter((_, j) => j !== i) })}><IconClose size={14} /></button>
              </div>
            ))}
            <button type="button" className={btn} onClick={() => set({ options: [...(a.options ?? []), { label: "", value: a.init }] })}>＋ 选项</button>
            {!attrChoiceOptions(a).length && <p className="text-[10.5px] text-danger">至少填一个有名字的选项，否则按锁定值开局。</p>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-ink-soft">颜色<ColorPick value={a.color} fallback="coral" onChange={(color) => set({ color })} /></div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-soft">
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!a.hidden} onChange={(e) => set({ hidden: e.target.checked || undefined })} />建角页隐藏</label>
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!a.pin} onChange={(e) => set({ pin: e.target.checked || undefined })} />显示在顶部状态栏</label>
        <label className="flex items-center gap-1"><input type="checkbox" className="accent-jade" checked={!!a.tierEvent} disabled={!a.tiers?.length} onChange={(e) => set({ tierEvent: e.target.checked || undefined })} />升档时触发剧情{a.tiers?.length ? "" : "（需先设分档）"}</label>
      </div>
      {/* 功能注释：属性说明须有标题；AI 按属性名预填，创作者可改 */}
      <label className="block">
        <span className="mb-0.5 block text-[11px] font-semibold text-ink">属性说明</span>
        <textarea className={`${inp} w-full`} rows={2} value={a.desc ?? ""} onChange={(e) => set({ desc: e.target.value || undefined })} placeholder="这个属性代表什么、剧情里何时增减（如：打坐/服丹 +，受伤 −）。货币可写「这是货币」" />
      </label>
      {/* 功能注释：分档挂在数值属性上（多少分叫什么），取代养成页固定的指标分档块 */}
      <p className="text-[10.5px] font-bold tracking-[0.12em] text-ink-soft">分档</p>
      <p className="text-[10.5px] leading-snug text-ink-soft">按数值下限起名（如 0 入门、100 小成）。任意数值属性都能配，不绑死某一指标名。</p>
      <TierRows list={a.tiers ?? []} max={a.max ?? Math.max(100, a.init * 5)} story={!!a.tierEvent} onChange={(tiers) => set({ tiers })} />
    </div>
  );
}

/** @deprecated 列表已并入建角字段；保留供旧引用与契约字符串回归 */
export default function ModAttrsEditor({ attrs, onAttrs }: {
  attrs?: AttrDef[];
  onAttrs: (v?: AttrDef[]) => void;
}) {
  const list = attrs ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const commit = (l: AttrDef[]) => onAttrs(l.length ? l : undefined);
  const set = (id: string, p: Partial<AttrDef>) => commit(list.map((a) => (a.id === id ? { ...a, ...p } : a)));

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-ink-soft">这里只放你自己加的属性；开局页与主角档案会按此列表顺序显示。开局可勾选固定数值，或不勾在范围内随机；剧情里 AI 按「属性说明」增减。设了分档就显示档名（如 修为 320 → 筑基期）。</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={() => { const a = newNumberAttr(uid()); commit([...list, a]); setOpen(a.id); }}>＋ 添加属性</button>
        <button type="button" className={btn} title="无上限、已写好货币说明；开局后到手机钱包卡片绑定" onClick={() => { const a = newCurrencyAttr(uid()); commit([...list, a]); setOpen(a.id); }}>＋ 添加货币</button>
      </div>
      {!list.length && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-ink-soft">还没有属性</p>}

      {list.map((a, i) => {
        const isOpen = open === a.id;
        return (
          <div key={a.id} className="rounded-lg border border-line bg-paper">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="flex w-5 items-center justify-center text-center text-[15px]">{a.icon || <IconSpark size={14} />}</span>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : a.id)}>
                <p className="truncate text-[12.5px] font-bold text-ink">{a.label || "未命名"}</p>
                <p className="truncate text-[10.5px] text-ink-soft">范围 {a.min ?? 0}~{a.max ?? "无上限"} · {({ random: "开局随机", locked: `锁定 ${a.init}`, choice: `玩家选择 ${attrChoiceOptions(a).length} 项`, custom: "玩家自定义" } as const)[attrStartMode(a)]}{a.tiers?.length ? ` · ${a.tiers.length} 档` : ""}{a.pin ? " · 顶栏" : ""}{a.hidden ? " · 隐藏" : ""}{a.tierEvent ? " · 升档剧情" : ""} · {DISPLAY.find((d) => d.v === (a.display ?? "both"))?.l}</p>
              </button>
              <button type="button" disabled={!i} className="text-[11px] text-ink-soft disabled:opacity-25" onClick={() => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; commit(l); }} aria-label="上移"><IconChevronUp size={12} /></button>
              <button type="button" className="text-[12px] text-ink-soft hover:text-coral" onClick={() => commit(list.filter((x) => x.id !== a.id))} aria-label="删除"><IconClose size={14} /></button>            </div>
            {isOpen && (
              <div className="border-t border-line px-2.5 py-2">
                <AttrDefForm a={a} onChange={(p) => set(a.id, p)} />
              </div>
            )}
          </div>
        );
      })}
      {/* 功能注释：货币模板文案锚点，供钱包说明与回归检索 CURRENCY_ATTR_DESC */}
      <span className="sr-only">{CURRENCY_ATTR_DESC}</span>
    </div>
  );
}
