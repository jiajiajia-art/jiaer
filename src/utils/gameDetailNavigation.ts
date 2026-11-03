import type { UserGameData } from '../api/home/getGameData.type';

/** 进入游戏详情页时通过 react-router location.state 传递的数据 */
export interface GameDetailLocationState {
  source?: string;
  /** 列表/搜索等已有的卡片数据，用于详情首屏，避免整页等接口 */
  gamePreview?: UserGameData | null;
  /** 书架「继续游玩」：详情页加载完成后自动走一次续玩 / 读档（复用详情页的权限与付费校验） */
  shelfResume?: ShelfResumeIntent;
}

export interface ShelfResumeIntent {
  fileId: string;
  /** 指定手动存档；null = 续上次自动进度 */
  saveId: string | null;
}

export function buildShelfResumeState(fileId: string, saveId: string | null): GameDetailLocationState {
  return { source: 'bookshelf', shelfResume: { fileId, saveId } };
}

const SHELF_RESUME_CONSUMED_KEY = 'funloom:shelfResume:consumed';

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * 功能注释：按路由 location.key 标记续玩意图已执行；从游戏返回详情页（同一历史条目、组件重挂载）时不再自动重进。
 * 返回 true 表示本次首次消费、应执行。
 */
export function consumeShelfResumeOnce(locationKey: string, storage: KeyValueStorage | null = typeof window !== 'undefined' ? window.sessionStorage : null): boolean {
  if (!locationKey) return false;
  let consumed: string[] = [];
  try {
    const raw = storage?.getItem(SHELF_RESUME_CONSUMED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    consumed = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    consumed = [];
  }
  if (consumed.includes(locationKey)) return false;
  try {
    storage?.setItem(SHELF_RESUME_CONSUMED_KEY, JSON.stringify([...consumed, locationKey].slice(-20)));
  } catch {
    // 存储不可用时仍执行一次
  }
  return true;
}

/** 功能注释：读取书架续玩意图；fileId 不匹配（如外链/刷新残留）时返回 null，避免误触发读档。 */
export function readShelfResume(state: unknown, fileId: string | undefined | null): ShelfResumeIntent | null {
  const expectedId = String(fileId || '').trim();
  if (!expectedId || !state || typeof state !== 'object') return null;
  const intent = (state as GameDetailLocationState).shelfResume;
  if (!intent || typeof intent !== 'object') return null;
  if (String(intent.fileId || '').trim() !== expectedId) return null;
  const saveId = typeof intent.saveId === 'string' && intent.saveId.trim() ? intent.saveId.trim() : null;
  return { fileId: expectedId, saveId };
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
