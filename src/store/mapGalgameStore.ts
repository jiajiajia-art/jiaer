import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { EventData } from '../page/GalgameMap';
import type { Scene } from '../api/worldInteraction/mapWorldData.type';

// 视图状态类型
export type MapViewState = 
    | 'story_intro'        // 开场白
    | 'world_map'          // 世界地图
    | 'scene_view'         // 场景视图（显示某个场景的子场景列表）
    | 'subScene_modal'        // 场景详情
    | 'interact_npc_normal'   // 普通NPC交互
    | 'interact_npc_ability';  // 功能性NPC交互

// 视图状态常量
export const MapViewState = {
    STORY_INTRO: 'story_intro' as const,
    WORLD_MAP: 'world_map' as const,
    SCENE_VIEW: 'scene_view' as const,
    SUBSCENE_MODAL: 'subScene_modal' as const,
    INTERACT_NPC_NORMAL: 'interact_npc_normal' as const,
    INTERACT_NPC_ABILITY: 'interact_npc_ability' as const,
};

interface useMapGalgameState {
    eventData: EventData | null;
    setEventData: (eventData: EventData | null) => void;
    
    // 存储的 sessionId（用于比对，确保恢复的数据属于当前会话）
    storedSessionId: string | null;
    setStoredSessionId: (sessionId: string | null) => void;
    
    // 事件完成标志（用于同步显示"开启下一回合"按钮）
    eventCompleted: boolean;
    setEventCompleted: (completed: boolean) => void;
    
    // NPC 交互页面中的打字机状态（用于判断是否可以在 INTERACT_NPC 视图显示按钮）
    isTypingInInteractNpc: boolean;
    setIsTypingInInteractNpc: (typing: boolean) => void;
    
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
    
    // 功能性NPC交互的待处理操作
    pendingAction: { nodeId: string; actionId: string } | null;
    setPendingAction: (action: { nodeId: string; actionId: string } | null) => void;
    
    isMusicPlaying: boolean;
    setMusicPlaying: (playing: boolean) => void;
    
    clearState: () => void;
}

export const useMapGalgameStore = create<useMapGalgameState>()(
    persist(
        (set) => ({
            eventData: null,
            setEventData: (eventData: EventData | null) => set({ eventData }),
            
            // 存储的 sessionId（用于比对）
            storedSessionId: null,
            setStoredSessionId: (sessionId: string | null) => set({ storedSessionId: sessionId }),
            
            eventCompleted: false,
            setEventCompleted: (completed: boolean) => set({ eventCompleted: completed }),
            
            isTypingInInteractNpc: false,
            setIsTypingInInteractNpc: (typing: boolean) => set({ isTypingInInteractNpc: typing }),
            
            currentView: MapViewState.WORLD_MAP,
            setCurrentView: (view: MapViewState) => set({ currentView: view }),
            
            selectedSubscene: null,
            setSelectedSubscene: (subscene) => set({ selectedSubscene: subscene }),
            
            selectedScene: null,
            setSelectedScene: (scene) => set({ selectedScene: scene }),
            
            // 功能性NPC交互的待处理操作
            pendingAction: null,
            setPendingAction: (action) => set({ pendingAction: action }),
            
            // 音乐播放状态（全局共享）
            // 默认开启，让地图在加载到音乐资源后尝试自动播放
            isMusicPlaying: true,
            setMusicPlaying: (playing: boolean) => set({ isMusicPlaying: playing }),
            
            clearState: () => set({
                eventData: null,
                storedSessionId: null,
                eventCompleted: false,
                isTypingInInteractNpc: false,
                currentView: MapViewState.WORLD_MAP,
                selectedSubscene: null,
                selectedScene: null,
                pendingAction: null,
                isMusicPlaying: true,
            }),
        }),
        {
            name: 'map-galgame-storage',
            storage: createJSONStorage(() => sessionStorage),
            // 持久化视图、选中场景 & 事件数据，刷新后可恢复上次进度
            // 同时存储 sessionId 用于比对，确保恢复的数据属于当前会话
            // 注意：pendingAction 不持久化，功能性NPC交互刷新后回到子场景
            partialize: (state) => ({
                eventData: state.eventData,
                currentView: state.currentView === MapViewState.INTERACT_NPC_ABILITY 
                    ? MapViewState.SUBSCENE_MODAL  // 功能性NPC交互不持久化，刷新后回到子场景
                    : state.currentView,
                selectedSubscene: state.selectedSubscene,
                selectedScene: state.selectedScene,
                storedSessionId: state.storedSessionId,
            }),
        }
    )
);

