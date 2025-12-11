import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventData } from '../page/GalgameMap';

// 视图状态类型
export type MapViewState = 
    | 'story_intro'        // 开场白
    | 'world_map'          // 世界地图
    | 'scene_modal'        // 场景详情
    | 'interact_npc';      // NPC交互

// 视图状态常量
export const MapViewState = {
    STORY_INTRO: 'story_intro' as const,
    WORLD_MAP: 'world_map' as const,
    SCENE_MODAL: 'scene_modal' as const,
    INTERACT_NPC: 'interact_npc' as const,
};

interface useMapGalgameState {
    // 事件数据
    eventData: EventData | null;
    setEventData: (eventData: EventData | null) => void;
    
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
    
    // 清空状态
    clearState: () => void;
}

export const useMapGalgameStore = create<useMapGalgameState>()(
    persist(
        (set) => ({
            eventData: null,
            setEventData: (eventData: EventData | null) => set({ eventData }),
            
            // 初始视图总是开场白，不持久化视图状态
            currentView: MapViewState.STORY_INTRO,
            setCurrentView: (view: MapViewState) => set({ currentView: view }),
            
            selectedSubscene: null,
            setSelectedSubscene: (subscene) => set({ selectedSubscene: subscene }),
            
            clearState: () => set({
                eventData: null,
                currentView: MapViewState.STORY_INTRO,
                selectedSubscene: null,
            }),
        }),
        {
            name: 'map-galgame-storage',
            // 使用 sessionStorage，页面关闭后自动清除
            storage: createJSONStorage(() => sessionStorage),
            // 不持久化任何状态，每次刷新都从开场白开始
            partialize: () => ({}),
        }
    )
);

