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
    
    isMusicPlaying: boolean;
    setMusicPlaying: (playing: boolean) => void;
    
    clearState: () => void;
}

export const useMapGalgameStore = create<useMapGalgameState>()(
    persist(
        (set, get) => ({
            eventData: null,
            setEventData: (eventData: EventData | null) => set({ eventData }),
            
            // 存储的 sessionId（用于比对）
            storedSessionId: null,
            setStoredSessionId: (sessionId: string | null) => set({ storedSessionId: sessionId }),
            
            // 事件完成标志
            eventCompleted: false,
            setEventCompleted: (completed: boolean) => set({ eventCompleted: completed }),
            
            // NPC 交互页面中的打字机状态
            isTypingInInteractNpc: false,
            setIsTypingInInteractNpc: (typing: boolean) => set({ isTypingInInteractNpc: typing }),
            
            // 刷新事件状态：从后端获取最新活跃事件
            refreshEventData: async (sessionId: string, gameData: any) => {
                try {
                    const state = get();
                    const currentView = state.currentView;
                    const currentEventData = state.eventData;
                    
                    const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
                    if (activeEventsResponse.data.success) {
                        if (activeEventsResponse.data.events.length > 0) {
                            // 有活跃事件：更新 eventData，清除完成标志
                            const newEventData = buildEventDataFromEvent(
                                activeEventsResponse.data.events[0],
                                gameData
                            );
                            if (newEventData) {
                                set({ eventData: newEventData, eventCompleted: false });
                                console.log('[WorldInteraction] 刷新事件状态成功：', newEventData);
                            }
                        } else {
                            // 没有活跃事件
                            // 如果当前在 NPC 交互页面，保留当前的 eventData，避免白屏
                            // 但记录日志，表示事件已完成，等待用户操作
                            if (currentView === MapViewState.INTERACT_NPC && currentEventData) {
                                console.log('[WorldInteraction] 刷新事件状态：没有活跃事件，但保留当前 eventData 以避免白屏（等待用户点击"开始下一回合"）');
                                // 不更新 eventData，不设置 eventCompleted（由 interactWithNpc 组件在打字机完成后设置）
                            } else {
                                // 其他视图：清空 eventData，设置完成标志
                                set({ eventData: null, eventCompleted: true });
                                console.log('[WorldInteraction] 刷新事件状态：没有活跃事件，设置完成标志');
                            }
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
                storedSessionId: null,
                eventCompleted: false,
                isTypingInInteractNpc: false,
                currentView: MapViewState.WORLD_MAP,
                selectedSubscene: null,
                selectedScene: null,
                isMusicPlaying: true,
            }),
        }),
        {
            name: 'map-galgame-storage',
            // 使用 sessionStorage，页面关闭后自动清除
            storage: createJSONStorage(() => sessionStorage),
            // 持久化视图、选中场景 & 事件数据，刷新后可恢复上次进度
            // 同时存储 sessionId 用于比对，确保恢复的数据属于当前会话
            partialize: (state) => ({
                eventData: state.eventData,
                currentView: state.currentView,
                selectedSubscene: state.selectedSubscene,
                selectedScene: state.selectedScene,
                storedSessionId: state.storedSessionId,
            }),
        }
    )
);

