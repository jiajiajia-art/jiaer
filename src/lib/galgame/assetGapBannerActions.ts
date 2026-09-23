/**
 * 素材待补齐横幅：按当前创作面板决定哪些跳转按钮该出现。
 * 已在目标页时不展示对应 CTA，避免用户点了无反应。
 */

export type AssetGapActionId = 'portraits' | 'scenes' | 'cover';

export interface VisibleAssetGapActionsInput {
  activePanel: string;
  missingPortraits: boolean;
  missingScenes: boolean;
  missingCover: boolean;
}

/**
 * 功能注释：只返回「当前不在该页、且仍有缺口」的跳转动作。
 * 立绘 → characters，背景 → scenes，封面 → world。
 */
export function visibleAssetGapActions(
  input: VisibleAssetGapActionsInput,
): AssetGapActionId[] {
  const actions: AssetGapActionId[] = [];
  if (input.missingPortraits && input.activePanel !== 'characters') {
    actions.push('portraits');
  }
  if (input.missingScenes && input.activePanel !== 'scenes') {
    actions.push('scenes');
  }
  if (input.missingCover && input.activePanel !== 'world') {
    actions.push('cover');
  }
  return actions;
}
