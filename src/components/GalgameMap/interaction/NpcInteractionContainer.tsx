/**
 * 普通NPC交互容器组件
 * 管理多个请求的流式输出（interact、选择选项、后续物品交互等）
 * 处理：请求状态、轮询、缓存恢复、刷新页面恢复等
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNpcInteractionStep } from '../../../hooks/mapGalgame/npc/useNpcInteractionStep';
import { useNpcStreamRequestManager } from '../../../hooks/mapGalgame/npc/useNpcStreamRequestManager';
import { useHistoryPolling } from '../../../hooks/mapGalgame/useHistoryPolling';
import { useNpcInteractionInit } from '../../../hooks/mapGalgame/npc/useNpcInteractionInit';
import { useNpcRetryHandler } from '../../../hooks/mapGalgame/npc/useNpcRetryHandler';
import { useStoryTyping } from '../../../hooks/story/useStoryTyping';
import { extractPlainText, truncateTextWithTags } from '../../../utils/textUtils';
import {
  convertStepToMessage,
  getStorageKeys,
  safeRemoveLocalStorage,
  type Message,
} from '../../../hooks/mapGalgame/common/interactionUtils';
import StreamOutputContainer from './StreamOutputContainer';
import styles from './ContinueButton.module.css';
import type { AllGameData } from '../../../api/worldInteraction/mapWorldData.type';
import type { GetWorldInteractionHistoryResponse } from '../../../api/worldInteraction/interactionApi.type';
import interactionApi from '../../../api/worldInteraction/interactionApi';

// ==================== 类型定义 ====================
interface NpcInteractionContainerProps {
  sessionId: string | null;
  eventId: string | null;
  fileId: string | null;
  gameData: AllGameData | null;
  worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
  isTextMode?: boolean;
  isAutoPlay?: boolean;
  onAutoPlayChange?: (value: boolean) => void;
  onUpdateAttributes?: () => Promise<void>;
  onRefreshEventData?: (sessionId: string, gameData: any) => Promise<void>;
  onContinue?: () => void;
  onCancel?: (restoreFn: () => Promise<void>) => void;
  onRetry?: (retryFn: () => void) => void;
  onCurrentMessageChange?: (message: Message | null) => void;
  setTimeoutModal?: (value: { visible: boolean; message: string }) => void;
  setErrorModal?: (value: { visible: boolean; message: string }) => void;
}

// ==================== 常量 ====================
const AUTO_PLAY_DELAY_MS = 2000;
const CACHE_CLEANUP_DELAY_MS = 3000;

// ==================== 组件 ====================
const NpcInteractionContainer: React.FC<NpcInteractionContainerProps> = ({
  sessionId,
  eventId,
  fileId,
  gameData,
  worldInteractionHistory,
  isTextMode = false,
  isAutoPlay = false,
  onAutoPlayChange,
  onUpdateAttributes,
  onRefreshEventData,
  onContinue,
  onCancel,
  onRetry,
  onCurrentMessageChange,
  setTimeoutModal,
  setErrorModal,
}) => {
  // ==================== Props 和基础变量 ====================
  const worldSetting = gameData?.worldSetting || null;

  // ==================== 状态管理 ====================
  const [gameStarted, setGameStarted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<any[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestForPoll, setPendingRequestForPoll] = useState<any>(null);
  const [latestHistory, setLatestHistory] = useState<GetWorldInteractionHistoryResponse | null>(worldInteractionHistory);

  // ==================== Refs ====================
  const refs = useRef({
    previousStep: null as any,
    previousIsTyping: false,
    isRestoringFromCache: false,
    choiceInFlight: false,
    lastRequest: null as any,
    isChoiceRequest: false,
  });
  const refreshTimerRef = useRef<number | null>(null);
  const hasCleanedCacheRef = useRef<boolean>(false);
  const restorePendingRequestRef = useRef(false);
  const prevStepKeyRef = useRef<string | null>(null);
  const prevStepKeyForTextModalRef = useRef<string | null>(null);

  // ==================== Hooks 初始化 ====================
  const streamRequestManager = useNpcStreamRequestManager({
    sessionId,
    eventId,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal: setTimeoutModal || (() => {}),
    setErrorModal: setErrorModal || (() => {}),
  });

  const stepHandlers = useNpcInteractionStep({
    sessionId,
    eventId,
    fileId,
    historyLength: latestHistory?.interactions.length ?? 0,
    onMessagesClear: () => {
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
      refs.current.isChoiceRequest = false;
    },
  });

  const retryHandler = useNpcRetryHandler({
    stepHandlers: {
      handleInteract: stepHandlers.handleInteract,
      handleChoiceOption: stepHandlers.handleChoiceOption,
    },
    setErrorModal: setErrorModal || (() => {}),
    setTimeoutModal: setTimeoutModal || (() => {}),
  });

  // ==================== 数据计算（useMemo）====================
  // 历史选择消息
  const historyChoiceMessage: Message | null = useMemo(() => {
    if (!latestHistory || !latestHistory.interactions.length) return null;
    const last = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
    if (last.type !== 'npc_dialogue') return null;
    if (!last.narrativeSteps || !Array.isArray(last.narrativeSteps) || last.narrativeSteps.length === 0) return null;
    const lastStep = last.narrativeSteps[last.narrativeSteps.length - 1];
    if (!lastStep || !lastStep.options || !Array.isArray(lastStep.options)) return null;
    const options = lastStep.options.map((opt: any, index: number) => ({
      id: index + 1,
      text: opt.text,
      optionId: opt.optionId,
    }));
    return {
      id: Date.now(),
      type: 'choice',
      message: '请选择你的行动',
      options,
      characterImage: undefined,
      characterPosition: 'right',
    };
  }, [latestHistory, worldSetting]);

  // 当前消息
  const currentMessage = useMemo((): Message => {
    if (gameStarted && stepHandlers.currentStep && stepHandlers.currentStep.type) {
      const converted = convertStepToMessage(stepHandlers.currentStep, worldSetting);
      if (converted) return converted;
    }
    if (historyChoiceMessage && !hasPendingRequest && !stepHandlers.isWaitingForData) {
      return historyChoiceMessage;
    }
    if (hasPendingRequest || stepHandlers.isWaitingForData) {
      return { id: 0, type: 'narration', message: '' };
    }
    if (gameStarted && latestHistory?.interactions?.length) {
      const lastInteraction = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
      if (lastInteraction.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
        for (let i = lastInteraction.narrativeSteps.length - 1; i >= 0; i--) {
          const step = lastInteraction.narrativeSteps[i];
          if (step && step.type && step.type !== 'choice') {
            const converted = convertStepToMessage(step, worldSetting);
            if (converted) return converted;
          }
        }
      }
    }
    return { id: 0, type: 'narration', message: '' };
  }, [
    gameStarted,
    stepHandlers.currentStep,
    stepHandlers.isWaitingForData,
    worldSetting,
    historyChoiceMessage,
    hasPendingRequest,
    latestHistory,
  ]);

  // 当前步骤的唯一标识
  const currentStepKey = useMemo(() => {
    if (stepHandlers.currentStep) {
      return stepHandlers.currentStep.id || stepHandlers.currentStep.content || JSON.stringify(stepHandlers.currentStep);
    }
    return null;
  }, [stepHandlers.currentStep]);

  // 打字效果的纯文本
  const plainTextForTyping = useMemo(() => {
    if (currentMessage && currentMessage.type !== 'choice' && currentStepKey) {
      return extractPlainText(currentMessage.message);
    }
    return '';
  }, [currentMessage, currentStepKey]);

  // 打字效果
  const { displayedText, isTyping } = useStoryTyping({
    text: plainTextForTyping,
    enabled: currentMessage && currentMessage.type !== 'choice' && gameStarted && !!plainTextForTyping && !!currentStepKey,
    speed: 60,
  });

  // 最终显示的文本
  const finalDisplayText = useMemo(() => {
    const isStepChanged = currentStepKey !== prevStepKeyRef.current;
        if (isStepChanged) {
      prevStepKeyRef.current = currentStepKey;
      return '';
    }

    if (displayedText.length > plainTextForTyping.length && plainTextForTyping.length > 0) {
      return '';
    }

    return (stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep
      ? ''
      : gameStarted && currentStepKey
      ? displayedText
      : currentMessage && currentMessage.type !== 'choice' && !gameStarted
      ? currentMessage.message
      : '';
  }, [
    currentStepKey,
    displayedText,
    plainTextForTyping,
    stepHandlers.isWaitingForData,
    stepHandlers.currentStep,
    hasPendingRequest,
    gameStarted,
    currentMessage,
  ]);

  const finalIsTyping =
    (stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep ? false : isTyping;

  // 文本模式数据
  const allStepsForTextModal = useMemo(() => {
    let validSteps = completedSteps.filter((s) => s && s.type);
    if (stepHandlers.currentStep?.type) {
      const exists = validSteps.some(
        (s) => s.type === stepHandlers.currentStep.type && s.content === stepHandlers.currentStep.content
      );
      if (!exists) {
        validSteps = [...validSteps, stepHandlers.currentStep];
      }
    }
    if (validSteps.length === 0 && latestHistory?.interactions?.length) {
      const lastInteraction = latestHistory.interactions[latestHistory.interactions.length - 1] as any;
      if (lastInteraction.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
        validSteps = [...lastInteraction.narrativeSteps];
      }
    }
    const choiceIndices = validSteps.map((step, index) => (step?.type === 'choice' ? index : -1)).filter((idx) => idx >= 0);
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
        (s) => s && s.type === stepHandlers.currentStep.type && s.content === stepHandlers.currentStep.content
      );
      if (index >= 0) return index;
    }
    if (allStepsForTextModal.length > 0) {
      return allStepsForTextModal.length - 1;
    }
    return -1;
  }, [allStepsForTextModal, stepHandlers.currentStep]);

  const textModalDisplayText = useMemo(() => {
    // 检测步骤切换，如果切换了但 displayedText 还没重置，返回空字符串
    const isStepChanged = currentStepKey !== prevStepKeyForTextModalRef.current;
    if (isStepChanged) {
      prevStepKeyForTextModalRef.current = currentStepKey;
      // 如果 displayedText 还有内容，说明是上一个步骤的文本，立即清空
      if (displayedText.length > 0) {
        return '';
      }
    }

    // 如果 displayedText 的长度大于新的 plainTextForTyping，说明是上一个步骤的文本，返回空字符串
    if (displayedText.length > plainTextForTyping.length && plainTextForTyping.length > 0) {
      return '';
    }

    if (
      stepHandlers.currentStep &&
      stepHandlers.currentStep.type !== 'choice' &&
      currentMessage &&
      currentMessage.type !== 'choice' &&
      isTyping &&
      displayedText.length > 0
    ) {
      const originalText = currentMessage.message || '';
      const currentPlainLength = displayedText.length;
      if (currentPlainLength > 0) {
        return truncateTextWithTags(originalText, currentPlainLength);
      }
    }
    return '';
  }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping, currentStepKey, plainTextForTyping]);

  // 是否显示继续按钮
  const shouldShowContinueButton = useMemo(() => {
    const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
    const isShowingChoiceUI = currentMessage?.type === 'choice';
    if (isChoiceStep || isShowingChoiceUI) return false;
    return (
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
      !hasPendingRequest &&
      gameStarted &&
      queueEmpty &&
      !stepHandlers.showNextButton
    );
  }, [
    stepHandlers.stepQueue,
    stepHandlers.isWaitingForData,
    stepHandlers.showNextButton,
    stepHandlers.currentStep,
    currentMessage?.type,
    finalIsTyping,
    hasPendingRequest,
    gameStarted,
  ]);

  // ==================== 事件处理（useCallback）====================
  const handleNextMessage = useCallback(() => {
    if (gameStarted && stepHandlers.showNextButton) {
      if (stepHandlers.stepQueue && stepHandlers.stepQueue.length === 0) {
        return;
      }
      stepHandlers.handleNextStep();
    }
  }, [gameStarted, stepHandlers]);

  const handleChoiceClick = useCallback(
    (option: { text: string; optionId?: string; isCustomInput?: boolean }) => {
      if (refs.current.choiceInFlight || hasPendingRequest || stepHandlers.isWaitingForData) {
        return;
      }
      refs.current.choiceInFlight = true;
      refs.current.isChoiceRequest = true;
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;

      const isCustomInput = option.isCustomInput === true;
      let optionId: string | undefined = option.optionId;
      let optionIndex = -1;

      if (!optionId) {
        if (stepHandlers.currentStep && stepHandlers.currentStep.type === 'choice') {
          optionIndex =
            stepHandlers.currentStep.options?.findIndex((opt: any) => {
              if (typeof opt === 'string') return opt === option.text;
              return opt.text === option.text || opt.optionId === option.optionId;
            }) ?? -1;
          if (optionIndex >= 0) {
            const stepOption = stepHandlers.currentStep.options?.[optionIndex];
            if (stepOption && typeof stepOption !== 'string') {
              optionId = stepOption.optionId ? String(stepOption.optionId) : undefined;
            }
          }
        }
        if (optionIndex < 0 && currentMessage && currentMessage.type === 'choice' && currentMessage.options) {
          optionIndex = currentMessage.options.findIndex((opt: any) => {
            return opt.text === option.text || opt.optionId === option.optionId;
          });
          if (optionIndex >= 0) {
            const msgOption = currentMessage.options[optionIndex] as any;
            optionId = msgOption.optionId ? String(msgOption.optionId) : undefined;
          }
        }
      }

      if (!optionId) {
        console.error('无法找到选项或 optionId:', { option, optionIndex, optionId });
        refs.current.choiceInFlight = false;
        return;
      }

      const finalOptionIndex = isCustomInput
        ? -1
        : optionIndex >= 0
          ? optionIndex
          : 0;
      refs.current.lastRequest = { type: 'choice', optionId, optionIndex: finalOptionIndex };

      streamRequestManager.recordRequestStart({
        type: 'choice',
        optionId,
        optionIndex: finalOptionIndex,
        timestamp: Date.now(),
      });
      retryHandler.recordLastRequest({ type: 'choice', optionId, optionIndex: finalOptionIndex });

      stepHandlers
        .handleChoiceOption(optionId, finalOptionIndex, {
          onSuccess: async () => {
            streamRequestManager.recordRequestComplete();
            refs.current.choiceInFlight = false;
            refs.current.isChoiceRequest = false;
            const eventCompleted = await streamRequestManager.checkEventCompletion();
            if (eventCompleted) {
              console.log('[NpcInteractionContainer] Event 已完成，但前端状态未更新');
            }
            if (sessionId && gameData && onRefreshEventData) {
              await onRefreshEventData(sessionId, gameData);
            }
          },
          onFirstStep: () => {
            streamRequestManager.clearRequestTimeout();
            refs.current.choiceInFlight = false;
            onUpdateAttributes?.();
          },
          onError: async (error) => {
            refs.current.choiceInFlight = false;
            const eventCompleted = await streamRequestManager.checkEventCompletion();
            if (eventCompleted) {
              streamRequestManager.recordRequestError('事件已完成，但前端状态未更新。请刷新页面。', false);
            } else {
              streamRequestManager.recordRequestError(error || '选择选项失败，请检查网络或稍后重试。', true);
            }
          },
        })
        .finally(() => {
          refs.current.choiceInFlight = false;
        });
    },
    [hasPendingRequest, stepHandlers, currentMessage, sessionId, gameData, streamRequestManager, retryHandler, onUpdateAttributes, onRefreshEventData]
  );

  const handleCustomInputSubmit = useCallback(
    (customText: string) => {
      if (!customText.trim()) return;
      handleChoiceClick({ text: customText, optionId: customText.trim(), isCustomInput: true });
    },
    [handleChoiceClick]
  );

  const handlePollMatchFound = useCallback(
    async (matchedSteps: any[]) => {
      if (!matchedSteps.length) return;
      const [first, ...rest] = matchedSteps;
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
      stepHandlers.setCurrentStep(first || null);
      stepHandlers.setStepQueue(rest || []);
      stepHandlers.setShowNextButton(first?.type !== 'choice');
      setHasPendingRequest(false);
      const storageKeys = getStorageKeys(sessionId, eventId);
      if (storageKeys.pendingRequest) {
        safeRemoveLocalStorage(storageKeys.pendingRequest);
      }
    },
    [setHasPendingRequest, stepHandlers, sessionId, eventId]
  );

  const handlePollTimeout = useCallback(() => {
    setHasPendingRequest(false);
    setPendingRequestForPoll(null);
    if (setTimeoutModal) {
      setTimeoutModal({
        visible: true,
        message: '轮询超时，未能获取到历史记录。请重试或取消。',
      });
    }
  }, [setTimeoutModal]);

  const handlePollError = useCallback((error: string) => {
    setHasPendingRequest(false);
    setPendingRequestForPoll(null);
    if (setErrorModal) {
      setErrorModal({
        visible: true,
        message: error || '轮询请求失败，请检查网络连接后重试。',
      });
    }
  }, [setErrorModal]);

  const handlePollEnd = useCallback(async () => {
    setPendingRequestForPoll(null);
    if (sessionId) {
      try {
        const response = await interactionApi.getWorldInteractionHistory(sessionId);
        if (response.data?.success) {
          setLatestHistory(response.data);
        }
      } catch (error) {
        console.error('[NpcInteractionContainer] 获取历史记录失败:', error);
      }
    }
  }, [sessionId]);

  const restoreToLastStep = useCallback(async () => {
    if (!refs.current.isChoiceRequest) {
      stepHandlers.setCurrentStep(null);
      stepHandlers.setStepQueue([]);
      stepHandlers.setShowNextButton(false);
      setHasPendingRequest(false);
      setPendingRequestForPoll(null);
      setGameStarted(false);
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
      return;
    }

    if (!sessionId || !latestHistory?.interactions?.length) {
      return;
    }

    try {
      const response = await interactionApi.getWorldInteractionHistory(sessionId);
      if (response.data?.success) {
        const updatedHistory = response.data;
        setLatestHistory(updatedHistory);

        const lastInteraction = updatedHistory.interactions[updatedHistory.interactions.length - 1] as any;
        if (lastInteraction?.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
          for (let i = lastInteraction.narrativeSteps.length - 1; i >= 0; i--) {
            const step = lastInteraction.narrativeSteps[i];
            if (step && step.type && step.type !== 'choice') {
              stepHandlers.setCurrentStep(step);
              stepHandlers.setStepQueue([]);
              stepHandlers.setShowNextButton(false);
              setHasPendingRequest(false);
              setPendingRequestForPoll(null);
              setGameStarted(true);
              refs.current.isChoiceRequest = false;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('[NpcInteractionContainer] 恢复最后一个step失败:', error);
    }
  }, [sessionId, latestHistory, stepHandlers]);

  // ==================== 副作用（useEffect）====================
  // 页面刷新后恢复未完成的请求
  useEffect(() => {
    if (!sessionId || !eventId || restorePendingRequestRef.current) return;
    restorePendingRequestRef.current = true;
    const restoredRequest = streamRequestManager.restorePendingRequest();
    if (restoredRequest) {
      setGameStarted(true);
    }
  }, [sessionId, eventId, streamRequestManager]);

  // 初始化
  useNpcInteractionInit({
    sessionId,
    eventId,
    gameData,
    fileId,
    gameStarted,
    setGameStarted,
    setLatestHistory,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal: setTimeoutModal || (() => {}),
    setErrorModal: setErrorModal || (() => {}),
    stepHandlers: {
      setCurrentStep: stepHandlers.setCurrentStep,
      setStepQueue: stepHandlers.setStepQueue,
      setShowNextButton: stepHandlers.setShowNextButton,
      handleInteract: stepHandlers.handleInteract,
    },
    resetCompletedSteps: () => {
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
    },
    setRestoringFromCache: (value) => {
      refs.current.isRestoringFromCache = value;
    },
    onUpdateAttributes,
    onRefreshEventData,
    setLastRequest: (request) => {
      refs.current.lastRequest = request;
    },
    onRequestStart: () => {
      streamRequestManager.recordRequestStart({
        type: 'interact',
        timestamp: Date.now(),
      });
      retryHandler.recordLastRequest({ type: 'interact' });
    },
    onRequestComplete: () => {
      streamRequestManager.recordRequestComplete();
    },
    onRequestError: (error) => {
      streamRequestManager.recordRequestError(error, true);
    },
    clearRequestTimeout: () => {
      streamRequestManager.clearRequestTimeout();
    },
  });

  // 历史轮询
  useHistoryPolling({
    sessionId,
    eventId,
    pendingRequest: pendingRequestForPoll,
    onHistoryUpdate: setLatestHistory,
    onMatchFound: handlePollMatchFound,
    onTimeout: handlePollTimeout,
    onError: handlePollError,
    onPollEnd: handlePollEnd,
  });

  // 自动播放
  useEffect(() => {
    if (!isAutoPlay || !gameStarted) return;
    if (stepHandlers.isWaitingForData) return;
    if (finalIsTyping) return;
    if (!stepHandlers.showNextButton) return;
    if (currentMessage?.type === 'choice') {
      onAutoPlayChange?.(false);
      return;
    }

    const autoPlayTimer = setTimeout(() => {
      if (isAutoPlay && !finalIsTyping && stepHandlers.showNextButton && currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
        handleNextMessage();
      }
    }, AUTO_PLAY_DELAY_MS);

    return () => clearTimeout(autoPlayTimer);
  }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage, onAutoPlayChange]);

  // 缓存清理
  useEffect(() => {
    if (refs.current.isRestoringFromCache) return;
    const storageKeys = getStorageKeys(sessionId, eventId);
    if (!storageKeys.allSteps || !storageKeys.incomplete) return;

    const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
    const allStepsCompleted =
      gameStarted && queueEmpty && !stepHandlers.isWaitingForData && !finalIsTyping && !stepHandlers.showNextButton;
    const shouldCleanCache = isChoiceStep
      ? gameStarted && !stepHandlers.isWaitingForData && !stepHandlers.showNextButton
      : allStepsCompleted && stepHandlers.currentStep;

    if (shouldCleanCache && !hasCleanedCacheRef.current) {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      safeRemoveLocalStorage(storageKeys.allSteps);
      safeRemoveLocalStorage(storageKeys.incomplete);
      hasCleanedCacheRef.current = true;
      refreshTimerRef.current = window.setTimeout(async () => {
        if (sessionId && gameData && onRefreshEventData) {
          await onRefreshEventData(sessionId, gameData);
        }
        refreshTimerRef.current = null;
      }, CACHE_CLEANUP_DELAY_MS);
    } else if (!shouldCleanCache) {
      hasCleanedCacheRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    }

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
    onRefreshEventData,
  ]);

  // 记录已完成步骤
  useEffect(() => {
    const currentStep = stepHandlers.currentStep;
    const prevStep = refs.current.previousStep;
    if (prevStep && currentStep !== prevStep && !isTyping) {
      setCompletedSteps((prev) => {
        const exists = prev.some((s) => s && s.type === prevStep.type && s.content === prevStep.content);
        return exists ? prev : [...prev, prevStep];
      });
    }
    refs.current.previousStep = currentStep;
    refs.current.previousIsTyping = isTyping;
  }, [stepHandlers.currentStep, isTyping]);

  // 暴露恢复函数和重试函数给父组件
  useEffect(() => {
    if (onCancel) {
      onCancel(restoreToLastStep);
    }
  }, [onCancel, restoreToLastStep]);

  useEffect(() => {
    if (onRetry) {
      onRetry(retryHandler.handleRetryRequest);
    }
  }, [onRetry, retryHandler.handleRetryRequest]);

  // 暴露当前消息给父组件（用于显示立绘）
  useEffect(() => {
    if (onCurrentMessageChange) {
      onCurrentMessageChange(currentMessage);
    }
  }, [onCurrentMessageChange, currentMessage]);

  // ==================== 渲染 ====================
  return (
    <>
      <StreamOutputContainer
        isTextMode={isTextMode}
        isAutoPlay={isAutoPlay}
        currentMessage={currentMessage}
        finalDisplayText={finalDisplayText}
        finalIsTyping={finalIsTyping}
        allSteps={allStepsForTextModal}
        currentStepIndex={currentStepIndex}
        textModalDisplayText={textModalDisplayText}
        isWaitingForData={stepHandlers.isWaitingForData || hasPendingRequest}
        showNextButton={stepHandlers.showNextButton}
        currentStep={stepHandlers.currentStep}
        selectedOptionIndex={stepHandlers.selectedOptionIndex}
        stepQueue={stepHandlers.stepQueue}
        historyLength={stepHandlers.localHistoryLength ?? latestHistory?.interactions.length ?? 0}
        worldSetting={worldSetting}
        onNextMessage={handleNextMessage}
        onChoiceClick={handleChoiceClick}
        onCustomInputSubmit={handleCustomInputSubmit}
      />
      {shouldShowContinueButton && onContinue && (
        <button onClick={onContinue} className={styles.continueButton}>
          继续游戏
        </button>
      )}
    </>
  );
};

export default NpcInteractionContainer;
