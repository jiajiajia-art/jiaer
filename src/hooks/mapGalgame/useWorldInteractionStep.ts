import { useState, useRef, useEffect, useCallback } from "react";
import { authFetch } from "../../api/base";
import { HOST_ADDRESS } from "../../config";
import { useAuthStore } from "../../store/useAuthStore";
import { toast } from "react-hot-toast";
import payApi from "../../api/pay/payApi";
import { auth } from "../../api/account/authApi";
import { useStepStreamResponse } from "../story/useStepStreamResponse";

// 记录已经触发过初始交互的 session-event 组合，避免开发环境 StrictMode 下重复发送请求
const startedEvents = new Set<string>();
// 世界交互：前 10 条交互免费，之后开始扣费
const FREE_INTERACTIONS_THRESHOLD = 5;

interface UseWorldInteractionStepOptions {
  sessionId: string | null;
  eventId: string | null;
  fileId: string | null;
  onMessagesClear?: () => void;
  historyLength?: number;
}

export const useWorldInteractionStep = ({
  sessionId,
  eventId,
  fileId,
  onMessagesClear,
  historyLength = 0,
}: UseWorldInteractionStepOptions) => {
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

  // 获取最新用户信息
  const getUserInfo = useCallback(async () => {
    try {
      const response = await auth.getUserInfo();
      if (response.data.success && response.data.data) {
        updateUser(response.data.data);
      }
    } catch (error) {
      console.error("获取用户信息错误:", error);
    }
  }, [updateUser]);

  // 世界交互扣积分：type 为 "option"（2 积分）或 "selfDefined"（3 积分）
  const reducePoints = useCallback(
    async (type: "option" | "selfDefined") => {
      if (!fileId) return;
      const response = await payApi.optionPoints({ 
        type,
        fileId: fileId
      });
      if (response.data.success) {
        await getUserInfo();
        return response.data.data;
      }
      return null;
    },
    [getUserInfo]
  );

  // 同步 currentStep 到 ref
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

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
          return [...prev, ...steps];
        });
      }
    },
    []
  );

  const showStep = useCallback(async (step: any) => {
    if (!step) return;

    setCurrentStep(step);
    setIsWaitingForData(false);
    setSelectedOptionIndex(null);
    setShowNextButton(step.type !== "choice");
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
    isProcessingStepRef.current = true;
    setStepQueue((prev) => prev.slice(1));

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
    }) => {
      if (!sessionId || !eventId || !fileId) {
        options?.onError?.(
          "缺少 sessionId、eventId 或 fileId，无法发送请求..."
        );
        return;
      }

      try {
        const key = `${sessionId}-${eventId}`;
        if (startedEvents.has(key)) {
          console.log(
            "[WorldInteraction] 初始交互已触发过，忽略重复请求:",
            key
          );
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
                setNewEvent(
                  newEvt || {
                    completed: true,
                    completedEvent: completed,
                    hasNewEvent: false,
                  }
                );
              }
            },
            onSuccess: () => {
              setLoading(false);
              options?.onSuccess?.(null);
            },
            onError: (err) => {
              setLoading(false);
              setIsWaitingForData(false);
              options?.onError?.(err);
            },
            onFirstStep: () => {
              // 收到首个 step，表示有增量输出，关闭等待态
              setIsWaitingForData(false);
            },
          });
        } else {
          const errorMsg = `请求失败: ${response.statusText}`;
          setLoading(false);
          setSelectedOptionIndex(null);
          setIsWaitingForData(false);
          options?.onError?.(errorMsg);
        }
      } catch (error) {
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

      if (historyLength > FREE_INTERACTIONS_THRESHOLD) {
        const isCustomInput = optionIndex === -1;
        const needPoints = isCustomInput ? 3 : 2;

        if (!user?.user.points || user.user.points <= needPoints) {
          toast.error("积分不足");
          return;
        }

        await reducePoints(isCustomInput ? "selfDefined" : "option");
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
                setNewEvent(
                  newEvt || {
                    completed: true,
                    completedEvent: completed,
                    hasNewEvent: false,
                  }
                );
              }
            },
            onSuccess: () => {
              setLoading(false);
              options?.onSuccess?.(null);
            },
            onError: (err) => {
              options?.onError?.(err);
            },
            onFirstStep: () => {
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
      historyLength,
      user?.user.points,
      processNarrativeSteps,
      showStep,
      reducePoints,
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
    newEvent,
    clearNewEvent: () => {
      setNewEvent(null);
    },
  };
};
