import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventData } from '../page/GalgameMap';
import type { Scene } from '../api/worldInteraction/mapWorldData.type';
import interactionApi from '../api/worldInteraction/interactionApi';
import { buildEventDataFromEvent } from '../utils/eventUtils';

// 视图状态类型
export type MapViewState = 
    | 'story_intro'        // 开场白
    | 'world_map'          // 世界地图
    | 'scene_view'         // 场景视图（显示某个场景的子场景列表）
    | 'subScene_modal'        // 场景详情
    | 'interact_npc';      // NPC交互

// 视图状态常量
export const MapViewState = {
    STORY_INTRO: 'story_intro' as const,
    WORLD_MAP: 'world_map' as const,
    SCENE_VIEW: 'scene_view' as const,
    SUBSCENE_MODAL: 'subScene_modal' as const,
    INTERACT_NPC: 'interact_npc' as const,
};

interface useMapGalgameState {
    eventData: EventData | null;
    setEventData: (eventData: EventData | null) => void;
        refreshEventData: (sessionId: string, gameData: any) => Promise<void>;
    
    // 视图状态管理
    currentView: MapViewState;
    setCurrentView: (view: MapViewState) => void;
    
    // 场景模态框数据
    selectedSubscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    } | null;
    setSelectedSubscene: (subscene: useMapGalgameState['selectedSubscene']) => void;
    
    // 场景视图数据（用于显示某个场景的子场景列表）
    selectedScene: Scene | null;
    setSelectedScene: (scene: Scene | null) => void;
    
    // 音乐播放状态（全局共享）
    isMusicPlaying: boolean;
    setMusicPlaying: (playing: boolean) => void;
    
    // 清空状态
    clearState: () => void;
}

export const useMapGalgameStore = create<useMapGalgameState>()(
    persist(
        (set) => ({
            eventData: null,
            setEventData: (eventData: EventData | null) => set({ eventData }),
            
            // 刷新事件状态：从后端获取最新活跃事件
            refreshEventData: async (sessionId: string, gameData: any) => {
                try {
                    const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
                    if (activeEventsResponse.data.success) {
                        if (activeEventsResponse.data.events.length > 0) {
                            // 有活跃事件：更新 eventData
                            const newEventData = buildEventDataFromEvent(
                                activeEventsResponse.data.events[0],
                                gameData
                            );
                            if (newEventData) {
                                set({ eventData: newEventData });
                                console.log('[WorldInteraction] 刷新事件状态成功：', newEventData);
                            }
                        } else {
                            // 没有活跃事件：清空 eventData
                            set({ eventData: null });
                            console.log('[WorldInteraction] 刷新事件状态：没有活跃事件');
                        }
                    }
                } catch (error) {
                    console.error('[WorldInteraction] 刷新事件状态失败:', error);
                }
            },
            
            // 初始视图保持大地图，避免开场白闪烁
            currentView: MapViewState.WORLD_MAP,
            setCurrentView: (view: MapViewState) => set({ currentView: view }),
            
            selectedSubscene: null,
            setSelectedSubscene: (subscene) => set({ selectedSubscene: subscene }),
            
            // 场景视图数据
            selectedScene: null,
            setSelectedScene: (scene) => set({ selectedScene: scene }),
            
            // 音乐播放状态（全局共享）
            // 默认开启，让地图在加载到音乐资源后尝试自动播放
            isMusicPlaying: true,
            setMusicPlaying: (playing: boolean) => set({ isMusicPlaying: playing }),
            
            clearState: () => set({
                eventData: null,
                currentView: MapViewState.WORLD_MAP,
                selectedSubscene: null,
                selectedScene: null,
                // 回到默认开启，让重新进入地图时也会尝试自动播放
                isMusicPlaying: true,
            }),
        }),
        {
            name: 'map-galgame-storage',
            // 使用 sessionStorage，页面关闭后自动清除
            storage: createJSONStorage(() => sessionStorage),
            // 持久化视图与子场景，刷新后可恢复上次打开的模块
            partialize: (state) => ({
                currentView: state.currentView,
                selectedSubscene: state.selectedSubscene,
                selectedScene: state.selectedScene,
            }),
        }
    )
);

