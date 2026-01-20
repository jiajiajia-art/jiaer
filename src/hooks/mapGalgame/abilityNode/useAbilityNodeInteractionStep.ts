/**
 * 功能性NPC专用的步骤处理器（简化版）
 * 处理：步骤队列管理、流式响应处理
 * 不包含：选择处理、积分扣除、历史记录等普通NPC特有的逻辑
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../../story/useStepStreamResponse';

interface UseAbilityNodeInteractionStepOptions {
  sessionId: string | null;
  onMessagesClear?: () => void;
}

export const useAbilityNodeInteractionStep = ({
  sessionId: _sessionId,
  onMessagesClear: _onMessagesClear,
}: UseAbilityNodeInteractionStepOptions) => {
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [stepQueue, setStepQueue] = useState<any[]>([]);
  const [showNextButton, setShowNextButton] = useState(false);
  const [isWaitingForData, setIsWaitingForData] = useState(false);

  const currentRequestId = useRef(0);
  const isProcessingStepRef = useRef(false);

  // 复用通用的流式 step 解析器
  const { processStreamResponse } = useStepStreamResponse({
    setStepQueue,
    setSelectedOptionIndex: () => {}, // 功能性NPC不需要选择
    setIsWaitingForData,
    currentRequestId,
    onMissionFlag: undefined,
    onCompleteAllSteps: undefined,
  });

  const showStep = useCallback(async (step: any) => {
    if (!step) return;

    const shouldShowNext = step.type !== 'choice';
    
    setCurrentStep(step);
    setIsWaitingForData(false);
    setShowNextButton(shouldShowNext);
  }, []);

  // 当队列中有 step 且当前没有显示的 step 时，自动显示第一个
  useEffect(() => {
    if (stepQueue.length === 0) {
      // 如果队列为空且当前步骤不是 choice，禁用下一步按钮
      if (currentStep && currentStep.type !== 'choice') {
        setShowNextButton(false);
      }
      return;
    }

    // 如果当前有步骤且不在等待数据，且队列不为空，说明当前步骤已显示完成，应该显示"下一步"按钮
    if (currentStep && !isWaitingForData) {
      // 确保有下一步按钮，以便自动播放或用户点击可以继续
      if (!showNextButton && currentStep.type !== 'choice') {
        setShowNextButton(true);
      }
      return; // 不自动处理，等待用户点击或自动播放触发
    }

    if (isProcessingStepRef.current) return;

    const nextStep = stepQueue[0];
    isProcessingStepRef.current = true;
    setStepQueue((prev) => prev.slice(1));

    void (async () => {
      await showStep(nextStep);
      isProcessingStepRef.current = false;
    })();
  }, [stepQueue, currentStep, isWaitingForData, showStep, showNextButton]);

  // 处理下一步（功能性NPC不需要复杂的逻辑）
  const handleNextMessage = useCallback(() => {
    if (isWaitingForData || stepQueue.length === 0) return;
    
    const nextStep = stepQueue[0];
    if (nextStep) {
      setStepQueue((prev) => prev.slice(1));
      void showStep(nextStep);
    }
  }, [stepQueue, isWaitingForData, showStep]);

  return {
    currentStep,
    stepQueue,
    showNextButton,
    isWaitingForData,
    currentRequestId,
    setCurrentStep,
    setStepQueue,
    setShowNextButton,
    setIsWaitingForData,
    processStreamResponse,
    handleNextMessage,
  };
};

