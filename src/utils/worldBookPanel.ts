/**
 * 世界书（Step 5）面板路由：主侧栏 worldBook 与 morePrompt 子面板的激活与默认选中逻辑
 */
import type { MorePromptForm } from '../api/galgame/EditorData.type';
import { buildMorePromptPanelId, isMorePromptPanel } from './morePromptForms.ts';

/** Step 5 主面板 id */
export const WORLD_BOOK_PANEL = 'worldBook';

/** 世界书左侧菜单起始序号（主流程 Step 5） */
export const WORLD_BOOK_NAV_NUMBER_OFFSET = 5;

/** 主侧栏 Step 5 或 morePrompt 子面板均视为在世界书内 */
export function isWorldBookActive(panelId: string): boolean {
  return panelId === WORLD_BOOK_PANEL || isMorePromptPanel(panelId);
}

/** 右侧应展示表单还是空状态 */
export type WorldBookRightView = 'empty' | 'form';

export function resolveWorldBookRightView(activePanel: string): WorldBookRightView {
  return isMorePromptPanel(activePanel) ? 'form' : 'empty';
}

/**
 * 进入世界书时的目标面板：有条目则打开第一条，否则停留 worldBook 空状态
 */
export function resolveWorldBookTargetPanel(
  forms: Pick<MorePromptForm, 'id'>[],
  requestedPanel: string = WORLD_BOOK_PANEL,
): string {
  if (requestedPanel !== WORLD_BOOK_PANEL) {
    return requestedPanel;
  }
  const first = forms[0];
  if (first?.id) {
    return buildMorePromptPanelId(first.id);
  }
  return WORLD_BOOK_PANEL;
}

/**
 * 删除条目后应跳转的面板：仍有条目则第一条，否则空状态
 */
export function resolveWorldBookPanelAfterDelete(
  remainingForms: Pick<MorePromptForm, 'id'>[],
): string {
  return resolveWorldBookTargetPanel(remainingForms, WORLD_BOOK_PANEL);
}
