/**
 * 世界观面板字段职责：区分「世界怎么运转 / 已发生什么 / 玩家看到的开场旁白 / AI 首轮骨架」。
 * 供表单文案、开场弹窗与单测共用，避免三处口径漂移。
 */

export type WorldSettingNarrativeFields = {
  background?: string | null;
  premise?: string | null;
  preamble?: string | null;
  initialPlot?: string | null;
};

export const WORLD_SETTING_FIELD_ROLES = {
  worldview: {
    key: 'background',
    actsOn: 'ai_world_rules',
    write: 'era_rules_factions_taboos',
    avoid: 'past_events_or_opening_beats',
  },
  premise: {
    key: 'premise',
    actsOn: 'pre_game_known_facts',
    write: 'events_already_happened',
    avoid: 'world_rules_or_opening_moment',
  },
  openingStatement: {
    key: 'preamble',
    actsOn: 'player_first_narration',
    write: 'player_facing_prose',
    avoid: 'director_notes_for_ai',
  },
  openingPlot: {
    key: 'initialPlot',
    actsOn: 'ai_first_turn_pacing',
    write: 'beat_sheet_until_first_choice',
    avoid: 'player_facing_monologue',
  },
} as const;

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * 功能注释：开场弹窗优先用「开场白」；旧存档若只有开场剧情则回退，避免空白。
 */
export function resolveStoryIntroText(fields: Pick<WorldSettingNarrativeFields, 'preamble' | 'initialPlot'>): string {
  return trimText(fields.preamble) || trimText(fields.initialPlot);
}

/**
 * 功能注释：拼进 GM 世界段落的「世界观 + 前情提要」，空字段不输出以免噪声。
 */
export function buildWorldLorePromptLines(fields: Pick<WorldSettingNarrativeFields, 'background' | 'premise'>): string[] {
  const lines: string[] = [];
  const worldview = trimText(fields.background);
  const premise = trimText(fields.premise);
  if (worldview) lines.push(`**世界观**：${worldview}`);
  if (premise) lines.push(`**前情提要**：${premise}`);
  return lines;
}

/**
 * 功能注释：从世界设定对象读取前情提要；缺省为空字符串（旧档混写在 background 里，不强行拆分）。
 */
export function readWorldPremise(worldSetting: { premise?: string | null } | null | undefined): string {
  return trimText(worldSetting?.premise);
}
