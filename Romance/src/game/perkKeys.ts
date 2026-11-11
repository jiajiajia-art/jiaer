/* 伴侣加成 · 属性键清单（所有世界观通用）
 * 编辑器下拉与 AI 结算说明共用同一份叫法：本世界观能力 / 自定义属性优先，
 * 引擎内置的娱乐圈项（名气 / 口碑 / 黑粉 / 容貌）单列，并注明「可能未启用」。 */
import type { StatKey } from "./data";
import type { AttrDef } from "../lib/types";

export type PerkKeyOption = { key: string; label: string; group: string; readOnly?: boolean };
export type PerkKeySource = {
  statLabels: Partial<Record<StatKey, string>>; // 已合并本世界观叫法的八维名
  statOrder: readonly StatKey[]; // 本世界观启用的能力（已去掉停用项）
  attrs?: AttrDef[]; // 自定义属性
  metaLabels?: { fame?: string; looks?: string; stress?: string };
  term?: (k: "fame" | "reputation", fb: string) => string;
};

/** 功能注释：noBuiltin=true 时只给建角属性与通用项（好感 / 行动力 / 周数），不出现娱乐圈八维、压力、名气等内置数值 */
export function perkKeyOptions(src: PerkKeySource & { noBuiltin?: boolean }): PerkKeyOption[] {
  const t = src.term ?? ((_k, fb) => fb);
  const world = "本世界观属性";
  const out: PerkKeyOption[] = [
    ...src.statOrder.map((k) => ({ key: `stat:${k}`, label: src.statLabels[k] ?? k, group: world })),
    ...(Array.isArray(src.attrs) ? src.attrs : []).map((d) => ({ key: `attr:${d.id}`, label: d.label || d.id, group: world })),
    { key: "affinity", label: "与 TA 的好感", group: "通用" },
    ...(src.noBuiltin ? [] : [{ key: "stress", label: src.metaLabels?.stress ?? "压力", group: "通用" }]),
    { key: "energy", label: "行动力", group: "通用" },
    { key: "week", label: "当前周数", group: "通用", readOnly: true },
  ];
  if (src.noBuiltin) return out;
  const builtin = "引擎内置（娱乐圈默认，本世界观可能未启用）";
  out.push(
    { key: "fame", label: src.metaLabels?.fame ?? t("fame", "名气"), group: builtin },
    { key: "reputation", label: t("reputation", "口碑"), group: builtin },
    { key: "blackFans", label: "黑粉", group: builtin },
    { key: "looks", label: src.metaLabels?.looks ?? "容貌", group: builtin, readOnly: true },
  );
  return out;
}

export const perkKeyLabel = (opts: PerkKeyOption[], key: string) => opts.find((o) => o.key === key)?.label ?? key;
