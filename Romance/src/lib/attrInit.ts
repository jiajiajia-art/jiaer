/* 自定义属性开局值：默认由代码在最小～最大之间随机一次，作者锁定时用 init。
 * 旧稿 initMode=dice 与 random 同义（不再按骰子面数）。随机只发生在开局，不交给生成文本的模型。 */
import type { AttrDef } from "./types.ts";

/** 功能注释：与 wallet.attrCap 同口径，无上限时不夹上界 */
const cap = (max?: number) => (typeof max === "number" && max > 0 ? max : Infinity);

/** 功能注释：是否走「最小～最大随机」（含旧 dice） */
export function attrUsesRandomStart(a: Pick<AttrDef, "initMode">): boolean {
  return a.initMode == null || a.initMode === "random" || a.initMode === "dice";
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

export type AttrStartMode = "random" | "locked" | "choice" | "custom";
/** 功能注释：开局取值方式（兼容旧稿：缺省 / dice = random，fixed = locked；choice 无有效选项时退回 locked） */
export function attrStartMode(a: Pick<AttrDef, "initMode" | "options">): AttrStartMode {
  if (attrUsesRandomStart(a)) return "random";
  if (a.initMode === "choice") return (a.options ?? []).some((o) => o && String(o.label ?? "").trim()) ? "choice" : "locked";
  if (a.initMode === "custom") return "custom";
  return "locked";
}
/** 功能注释：choice 模式的有效选项 */
export function attrChoiceOptions(a: Pick<AttrDef, "options">): { label: string; value: number; desc?: string }[] {
  return (Array.isArray(a.options) ? a.options : []).filter((o) => o && String(o.label ?? "").trim()).map((o) => ({ label: String(o.label).trim(), value: Math.round(Number(o.value) || 0), desc: o.desc }));
}

/**
 * 功能注释：开局只随机这一次。随机模式在范围内均匀取整，固定模式用 init。
 * rand 可注入，便于单测；正式开局用 Math.random，不经过 AI。
 */
export function attrStartValue(
  a: Pick<AttrDef, "init" | "initMode" | "dice" | "min" | "max" | "options">,
  rand: () => number = Math.random,
): number {
  if (attrStartMode(a) === "choice") {
    const options = attrChoiceOptions(a);
    return clampAttrStart(a, options[Math.floor(rand() * options.length)]?.value ?? a.init);
  }
  if (attrUsesRandomStart(a)) {
    const lo = Math.floor(a.min ?? 0);
    const hiRaw = a.max ?? (a.initMode == null ? Math.max(lo, 100) : undefined);
    if (typeof hiRaw !== "number" || !Number.isFinite(hiRaw) || hiRaw < lo) {
      return clampAttrStart(a, a.init);
    }
    const hi = Math.floor(hiRaw);
    return lo + Math.floor(rand() * (hi - lo + 1));
  }
  return clampAttrStart(a, a.init);
}
