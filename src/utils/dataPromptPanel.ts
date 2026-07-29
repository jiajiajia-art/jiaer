/**
 * 数据库（Step 6）面板路由：主侧栏 gameDatabase 与 dataPrompt 子面板的激活与默认选中逻辑
 */
import type { DataPromptForm } from '../api/galgame/EditorData.type';
import { buildDataPromptPanelId, isDataPromptPanel } from './dataPromptForms.ts';

/** Step 6 主面板 id */
export const GAME_DATABASE_PANEL = 'gameDatabase';

/** 数据库左侧菜单起始序号（主流程 Step 6） */
export const GAME_DATABASE_NAV_NUMBER_OFFSET = 6;

/** 主侧栏 Step 6 或 dataPrompt 子面板均视为在数据库内 */
export function isGameDatabaseActive(panelId: string): boolean {
  return panelId === GAME_DATABASE_PANEL || isDataPromptPanel(panelId);
}

/** 右侧应展示表单还是空状态 */
export type GameDatabaseRightView = 'empty' | 'form';

export function resolveGameDatabaseRightView(activePanel: string): GameDatabaseRightView {
  return isDataPromptPanel(activePanel) ? 'form' : 'empty';
}

/**
 * 进入数据库时的目标面板：有条目则打开第一条，否则停留 gameDatabase 空状态
 */
export function resolveGameDatabaseTargetPanel(
  forms: Pick<DataPromptForm, 'id'>[],
  requestedPanel: string = GAME_DATABASE_PANEL,
): string {
  if (requestedPanel !== GAME_DATABASE_PANEL) {
    return requestedPanel;
  }
  const first = forms[0];
  if (first?.id) {
    return buildDataPromptPanelId(first.id);
  }
  return GAME_DATABASE_PANEL;
}

/**
 * 删除条目后应跳转的面板：仍有条目则第一条，否则空状态
 */
export function resolveGameDatabasePanelAfterDelete(
  remainingForms: Pick<DataPromptForm, 'id'>[],
): string {
  return resolveGameDatabaseTargetPanel(remainingForms, GAME_DATABASE_PANEL);
}
