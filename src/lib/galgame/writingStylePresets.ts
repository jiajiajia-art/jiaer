/**
 * 局内文风预设（玩家可见开关），对齐 UE「文风设定」与酒馆常见预设分类。
 * 开关 id 写入 gameStartConfig.writingStyle.toggles；后端 writingStylePresetPrompts 展开为完整提示词注入 GM。
 */

export type WritingStylePresetGroupId =
  | 'style'
  | 'viewpoint'
  | 'technique'
  | 'plot';

export type WritingStylePreset = {
  id: string;
  label: string;
  group: WritingStylePresetGroupId;
  hint?: string;
};

export const WRITING_STYLE_GROUP_LABELS: Record<WritingStylePresetGroupId, string> = {
  style: '文风',
  viewpoint: '视角',
  technique: '描写手法',
  plot: '剧情指导',
};

/** 功能注释：酒馆向可见预设清单（节奏另用 pace 三段控制）。 */
export const WRITING_STYLE_PRESETS: readonly WritingStylePreset[] = Object.freeze([
  { id: 'vernacular', label: '白话风', group: 'style', hint: '口语自然、少文言堆砌' },
  { id: 'female_oriented', label: '女频风', group: 'style', hint: '情感与关系线优先' },
  { id: 'literary', label: '文学风', group: 'style', hint: '意象与氛围更重' },
  { id: 'wuxia_classic', label: '古典武侠风', group: 'style', hint: '门派江湖语感' },

  { id: 'benevolent', label: '仁慈视角', group: 'viewpoint', hint: '偏宽容、少极端恶意' },
  { id: 'neutral_observer', label: '中立旁观', group: 'viewpoint', hint: '少强加对错评判' },
  { id: 'intimate_second', label: '亲近第二人称', group: 'viewpoint', hint: '拉近与「你」的距离' },

  { id: 'character_centric', label: '角色中心', group: 'technique', hint: '以人物动机推动描写' },
  { id: 'character_molding', label: '角色塑造', group: 'technique', hint: '强化性格与细节习惯' },
  { id: 'sensory_detail', label: '感官细节', group: 'technique', hint: '视听触味等具体描写' },
  { id: 'dialogue_heavy', label: '对话推进', group: 'technique', hint: '多用对白带剧情' },

  { id: 'plot_push', label: '剧情推进', group: 'plot', hint: '每轮有明确进展' },
  { id: 'slow_burn', label: '细水长流', group: 'plot', hint: '允许铺垫与留白' },
  { id: 'choice_consequence', label: '选择有后果', group: 'plot', hint: '强化因果与代价' },
]);

export const WRITING_PACE_OPTIONS = Object.freeze([
  { id: 'slow' as const, label: '慢' },
  { id: 'medium' as const, label: '中' },
  { id: 'fast' as const, label: '快' },
]);

export function groupWritingStylePresets(
  presets: readonly WritingStylePreset[] = WRITING_STYLE_PRESETS,
): Record<WritingStylePresetGroupId, WritingStylePreset[]> {
  const out: Record<WritingStylePresetGroupId, WritingStylePreset[]> = {
    style: [],
    viewpoint: [],
    technique: [],
    plot: [],
  };
  for (const p of presets) {
    out[p.group].push(p);
  }
  return out;
}

export function toggleWritingStyleId(toggles: string[], id: string, on: boolean): string[] {
  const set = new Set((toggles || []).map((t) => String(t).trim()).filter(Boolean));
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}
