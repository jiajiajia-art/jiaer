import { IconChevronDown, IconClose, IconLock } from "../lib/icons";
import { useState } from "react";
import {
  RAW_BACKGROUNDS, RAW_CREATION, RAW_PARENT_JOBS, RAW_STAT_LABELS, RAW_STAT_ORDER,
  type BuiltinFieldCfg, type BuiltinFieldKey, type CreationCopy, type CreationField, type CreationFieldType, type CreationOptCat, type OptFx, type Option, type StatKey,
} from "../game/data";
import type { AttrDef } from "../lib/types";
import { OPT_METRICS, fxSummary } from "../game/optFx";

/* 模组编辑器 · 建角字段：内置字段（改名 / 隐藏 / 锁定固定值 / 选项与联动）+ 创作者自定义字段。
 * 选项联动：每个选项可限定「仅在某些人物线路 / 家庭背景下出现」，建角页自动过滤。 */
const inp = "min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1 text-[12.5px] text-ink outline-none focus:border-jade";
const btn = "rounded-full border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink transition hover:border-jade hover:text-jade disabled:opacity-40";
const TYPE_LABEL: Record<CreationFieldType | "radio", string> = { text: "文本", textarea: "长文本", select: "下拉", number: "数值", radio: "单选" };

type Builtin = { k: BuiltinFieldKey; label: string; type: CreationFieldType | "radio"; cat?: CreationOptCat; note?: string; pool?: boolean }; // pool：选项池字段，只能改名 / 隐藏
const BUILTINS: Builtin[] = [
  { k: "name", label: "姓名", type: "text" },
  { k: "gender", label: "性别", type: "radio", note: "固定值填：女 / 男 / 其他" },
  { k: "identity", label: "出道身份", type: "select", cat: "identityOpts" },
  { k: "description", label: "人物描述 / 气质设定", type: "textarea" },
  { k: "klass", label: "出身阶层", type: "select", cat: "klassOpts" },
  { k: "background", label: "家世叙述", type: "select", cat: "backgroundOpts" },
  { k: "fatherJob", label: "父亲职业", type: "select", cat: "parentJobs", note: "与母亲职业共用选项池" },
  { k: "motherJob", label: "母亲职业", type: "select", cat: "parentJobs", note: "与父亲职业共用选项池" },
  { k: "extra", label: "玩家自填字段", type: "text", note: "建角页底部「自定义字段名 / 内容」" },
  { k: "style", label: "外形风格", type: "select", pool: true, note: "选项与开局加成在「建角选项池」里编辑" },
  { k: "family", label: "家庭背景", type: "select", pool: true, note: "选项与开局加成在「建角选项池」里编辑" },
  { k: "direction", label: "职业方向", type: "select", pool: true, note: "选项与开局加成在「建角选项池」里编辑" },
  { k: "zodiac", label: "星座", type: "select", pool: true, note: "由生日推算；隐藏 = 关闭星座，也不结算星座加成。性格与加成在「建角选项池」里编辑" },
];
const uid = () => `f_${Math.random().toString(36).slice(2, 7)}`;

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

