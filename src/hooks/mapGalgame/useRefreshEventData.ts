import { useCallback } from 'react';
import { useMapGalgameStore, MapViewState } from '../../store/mapGalgameStore';
import interactionApi from '../../api/worldInteraction/interactionApi';
import { buildEventDataFromEvent } from '../../utils/eventUtils';

/**
 * 刷新事件状态 Hook
 * 从后端获取最新活跃事件并更新 store 状态
 */
export const useRefreshEventData = () => {
    const {
        currentView,
        eventData: currentEventData,
        setEventData,
        setEventCompleted,
    } = useMapGalgameStore();

    const refreshEventData = useCallback(async (sessionId: string, gameData: any) => {
        try {
            const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
            if (!activeEventsResponse.data.success) return;

            if (activeEventsResponse.data.events.length > 0) {
                const newEventData = buildEventDataFromEvent(
                    activeEventsResponse.data.events[0],
                    gameData
                );
                if (newEventData) {
                    setEventData(newEventData);
                    setEventCompleted(false);
                }
            } else {
                // 没有活跃事件时，在 NPC 交互页面保留当前 eventData 避免白屏
                if (currentView === MapViewState.INTERACT_NPC && currentEventData) {
                    return;
                }
                setEventData(null);
                setEventCompleted(true);
            }
        } catch (error) {
            console.error('[WorldInteraction] 刷新事件状态失败:', error);
        }
    }, [currentView, currentEventData, setEventData, setEventCompleted]);

    return { refreshEventData };
};

