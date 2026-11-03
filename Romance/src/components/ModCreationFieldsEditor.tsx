import { IconChevronDown, IconClose } from "../lib/icons";
import { useEffect, useState } from "react";
import {
  RAW_STAT_LABELS, RAW_STAT_ORDER,
  type BuiltinFieldCfg, type BuiltinFieldKey, type CreationCopy, type CreationField, type CreationFieldType, type OptFx, type Option, type StatKey,
} from "../game/data";
import { normalizeGenderOptions, sanitizeCreationBuiltin, SYSTEM_CREATION_FIELDS } from "../game/creationSystemFields";
import type { AttrDef } from "../lib/types";
import { OPT_METRICS, fxSummary } from "../game/optFx";
import { AttrDefForm } from "./ModAttrsEditor";
import {
  CREATION_ITEM_ADD_TYPES,
  creationAttrKindLabel,
  newCurrencyAttr,
  newNumberAttr,
  type CreationItemAddType,
} from "../lib/creationItems";

/* 模组编辑器 · 建角字段（统一列表）：
 * 系统四项（姓名/性别/年龄/生日）→ 开局资金（货币）→ 自定义数值/货币/文本/单选/日期。
 * 对创作者不再拆「属性」「字段」「开局资金」三块；单一「＋ 添加」选类型。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const TYPE_LABEL: Record<CreationFieldType | "date" | "currency", string> = {
  text: "文本", textarea: "长文本", select: "下拉", number: "数值", radio: "单选", date: "日期", currency: "货币",
};

const BUILTINS = SYSTEM_CREATION_FIELDS.map((field) => ({ ...field, k: field.key as BuiltinFieldKey }));
const fieldUid = () => `f_${Math.random().toString(36).slice(2, 7)}`;
const attrUid = () => `attr_${Math.random().toString(36).slice(2, 7)}`;

function Chips({ all, value, onChange }: { all: { id: string; name: string }[]; value?: string[]; onChange: (v?: string[]) => void }) {
  const v = value ?? [];
  return (
    <div className="flex flex-wrap gap-1">
      {all.map((o) => {
        const on = v.includes(o.id);
        return (
          <button key={o.id} type="button" onClick={() => { const n = on ? v.filter((x) => x !== o.id) : [...v, o.id]; onChange(n.length ? n : undefined); }}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] transition ${on ? "border-jade bg-jade/10 text-jade" : "border-line text-ink-soft hover:border-jade/60"}`}>{o.name || o.id}</button>
        );
      })}
      {!v.length && <span className="text-[10.5px] text-ink-soft">（不限）</span>}
    </div>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 text-[11.5px] text-ink">
      <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${on ? "bg-jade" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-[14px]" : "left-0.5"}`} />
      </span>
      {children}
    </button>
  );
}

/* 下拉选项 → 开局效果：能力 / 资金等指标 / 自定义属性 / NPC 好感 的增减 + 写进档案的设定 + 改开局日期 */
type FxKind = "stats" | "metrics" | "attrs" | "rel";
const FX_KIND: { k: FxKind; l: string }[] = [{ k: "stats", l: "能力" }, { k: "metrics", l: "资金 / 名气…" }, { k: "attrs", l: "自定义属性" }, { k: "rel", l: "NPC 好感" }];
export function OptFxEditor({ value, onChange, attrs, npcs, statLabels }: {
  value?: OptFx; onChange: (v?: OptFx) => void; attrs: AttrDef[]; npcs: { id: string; name: string }[]; statLabels: Record<string, string>;
}) {
  const fx = value ?? {};
  const targets = (k: FxKind): { id: string; name: string }[] =>
    k === "stats" ? RAW_STAT_ORDER.map((s) => ({ id: s, name: statLabels[s] ?? RAW_STAT_LABELS[s] }))
    : k === "metrics" ? OPT_METRICS.map((m) => ({ id: m.k, name: m.l }))
    : k === "attrs" ? attrs.map((a) => ({ id: a.id, name: a.label }))
    : npcs;
  const rows = FX_KIND.flatMap(({ k }) => Object.entries((fx[k] ?? {}) as Record<string, number>).map(([id, v]) => ({ k, id, v })));
  const commit = (next: OptFx) => {
    const out: OptFx = {};
    for (const { k } of FX_KIND) { const m = Object.fromEntries(Object.entries((next[k] ?? {}) as Record<string, number>).filter(([id]) => id)); if (Object.keys(m).length) (out as Record<string, unknown>)[k] = m; }
    if (typeof next.note === "string" && next.note.trim()) out.note = next.note;
    if (typeof next.startDate === "string" && next.startDate.trim()) out.startDate = next.startDate;
    onChange(Object.keys(out).length ? out : undefined);
  };
  const setRow = (k: FxKind, id: string, p: { k?: FxKind; id?: string; v?: number }) => {
    const next: OptFx = { ...fx };
    const from = { ...((next[k] ?? {}) as Record<string, number>) };
    const v = p.v ?? from[id] ?? 0;
    delete from[id];
    (next as Record<string, unknown>)[k] = from;
    const nk = p.k ?? k;
    const to = { ...((next[nk] ?? {}) as Record<string, number>) };
    const nid = p.id ?? (p.k && p.k !== k ? targets(nk)[0]?.id ?? "" : id);
    if (nid) to[nid] = v;
    (next as Record<string, unknown>)[nk] = to;
    commit(next);
  };
  const addRow = () => {
    const t = RAW_STAT_ORDER.find((s) => !(fx.stats ?? {})[s]);
    commit({ ...fx, stats: { ...(fx.stats ?? {}), [t ?? RAW_STAT_ORDER[0]]: 5 } });
  };
  const delRow = (k: FxKind, id: string) => { const m = { ...((fx[k] ?? {}) as Record<string, number>) }; delete m[id]; commit({ ...fx, [k]: m }); };
  const dateBad = !!fx.startDate && !/^\d{4}[-./]\d{2}[-./]\d{2}$/.test(fx.startDate);
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={`${r.k}:${r.id}`} className="flex items-center gap-1">
          <select className={`${inp} !w-28 shrink-0`} value={r.k} onChange={(e) => setRow(r.k, r.id, { k: e.target.value as FxKind })} aria-label="效果类型">
            {FX_KIND.map((x) => <option key={x.k} value={x.k} disabled={x.k === "attrs" && !attrs.length}>{x.l}</option>)}
          </select>
          <select className={inp} value={r.id} onChange={(e) => setRow(r.k, r.id, { id: e.target.value })} aria-label="作用对象">
            {targets(r.k).map((t) => <option key={t.id} value={t.id}>{t.name || t.id}</option>)}
          </select>
          <input type="number" className={`${inp} !w-20 shrink-0 text-center`} value={r.v} onChange={(e) => setRow(r.k, r.id, { v: Number(e.target.value) || 0 })} aria-label="增减" />
          <button type="button" className="shrink-0 px-1 text-ink-soft hover:text-coral" onClick={() => delRow(r.k, r.id)} aria-label="删除效果"><IconClose size={14} /></button>        </div>
      ))}
      <button type="button" className={btn} onClick={addRow}>＋ 数值效果</button>
      <div className="grid grid-cols-[1fr_7.5rem] gap-1.5">
        <label><span className="mb-0.5 block text-[10.5px] text-ink-soft">写进角色档案的设定（AI 可读）</span>
          <input className={inp} value={fx.note ?? ""} placeholder="如：自幼随外婆在南方小城长大" onChange={(e) => commit({ ...fx, note: e.target.value })} />
        </label>
        <label><span className="mb-0.5 block text-[10.5px] text-ink-soft">改开局日期</span>
          <input className={`${inp} font-mono ${dateBad ? "!border-danger" : ""}`} value={fx.startDate ?? ""} placeholder="2008.03.01" onChange={(e) => commit({ ...fx, startDate: e.target.value })} />
        </label>
      </div>
      {dateBad && <p className="text-[10.5px] text-danger">开局日期须形如 2008.03.01</p>}
    </div>
  );
}

