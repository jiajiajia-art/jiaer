import type { UserGameData } from '../api/home/getGameData.type';
import { api } from '../api/base';

/** 功能注释：浏览记录优先走服务端；失败时回落本机缓存，保证书架可用。 */
const KEY_PREFIX = 'browsing_history_v1:';
const MAX_ITEMS = 100;

const keyOf = (userId: string | number | undefined | null) => `${KEY_PREFIX}${userId || 'guest'}`;

type HistoryListResponse = {
    success?: boolean;
    data?: {
        rows?: UserGameData[];
        total?: number;
        limit?: number;
        offset?: number;
        hasMore?: boolean;
    };
};

export const readBrowsingHistoryLocal = (userId?: string | number | null): UserGameData[] => {
    try {
        const raw = localStorage.getItem(keyOf(userId));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
};

/** @deprecated 同步读取仅用于首屏占位；正式列表请用 fetchBrowsingHistory */
export const readBrowsingHistory = readBrowsingHistoryLocal;

export const recordBrowsingHistory = (userId: string | number | undefined | null, game: UserGameData) => {
    const id = String(game.file_id || game.id || '');
    if (!id) return;
    try {
        const rest = readBrowsingHistoryLocal(userId).filter((g) => String(g.file_id || g.id) !== id);
        localStorage.setItem(keyOf(userId), JSON.stringify([game, ...rest].slice(0, MAX_ITEMS)));
    } catch {
        // 功能注释：存储满或隐私模式时静默忽略
    }
};

export const clearBrowsingHistoryLocal = (userId?: string | number | null) => {
    try {
        localStorage.removeItem(keyOf(userId));
    } catch {
        // ignore
    }
};

/**
 * 功能注释：拉服务端浏览记录；未登录或失败时回落本机
 */
export async function fetchBrowsingHistory(
    userId?: string | number | null,
    params: { limit?: number; offset?: number } = {},
): Promise<UserGameData[]> {
    if (!userId) return readBrowsingHistoryLocal(userId);
    try {
        const res = await api.get<HistoryListResponse>('/auth/games/history', {
            params: { limit: params.limit ?? 100, offset: params.offset ?? 0 },
        });
        // axios：res.data = { success, data: { rows } }
        const rows = res?.data?.data?.rows;
        if (Array.isArray(rows)) {
            try {
                localStorage.setItem(keyOf(userId), JSON.stringify(rows.slice(0, MAX_ITEMS)));
            } catch {
                // ignore cache write
            }
            return rows;
        }
    } catch {
        // fall through
    }
    return readBrowsingHistoryLocal(userId);
}

/**
 * 功能注释：清空服务端 + 本机浏览记录
 */
export async function clearBrowsingHistory(userId?: string | number | null): Promise<void> {
    clearBrowsingHistoryLocal(userId);
    if (!userId) return;
    try {
        await api.delete('/auth/games/history');
    } catch {
        // 功能注释：服务端清空失败时本机已清，下次拉列表再对齐
    }
}
