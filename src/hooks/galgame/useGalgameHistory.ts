import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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

const useGalgameHistory = (options?: { disabled?: boolean }) => {
    const [history, setHistory] = useState<History[]>([]);
    const [historyOffset, setHistoryOffset] = useState<number>(0);
    const [historyTotal, setHistoryTotal] = useState<number>(0);
    const [hasMoreBefore, setHasMoreBefore] = useState<boolean>(false);
    const [loadingMoreBefore, setLoadingMoreBefore] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [lastVisitedSceneId, setLastVisitedSceneId] = useState<string | null>(null);
    const [contextMemory, setContextMemory] = useState<ContextMemoryStatus | null>(null);
    const initializedRef = useRef<boolean>(false);
    const { sessionId } = useGameStore();
    const disabled = options?.disabled === true;

    const fetchHistory = useCallback(async () => {
        if (disabled) {
            setHistory([]);
            setHistoryOffset(0);
            setHistoryTotal(0);
            setHasMoreBefore(false);
            setLastVisitedSceneId(null);
            setContextMemory(null);
            setLoading(false);
            return;
        }

        if (!sessionId) {
            setLoading(false);
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
            setError(error instanceof Error ? error.message : '获取历史记录失败');
        } finally {
            setLoading(false);
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
            setError(error instanceof Error ? error.message : 'Failed to load earlier history');
        } finally {
            setLoadingMoreBefore(false);
        }
    }, [disabled, hasMoreBefore, historyOffset, historyTotal, loadingMoreBefore, sessionId]);

    const editHistory = useCallback(async (historyIndex: number, content: string): Promise<boolean> => {
        if (!sessionId) {
            toast.error('没有 sessionId');
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
                toast.success('编辑保存成功');
                // 刷新历史记录
                await fetchHistory();
                return true;
            } else {
                toast.error('保存失败');
                return false;
            }
        } catch (error) {
            console.error('编辑保存错误:', error);
            toast.error('保存失败');
            return false;
        }
    }, [sessionId, fetchHistory]);

    useEffect(() => {
        // 每次 sessionId 变化时，都重置 initializedRef
        initializedRef.current = false;
        
        if (sessionId) {
            // 新游戏或切换游戏时，获取历史记录
            fetchHistory();
        } else {
            initializedRef.current = false;
            setHistory([]);
            setHistoryOffset(0);
            setHistoryTotal(0);
            setHasMoreBefore(false);
            setContextMemory(null);
            setLoading(false);
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

    return { 
        history: historyWithId, 
        loading, 
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
    };
};

export default useGalgameHistory;
