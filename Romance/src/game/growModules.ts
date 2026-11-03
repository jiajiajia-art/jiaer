/**
 * 功能注释：养成页按模块勾选。课程/打工/账单/玩法规则不是每个剧本都有；
 * 没勾的编辑器不显示，开局也不读娱乐圈默认表。
 * 名气分档已并入建角数值属性的「分档」；头衔改为玩法 Mod（pack-titles），不再占养成模块。
 */

export type GrowModuleId = "courses" | "jobs" | "bills" | "gameRules";

export const GROW_MODULE_META: { id: GrowModuleId; label: string; hint: string }[] = [
  { id: "courses", label: "课程", hint: "培训课程、学费与等级" },
  { id: "jobs", label: "打工 · 周末活动", hint: "零工收入、周末安排" },
  { id: "bills", label: "账单与周期收入", hint: "固定账单、每周发放/扣除" },
  { id: "gameRules", label: "玩法规则", hint: "如果/否则、每天/每周判定" },
];

export type GrowModulesFlag = Partial<Record<GrowModuleId, boolean>>;

/** 与 ModContent 对齐的最小形状，供勾选判定与清空用 */
export type GrowContentLike = {
  growModules?: GrowModulesFlag & { growRules?: boolean };
  trainings?: unknown[];
  sideJobs?: unknown[];
  weekendActs?: unknown[];
  bills?: unknown;
  income?: unknown[];
  gameRules?: unknown[];
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

/** 功能注释：显式勾选优先；未写标记时按旧作已有字段推断。 */
export function isGrowModuleOn(c: GrowContentLike | null | undefined, id: GrowModuleId): boolean {
  const flag = c?.growModules?.[id];
  if (flag === true) return true;
  if (flag === false) return false;
  return authoredGrowModule(c, id);
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

/** 功能注释：勾选只打开空表单，不预填某一剧本数值。 */
export function enableGrowModule<T extends GrowContentLike>(c: T, id: GrowModuleId): T {
  return { ...c, growModules: { ...(c.growModules ?? {}), [id]: true } };
}
