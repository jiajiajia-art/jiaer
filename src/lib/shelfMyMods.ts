/**
 * 功能注释：书架「我的 Mod」共享常量（路径、类型、记忆键）。单独成文件，组件文件只导出组件（保证开发热更新）。
 */
export type ShelfModKind = 'play' | 'app';
export const KIND_STORAGE_KEY = 'shelf-mymods-kind';

/** 功能注释：继续编辑入口 */
export const playModEditPath = (id: string) => `/romance/?createPlayMod=1&editComponent=${encodeURIComponent(id)}`;
export const phoneAppEditPath = (appId: string) => `/create/app?edit=${encodeURIComponent(appId)}`;
export const PLAY_MOD_CREATE_PATH = '/romance/?createPlayMod=1';
export const PHONE_APP_CREATE_PATH = '/create/app';
export const readShelfModKind = (): ShelfModKind => {
  try { return sessionStorage.getItem(KIND_STORAGE_KEY) === 'app' ? 'app' : 'play'; } catch { return 'play'; }
};