export default function ModCreationFieldsEditor({ creation, backgrounds, onChange, attrs = [], npcs = [], statLabels = {}, startMoney, moneyLabel, focusAuthorField, onAttrs, onStartMoney, onMoneyLabel }: {
  creation?: CreationCopy; backgrounds?: Option[];
  onChange: (p: { creation: CreationCopy }) => void;
  attrs?: AttrDef[]; npcs?: { id: string; name: string }[]; statLabels?: Partial<Record<StatKey, string>>;
  /** 功能注释：开局资金并入建角字段列表的货币项，不再单独大栏 */
  startMoney?: number;
  /** 功能注释：货币显示名（元 / 灵石…），与金额一并必填 */
  moneyLabel?: string;
  /** 功能注释：预览补全弹窗定位时传入 author-field-*，展开并高亮对应行 */
  focusAuthorField?: string | null;
  onAttrs?: (v?: AttrDef[]) => void;
  onStartMoney?: (v: number | undefined) => void;
  onMoneyLabel?: (v: string | undefined) => void;
}) {
  const cc = creation ?? {};
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [flashMoney, setFlashMoney] = useState(false);
  // 功能注释：补全弹窗点「开局资金」→ 展开该行并短暂高亮，方便直接改金额/货币名
  useEffect(() => {
    if (focusAuthorField !== "author-field-start-money") return;
    setOpen("startMoney");
    setFlashMoney(true);
    const t = window.setTimeout(() => setFlashMoney(false), 2600);
    return () => window.clearTimeout(t);
  }, [focusAuthorField]);
  const paths = (cc.paths ?? []).map((p) => ({ id: p.id, name: p.name }));
  const bgs = (backgrounds ?? []).map((b) => ({ id: b.id, name: b.name }));
  // 功能注释：每次写入都清洗 builtin，旧稿残留的系统外键当场丢掉
  const commit = (patch: Partial<CreationCopy>) => {
    const merged = { ...cc, ...patch };
    merged.builtin = sanitizeCreationBuiltin(merged.builtin);
    onChange({ creation: merged });
  };
  const cfg = (k: BuiltinFieldKey): BuiltinFieldCfg => cc.builtin?.[k] ?? {};
  const setCfg = (k: BuiltinFieldKey, p: Partial<BuiltinFieldCfg>) => {
    const n = { ...cfg(k), ...p };
    (Object.keys(n) as (keyof BuiltinFieldCfg)[]).forEach((x) => { if (n[x] === undefined || n[x] === "" || n[x] === false) delete n[x]; });
    const b = { ...cc.builtin, [k]: n };
    if (!Object.keys(n).length) delete b[k];
    commit({ builtin: b });
  };
  const fields = cc.fields ?? [];
  const setFields = (l: CreationField[]) => commit({ fields: l.length ? l : undefined });
  const setField = (id: string, p: Partial<CreationField>) => setFields(fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const attrList = attrs ?? [];
  const setAttrs = (l: AttrDef[]) => onAttrs?.(l.length ? l : undefined);
  const setAttr = (id: string, p: Partial<AttrDef>) => setAttrs(attrList.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const row = (key: string, id: string, title: string, type: string, badges: React.ReactNode, children: React.ReactNode, extra?: React.ReactNode, opts?: { authorField?: string; flash?: boolean }) => {
    const isOpen = open === id;
    return (
      <div
        key={key}
        data-author-field={opts?.authorField}
        tabIndex={opts?.authorField ? -1 : undefined}
        className={`rounded-xl border bg-paper transition ${opts?.flash ? "border-coral ring-2 ring-coral/45 shadow-[0_0_0_3px_color-mix(in_srgb,var(--coral)_18%,transparent)]" : "border-line"}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <span className="text-[13px] font-semibold text-ink">{title}</span>
            <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10.5px] text-ink-soft">{type}</span>
            {badges}
            <span className={`ml-auto text-ink-soft transition ${isOpen ? "rotate-180" : ""}`}><IconChevronDown size={12} /></span>
          </button>
          {extra}
        </div>
        {isOpen && <div className="space-y-2.5 border-t border-line px-3 py-3">{children}</div>}
      </div>
    );
  };
  const Badge = ({ tone, children }: { tone: "gold" | "soft" | "jade"; children: string }) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tone === "gold" ? "bg-gold/15 text-gold" : tone === "jade" ? "bg-jade/10 text-jade" : "bg-line/50 text-ink-soft"}`}>{children}</span>
  );
  const lbl = "mb-0.5 block text-[11px] text-ink-soft";

  /** 功能注释：同一「＋ 添加」按类型写入 fields 或 customAttrs，不再分「添加属性 / 添加字段」 */
  const addItem = (kind: CreationItemAddType) => {
    setPicking(false);
    if (kind === "number") {
      const a = newNumberAttr(attrUid());
      setAttrs([...attrList, a]);
      setOpen(a.id);
      return;
    }
    if (kind === "currency") {
      const a = newCurrencyAttr(attrUid());
      setAttrs([...attrList, a]);
      setOpen(a.id);
      return;
    }
    const type: CreationFieldType = kind === "radio" ? "radio" : kind === "date" ? "date" : "text";
    const f: CreationField = { id: fieldUid(), label: "", type, required: false };
    setFields([...fields, f]);
    setOpen(f.id);
  };

  return (
    <div className="space-y-2">
      <div className="mb-1">
        <p className="text-[12px] font-bold text-ink">建角字段</p>
        <p className="text-[11px] leading-relaxed text-ink-soft">
          建角要填的项都在这里。姓名、性别、年龄、生日是系统固定项（不能改类型、不能删），排在最前；开局资金是货币项。其余用下方「添加」选类型：文本、单选、数值、日期、货币。数值可配范围、开局值、分档（多少分叫什么）、是否隐藏、是否上状态栏。
        </p>
      </div>

      {BUILTINS.map((b) => {
        const c = cfg(b.k);
        return (
          row(b.k, b.k, c.label || b.label, TYPE_LABEL[b.type],
            <><Badge tone="jade">系统字段</Badge><Badge tone="gold">必填</Badge></>, <>
            <label><span className={lbl}>显示名称</span><input className={inp} value={c.label ?? ""} placeholder={b.label} onChange={(e) => setCfg(b.k, { label: e.target.value })} /></label>
            <p className="text-[10.5px] text-ink-soft">类型固定为「{TYPE_LABEL[b.type]}」，始终必填、不可隐藏或删除。</p>
            {b.k === "gender" && (() => {
              const genderOptions = normalizeGenderOptions(c.options);
              return <div className="space-y-1.5">
                <span className={lbl}>性别选项（男 / 女不可删除）</span>
                {genderOptions.map((option, index) => <div key={`${option}-${index}`} className="flex items-center gap-1.5">
                  <input className={inp} value={option} disabled={option === "男" || option === "女"}
                    onChange={(e) => setCfg("gender", { options: normalizeGenderOptions(genderOptions.map((item, i) => i === index ? e.target.value : item)) })} />
                  {option !== "男" && option !== "女" && <button type="button" className={btn} onClick={() => setCfg("gender", { options: genderOptions.filter((_, i) => i !== index) })}>删除</button>}
                </div>)}
                <button type="button" className={btn} onClick={() => setCfg("gender", { options: [...genderOptions, `自定义性别 ${genderOptions.length - 1}`] })}>＋ 添加性别</button>
              </div>;
            })()}
          </>)
        );
      })}

      {/* 功能注释：开局资金必填；行上类型位展示可改的货币名称（元/灵石），不再写死「货币」 */}
      {row("startMoney", "startMoney", "开局资金", (moneyLabel?.trim() || "货币名称"),
        <Badge tone="gold">必填</Badge>,
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>
              <span className={lbl}>货币名称 *</span>
              <input
                data-author-field-input="author-field-start-money-name"
                className={`${inp} ${!(moneyLabel?.trim()) ? "!border-danger" : ""}`}
                value={moneyLabel ?? ""}
                placeholder="如：元 / 灵石 / 星币"
                onChange={(e) => onMoneyLabel?.(e.target.value.trim() ? e.target.value : undefined)}
              />
            </label>
            <label>
              <span className={lbl}>开局金额 *</span>
              <input
                data-author-field-input="author-field-start-money-amount"
                type="number"
                min={0}
                className={`${inp} ${typeof startMoney !== "number" ? "!border-danger" : ""}`}
                value={typeof startMoney === "number" ? startMoney : ""}
                placeholder="0"
                onChange={(e) => {
                  const v = e.target.value;
                  onStartMoney?.(v === "" ? undefined : Math.max(0, Number(v) || 0));
                }}
              />
            </label>
          </div>
          <p className="text-[10.5px] text-ink-soft">默认金额 0（合法）；货币名称会用在开局页与游戏内资金文案。两项都填才算完成。</p>
        </>,
        undefined,
        { authorField: "author-field-start-money", flash: flashMoney })}

      {attrList.map((a, i) => (
        row(a.id, a.id, a.label || "未命名", creationAttrKindLabel(a),
          <>{a.pin && <Badge tone="jade">状态栏</Badge>}{a.hidden && <Badge tone="soft">隐藏</Badge>}{(a.tiers?.length ?? 0) > 0 && <Badge tone="soft">{`${a.tiers!.length} 档`}</Badge>}</>,
          <AttrDefForm a={a} onChange={(p) => setAttr(a.id, p)} />,
          <>
            <button type="button" disabled={!i} className={`${btn} !px-1.5`} onClick={() => { const l = [...attrList]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setAttrs(l); }} aria-label="上移">↑</button>
            <button type="button" className="px-1 text-ink-soft hover:text-coral" onClick={() => setAttrs(attrList.filter((x) => x.id !== a.id))} aria-label="删除"><IconClose size={14} /></button>
          </>)
      ))}

      {fields.map((f, fieldIndex) => (
        row(f.id, f.id, f.label || "未命名字段", TYPE_LABEL[f.type] ?? f.type,
          <>{f.required && <Badge tone="gold">必填</Badge>}{(f.paths || f.bgs) && <Badge tone="jade">条件出现</Badge>}</>, <>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={lbl}>字段名</span><input className={inp} value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} placeholder="如：座右铭" /></label>
            <label><span className={lbl}>类型</span>
              <select className={inp} value={f.type} onChange={(e) => setField(f.id, { type: e.target.value as CreationFieldType })}>
                {(["text", "radio", "date"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                {f.type === "textarea" && <option value="textarea">{TYPE_LABEL.textarea}（旧字段）</option>}
                {f.type === "select" && <option value="select">{TYPE_LABEL.select}（旧字段）</option>}
                {f.type === "number" && <option value="number">{TYPE_LABEL.number}（旧字段）</option>}
              </select>
            </label>
            <label><span className={lbl}>默认值</span><input className={inp} value={f.init ?? ""} onChange={(e) => setField(f.id, { init: e.target.value || undefined })} /></label>
            {f.type === "number" ? (
              <div className="grid grid-cols-2 gap-1">
                <label><span className={lbl}>最小</span><input type="number" className={inp} value={f.min ?? ""} onChange={(e) => setField(f.id, { min: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                <label><span className={lbl}>最大</span><input type="number" className={inp} value={f.max ?? ""} onChange={(e) => setField(f.id, { max: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
              </div>
            ) : (
              <label><span className={lbl}>占位提示</span><input className={inp} value={f.placeholder ?? ""} onChange={(e) => setField(f.id, { placeholder: e.target.value || undefined })} /></label>
            )}
          </div>
          {(f.type === "select" || f.type === "radio") && (
            <label><span className={lbl}>选项（一行一个）</span>
              <textarea className={inp} rows={3} value={(f.options ?? []).join("\n")} onChange={(e) => setField(f.id, { options: e.target.value.split("\n") })} />
            </label>
          )}
          {(f.type === "select" || f.type === "radio") && (f.options ?? []).some((o) => String(o ?? "").trim()) && (
            <div className="space-y-1 rounded-lg border border-line/70 bg-paper-2/50 p-2">
              <span className={lbl}>选项条件与开局效果（可不填）</span>
              {[...new Set((f.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean))].map((o) => {
                const s = fxSummary(f.optFx?.[o], { attr: (id) => attrs.find((a) => a.id === id)?.label, npc: (id) => npcs.find((n) => n.id === id)?.name });
                const link = f.optionLinks?.[o];
                return (
                  <details key={o} className="rounded-md border border-line/60 bg-paper px-2 py-1">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px]">
                      <b className="shrink-0 text-ink">{o}</b>
                      <span className={`min-w-0 flex-1 truncate text-[10.5px] ${s.length ? "text-jade" : "text-ink-soft"}`}>{s.length ? s.join(" · ") : "无效果"}</span>
                      <span className="text-[11px] text-ink-soft">›</span>
                    </summary>
                    <div className="mt-1.5 space-y-2">
                      {paths.length > 0 && <div><span className={lbl}>仅在这些人物线路出现</span><Chips all={paths} value={link?.paths} onChange={(v) => setField(f.id, { optionLinks: { ...(f.optionLinks ?? {}), [o]: { ...(link ?? {}), paths: v } } })} /></div>}
                      {bgs.length > 0 && <div><span className={lbl}>仅在这些家庭背景出现</span><Chips all={bgs} value={link?.bgs} onChange={(v) => setField(f.id, { optionLinks: { ...(f.optionLinks ?? {}), [o]: { ...(link ?? {}), bgs: v } } })} /></div>}
                      <OptFxEditor value={f.optFx?.[o]} attrs={attrs} npcs={npcs} statLabels={{ ...RAW_STAT_LABELS, ...statLabels }}
                        onChange={(v) => { const m = { ...(f.optFx ?? {}) }; if (v) m[o] = v; else delete m[o]; setField(f.id, { optFx: Object.keys(m).length ? m : undefined }); }} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          <label><span className={lbl}>给 AI 的说明（可选）</span><input className={inp} value={f.desc ?? ""} placeholder="这个字段代表什么、剧情里怎么体现" onChange={(e) => setField(f.id, { desc: e.target.value || undefined })} /></label>
          <Toggle on={!!f.required} onClick={() => setField(f.id, { required: !f.required || undefined })}>玩家必填</Toggle>
          {paths.length > 0 && <div><span className={lbl}>仅在这些人物线路出现</span><Chips all={paths} value={f.paths} onChange={(v) => setField(f.id, { paths: v })} /></div>}
          {bgs.length > 0 && <div><span className={lbl}>仅在这些家庭背景出现</span><Chips all={bgs} value={f.bgs} onChange={(v) => setField(f.id, { bgs: v })} /></div>}
          <div className="flex gap-1.5">
            <button type="button" className={btn} disabled={fieldIndex === 0} onClick={() => {
              const next = [...fields]; [next[fieldIndex - 1], next[fieldIndex]] = [next[fieldIndex], next[fieldIndex - 1]]; setFields(next);
            }}>上移</button>
            <button type="button" className={btn} disabled={fieldIndex === fields.length - 1} onClick={() => {
              const next = [...fields]; [next[fieldIndex], next[fieldIndex + 1]] = [next[fieldIndex + 1], next[fieldIndex]]; setFields(next);
            }}>下移</button>
          </div>
          <button type="button" className={`${btn} hover:!border-coral hover:!text-coral`} onClick={() => setFields(fields.filter((x) => x.id !== f.id))}>删除此字段</button>
        </>,
          <button type="button" className="px-1 text-ink-soft hover:text-coral" onClick={() => setFields(fields.filter((x) => x.id !== f.id))} aria-label="删除"><IconClose size={14} /></button>)
      ))}

      {picking ? (
        <div className="rounded-xl border border-jade/40 bg-jade/5 p-3">
          <p className="mb-2 text-[12px] font-semibold text-ink">选择类型</p>
          <div className="flex flex-wrap gap-1.5">
            {CREATION_ITEM_ADD_TYPES.map((t) => (
              <button key={t.id} type="button" className={btn} onClick={() => addItem(t.id)}>{t.label}</button>
            ))}
            <button type="button" className={`${btn} text-ink-soft`} onClick={() => setPicking(false)}>取消</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setPicking(true)}
          className="w-full rounded-xl border border-dashed border-line py-3 text-[13px] text-ink-soft transition hover:border-jade hover:text-jade">＋ 添加</button>
      )}
    </div>
  );
}
