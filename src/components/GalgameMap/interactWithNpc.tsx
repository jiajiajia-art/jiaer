import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CiLocationOn } from "react-icons/ci";
import { MdCheckCircle } from "react-icons/md";
import styles from "./interactWithNpc.module.css";
import { LuFileText } from "react-icons/lu";
import { MdOutlineAutoStories, MdOutlinePerson } from "react-icons/md";
import { BiHistory } from "react-icons/bi";
import { PiMusicNoteDuotone } from "react-icons/pi";
import { extractPlainText, truncateTextWithTags } from "../../utils/textUtils";
import { useAuthStore } from "../../store/useAuthStore";
import { useGameStore } from "../../store/gameStore";
import { useMapGalgameStore, MapViewState } from "../../store/mapGalgameStore";
import { useWorldInteractionStep } from "../../hooks/mapGalgame/useWorldInteractionStep";
import {
  useHistoryPolling,
  type PendingRequest,
} from "../../hooks/mapGalgame/useHistoryPolling";
import { useCharacterAnimation } from "../../hooks/galgame/useCharacterAnimation";
import { useCharacterContainerClassName } from "../../hooks/galgame/useCharacterContainerClassName";
import { useStoryTyping } from "../../hooks/story/useStoryTyping";
import { useMapMusicPlayer } from "../../hooks/mapGalgame/useMapMusicPlayer";
import { useRefreshEventData } from "../../hooks/mapGalgame/useRefreshEventData";
import { useInteractionInit } from "../../hooks/mapGalgame/useInteractionInit";
import NormalModeDisplay from "./NormalModeDisplay";
import TextModeDisplay from "./TextModeDisplay";
import WorldModal from "./WorldModal";
import type { AllGameData } from "../../api/worldInteraction/mapWorldData.type";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";
import interactionApi from "../../api/worldInteraction/interactionApi";
import { authFetch } from "../../api/base";
import Attributes from "./Attributes";
import {
  type Message,
  getImageUrls,
  getPlayerImage,
  convertStepToMessage,
  convertStepsToTextModalFormat,
  getStorageKeys,
  safeSetLocalStorage,
  safeRemoveLocalStorage,
} from "../../hooks/mapGalgame/interactionUtils";
import HistoryModal from "./HistoryModal";

// 常量定义
const DEFAULT_SCENE_IMAGE = `${
  import.meta.env.BASE_URL
}data/assets/创作界面切图/defaultScene.png`;
export const REQUEST_TIMEOUT_MS = 60_000; // 60秒
export const AUTO_PLAY_DELAY_MS = 2000; // 2秒
export const CACHE_CLEANUP_DELAY_MS = 3000; // 3秒

export const TIMEOUT_MESSAGES = {
  CHOICE: "AI 回应本次选择已超过 60 秒仍未返回，是否刷新页面重试？",
  INTERACT: "开始游戏请求已超过 60 秒仍未返回，是否刷新页面重试？",
  POLLING: "AI 推演结果长时间未返回，是否刷新页面重试？",
};

export const ERROR_MESSAGES = {
  CHOICE_FAILED: "选择选项失败，请检查网络或稍后重试。",
  INTERACT_FAILED: "开始游戏失败，请检查网络或稍后重试。",
  RETRY_FAILED: "重试失败，请检查网络或稍后重试。",
};

interface InteractWithNpcProps {
  onClose: () => void;
  gameData: AllGameData | null;
  worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
  pendingAction?: { nodeId: string; actionId: string } | null; // 待处理的功能性NPC操作
  skipAutoInit?: boolean; // 是否跳过自动初始化
  currentSubsceneId?: string | null; // 当前子场景ID（用于功能性NPC交互时获取背景图片）
  onUpdateAttributes?: () => Promise<void>; // 更新属性的回调
}

