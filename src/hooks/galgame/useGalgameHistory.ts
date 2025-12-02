import { useEffect, useState, useMemo } from "react";
import getGalgamePresetApi from "../../api/galgame/getGalgamePreset";
import type { History } from "../../api/galgame/getGalgamePreset.type";
import { v4 as uuidv4 } from 'uuid';

export interface HistoryWithId extends History {
    id: string;
}

const useGalgameHistory = (sessionId: string) => {
    const [history, setHistory] = useState<History[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sessionId) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
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
        };
        
        fetchHistory();
    }, [sessionId]);

    const historyWithId = useMemo<HistoryWithId[]>(() => {
        return history.map((item) => ({
            ...item,
            id: uuidv4(),
        }));
    }, [history, sessionId]);

    return { history: historyWithId, loading, error };
};

export default useGalgameHistory;
