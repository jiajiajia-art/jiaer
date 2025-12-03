import { useEffect, useState, useMemo, useCallback } from "react";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { History } from "../../api/galgame/getGalgamePreset.type";
import { v4 as uuidv4 } from 'uuid';
import { useGameStore } from "../../store/gameStore";

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

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const historyWithId = useMemo<HistoryWithId[]>(() => {
        return history.map((item) => ({
            ...item,
            id: uuidv4(),
        }));
    }, [history, sessionId]);

    return { history: historyWithId, loading, error, refreshHistory: fetchHistory };
};

export default useGalgameHistory;
