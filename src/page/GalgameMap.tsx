// GalgameMap.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./GalgameMap.module.css";
import { useGameStore } from "../store/gameStore";
import WorldMapRenderer from "../components/GalgameMap/WorldMapRenderer";
import SceneView from "../components/GalgameMap/SceneView";
import type { AllGameData, Scene } from "../api/worldInteraction/mapWorldData.type";
import StoryIntroModal from "../components/GalgameMap/StoryIntroModal";
import SubSceneModal from "../components/GalgameMap/SubSceneModal";
import InteractWithNpc from "../components/GalgameMap/interactWithNpc";
import interactionApi from "../api/worldInteraction/interactionApi";
import type { GameEvent, GetWorldInteractionHistoryResponse, NPCInfo, SubsceneInfo } from "../api/worldInteraction/interactionApi.type";
import { useMapGalgameStore, MapViewState } from "../store/mapGalgameStore";
import createWorldSessionApi from "../api/worldInteraction/createWorldSession";
import { buildEventDataFromEvent } from "../utils/eventUtils";
import statisticsApi from "../api/statistics/statisticsApi";
import { useAuthStore } from "../store/useAuthStore";
import NextRoundButton from "../components/GalgameMap/NextRoundButton";
import { useMapMusicPlayer } from "../hooks/mapGalgame/useMapMusicPlayer";
import { mapMusicManager } from "../utils/mapMusicManager";
import { PiMusicNoteDuotone } from "react-icons/pi";

export interface EventData {
    event: GameEvent;
    npc: NPCInfo;
    subscene: SubsceneInfo;
}

// 默认资源（当后端未提供图片时的兜底）
const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;
const DEFAULT_WORLD_MAP_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;

