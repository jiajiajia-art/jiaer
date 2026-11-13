import type { ScheduleCatCfg, ScheduleCatId } from "../mods/types";

/**
 * 功能注释：日程分类的唯一定义；编辑器「日程分类」与局内日程板共用，避免两份默认文案漂移。
 * 默认文案保持题材通用；「工作」类名称跟随作品术语（娱乐圈下 gig = 通告）。
 */
export const SCHEDULE_CAT_IDS: ScheduleCatId[] = ["work", "lesson", "job", "rest", "social"];

export type ScheduleCatDefault = {
  id: ScheduleCatId;
  label: (term: (k: "gig") => string) => string;
  hint: string;
  color: string;
  /** 编辑器里说明这一类的活动从哪里来 */
  source: string;
};

export const SCHEDULE_CAT_DEFAULTS: Record<ScheduleCatId, ScheduleCatDefault> = {
  work: { id: "work", label: (t) => `进行中的${t("gig")}`, hint: "已接下的长期任务，按天推进进度", color: "#e0533d", source: "接下长期任务（如通告）后自动出现" },
  lesson: { id: "lesson", label: () => "学习课程", hint: "花费学费与体力，提升属性", color: "#c79a3a", source: "来自「培训课程」" },
  job: { id: "job", label: () => "打工赚钱", hint: "按档位解锁，档位越高收入越多", color: "#b3823c", source: "来自「打工」" },
  rest: { id: "rest", label: () => "休息调整", hint: "恢复状态，缓解压力", color: "#3a9d78", source: "内置「休息」+ 归入此类的周末活动" },
  social: { id: "social", label: () => "外出社交", hint: "自由活动，结识人物、调整心情", color: "#d76d77", source: "归入此类的周末活动" },
};

export type ResolvedScheduleCat = { id: ScheduleCatId; label: string; hint: string; dot: string; hidden: boolean };

/** 功能注释：作者覆盖优先，未写字段回落默认；顺序 = 作者排过的在前，其余按默认顺序补齐。 */
export function resolveScheduleCats(
  cfg: ScheduleCatCfg[] | undefined,
  term: (k: "gig") => string,
): { order: ScheduleCatId[]; meta: Record<ScheduleCatId, ResolvedScheduleCat> } {
  const list = (cfg ?? []).filter((c) => SCHEDULE_CAT_IDS.includes(c.id));
  const order = [...list.map((c) => c.id), ...SCHEDULE_CAT_IDS.filter((id) => !list.some((c) => c.id === id))];
  const meta = Object.fromEntries(SCHEDULE_CAT_IDS.map((id) => {
    const d = SCHEDULE_CAT_DEFAULTS[id];
    const c = list.find((x) => x.id === id);
    return [id, { id, label: c?.label?.trim() || d.label(term), hint: c?.hint?.trim() || d.hint, dot: c?.color || d.color, hidden: !!c?.hidden }];
  })) as Record<ScheduleCatId, ResolvedScheduleCat>;
  return { order, meta };
}
