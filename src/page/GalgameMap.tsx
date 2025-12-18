// GalgameMap.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./GalgameMap.module.css";
import { useGameStore } from "../store/gameStore";
import WorldMapRenderer from "../components/GalgameMap/WorldMapRenderer";
import type { AllGameData } from "../api/worldInteraction/mapWorldData.type";
import StoryIntroModal from "../components/GalgameMap/StoryIntroModal";
import SceneModal from "../components/GalgameMap/SceneModal";
import InteractWithNpc from "../components/GalgameMap/interactWithNpc";
import interactionApi from "../api/worldInteraction/interactionApi";
import type { GameEvent, GetWorldInteractionHistoryResponse, NPCInfo, SubsceneInfo } from "../api/worldInteraction/interactionApi.type";
import { useMapGalgameStore, MapViewState } from "../store/mapGalgameStore";
import createWorldSessionApi from "../api/worldInteraction/createWorldSession";
import { buildEventDataFromEvent } from "../utils/eventUtils";
import statisticsApi from "../api/statistics/statisticsApi";
import { useAuthStore } from "../store/useAuthStore";
import NextRoundButton from "../components/GalgameMap/NextRoundButton";

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
    const { pdfFileId } = useGameStore();
    const [gameData, setGameData] = useState<AllGameData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { sessionId } = useGameStore();
    const [worldInteractionHistory, setWorldInteractionHistory] = useState<GetWorldInteractionHistoryResponse>();
    const { 
        eventData, 
        setEventData, 
        currentView, 
        setCurrentView,
        selectedSubscene,
        setSelectedSubscene,
        refreshEventData,
    } = useMapGalgameStore();
    const { user } = useAuthStore();
    
    const [isDistributingEvent, setIsDistributingEvent] = useState<boolean>(false);
    // 结束回合 / 下一回合加载状态（父组件统一管理）
    const [isEndingRound, setIsEndingRound] = useState<boolean>(false);

    useEffect(() => {
        if (sessionId) {
            fetchWorldInteractionHistory();
        }
    }, [sessionId]);

    // 当历史数据和游戏数据都加载完成后，如果有历史数据就获取之前的旧事件
    useEffect(() => {
        const loadActiveEventFromHistory = async () => {
            if (worldInteractionHistory && worldInteractionHistory.interactions.length > 0 && gameData && sessionId) {
                // 使用统一的刷新方法
                await refreshEventData(sessionId, gameData);
                // ✅ 无论当前是否有活跃事件，只要有历史就至少显示世界地图，避免白屏
                setCurrentView(MapViewState.WORLD_MAP);
            }
        };
        
        loadActiveEventFromHistory();
    }, [worldInteractionHistory, gameData, sessionId, setCurrentView, refreshEventData]);

    // 当历史数据存在且为空时，进入开场白视图
    useEffect(() => {
        if (!sessionId || !gameData) return;
        if (!worldInteractionHistory) return;
        if (worldInteractionHistory.interactions.length === 0) {
            setCurrentView(MapViewState.STORY_INTRO);
        }
    }, [worldInteractionHistory, gameData, sessionId, setCurrentView]);

    useEffect(() => {
        getMapWorldData();
    }, [sessionId]);

    // 确保组件在显示前已经准备好
    useEffect(() => {
        if (currentView !== MapViewState.STORY_INTRO) {
            // 给DOM一个渲染周期的时间
            const timer = setTimeout(() => {
                setIsReady(true);
                // 强制重绘，修复尺寸计算问题
                if (containerRef.current) {
                    const event = new Event('resize');
                    window.dispatchEvent(event);
                }
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
        if (!pdfFileId || !sessionId) {
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
        if (!pdfFileId || !user?.user.id) {
            return;
        }
        try {
            await statisticsApi.addConversion({
                fileId: pdfFileId,
                userId: String(user?.user.id)
            });
        } catch (error) {
            console.error('记录游戏统计失败:', error);
        }
    }, [pdfFileId, user?.user.id]);

    // 结束当前回合 / 开启下一回合（父组件统一方法）
    const handleEndRound = async () => {
        if (!sessionId) {
            console.error('缺少 sessionId');
            return;
        }

        try {
            setIsEndingRound(true);
            const response = await interactionApi.nextRound(sessionId);
            
            if (response.data.success && response.data.activeEvents?.length > 0) {
                // 有新事件：更新本地 eventData
                const nextEventData = buildEventDataFromEvent(response.data.activeEvents[0], gameData);
                if (nextEventData) {
                    setEventData(nextEventData);
                }
            } else {
                // ✅ 没有新事件：清空当前事件，让页面只显示"开启下一回合"按钮
                setEventData(null);
            }
            
            // 刷新历史记录，确保数据同步
            await fetchWorldInteractionHistory();
        } catch (error) {
            console.error('开始新回合失败:', error);
        } finally {
            // 清理场景状态，重置到最外层
            setSelectedSubscene(null);
            // 重置 WorldMapRenderer 的视图栈到最外层
            if (typeof window !== 'undefined') {
                sessionStorage.setItem('worldMapViewStack', JSON.stringify([{ mode: 'mainScenes', scene: null }]));
            }
            // 无论成功与否，都回到世界地图视图；是否有事件由 eventData 是否为空决定
            setCurrentView(MapViewState.WORLD_MAP);
            setIsEndingRound(false);
        }
    };

    // 处理场景点击 - 打开场景模态框
    const handleSceneClick = (subscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    }) => {
        setSelectedSubscene(subscene);
        setCurrentView(MapViewState.SCENE_MODAL);
    };

    // 处理NPC交互 - 打开NPC交互界面
    const handleNpcInteract = () => {
        setCurrentView(MapViewState.INTERACT_NPC);
    };

    // 处理返回
    const handleBack = () => {
        if (currentView === MapViewState.INTERACT_NPC) {
            setCurrentView(MapViewState.SCENE_MODAL);
        } else if (currentView === MapViewState.SCENE_MODAL) {
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
                {/* 世界地图 - 只在非模态框视图时显示 */}
                {currentView === MapViewState.WORLD_MAP && (isReady || true) && (
                    <>
                    <WorldMapRenderer
                        gameData={gameData}
                        isLoading={isLoading}
                        onSceneClick={handleSceneClick}
                        eventData={eventData}
                    />

                        {/* 当存在历史但当前没有活跃任务时，提供“开启下一回合”按钮 */}
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

                {/* 开场白模态框 */}
                {currentView === MapViewState.STORY_INTRO && worldInteractionHistory && worldInteractionHistory.interactions.length === 0 && (
                    <StoryIntroModal
                        isOpen={true}
                        gameData={gameData}
                        onStartGame={handleStartGame}
                        isDistributingEvent={isDistributingEvent}
                    />
                )}

                {/* 场景详情模态框 */}
                {currentView === MapViewState.SCENE_MODAL && selectedSubscene && gameData && (
                    <SceneModal
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
                {currentView === MapViewState.INTERACT_NPC && (
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