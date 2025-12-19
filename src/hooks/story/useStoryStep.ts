import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from './useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import payApi from '../../api/pay/payApi';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { useGameStore } from '../../store/gameStore';

interface UseStoryStepOptions {
    sessionId: string | null;
    onHistoryRefresh?: () => void;
    onMissionDetected?: () => void | Promise<void>;
    onMessagesClear?: () => void;
}

export const useStoryStep = ({ 
    sessionId, 
    onHistoryRefresh, 
    onMissionDetected,
    onMessagesClear 
}: UseStoryStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const { user } = useAuthStore();
    const { fileId } = useGameStore();

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        onMissionFlag: onMissionDetected,
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

    // 处理流式请求
    const handleStreamAction = useCallback(async (
        action: string,
        options?: {
            onBeforeRequest?: () => void;
            onSuccess?: () => void;
            onError?: (error: string) => void;
            shouldSetGameStarted?: boolean;
        }
    ) => {
        if (!sessionId) {
            options?.onError?.('没有 sessionId，无法发送请求...');
            return;
        }

        try {
            const requestId = ++currentRequestId.current;
            
            if (currentStepRef.current?.type !== 'choice') {
                setCurrentStep(null);
            }
            setStepQueue([]);
            setShowNextButton(false);
            setIsWaitingForData(true);
            setLoading(true);

            onMessagesClear?.();
            options?.onBeforeRequest?.();

            const response = await authFetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/stream/action-live`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action })
                }
            );

            if (response.ok) {
                if (options?.shouldSetGameStarted) {
                    // 这个需要在外部处理
                }
                
                await processStreamResponse(response, requestId, {
                    onSuccess: async () => {
                        if (options?.onSuccess) {
                            await options.onSuccess();
                        }
                        onHistoryRefresh?.();
                    },
                    onError: options?.onError
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
    }, [sessionId, processStreamResponse, onHistoryRefresh, onMessagesClear]);

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

        if (user?.user.points && user.user.points > 2) {
            await reducePoints("option");
        } else {
            toast.error("积分不足");
            return;
        }

        await handleStreamAction(option.text, {
            onSuccess: () => {
                onHistoryRefresh?.();
            },
            onError: (error) => {
                console.error('❌ 选择处理错误:', error);
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
            }
        });
    }, [handleStreamAction, onHistoryRefresh]);

    // 处理输入框发送
    const handleChoiceSend = useCallback(async (inputText: string) => {
        if (!inputText.trim()) {
            return;
        }

        setIsWaitingForData(true);
        setShowNextButton(false);
        if (user?.user.points && user.user.points > 3) {
            await reducePoints("option");
        } else {
            toast.error("积分不足");
            return;
        }

        await reducePoints("selfDefined");

        await handleStreamAction(inputText, {
            onSuccess: () => {
                onHistoryRefresh?.();
            },
            onError: (error) => {
                console.error('❌ 输入发送错误:', error);
                setIsWaitingForData(false);
            }
        });
    }, [handleStreamAction, onHistoryRefresh]);

    const reducePoints = useCallback(async (type: "option" | "selfDefined") => {
        if (!fileId) return;
        const response = await payApi.optionPoints({ type, fileId: fileId });
        if (response.data.success) {
            return response.data.data;
        }
        return null;
    }, []);

    return {
        currentStep,
        showNextButton,
        selectedOptionIndex,
        isWaitingForData,
        loading,
        handleStreamAction,
        handleNextStep,
        handleChoiceOption,
        handleChoiceSend,
        setCurrentStep,
        setShowNextButton,
        currentRequestId,
        processStreamResponse, // 暴露 processStreamResponse 供外部使用
        setStepQueue // 暴露 setStepQueue 供外部使用
    };
};

