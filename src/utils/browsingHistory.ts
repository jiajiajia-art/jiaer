import type { UserGameData } from '../api/home/getGameData.type';
import { api } from '../api/base';

/** 功能注释：本地缓存仍作离线兜底；列表与清空走 GET/DELETE /auth/games/history。 */
const KEY_PREFIX = 'browsing_history_v1:';
const MAX_ITEMS = 100;

const keyOf = (userId: string | number | undefined | null) => `${KEY_PREFIX}${userId || 'guest'}`;

type BrowsingHistoryListResponse = {
    success?: boolean;
    data?: {
        rows?: UserGameData[];
    };
};

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

/** 功能注释：拉服务端浏览记录；失败时回落本地缓存。成功后写回同一把本地钥匙，书架历史页不用改调用方也能读到。 */
export const fetchBrowsingHistory = async (
    userId?: string | number | null,
    params?: { limit?: number; offset?: number },
): Promise<UserGameData[]> => {
    try {
        const response = await api.get<BrowsingHistoryListResponse>('/auth/games/history', {
            params: {
                limit: params?.limit ?? MAX_ITEMS,
                offset: params?.offset ?? 0,
            },
        });
        const rows = response.data?.data?.rows;
        if (!Array.isArray(rows)) return readBrowsingHistory(userId);
        const list = rows.slice(0, MAX_ITEMS);
        try {
            localStorage.setItem(keyOf(userId), JSON.stringify(list));
        } catch {
            // 功能注释：缓存失败不影响已取到的服务端列表
        }
        return list;
    } catch {
        return readBrowsingHistory(userId);
    }
};

export const clearBrowsingHistory = (userId?: string | number | null) => {
    try {
        localStorage.removeItem(keyOf(userId));
    } catch {
        // ignore
    }
    // 功能注释：服务端清空不等待，避免清本地时被网络卡住
    void api.delete('/auth/games/history').catch(() => {
        // 功能注释：未登录或离线时本地已清，远端失败不打断界面
    });
};
