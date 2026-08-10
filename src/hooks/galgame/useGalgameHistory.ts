import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { ContextMemoryStatus, History } from "../../api/galgame/getGalgamePreset.type";
import { useGameStore } from "../../store/gameStore";
import { HOST_ADDRESS } from "../../config";
import toast from "react-hot-toast";
import { authFetch } from "../../api/base";

export interface HistoryWithId extends History {
    id: string;
    absoluteIndex: number;
}

const HISTORY_PAGE_SIZE = 80;

const useGalgameHistory = (options?: {
    disabled?: boolean;
    /** 新开局：进页不拉 history，仅打开历史面板时再 refresh */
    skipInitialFetch?: boolean;
}) => {
    const { t } = useTranslation();
    const [history, setHistory] = useState<History[]>([]);
    const [historyOffset, setHistoryOffset] = useState<number>(0);
    const [historyTotal, setHistoryTotal] = useState<number>(0);
    const [hasMoreBefore, setHasMoreBefore] = useState<boolean>(false);
    const [loadingMoreBefore, setLoadingMoreBefore] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    /** 当前 session 是否已完成至少一次 history 拉取（避免 session 刚到、loading 仍为 false 时误判新开局） */
    const [historyBootstrapped, setHistoryBootstrapped] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastVisitedSceneId, setLastVisitedSceneId] = useState<string | null>(null);
    const [contextMemory, setContextMemory] = useState<ContextMemoryStatus | null>(null);
    const initializedRef = useRef<boolean>(false);
    const { sessionId } = useGameStore();
    const disabled = options?.disabled === true;
    const skipInitialFetchRef = useRef(options?.skipInitialFetch === true);
    skipInitialFetchRef.current = options?.skipInitialFetch === true;

    const fetchHistory = useCallback(async () => {
        if (disabled) {
            setHistory([]);
            setHistoryOffset(0);
            setHistoryTotal(0);
            setHasMoreBefore(false);
            setLastVisitedSceneId(null);
            setContextMemory(null);
            setLoading(false);
            setHistoryBootstrapped(true);
            return;
        }

        if (!sessionId) {
            setLoading(false);
            setHistoryBootstrapped(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await getGalgamePresetApi.getGalgameHistory(sessionId, {
                limit: HISTORY_PAGE_SIZE,
                direction: 'before'
            });
            if (response.data?.success && response.data.history) {
                setHistory(response.data.history);
                setHistoryOffset(Number(response.data.offset || 0));
                setHistoryTotal(Number(response.data.total || response.data.history.length));
                setHasMoreBefore(response.data.hasMoreBefore === true);
                setContextMemory(response.data.contextMemory || null);

                // 从返回的 visitedScenes 中解析当前所在场景 ID（最后一个）
                const visitedScenes = (response.data as any).visitedScenes;
                if (Array.isArray(visitedScenes) && visitedScenes.length > 0) {
                    const lastId = visitedScenes[visitedScenes.length - 1];
                    setLastVisitedSceneId(typeof lastId === 'string' && lastId ? lastId : null);
                } else {
                    setLastVisitedSceneId(null);
                }
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('galgame.historyLoadFailed'));
        } finally {
            setLoading(false);
            setHistoryBootstrapped(true);
        }
    }, [disabled, sessionId]);

    const loadMoreBefore = useCallback(async () => {
        if (disabled || !sessionId || loadingMoreBefore || !hasMoreBefore) {
            return;
        }

        try {
            setLoadingMoreBefore(true);
            const response = await getGalgamePresetApi.getGalgameHistory(sessionId, {
                offset: historyOffset,
                limit: HISTORY_PAGE_SIZE,
                direction: 'before'
            });
            if (response.data?.success && Array.isArray(response.data.history)) {
                setHistory((prev) => [...response.data.history, ...prev]);
                setHistoryOffset(Number(response.data.offset || 0));
                setHistoryTotal(Number(response.data.total || historyTotal));
                setHasMoreBefore(response.data.hasMoreBefore === true);
                setContextMemory(response.data.contextMemory || null);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : t('galgame.historyLoadEarlierFailed'));
        } finally {
            setLoadingMoreBefore(false);
        }
    }, [disabled, hasMoreBefore, historyOffset, historyTotal, loadingMoreBefore, sessionId]);

    const editHistory = useCallback(async (historyIndex: number, content: string): Promise<boolean> => {
        if (!sessionId) {
            toast.error(t('galgame.historyMissingSessionId'));
            return false;
        }

        try {
            const response = await authFetch(
                `${HOST_ADDRESS}/api/visual/session/${sessionId}/history/${historyIndex-1}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                }
            );

            if (response.ok) {
                toast.success(t('galgame.historySaveSuccess'));
                // 刷新历史记录
                await fetchHistory();
                return true;
            } else {
                toast.error(t('galgame.historySaveFailed'));
                return false;
            }
        } catch (error) {
            console.error(t('galgame.historyEditSaveError') + ':', error);
            toast.error(t('galgame.historySaveFailed'));
            return false;
        }
    }, [sessionId, fetchHistory]);

    useEffect(() => {
        // 每次 sessionId 变化时，都重置 initializedRef
        initializedRef.current = false;
        setHistoryBootstrapped(false);
        
        if (sessionId) {
            if (skipInitialFetchRef.current) {
                // 新开局：不打 history 门闩；打开历史面板时再 refreshHistory
                setHistory([]);
                setHistoryOffset(0);
                setHistoryTotal(0);
                setHasMoreBefore(false);
                setLastVisitedSceneId(null);
                setContextMemory(null);
                setLoading(false);
                setHistoryBootstrapped(true);
                return;
            }
            fetchHistory();
        } else {
            initializedRef.current = false;
            setHistory([]);
            setHistoryOffset(0);
            setHistoryTotal(0);
            setHasMoreBefore(false);
            setContextMemory(null);
            setLoading(false);
            setHistoryBootstrapped(false);
        }
    }, [sessionId]);

    const historyWithId = useMemo<HistoryWithId[]>(() => {
        const sessionPrefix = sessionId || 'session';
        return history.map((item, index) => ({
            ...item,
            absoluteIndex: historyOffset + index,
            id: `${sessionPrefix}-${historyOffset + index}-${item.role}`,
        }));
    }, [history, historyOffset, sessionId]);

    /** 发送行动时先写入本地，保证历史面板立刻能看到用户自己的选择/输入 */
    const appendLocalUserMessage = useCallback((content: string) => {
        const text = String(content || '').trim();
        if (!text) return;
        setHistory((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'user' && String(last.content || '').trim() === text) {
                return prev;
            }
            return [...prev, { role: 'user', content: text }];
        });
        setHistoryTotal((prev) => prev + 1);
    }, []);

    return { 
        history: historyWithId, 
        loading, 
        historyBootstrapped,
        error, 
        refreshHistory: fetchHistory,
        loadMoreBefore,
        hasMoreBefore,
        loadingMoreBefore,
        historyTotal,
        historyOffset,
        editHistory,
        lastVisitedSceneId,
        contextMemory,
        appendLocalUserMessage,
    };
};

export default useGalgameHistory;
