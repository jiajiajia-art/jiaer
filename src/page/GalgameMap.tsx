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
import type { GameEvent, NPCInfo, SubsceneInfo } from "../api/worldInteraction/interactionApi.type";
import { useMapGalgameStore, MapViewState } from "../store/mapGalgameStore";
import { adaptWorldGameData } from "../api/common/gameDataAdapter";
import type { WorldInteractionGameData } from "../api/worldInteraction/worldInteractionApi.type";
import createWorldSessionApi from "../api/worldInteraction/createWorldSession";

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
    const { 
        eventData, 
        setEventData, 
        currentView, 
        setCurrentView,
        selectedSubscene,
        setSelectedSubscene,
        clearState
    } = useMapGalgameStore();
    
    // 组件挂载时，如果有旧的事件数据，清理它并重置到开场白
    useEffect(() => {
        if (eventData) {
            // 如果有旧的事件数据，清理它，确保从开场白开始
            clearState();
        }
    }, []); // 只在组件挂载时执行一次
    const [isDistributingEvent, setIsDistributingEvent] = useState<boolean>(false);

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
                    worldSetting: {
                        title: state.worldInfo?.title || '',
                        summary: state.worldInfo?.summary || '',
                        background: state.worldInfo?.summary || '',
                        Theme: state.worldInfo?.themes || [],
                        preamble: '',
                        initialPlot: '',
                        literary: '',
                        keyEvents: state.currentKeyEvent ? [state.currentKeyEvent] : [],
                        Player: {
                            name: state.player?.name || '',
                            age: state.player?.age || 0,
                            gender: state.player?.gender || '',
                            personality: state.player?.personality || '',
                            appearance: state.player?.appearance || '',
                            tone: state.player?.tone || '',
                            imagePath: state.player?.imagePath || '',
                        },
                        worldMapImage: state.worldInfo?.image || '',
                    },
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

    return (
        <div className={styles.page} ref={containerRef}>
            <div className={styles.mapContainer}>
                {/* 世界地图 - 只在非模态框视图时显示 */}
                {currentView === MapViewState.WORLD_MAP && (isReady || true) && (
                    <WorldMapRenderer
                        gameData={gameData}
                        isLoading={isLoading}
                        onSceneClick={handleSceneClick}
                        eventData={eventData}
                    />
                )}

                {/* 开场白模态框 */}
                {currentView === MapViewState.STORY_INTRO && (
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
                {currentView === MapViewState.INTERACT_NPC && gameData && (
                    <InteractWithNpc 
                        gameData={gameData}
                        onClose={handleBack}
                     />
                )}
            </div>
        </div>
    );
};

export default GalgameMap;