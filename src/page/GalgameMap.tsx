// GalgameMap.tsx
import { useEffect, useState, useRef } from "react";
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
import { adaptWorldGameData } from "../api/common/gameDataAdapter";
import type { WorldInteractionGameData } from "../api/worldInteraction/worldInteractionApi.type";
import createWorldSessionApi from "../api/worldInteraction/createWorldSession";
import { buildEventDataFromEvent } from "../utils/eventUtils";

export interface EventData {
    event: GameEvent;
    npc: NPCInfo;
    subscene: SubsceneInfo;
}

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
    } = useMapGalgameStore();
    
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
                try {
                    const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
                    if (activeEventsResponse.data.success) {
                        if (activeEventsResponse.data.events.length > 0) {
                            const eventData = buildEventDataFromEvent(
                                activeEventsResponse.data.events[0],
                                gameData
                            );
                            if (eventData) {
                                setEventData(eventData);
                            }
                        }

                        // ✅ 无论当前是否有活跃事件，只要有历史就至少显示世界地图，避免白屏
                        setCurrentView(MapViewState.WORLD_MAP);
                    }
                } catch (error) {
                    console.error("获取活跃事件失败:", error);
                    // 请求失败时也回到世界地图，避免卡在开场白但不渲染
                    setCurrentView(MapViewState.WORLD_MAP);
                }
            }
        };
        
        loadActiveEventFromHistory();
    }, [worldInteractionHistory, gameData, sessionId, setCurrentView, setEventData]);

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
                const worldFormatData: WorldInteractionGameData = {
                    success: true,
                    fileId: state.fileId,
                    worldSetting: state.worldInfo,
                    npcSetting: {
                        npcs: state.npcs || [],
                    },
                    sceneSetting: {
                        scenes: state.scenes || [],
                    },
                };

                const unifiedData = adaptWorldGameData(worldFormatData);
                setGameData(unifiedData);
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
            }
        } catch (error) {
            console.error("分发事件失败:", error);
            setIsDistributingEvent(false);
        }
    };

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
                const nextEventData = buildEventDataFromEvent(response.data.activeEvents[0], gameData);
                if (nextEventData) {
                    setEventData(nextEventData);
                    setCurrentView(MapViewState.WORLD_MAP);
                }
            } else {
                setCurrentView(MapViewState.WORLD_MAP);
            }
        } catch (error) {
            console.error('开始新回合失败:', error);
        } finally {
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
                                <div className={styles.nextRoundButtonWrapper}>
                                    <button
                                        onClick={handleEndRound}
                                        disabled={isEndingRound}
                                        className={styles.nextRoundButton}
                                    >
                                        {isEndingRound ? '开启下一回合中...' : '开启下一回合'}
                                    </button>
                                </div>
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
                    />
                )}

                {/* NPC交互界面 */}
                {currentView === MapViewState.INTERACT_NPC && (
                    <InteractWithNpc
                        onClose={handleBack}
                        gameData={gameData}
                        onEndRound={handleEndRound}
                        isEndingRound={isEndingRound}
                    />
                )}
            </div>
        </div>
    );
};

export default GalgameMap;