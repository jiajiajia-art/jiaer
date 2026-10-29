/* 玩家端「人物档案」：头像旁事实行、属性满值文案、压力类警戒提醒。字段名与顺序一律来自创作者配置，不硬编码能力名。 */
import type { AttrDef, Player } from "./types.ts";

/** 功能注释：头像右侧小字「年龄 · 性别 · 生日 · 星座」，缺项跳过，不补占位 */
export function dossierFactLine(p: Pick<Player, "age" | "gender" | "extra">): string {
  const ex = (label: string) => p.extra?.find((e) => e.label === label)?.value?.trim() || "";
  const age = String(p.age ?? "").trim();
  const parts = [
    age ? (/岁$/.test(age) ? age : `${age}岁`) : "",
    String(p.gender ?? "").trim(),
    ex("生日"),
    ex("星座"),
  ].filter(Boolean);
  return parts.join(" · ");
}

/** 功能注释：属性区标题右侧「满值 N」；无上限时写「无上限」 */
export function dossierAttrCapLabel(def: Pick<AttrDef, "max"> | undefined): string {
  if (!def) return "";
  const m = def.max;
  if (typeof m !== "number" || !(m > 0)) return "无上限";
  return `满值 ${m}`;
}

/**
 * 功能注释：压力类属性超过警戒线时返回提醒文案（数字改红用）。
 * 判定：名称含压力/焦虑等，或创作者把颜色标成 danger；警戒线优先用上限的 75%，否则 75。
 */
export function dossierAttrWarn(
  def: Pick<AttrDef, "label" | "color" | "max">,
  value: number,
): string | null {
  const stressLike = def.color === "danger" || /压力|焦虑|崩溃|负荷/.test(def.label);
  if (!stressLike) return null;
  const limit =
    typeof def.max === "number" && def.max > 0 ? Math.max(1, Math.floor(def.max * 0.75)) : 75;
  if (value < limit) return null;
  return `已超过警戒线（${limit}）`;
}

/** 功能注释：进度条比例，夹到 0–1；无上限时按当前值相对「至少 1」的软比例 */
export function dossierAttrPct(value: number, max?: number, min = 0): number {
  const lo = min ?? 0;
  if (typeof max === "number" && max > lo) {
    return Math.max(0, Math.min(1, (value - lo) / (max - lo)));
  }
  const soft = Math.max(1, value, lo + 1);
  return Math.max(0, Math.min(1, (value - lo) / soft));
}
