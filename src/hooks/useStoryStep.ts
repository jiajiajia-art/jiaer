import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from './useStepStreamResponse';
import { authFetch } from '../api/base';
import { HOST_ADDRESS } from '../config';

interface UseStoryStepOptions {
    sessionId: string | null;
    onHistoryRefresh?: () => void;
    onMissionsRefresh?: () => void;
    onMessagesClear?: () => void;
}

export const useStoryStep = ({ 
    sessionId, 
    onHistoryRefresh, 
    onMissionsRefresh,
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

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
    });

    // 当队列中有 step 且当前没有显示的 step 时，自动显示第一个
    useEffect(() => {
        if (stepQueue.length > 0 && (!currentStep || isWaitingForData)) {
            const nextStep = stepQueue[0];
            setCurrentStep(nextStep);
            setIsWaitingForData(false);
            setSelectedOptionIndex(null);
            setStepQueue(prev => prev.slice(1));
            setShowNextButton(nextStep.type !== 'choice');
            
            if (nextStep.type === 'choice') {
                onMissionsRefresh?.();
                console.log('这边choice触发onMissionsRefresh');
            }
        }
    }, [stepQueue, currentStep, isWaitingForData, onMissionsRefresh]);

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
            if (prev.length > 0) {
                const nextStep = prev[0];
                setCurrentStep(nextStep);
                console.log('这边nextStep触发onMissionsRefresh');
                setShowNextButton(nextStep.type !== 'choice');
                if (nextStep.type === 'choice') {
                    console.log('这边choice触发onMissionsRefresh');
                    onMissionsRefresh?.();
                }
                return prev.slice(1);
            } else {
                setCurrentStep(null);
                setShowNextButton(false);
                setIsWaitingForData(true);
                return prev;
            }
        });
    }, [onMissionsRefresh]);

    // 处理选择选项
    const handleChoiceOption = useCallback(async (option: { text: string; nextId: string }, optionIndex: number) => {
        setSelectedOptionIndex(optionIndex);
        setIsWaitingForData(true);
        setShowNextButton(false);

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
        currentRequestId
    };
};

