/* 自定义属性开局值：勾选「固定数值」用 init；不勾则在最小～最大之间由代码随机一次。
 * 旧稿 initMode=dice 与 random 同义（不再按骰子面数）。随机只发生在开局，不交给生成文本的模型。 */
import type { AttrDef } from "./types.ts";

/** 功能注释：与 wallet.attrCap 同口径，无上限时不夹上界 */
const cap = (max?: number) => (typeof max === "number" && max > 0 ? max : Infinity);

/** 功能注释：是否走「最小～最大随机」（含旧 dice） */
export function attrUsesRandomStart(a: Pick<AttrDef, "initMode">): boolean {
  return a.initMode === "random" || a.initMode === "dice";
}

/**
 * 功能注释：旧版「投骰子」面数校验保留给读旧数据；新 UI 已改为范围随机，不再要求 dice。
 * 返回 null 表示当前无需提示（固定或范围随机均可开局）。
 */
export function attrDiceProblem(a: Pick<AttrDef, "initMode" | "dice" | "min" | "max">): string | null {
  if (!attrUsesRandomStart(a)) return null;
  // 功能注释：范围随机需要有效上限；无上限时编辑器应提示或回退固定值
  if (a.initMode === "random" || a.initMode === "dice") {
    const lo = a.min ?? 0;
    const hi = a.max;
    if (typeof hi !== "number" || !Number.isFinite(hi) || hi < lo) {
      return "随机开局须填写不小于最小值的最大";
    }
  }
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
 * 功能注释：开局只随机这一次。固定用 init；不勾固定则在最小…最大均匀取整。
 * rand 可注入，便于单测；正式开局用 Math.random，不经过 AI。
 */
export function attrStartValue(
  a: Pick<AttrDef, "init" | "initMode" | "dice" | "min" | "max">,
  rand: () => number = Math.random,
): number {
  if (attrUsesRandomStart(a)) {
    const lo = Math.floor(a.min ?? 0);
    const hiRaw = a.max;
    if (typeof hiRaw !== "number" || !Number.isFinite(hiRaw) || hiRaw < lo) {
      return clampAttrStart(a, a.init);
    }
    const hi = Math.floor(hiRaw);
    return lo + Math.floor(rand() * (hi - lo + 1));
  }
  return clampAttrStart(a, a.init);
}
