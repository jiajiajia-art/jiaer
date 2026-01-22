// GalgameMap.tsx
import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./GalgameMap.module.css";
import { useGameStore } from "../store/gameStore";
import WorldMapRenderer from "../components/GalgameMap/WorldMapRenderer";
import SceneView from "../components/GalgameMap/SceneView";
import type {
  AllGameData,
  Scene,
} from "../api/worldInteraction/mapWorldData.type";
import StoryIntroModal from "../components/GalgameMap/Modal/StoryIntroModal";
import SubSceneModal from "../components/GalgameMap/SubSceneModal";
import InteractWithNpcModal from "../components/GalgameMap/interaction/InteractWithNpcModal";
import interactionApi from "../api/worldInteraction/interactionApi";
import type {
  GameEvent,
  GetWorldInteractionHistoryResponse,
  NPCInfo,
  SubsceneInfo,
} from "../api/worldInteraction/interactionApi.type";
import { useMapGalgameStore, MapViewState } from "../store/mapGalgameStore";
import createWorldSessionApi from "../api/worldInteraction/createWorldSession";
import { buildEventDataFromEvent } from "../utils/eventUtils";
import statisticsApi from "../api/statistics/statisticsApi";
import { useAuthStore } from "../store/useAuthStore";
import NextRoundButton from "../components/GalgameMap/NextRoundButton";
import { useMapMusicPlayer } from "../hooks/mapGalgame/common/useMapMusicPlayer";
import { mapMusicManager } from "../utils/mapMusicManager";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { MdOutlinePerson } from "react-icons/md";
import FullPageLoading from "../components/Skeleton/FullPageLoading";
import { getImageUrl, getPlayerImageUrl } from "../utils/constants";
import { useRefreshEventData } from "../hooks/mapGalgame/common/useRefreshEventData";
import worldEditor from "../api/worldInteraction/worldEditor";
import Attributes from "../components/GalgameMap/Plugin/Attributes";

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
  const [worldInteractionHistory, setWorldInteractionHistory] =
    useState<GetWorldInteractionHistoryResponse>();
  const {
    eventData,
    setEventData,
    currentView,
    setCurrentView,
    selectedSubscene,
    setSelectedSubscene,
    selectedScene,
    setSelectedScene,
    eventCompleted,
    setEventCompleted,
    setStoredSessionId,
    clearState,
    pendingAction,
  } = useMapGalgameStore();
  const { user } = useAuthStore();
  const { refreshEventData } = useRefreshEventData();

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

  // Player属性面板状态
  const [isPlayerAttributesVisible, setIsPlayerAttributesVisible] = useState(false);

  // 当 sessionId 变化时，检查存储的 sessionId 是否匹配
  useEffect(() => {
    if (sessionId) {
      const currentStored = useMapGalgameStore.getState().storedSessionId;
      if (currentStored && currentStored !== sessionId) {
        console.log("[WorldInteraction] sessionId 不匹配，清除旧存储数据", {
          stored: currentStored,
          current: sessionId,
        });
        clearState();
      }
      setStoredSessionId(sessionId);
    } else {
      clearState();
    }
  }, [sessionId, setStoredSessionId, clearState]);

  // 页面加载时，如果当前视图是功能性NPC交互，清除 pendingAction 并返回子场景
  // 功能性NPC交互不保存状态，刷新后回到子场景
  useEffect(() => {
    const { setPendingAction, setCurrentView, selectedSubscene } = useMapGalgameStore.getState();
    if (currentView === MapViewState.INTERACT_NPC_ABILITY) {
      setPendingAction(null);
      // 如果有选中的子场景，回到子场景；否则回到世界地图
      if (selectedSubscene) {
        setCurrentView(MapViewState.SUBSCENE_MODAL);
      } else {
        setCurrentView(MapViewState.WORLD_MAP);
      }
    }
  }, []); // 只在组件挂载时执行一次

  const fetchWorldInteractionHistory = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    try {
      const response = await interactionApi.getWorldInteractionHistory(
        sessionId
      );
      if (response.data.success) {
        setWorldInteractionHistory(response.data);
        console.log("获取历史记录成功", response.data);
      }
    } catch (error) {
      console.error("获取历史记录失败:", error);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchWorldInteractionHistory();
    // 重置恢复标记，因为 sessionId 变化意味着新的会话
    hasTriedRestoreEventDataRef.current = false;
  }, [fetchWorldInteractionHistory]);

  // 当从 NPC 交互返回首页时，刷新历史记录，避免因为历史记录未更新而错误显示开场白
  const prevViewRef = useRef<MapViewState | null>(null);
  useEffect(() => {
    if (
      (prevViewRef.current === MapViewState.INTERACT_NPC_NORMAL || 
       prevViewRef.current === MapViewState.INTERACT_NPC_ABILITY) &&
      currentView === MapViewState.WORLD_MAP
    ) {
      // 从交互返回首页，刷新历史记录
      fetchWorldInteractionHistory();
    }
    prevViewRef.current = currentView;
  }, [currentView, fetchWorldInteractionHistory]);

  // 兜底：避免 currentView 与依赖数据（selectedSubscene/selectedScene/gameData）不同步导致“没有任何主视图渲染”的假白屏
  useEffect(() => {
    const validViews: MapViewState[] = [
      MapViewState.STORY_INTRO,
      MapViewState.WORLD_MAP,
      MapViewState.SCENE_VIEW,
      MapViewState.SUBSCENE_MODAL,
      MapViewState.INTERACT_NPC_NORMAL,
      MapViewState.INTERACT_NPC_ABILITY,
    ];

    // currentView 不合法：回到世界地图
    if (!validViews.includes(currentView)) {
      setCurrentView(MapViewState.WORLD_MAP);
      return;
    }

    // 需要依赖场景数据的视图，如果数据缺失则回到世界地图
    if (currentView === MapViewState.SCENE_VIEW && !selectedScene) {
      setCurrentView(MapViewState.WORLD_MAP);
      return;
    }
    if (
      (currentView === MapViewState.SUBSCENE_MODAL ||
        currentView === MapViewState.INTERACT_NPC_NORMAL ||
        currentView === MapViewState.INTERACT_NPC_ABILITY) &&
      !selectedSubscene
    ) {
      setCurrentView(MapViewState.WORLD_MAP);
      return;
    }

    // WORLD_MAP 依赖 gameData：如果 gameData 还没加载，外层会显示 FullPageLoading，不需要额外处理
  }, [currentView, selectedScene, selectedSubscene, setCurrentView]);

  // 组件卸载时清理音乐播放
  useEffect(() => {
    return () => {
      const audio = mapMusicManager.getAudio();
      if (audio) {
        audio.pause();
        audio.src = "";
      }
      mapMusicManager.setAudio(null);
      mapMusicManager.setCurrentMusicUrl(null);
      mapMusicManager.setCurrentMusicId(null);
      mapMusicManager.setIsLoading(false);
      useMapGalgameStore.getState().setMusicPlaying(false);
    };
  }, []);

  /**
   * 恢复/初始化事件状态
   * 合并原先的两个 useEffect，避免重复调用 getActiveEvents
   */
  useEffect(() => {
    let cancelled = false;

    const syncEventState = async () => {
      if (!sessionId || !gameData || !worldInteractionHistory) return;

      const hasHistory = worldInteractionHistory.interactions.length > 0;
      const currentStoredSessionId =
        useMapGalgameStore.getState().storedSessionId;

      // 检查存储的 sessionId 是否匹配当前 sessionId，不匹配则清除状态
      if (currentStoredSessionId && currentStoredSessionId !== sessionId) {
        console.log(
          "[WorldInteraction] 存储的 sessionId 与当前 sessionId 不匹配，清除状态",
          { stored: currentStoredSessionId, current: sessionId }
        );
        clearState();
        return;
      }

      // 1) 有历史记录时：尝试恢复事件
      if (hasHistory) {
        if (!hasTriedRestoreEventDataRef.current) {
          hasTriedRestoreEventDataRef.current = true;
          await refreshEventData(sessionId, gameData);
          if (cancelled) return;

          if (
            currentView === MapViewState.WORLD_MAP ||
            currentView === MapViewState.STORY_INTRO
          ) {
            setCurrentView(MapViewState.WORLD_MAP);
          }
        }
        return;
      }

      // 2) 无历史且尚未有 eventData，检查活跃事件或进入开场白
      if (eventData) return;

      // 检查存储的 sessionId 是否匹配当前 sessionId，不匹配则不恢复
      if (currentStoredSessionId !== sessionId) {
        console.log(
          "[WorldInteraction] 存储的 sessionId 与当前 sessionId 不匹配，不恢复数据",
          { stored: currentStoredSessionId, current: sessionId }
        );
        return;
      }

      // 交互/场景内视图说明是 sessionStorage 恢复，不强制重置
      if (
        currentView === MapViewState.INTERACT_NPC_NORMAL ||
        currentView === MapViewState.INTERACT_NPC_ABILITY ||
        currentView === MapViewState.SUBSCENE_MODAL ||
        currentView === MapViewState.SCENE_VIEW
      ) {
        return;
      }

      try {
        const activeEventsResponse = await interactionApi.getActiveEvents(
          sessionId
        );
        if (cancelled) return;

        const activeEvents = activeEventsResponse.data.success
          ? activeEventsResponse.data.events
          : [];
        const hasActiveEvent =
          Array.isArray(activeEvents) && activeEvents.length > 0;

        if (hasActiveEvent) {
          const nextEventData = buildEventDataFromEvent(
            activeEvents[0],
            gameData
          );
          if (nextEventData) {
            setEventData(nextEventData);
          }
          if (
            currentView === MapViewState.WORLD_MAP ||
            currentView === MapViewState.STORY_INTRO
          ) {
            setCurrentView(MapViewState.WORLD_MAP);
          }
        } else {
          if (
            currentView === MapViewState.WORLD_MAP ||
            currentView === MapViewState.STORY_INTRO
          ) {
            setCurrentView(MapViewState.STORY_INTRO);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("检查活跃事件失败:", error);
          if (
            currentView === MapViewState.WORLD_MAP ||
            currentView === MapViewState.STORY_INTRO
          ) {
            setCurrentView(MapViewState.WORLD_MAP);
          }
        }
      }
    };

    syncEventState();

    return () => {
      cancelled = true;
    };
  }, [
    worldInteractionHistory,
    gameData,
    sessionId,
    currentView,
    eventData,
    refreshEventData,
    setCurrentView,
    setEventData,
    clearState,
  ]);

  const getMapWorldData = useCallback(async () => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await createWorldSessionApi.getWorldFilesBySession(
        sessionId
      );
      if (response.data?.success && response.data.state) {
        const state = response.data.state;

        const processImage = (
          img: string | null | undefined,
          defaultImg: string
        ): string => {
          if (!img) return defaultImg;
          const trimmed = String(img).trim();
          if (!trimmed || trimmed === "null" || trimmed === "undefined") {
            return defaultImg;
          }
          if (
            trimmed.includes("defaultScene.png") ||
            trimmed.includes("defaultNpc.png") ||
            trimmed.includes("defaultMap.png")
          ) {
            return trimmed;
          }
          return getImageUrl(trimmed);
        };

        const worldMapImage = processImage(
          state.worldInfo?.worldMapImage,
          DEFAULT_WORLD_MAP_IMAGE
        );
        const playerImagePath = processImage(
          getPlayerImageUrl(state.worldInfo?.player, DEFAULT_NPC_IMAGE),
          DEFAULT_NPC_IMAGE
        );

        const safeNpcs = (state.npcs || []).map((npc: any) => ({
          ...npc,
          images: {
            ...npc.images,
            base: processImage(npc?.images?.base, DEFAULT_NPC_IMAGE),
          },
        }));

        const safeScenes = (state.scenes || []).map((scene: any) => ({
          ...scene,
          image: processImage(scene.image, DEFAULT_SCENE_IMAGE),
          subscenes: (scene.subscenes || []).map((sub: any) => ({
            ...sub,
            image: processImage(sub.image, DEFAULT_WORLD_MAP_IMAGE),
          })),
        }));

        const worldFormatData: AllGameData = {
          success: true,
          fileId: state.fileId,
          worldSetting: {
            ...state.worldInfo,
            worldMapImage,
            player: {
              ...state.worldInfo.player,
              images: playerImagePath,
            },
          },
          npcSetting: {
            npcs: safeNpcs,
          },
          sceneSetting: {
            scenes: safeScenes,
          },
          abilityNodeSetting: state.abilityNodes
            ? {
                abilityNodes: state.abilityNodes,
              }
            : undefined,
        };

        setGameData(worldFormatData);
        console.log("获取地图世界数据成功");
      }
    } catch (error) {
      console.error("获取地图世界数据失败:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    getMapWorldData();
  }, [getMapWorldData]);

  // 确保组件在显示前已经准备好，强制重绘修复尺寸计算问题
  useEffect(() => {
    if (currentView !== MapViewState.STORY_INTRO && containerRef.current) {
      const timer = setTimeout(() => {
        // 强制重绘，修复尺寸计算问题
        const event = new Event("resize");
        window.dispatchEvent(event);
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [currentView]);

  const handleStartGame = async () => {
    if (!fileId || !sessionId) {
      console.log("缺少 fileId 或 sessionId");
      return;
    }
    try {
      setIsDistributingEvent(true);
      // 清理旧的事件数据，开始新游戏
      setEventData(null);
      setSelectedSubscene(null);

      const response = await interactionApi.distributeEvent({
        sessionId: sessionId,
      });
      if (response.data.success) {
        setEventData({
          event: response.data.event,
          npc: response.data.npc,
          subscene: response.data.subscene,
        });
        setCurrentView(MapViewState.WORLD_MAP);
        addConversion();
      }
    } catch (error: any) {
      const errorMessage =
      error.response.data.error || "分发事件失败，请稍后重试";
      alert("分发事件失败: " + errorMessage);
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
        userId: String(user?.user.id),
      });
    } catch (error) {
      console.error("记录游戏统计失败:", error);
    }
  }, [fileId, user?.user.id]);

  /**
   * 更新游戏属性（player 和所有 NPC）
   * 在每次交互完成后调用，确保属性值是最新的
   */
  const updateGameAttributes = useCallback(async () => {
    if (!sessionId || !gameData) {
      return;
    }

    try {
      const response = await worldEditor.getAttributes(sessionId);

      if (response.data.success) {
        const { player, npcs } = response.data;

        // 更新 gameData 中的 player 和 npcs
        setGameData((prevData) => {
          if (!prevData) return prevData;

          // 更新 player 属性（如果存在）
          const updatedPlayer = player
            ? {
                ...prevData.worldSetting.player,
                ...player, // 覆盖属性值
              }
            : prevData.worldSetting.player;

          // 更新所有 NPC 的属性（如果 npcs 存在）
          const updatedNpcs =
            npcs && Array.isArray(npcs)
              ? prevData.npcSetting.npcs.map((existingNpc) => {
                  const updatedNpc = npcs.find(
                    (n: any) => n.id === existingNpc.id
                  );
                  if (updatedNpc) {
                    return {
                      ...existingNpc,
                      ...updatedNpc, // 覆盖属性值
                    };
                  }
                  return existingNpc;
                })
              : prevData.npcSetting.npcs;

          return {
            ...prevData,
            worldSetting: {
              ...prevData.worldSetting,
              player: updatedPlayer,
            },
            npcSetting: {
              ...prevData.npcSetting,
              npcs: updatedNpcs,
            },
          };
        });
      }
    } catch (error) {
      console.error("[GalgameMap] ❌ 更新属性失败:", error);
    }
  }, [sessionId, gameData]);

  const handleEndRound = async () => {
    if (!sessionId || !gameData) {
      console.error("缺少 sessionId 或 gameData");
      return;
    }

    try {
      setIsEndingRound(true);
      setEventCompleted(false);

      const response = await interactionApi.nextRound(sessionId);
      await fetchWorldInteractionHistory();

      if (response.data.success) {
        // 先刷新事件数据，确保获取到最新状态
        await refreshEventData(sessionId, gameData);

        const { eventData: updatedEventData } = useMapGalgameStore.getState();
        if (updatedEventData) {
          setEventCompleted(false);
        }
        setSelectedSubscene(null);
        setSelectedScene(null);
        setCurrentView(MapViewState.WORLD_MAP);
      }
    } catch (error) {
      console.error("开始新回合失败:", error);
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
    // 保留 selectedScene，以便返回时知道是从哪个场景来的
  };

  // 从场景视图返回世界地图
  const handleSceneViewBack = () => {
    setSelectedScene(null);
    setCurrentView(MapViewState.WORLD_MAP);
  };

  // 处理返回 - 实现层级返回：子场景 -> 场景 -> 大地图
  const handleBack = () => {
    if (currentView === MapViewState.INTERACT_NPC_NORMAL || 
        currentView === MapViewState.INTERACT_NPC_ABILITY) {
      setCurrentView(MapViewState.SUBSCENE_MODAL);
    } else if (currentView === MapViewState.SUBSCENE_MODAL) {
      // 如果 selectedScene 存在，说明是从场景视图进入的，先返回到场景视图
      if (selectedScene) {
        setCurrentView(MapViewState.SCENE_VIEW);
        setSelectedSubscene(null);
      } else {
        // 否则直接返回到世界地图
        setCurrentView(MapViewState.WORLD_MAP);
        setSelectedSubscene(null);
      }
    }
  };

  if (isLoading) {
    return (
      <FullPageLoading
        rootClassName={styles.page}
        contentClassName={styles.mapContainer}
      />
    );
  }

  return (
    <div className={styles.page} ref={containerRef}>
      <div className={styles.mapContainer}>
        {/* 音乐控制按钮和Player属性按钮 - 在所有视图中显示 */}
        {gameData && (
          <div
            className={`${styles.topButtonsContainer} ${
              currentView === MapViewState.INTERACT_NPC_NORMAL || currentView === MapViewState.INTERACT_NPC_ABILITY
                ? styles.topButtonsContainerAligned
                : ""
            }`}
          >
            {currentView !== MapViewState.INTERACT_NPC_NORMAL && 
             currentView !== MapViewState.INTERACT_NPC_ABILITY && (
              <div
                className={`${styles.buttonItem} ${
                  isMusicPlaying ? styles.buttonItemActive : ""
                }`}
                onClick={handleMusicToggle}
                style={{ cursor: "pointer" }}
              >
                <div className={styles.buttonInner}>
                  <PiMusicNoteDuotone />
                  <span>音乐</span>
                </div>
              </div>
            )}
            <div
              className={`${styles.buttonItem} ${
                isPlayerAttributesVisible ? styles.buttonItemActive : ""
              }`}
              onClick={async () => {
                if (!isPlayerAttributesVisible) {
                  // 打开时更新属性数据
                  await updateGameAttributes();
                }
                setIsPlayerAttributesVisible(!isPlayerAttributesVisible);
              }}
              style={{ cursor: "pointer" }}
            >
              <div className={styles.buttonInner}>
                <MdOutlinePerson />
                <span>玩家</span>
              </div>
            </div>
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
              const isFirstTime =
                worldInteractionHistory &&
                worldInteractionHistory.interactions.length === 0;
              const shouldShow =
                !isFirstTime && (!eventData || eventCompleted) && !isLoading;
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
        {currentView === MapViewState.STORY_INTRO &&
          worldInteractionHistory &&
          worldInteractionHistory.interactions.length === 0 &&
          !eventData && (
            <StoryIntroModal
              isOpen={true}
              gameData={gameData}
              onStartGame={handleStartGame}
              isDistributingEvent={isDistributingEvent}
            />
          )}

        {/* 场景详情模态框 */}
        {currentView === MapViewState.SUBSCENE_MODAL &&
          selectedSubscene &&
          gameData && (
            <SubSceneModal
              subsceneData={selectedSubscene}
              gameData={gameData}
              onBack={handleBack}
            />
          )}

        {/* 普通NPC交互页面 */}
        {currentView === MapViewState.INTERACT_NPC_NORMAL &&
          selectedSubscene &&
          gameData && (
            <InteractWithNpcModal
              onClose={handleBack}
              gameData={gameData}
              worldInteractionHistory={worldInteractionHistory ?? null}
              pendingAction={undefined}
              currentSubsceneId={selectedSubscene?.id || null}
              onUpdateAttributes={updateGameAttributes}
            />
          )}

        {/* 功能性NPC交互页面 */}
        {currentView === MapViewState.INTERACT_NPC_ABILITY &&
          selectedSubscene &&
          gameData && (
            <InteractWithNpcModal
              onClose={handleBack}
              gameData={gameData}
              worldInteractionHistory={null}
              pendingAction={pendingAction || undefined}
              currentSubsceneId={selectedSubscene?.id || null}
              onUpdateAttributes={updateGameAttributes}
            />
          )}

        {/* Player属性面板 - 全局显示 */}
        {gameData && (
          <Attributes
            visible={isPlayerAttributesVisible}
            onClose={() => setIsPlayerAttributesVisible(false)}
            player={(gameData.worldSetting?.player as any) || null}
            npc={null}
          />
        )}
      </div>
    </div>
  );
};

export default GalgameMap;
