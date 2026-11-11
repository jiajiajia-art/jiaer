/**
 * 功能注释：养成页按「总开关 + 子项」勾选。
 * 总开关关 = 编辑器整块锁定、局内不走养成（底栏「日程」改「推进」、不打开日程板）。
 * 子项：课程/打工/账单/玩法规则 + 引擎常用项（每日表现评级、休息减压）；
 * 没勾的编辑器不显示，开局也不读娱乐圈默认表。
 * 名气分档已并入建角数值属性；头衔改为玩法 Mod（pack-titles），不再占养成模块。
 */

export type GrowModuleId = "courses" | "jobs" | "bills" | "gameRules";

/** 功能注释：养成页统一子项里的引擎勾选（不含通告/违约等娱乐圈内置） */
export type GrowTuningSubId = "dayGrade" | "rest";

export const GROW_MODULE_META: { id: GrowModuleId; label: string; hint: string }[] = [
  { id: "courses", label: "课程", hint: "培训课程、学费与等级" },
  { id: "jobs", label: "打工 · 周末活动", hint: "零工收入、周末安排" },
  { id: "bills", label: "账单与周期收入", hint: "固定账单、每周发放/扣除" },
  { id: "gameRules", label: "玩法规则", hint: "如果/否则、每天/每周判定" },
];

/** 功能注释：与养成总开关并列的引擎子项；不塞工作结算/违约等娱乐圈专用块 */
export const GROW_TUNING_SUB_META: { id: GrowTuningSubId; label: string; hint: string }[] = [
  { id: "dayGrade", label: "每日表现评级", hint: "上课 / 打工时掷出完美～糟糕" },
  { id: "rest", label: "休息减压", hint: "安排休息时减多少压力" },
];

export type GrowModulesFlag = Partial<Record<GrowModuleId, boolean>> & {
  /**
   * 总养成开关。
   * true = 启用；false = 整块锁定；未写则按子项/旧数据推断（兼容旧作）。
   */
  enabled?: boolean;
};

/** 与 ModContent 对齐的最小形状，供勾选判定与清空用 */
export type GrowContentLike = {
  growModules?: GrowModulesFlag & { growRules?: boolean };
  trainings?: unknown[];
  sideJobs?: unknown[];
  weekendActs?: unknown[];
  bills?: unknown;
  income?: unknown[];
  gameRules?: unknown[];
  tuning?: {
    modules?: Partial<Record<GrowTuningSubId, boolean>>;
    gradeOdds?: Record<string, number>;
    gradeMul?: Record<string, number>;
    luckStat?: string;
    luckDiv?: number;
    stressDiv?: number;
    restStress?: number;
  } | null;
};

/** 功能注释：内容里是否已写出该模块（旧作无 growModules 时用数据反推）。 */
export function authoredGrowModule(c: GrowContentLike | null | undefined, id: GrowModuleId): boolean {
  if (!c) return false;
  switch (id) {
    case "courses":
      return !!(c.trainings && c.trainings.length);
    case "jobs":
      return !!(c.sideJobs && c.sideJobs.length) || !!(c.weekendActs && c.weekendActs.length);
    case "bills":
      return !!c.bills || !!(c.income && c.income.length);
    case "gameRules":
      return !!(c.gameRules && c.gameRules.length);
    default:
      return false;
  }
}

/** 功能注释：旧作仅配了评级/休息、未写 growModules 时，总开关仍应视为开过（不依赖 tuningModules，便于单测直载）。 */
function authoredGrowTuning(c: GrowContentLike | null | undefined): boolean {
  const t = c?.tuning;
  if (!t) return false;
  if (t.modules?.dayGrade === true || t.modules?.rest === true) return true;
  if (t.restStress != null) return true;
  if (t.gradeOdds && Object.keys(t.gradeOdds).length) return true;
  if (t.gradeMul && Object.keys(t.gradeMul).length) return true;
  if (t.luckStat || t.luckDiv != null || t.stressDiv != null) return true;
  return false;
}

/** 功能注释：单子项显式勾选优先；未写标记时按旧作已有字段推断（不看总开关）。 */
function moduleFlagOn(c: GrowContentLike | null | undefined, id: GrowModuleId): boolean {
  const flag = c?.growModules?.[id];
  if (flag === true) return true;
  if (flag === false) return false;
  return authoredGrowModule(c, id);
}

/**
 * 功能注释：本作品是否启用养成。
 * 显式 enabled 优先；未写时只要任一子项或旧引擎养成项有内容，就视为开启（兼容旧档）。
 */
export function isGrowEnabled(c: GrowContentLike | null | undefined): boolean {
  const flag = c?.growModules?.enabled;
  if (flag === true) return true;
  if (flag === false) return false;
  if (GROW_MODULE_META.some((m) => moduleFlagOn(c, m.id))) return true;
  return authoredGrowTuning(c);
}

/** 功能注释：打开/关闭总养成开关；关时保留子项数据，只记 enabled=false，方便再打开。 */
export function setGrowEnabled<T extends GrowContentLike>(c: T, on: boolean): T {
  return {
    ...c,
    growModules: { ...(c.growModules ?? {}), enabled: on },
  };
}

/** 功能注释：显式勾选优先；总开关关闭时一律视为未开，避免局内仍读养成。 */
export function isGrowModuleOn(c: GrowContentLike | null | undefined, id: GrowModuleId): boolean {
  if (!isGrowEnabled(c)) return false;
  return moduleFlagOn(c, id);
}

/** 功能注释：取消勾选清掉字段并记 false，避免开局仍读到现代打工项。 */
export function clearGrowModule<T extends GrowContentLike>(c: T, id: GrowModuleId): T {
  const next: GrowContentLike = {
    ...c,
    growModules: { ...(c.growModules ?? {}), [id]: false },
  };
  switch (id) {
    case "courses":
      delete next.trainings;
      break;
    case "jobs":
      delete next.sideJobs;
      delete next.weekendActs;
      break;
    case "bills":
      delete next.bills;
      delete next.income;
      break;
    case "gameRules":
      delete next.gameRules;
      break;
  }
  return next as T;
}

/** 功能注释：勾选只打开空表单，不预填某一剧本数值；同时确保总开关为开。 */
export function enableGrowModule<T extends GrowContentLike>(c: T, id: GrowModuleId): T {
  return {
    ...c,
    growModules: { ...(c.growModules ?? {}), enabled: true, [id]: true },
  };
}
