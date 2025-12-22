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

    // 当历史数据和游戏数据都加载完成后，如果有历史数据就获取之前的旧事件
    useEffect(() => {
        const loadActiveEventFromHistory = async () => {
            if (!worldInteractionHistory || !gameData || !sessionId) return;
            if (worldInteractionHistory.interactions.length === 0) return;
            
            // 如果是 WORLD_MAP 或 STORY_INTRO 视图，恢复事件数据并切换到 WORLD_MAP
            if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                if (!hasTriedRestoreEventDataRef.current) {
                    hasTriedRestoreEventDataRef.current = true;
            await refreshEventData(sessionId, gameData);
            setCurrentView(MapViewState.WORLD_MAP);
                }
            }

            else if ((currentView === MapViewState.INTERACT_NPC || 
                     currentView === MapViewState.SUBSCENE_MODAL || 
                     currentView === MapViewState.SCENE_VIEW) && 
                     !eventData && 
                     !hasTriedRestoreEventDataRef.current) {
                hasTriedRestoreEventDataRef.current = true;
                await refreshEventData(sessionId, gameData);
            }
        };
        
        loadActiveEventFromHistory();
    }, [worldInteractionHistory, gameData, sessionId, currentView, setCurrentView, refreshEventData]);

    // 当历史数据存在且为空时，检查是否有活跃事件，如果没有才进入开场白视图
    // 注意：如果当前视图是 INTERACT_NPC 或 SUBSCENE_MODAL，说明是从历史恢复的，不执行此逻辑
    useEffect(() => {
        const checkAndSetStoryIntro = async () => {
            if (!sessionId || !gameData) return;
            if (!worldInteractionHistory) return;
            if (eventData) return;
            
            // 如果当前视图是 INTERACT_NPC、SUBSCENE_MODAL 或 SCENE_VIEW，说明是从 sessionStorage 恢复的
            // 此时应该由 loadActiveEventFromHistory 来处理 eventData 的恢复，不执行开场白逻辑
            if (currentView === MapViewState.INTERACT_NPC || 
                currentView === MapViewState.SUBSCENE_MODAL || 
                currentView === MapViewState.SCENE_VIEW) {
                return;
            }
            
            // 只有"无历史"且"无活跃事件"时才显示开场白
            const hasHistory = worldInteractionHistory.interactions.length > 0;
            try {
                const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
                const activeEvents = activeEventsResponse.data.success ? activeEventsResponse.data.events : [];
                const hasActiveEvent = Array.isArray(activeEvents) && activeEvents.length > 0;

                if (!hasHistory && !hasActiveEvent) {
                    // 仅在当前视图为地图/开场白时才切换，避免覆盖用户刷新前的视图
                    if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                        setCurrentView(MapViewState.STORY_INTRO);
                    }
                } else {
                    // 有历史或有活跃事件，直接进入大地图；若有活跃事件则预先填充
                    if (hasActiveEvent) {
                        const nextEventData = buildEventDataFromEvent(activeEvents[0], gameData);
                        if (nextEventData) {
                            setEventData(nextEventData);
                        }
                    }
                    if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                        setCurrentView(MapViewState.WORLD_MAP);
                    }
                }
            } catch (error) {
                console.error('检查活跃事件失败:', error);
                if (currentView === MapViewState.WORLD_MAP || currentView === MapViewState.STORY_INTRO) {
                    setCurrentView(MapViewState.WORLD_MAP);
                }
            }
        };
        
        checkAndSetStoryIntro();
    }, [worldInteractionHistory, gameData, sessionId, currentView, setCurrentView, eventData, setEventData]);

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

    // 结束当前回合 / 开启下一回合
    const handleEndRound = async () => {
        if (!sessionId) {
            console.error('缺少 sessionId');
            return;
        }

        try {
            setIsEndingRound(true);
            const response = await interactionApi.nextRound(sessionId);
            
            if (response.data.success && response.data.activeEvents?.length > 0) {
                const nextEventData = buildEventDataFromEvent(response.data.activeEvents[0], gameData);
                if (nextEventData) {
                    setEventData(nextEventData);
                }
            } else {
                setEventData(null);
            }
            
            // 刷新历史记录，确保数据同步
            await fetchWorldInteractionHistory();
        } catch (error) {
            console.error('开始新回合失败:', error);
        } finally {
            // 清理场景状态，重置到最外层
            setSelectedSubscene(null);
            setSelectedScene(null);
            // 无论成功与否，都回到世界地图视图；是否有事件由 eventData 是否为空决定
            setCurrentView(MapViewState.WORLD_MAP);
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

                        {/* 当存在历史但当前没有活跃任务时，提供"开启下一回合"按钮 */}
                        {worldInteractionHistory
                            && worldInteractionHistory.interactions.length > 0
                            && !eventData
                            && !isLoading && (
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
                        onEndRound={handleEndRound}
                        isEndingRound={isEndingRound}
                        worldInteractionHistory={worldInteractionHistory ?? null}
                    />
                )}

                {/* NPC交互界面 */}
                {/* 只有当 eventData 存在时才渲染，确保组件初始化时有正确的 eventId 来恢复未完成的步骤 */}
                {currentView === MapViewState.INTERACT_NPC && eventData && (
                    <InteractWithNpc
                        onClose={handleBack}
                        gameData={gameData}
                        onEndRound={handleEndRound}
                        isEndingRound={isEndingRound}
                        worldInteractionHistory={worldInteractionHistory ?? null}
                    />
                )}
            </div>
        </div>
    );
};

export default GalgameMap;