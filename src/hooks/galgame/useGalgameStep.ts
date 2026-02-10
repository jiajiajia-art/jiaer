import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { OPTION_COST, INPUT_COST } from '../../utils/constants';
import { auth } from '../../api/account/authApi';

interface UseGalgameStepOptions {
    sessionId: string | null;
    historyLength?: number;
    onMessagesClear?: () => void;
    // 后端流式返回 complete 时携带的 allSteps
    onCompleteAllSteps?: (steps: any[]) => void;
    onStreamComplete?: () => void;
    onErrorAfterAlert?: (error: string) => void; // 错误发生时的回调，传递错误信息用于显示错误弹窗
    // 回放模式：用于结束时不再显示“AI 推演中”并可通知业务层
    isReplay?: boolean;
    onExhausted?: () => void;
}

export const useGalgameStep = ({ 
    sessionId, 
    historyLength,
    onMessagesClear,
    onCompleteAllSteps,
    onStreamComplete,
    onErrorAfterAlert,
    isReplay = false,
    onExhausted,
}: UseGalgameStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const { user, updateUser } = useAuthStore();

    // 记录历史中 assistant 回合数，用于前几回合免费
    const historyLengthRef = useRef<number>(historyLength ?? 0);
    useEffect(() => {
        historyLengthRef.current = historyLength ?? 0;
    }, [historyLength]);

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    // 刷新用户信息（用于在流式请求完全成功后更新积分等）
    const getUserInfo = useCallback(async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('[Galgame] 获取用户信息错误:', error);
        }
    }, [updateUser]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        // Galgame 不需要 mission 检测
        onMissionFlag: undefined,
        onCompleteAllSteps,
        // Galgame 需要在没有 choice 时兜底补一个空 choice，便于展示自定义输入
        enableFallbackEmptyChoice: true,
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
            onFirstStep?: () => void;
            onError?: (error: string) => void;
            deduct?: boolean;
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

            const requestBody: any = { action };
            if (options?.deduct) {
                requestBody.deduct = true;
            }

            const response = await authFetch(
                `${HOST_ADDRESS}/api/visual/session/${sessionId}/action/stream`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
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
                        await getUserInfo();
                    },
                    onError: options?.onError,
                    onFirstStep: options?.onFirstStep,
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
                if (isReplay) {
                    // 回放模式下，播放完毕不应再进入等待流式的状态
                    setIsWaitingForData(false);
                    try { onExhausted && onExhausted(); } catch {}
                } else {
                    setIsWaitingForData(true);
                }
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
    }, [showStep, isReplay, onExhausted]);

    const FREE_ROUNDS = 5;

    // 处理选择选项
    const handleChoiceOption = useCallback(async (option: { text: string; nextId: string }, optionIndex: number) => {
        setSelectedOptionIndex(optionIndex);
        setIsWaitingForData(true);
        setShowNextButton(false);

        const assistantRounds = historyLengthRef.current || 0;
        const isFreeRound = assistantRounds < FREE_ROUNDS;

        if (!isFreeRound) {
            const needPoints = OPTION_COST;
            if (!user?.user.points || user.user.points < needPoints) {
                toast.error("积分不足");
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
                return;
            }
        }

        await handleStreamAction(option.text, {
            onError: (error) => {
                console.error('❌ 选择处理错误:', error);
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
            },
        });
    }, [handleStreamAction, user?.user.points]);

    // 处理输入框发送
    const handleChoiceSend = useCallback(async (inputText: string) => {
        if (!inputText.trim()) {
            return;
        }

        setIsWaitingForData(true);
        setShowNextButton(false);
        
        const assistantRounds = historyLengthRef.current || 0;
        const isFreeRound = assistantRounds < FREE_ROUNDS;

        if (!isFreeRound) {
            const needPoints = INPUT_COST;
            if (!user?.user.points || user.user.points < needPoints) {
                toast.error("积分不足");
                setIsWaitingForData(false);
                return;
            }
        }

        await handleStreamAction(inputText, {
            onError: (error) => {
                console.error('❌ 输入发送错误:', error);
                setIsWaitingForData(false);
            },
            deduct: true,
        });
    }, [handleStreamAction, user?.user.points]);

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
                        // 重新生成成功后也刷新一次用户信息
                        await getUserInfo();
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

    return {
        currentStep,
        stepQueue,
        showNextButton,
        selectedOptionIndex,
        isWaitingForData,
        loading,
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
