/* 跨 MOD 选择器：列出所有已安装 MOD 的导出项（带 mod.<id>.<名> 命名空间与来源名）；
 * 对应 MOD 未启用时选项置灰；参数按导出声明逐个填写（只允许基础类型）。 */
import type { ModArg, ModEventFilter, ModParamDef } from "../mods/types";
import { allMods } from "../mods/registry";
import { isModActive } from "../mods/ext";
import { nsName } from "../mods/comm";

const sel = "rounded-lg border border-line bg-paper-2 px-2 py-1 text-[12.5px] text-ink";
type Kind = "actions" | "events";
export const exportOptions = (kind: Kind) =>
  allMods().flatMap((m) => ((m.ext?.exports?.[kind] ?? []) as { id: string; label?: string; params?: ModParamDef[] }[]).map((x) => ({ mod: m.id, modName: m.name, id: x.id, label: x.label || x.id, params: x.params ?? [], on: isModActive(m.id) })));
export const firstExport = (kind: Kind) => { const o = exportOptions(kind); return o.find((x) => x.on) ?? o[0]; };

export default function ModExportPicker({ kind, mod, id, onChange }: { kind: Kind; mod: string; id: string; onChange: (mod: string, id: string) => void }) {
  const opts = exportOptions(kind);
  const cur = `${mod}|${id}`;
  return (
    <select className={sel} value={cur} onChange={(e) => { const [m, i] = e.target.value.split("|"); onChange(m, i); }} aria-label={kind === "actions" ? "MOD 导出动作" : "MOD 导出事件"}>
      {!opts.some((o) => `${o.mod}|${o.id}` === cur) && <option value={cur}>{mod ? `已失效：${nsName(mod, id)}` : opts.length ? "（请选择）" : "（没有 MOD 导出这类接口）"}</option>}
      {opts.map((o) => <option key={`${o.mod}|${o.id}`} value={`${o.mod}|${o.id}`} disabled={!o.on}>[{o.modName}] {o.label} · {nsName(o.mod, o.id)}{o.on ? "" : "（未启用）"}</option>)}
    </select>
  );
}

export function ArgsEditor({ params, value, onChange }: { params: ModParamDef[]; value?: Record<string, ModArg>; onChange: (v: Record<string, ModArg> | undefined) => void }) {
  if (!params.length) return null;
  const set = (k: string, v: ModArg | undefined) => { const n = { ...(value ?? {}) }; if (v === undefined || v === "") delete n[k]; else n[k] = v; onChange(Object.keys(n).length ? n : undefined); };
  return (
    <span className="flex flex-wrap items-center gap-1">
      {params.map((p) => {
        const v = value?.[p.name];
        const ph = `${p.label || p.name}${p.optional ? "（可选）" : ""}`;
        if (p.type === "boolean") return <label key={p.name} className="flex items-center gap-1 text-[12px] text-ink-soft"><input type="checkbox" checked={v === true} onChange={(e) => set(p.name, e.target.checked)} />{ph}</label>;
        if (p.type === "number") return <input key={p.name} type="number" className={`${sel} w-20`} placeholder={ph} value={typeof v === "number" ? v : ""} onChange={(e) => set(p.name, e.target.value === "" ? undefined : Number(e.target.value))} />;
        if (p.type === "list") return <input key={p.name} className={`${sel} w-32`} placeholder={`${ph}，逗号分隔`} value={Array.isArray(v) ? v.join(",") : ""} onChange={(e) => set(p.name, e.target.value ? e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) : undefined)} />;
        return <input key={p.name} className={`${sel} w-28`} placeholder={p.type === "id" ? `${ph}（ID）` : ph} value={typeof v === "string" ? v : ""} onChange={(e) => set(p.name, e.target.value || undefined)} />;
      })}
    </span>
  );
}

export function FilterEditor({ params, value, onChange }: { params: ModParamDef[]; value?: ModEventFilter[]; onChange: (v: ModEventFilter[] | undefined) => void }) {
  const list = value ?? [];
  const put = (n: ModEventFilter[]) => onChange(n.length ? n : undefined);
  return (
    <span className="flex flex-wrap items-center gap-1 text-[12px] text-ink-soft">
      {list.map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          <select className={sel} value={f.param} onChange={(e) => put(list.map((x, j) => (j === i ? { ...x, param: e.target.value } : x)))}>{params.map((p) => <option key={p.name} value={p.name}>{p.label || p.name}</option>)}</select>
          <select className={sel} value={f.op} onChange={(e) => put(list.map((x, j) => (j === i ? { ...x, op: e.target.value as ModEventFilter["op"] } : x)))}>
            {(["eq", "ne", "gt", "gte", "lt", "lte"] as const).map((o) => <option key={o} value={o}>{({ eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" })[o]}</option>)}
          </select>
          <input className={`${sel} w-20`} value={String(f.value)} onChange={(e) => { const t = e.target.value; const v = t === "true" ? true : t === "false" ? false : t.trim() !== "" && !Number.isNaN(Number(t)) ? Number(t) : t; put(list.map((x, j) => (j === i ? { ...x, value: v } : x))); }} />
          <button type="button" className="text-danger" onClick={() => put(list.filter((_, j) => j !== i))} aria-label="删除过滤">×</button>
        </span>
      ))}
      {params.length > 0 && <button type="button" className="font-semibold text-jade hover:underline" onClick={() => put([...list, { param: params[0].name, op: "eq", value: "" }])}>＋ 过滤</button>}
    </span>
  );
}
