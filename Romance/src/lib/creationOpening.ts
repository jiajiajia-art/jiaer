/* 开局页：只展示创作者在「建角」里配过的字段 / 属性，不自行补娱乐圈八维或空白身份。 */
import type { Attr, AttrDef } from "./types.ts";
import { attrStartValue } from "./attrInit.ts";

export type OpeningBuiltinCfg = { hidden?: boolean; locked?: boolean; value?: string; label?: string };

/**
 * 功能注释：出道身份 / 出身阶层 / 家世叙述等选项型字段——
 * 创作者没配选项、也没锁定固定值时，开局页不出现（禁止空表单自补）。
 */
export function openingSelectFieldOn(
  cfg: OpeningBuiltinCfg | undefined,
  optionCount: number,
): boolean {
  if (cfg?.hidden) return false;
  if (optionCount > 0) return true;
  if (cfg?.locked && String(cfg.value ?? "").trim()) return true;
  return false;
}

/**
 * 功能注释：开局写入的 attrs 只来自创作者 customAttrs，按数组顺序；
 * 没配则空数组（开局页也不显示属性区）。不再预填演技/歌艺等八维。
 */
export function playerAttrsFromCreatorDefs(
  defs: AttrDef[] | undefined,
  rand: () => number = Math.random,
): Attr[] {
  if (!defs?.length) return [];
  return defs.map((d) => ({
    key: d.id,
    label: d.label,
    value: attrStartValue(d, rand),
    max: d.max ?? 0,
    icon: d.icon,
  }));
}
