import { useState, useRef, useEffect, useCallback } from "react";
import { authFetch } from "../../../api/base";
import { HOST_ADDRESS } from "../../../config";
import { useAuthStore } from "../../../store/useAuthStore";
import { toast } from "react-hot-toast";
import { useStepStreamResponse } from "../../story/useStepStreamResponse";
import { OPTION_COST, INPUT_COST } from "../../../utils/constants";
import { truncateStepsAfterChoice } from "../common/interactionUtils";
import { auth } from "../../../api/account/authApi";

// 记录已经触发过初始交互的 session-event 组合，避免开发环境 StrictMode 下重复发送请求
const startedEvents = new Set<string>();

interface UseNpcInteractionStepOptions {
  sessionId: string | null;
  eventId: string | null;
  fileId: string | null;
  onMessagesClear?: () => void;
  playerChoiceCount?: number;
}

export const useNpcInteractionStep = ({
  sessionId,
  eventId,
  fileId,
  onMessagesClear,
  playerChoiceCount,
}: UseNpcInteractionStepOptions) => {
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [stepQueue, setStepQueue] = useState<any[]>([]);
  const [showNextButton, setShowNextButton] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(
    null
  );
  const [isWaitingForData, setIsWaitingForData] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentRequestId = useRef(0);
  const currentStepRef = useRef<any>(null);
  const isProcessingStepRef = useRef(false);
  const currentEventIdRef = useRef<string | null>(null);
  const [newEvent, setNewEvent] = useState<any>(null); // 存储新的事件数据

  const { user, updateUser } = useAuthStore();

  // 玩家已选择次数（player_choice 数量），用于前几回合免费
  const playerChoiceCountRef = useRef<number>(0);
  useEffect(() => {
    playerChoiceCountRef.current = (typeof playerChoiceCount === 'number' && playerChoiceCount >= 0)
      ? playerChoiceCount
      : 0;
  }, [playerChoiceCount]);

  // 同步 currentStep 到 ref
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  const getUserInfo = useCallback(async () => {
    try {
      const response = await auth.getUserInfo();
      if (response.data.success && response.data.data) {
        updateUser(response.data.data);
      }
    } catch (error) {
      console.error("[WorldInteraction] 获取用户信息错误:", error);
    }
  }, [updateUser]);

  // 复用通用的流式 step 解析器
  const { processStreamResponse } = useStepStreamResponse({
    setStepQueue,
    setSelectedOptionIndex,
    setIsWaitingForData,
    currentRequestId,
    // 世界交互暂不需要 mission flag
    onMissionFlag: undefined,
  });

  // 处理 narrativeSteps 数组，逐个添加到队列
  const processNarrativeSteps = useCallback(
    (steps: any[], requestId: number) => {
      if (currentRequestId.current !== requestId) {
        return; // 忽略旧请求的数据
      }

      if (steps && Array.isArray(steps) && steps.length > 0) {
        setStepQueue((prev) => {
          if (currentRequestId.current !== requestId) {
            return prev;
          }
          
          // 检查队列中是否已有 choice 步骤
          const hasChoice = prev.some((s: any) => s?.type === 'choice');
          if (hasChoice) {
            // 如果队列中已有 choice，不再添加后续步骤
            return prev;
          }
          
          // 截断 choice 之后的步骤
          const truncatedSteps = truncateStepsAfterChoice(steps);
          return [...prev, ...truncatedSteps];
        });
      }
    },
    []
  );

  const showStep = useCallback(async (step: any) => {
    if (!step) return;

    const shouldShowNext = step.type !== "choice";
    setCurrentStep(step);
    setIsWaitingForData(false);
    setSelectedOptionIndex(null);
    setShowNextButton(shouldShowNext);
  }, []);

  // 确保即使跳过 handleInteract（直接使用历史选项）也能拿到最新的 eventId
  useEffect(() => {
    currentEventIdRef.current = eventId;
  }, [eventId]);

  // 当队列中有 step 且当前没有显示的 step 时，自动显示第一个
  useEffect(() => {
    if (stepQueue.length === 0) {
      // 如果队列为空且当前步骤不是 choice，禁用下一步按钮
      if (currentStep && currentStep.type !== "choice") {
        setShowNextButton(false);
      }
      return;
    }

    // 如果当前有步骤且不在等待数据，且队列不为空，说明当前步骤已显示完成，应该显示"下一步"按钮
    if (currentStep && !isWaitingForData) {
      // 确保有下一步按钮，以便自动播放或用户点击可以继续
      if (!showNextButton && currentStep.type !== "choice") {
        setShowNextButton(true);
      }
      return; // 不自动处理，等待用户点击或自动播放触发
    }

    if (isProcessingStepRef.current) return;

    const nextStep = stepQueue[0];
    console.log('[队列处理] 从队列取出步骤:', {
      stepType: nextStep?.type,
      queueLength: stepQueue.length,
      hasCurrentStep: !!currentStep,
      isWaitingForData,
    });
    isProcessingStepRef.current = true;
    setStepQueue((prev) => {
      const newQueue = prev.slice(1);
      console.log('[队列处理] 队列更新后长度:', newQueue.length);
      return newQueue;
    });

    void (async () => {
      await showStep(nextStep);
      isProcessingStepRef.current = false;
    })();
  }, [stepQueue, currentStep, isWaitingForData, showStep, showNextButton]);

  // 处理初始交互请求（世界交互专用接口）
  const handleInteract = useCallback(
    async (options?: {
      onBeforeRequest?: () => void;
      onSuccess?: (data: any) => void;
      onError?: (error: string) => void;
      onFirstStep?: () => void; // 收到第一个步骤时的回调
      isRetry?: boolean; // 是否是重试请求
    }) => {
      if (!sessionId || !eventId || !fileId) {
        options?.onError?.(
          "缺少 sessionId、eventId 或 fileId，无法发送请求..."
        );
        return;
      }

      try {
        const key = `${sessionId}-${eventId}`;
        // 如果是重试请求，先清理旧的标记，允许重试
        if (options?.isRetry && startedEvents.has(key)) {
          startedEvents.delete(key);
        }
        // 检查是否已有进行中的请求（非重试时）
        if (!options?.isRetry && startedEvents.has(key)) {
          return;
        }
        startedEvents.add(key);

        const requestId = ++currentRequestId.current;

        setCurrentStep(null);
        setStepQueue([]);
        setShowNextButton(false);
        setIsWaitingForData(true);
        setLoading(true);
        setSelectedOptionIndex(null);

        onMessagesClear?.();
        options?.onBeforeRequest?.();

        const response = await authFetch(
          `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/interact/${eventId}/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId }),
          }
        );

        if (response.ok) {
          await processStreamResponse(response, requestId, {
            onErrorAfterAlert: (errorMessage) => {
              // 流式响应中的错误，显示错误弹窗给用户
              options?.onError?.(errorMessage);
            },
            onData: (jsonData) => {
              // 记录 eventId（兼容 interaction / completedEvent / result.completedEvent）
              const evtId =
                jsonData?.interaction?.eventId ||
                jsonData?.completedEvent?.eventId ||
                jsonData?.result?.completedEvent?.eventId;
              if (evtId) {
                currentEventIdRef.current = evtId;
              }

              // 缓存 steps/allSteps（兼容 optionResponse/narrativeSteps、result 内的步骤）
              const stepsForCache =
                (jsonData?.allSteps as any[]) ||
                (jsonData?.narrativeSteps as any[]) ||
                jsonData?.interaction?.narrativeSteps ||
                jsonData?.result?.optionResponse?.narrativeSteps;

              if (
                stepsForCache &&
                Array.isArray(stepsForCache) &&
                stepsForCache.length > 0 &&
                sessionId &&
                currentEventIdRef.current
              ) {
                try {
                  const storageKey = `world-allsteps-${sessionId}-${currentEventIdRef.current}`;
                  const incompleteKey = `world-allsteps-incomplete-${sessionId}-${currentEventIdRef.current}`;
                  window.localStorage.setItem(
                    storageKey,
                    JSON.stringify(stepsForCache)
                  );
                  window.localStorage.setItem(incompleteKey, "true");
                } catch (e) {
                  console.warn("[WorldInteraction] 缓存交互步骤失败:", e);
                }
              }

              // 如果流里返回了 newEvent / completedEvent（含 result 内），则记录
              const completed =
                jsonData?.completedEvent || jsonData?.result?.completedEvent;
              const newEvt = jsonData?.newEvent || jsonData?.result?.newEvent;
              if (newEvt || completed) {
                setNewEvent((prev: any) => {
                  // 如果同时返回了新事件和完成事件，优先保留新事件信息，并补全 completed 字段
                  if (newEvt && completed) {
                    return {
                      ...prev,
                      ...newEvt,
                      completed: true,
                      completedEvent: completed,
                    };
                  }

                  // 仅有新事件时，直接覆盖为最新的新事件（保留 completedEvent，如果之前已有）
                  if (newEvt) {
                    return {
                      ...prev,
                      ...newEvt,
                    };
                  }

                  // 仅有完成事件时，如果之前已拿到新事件数据，避免覆盖掉 event/npc/subscene
                  if (prev?.event && prev?.npc && prev?.subscene) {
                    return {
                      ...prev,
                      completed: true,
                      completedEvent: completed,
                    };
                  }

                  // 只有完成事件且没有新事件数据时，保持旧逻辑
                  return {
                    completed: true,
                    completedEvent: completed,
                    hasNewEvent: false,
                  };
                });
              }
            },
            onSuccess: async () => {
              setLoading(false);
              options?.onSuccess?.(null);
              // 初始交互成功后，刷新一次用户信息（例如积分）
              await getUserInfo();
            },
            onError: (err) => {
              // 错误时清理 startedEvents，允许重试
              const key = `${sessionId}-${eventId}`;
              startedEvents.delete(key);
              setLoading(false);
              setIsWaitingForData(false);
              options?.onError?.(err);
            },
            onFirstStep: () => {
              // 收到首个 step，表示有增量输出，关闭等待态
              setIsWaitingForData(false);
              // 调用上层传入的 onFirstStep 回调
              options?.onFirstStep?.();
            },
          });
        } else {
          // 请求失败时清理 startedEvents，允许重试
          const key = `${sessionId}-${eventId}`;
          startedEvents.delete(key);
          const errorMsg = `请求失败: ${response.statusText}`;
          setLoading(false);
          setSelectedOptionIndex(null);
          setIsWaitingForData(false);
          options?.onError?.(errorMsg);
        }
      } catch (error) {
        // 请求异常时清理 startedEvents，允许重试
        const key = `${sessionId}-${eventId}`;
        startedEvents.delete(key);
        const errorMsg = `请求错误: ${
          error instanceof Error ? error.message : "未知错误"
        }`;
        console.error("❌", errorMsg);
        setLoading(false);
        setSelectedOptionIndex(null);
        setIsWaitingForData(false);
        options?.onError?.(errorMsg);
      }
    },
    [sessionId, eventId, fileId, processNarrativeSteps, onMessagesClear]
  );

  // 处理下一步
  const handleNextStep = useCallback(() => {
    setStepQueue((prev) => {
      if (prev.length === 0) {
        // 队列为空时，禁用下一步按钮，不设置等待状态
        setShowNextButton(false);
        setIsWaitingForData(false);
        return prev;
      }

      const [nextStep, ...rest] = prev;
      void (async () => {
        isProcessingStepRef.current = true;
        await showStep(nextStep);
        isProcessingStepRef.current = false;
      })();
      return rest;
    });
  }, [showStep]);

  const FREE_ROUNDS = 5;

  const handleChoiceOption = useCallback(
    async (
      optionId: string,
      optionIndex: number,
      options?: {
        onSuccess?: (data: any) => void;
        onError?: (error: string) => void;
        onFirstStep?: () => void; // 收到首个 step 时的回调，便于上层清 pending
      }
    ) => {
      if (!sessionId || !currentEventIdRef.current) {
        options?.onError?.("缺少 sessionId 或 eventId，无法发送请求...");
        return;
      }

      const isCustomInput = optionIndex === -1;
      const playerChoicesSoFar = playerChoiceCountRef.current || 0;
      const isFreeRound = playerChoicesSoFar < FREE_ROUNDS;
      const needPoints = isCustomInput ? INPUT_COST : OPTION_COST;

      if (!isFreeRound) {
        if (!user?.user.points || user.user.points < needPoints) {
          toast.error("积分不足");
          return;
        }
      }

      setSelectedOptionIndex(optionIndex);
      setIsWaitingForData(true);
      setShowNextButton(false);
      setLoading(true);

      try {
        const requestId = ++currentRequestId.current;
        setCurrentStep(null);
        setStepQueue([]);

        const response = await authFetch(
          `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/select-option/stream`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: currentEventIdRef.current,
              optionId: optionId,
            }),
          }
        );

        if (response.ok) {
          await processStreamResponse(response, requestId, {
            onErrorAfterAlert: (errorMessage) => {
              // 流式响应中的错误，显示错误弹窗给用户
              options?.onError?.(errorMessage);
            },
            onData: (jsonData) => {
              // 记录 eventId
              const evtId =
                jsonData?.interaction?.eventId ||
                jsonData?.completedEvent?.eventId ||
                jsonData?.result?.completedEvent?.eventId;
              if (evtId) {
                currentEventIdRef.current = evtId;
              }

              // 缓存 steps/allSteps
              const stepsForCache =
                (jsonData?.allSteps as any[]) ||
                (jsonData?.narrativeSteps as any[]) ||
                jsonData?.interaction?.narrativeSteps ||
                jsonData?.result?.optionResponse?.narrativeSteps;

              if (
                stepsForCache &&
                Array.isArray(stepsForCache) &&
                stepsForCache.length > 0 &&
                sessionId &&
                currentEventIdRef.current
              ) {
                try {
                  const storageKey = `world-allsteps-${sessionId}-${currentEventIdRef.current}`;
                  const incompleteKey = `world-allsteps-incomplete-${sessionId}-${currentEventIdRef.current}`;
                  window.localStorage.setItem(
                    storageKey,
                    JSON.stringify(stepsForCache)
                  );
                  window.localStorage.setItem(incompleteKey, "true");
                } catch (e) {
                  console.warn("[WorldInteraction] 更新交互步骤缓存失败:", e);
                }
              }

              // newEvent/完成事件（含 result 内）
              const completed =
                jsonData?.completedEvent || jsonData?.result?.completedEvent;
              const newEvt = jsonData?.newEvent || jsonData?.result?.newEvent;
              if (newEvt || completed) {
                setNewEvent((prev: any) => {
                  // 新事件与完成事件同时返回时，保留新事件并补全完成信息
                  if (newEvt && completed) {
                    return {
                      ...prev,
                      ...newEvt,
                      completed: true,
                      completedEvent: completed,
                    };
                  }

                  // 仅有新事件：覆盖为最新的新事件（保留已有的 completedEvent）
                  if (newEvt) {
                    return {
                      ...prev,
                      ...newEvt,
                    };
                  }

                  // 仅有完成事件：如果已经有新事件数据，避免覆盖 event/npc/subscene
                  if (prev?.event && prev?.npc && prev?.subscene) {
                    return {
                      ...prev,
                      completed: true,
                      completedEvent: completed,
                    };
                  }

                  // 只有完成事件且没有新事件数据
                  return {
                    completed: true,
                    completedEvent: completed,
                    hasNewEvent: false,
                  };
                });
              }
            },
            onSuccess: async () => {
              setLoading(false);
              options?.onSuccess?.(null);
              await getUserInfo();
            },
            onError: (err) => {
              options?.onError?.(err);
            },
            onFirstStep: async () => {
              // 流一旦有输出，通知上层可以清除 pending 状态
              options?.onFirstStep?.();
              setIsWaitingForData(false);
            },
          });
        } else {
          const errorMsg = `请求失败: ${response.statusText}`;
          options?.onError?.(errorMsg);
        }
      } catch (error) {
        const errorMsg = `请求错误: ${
          error instanceof Error ? error.message : "未知错误"
        }`;
        options?.onError?.(errorMsg);
      } finally {
        setLoading(false);
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
      }
    },
    [
      sessionId,
      user?.user.points,
      processNarrativeSteps,
      showStep,
    ]
  );

  return {
    currentStep,
    stepQueue,
    showNextButton,
    selectedOptionIndex,
    isWaitingForData,
    loading,
    handleInteract,
    handleNextStep,
    handleChoiceOption,
    setCurrentStep,
    setShowNextButton,
    currentRequestId,
    setStepQueue,
    processStreamResponse, // 暴露 processStreamResponse
    newEvent,
    clearNewEvent: () => {
      setNewEvent(null);
    },
  };
};
