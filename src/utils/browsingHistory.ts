import type { UserGameData } from '../api/home/getGameData.type';

/** 功能注释：浏览记录暂存本地（后端尚无列表接口），按用户隔离，最多保留 100 条，最新在前。 */
const KEY_PREFIX = 'browsing_history_v1:';
const MAX_ITEMS = 100;

const keyOf = (userId: string | number | undefined | null) => `${KEY_PREFIX}${userId || 'guest'}`;

export const readBrowsingHistory = (userId?: string | number | null): UserGameData[] => {
    try {
        const raw = localStorage.getItem(keyOf(userId));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

export const recordBrowsingHistory = (userId: string | number | undefined | null, game: UserGameData) => {
    const id = String(game.file_id || game.id || '');
    if (!id) return;
    try {
        const rest = readBrowsingHistory(userId).filter((g) => String(g.file_id || g.id) !== id);
        localStorage.setItem(keyOf(userId), JSON.stringify([game, ...rest].slice(0, MAX_ITEMS)));
    } catch {
        // 功能注释：存储满或隐私模式时静默忽略
    }
};

export const clearBrowsingHistory = (userId?: string | number | null) => {
    try {
        localStorage.removeItem(keyOf(userId));
    } catch {
        // ignore
    }
};
