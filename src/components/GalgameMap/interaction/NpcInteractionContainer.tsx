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

interface NpcInteractionContainerProps {
  sessionId: string | null;
  eventId: string | null;
  fileId: string | null;
  gameData: AllGameData | null;
  worldInteractionHistory: GetWorldInteractionHistoryResponse | null;
  isTextMode?: boolean;
  isAutoPlay?: boolean;
  onAutoPlayChange?: (value: boolean) => void; // 当遇到选择时通知父组件关闭自动播放
  onUpdateAttributes?: () => Promise<void>;
  onRefreshEventData?: (sessionId: string, gameData: any) => Promise<void>;
  onContinue?: () => void;
  onCancel?: (restoreFn: () => Promise<void>) => void; // 取消请求时的回调，传递恢复函数
  onRetry?: (retryFn: () => void) => void; // 重试请求时的回调，传递重试函数
  onCurrentMessageChange?: (message: Message | null) => void; // 当前消息变化时的回调，用于显示立绘
  setTimeoutModal?: (value: { visible: boolean; message: string }) => void; // 设置超时弹窗
  setErrorModal?: (value: { visible: boolean; message: string }) => void; // 设置错误弹窗
}

const AUTO_PLAY_DELAY_MS = 2000;
const CACHE_CLEANUP_DELAY_MS = 3000;

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
  const worldSetting = gameData?.worldSetting || null;
  const [gameStarted, setGameStarted] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<any[]>([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [pendingRequestForPoll, setPendingRequestForPoll] = useState<any>(null);
  const [latestHistory, setLatestHistory] = useState<GetWorldInteractionHistoryResponse | null>(worldInteractionHistory);

  const refs = useRef({
    previousStep: null as any,
    previousIsTyping: false,
    isRestoringFromCache: false,
    choiceInFlight: false,
    lastRequest: null as any,
    isChoiceRequest: false, // 标记是否是选择选项后的请求
  });

  const refreshTimerRef = useRef<number | null>(null);
  const hasCleanedCacheRef = useRef<boolean>(false);

  // 请求管理器（弹窗逻辑由父组件处理，这里只提供回调）
  const streamRequestManager = useNpcStreamRequestManager({
    sessionId,
    eventId,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal: setTimeoutModal || (() => {}), // 由父组件处理
    setErrorModal: setErrorModal || (() => {}), // 由父组件处理
  });

  // 步骤处理器
  const stepHandlers = useNpcInteractionStep({
    sessionId,
    eventId,
    fileId,
    historyLength: latestHistory?.interactions.length ?? 0,
    onMessagesClear: () => {
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;
      refs.current.isChoiceRequest = false; // 清除消息时重置标记
    },
  });

  // 重试处理器
  const retryHandler = useNpcRetryHandler({
    stepHandlers: {
      handleInteract: stepHandlers.handleInteract,
      handleChoiceOption: stepHandlers.handleChoiceOption,
    },
    setErrorModal: setErrorModal || (() => {}),
    setTimeoutModal: setTimeoutModal || (() => {}),
  });

  // 页面刷新后恢复未完成的请求
  const restorePendingRequestRef = useRef(false);
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
    setTimeoutModal: setTimeoutModal || (() => {}), // 由父组件处理
    setErrorModal: setErrorModal || (() => {}), // 由父组件处理
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
      // 记录最后一次请求，用于重试
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
    // 轮询超时，显示超时弹窗（支持重发）
    if (setTimeoutModal) {
      setTimeoutModal({
        visible: true,
        message: '轮询超时，未能获取到历史记录。请重试或取消。',
      });
    }
  }, [setTimeoutModal]);

  // 轮询错误处理（网络错误等）
  const handlePollError = useCallback((error: string) => {
    setHasPendingRequest(false);
    setPendingRequestForPoll(null);
    // 轮询错误，显示错误弹窗（支持重发）
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

  // 当前消息
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

  // 打字效果
  const plainTextForTyping = useMemo(() => {
    if (currentMessage && currentMessage.type !== 'choice') {
      return extractPlainText(currentMessage.message);
    }
    return '';
  }, [currentMessage]);

  const { displayedText, isTyping } = useStoryTyping({
    text: plainTextForTyping,
    enabled: currentMessage && currentMessage.type !== 'choice' && gameStarted && !!plainTextForTyping,
    speed: 60,
  });

  const finalDisplayText =
    (stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep
      ? ''
      : gameStarted
      ? displayedText
      : currentMessage && currentMessage.type !== 'choice'
      ? currentMessage.message
      : '';

  const finalIsTyping =
    (stepHandlers.isWaitingForData || hasPendingRequest) && !stepHandlers.currentStep ? false : isTyping;

  // 处理下一步
  const handleNextMessage = useCallback(() => {
    if (gameStarted && stepHandlers.showNextButton) {
      if (stepHandlers.stepQueue && stepHandlers.stepQueue.length === 0) {
        return;
      }
      stepHandlers.handleNextStep();
    }
  }, [gameStarted, stepHandlers]);

  // 处理选择
  const handleChoiceClick = useCallback(
    (option: { text: string; optionId?: string }) => {
      if (refs.current.choiceInFlight || hasPendingRequest || stepHandlers.isWaitingForData) {
        return;
      }
      refs.current.choiceInFlight = true;
      refs.current.isChoiceRequest = true; // 标记这是选择选项后的请求
      setCompletedSteps([]);
      refs.current.previousStep = null;
      refs.current.previousIsTyping = false;

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

      const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;
      refs.current.lastRequest = { type: 'choice', optionId, optionIndex: finalOptionIndex };

      // 记录请求开始
      streamRequestManager.recordRequestStart({
        type: 'choice',
        optionId,
        optionIndex: finalOptionIndex,
        timestamp: Date.now(),
      });
      // 记录最后一次请求，用于重试
      retryHandler.recordLastRequest({ type: 'choice', optionId, optionIndex: finalOptionIndex });

      stepHandlers
        .handleChoiceOption(optionId, finalOptionIndex, {
          onSuccess: async () => {
            streamRequestManager.recordRequestComplete();
            refs.current.choiceInFlight = false;
            refs.current.isChoiceRequest = false; // 请求成功后重置标记
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
    [hasPendingRequest, stepHandlers, currentMessage, sessionId, gameData, streamRequestManager, onUpdateAttributes, onRefreshEventData]
  );

  // 处理自定义输入
  const handleCustomInputSubmit = useCallback(
    (customText: string) => {
      if (!customText.trim()) return;
      handleChoiceClick({ text: customText, optionId: customText.trim() });
    },
    [handleChoiceClick]
  );

  // 自动播放
  useEffect(() => {
    if (!isAutoPlay || !gameStarted) return;
    if (stepHandlers.isWaitingForData) return;
    if (finalIsTyping) return;
    if (!stepHandlers.showNextButton) return;
    if (currentMessage?.type === 'choice') {
      // 遇到选择时，通知父组件关闭自动播放
      onAutoPlayChange?.(false);
      return;
    }

    const autoPlayTimer = setTimeout(() => {
      if (isAutoPlay && !finalIsTyping && stepHandlers.showNextButton && currentMessage?.type !== 'choice' && !stepHandlers.isWaitingForData) {
        handleNextMessage();
      }
    }, AUTO_PLAY_DELAY_MS);

    return () => clearTimeout(autoPlayTimer);
  }, [isAutoPlay, finalIsTyping, stepHandlers.showNextButton, stepHandlers.isWaitingForData, currentMessage?.type, gameStarted, handleNextMessage]);

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

  // 计算文本模式数据
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
  }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping]);

  // 恢复到最后一个step（取消请求时使用）
  const restoreToLastStep = useCallback(async () => {
    // 只有在选择选项后的请求才恢复到历史记录的最后一条
    // 初始交互时，直接重置状态
    if (!refs.current.isChoiceRequest) {
      // 初始交互取消：直接重置状态
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

    // 选择选项后的请求取消：恢复到当前交互的最后一个step
    if (!sessionId || !latestHistory?.interactions?.length) {
      return;
    }

    try {
      // 刷新历史记录
      const response = await interactionApi.getWorldInteractionHistory(sessionId);
      if (response.data?.success) {
        const updatedHistory = response.data;
        setLatestHistory(updatedHistory);

        // 找到最后一个交互的最后一个非choice step
        const lastInteraction = updatedHistory.interactions[updatedHistory.interactions.length - 1] as any;
        if (lastInteraction?.type === 'npc_dialogue' && Array.isArray(lastInteraction.narrativeSteps)) {
          // 从后往前找最后一个非choice的step
          for (let i = lastInteraction.narrativeSteps.length - 1; i >= 0; i--) {
            const step = lastInteraction.narrativeSteps[i];
            if (step && step.type && step.type !== 'choice') {
              // 设置当前step
              stepHandlers.setCurrentStep(step);
              stepHandlers.setStepQueue([]);
              stepHandlers.setShowNextButton(false);
              // setIsWaitingForData 不在 stepHandlers 中，通过重置状态来清除等待状态
              setHasPendingRequest(false);
              setPendingRequestForPoll(null);
              setGameStarted(true);
              refs.current.isChoiceRequest = false; // 重置标记
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('[NpcInteractionContainer] 恢复最后一个step失败:', error);
    }
  }, [sessionId, latestHistory, stepHandlers]);

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

  // 判断是否显示继续按钮
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

  // // 测试按钮：触发超时弹窗
  // const handleTestTimeout = useCallback(() => {
  //   if (setTimeoutModal) {
  //     setTimeoutModal({
  //       visible: true,
  //       message: TIMEOUT_MESSAGES.INTERACT,
  //     });
  //   }
  // }, [setTimeoutModal]);

  // // 测试按钮：触发错误弹窗
  // const handleTestError = useCallback(() => {
  //   if (setErrorModal) {
  //     setErrorModal({
  //       visible: true,
  //       message: '这是一个测试错误消息，用于测试错误弹窗的重试和取消功能。',
  //     });
  //   }
  // }, [setErrorModal]);

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
      {/* 测试按钮：仅在开发环境显示 */}
      {/* {import.meta.env.DEV && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
        }}>
          <button
            onClick={handleTestTimeout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
            title="测试超时弹窗"
          >
            测试超时
          </button>
          <button
            onClick={handleTestError}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
            }}
            title="测试错误弹窗"
          >
            测试错误
          </button>
        </div>
      )} */}
    </>
  );
};

export default NpcInteractionContainer;

