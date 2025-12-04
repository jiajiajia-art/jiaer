import { useEffect, useState, useMemo, useCallback } from "react";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { History } from "../../api/galgame/getGalgamePreset.type";
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from "../../store/gameStore";
import { HOST_ADDRESS } from "../../config";
import toast from "react-hot-toast";

export interface HistoryWithId extends History {
    id: string;
}

const useGalgameHistory = () => {
    const [history, setHistory] = useState<History[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const { sessionId } = useGameStore();

    const fetchHistory = useCallback(async () => {
        if (!sessionId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const response = await getGalgamePresetApi.getGalgameHistory(sessionId);
            if (response.data?.success && response.data.history) {
                setHistory(response.data.history);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : '获取历史记录失败');
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    // 编辑历史记录
    const editHistory = useCallback(async (historyIndex: number, content: string): Promise<boolean> => {
        if (!sessionId) {
            toast.error('没有 sessionId');
            return false;
        }

        try {
            const response = await fetch(
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
        fetchHistory();
    }, [fetchHistory]);

    const historyWithId = useMemo<HistoryWithId[]>(() => {
        return history.map((item) => ({
            ...item,
            id: uuidv4(),
        }));
    }, [history, sessionId]);

    return { 
        history: historyWithId, 
        loading, 
        error, 
        refreshHistory: fetchHistory,
        editHistory 
    };
};

export default useGalgameHistory;
