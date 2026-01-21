/**
 * 功能性NPC交互容器组件
 * 管理单个请求的流式输出
 * 处理：刷新页面保存状态、请求失败、请求超时
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAbilityNodeInteractionStep } from '../../../hooks/mapGalgame/abilityNode/useAbilityNodeInteractionStep';
import { useAbilityNodeStreamRequestManager } from '../../../hooks/mapGalgame/abilityNode/useAbilityNodeStreamRequestManager';
import { useStoryTyping } from '../../../hooks/story/useStoryTyping';
import { extractPlainText } from '../../../utils/textUtils';
import { convertStepToMessage } from '../../../hooks/mapGalgame/common/interactionUtils';
import StreamOutputContainer from './StreamOutputContainer';
import styles from './ContinueButton.module.css';
import { authFetch } from '../../../api/base';
import { HOST_ADDRESS } from '../../../config';
import type { AllGameData } from '../../../api/worldInteraction/mapWorldData.type';

interface AbilityNodeInteractionContainerProps {
  sessionId: string | null;
  fileId?: string | null; // 功能性NPC可能不需要fileId
  gameData: AllGameData | null;
  pendingAction: { nodeId: string; actionId: string };
  isTextMode?: boolean;
  onUpdateAttributes?: () => Promise<void>;
  onRefreshEventData?: (sessionId: string, gameData: any) => Promise<void>;
  onContinue?: () => void;
  onCancel?: (restoreFn: () => void) => void; // 取消请求时的回调，传递恢复函数
  onRetry?: (retryFn: () => void) => void; // 重试请求时的回调，传递重试函数
  setTimeoutModal?: (value: { visible: boolean; message: string }) => void; // 设置超时弹窗
  setErrorModal?: (value: { visible: boolean; message: string }) => void; // 设置错误弹窗
}

const AbilityNodeInteractionContainer: React.FC<AbilityNodeInteractionContainerProps> = ({
  sessionId,
  fileId: _fileId, // 功能性NPC暂时不需要fileId
  gameData,
  pendingAction,
  isTextMode = false,
  onUpdateAttributes,
  onRefreshEventData,
  onContinue,
  onCancel,
  onRetry,
  setTimeoutModal,
  setErrorModal,
}) => {
  const worldSetting = gameData?.worldSetting || null;
  const [gameStarted, setGameStarted] = useState(false);
  const processedPendingActionRef = useRef<{ nodeId: string; actionId: string } | null>(null);
  const currentNodeIdRef = useRef<string | null>(null);

  // 请求管理器（功能性NPC专用，不包含轮询）
  const streamRequestManager = useAbilityNodeStreamRequestManager({
    sessionId,
    setTimeoutModal: setTimeoutModal || (() => {}), // 由父组件处理
    setErrorModal: setErrorModal || (() => {}), // 由父组件处理
  });

  // 步骤处理器（功能性NPC专用，简化版）
  const stepHandlers = useAbilityNodeInteractionStep({
    sessionId,
    onMessagesClear: () => {
      // 功能性NPC不需要保存状态
    },
  });

  // 重试处理器 - 创建重试函数
  const handleRetryRequest = useCallback(async () => {
    if (!sessionId || !processedPendingActionRef.current) {
      setErrorModal?.({ visible: true, message: '没有可重试的请求' });
      return;
    }

    const { nodeId, actionId } = processedPendingActionRef.current;

    // 重置状态
    stepHandlers.setCurrentStep(null);
    stepHandlers.setStepQueue([]);
    stepHandlers.setShowNextButton(false);
    stepHandlers.setIsWaitingForData(true);

    // 记录请求开始
    streamRequestManager.recordRequestStart({
      nodeId,
      actionId,
      timestamp: Date.now(),
    });

    try {
      const response = await authFetch(
        `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/ability-node/${nodeId}/select-action/stream`,
        {
          method: 'POST',
          body: JSON.stringify({ actionId }),
        }
      );

      if (!response.ok || !response.body) {
        streamRequestManager.recordRequestError('请求失败，请重试', true);
        return;
      }

      if (response.body.locked) {
        streamRequestManager.recordRequestError('响应体已被锁定', true);
        return;
      }

      const requestId = ++stepHandlers.currentRequestId.current;

      await stepHandlers.processStreamResponse(response, requestId, {
        onErrorAfterAlert: (errorMessage) => {
          streamRequestManager.recordRequestError(errorMessage, true);
        },
        onFirstStep: () => {
          streamRequestManager.clearRequestTimeout();
          onUpdateAttributes?.();
        },
        onSuccess: async () => {
          streamRequestManager.recordRequestComplete();
          if (sessionId && gameData && onRefreshEventData) {
            await onRefreshEventData(sessionId, gameData);
          }
        },
        onError: (error: string) => {
          streamRequestManager.recordRequestError(error, true);
        },
      });
    } catch (error: any) {
      streamRequestManager.recordRequestError(error.message || '处理失败，请重试', true);
    }
  }, [sessionId, stepHandlers, streamRequestManager, gameData, onUpdateAttributes, onRefreshEventData, setErrorModal]);

  // 当前消息
  const currentMessage = useMemo((): any => {
    if (gameStarted && stepHandlers.currentStep && stepHandlers.currentStep.type) {
      return convertStepToMessage(stepHandlers.currentStep, worldSetting);
    }
    return null;
  }, [gameStarted, stepHandlers.currentStep, worldSetting]);

  // 追踪当前步骤的唯一标识，用于检测步骤变化（避免闪动/确保打字效果在 step 切换时重置）
  const currentStepKey = useMemo(() => {
    if (stepHandlers.currentStep) {
      return (
        stepHandlers.currentStep.id ||
        stepHandlers.currentStep.content ||
        JSON.stringify(stepHandlers.currentStep)
      );
    }
    return null;
  }, [stepHandlers.currentStep]);

  // 打字效果
  const plainTextForTyping = useMemo(() => {
    if (currentMessage && currentMessage.type !== 'choice' && currentStepKey) {
      return extractPlainText(currentMessage.message);
    }
    return '';
  }, [currentMessage, currentStepKey]);

  const { displayedText, isTyping } = useStoryTyping({
    text: plainTextForTyping,
    enabled:
      currentMessage &&
      currentMessage.type !== 'choice' &&
      gameStarted &&
      !!plainTextForTyping &&
      !!currentStepKey,
    speed: 60,
  });

  // 确定最终显示的文本：等待数据且没有 step 时保持为空，避免“闪一下完整文本”
  const finalDisplayText =
    stepHandlers.isWaitingForData && !stepHandlers.currentStep
      ? ''
      : gameStarted && currentStepKey
      ? displayedText
      : currentMessage && currentMessage.type !== 'choice' && !gameStarted
      ? currentMessage.message
      : '';

  const finalIsTyping = stepHandlers.isWaitingForData && !stepHandlers.currentStep ? false : isTyping;

  // 处理功能性NPC交互
  useEffect(() => {
    const isAlreadyProcessed =
      processedPendingActionRef.current &&
      processedPendingActionRef.current.nodeId === pendingAction.nodeId &&
      processedPendingActionRef.current.actionId === pendingAction.actionId;

    if (!sessionId || !stepHandlers.processStreamResponse || isAlreadyProcessed) {
      return;
    }

    processedPendingActionRef.current = { ...pendingAction };
    currentNodeIdRef.current = pendingAction.nodeId;
    setGameStarted(true);
    stepHandlers.setStepQueue([]);
    stepHandlers.setCurrentStep(null);
    stepHandlers.setShowNextButton(false);

    const fetchAndProcessStream = async () => {
      try {
        const { nodeId, actionId } = pendingAction;

        // 设置等待状态，显示加载效果
        stepHandlers.setIsWaitingForData(true);

        // 记录请求开始（在发送请求前设置超时定时器）
        streamRequestManager.recordRequestStart({
          nodeId,
          actionId,
          timestamp: Date.now(),
        });

        const response = await authFetch(
          `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/ability-node/${nodeId}/select-action/stream`,
          {
            method: 'POST',
            body: JSON.stringify({ actionId }),
          }
        );

        if (!response.ok || !response.body) {
          streamRequestManager.recordRequestError('请求失败，请重试', true);
          return;
        }

        if (response.body.locked) {
          streamRequestManager.recordRequestError('响应体已被锁定', true);
          return;
        }

        const requestId = ++stepHandlers.currentRequestId.current;

        // 开始处理流式响应（此时定时器仍在运行，如果超时前没有收到数据，会触发超时弹窗）
        await stepHandlers.processStreamResponse(response, requestId, {
          onErrorAfterAlert: (errorMessage) => {
            streamRequestManager.recordRequestError(errorMessage, true);
          },
          onFirstStep: () => {
            streamRequestManager.clearRequestTimeout();
            onUpdateAttributes?.();
          },
          onSuccess: async () => {
            streamRequestManager.recordRequestComplete();
            if (sessionId && gameData && onRefreshEventData) {
              await onRefreshEventData(sessionId, gameData);
            }
          },
          onError: (error: string) => {
            streamRequestManager.recordRequestError(error, true);
          },
        });
      } catch (error: any) {
        streamRequestManager.recordRequestError(error.message || '处理失败，请重试', true);
      }
    };

    void fetchAndProcessStream();
  }, [pendingAction, sessionId, stepHandlers, streamRequestManager, gameData, onUpdateAttributes, onRefreshEventData]);

  // 计算文本模式数据（功能性NPC简化版，不保存历史）
  const allStepsForTextModal = useMemo(() => {
    if (stepHandlers.currentStep?.type) {
      return [stepHandlers.currentStep];
    }
    return [];
  }, [stepHandlers.currentStep]);

  const currentStepIndex = useMemo(() => {
    if (stepHandlers.currentStep && stepHandlers.currentStep.type) {
      const index = allStepsForTextModal.findIndex(
        (s) => s.type === stepHandlers.currentStep.type && s.content === stepHandlers.currentStep.content
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
      return currentMessage.message || '';
    }
    return '';
  }, [stepHandlers.currentStep, currentMessage, displayedText, isTyping]);

  // 处理下一步
  const handleNextMessage = useCallback(() => {
    if (gameStarted && stepHandlers.showNextButton) {
      stepHandlers.handleNextMessage();
    }
  }, [gameStarted, stepHandlers]);

  // TODO:处理选择（功能性NPC暂不支持选择，后端接口未实现）
  const handleChoiceClick = useCallback(
    (_option: { text: string; optionId?: string }) => {
      console.warn('[AbilityNodeInteractionContainer] 功能性NPC暂不支持选择选项，后端接口未实现');
    },
    []
  );

  // TODO:处理自定义输入
  const handleCustomInputSubmit = useCallback((_customText: string) => {
    // 功能性NPC通常不需要自定义输入，但保留接口
    console.warn('[AbilityNodeInteractionContainer] 功能性NPC不支持自定义输入');
  }, []);

  // 取消操作：只关闭弹窗，保留当前显示的状态
  const restoreToLastStep = useCallback(() => {
    // 清除错误和超时弹窗
    setErrorModal?.({ visible: false, message: '' });
    setTimeoutModal?.({ visible: false, message: '' });
  }, [setErrorModal, setTimeoutModal]);

  // 暴露恢复函数和重试函数给父组件
  useEffect(() => {
    if (onCancel) {
      onCancel(restoreToLastStep);
    }
  }, [onCancel, restoreToLastStep]);

  useEffect(() => {
    if (onRetry) {
      onRetry(handleRetryRequest);
    }
  }, [onRetry, handleRetryRequest]);

  // 判断是否显示继续按钮
  const shouldShowContinueButton = useMemo(() => {
    const queueEmpty = !stepHandlers.stepQueue || stepHandlers.stepQueue.length === 0;
    const isChoiceStep = stepHandlers.currentStep?.type === 'choice';
    const isChoiceMessage = currentMessage?.type === 'choice';
    return (
      !isChoiceStep &&
      !isChoiceMessage &&
      !stepHandlers.isWaitingForData &&
      !finalIsTyping &&
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
    gameStarted,
  ]);

  // 开发环境测试按钮（仅用于测试超时和错误弹窗）
  // const isDev = import.meta.env.DEV;
  // const handleTestTimeout = useCallback(() => {
  //   if (setTimeoutModal) {
  //     setTimeoutModal({
  //       visible: true,
  //       message: TIMEOUT_MESSAGES.ABILITY_NODE,
  //     });
  //   }
  // }, [setTimeoutModal]);
  
  // const handleTestError = useCallback(() => {
  //   if (setErrorModal) {
  //     setErrorModal({
  //       visible: true,
  //       message: '测试错误：这是模拟的错误消息',
  //     });
  //   }
  // }, [setErrorModal]);

  return (
    <>
      <StreamOutputContainer
        isTextMode={isTextMode}
        currentMessage={currentMessage}
        finalDisplayText={finalDisplayText}
        finalIsTyping={finalIsTyping}
        allSteps={allStepsForTextModal}
        currentStepIndex={currentStepIndex}
        textModalDisplayText={textModalDisplayText}
        isWaitingForData={stepHandlers.isWaitingForData}
        showNextButton={stepHandlers.showNextButton}
        currentStep={stepHandlers.currentStep}
        selectedOptionIndex={null}
        historyLength={0}
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
      {/* 开发环境测试按钮 */}
      {/* {isDev && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
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
            }}
          >
            测试超时弹窗
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
            }}
          >
            测试错误弹窗
          </button>
        </div>
      )} */}
    </>
  );
};

export default AbilityNodeInteractionContainer;


