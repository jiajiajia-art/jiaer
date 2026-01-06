import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import payApi from '../../api/pay/payApi';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { auth } from '../../api/account/authApi';
import { useGameStore } from '../../store/gameStore';
import { OPTION_COST, INPUT_COST, HISTORY_MESSAGE_THRESHOLD } from '../../utils/constants';

interface UseGalgameStepOptions {
    sessionId: string | null;
    historyLength?: number; // 历史消息长度，用于判断是否免费
    onMessagesClear?: () => void;
    // 后端流式返回 complete 时携带的 allSteps
    onCompleteAllSteps?: (steps: any[]) => void;
    onStreamComplete?: () => void;
    onErrorAfterAlert?: (error: string) => void; // 错误发生时的回调，传递错误信息用于显示错误弹窗
}

// 前5条历史消息免费（每回2条消息，共10条）
const FREE_ROUNDS_THRESHOLD = HISTORY_MESSAGE_THRESHOLD * 2;

export const useGalgameStep = ({ 
    sessionId, 
    historyLength = 0,
    onMessagesClear,
    onCompleteAllSteps,
    onStreamComplete,
    onErrorAfterAlert,
}: UseGalgameStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [loading, setLoading] = useState(false);
    // 本地历史计数（用于即时显示扣分提示，避免依赖接口刷新）
    const [localHistoryLength, setLocalHistoryLength] = useState(historyLength);
    
    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const { user, updateUser } = useAuthStore();
    const { fileId } = useGameStore();

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    // 同步后端历史长度到本地计数（取较大值，避免回退）
    useEffect(() => {
        setLocalHistoryLength((prev) => Math.max(prev, historyLength));
    }, [historyLength]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        // Galgame 不需要 mission 检测
        onMissionFlag: undefined,
        onCompleteAllSteps,
    });

    const showStep = useCallback(async (step: any) => {
        if (!step) return;

        setCurrentStep(step);
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
        setShowNextButton(step.type !== 'choice');
    }, []);

    // 当队列中有 step 且当前没有显示的 step 时，自动显示第一个
    useEffect(() => {
        if (stepQueue.length === 0) return;
        if (currentStep && !isWaitingForData) return;
        if (isProcessingStepRef.current) return;

        const nextStep = stepQueue[0];
        isProcessingStepRef.current = true;
        setStepQueue(prev => prev.slice(1));

        void (async () => {
            await showStep(nextStep);
            isProcessingStepRef.current = false;
        })();
    }, [stepQueue, currentStep, isWaitingForData, showStep]);

    // 处理流式请求（Galgame 专用接口）
    const handleStreamAction = useCallback(async (
        action: string,
        options?: {
            onBeforeRequest?: () => void;
            onSuccess?: () => void;
            onError?: (error: string) => void;
        }
    ) => {
        if (!sessionId) {
            options?.onError?.('没有 sessionId，无法发送请求...');
            return;
        }

        try {
            const requestId = ++currentRequestId.current;
            
            // 新请求开始，无论当前是否为 choice 都清空当前 step，避免阻塞后续队列消费
            setCurrentStep(null);
            setStepQueue([]);
            setShowNextButton(false);
            setIsWaitingForData(true);
            setLoading(true);

            onMessagesClear?.();
            options?.onBeforeRequest?.();

            // Galgame 专用接口
            const response = await authFetch(
                `${HOST_ADDRESS}/api/visual/session/${sessionId}/action/stream`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                }
            );

            if (response.ok) {
                await processStreamResponse(response, requestId, {
                    onSuccess: async () => {
                        if (options?.onSuccess) {
                            await options.onSuccess();
                        }
                        // 流式结束后回调，用于刷新历史记录等
                        if (onStreamComplete) {
                            try {
                                await onStreamComplete();
                            } catch (e) {
                                console.error('流式结束回调执行失败:', e);
                            }
                        }
                    },
                    onError: options?.onError,
                    onErrorAfterAlert: onErrorAfterAlert
                });
            } else {
                const errorMsg = `请求失败: ${response.statusText}`;
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        } catch (error) {
            const errorMsg = `请求错误: ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('❌', errorMsg);
            setLoading(false);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(errorMsg);
        }
    }, [sessionId, processStreamResponse, onMessagesClear]);

    // 处理下一步
    const handleNextStep = useCallback(() => {
        setStepQueue(prev => {
            if (prev.length === 0) {
                setCurrentStep(null);
                setShowNextButton(false);
                setIsWaitingForData(true);
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

    // 处理选择选项
    const handleChoiceOption = useCallback(async (option: { text: string; nextId: string }, optionIndex: number) => {
        setSelectedOptionIndex(optionIndex);
        setIsWaitingForData(true);
        setShowNextButton(false);

        const effectiveHistory = Math.max(localHistoryLength, historyLength);
        const nextHistory = effectiveHistory + 2; // 一次交互通常对应 user+assistant 两条

        // 前 N 回免费，达到阈值（含）之后需要扣除积分
        if (effectiveHistory >= FREE_ROUNDS_THRESHOLD) {
            if (user?.user.points && user.user.points > OPTION_COST) {
                await reducePoints("option");
            } else {
                toast.error("积分不足");
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
                return;
            }
        }

        // 本地先行 +2，让前端提示即时生效
        setLocalHistoryLength(nextHistory);

        await handleStreamAction(option.text, {
            onError: (error) => {
                console.error('❌ 选择处理错误:', error);
                // 失败回滚到已知的最大值，避免虚增
                setLocalHistoryLength((prev) => Math.max(prev, historyLength, effectiveHistory));
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
            }
        });
    }, [handleStreamAction, user?.user.points, historyLength, localHistoryLength]);

    // 处理输入框发送
    const handleChoiceSend = useCallback(async (inputText: string) => {
        if (!inputText.trim()) {
            return;
        }

        setIsWaitingForData(true);
        setShowNextButton(false);
        
        const effectiveHistory = Math.max(localHistoryLength, historyLength);
        const nextHistory = effectiveHistory + 2;

        // 前 N 回免费，达到阈值（含）之后需要扣除积分
        if (effectiveHistory >= FREE_ROUNDS_THRESHOLD) {
            if (user?.user.points && user.user.points > INPUT_COST) {
                await reducePoints("selfDefined");
            } else {
                toast.error("积分不足");
                setIsWaitingForData(false);
                return;
            }
        }

        // 本地先行 +2，让前端提示即时生效
        setLocalHistoryLength(nextHistory);

        await handleStreamAction(inputText, {
            onError: (error) => {
                console.error('❌ 输入发送错误:', error);
                // 失败回滚到已知的最大值，避免虚增
                setLocalHistoryLength((prev) => Math.max(prev, historyLength, effectiveHistory));
                setIsWaitingForData(false);
            }
        });
    }, [handleStreamAction, user?.user.points, historyLength, localHistoryLength]);

    // 处理重新生成
    const handleRegenerate = useCallback(async (
        messageIndex: number,
        options?: {
            onBeforeRequest?: () => void;
            onSuccess?: () => void;
            onError?: (error: string) => void;
        }
    ) => {
        if (!sessionId) {
            options?.onError?.('没有 sessionId，无法发送请求...');
            return;
        }

        try {
            const requestId = ++currentRequestId.current;
            
            setCurrentStep(null);
            setStepQueue([]);
            setShowNextButton(false);
            setIsWaitingForData(true);
            setLoading(true);

            onMessagesClear?.();
            options?.onBeforeRequest?.();

            // 重新生成接口
            const response = await authFetch(
                `${HOST_ADDRESS}/api/visual/session/${sessionId}/regenerate`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ "historyIndex": messageIndex })
                }
            );

            if (response.ok) {
                await processStreamResponse(response, requestId, {
                    onSuccess: async () => {
                        if (options?.onSuccess) {
                            await options.onSuccess();
                        }
                        // 流式结束后回调，用于刷新历史记录等
                        if (onStreamComplete) {
                            try {
                                await onStreamComplete();
                            } catch (e) {
                                console.error('流式结束回调执行失败:', e);
                            }
                        }
                    },
                    onError: options?.onError,
                    onErrorAfterAlert: onErrorAfterAlert
                });
            } else {
                const errorMsg = `请求失败: ${response.statusText}`;
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        } catch (error) {
            const errorMsg = `请求错误: ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('❌', errorMsg);
            setLoading(false);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(errorMsg);
        }
    }, [sessionId, processStreamResponse, onMessagesClear]);

    const reducePoints = useCallback(async (type: "option" | "selfDefined") => {
        if (!fileId) return;
        const response = await payApi.optionPoints({ 
            type,
            fileId: fileId
         });
        if (response.data.success) {
            getUserInfo();
            
            return response.data.data;
        }
        return null;
    }, []);

    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('获取用户信息错误:', error);
        }
    };

    return {
        currentStep,
        stepQueue,
        showNextButton,
        selectedOptionIndex,
        isWaitingForData,
        loading,
        localHistoryLength,
        handleStreamAction,
        handleNextStep,
        handleChoiceOption,
        handleChoiceSend,
        handleRegenerate,
        setCurrentStep,
        setShowNextButton,
        currentRequestId,
        processStreamResponse,
        setStepQueue
    };
};