/* 把旧版 pathOpts / bgLinks 换算成逐选项联动 */
function toOptLinks(cc: CreationCopy, jobs: string[]): NonNullable<CreationCopy["optLinks"]> {
  const out: NonNullable<CreationCopy["optLinks"]> = {};
  const cats: CreationOptCat[] = ["identityOpts", "backgroundOpts", "klassOpts", "parentJobs"];
  for (const cat of cats) {
    const pool = cat === "parentJobs" ? jobs : cc[cat] ?? [];
    const m: Record<string, { paths?: string[]; bgs?: string[] }> = {};
    for (const o of pool) {
      const pEntries = Object.entries(cc.pathOpts ?? {}).filter(([, v]) => v[cat]?.length);
      const bEntries = Object.entries(cc.bgLinks ?? {}).filter(([, v]) => v[cat as keyof typeof v]?.length);
      const paths = pEntries.length ? [...pEntries.filter(([, v]) => v[cat]!.includes(o)).map(([k]) => k), ...(cc.paths ?? []).map((p) => p.id).filter((id) => !cc.pathOpts?.[id]?.[cat]?.length)] : [];
      const bgs = bEntries.length ? [...bEntries.filter(([, v]) => (v[cat as keyof typeof v] as string[]).includes(o)).map(([k]) => k), ...RAW_BACKGROUNDS.map((b) => b.id).filter((id) => !(cc.bgLinks?.[id]?.[cat as keyof NonNullable<CreationCopy["bgLinks"]>[string]] as string[] | undefined)?.length)] : [];
      if (paths.length || bgs.length) m[o] = { ...(paths.length ? { paths } : {}), ...(bgs.length ? { bgs } : {}) };
    }
    if (Object.keys(m).length) out[cat] = m;
  }
  return out;
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

export default function ModCreationFieldsEditor({ creation, parentJobs, backgrounds, onChange, attrs = [], npcs = [], statLabels = {} }: {
  creation?: CreationCopy; parentJobs?: string[]; backgrounds?: Option[];
  onChange: (p: { creation: CreationCopy; parentJobs?: string[] }) => void;
  attrs?: AttrDef[]; npcs?: { id: string; name: string }[]; statLabels?: Partial<Record<StatKey, string>>;
}) {
  const cc = creation ?? {};
  const jobs = parentJobs ?? [];
  const [open, setOpen] = useState<string | null>(null);
  const paths = (cc.paths ?? []).map((p) => ({ id: p.id, name: p.name }));
  const bgs = (backgrounds?.length ? backgrounds : RAW_BACKGROUNDS).map((b) => ({ id: b.id, name: b.name }));
  const commit = (patch: Partial<CreationCopy>, nj: string[] | undefined = parentJobs) => onChange({ creation: { ...cc, ...patch }, parentJobs: nj });
  const cfg = (k: BuiltinFieldKey): BuiltinFieldCfg => cc.builtin?.[k] ?? {};
  const setCfg = (k: BuiltinFieldKey, p: Partial<BuiltinFieldCfg>) => {
    const n = { ...cfg(k), ...p };
    (Object.keys(n) as (keyof BuiltinFieldCfg)[]).forEach((x) => { if (n[x] === undefined || n[x] === "" || n[x] === false) delete n[x]; });
    const b = { ...cc.builtin, [k]: n };
    if (!Object.keys(n).length) delete b[k];
    commit({ builtin: Object.keys(b).length ? b : undefined });
  };
  const pool = (cat: CreationOptCat) => (cat === "parentJobs" ? jobs : cc[cat] ?? []);
  const setPool = (cat: CreationOptCat, list: string[]) => {
    const clean = list;
    if (cat === "parentJobs") commit({}, clean.length ? clean : undefined);
    else commit({ [cat]: clean.length ? clean : undefined });
  };
  const links = (cat: CreationOptCat) => cc.optLinks?.[cat] ?? {};
  const setLink = (cat: CreationOptCat, opt: string, p: { paths?: string[]; bgs?: string[] }) => {
    const cur = { ...links(cat)[opt], ...p };
    if (!cur.paths) delete cur.paths;
    if (!cur.bgs) delete cur.bgs;
    const m = { ...links(cat), [opt]: cur };
    if (!Object.keys(cur).length) delete m[opt];
    commit({ optLinks: { ...cc.optLinks, [cat]: m } });
  };
  const renameOpt = (cat: CreationOptCat, i: number, v: string) => {
    const list = pool(cat);
    const old = list[i];
    const l = links(cat);
    const m = { ...l };
    if (m[old]) { m[v] = m[old]; delete m[old]; }
    const nl = list.map((x, j) => (j === i ? v : x));
    if (cat === "parentJobs") onChange({ creation: { ...cc, optLinks: { ...cc.optLinks, [cat]: m } }, parentJobs: nl });
    else commit({ [cat]: nl, optLinks: { ...cc.optLinks, [cat]: m } });
  };
  const fields = cc.fields ?? [];
  const setFields = (l: CreationField[]) => commit({ fields: l.length ? l : undefined });
  const setField = (id: string, p: Partial<CreationField>) => setFields(fields.map((f) => (f.id === id ? { ...f, ...p } : f)));
  const loadDefault = () => {
    const base = { ...cc, identityOpts: RAW_CREATION.identityOpts, backgroundOpts: RAW_CREATION.backgroundOpts, klassOpts: RAW_CREATION.klassOpts, paths: cc.paths ?? RAW_CREATION.paths };
    const ol = toOptLinks({ ...base, pathOpts: RAW_CREATION.pathOpts, bgLinks: RAW_CREATION.bgLinks }, RAW_PARENT_JOBS);
    onChange({ creation: { ...base, pathOpts: undefined, bgLinks: undefined, optLinks: ol }, parentJobs: [...RAW_PARENT_JOBS] });
  };

  const row = (key: string, id: string, title: string, type: string, badges: React.ReactNode, children: React.ReactNode) => {
    const isOpen = open === id;
    return (
      <div key={key} className="rounded-xl border border-line bg-paper">
        <button type="button" onClick={() => setOpen(isOpen ? null : id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
          <span className="text-[13px] font-semibold text-ink">{title}</span>
          <span className="rounded-full bg-paper-2 px-2 py-0.5 text-[10.5px] text-ink-soft">{type}</span>
          {badges}
          <span className={`ml-auto text-ink-soft transition ${isOpen ? "rotate-180" : ""}`}><IconChevronDown size={12} /></span>
        </button>
        {isOpen && <div className="space-y-2.5 border-t border-line px-3 py-3">{children}</div>}
      </div>
    );
  };
  const Badge = ({ tone, children }: { tone: "gold" | "soft" | "jade"; children: string }) => (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${tone === "gold" ? "bg-gold/15 text-gold" : tone === "jade" ? "bg-jade/10 text-jade" : "bg-line/50 text-ink-soft"}`}>{children}</span>
  );
  const lbl = "mb-0.5 block text-[11px] text-ink-soft";

  const optionList = (cat: CreationOptCat) => {
    const list = pool(cat);
    const l = links(cat);
    return (
      <div className="space-y-1.5">
        <span className={lbl}>选项（{list.length || "未设置 → 玩家自由输入 / 沿用默认"}）· 点开每项可限定出现条件</span>
        {list.map((o, i) => (
          <details key={i} className="rounded-lg border border-line/70 bg-paper-2/50 px-2 py-1.5">
            <summary className="flex cursor-pointer list-none items-center gap-1.5">
              <input className={inp} value={o} onClick={(e) => e.stopPropagation()} onChange={(e) => renameOpt(cat, i, e.target.value)} />
              {(l[o]?.paths || l[o]?.bgs) && <Badge tone="jade">已联动</Badge>}
              <button type="button" className="shrink-0 px-1 text-ink-soft hover:text-coral" aria-label="删除选项"
                onClick={(e) => { e.preventDefault(); setPool(cat, list.filter((_, j) => j !== i)); }}></button>
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {paths.length > 0 && <div><span className={lbl}>仅在这些人物线路出现</span><Chips all={paths} value={l[o]?.paths} onChange={(v) => setLink(cat, o, { paths: v })} /></div>}
              <div><span className={lbl}>仅在这些家庭背景出现</span><Chips all={bgs} value={l[o]?.bgs} onChange={(v) => setLink(cat, o, { bgs: v })} /></div>
            </div>
          </details>
        ))}
        <button type="button" className={btn} onClick={() => setPool(cat, [...list, `新选项${list.length + 1}`])}>＋ 选项</button>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-ink-soft">
        建角页显示哪些字段、叫什么、能不能改都在这里配。<b className="text-ink">锁定</b> = 玩家不可修改，固定为你填的值；选项可限定只在某些人物线路 / 家庭背景下出现（建角页自动过滤，避免矛盾组合）。
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={btn} onClick={loadDefault}>载入娱乐圈默认选项与联动</button>
      </div>

      {BUILTINS.map((b) => {
        const c = cfg(b.k);
        return (
          row(b.k, b.k, c.label || b.label, TYPE_LABEL[b.type],
            <>{c.locked && <Badge tone="gold">锁定</Badge>}{c.hidden && <Badge tone="soft">已隐藏</Badge>}<Badge tone="soft">内置</Badge></>, <>
            <div className="grid grid-cols-2 gap-2">
              <label><span className={lbl}>显示名称</span><input className={inp} value={c.label ?? ""} placeholder={b.label} onChange={(e) => setCfg(b.k, { label: e.target.value })} /></label>
              {b.k !== "extra" && !b.pool && <label><span className={lbl}>固定值（锁定时使用）</span><input className={inp} value={c.value ?? ""} placeholder="留空 = 随机生成后锁住" onChange={(e) => setCfg(b.k, { value: e.target.value })} /></label>}
            </div>
            <div className="flex flex-wrap gap-4">
              {!b.pool && <Toggle on={!!c.locked} onClick={() => setCfg(b.k, { locked: !c.locked })}>锁定（玩家不可改）</Toggle>}
              <Toggle on={!!c.hidden} onClick={() => setCfg(b.k, { hidden: !c.hidden })}>在建角页隐藏</Toggle>
            </div>
            {b.note && <p className="text-[10.5px] text-ink-soft">{b.note}</p>}
            {b.cat && optionList(b.cat)}
          </>)
        );
      })}

      {fields.map((f) => (
        row(f.id, f.id, f.label || "未命名字段", TYPE_LABEL[f.type],
          <>{f.locked && <Badge tone="gold">锁定</Badge>}{(f.paths || f.bgs) && <Badge tone="jade">条件出现</Badge>}</>, <>
          <div className="grid grid-cols-2 gap-2">
            <label><span className={lbl}>字段名</span><input className={inp} value={f.label} onChange={(e) => setField(f.id, { label: e.target.value })} placeholder="如：座右铭" /></label>
            <label><span className={lbl}>类型</span>
              <select className={inp} value={f.type} onChange={(e) => setField(f.id, { type: e.target.value as CreationFieldType })}>
                {(["text", "textarea", "select", "number"] as const).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label><span className={lbl}>{f.locked ? "固定值" : "默认值"}</span><input className={inp} value={f.init ?? ""} onChange={(e) => setField(f.id, { init: e.target.value || undefined })} /></label>
            {f.type === "number" ? (
              <div className="grid grid-cols-2 gap-1">
                <label><span className={lbl}>最小</span><input type="number" className={inp} value={f.min ?? ""} onChange={(e) => setField(f.id, { min: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
                <label><span className={lbl}>最大</span><input type="number" className={inp} value={f.max ?? ""} onChange={(e) => setField(f.id, { max: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>
              </div>
            ) : (
              <label><span className={lbl}>占位提示</span><input className={inp} value={f.placeholder ?? ""} onChange={(e) => setField(f.id, { placeholder: e.target.value || undefined })} /></label>
            )}
          </div>
          {f.type === "select" && (
            <label><span className={lbl}>选项（一行一个）</span>
              <textarea className={inp} rows={3} value={(f.options ?? []).join("\n")} onChange={(e) => setField(f.id, { options: e.target.value.split("\n") })} />
            </label>
          )}
          {f.type === "select" && (f.options ?? []).some((o) => String(o ?? "").trim()) && (
            <div className="space-y-1 rounded-lg border border-line/70 bg-paper-2/50 p-2">
              <span className={lbl}>选项的开局效果 · 玩家选中哪项就结算哪项（可不填）</span>
              {[...new Set((f.options ?? []).map((o) => String(o ?? "").trim()).filter(Boolean))].map((o) => {
                const s = fxSummary(f.optFx?.[o], { attr: (id) => attrs.find((a) => a.id === id)?.label, npc: (id) => npcs.find((n) => n.id === id)?.name });
                return (
                  <details key={o} className="rounded-md border border-line/60 bg-paper px-2 py-1">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px]">
                      <b className="shrink-0 text-ink">{o}</b>
                      <span className={`min-w-0 flex-1 truncate text-[10.5px] ${s.length ? "text-jade" : "text-ink-soft"}`}>{s.length ? s.join(" · ") : "无效果"}</span>
                      <span className="text-[11px] text-ink-soft">›</span>
                    </summary>
                    <div className="mt-1.5">
                      <OptFxEditor value={f.optFx?.[o]} attrs={attrs} npcs={npcs} statLabels={{ ...RAW_STAT_LABELS, ...statLabels }}
                        onChange={(v) => { const m = { ...(f.optFx ?? {}) }; if (v) m[o] = v; else delete m[o]; setField(f.id, { optFx: Object.keys(m).length ? m : undefined }); }} />
                    </div>
                  </details>
                );
              })}
            </div>
          )}
          <label><span className={lbl}>给 AI 的说明（可选）</span><input className={inp} value={f.desc ?? ""} placeholder="这个字段代表什么、剧情里怎么体现" onChange={(e) => setField(f.id, { desc: e.target.value || undefined })} /></label>
          <Toggle on={!!f.locked} onClick={() => setField(f.id, { locked: !f.locked || undefined })}>锁定（玩家不可改）</Toggle>
          {paths.length > 0 && <div><span className={lbl}>仅在这些人物线路出现</span><Chips all={paths} value={f.paths} onChange={(v) => setField(f.id, { paths: v })} /></div>}
          <div><span className={lbl}>仅在这些家庭背景出现</span><Chips all={bgs} value={f.bgs} onChange={(v) => setField(f.id, { bgs: v })} /></div>
          <button type="button" className={`${btn} hover:!border-coral hover:!text-coral`} onClick={() => setFields(fields.filter((x) => x.id !== f.id))}>删除此字段</button>
        </>)
      ))}

      <button type="button" onClick={() => { const f: CreationField = { id: uid(), label: "", type: "text" }; setFields([...fields, f]); setOpen(f.id); }}
        className="w-full rounded-xl border border-dashed border-line py-3 text-[13px] text-ink-soft transition hover:border-jade hover:text-jade">＋ 添加字段</button>
    </div>
  );
}
