import { useCallback, useRef } from 'react';
import { useMapGalgameStore, MapViewState } from '../../../store/mapGalgameStore';
import interactionApi from '../../../api/worldInteraction/interactionApi';
import { buildEventDataFromEvent } from '../../../utils/eventUtils';

/**
 * 刷新事件状态 Hook
 * 从后端获取最新活跃事件并更新 store 状态
 */
export const useRefreshEventData = () => {
    const {
        setEventData,
        setEventCompleted,
    } = useMapGalgameStore();
    
    // 防止并发请求
    const isRequestingRef = useRef<boolean>(false);

    const refreshEventData = useCallback(async (sessionId: string, gameData: any) => {
        // 如果正在请求，跳过
        if (isRequestingRef.current) {
            return;
        }
        
        isRequestingRef.current = true;
        
        try {
            const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);

            if (!activeEventsResponse.data.success) {
                return;
            }

            // 在函数内部获取最新状态，避免依赖项变化导致函数重新创建
            const { currentView, eventData: currentEventData } = useMapGalgameStore.getState();

            if (activeEventsResponse.data.events.length > 0) {
                const newEventData = buildEventDataFromEvent(
                    activeEventsResponse.data.events[0],
                    gameData
                );
                if (newEventData) {
                    setEventCompleted(false);
                    setEventData(newEventData);
                }
            } else {
                // 没有活跃事件时，在 NPC 交互页面保留当前 eventData 避免白屏
                // 但需要设置 eventCompleted = true，以便显示"开始下一回合"按钮
                if ((currentView === MapViewState.INTERACT_NPC_NORMAL || 
                     currentView === MapViewState.INTERACT_NPC_ABILITY) && currentEventData) {
                    setEventCompleted(true);
                    return;
                }
                setEventData(null);
                setEventCompleted(true);
            }
        } catch (error) {
            console.error('[WorldInteraction] ❌ 刷新事件状态失败:', error);
        } finally {
            isRequestingRef.current = false;
        }
    }, [setEventData, setEventCompleted]);

    return { refreshEventData };
};

