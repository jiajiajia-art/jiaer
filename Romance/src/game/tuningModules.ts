/**
 * 功能注释：引擎规则按模块勾选。创作者勾了才编辑/开局生效；未勾或空值不带某一现代打工剧本的写死项。
 * 独立小模块，单测可直接 import，避免拉整份 data.ts。
 */

export type TuningModuleId = "dayGrade" | "work" | "breach" | "course" | "rest" | "jobPay";

export const TUNING_MODULE_META: { id: TuningModuleId; label: string; hint: string }[] = [
  { id: "dayGrade", label: "每日表现评级", hint: "上课 / 打工 / 拍摄时掷出完美～糟糕" },
  { id: "work", label: "工作结算", hint: "崩溃判定、失败惩罚、补救、对接人" },
  { id: "breach", label: "违约惩罚", hint: "违约降低后续交涉成功率" },
  { id: "course", label: "课程倍率与等级", hint: "学费 / 收益倍率、通用课程等级" },
  { id: "rest", label: "休息减压", hint: "安排休息时减多少压力" },
  { id: "jobPay", label: "打工收入倍率", hint: "零工结算收入总倍率" },
];

export type TuningModulesFlag = Partial<Record<TuningModuleId, boolean>>;

/** 与 TuningSlot 对齐的最小形状，供勾选判定与清空用 */
export type TuningLike = {
  modules?: TuningModulesFlag;
  gradeOdds?: Record<string, number>;
  gradeMul?: Record<string, number>;
  luckStat?: string;
  luckDiv?: number;
  stressDiv?: number;
  restStress?: number;
  trainGainMul?: number;
  trainFeeMul?: number;
  jobPayMul?: number;
  lessonGrades?: unknown[];
  gigRules?: Record<string, unknown> | null;
};

const BREACH_KEYS = new Set(["breachBase", "breachHi", "breachHiTypes"]);

/** 功能注释：内容里是否已写出该模块（旧作无 modules 标记时，用数据反推是否开启）。 */
export function authoredTuningModule(t: TuningLike | null | undefined, id: TuningModuleId): boolean {
  if (!t) return false;
  switch (id) {
    case "dayGrade":
      return !!(t.gradeOdds && Object.keys(t.gradeOdds).length)
        || !!(t.gradeMul && Object.keys(t.gradeMul).length)
        || !!t.luckStat
        || t.luckDiv != null
        || t.stressDiv != null;
    case "rest":
      return t.restStress != null;
    case "jobPay":
      return t.jobPayMul != null;
    case "course":
      return t.trainFeeMul != null || t.trainGainMul != null || !!(t.lessonGrades && t.lessonGrades.length);
    case "work": {
      const gr = t.gigRules;
      if (!gr) return false;
      return Object.keys(gr).some((k) => !BREACH_KEYS.has(k));
    }
    case "breach": {
      const gr = t.gigRules;
      if (!gr) return false;
      return gr.breachBase != null || gr.breachHi != null || !!(gr.breachHiTypes && String(gr.breachHiTypes).trim());
    }
    default:
      return false;
  }
}

/** 功能注释：显式勾选优先；未写 modules 时按旧作已有字段推断，保证老存档不丢块。 */
export function isTuningModuleOn(t: TuningLike | null | undefined, id: TuningModuleId): boolean {
  const flag = t?.modules?.[id];
  if (flag === true) return true;
  if (flag === false) return false;
  return authoredTuningModule(t, id);
}

/** 功能注释：取消勾选时清掉该模块字段，并记 modules[id]=false，避免旧数据开局仍生效。 */
export function clearTuningModule<T extends TuningLike>(t: T, id: TuningModuleId): T {
  const next: TuningLike = {
    ...t,
    modules: { ...(t.modules ?? {}), [id]: false },
    gigRules: t.gigRules ? { ...t.gigRules } : t.gigRules,
  };
  switch (id) {
    case "dayGrade":
      delete next.gradeOdds;
      delete next.gradeMul;
      delete next.luckStat;
      delete next.luckDiv;
      delete next.stressDiv;
      break;
    case "rest":
      delete next.restStress;
      break;
    case "jobPay":
      delete next.jobPayMul;
      break;
    case "course":
      delete next.trainFeeMul;
      delete next.trainGainMul;
      delete next.lessonGrades;
      break;
    case "work": {
      const gr = { ...(next.gigRules ?? {}) };
      for (const k of Object.keys(gr)) {
        if (!BREACH_KEYS.has(k)) delete gr[k];
      }
      next.gigRules = Object.keys(gr).length ? gr : undefined;
      break;
    }
    case "breach": {
      const gr = { ...(next.gigRules ?? {}) };
      delete gr.breachBase;
      delete gr.breachHi;
      delete gr.breachHiTypes;
      next.gigRules = Object.keys(gr).length ? gr : undefined;
      break;
    }
  }
  return next as T;
}

/** 功能注释：勾选模块只打开编辑区，不预填任何某一剧本的数值。 */
export function enableTuningModule<T extends TuningLike>(t: T, id: TuningModuleId): T {
  return { ...t, modules: { ...(t.modules ?? {}), [id]: true } };
}

/** 功能注释：去掉空对象 / 全 false 的 modules，便于存盘干净。 */
export function pruneTuningSlot(t: TuningLike | null | undefined): TuningLike | undefined {
  if (!t) return undefined;
  const next: Record<string, unknown> = { ...t };
  for (const k of Object.keys(next)) {
    const v = next[k];
    if (v === undefined) delete next[k];
    else if (v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v as object).length) delete next[k];
  }
  const mods = next.modules as TuningModulesFlag | undefined;
  if (mods) {
    const kept = Object.fromEntries(Object.entries(mods).filter(([, v]) => v === true || v === false));
    if (!Object.keys(kept).length) delete next.modules;
    else next.modules = kept;
  }
  const keys = Object.keys(next);
  if (!keys.length) return undefined;
  if (keys.length === 1 && next.modules && Object.values(next.modules as TuningModulesFlag).every((v) => v === false)) {
    return undefined;
  }
  return next as TuningLike;
}