const InteractWithNpc = ({
  onClose,
  gameData,
  worldInteractionHistory,
  pendingAction, // 新的方式：让 InteractWithNpc 自己处理流式响应
  skipAutoInit = false,
  currentSubsceneId, // 当前子场景ID（用于功能性NPC交互时获取背景图片）
  onUpdateAttributes, // 更新属性的回调
}: InteractWithNpcProps) => {
  const { user } = useAuthStore();
  const sessionId = useGameStore((state) => state.sessionId);
  const { fileId } = useGameStore();
  const {
    eventData,
    setEventData,
    setCurrentView,
    selectedSubscene,
    eventCompleted,
    setEventCompleted,
    setIsTypingInInteractNpc,
  } = useMapGalgameStore();
  const { refreshEventData } = useRefreshEventData();

  const eventId = eventData?.event?.eventId || null;
  const worldSetting = gameData?.worldSetting || null;
  const sceneSetting = gameData?.sceneSetting || null;
  const currentSubscene = eventData?.subscene || null;
  // 是否为功能性 NPC 交互（有 pendingAction 即视为功能性交互）
  const isAbilityNodeInteraction = !!pendingAction;
  const { isMusicPlaying, handleMusicToggle } = useMapMusicPlayer({
    fileId: fileId || null,
    gameData,
    currentView: MapViewState.INTERACT_NPC,
    selectedSubscene,
    eventData,
  });

  // 游戏状态
  const [gameState, setGameState] = useState({
    gameStarted: false,
    isAutoPlay: false,
    isTextMode: false,
    completedSteps: [] as any[],
    isHistoryVisible: false,
    isAttributesVisible: false,
    attributesViewType: "npc" as "npc" | "player", // 当前查看的属性类型
    hasPendingRequest: false,
  });
  const setGameStarted = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, gameStarted: value })),
    []
  );
  const setIsAutoPlay = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, isAutoPlay: value })),
    []
  );
  const setIsTextMode = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, isTextMode: value })),
    []
  );
  const setCompletedSteps = useCallback(
    (value: any[] | ((prev: any[]) => any[])) => {
      setGameState((prev) => ({
        ...prev,
        completedSteps:
          typeof value === "function" ? value(prev.completedSteps) : value,
      }));
    },
    []
  );
  const setIsHistoryVisible = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, isHistoryVisible: value })),
    []
  );
  const setIsAttributesVisible = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, isAttributesVisible: value })),
    []
  );
  const setAttributesViewType = useCallback(
    (value: "npc" | "player") =>
      setGameState((prev) => ({ ...prev, attributesViewType: value })),
    []
  );
  const setHasPendingRequest = useCallback(
    (value: boolean) =>
      setGameState((prev) => ({ ...prev, hasPendingRequest: value })),
    []
  );
  const {
    gameStarted,
    isAutoPlay,
    isTextMode,
    completedSteps,
    isHistoryVisible,
    isAttributesVisible,
    attributesViewType,
    hasPendingRequest,
  } = gameState;

  // 合并弹窗状态
  const [modals, setModals] = useState({
    error: { visible: false, message: "" },
    timeout: { visible: false, message: "" },
  });
  const setErrorModal = useCallback(
    (value: { visible: boolean; message: string }) => {
      setModals((prev) => ({ ...prev, error: value }));
    },
    []
  );
  const setTimeoutModal = useCallback(
    (value: { visible: boolean; message: string }) => {
      setModals((prev) => ({ ...prev, timeout: value }));
    },
    []
  );
  const { error: errorModal, timeout: timeoutModal } = modals;

  // 合并 refs
  const refs = useRef({
    currentRequestId: 0,
    hasInitialized: false,
    isRestoringFromCache: false,
    backgroundInitialized: false,
    interactTimeout: null as number | null,
    choiceTimeout: null as number | null,
    choiceInFlight: false,
    previousStep: null as any,
    previousIsTyping: false,
    lastRequest: null as
      | { type: "interact" }
      | { type: "choice"; optionId: string; optionIndex: number }
      | null,
    processedPendingAction: null as { nodeId: string; actionId: string } | null, // 跟踪已处理的待处理操作
  });

  // 其他状态
  const [displayBackgroundImage, setDisplayBackgroundImage] =
    useState<string>("");
  const [latestHistory, setLatestHistory] =
    useState<GetWorldInteractionHistoryResponse | null>(
      worldInteractionHistory
    );
  const [pendingRequestForPoll, setPendingRequestForPoll] =
    useState<PendingRequest | null>(null);

  // 提取背景图片获取逻辑
  const getSubsceneImage = useCallback(
    (subscene: { id?: string; image?: string } | null): string => {
      if (!subscene) return "";

      if (subscene.image) {
        return getImageUrls(subscene.image) || "";
      }

      if (subscene.id && sceneSetting?.scenes) {
        for (const scene of sceneSetting.scenes) {
          const found = scene.subscenes?.find(
            (sub: any) => sub.id === subscene.id
          );
          if (found?.image) {
            return getImageUrls(found.image) || "";
          }
        }
      }

      return "";
    },
    [sceneSetting]
  );

  // 获取当前子场景（用于功能性NPC交互）
  const getCurrentSubscene = useCallback((): {
    id?: string;
    image?: string;
  } | null => {
    // 如果是功能性NPC交互，优先使用传入的 currentSubsceneId
    if (
      isAbilityNodeInteraction &&
      currentSubsceneId &&
      gameData?.sceneSetting?.scenes
    ) {
      for (const scene of gameData.sceneSetting.scenes) {
        const found = scene.subscenes?.find(
          (sub: any) => sub.id === currentSubsceneId
        );
        if (found) {
          return found;
        }
      }
    }

    // 如果找不到，尝试从 latestHistory 中查找最近的功能性NPC交互
    if (
      isAbilityNodeInteraction &&
      gameData?.sceneSetting?.scenes &&
      latestHistory?.interactions?.length
    ) {
      const lastAbilityNodeInteraction = [...latestHistory.interactions]
        .reverse()
        .find(
          (interaction: any) => interaction.type === "ability_node_interaction"
        );

      if (lastAbilityNodeInteraction?.subsceneId) {
        for (const scene of gameData.sceneSetting.scenes) {
          const found = scene.subscenes?.find(
            (sub: any) => sub.id === lastAbilityNodeInteraction.subsceneId
          );
          if (found) {
            return found;
          }
        }
      }
    }

    // 如果还是找不到，尝试从 eventData 获取
    if (eventData?.subscene) {
      return eventData.subscene;
    }

    // 普通NPC交互，使用 eventData 中的 subscene
    return eventData?.subscene || null;
  }, [
    isAbilityNodeInteraction,
    currentSubsceneId,
    gameData,
    latestHistory,
    eventData,
  ]);

  // 计算最终使用的背景图片（包含兜底逻辑）
  const backgroundImage = useMemo(() => {
    // 如果已经设置了背景图片，直接使用
    if (displayBackgroundImage) {
      return displayBackgroundImage;
    }

    // 如果没有设置，尝试获取当前子场景的图片作为兜底
    const currentSubscene = getCurrentSubscene();
    if (currentSubscene) {
      const subsceneImage = getSubsceneImage(currentSubscene);
      if (subsceneImage) {
        return subsceneImage;
      }
    }

    // 最后返回空字符串，使用默认图片
    return "";
  }, [displayBackgroundImage, getCurrentSubscene, getSubsceneImage]);

  // 初始化背景图片
  useEffect(() => {
    if (refs.current.backgroundInitialized) return;

    // 如果是功能性NPC交互，使用当前子场景的图片
    if (pendingAction) {
      const currentSubscene = getCurrentSubscene();
      if (currentSubscene) {
        const bgImage = getSubsceneImage(currentSubscene);
        if (bgImage) {
          setDisplayBackgroundImage(bgImage);
          refs.current.backgroundInitialized = true;
        } else {
          // 如果没有图片，不设置 displayBackgroundImage，让 useMemo 处理兜底
          refs.current.backgroundInitialized = true;
        }
      } else {
        // 找不到子场景，不设置 displayBackgroundImage，让 useMemo 处理兜底
        refs.current.backgroundInitialized = true;
      }
    } else if (!displayBackgroundImage && eventData?.subscene) {
      // 普通NPC交互，使用 eventData 中的 subscene
      const bgImage = getSubsceneImage(eventData.subscene);
      if (bgImage) {
        setDisplayBackgroundImage(bgImage);
        refs.current.backgroundInitialized = true;
      } else {
        setDisplayBackgroundImage("");
        refs.current.backgroundInitialized = true;
      }
    }
  }, [
    pendingAction,
    eventData?.subscene?.image,
    eventData?.subscene?.id,
    sceneSetting,
    displayBackgroundImage,
    getSubsceneImage,
    getCurrentSubscene,
  ]);

  const stepHandlers = useWorldInteractionStep({
    sessionId,
    eventId: eventId || "ability-node", // 功能性NPC使用占位符eventId
    fileId: fileId,
    historyLength: latestHistory?.interactions.length ?? 0,
    onMessagesClear: () => {
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
    },
  });

  // 包装 stepHandlers，在调用 handleInteract 时记录最后一次请求
  const wrappedStepHandlers = useMemo(
    () => ({
      ...stepHandlers,
      handleInteract: (
        options?: Parameters<typeof stepHandlers.handleInteract>[0]
      ) => {
        // 记录最后一次请求
        refs.current.lastRequest = { type: "interact" };
        return stepHandlers.handleInteract(options);
      },
    }),
    [stepHandlers]
  );

  useEffect(() => {
    if (worldInteractionHistory) {
      setLatestHistory(worldInteractionHistory);
    }
  }, [worldInteractionHistory]);

  const refreshHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const response = await interactionApi.getWorldInteractionHistory(
        sessionId
      );
      if (response.data?.success) {
        setLatestHistory(response.data);
      }
    } catch (error) {
      console.error("[WorldInteraction] 获取最新历史记录失败:", error);
    }
  }, [sessionId]);

  // 清理超时
  useEffect(() => {
    return () => {
      if (refs.current.interactTimeout) {
        clearTimeout(refs.current.interactTimeout);
        refs.current.interactTimeout = null;
      }
      if (refs.current.choiceTimeout) {
        clearTimeout(refs.current.choiceTimeout);
        refs.current.choiceTimeout = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isHistoryVisible || !sessionId) return;

    let cancelled = false;

    const fetchHistory = async () => {
      try {
        const response = await interactionApi.getWorldInteractionHistory(
          sessionId
        );
        if (!cancelled && response.data?.success) {
          setLatestHistory(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("[WorldInteraction] 获取历史记录失败:", error);
        }
      }
    };

    void fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [isHistoryVisible, sessionId]);

  const historyChoiceMessage: Message | null = useMemo(() => {
    if (!latestHistory || !latestHistory.interactions.length) return null;
    const last = latestHistory.interactions[
      latestHistory.interactions.length - 1
    ] as any;
    if (last.type !== "npc_dialogue") {
      return null;
    }

    const options = last.narrativeSteps[
      last.narrativeSteps.length - 1
    ].options.map((opt: any, index: number) => ({
      id: index + 1,
      text: opt.text,
      optionId: opt.optionId,
    }));

    return {
      id: Date.now(),
      type: "choice",
      message: "请选择你的行动",
      options,
      characterImage: getPlayerImage(worldSetting?.player?.imagePath),
      characterPosition: "right",
    };
  }, [latestHistory, worldSetting]);

  const currentMessage = useMemo((): Message => {
    // 1）优先使用当前 step（正常交互流程）
    if (
      gameStarted &&
      stepHandlers.currentStep &&
      stepHandlers.currentStep.type
    ) {
      const converted = convertStepToMessage(
        stepHandlers.currentStep,
        worldSetting
      );
      if (converted) {
        return converted;
      }
    }

    if (historyChoiceMessage && !hasPendingRequest) {
      return historyChoiceMessage;
    }

    if (hasPendingRequest || stepHandlers.isWaitingForData) {
      return { id: 0, type: "narration", message: "" };
    }

    return { id: 0, type: "narration", message: "" };
  }, [
    gameStarted,
    stepHandlers.currentStep,
    stepHandlers.isWaitingForData,
    worldSetting,
    historyChoiceMessage,
    hasPendingRequest,
  ]);

  const characterAnimation = useCharacterAnimation({
    message: currentMessage?.message,
    messageType: currentMessage?.type,
  });

  const getCharacterContainerClassName = useCharacterContainerClassName({
    characterPosition: currentMessage?.characterPosition,
    characterAnimation,
    styles,
  });

  useEffect(() => {
    const currentRequestId = stepHandlers.currentRequestId?.current || 0;
    if (currentRequestId !== refs.current.currentRequestId) {
      refs.current.currentRequestId = currentRequestId;
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
    }
  }, [stepHandlers.currentRequestId?.current, setCompletedSteps]);

  const resetCompletedSteps = useCallback(() => {
    setCompletedSteps([]);
    refs.current.previousStep = null;
    refs.current.previousIsTyping = false;
  }, [setCompletedSteps]);

  // 处理功能性NPC的待处理操作（在 InteractWithNpc 内部处理流式响应，确保 requestId 同步）
  useEffect(() => {
    if (
      pendingAction &&
      !gameStarted &&
      stepHandlers.processStreamResponse &&
      sessionId &&
      refs.current.processedPendingAction !== pendingAction
    ) {
      // 标记为已处理，防止重复处理（React 严格模式会调用两次）
      refs.current.processedPendingAction = pendingAction;

      // 1. 先设置游戏状态，确保UI能正确显示（和普通NPC交互一致）
      setGameStarted(true);

      // 2. 清空状态（和普通NPC交互一致）
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
      stepHandlers.setStepQueue([]);
      stepHandlers.setCurrentStep(null);
      stepHandlers.setShowNextButton(false);
      setHasPendingRequest(false);

      // 3. 调用功能性NPC的接口，获取流式响应
      const fetchAndProcessStream = async () => {
        try {
          const { nodeId, actionId } = pendingAction;

          const response = await authFetch(
            `/api/world-interaction/session/${sessionId}/ability-node/${nodeId}/select-action/stream`,
            {
              method: "POST",
              body: JSON.stringify({
                actionId: actionId,
              }),
            }
          );

          if (!response.ok || !response.body) {
            console.error("[InteractWithNpc] 响应失败", {
              status: response.status,
              hasBody: !!response.body,
            });
            setErrorModal({ visible: true, message: "请求失败，请重试" });
            return;
          }

          if (response.body.locked) {
            console.error("[InteractWithNpc] response.body 已被锁定");
            setErrorModal({ visible: true, message: "响应体已被锁定" });
            return;
          }

          // 4. 使用 processStreamResponse 处理流式响应
          // 注意：此时 currentRequestId 已经在 useWorldInteractionStep 中初始化，我们直接使用它
          const requestId = ++stepHandlers.currentRequestId.current;

          await stepHandlers.processStreamResponse(response, requestId, {
            onFirstStep: () => {
              // 第一个步骤到达时的处理（和普通NPC交互一致）
              // processStreamResponse 内部已经设置了 isWaitingForData = false
              // 更新属性
              if (onUpdateAttributes) {
                onUpdateAttributes().catch(error => {
                  console.error('[InteractWithNpc] ❌ 功能性NPC: 更新属性失败:', error);
                });
              }
            },
            onError: (error: string) => {
              console.error("[InteractWithNpc] ❌ 功能性NPC: 流式响应错误:", error);
              setErrorModal({ visible: true, message: error });
            },
          });
        } catch (error: any) {
          console.error("[InteractWithNpc] 处理功能性NPC操作失败:", error);
          setErrorModal({
            visible: true,
            message: error.message || "处理失败，请重试",
          });
        }
      };

      void fetchAndProcessStream();
    }
  }, [
    pendingAction,
    gameStarted,
    setGameStarted,
    setErrorModal,
    stepHandlers,
    setCompletedSteps,
    setHasPendingRequest,
    sessionId,
  ]);

  // 根据当前消息类型自动切换属性查看类型
  useEffect(() => {
    if (currentMessage?.type === "choice") {
      setAttributesViewType("player");
    } else {
      setAttributesViewType("npc");
    }
  }, [currentMessage?.type]);
  // 获取当前互动的 NPC 对象
  const currentNpcObject = useMemo(() => {
    if (!gameData?.npcSetting?.npcs || !eventData?.npc?.id) return null;
    if (attributesViewType === "player") {
      return gameData.worldSetting?.player;
    } else {
      return (
        (gameData.npcSetting.npcs as any[]).find(
          (n) => n.id === eventData.npc.id
        ) || null
      );
    }
  }, [gameData, eventData, attributesViewType]);

  // 只有在不跳过自动初始化时才使用 useInteractionInit
  const { interactTimeoutRef } = useInteractionInit({
    sessionId,
    eventId: skipAutoInit ? null : eventId, // 跳过自动初始化时传入 null
    gameData,
    fileId,
    gameStarted,
    setGameStarted,
    setLatestHistory,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal,
    setErrorModal,
    stepHandlers: wrappedStepHandlers,
    resetCompletedSteps,
    setRestoringFromCache: (value: boolean) => {
      refs.current.isRestoringFromCache = value;
    },
    onUpdateAttributes,
  });

  // 同步 interactTimeoutRef 到 refs
  useEffect(() => {
    refs.current.interactTimeout = interactTimeoutRef.current;
  }, [interactTimeoutRef.current]);

  const handlePollMatchFound = useCallback(
    async (matchedSteps: any[]) => {
      if (!matchedSteps.length) return;
      const [first, ...rest] = matchedSteps;

      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;

      stepHandlers.setCurrentStep(first || null);
      stepHandlers.setStepQueue(rest || []);
      stepHandlers.setShowNextButton(first?.type !== "choice");

      setHasPendingRequest(false);
      const storageKeys = getStorageKeys(sessionId, eventId);
      if (storageKeys.pendingRequest) {
        safeRemoveLocalStorage(storageKeys.pendingRequest);
      }
    },
    [setCompletedSteps, setHasPendingRequest, stepHandlers, sessionId, eventId]
  );

  const handlePollTimeout = useCallback(() => {
    setHasPendingRequest(false);
    setTimeoutModal({
      visible: true,
      message: TIMEOUT_MESSAGES.POLLING,
    });
  }, []);

  const handlePollEnd = useCallback(async () => {
    setPendingRequestForPoll(null);
    await refreshHistory();
  }, [refreshHistory]);

  useHistoryPolling({
    sessionId,
    eventId,
    pendingRequest: pendingRequestForPoll,
    onHistoryUpdate: setLatestHistory,
    onMatchFound: handlePollMatchFound,
    onTimeout: handlePollTimeout,
    onPollEnd: handlePollEnd,
  });

  const handleNextMessage = useCallback(() => {
    if (gameStarted && stepHandlers.showNextButton) {
      if (stepHandlers.stepQueue && stepHandlers.stepQueue.length === 0) {
        return;
      }
      stepHandlers.handleNextStep();
    }
  }, [gameStarted, stepHandlers]);

  const handleAutoPlayToggle = useCallback(() => {
    setIsAutoPlay(!isAutoPlay);
  }, [isAutoPlay, setIsAutoPlay]);

  const plainTextForTyping = useMemo(() => {
    if (currentMessage && currentMessage.type !== "choice") {
      return extractPlainText(currentMessage.message);
    }
    return "";
  }, [currentMessage]);

  const { displayedText, isTyping } = useStoryTyping({
    text: plainTextForTyping,
    enabled:
      currentMessage &&
      currentMessage.type !== "choice" &&
      gameStarted &&
      !!plainTextForTyping,
    speed: 60,
  });

  const finalDisplayText =
    (stepHandlers.isWaitingForData || hasPendingRequest) &&
    !stepHandlers.currentStep
      ? ""
      : gameStarted
      ? displayedText
      : currentMessage && currentMessage.type !== "choice"
      ? currentMessage.message
      : "";

  const finalIsTyping =
    (stepHandlers.isWaitingForData || hasPendingRequest) &&
    !stepHandlers.currentStep
      ? false
      : isTyping;

  useEffect(() => {
    setIsTypingInInteractNpc(finalIsTyping);
  }, [finalIsTyping, setIsTypingInInteractNpc]);

  useEffect(() => {
    const hasCompletedEvent =
      stepHandlers.newEvent?.completedEvent && !stepHandlers.newEvent?.event;
    const stepsFinished =
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
      (!stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0);

    if (
      hasCompletedEvent &&
      stepsFinished &&
      !eventCompleted &&
      !finalIsTyping
    ) {
      setEventCompleted(true);
    }
  }, [
    stepHandlers.newEvent?.completedEvent,
    stepHandlers.newEvent?.event,
    stepHandlers.isWaitingForData,
    finalIsTyping,
    stepHandlers.stepQueue,
    eventCompleted,
    setEventCompleted,
  ]);

  // 跟踪是否已经设置了刷新定时器，避免重复设置
  const refreshTimerRef = useRef<number | null>(null);
  const hasCleanedCacheRef = useRef<boolean>(false);

  useEffect(() => {
    if (refs.current.isRestoringFromCache) return;

    const storageKeys = getStorageKeys(sessionId, eventId);
    if (!storageKeys.allSteps || !storageKeys.incomplete) return;

    const queueEmpty =
      !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === "choice";

    const allStepsCompleted =
      gameStarted &&
      queueEmpty &&
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
      !stepHandlers.showNextButton;

    const shouldCleanCache = isChoiceStep
      ? gameStarted &&
        !stepHandlers.isWaitingForData &&
        !stepHandlers.showNextButton
      : allStepsCompleted && stepHandlers.currentStep;

    if (shouldCleanCache && !hasCleanedCacheRef.current) {
      // 清除之前的定时器
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      safeRemoveLocalStorage(storageKeys.allSteps);
      safeRemoveLocalStorage(storageKeys.incomplete);
      hasCleanedCacheRef.current = true;

      refreshTimerRef.current = window.setTimeout(async () => {
        if (sessionId && gameData) {
          await refreshEventData(sessionId, gameData);
        }
        refreshTimerRef.current = null;
      }, CACHE_CLEANUP_DELAY_MS);
    } else if (!shouldCleanCache) {
      // 如果条件不满足，重置标记
      hasCleanedCacheRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }

    // 清理函数
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [
    gameStarted,
    stepHandlers.currentStep,
    stepHandlers.stepQueue,
    stepHandlers.isWaitingForData,
    stepHandlers.showNextButton,
    finalIsTyping,
    sessionId,
    eventId,
    gameData,
    refreshEventData,
  ]);

  useEffect(() => {
    const currentStep = stepHandlers.currentStep;
    const prevStep = refs.current.previousStep;

    if (prevStep && currentStep !== prevStep && !isTyping) {
      setCompletedSteps((prev) => {
        const exists = prev.some(
          (s) => s && s.type === prevStep.type && s.content === prevStep.content
        );
        return exists ? prev : [...prev, prevStep];
      });
    }

    refs.current.previousStep = currentStep;
    refs.current.previousIsTyping = isTyping;
  }, [stepHandlers.currentStep, isTyping, setCompletedSteps]);

  const allStepsForTextModal = useMemo(() => {
    let validSteps = completedSteps.filter((s) => s && s.type);

    if (stepHandlers.currentStep?.type) {
      const exists = validSteps.some(
        (s) =>
          s.type === stepHandlers.currentStep.type &&
          s.content === stepHandlers.currentStep.content
      );
      if (!exists) {
        validSteps = [...validSteps, stepHandlers.currentStep];
      }
    }

    if (validSteps.length === 0 && latestHistory?.interactions?.length) {
      const lastInteraction = latestHistory.interactions[
        latestHistory.interactions.length - 1
      ] as any;
      if (
        lastInteraction.type === "npc_dialogue" &&
        Array.isArray(lastInteraction.narrativeSteps)
      ) {
        validSteps = [...lastInteraction.narrativeSteps];
      }
    }
    const choiceIndices = validSteps
      .map((step, index) => (step?.type === "choice" ? index : -1))
      .filter((idx) => idx >= 0);

    if (choiceIndices.length > 1) {
      for (let i = choiceIndices.length - 2; i >= 0; i--) {
        validSteps.splice(choiceIndices[i], 1);
      }
    }

    return validSteps;
  }, [completedSteps, stepHandlers.currentStep, latestHistory]);

  const currentStepIndex = useMemo(() => {
    if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
      const index = allStepsForTextModal.findIndex(
        (s) =>
          s &&
          s.type === stepHandlers.currentStep.type &&
          s.content === stepHandlers.currentStep.content
      );
      if (index >= 0) return index;
    }

    if (allStepsForTextModal.length > 0) {
      return allStepsForTextModal.length - 1;
    }

    return -1;
  }, [allStepsForTextModal, stepHandlers.currentStep]);

  const shouldShowContinueButton = useMemo(() => {
    const newEvent = stepHandlers.newEvent;
    if (!newEvent) return false;

    const hasFullNewEvent = !!(
      newEvent.event &&
      newEvent.npc &&
      newEvent.subscene
    );
    if (!hasFullNewEvent) {
      return false;
    }

    const queueEmpty =
      !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === "choice";

    const canShow =
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
      !hasPendingRequest &&
      ((queueEmpty && !stepHandlers.showNextButton) ||
        (isChoiceStep && !stepHandlers.showNextButton));

    return canShow;
  }, [
    stepHandlers.newEvent,
    stepHandlers.stepQueue,
    stepHandlers.isWaitingForData,
    stepHandlers.showNextButton,
    stepHandlers.currentStep,
    finalIsTyping,
    hasPendingRequest,
  ]);

  // 功能性NPC交互的继续按钮显示条件
  const shouldShowAbilityNodeContinueButton = useMemo(() => {
    if (!isAbilityNodeInteraction) return false;

    // 交互完成的条件：步骤队列为空、没有等待数据、没有正在输入、没有待处理请求、没有下一步按钮
    const queueEmpty =
      !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === "choice";

    const canShow =
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
      !hasPendingRequest &&
      gameStarted &&
      ((queueEmpty && !stepHandlers.showNextButton) ||
        (isChoiceStep && !stepHandlers.showNextButton));

    return canShow;
  }, [
    isAbilityNodeInteraction,
    stepHandlers.stepQueue,
    stepHandlers.isWaitingForData,
    stepHandlers.showNextButton,
    stepHandlers.currentStep,
    finalIsTyping,
    hasPendingRequest,
    gameStarted,
  ]);

  const handleContinue = useCallback(() => {
    const newEvent = stepHandlers.newEvent;
    const hasFullNewEvent =
      newEvent?.event && newEvent.npc && newEvent.subscene;

    if (hasFullNewEvent) {
      setEventData({
        event: newEvent!.event,
        npc: newEvent!.npc,
        subscene: newEvent!.subscene,
      });

      const newBgImage = getSubsceneImage(newEvent!.subscene);
      if (newBgImage) {
        setDisplayBackgroundImage(newBgImage);
      }

      stepHandlers.clearNewEvent?.();

      const { setSelectedSubscene, setSelectedScene } =
        useMapGalgameStore.getState();
      setSelectedSubscene(null);
      setSelectedScene(null);

      setCurrentView(MapViewState.WORLD_MAP);
      return;
    }

    if (newEvent?.completedEvent && !newEvent.event) {
      stepHandlers.clearNewEvent?.();
    }
  }, [
    stepHandlers,
    setEventData,
    setCurrentView,
    getSubsceneImage,
    setDisplayBackgroundImage,
  ]);

  // 功能性NPC交互的继续按钮处理
  const handleAbilityNodeContinue = useCallback(() => {
    // 关闭交互页面，返回到子场景视图
    onClose();
  }, [onClose]);

  const textModalDisplayText = useMemo(() => {
    if (
      stepHandlers.currentStep &&
      stepHandlers.currentStep.type !== "choice" &&
      currentMessage &&
      currentMessage.type !== "choice" &&
      isTyping &&
      displayedText.length > 0
    ) {
      const originalText = currentMessage.message || "";
      const currentPlainLength = displayedText.length;

      if (currentPlainLength > 0) {
        const textWithTags = truncateTextWithTags(
          originalText,
          currentPlainLength
        );
        return textWithTags;
      }
    }
    return "";
  }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping]);

  useEffect(() => {
    if (!isAutoPlay || !gameStarted) return;
    if (stepHandlers.isWaitingForData) return;
    if (finalIsTyping) return;
    if (!stepHandlers.showNextButton) return;
    if (currentMessage?.type === "choice") {
      setIsAutoPlay(false);
      return;
    }

    const autoPlayTimer = setTimeout(() => {
      if (
        isAutoPlay &&
        !finalIsTyping &&
        stepHandlers.showNextButton &&
        currentMessage?.type !== "choice" &&
        !stepHandlers.isWaitingForData
      ) {
        handleNextMessage();
      }
    }, AUTO_PLAY_DELAY_MS);

    return () => {
      clearTimeout(autoPlayTimer);
    };
  }, [
    isAutoPlay,
    finalIsTyping,
    stepHandlers.showNextButton,
    stepHandlers.isWaitingForData,
    currentMessage?.type,
    gameStarted,
    handleNextMessage,
    isTextMode,
  ]);

  const handleChoiceClick = useCallback(
    (option: { text: string; optionId?: string }) => {
      if (
        refs.current.choiceInFlight ||
        hasPendingRequest ||
        stepHandlers.isWaitingForData
      ) {
        return;
      }
      refs.current.choiceInFlight = true;
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;

      let optionId: string | undefined = option.optionId;
      let optionIndex = -1;

      if (!optionId) {
        if (
          stepHandlers.currentStep &&
          stepHandlers.currentStep.type === "choice"
        ) {
          optionIndex =
            stepHandlers.currentStep.options?.findIndex((opt: any) => {
              if (typeof opt === "string") {
                return opt === option.text;
              }
              return (
                opt.text === option.text || opt.optionId === option.optionId
              );
            }) ?? -1;

          if (optionIndex >= 0) {
            const stepOption = stepHandlers.currentStep.options?.[optionIndex];
            if (stepOption && typeof stepOption !== "string") {
              optionId = stepOption.optionId
                ? String(stepOption.optionId)
                : undefined;
            }
          }
        }

        if (
          optionIndex < 0 &&
          currentMessage &&
          currentMessage.type === "choice" &&
          currentMessage.options
        ) {
          optionIndex = currentMessage.options.findIndex((opt: any) => {
            return opt.text === option.text || opt.optionId === option.optionId;
          });

          if (optionIndex >= 0) {
            const msgOption = currentMessage.options[optionIndex] as any;
            optionId = msgOption.optionId
              ? String(msgOption.optionId)
              : undefined;
          }
        }
      } else {
        if (
          stepHandlers.currentStep &&
          stepHandlers.currentStep.type === "choice"
        ) {
          optionIndex =
            stepHandlers.currentStep.options?.findIndex((opt: any) => {
              if (typeof opt === "string") {
                return false;
              }
              return (
                opt.optionId === optionId || String(opt.optionId) === optionId
              );
            }) ?? -1;
        }

        if (
          optionIndex < 0 &&
          currentMessage &&
          currentMessage.type === "choice" &&
          currentMessage.options
        ) {
          optionIndex = currentMessage.options.findIndex((opt: any) => {
            return (
              opt.optionId === optionId || String(opt.optionId) === optionId
            );
          });
        }
      }

      if (!optionId) {
        console.error("无法找到选项或 optionId:", {
          option,
          optionIndex,
          optionId,
        });
        refs.current.choiceInFlight = false;
        return;
      }
      const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;

      // 记录最后一次请求，用于重试
      refs.current.lastRequest = {
        type: "choice",
        optionId,
        optionIndex: finalOptionIndex,
      };

      const storageKeys = getStorageKeys(sessionId, eventId);
      if (storageKeys.pendingRequest) {
        const payload = {
          type: "select-option" as const,
          optionId,
          timestamp: Date.now(),
        };
        safeSetLocalStorage(
          storageKeys.pendingRequest,
          JSON.stringify(payload)
        );
        setHasPendingRequest(true);
      }

      if (refs.current.choiceTimeout) {
        clearTimeout(refs.current.choiceTimeout);
      }
      refs.current.choiceTimeout = window.setTimeout(() => {
        setTimeoutModal({
          visible: true,
          message: TIMEOUT_MESSAGES.CHOICE,
        });
      }, REQUEST_TIMEOUT_MS);

      const clearChoiceTimeout = () => {
        if (refs.current.choiceTimeout) {
          clearTimeout(refs.current.choiceTimeout);
          refs.current.choiceTimeout = null;
        }
      };

      const clearPending = () => {
        if (storageKeys.pendingRequest) {
          safeRemoveLocalStorage(storageKeys.pendingRequest);
        }
        setHasPendingRequest(false);
      };

      stepHandlers
        .handleChoiceOption(optionId, finalOptionIndex, {
          onSuccess: async () => {
            clearChoiceTimeout();
            setTimeoutModal({ visible: false, message: "" });
            refs.current.choiceInFlight = false;
            clearPending();
            // 更新属性
            if (onUpdateAttributes) {
              await onUpdateAttributes().catch(error => {
                console.error('[InteractWithNpc] ❌ 普通对话: onSuccess 更新属性失败:', error);
              });
            }
          },
          onFirstStep: () => {
            clearChoiceTimeout();
            setTimeoutModal({ visible: false, message: "" });
            refs.current.choiceInFlight = false;
            clearPending();
            // 更新属性
            if (onUpdateAttributes) {
              onUpdateAttributes().catch(error => {
                console.error('[InteractWithNpc] ❌ 普通对话: onFirstStep 更新属性失败:', error);
              });
            }
          },
          onError: (error) => {
            console.error("选择选项失败:", error);
            clearChoiceTimeout();
            setTimeoutModal({ visible: false, message: "" });
            refs.current.choiceInFlight = false;
            setErrorModal({
              visible: true,
              message: error || ERROR_MESSAGES.CHOICE_FAILED,
            });
            clearPending();
          },
        })
        .finally(() => {
          refs.current.choiceInFlight = false;
        });
    },
    [
      stepHandlers,
      currentMessage,
      sessionId,
      eventId,
      hasPendingRequest,
      setCompletedSteps,
      setHasPendingRequest,
      setTimeoutModal,
      setErrorModal,
    ]
  );

  const handleCustomInputSubmit = useCallback(
    (customText: string) => {
      if (!customText.trim()) {
        return;
      }

      handleChoiceClick({
        text: customText,
        optionId: customText.trim(),
      });
    },
    [handleChoiceClick]
  );

  // 重试最后一次请求
  const handleRetryRequest = useCallback(() => {
    const lastRequest = refs.current.lastRequest;
    if (!lastRequest) {
      // 如果没有记录最后一次请求，可能是初始交互，尝试调用 handleInteract
      stepHandlers.handleInteract({
        onSuccess: () => {
          setErrorModal({ visible: false, message: "" });
          setTimeoutModal({ visible: false, message: "" });
        },
        onError: (error) => {
          setErrorModal({
            visible: true,
            message: error || ERROR_MESSAGES.RETRY_FAILED,
          });
        },
      });
      return;
    }

    if (lastRequest.type === "choice") {
      // 重试选择请求
      stepHandlers.handleChoiceOption(
        lastRequest.optionId,
        lastRequest.optionIndex,
        {
          onSuccess: () => {
            setErrorModal({ visible: false, message: "" });
            setTimeoutModal({ visible: false, message: "" });
          },
          onError: (error) => {
            setErrorModal({
              visible: true,
              message: error || ERROR_MESSAGES.RETRY_FAILED,
            });
          },
        }
      );
    } else if (lastRequest.type === "interact") {
      // 重试初始交互请求
      stepHandlers.handleInteract({
        onSuccess: () => {
          setErrorModal({ visible: false, message: "" });
          setTimeoutModal({ visible: false, message: "" });
        },
        onError: (error) => {
          setErrorModal({
            visible: true,
            message: error || ERROR_MESSAGES.RETRY_FAILED,
          });
        },
      });
    }
  }, [stepHandlers, setErrorModal, setTimeoutModal]);

  // 统一渲染 WorldModal，避免重复 JSX
  const renderWorldModal = (
    visible: boolean,
    title: string,
    message: string,
    options: {
      confirmText: string;
      cancelText?: string;
      primaryType?: "confirm" | "cancel";
      onConfirm: () => void;
      onCancel?: () => void;
    }
  ) => (
    <WorldModal
      visible={visible}
      title={title}
      message={message}
      confirmText={options.confirmText}
      cancelText={options.cancelText}
      primaryType={options.primaryType}
      onConfirm={options.onConfirm}
      onCancel={options.onCancel}
    />
  );

  return (
    <>
      <div className={styles.pageRoot}>
        <div
          className={`${styles.mainContent} ${
            characterAnimation === "injury" ? styles.worldInjury : ""
          }`}
          style={{
            backgroundImage: isTextMode
              ? "none"
              : backgroundImage
              ? `url("${backgroundImage}")`
              : `url("${DEFAULT_SCENE_IMAGE}")`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#000", // 确保有背景色，避免透明
          }}
        >
          {characterAnimation === "injury" && (
            <div className={styles.injuryBloodSplatter}></div>
          )}
          <div
            className={`${styles.topHeader} ${
              isTextMode ? styles.topHeaderTextMode : ""
            }`}
            onClick={onClose}
          >
            <CiLocationOn />
            <span>{currentSubscene?.name}</span>
          </div>
          {currentNpcObject &&
            (currentMessage?.type === "dialogue" ||
              currentMessage?.type === "choice") &&
              !isAttributesVisible && (
              <div
                className={`${styles.topAttributesButton} ${
                  isAttributesVisible ? styles.topAttributesButtonActive : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAttributesVisible(!isAttributesVisible);
                }}
              >
                <div className={styles.buttonInner}>
                  <MdOutlinePerson />
                  <span>属性</span>
                </div>
              </div>
            )}
          {currentMessage.characterImage && !isTextMode && (
            <div className={getCharacterContainerClassName()}>
              <img
                src={currentMessage.characterImage}
                alt="角色立绘"
                className={styles.characterImage}
              />
            </div>
          )}
          <div
            className={`${styles.gameContentWrapper} ${
              isTextMode ? styles.gameContentWrapperTextMode : ""
            }`}
          >
            {!isTextMode && (
              <>
                <NormalModeDisplay
                  currentMessage={currentMessage}
                  finalDisplayText={finalDisplayText}
                  finalIsTyping={finalIsTyping}
                  stepHandlers={{
                    isWaitingForData:
                      stepHandlers.isWaitingForData || hasPendingRequest,
                    currentStep: stepHandlers.currentStep,
                    showNextButton: stepHandlers.showNextButton,
                    selectedOptionIndex: stepHandlers.selectedOptionIndex,
                  }}
                  isAutoPlay={isAutoPlay}
                  historyLength={
                    stepHandlers.localHistoryLength ??
                    latestHistory?.interactions.length ??
                    0
                  }
                  onNextMessage={handleNextMessage}
                  onChoiceClick={handleChoiceClick}
                  onCustomInputSubmit={handleCustomInputSubmit}
                />
              </>
            )}
            {isTextMode && (
              <TextModeDisplay
                steps={convertStepsToTextModalFormat(
                  allStepsForTextModal,
                  worldSetting
                )}
                currentStepIndex={currentStepIndex}
                currentDisplayText={textModalDisplayText}
                isTyping={finalIsTyping}
                isWaitingForData={stepHandlers.isWaitingForData}
                historyLength={
                  stepHandlers.localHistoryLength ??
                  latestHistory?.interactions.length ??
                  0
                }
                onChoiceClick={(option) => {
                  setCompletedSteps([]);
                  refs.current.previousStep = null;
                  refs.current.previousIsTyping = false;
                  handleChoiceClick(option);
                }}
                onCustomInputSubmit={handleCustomInputSubmit}
              />
            )}
            <div className={styles.buttonContainer}>
              <div className={styles.buttonItem}>
                <div className={styles.buttonInner}>
                  <img
                    src={`${import.meta.env.BASE_URL}data/assets/金币.png`}
                    alt="积分"
                  />
                  <span>{user?.user?.points}</span>
                </div>
              </div>
              <div
                className={styles.buttonItem}
                style={{ cursor: "pointer" }}
                onClick={() => setIsHistoryVisible(true)}
              >
                <div className={styles.buttonInner}>
                  <BiHistory />
                  <span>历史</span>
                </div>
              </div>
              <div
                className={`${styles.buttonItem} ${
                  isTextMode ? styles.buttonItemActive : ""
                }`}
                onClick={() => {
                  setIsTextMode(!isTextMode);
                }}
                style={{ cursor: "pointer" }}
              >
                <div className={styles.buttonInner}>
                  <LuFileText />
                  <span>文本</span>
                </div>
              </div>
              <div
                className={`${styles.buttonItem} ${
                  isAutoPlay ? styles.buttonItemActive : ""
                }`}
                onClick={handleAutoPlayToggle}
                style={{ cursor: "pointer" }}
              >
                <div className={styles.buttonInner}>
                  <MdOutlineAutoStories />
                  <span>自动</span>
                </div>
              </div>
              <div
                className={`${styles.buttonItem} ${
                  isMusicPlaying ? styles.buttonItemActive : ""
                }`}
                style={{ cursor: "pointer" }}
                onClick={handleMusicToggle}
              >
                <div className={styles.buttonInner}>
                  <PiMusicNoteDuotone />
                  <span>音乐</span>
                </div>
              </div>
            </div>

            {shouldShowContinueButton && (
              <div
                className={styles.continueButton}
                onClick={handleContinue}
                style={{ cursor: "pointer" }}
              >
                <MdCheckCircle />
                <span>继续游戏</span>
              </div>
            )}

            {shouldShowAbilityNodeContinueButton && (
              <div
                className={styles.continueButton}
                onClick={handleAbilityNodeContinue}
                style={{ cursor: "pointer" }}
              >
                <MdCheckCircle />
                <span>返回</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <HistoryModal
        visible={isHistoryVisible}
        onClose={() => setIsHistoryVisible(false)}
        history={latestHistory ?? worldInteractionHistory}
      />
      <Attributes
        visible={isAttributesVisible}
        onClose={() => setIsAttributesVisible(false)}
        npc={currentNpcObject}
      />

      {renderWorldModal(errorModal.visible, "请求失败", errorModal.message, {
        confirmText: "重试",
        cancelText: "取消",
        primaryType: "confirm",
        onConfirm: () => {
          // 重试：直接重新发送最后一次请求
          setErrorModal({ visible: false, message: "" });
          handleRetryRequest();
        },
        onCancel: () => {
          // 取消：先关闭弹窗，再刷新历史并刷新页面，回到最后一次有效交互
          setErrorModal({ visible: false, message: "" });
          void (async () => {
            await refreshHistory();
            if (typeof window !== "undefined") {
              window.location.reload();
            }
          })();
        },
      })}

      {renderWorldModal(
        timeoutModal.visible,
        "请求超时",
        timeoutModal.message,
        {
          confirmText: "重试",
          cancelText: "取消",
          primaryType: "confirm",
          onConfirm: () => {
            // 重试：直接重新发送最后一次请求
            setTimeoutModal({ visible: false, message: "" });
            handleRetryRequest();
          },
          onCancel: () => {
            // 取消：关闭弹窗 + 刷新历史 + 刷新页面，回到最后一次有效交互
            setTimeoutModal({ visible: false, message: "" });
            void (async () => {
              await refreshHistory();
              if (typeof window !== "undefined") {
                window.location.reload();
              }
            })();
          },
        }
      )}
    </>
  );
};

export default InteractWithNpc;