import type { FixedCond, FixedEffect, FixedEvent, GameRule, GameRuleRole, RuleBranch } from "./types";

/** 功能注释：预设把「会发生的事」写成事件库条目，规则只保留时机/条件/挂钩/规则变量。 */
export type RulePresetBuild = {
  role: GameRuleRole;
  name: string;
  when: GameRule["when"];
  chance?: number;
  once?: boolean;
  cooldown?: number;
  /** 写入 content.events；key 供分支 eventKey 挂钩 */
  events: { key: string; event: Omit<FixedEvent, "id"> }[];
  branches: (Omit<RuleBranch, "eventId"> & { eventKey?: string })[];
};

export type RulePreset = { name: string; desc: string; build: () => RulePresetBuild };

const m = (key: string, opv: "gte" | "lte", value: number): FixedCond => ({ kind: "metric", key, op: opv, value });

/** 功能注释：规则调用的库事件默认锁定，避免按时间自动上演；由 applyGameRules 按 eventId 结算效果。 */
function libEvent(name: string, prompt: string, effects: FixedEffect[]): Omit<FixedEvent, "id"> {
  return { name, prompt, effects, locked: true, once: false, time: { kind: "none" } };
}

export const GAME_RULE_PRESETS: RulePreset[] = [
  {
    name: "过劳惩罚",
    desc: "精力见底的那天压力陡增；事件写入事件库",
    build: () => ({
      role: "event",
      name: "过劳惩罚",
      when: "day",
      events: [{ key: "overwork", event: libEvent("过劳惩罚", "体力透支，压力陡增", [{ kind: "metric", key: "stress", delta: 8 }]) }],
      branches: [{ conds: [m("energy", "lte", 15)], effects: [], eventKey: "overwork", notice: "体力透支，压力陡增" }],
    }),
  },
  {
    name: "名气分段流动",
    desc: "按名气高低给不同的周增长；各段效果进事件库",
    build: () => ({
      role: "event",
      name: "名气分段流动",
      when: "week",
      events: [
        { key: "fame_hi", event: libEvent("名气分段流动·热度发酵", "热度持续发酵", [{ kind: "metric", key: "fame", delta: 12 }]) },
        { key: "fame_mid", event: libEvent("名气分段流动·小有名气", "小有名气", [{ kind: "metric", key: "fame", delta: 4 }]) },
        { key: "fame_lo", event: libEvent("名气分段流动·默默无闻", "默默无闻也有一点曝光", [{ kind: "metric", key: "fame", delta: 1 }]) },
      ],
      branches: [
        { conds: [m("fame", "gte", 500)], effects: [], eventKey: "fame_hi", notice: "热度持续发酵" },
        { conds: [m("fame", "gte", 100)], effects: [], eventKey: "fame_mid", notice: "小有名气" },
        { conds: [], effects: [], eventKey: "fame_lo" },
      ],
    }),
  },
  {
    name: "高压计数",
    desc: "只改规则变量「高压天数」，不进事件库",
    build: () => ({
      role: "flag",
      name: "高压计数",
      when: "day",
      events: [],
      branches: [
        { conds: [m("stress", "gte", 70)], effects: [{ kind: "flag", key: "高压天数", delta: 1 }] },
        { conds: [], effects: [{ kind: "flag", key: "高压天数", delta: 0, set: true }] },
      ],
    }),
  },
  {
    name: "长期高压警报",
    desc: "连续高压达标后口碑下滑；惩罚事件进事件库，计数重置留在规则",
    build: () => ({
      role: "event",
      name: "长期高压警报",
      when: "day",
      cooldown: 7,
      events: [{ key: "stress_alert", event: libEvent("长期高压警报", "长期高压，状态下滑被人看在眼里", [{ kind: "metric", key: "reputation", delta: -3 }]) }],
      branches: [{
        conds: [{ kind: "flag", key: "高压天数", op: "gte", value: 5 }],
        effects: [{ kind: "flag", key: "高压天数", delta: 0, set: true }],
        eventKey: "stress_alert",
        notice: "长期高压，状态下滑被人看在眼里",
      }],
    }),
  },
  {
    name: "幸运日",
    desc: "每天 10% 概率小赚一笔；事件写入事件库",
    build: () => ({
      role: "event",
      name: "幸运日",
      when: "day",
      chance: 10,
      events: [{ key: "lucky", event: libEvent("幸运日", "路边捡到一张中奖彩票", [{ kind: "metric", key: "money", delta: 200 }]) }],
      branches: [{ conds: [], effects: [], eventKey: "lucky", notice: "路边捡到一张中奖彩票" }],
    }),
  },
];

/** 功能注释：物化预设——生成带 id 的规则，并把分支 eventKey 接到新建事件库条目上。 */
export function materializeRulePreset(
  preset: RulePreset,
  makeId: () => string = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
): { rule: GameRule; events: FixedEvent[] } {
  const built = preset.build();
  const keyToId = new Map<string, string>();
  const events: FixedEvent[] = built.events.map(({ key, event }) => {
    const id = `ev_${makeId()}`;
    keyToId.set(key, id);
    return { ...event, id };
  });
  const rule: GameRule = {
    id: `gr_${makeId()}`,
    name: built.name,
    when: built.when,
    role: built.role,
    ...(built.chance != null ? { chance: built.chance } : {}),
    ...(built.once ? { once: true } : {}),
    ...(built.cooldown ? { cooldown: built.cooldown } : {}),
    branches: built.branches.map((b) => {
      const { eventKey, ...rest } = b;
      return {
        ...rest,
        effects: Array.isArray(rest.effects) ? rest.effects : [],
        conds: Array.isArray(rest.conds) ? rest.conds : [],
        ...(eventKey && keyToId.has(eventKey) ? { eventId: keyToId.get(eventKey) } : {}),
      };
    }),
  };
  return { rule, events };
}

/** 功能注释：列表行上展示本规则挂钩的事件库名称（去重）。 */
export function linkedLibraryEventNames(rule: GameRule, library: FixedEvent[] | undefined): string[] {
  const byId = new Map((library ?? []).map((e) => [e.id, e.name]));
  const names: string[] = [];
  const seen = new Set<string>();
  for (const b of rule.branches ?? []) {
    if (!b.eventId || seen.has(b.eventId)) continue;
    seen.add(b.eventId);
    names.push(byId.get(b.eventId) || b.eventId);
  }
  return names;
}

/** 功能注释：命中分支时合并事件库效果与分支自带效果（规则变量等），提示优先用分支 notice。 */
export function resolveRuleBranchEffects(
  branch: Pick<RuleBranch, "effects" | "eventId" | "notice">,
  library: Pick<FixedEvent, "id" | "effects" | "prompt">[] | undefined,
): { effects: FixedEffect[]; notice?: string } {
  const ev = branch.eventId ? (library ?? []).find((e) => e.id === branch.eventId) : undefined;
  const effects = [...(ev?.effects ?? []), ...(Array.isArray(branch.effects) ? branch.effects : [])];
  const notice = branch.notice?.trim() || ev?.prompt?.trim() || undefined;
  return { effects, ...(notice ? { notice } : {}) };
}
