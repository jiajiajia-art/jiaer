    import { useState, useRef, useEffect, useCallback } from 'react';
    import { authFetch } from '../../api/base';
    import { HOST_ADDRESS } from '../../config';
    import { useAuthStore } from '../../store/useAuthStore';
    import { toast } from 'react-hot-toast';
    import payApi from '../../api/pay/payApi';
    import { auth } from '../../api/account/authApi';
    import { useMapGalgameStore } from '../../store/mapGalgameStore';

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
        const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
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
                console.error('获取用户信息错误:', error);
            }
        }, [updateUser]);

        // 世界交互扣积分：type 为 "option"（2 积分）或 "selfDefined"（3 积分）
        const reducePoints = useCallback(async (type: 'option' | 'selfDefined') => {
            const response = await payApi.optionPoints({ type });
            if (response.data.success) {
                await getUserInfo();
                return response.data.data;
            }
            return null;
        }, [getUserInfo]);

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

        // 确保即使跳过 handleInteract（直接使用历史选项）也能拿到最新的 eventId
        useEffect(() => {
            currentEventIdRef.current = eventId;
        }, [eventId]);

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
                const key = `${sessionId}-${eventId}`;
                if (startedEvents.has(key)) {
                    console.log('[WorldInteraction] 初始交互已触发过，忽略重复请求:', key);
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
        
            if (historyLength > FREE_INTERACTIONS_THRESHOLD) {
                const isCustomInput = optionIndex === -1;
                const needPoints = isCustomInput ? 3 : 2;

                if (!user?.user.points || user.user.points <= needPoints) {
                    toast.error('积分不足');
                    return;
                }

                await reducePoints(isCustomInput ? 'selfDefined' : 'option');
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
                    if (currentRequestId.current !== requestId) {
                        console.log('请求已过期，忽略响应');
                        return;
                    }
        
                    if (data.success) {
                        const narrativeSteps = data.completedEvent.optionResponse?.narrativeSteps || [];
                            
                        setCurrentStep(null);
                        setShowNextButton(false);
        
                        if (narrativeSteps.length > 0) {
                            const [first, ...rest] = narrativeSteps;
                            
                            isProcessingStepRef.current = true;
                            await showStep(first);
                            isProcessingStepRef.current = false;
        
                            if (rest.length > 0) {
                                processNarrativeSteps(rest, requestId);
                            }
                        } else {
                            setIsWaitingForData(false);
                            setShowNextButton(false);
                        }
        
                        if (data.newEvent) {
                            setNewEvent(data.newEvent);
                        } else if (data.completedEvent) {
                            setNewEvent({ 
                                completed: true, 
                                completedEvent: data.completedEvent,
                                hasNewEvent: false 
                            });

                            try {
                                const { setEventData } = useMapGalgameStore.getState();
                                setEventData(null);
                            } catch (e) {
                                console.error('[WorldInteraction] 清空地图事件失败:', e);
                            }
                        }
                        
                        console.log('处理完成'); // 调试
                        options?.onSuccess?.(data);
                    }
                } else {
                    const errorMsg = `请求失败: ${response.statusText}`;
                    options?.onError?.(errorMsg);
                }
            } catch (error) {
                const errorMsg = `请求错误: ${error instanceof Error ? error.message : '未知错误'}`;
                options?.onError?.(errorMsg);
            } finally{
                setLoading(false);
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
            }
        }, [sessionId, historyLength, user?.user.points, processNarrativeSteps, showStep, reducePoints]);

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

