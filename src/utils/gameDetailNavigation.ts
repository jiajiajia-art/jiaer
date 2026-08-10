import type { UserGameData } from '../api/home/getGameData.type';

/** 进入游戏详情页时通过 react-router location.state 传递的数据 */
export interface GameDetailLocationState {
  source?: string;
  /** 列表/搜索等已有的卡片数据，用于详情首屏，避免整页等接口 */
  gamePreview?: UserGameData | null;
}

export function buildGameDetailNavigateState(
  source: string,
  game?: UserGameData | null,
): GameDetailLocationState {
  if (!game) {
    return { source };
  }
  return {
    source,
    gamePreview: game,
  };
}

/**
 * 从路由 state 读取与当前 fileId 匹配的预览数据。
 * 刷新页面或外链直达时 state 为空，返回 null。
 */
export function readGameDetailPreview(
  state: unknown,
  fileId: string | undefined | null,
): UserGameData | null {
  const expectedId = String(fileId || '').trim();
  if (!expectedId || !state || typeof state !== 'object') {
    return null;
  }

  const preview = (state as GameDetailLocationState).gamePreview;
  if (!preview || typeof preview !== 'object') {
    return null;
  }

  const previewId = String(preview.file_id || preview.id || '').trim();
  if (!previewId || previewId !== expectedId) {
    return null;
  }

  return preview;
}
