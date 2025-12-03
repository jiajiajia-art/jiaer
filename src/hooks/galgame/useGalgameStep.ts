import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import payApi from '../../api/pay/payApi';
import { useAuthStore } from '../../store/useAuthStore';
import { toast } from 'react-hot-toast';
import { auth } from '../../api/account/authApi';

interface UseGalgameStepOptions {
    sessionId: string | null;
    onMessagesClear?: () => void;
}

export const useGalgameStep = ({ 
    sessionId, 
    onMessagesClear 
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

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        // Galgame 不需要 mission 检测
        onMissionFlag: undefined,
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
            
            if (currentStepRef.current?.type !== 'choice') {
                setCurrentStep(null);
            }
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

        if (user?.user.points && user.user.points > 2) {
            await reducePoints("option");
        } else {
            toast.error("积分不足");
            return;
        }

        await handleStreamAction(option.text, {
            onError: (error) => {
                console.error('❌ 选择处理错误:', error);
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
            }
        });
    }, [handleStreamAction, user?.user.points]);

    // 处理输入框发送
    const handleChoiceSend = useCallback(async (inputText: string) => {
        if (!inputText.trim()) {
            return;
        }

        setIsWaitingForData(true);
        setShowNextButton(false);
        if (user?.user.points && user.user.points > 3) {
            await reducePoints("selfDefined");
        } else {
            toast.error("积分不足");
            return;
        }

        await handleStreamAction(inputText, {
            onError: (error) => {
                console.error('❌ 输入发送错误:', error);
                setIsWaitingForData(false);
            }
        });
    }, [handleStreamAction, user?.user.points]);

    const reducePoints = useCallback(async (type: "option" | "selfDefined") => {
        const response = await payApi.optionPoints({ type });
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
        handleStreamAction,
        handleNextStep,
        handleChoiceOption,
        handleChoiceSend,
        setCurrentStep,
        setShowNextButton,
        currentRequestId,
        processStreamResponse,
        setStepQueue
    };
};

