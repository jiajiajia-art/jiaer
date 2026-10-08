import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import type { ContextMemoryStatus } from '../../api/galgame/getGalgamePreset.type';
import { isGenerationBusyError, shouldDeferChoiceUntilStreamReady, GENERATION_BUSY_MAX_RETRIES, getGenerationBusyRetryDelayMs } from '../../lib/galgame/choiceStepDisplayGate';
import {
    isInsufficientDiamondsError,
    type PlayInteractionType,
    type StreamBusinessError,
} from '../../lib/galgame/playBilling';

export function createGalgameActionId(sessionId: string | null, _action: string): string {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `visual-${sessionId || 'session'}-${Date.now()}-${randomPart}`;
}

interface UseGalgameStepOptions {
    sessionId: string | null;
    historyLength?: number;
    onMessagesClear?: () => void;
    // allSteps callback from stream complete event
    onCompleteAllSteps?: (steps: any[]) => void;
    onStreamComplete?: () => void;
    // Called after error alert is shown
    onErrorAfterAlert?: (error: string) => void;
    /** 用户行动发出时回调（用于历史面板即时展示用户选择/输入） */
    onUserAction?: (action: string) => void;
    // Replay mode: avoid showing "AI generating" on queue exhausted
    isReplay?: boolean;
    isTextMode?: boolean;
    onExhausted?: () => void;
    onContextMemoryUpdate?: (status: ContextMemoryStatus) => void;
    onContextCompressionDone?: (status: ContextMemoryStatus | null) => void;
    onStreamActivity?: (data: any) => void;
    onInsufficientDiamonds?: (error: StreamBusinessError) => void;
}

