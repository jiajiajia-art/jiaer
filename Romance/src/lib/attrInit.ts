/* 自定义属性开局值：同一属性二选一——固定数值，或开局由代码掷一次骰子。
 * 掷点只发生在开局，不交给生成文本的模型；之后属性就是普通数字。 */
import type { AttrDef } from "./types.ts";

/** 功能注释：与 wallet.attrCap 同口径，无上限时不夹上界 */
const cap = (max?: number) => (typeof max === "number" && max > 0 ? max : Infinity);

/** 功能注释：编辑器当场校验；面数缺省或不是正整数时立刻提示，不要拖到开局 */
export function attrDiceProblem(a: Pick<AttrDef, "initMode" | "dice">): string | null {
  if (a.initMode !== "dice") return null;
  const n = a.dice;
  if (n == null || (typeof n === "number" && Number.isNaN(n))) return "请填写骰子面数";
  if (!Number.isInteger(n) || n < 1) return "骰子面数须为正整数";
  return null;
}

/** 功能注释：把开局结果夹进该项属性的最小 / 最大 */
export function clampAttrStart(a: Pick<AttrDef, "min" | "max">, value: number): number {
  const lo = a.min ?? 0;
  const hi = cap(a.max);
  const v = Math.round(Number(value) || 0);
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 功能注释：开局只掷这一次。固定用 init；投骰子时在 1…面数 上均匀取整，再夹到最小 / 最大。
 * rand 可注入，便于单测；正式开局用 Math.random，不经过 AI。
 */
export function attrStartValue(
  a: Pick<AttrDef, "init" | "initMode" | "dice" | "min" | "max">,
  rand: () => number = Math.random,
): number {
  if (a.initMode === "dice" && !attrDiceProblem(a)) {
    const faces = a.dice as number;
    const roll = Math.floor(rand() * faces) + 1;
    return clampAttrStart(a, roll);
  }
  return clampAttrStart(a, a.init);
}
