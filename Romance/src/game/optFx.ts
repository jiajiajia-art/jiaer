import { STAT_LABELS, type OptFx, type StatKey } from "./data";

/* 建角选项开局效果的一句话摘要（编辑器预览 / 建角页提示共用） */
export const OPT_METRICS: { k: keyof NonNullable<OptFx["metrics"]>; l: string }[] = [
  { k: "money", l: "资金" }, { k: "fame", l: "名气" }, { k: "reputation", l: "口碑" }, { k: "stress", l: "压力" }, { k: "looks", l: "容貌" },
];
const sg = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export function fxSummary(fx: OptFx | undefined, names: { attr?: (id: string) => string | undefined; npc?: (id: string) => string | undefined } = {}): string[] {
  if (!fx) return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(fx.stats ?? {})) if (v) out.push(`${STAT_LABELS[k as StatKey] ?? k} ${sg(v)}`);
  for (const { k, l } of OPT_METRICS) { const v = fx.metrics?.[k]; if (v) out.push(`${l} ${sg(v)}`); }
  for (const [k, v] of Object.entries(fx.attrs ?? {})) if (v) out.push(`${names.attr?.(k) ?? k} ${sg(v)}`);
  for (const [k, v] of Object.entries(fx.rel ?? {})) if (v) out.push(`${names.npc?.(k) ?? k} 好感 ${sg(v)}`);
  if (fx.startDate) out.push(`开局日期 ${fx.startDate}`);
  if (fx.note?.trim()) out.push(`设定「${fx.note.trim()}」`);
  return out;
}
export const fxEmpty = (fx?: OptFx) => fxSummary(fx).length === 0;