export const useGalgameStep = ({
    sessionId,
    historyLength,
    onMessagesClear,
    onCompleteAllSteps,
    onStreamComplete,
    onErrorAfterAlert,
    onUserAction,
    isReplay = false,
    isTextMode = false,
    onExhausted,
    onContextMemoryUpdate,
    onContextCompressionDone,
    onStreamActivity,
    onInsufficientDiamonds,
}: UseGalgameStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [isCompressingContext, setIsCompressingContext] = useState(false);
    const [contextMemory, setContextMemory] = useState<ContextMemoryStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const loadingRef = useRef(false);
    const { updateUser } = useAuthStore();

    // Track assistant round count from history
    const historyLengthRef = useRef<number>(historyLength ?? 0);
    useEffect(() => {
        historyLengthRef.current = historyLength ?? 0;
    }, [historyLength]);

    // Sync currentStep to ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    // Reset all state when session changes
    useEffect(() => {
        currentRequestId.current = 0;
        setCurrentStep(null);
        setStepQueue([]);
        setShowNextButton(false);
        setSelectedOptionIndex(null);
        setIsWaitingForData(false);
        setIsCompressingContext(false);
        setContextMemory(null);
        setLoading(false);
        isProcessingStepRef.current = false;
    }, [sessionId]);

    // Refresh user info after stream success
    const getUserInfo = useCallback(async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('[Galgame] Failed to fetch user info:', error);
        }
    }, [updateUser]);

    const resetStreamRetryDisplay = useCallback(() => {
        setCurrentStep(null);
        setStepQueue([]);
        setShowNextButton(false);
        setSelectedOptionIndex(null);
        setIsWaitingForData(true);
        setLoading(true);
        isProcessingStepRef.current = false;
    }, []);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        // Galgame does not need mission flag handling
        onMissionFlag: undefined,
        onCompleteAllSteps,
        // Add fallback empty choice step if stream has no explicit choice
        enableFallbackEmptyChoice: true,
    });

    const showStep = useCallback(async (step: any) => {
        if (!step) return;
        setCurrentStep(step);
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
        setShowNextButton(step.type !== 'choice');
    }, []);

    // 对话步可边生成边播；choice 必须等本轮 stream loading 结束再上屏，避免抢锁报错
    useEffect(() => {
        if (stepQueue.length === 0) return;
        if (currentStep && !isWaitingForData) return;
        if (isProcessingStepRef.current) return;

        const nextStep = stepQueue[0];
        if (shouldDeferChoiceUntilStreamReady({
            stepType: nextStep?.type,
            streamLoading: loading,
        })) {
            return;
        }

        isProcessingStepRef.current = true;
        setStepQueue((prev) => prev.slice(1));

        void (async () => {
            await showStep(nextStep);
            isProcessingStepRef.current = false;
        })();
    }, [stepQueue, currentStep, isWaitingForData, loading, showStep]);

    // Handle stream request (galgame endpoint)
    const handleStreamAction = useCallback(
        async (
            action: string,
            options?: {
                onBeforeRequest?: () => void;
                onSuccess?: () => void;
                onFirstStep?: () => void;
                onError?: (error: string) => void;
                deduct?: boolean;
                actionId?: string;
                interactionType?: PlayInteractionType;
                choiceSnapshot?: unknown;
            }
        ) => {
            if (!sessionId) {
                options?.onError?.('No sessionId, cannot send request.');
                return;
            }

            try {
                const requestId = ++currentRequestId.current;
                const choiceSnapshot = options?.choiceSnapshot
                    || (currentStepRef.current?.type === 'choice' ? currentStepRef.current : null);
                const interactionType = options?.interactionType
                    || (options?.deduct ? 'custom_input' : 'preset_option');

                // Start fresh for new request so previous step does not block queue
                setCurrentStep(null);
                setStepQueue([]);
                setShowNextButton(false);
                setIsWaitingForData(true);
                setLoading(true);

                onMessagesClear?.();
                if (!isReplay && (interactionType === 'preset_option' || interactionType === 'custom_input')) {
                    onUserAction?.(action);
                }
                options?.onBeforeRequest?.();

                const requestBody: any = {
                    action,
                    actionId: options?.actionId || createGalgameActionId(sessionId, action),
                    interactionType,
                };
                if (options?.deduct) {
                    requestBody.deduct = true;
                }
                if (isTextMode && !isReplay) {
                    requestBody.textModeMemoryEnabled = true;
                }

                const response = await authFetch(
                    `${HOST_ADDRESS}/api/visual/session/${sessionId}/action/stream`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                    }
                );

                if (response.ok) {
                    await processStreamResponse(response, requestId, {
                        onSuccess: async () => {
                            setIsCompressingContext(false);
                            if (options?.onSuccess) {
                                await options.onSuccess();
                            }
                            if (onStreamComplete) {
                                try {
                                    await onStreamComplete();
                                } catch (e) {
                                    console.error('Failed to run onStreamComplete:', e);
                                }
                            }
                            // KV 锁释放存在短暂可见性延迟：稍等再解锁，避免选项一点就抢锁失败
                            await new Promise((resolve) => window.setTimeout(resolve, 700));
                            if (currentRequestId.current !== requestId) {
                                return;
                            }
                            setLoading(false);
                            await getUserInfo();
                        },
                        onError: (error) => {
                            setIsCompressingContext(false);
                            setLoading(false);
                            setCurrentStep(null);
                            setStepQueue([]);
                            setShowNextButton(false);
                            options?.onError?.(error);
                        },
                        onBusinessError: (error) => {
                            if (!isInsufficientDiamondsError(error)) {
                                return false;
                            }
                            setIsCompressingContext(false);
                            setLoading(false);
                            setCurrentStep(choiceSnapshot);
                            setStepQueue([]);
                            setShowNextButton(false);
                            setSelectedOptionIndex(null);
                            setIsWaitingForData(false);
                            onInsufficientDiamonds?.(error);
                            return true;
                        },
                        onFirstStep: options?.onFirstStep,
                        onActivity: onStreamActivity,
                        onData: (data) => {
                            if (data?.contextMemory) {
                                setContextMemory(data.contextMemory);
                                onContextMemoryUpdate?.(data.contextMemory);
                            }
                            if (data?.type === 'error' && data?.code === 'ACTION_IN_PROGRESS') {
                                setIsCompressingContext(false);
                                setLoading(false);
                                return;
                            }
                            if (data?.type === 'context_compression_start') {
                                setIsCompressingContext(true);
                                return;
                            }
                            if (data?.type === 'context_compression_done') {
                                setIsCompressingContext(false);
                                onContextCompressionDone?.(data?.contextMemory || null);
                                return;
                            }
                            if (data?.type === 'error') {
                                setIsCompressingContext(false);
                            }
                        },
                        onGenerationRetry: resetStreamRetryDisplay,
                        onErrorAfterAlert,
                    });
                } else {
                    const errorMsg = `Request failed: ${response.statusText}`;
                    setIsCompressingContext(false);
                    setLoading(false);
                    setSelectedOptionIndex(null);
                    setIsWaitingForData(false);
                    options?.onError?.(errorMsg);
                }
            } catch (error) {
                const errorMsg = `Request error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error('[Galgame] handleStreamAction error:', errorMsg);
                setIsCompressingContext(false);
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        },
        [sessionId, processStreamResponse, onMessagesClear, onStreamComplete, onErrorAfterAlert, onUserAction, getUserInfo, isTextMode, isReplay, onContextMemoryUpdate, onContextCompressionDone, onStreamActivity, onInsufficientDiamonds, resetStreamRetryDisplay]
    );

    // Handle next step in queue
    const handleNextStep = useCallback(() => {
        setStepQueue((prev) => {
            if (prev.length === 0) {
                setCurrentStep(null);
                setShowNextButton(false);
                if (isReplay) {
                    // Replay mode: queue exhausted means finish replay
                    setIsWaitingForData(false);
                    try {
                        onExhausted && onExhausted();
                    } catch {}
                } else {
                    setIsWaitingForData(true);
                }
                return prev;
            }

            const [nextStep, ...rest] = prev;
            // 点「下一步」也不能提前露出 choice，否则会绕过 loading 门闩抢锁
            if (shouldDeferChoiceUntilStreamReady({
                stepType: nextStep?.type,
                streamLoading: loadingRef.current,
            })) {
                setCurrentStep(null);
                setIsWaitingForData(true);
                setShowNextButton(false);
                return prev;
            }

            void (async () => {
                isProcessingStepRef.current = true;
                await showStep(nextStep);
                isProcessingStepRef.current = false;
            })();
            return rest;
        });
    }, [showStep, isReplay, onExhausted]);

    // Handle selecting a choice option
    const handleChoiceOption = useCallback(
        async (option: { text: string; nextId: string }, optionIndex: number, actionId?: string, choiceSnapshot?: unknown) => {
            setSelectedOptionIndex(optionIndex);
            setIsWaitingForData(true);
            setShowNextButton(false);

            const run = async (attempt: number) => {
                await handleStreamAction(option.text, {
                    onError: (error) => {
                        // 属性/任务落盘或 KV 可见性延迟时静默重试，避免弹出「正在生成中」
                        if (isGenerationBusyError(error) && attempt < GENERATION_BUSY_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getGenerationBusyRetryDelayMs(attempt));
                            return;
                        }
                        console.error('[Galgame] choice option error:', error);
                        setIsWaitingForData(false);
                        setSelectedOptionIndex(null);
                        if (isGenerationBusyError(error)) {
                            onErrorAfterAlert?.(String(error));
                        }
                    },
                    actionId,
                    interactionType: 'preset_option',
                    choiceSnapshot,
                });
            };
            await run(0);
        },
        [handleStreamAction, onErrorAfterAlert]
    );

    // Handle custom input send
    const handleChoiceSend = useCallback(
        async (inputText: string, actionId?: string, choiceSnapshot?: unknown) => {
            if (!inputText.trim()) {
                return;
            }

            setIsWaitingForData(true);
            setShowNextButton(false);

            const run = async (attempt: number) => {
                await handleStreamAction(inputText, {
                    onError: (error) => {
                        if (isGenerationBusyError(error) && attempt < GENERATION_BUSY_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getGenerationBusyRetryDelayMs(attempt));
                            return;
                        }
                        console.error('[Galgame] custom input error:', error);
                        setIsWaitingForData(false);
                        if (isGenerationBusyError(error)) {
                            onErrorAfterAlert?.(String(error));
                        }
                    },
                    deduct: true,
                    actionId,
                    interactionType: 'custom_input',
                    choiceSnapshot,
                });
            };
            await run(0);
        },
        [handleStreamAction, onErrorAfterAlert]
    );

    // Handle regenerate from a history index
    const handleRegenerate = useCallback(
        async (
            messageIndex: number,
            options?: {
                onBeforeRequest?: () => void;
                onSuccess?: () => void;
                onError?: (error: string) => void;
            }
        ) => {
            if (!sessionId) {
                options?.onError?.('No sessionId, cannot send request.');
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

                const response = await authFetch(
                    `${HOST_ADDRESS}/api/visual/session/${sessionId}/regenerate`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ historyIndex: messageIndex }),
                    }
                );

                if (response.ok) {
                    await processStreamResponse(response, requestId, {
                        onSuccess: async () => {
                            if (options?.onSuccess) {
                                await options.onSuccess();
                            }
                            if (onStreamComplete) {
                                try {
                                    await onStreamComplete();
                                } catch (e) {
                                    console.error('Failed to run onStreamComplete:', e);
                                }
                            }
                            // KV 锁释放存在短暂可见性延迟：稍等再解锁，避免选项一点就抢锁失败
                            await new Promise((resolve) => window.setTimeout(resolve, 700));
                            if (currentRequestId.current !== requestId) {
                                return;
                            }
                            setLoading(false);
                            await getUserInfo();
                        },
                        onError: (error) => {
                            setLoading(false);
                            setCurrentStep(null);
                            setStepQueue([]);
                            setShowNextButton(false);
                            options?.onError?.(error);
                        },
                        onGenerationRetry: resetStreamRetryDisplay,
                        onErrorAfterAlert,
                    });
                } else {
                    const errorMsg = `Request failed: ${response.statusText}`;
                    setLoading(false);
                    setSelectedOptionIndex(null);
                    setIsWaitingForData(false);
                    options?.onError?.(errorMsg);
                }
            } catch (error) {
                const errorMsg = `Request error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error('[Galgame] handleRegenerate error:', errorMsg);
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        },
        [sessionId, processStreamResponse, onMessagesClear, onStreamComplete, onErrorAfterAlert, getUserInfo, resetStreamRetryDisplay]
    );

    return {
        currentStep,
        stepQueue,
        showNextButton,
        selectedOptionIndex,
        isWaitingForData,
        isCompressingContext,
        contextMemory,
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
        setStepQueue,
    };
};
