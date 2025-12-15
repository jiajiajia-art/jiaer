import { useState, useRef, useEffect, useCallback } from 'react';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';

interface UseWorldInteractionStepOptions {
    sessionId: string | null;
    eventId: string | null;
    fileId: string | null;
    onMessagesClear?: () => void;
}

export const useWorldInteractionStep = ({ 
    sessionId, 
    eventId,
    fileId,
    onMessagesClear 
}: UseWorldInteractionStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const currentEventIdRef = useRef<string | null>(null);
    const [newEvent, setNewEvent] = useState<any>(null); // 存储新的事件数据

    // 同步 currentStep 到 ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    // 处理 narrativeSteps 数组，逐个添加到队列
    const processNarrativeSteps = useCallback((steps: any[], requestId: number) => {
        if (currentRequestId.current !== requestId) {
            return; // 忽略旧请求的数据
        }

        if (steps && Array.isArray(steps) && steps.length > 0) {
            setStepQueue(prev => {
                if (currentRequestId.current !== requestId) {
                    return prev;
                }
                return [...prev, ...steps];
            });
        }
    }, []);

    const showStep = useCallback(async (step: any) => {
        if (!step) return;

        setCurrentStep(step);
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
        setShowNextButton(step.type !== 'choice');
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

    // 处理初始交互请求（世界交互专用接口）
    const handleInteract = useCallback(async (
        options?: {
            onBeforeRequest?: () => void;
            onSuccess?: (data: any) => void;
            onError?: (error: string) => void;
        }
    ) => {
        if (!sessionId || !eventId || !fileId) {
            options?.onError?.('缺少 sessionId、eventId 或 fileId，无法发送请求...');
            return;
        }

        try {
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
                `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/interact/${eventId}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId })
                }
            );

            if (response.ok) {
                const data = await response.json();
                
                if (currentRequestId.current !== requestId) {
                    return; // 忽略旧请求的响应
                }

                if (data.success && data.interaction?.narrativeSteps) {
                    // 保存当前 eventId
                    currentEventIdRef.current = data.interaction.eventId;
                    
                    // 处理 narrativeSteps，逐个添加到队列
                    const steps = [...data.interaction.narrativeSteps];
                    
                    // 如果有选项，创建一个 choice 步骤并添加到队列末尾
                    if (data.interaction.options && data.interaction.options.length > 0) {
                        const choiceStep = {
                            type: 'choice',
                            title: '请选择你的行动',
                            description: '',
                            options: data.interaction.options.map((opt: any) => ({
                                optionId: opt.optionId,
                                text: opt.text,
                            })),
                        };
                        steps.push(choiceStep);
                    }
                    
                    processNarrativeSteps(steps, requestId);
                    
                    setLoading(false);
                    options?.onSuccess?.(data);
                } else {
                    const errorMsg = '响应数据格式错误';
                    setLoading(false);
                    setIsWaitingForData(false);
                    options?.onError?.(errorMsg);
                }
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
    }, [sessionId, eventId, fileId, processNarrativeSteps, onMessagesClear]);

    // 处理下一步
    const handleNextStep = useCallback(() => {
        setStepQueue(prev => {
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

    const handleChoiceOption = useCallback(async (
        optionId: string,
        optionIndex: number,
        options?: {
            onSuccess?: (data: any) => void;
            onError?: (error: string) => void;
        }
    ) => {
        if (!sessionId || !currentEventIdRef.current) {
            options?.onError?.('缺少 sessionId 或 eventId，无法发送请求...');
            return;
        }
    
        setSelectedOptionIndex(optionIndex);
        setIsWaitingForData(true);
        setShowNextButton(false);
        setLoading(true);
    
        try {
            const requestId = ++currentRequestId.current;
            
            // 清空当前步骤和队列
            setCurrentStep(null);
            setStepQueue([]);
    
            const response = await authFetch(
                `${HOST_ADDRESS}/api/world-interaction/session/${sessionId}/select-option`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId: currentEventIdRef.current,
                        optionId: optionId
                    })
                }
            );
    
            if (response.ok) {
                const data = await response.json();
                
                console.log('选择选项完整响应:', data); // 调试
                console.log('optionResponse:', data.completedEvent.optionResponse); // 调试
                console.log('narrativeSteps:', data.completedEvent.optionResponse?.narrativeSteps); // 调试
                
                if (currentRequestId.current !== requestId) {
                    console.log('请求已过期，忽略响应'); // 调试
                    return;
                }
    
                if (data.success) {
                    // 根据后端数据结构，直接访问 optionResponse
                    const narrativeSteps = data.completedEvent.optionResponse?.narrativeSteps || [];
                    
                    console.log('处理后的 narrativeSteps:', narrativeSteps); // 调试
    
                    // 清空当前显示，准备渲染新步骤
                    setCurrentStep(null);
                    setShowNextButton(false);
    
                    // 直接消费第一个步骤，剩余的交给队列
                    if (narrativeSteps.length > 0) {
                        console.log('有 narrativeSteps，开始处理'); // 调试
                        const [first, ...rest] = narrativeSteps;
                        
                        isProcessingStepRef.current = true;
                        console.log('显示第一个步骤:', first); // 调试
                        await showStep(first);
                        isProcessingStepRef.current = false;
    
                        if (rest.length > 0) {
                            console.log('还有剩余步骤，添加到队列:', rest); // 调试
                            processNarrativeSteps(rest, requestId);
                        }
                    } else {
                        console.log('没有 narrativeSteps，结束等待'); // 调试
                        // 如果没有步骤，设置等待状态结束
                        setIsWaitingForData(false);
                        setShowNextButton(false);
                    }
    
                    // 保存新的事件数据（如果存在）
                    if (data.newEvent) {
                        console.log('有 newEvent:', data.newEvent); // 调试
                        setNewEvent(data.newEvent);
                    } else if (data.completedEvent) {
                        console.log('有 completedEvent:', data.completedEvent); // 调试
                        setNewEvent({ 
                            completed: true, 
                            completedEvent: data.completedEvent,
                            hasNewEvent: false 
                        });
                    }
                    
                    setLoading(false);
                    setIsWaitingForData(false);
                    setSelectedOptionIndex(null);
                    console.log('处理完成'); // 调试
                    options?.onSuccess?.(data);
                } else {
                    const errorMsg = data.message || '响应数据格式错误';
                    console.error('响应数据错误:', data); // 调试
                    setLoading(false);
                    setIsWaitingForData(false);
                    setSelectedOptionIndex(null);
                    options?.onError?.(errorMsg);
                }
            } else {
                const errorMsg = `请求失败: ${response.statusText}`;
                console.error('请求失败，状态码:', response.status); // 调试
                setLoading(false);
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
                options?.onError?.(errorMsg);
            }
        } catch (error) {
            const errorMsg = `请求错误: ${error instanceof Error ? error.message : '未知错误'}`;
            console.error('❌ 选择处理错误:', errorMsg);
            console.error('错误详情:', error); // 调试
            setLoading(false);
            setIsWaitingForData(false);
            setSelectedOptionIndex(null);
            options?.onError?.(errorMsg);
        }
    }, [sessionId, processNarrativeSteps, showStep]);

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
        clearNewEvent: () => { setNewEvent(null); }
    };
};