const GalgameMap = () => {
    const { fileId, sessionId } = useGameStore();
    const [gameData, setGameData] = useState<AllGameData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const [worldInteractionHistory, setWorldInteractionHistory] = useState<GetWorldInteractionHistoryResponse>();
    const { 
        eventData, 
        setEventData, 
        currentView, 
        setCurrentView,
        selectedSubscene,
        setSelectedSubscene,
        selectedScene,
        setSelectedScene,
        refreshEventData,
        eventCompleted,
        setEventCompleted,
        isTypingInInteractNpc,
    } = useMapGalgameStore();
    const { user } = useAuthStore();
    
    const [isDistributingEvent, setIsDistributingEvent] = useState<boolean>(false);
    const [isEndingRound, setIsEndingRound] = useState<boolean>(false);
    const hasTriedRestoreEventDataRef = useRef(false); // 标记是否已尝试恢复 eventData，避免重复请求

    const { isMusicPlaying, handleMusicToggle } = useMapMusicPlayer({
        fileId: fileId || null,
        gameData,
        currentView,
        selectedScene,
        selectedSubscene,
        eventData,
    });
    
    useEffect(() => {
        fetchWorldInteractionHistory();
        // 重置恢复标记，因为 sessionId 变化意味着新的会话
        hasTriedRestoreEventDataRef.current = false;
    }, [sessionId]);

    // 组件卸载时清理音乐播放
    useEffect(() => {
        return () => {
            const audio = mapMusicManager.getAudio();
            if (audio) {
                audio.pause();
                audio.src = '';
            }
            mapMusicManager.setAudio(null);
            mapMusicManager.setCurrentMusicUrl(null);
            mapMusicManager.setCurrentMusicId(null);
            mapMusicManager.setIsLoading(false);
            // 重置 Store 中的音乐播放状态
            useMapGalgameStore.getState().setMusicPlaying(false);
        };
    }, []);

    /**
     * 恢复/初始化事件状态
     * 合并原先的两个 useEffect，避免重复调用 getActiveEvents
     */
    useEffect(() => {
        const syncEventState = async () => {
            if (!sessionId || !gameData || !worldInteractionHistory) return;

            const hasHistory = worldInteractionHistory.interactions.length > 0;

            // 1) 有历史记录时：尝试恢复事件
            if (hasHistory) {
                if (!hasTriedRestoreEventDataRef.current) {
                    hasTriedRestoreEventDataRef.current = true;
                    await refreshEventData(sessionId, gameData);

                    // 仅在地图/开场白视图时切回地图，避免覆盖交互中的视图
                    if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                        setCurrentView(MapViewState.WORLD_MAP);
                    }
                }
                return;
            }

            // 2) 无历史且尚未有 eventData，检查活跃事件或进入开场白
            if (eventData) return;

            // 交互/场景内视图说明是 sessionStorage 恢复，不强制重置
            if (currentView === MapViewState.INTERACT_NPC || 
                currentView === MapViewState.SUBSCENE_MODAL || 
                currentView === MapViewState.SCENE_VIEW) {
                return;
            }

            try {
                const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
                const activeEvents = activeEventsResponse.data.success ? activeEventsResponse.data.events : [];
                const hasActiveEvent = Array.isArray(activeEvents) && activeEvents.length > 0;

                if (hasActiveEvent) {
                    const nextEventData = buildEventDataFromEvent(activeEvents[0], gameData);
                    if (nextEventData) {
                        setEventData(nextEventData);
                    }
                    if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                        setCurrentView(MapViewState.WORLD_MAP);
                    }
                } else {
                    if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                        setCurrentView(MapViewState.STORY_INTRO);
                    }
                }
            } catch (error) {
                console.error('检查活跃事件失败:', error);
                if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                    setCurrentView(MapViewState.WORLD_MAP);
                }
            }
        };

        syncEventState();
    }, [worldInteractionHistory, gameData, sessionId, currentView, eventData, refreshEventData, setCurrentView, setEventData]);

    useEffect(() => {
        getMapWorldData();
    }, [sessionId]);

    // 确保组件在显示前已经准备好，强制重绘修复尺寸计算问题
    useEffect(() => {
        if (currentView !== MapViewState.STORY_INTRO && containerRef.current) {
            const timer = setTimeout(() => {
                // 强制重绘，修复尺寸计算问题
                const event = new Event('resize');
                window.dispatchEvent(event);
            }, 50);

            return () => clearTimeout(timer);
        }
    }, [currentView]);

    const getMapWorldData = async () => {
        if (!sessionId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            const response = await createWorldSessionApi.getWorldFilesBySession(sessionId);
            if (response.data?.success && response.data.state) {
                const state = response.data.state;

                const normalizeImage = (img?: string | null): string | null => {
                    if (!img) return null;
                    const trimmed = String(img).trim();
                    if (!trimmed || trimmed === "null" || trimmed === "undefined") {
                        return null;
                    }
                    return trimmed;
                };

                // 处理世界设定里的世界地图 & 玩家立绘
                const worldMapImage =
                    normalizeImage(state.worldInfo?.worldMapImage) || DEFAULT_WORLD_MAP_IMAGE;

                const player = state.worldInfo?.player;
                const playerImagePath =
                    normalizeImage(player?.imagePath) || DEFAULT_NPC_IMAGE;

                // 处理 NPC 列表，确保 base 立绘有默认图
                const safeNpcs = (state.npcs || []).map((npc: any) => {
                    const rawBase = npc?.images?.base as string | undefined;
                    const base = normalizeImage(rawBase) || DEFAULT_NPC_IMAGE;
                    return {
                        ...npc,
                        images: {
                            ...npc.images,
                            base,
                        },
                    };
                });

                // 处理场景与子场景背景图，缺失时使用默认背景
                const safeScenes = (state.scenes || []).map((scene: any) => {
                    const sceneImage = normalizeImage(scene.image) || DEFAULT_SCENE_IMAGE;
                    const safeSubscenes = (scene.subscenes || []).map((sub: any) => {
                        const subImage = normalizeImage(sub.image) || DEFAULT_WORLD_MAP_IMAGE;
                        return {
                            ...sub,
                            image: subImage,
                        };
                    });
                    return {
                        ...scene,
                        image: sceneImage,
                        subscenes: safeSubscenes,
                    };
                });

                const worldFormatData: AllGameData = {
                    success: true,
                    fileId: state.fileId,
                    worldSetting: {
                        ...state.worldInfo,
                        worldMapImage,
                        player: {
                            ...state.worldInfo.player,
                            imagePath: playerImagePath,
                        },
                    },
                    npcSetting: {
                        npcs: safeNpcs,
                    },
                    sceneSetting: {
                        scenes: safeScenes,
                    },
                };

                // 游戏文件直接使用 AllGameData（worldInteraction 模式的独立类型）
                setGameData(worldFormatData);
                console.log('获取地图世界数据成功');
            }
        } catch (error) {
            console.error("获取地图世界数据失败:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async () => {
        if (!fileId || !sessionId) {
            console.log('缺少 fileId 或 sessionId');
            return;
        }
        try {
            setIsDistributingEvent(true);
            // 清理旧的事件数据，开始新游戏
            setEventData(null);
            setSelectedSubscene(null);
            
            const response = await interactionApi.distributeEvent({
                sessionId: sessionId
            });
            if (response.data.success) {
                console.log(response.data);
                setEventData({
                    event: response.data.event,
                    npc: response.data.npc,
                    subscene: response.data.subscene,
                });
                setCurrentView(MapViewState.WORLD_MAP);
                addConversion();
            }
        } catch (error) {
            console.error("分发事件失败:", error);
            setIsDistributingEvent(false);
        }
    };

    const addConversion = useCallback(async () => {
        if (!fileId || !user?.user.id) {
            return;
        }
        try {
            await statisticsApi.addConversion({
                fileId: fileId,
                userId: String(user?.user.id)
            });
        } catch (error) {
            console.error('记录游戏统计失败:', error);
        }
    }, [fileId, user?.user.id]);

    const handleEndRound = async () => {
        if (!sessionId || !gameData) {
            console.error('缺少 sessionId 或 gameData');
            return;
        }

        try {
            setIsEndingRound(true);
            // 清除事件完成标志
            setEventCompleted(false);
            const response = await interactionApi.nextRound(sessionId);
            
            // 刷新历史记录，确保数据同步
            await fetchWorldInteractionHistory();
            
            // 只有成功分发新事件时，才更新状态并切换视图
            if (response.data.success && response.data.activeEvents?.length > 0) {
                const nextEventData = buildEventDataFromEvent(response.data.activeEvents[0], gameData);
                if (nextEventData) {
                    setEventData(nextEventData);
                    // 清理场景状态，切换到世界地图视图
                    setSelectedSubscene(null);
                    setSelectedScene(null);
                    setCurrentView(MapViewState.WORLD_MAP);
                }
            }
            // 如果没有新事件（activeEvents 为空），保持当前视图和状态，不强制切换，避免白屏
        } catch (error) {
            console.error('开始新回合失败:', error);
        } finally {
            setIsEndingRound(false);
        }
    };

    // 处理世界地图上的场景点击 - 如果有子场景则显示场景视图，否则直接打开场景模态框
    const handleWorldMapSceneClick = (scene: Scene) => {
        if (scene.subscenes && scene.subscenes.length > 0) {
            // 有子场景，显示场景视图
            setSelectedScene(scene);
            setCurrentView(MapViewState.SCENE_VIEW);
        } else {
            // 没有子场景，直接打开场景模态框（使用第一个子场景或创建虚拟子场景）
            // 这种情况应该不会发生，因为通常场景都有子场景
            console.warn('场景没有子场景，无法打开场景视图');
        }
    };

    // 处理场景视图中的子场景点击 - 打开场景模态框
    const handleSceneViewSubsceneClick = (subscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    }) => {
        setSelectedSubscene(subscene);
        setCurrentView(MapViewState.SUBSCENE_MODAL);
        // 关闭场景视图，回到世界地图
        setSelectedScene(null);
    };

    // 从场景视图返回世界地图
    const handleSceneViewBack = () => {
        setSelectedScene(null);
        setCurrentView(MapViewState.WORLD_MAP);
    };

    // 处理NPC交互 - 打开NPC交互界面
    const handleNpcInteract = () => {
        setCurrentView(MapViewState.INTERACT_NPC);
    };

    // 处理返回
    const handleBack = () => {
        if (currentView === MapViewState.INTERACT_NPC) {
            setCurrentView(MapViewState.SUBSCENE_MODAL);
        } else if (currentView === MapViewState.SUBSCENE_MODAL) {
            setCurrentView(MapViewState.WORLD_MAP);
        }
    };

    const fetchWorldInteractionHistory = async () => {
        if (!sessionId) {
            return;
        }
        try{
            const response = await interactionApi.getWorldInteractionHistory(sessionId);
            if (response.data.success) {
                setWorldInteractionHistory(response.data);
                console.log("获取历史记录成功", response.data);
            }
        } catch (error) {
            console.error("获取历史记录失败:", error);
        }
    };

    return (
        <div className={styles.page} ref={containerRef}>
            <div className={styles.mapContainer}>
                {/* 音乐控制按钮 - 在非 NPC 交互视图中显示 */}
                {gameData && currentView !== MapViewState.INTERACT_NPC && (
                    <div
                        className={styles.musicToggleBtn}
                        onClick={handleMusicToggle}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                        }}
                    >
                        <PiMusicNoteDuotone 
                            size={20} 
                            style={{ 
                                color: isMusicPlaying ? '#4CAF50' : '#fff',
                                transition: 'color 0.3s',
                            }} 
                        />
                        <span style={{ fontSize: '14px' }}>音乐</span>
                    </div>
                )}

                {/* 世界地图 - 只在世界地图视图时显示 */}
                {currentView === MapViewState.WORLD_MAP && gameData && (
                    <>
                        <WorldMapRenderer
                            gameData={gameData}
                            isLoading={isLoading}
                            onSceneClick={handleWorldMapSceneClick}
                            eventData={eventData}
                        />

                        {/* 当事件已完成（没有活跃事件或 eventCompleted 标志为 true）时，提供"开启下一回合"按钮 */}
                        {(() => {
                            const shouldShow = (!eventData || eventCompleted) && !isLoading;
                            return shouldShow;
                        })() && (
                                <NextRoundButton
                                    onClick={handleEndRound}
                                    disabled={isEndingRound}
                                    isLoading={isEndingRound}
                                />
                            )}
                    </>
                )}

                {/* 场景视图 - 显示选中场景的子场景列表 */}
                {currentView === MapViewState.SCENE_VIEW && selectedScene && (
                    <SceneView
                        selectedScene={selectedScene}
                        eventData={eventData}
                        onSubsceneClick={handleSceneViewSubsceneClick}
                        onBack={handleSceneViewBack}
                    />
                )}

                {/* 开场白模态框 */}
                {currentView === MapViewState.STORY_INTRO && worldInteractionHistory && worldInteractionHistory.interactions.length === 0 && !eventData && (
                    <StoryIntroModal
                        isOpen={true}
                        gameData={gameData}
                        onStartGame={handleStartGame}
                        isDistributingEvent={isDistributingEvent}
                    />
                )}

                {/* 场景详情模态框 */}
                {currentView === MapViewState.SUBSCENE_MODAL && selectedSubscene && gameData && (
                    <SubSceneModal
                        subsceneData={selectedSubscene}
                        gameData={gameData}
                        onBack={handleBack}
                        onNpcInteract={handleNpcInteract}
                    />
                )}

                {currentView === MapViewState.INTERACT_NPC && (
                    eventData && gameData  &&
                        <InteractWithNpc
                            onClose={handleBack}
                            gameData={gameData}
                            worldInteractionHistory={worldInteractionHistory ?? null}
                        />
                )}

                {(() => {
                    // 基础条件：事件已完成（没有 eventData 或 eventCompleted 为 true）
                    const baseCondition = (!eventData || eventCompleted) && !isLoading;
                    
                    const shouldShow = baseCondition && 
                        (currentView !== MapViewState.INTERACT_NPC || (eventCompleted && !isTypingInInteractNpc));
                    return shouldShow;
                })() && (
                    <NextRoundButton
                        onClick={handleEndRound}
                        disabled={isEndingRound}
                        isLoading={isEndingRound}
                    />
                )}
            </div>
        </div>
    );
};

export default GalgameMap;