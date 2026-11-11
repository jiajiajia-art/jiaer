/**
 * Galgame 底栏四面板状态机：同一时刻最多打开一个业务面板（设置独立）。
 */

export type PlayBottomPanelId = 'character' | 'attrs' | 'quests' | 'systems';

/** 功能注释：点击同一 Tab 再次关闭；点其它 Tab 切换；传入 null 强制关闭。 */
export function togglePlayBottomPanel(
  current: PlayBottomPanelId | null,
  next: PlayBottomPanelId | null
): PlayBottomPanelId | null {
  if (next == null) return null;
  return current === next ? null : next;
}

export function isPlayBottomPanelOpen(
  current: PlayBottomPanelId | null,
  id: PlayBottomPanelId
): boolean {
  return current === id;
}
