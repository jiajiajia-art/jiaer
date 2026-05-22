import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import type { ContextMemoryStatus } from '../../api/galgame/getGalgamePreset.type';

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
    // Replay mode: avoid showing "AI generating" on queue exhausted
    isReplay?: boolean;
    isTextMode?: boolean;
    onExhausted?: () => void;
    onContextMemoryUpdate?: (status: ContextMemoryStatus) => void;
    onContextCompressionDone?: (status: ContextMemoryStatus | null) => void;
    onStreamActivity?: (data: any) => void;
}

export const useGalgameStep = ({
    sessionId,
    historyLength,
    onMessagesClear,
    onCompleteAllSteps,
    onStreamComplete,
    onErrorAfterAlert,
    isReplay = false,
    isTextMode = false,
    onExhausted,
    onContextMemoryUpdate,
    onContextCompressionDone,
    onStreamActivity,
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

    // Auto show next step when queue has data and no active step
    useEffect(() => {
        if (stepQueue.length === 0) return;
        if (currentStep && !isWaitingForData) return;
        if (isProcessingStepRef.current) return;

        const nextStep = stepQueue[0];
        isProcessingStepRef.current = true;
        setStepQueue((prev) => prev.slice(1));

        void (async () => {
            await showStep(nextStep);
            isProcessingStepRef.current = false;
        })();
    }, [stepQueue, currentStep, isWaitingForData, showStep]);

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
            }
        ) => {
            if (!sessionId) {
                options?.onError?.('No sessionId, cannot send request.');
                return;
            }

            try {
                const requestId = ++currentRequestId.current;

                // Start fresh for new request so previous step does not block queue
                setCurrentStep(null);
                setStepQueue([]);
                setShowNextButton(false);
                setIsWaitingForData(true);
                setLoading(true);

                onMessagesClear?.();
                options?.onBeforeRequest?.();

                const requestBody: any = {
                    action,
                    actionId: options?.actionId || createGalgameActionId(sessionId, action),
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
                            await getUserInfo();
                            setLoading(false);
                        },
                        onError: (error) => {
                            setIsCompressingContext(false);
                            setLoading(false);
                            setCurrentStep(null);
                            setStepQueue([]);
                            setShowNextButton(false);
                            options?.onError?.(error);
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
        [sessionId, processStreamResponse, onMessagesClear, onStreamComplete, onErrorAfterAlert, getUserInfo, isTextMode, isReplay, onContextMemoryUpdate, onContextCompressionDone, onStreamActivity, resetStreamRetryDisplay]
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
            void (async () => {
                isProcessingStepRef.current = true;
                await showStep(nextStep);
                isProcessingStepRef.current = false;
            })();
            return rest;
        });
    }, [showStep, isReplay, onExhausted]);

    // const FREE_ROUNDS = 30;

    // Handle selecting a choice option
    const handleChoiceOption = useCallback(
        async (option: { text: string; nextId: string }, optionIndex: number, actionId?: string) => {
            setSelectedOptionIndex(optionIndex);
            setIsWaitingForData(true);
            setShowNextButton(false);
            // Frontend points validation is temporarily disabled.
            // Backend should decide whether points are sufficient.

            await handleStreamAction(option.text, {
                onError: (error) => {
                    console.error('[Galgame] choice option error:', error);
                    setIsWaitingForData(false);
                    setSelectedOptionIndex(null);
                },
                actionId,
            });
        },
        [handleStreamAction]
    );

    // Handle custom input send
    const handleChoiceSend = useCallback(
        async (inputText: string, actionId?: string) => {
            if (!inputText.trim()) {
                return;
            }

            setIsWaitingForData(true);
            setShowNextButton(false);
            // Frontend points validation is temporarily disabled.
            // Backend should decide whether points are sufficient.

            await handleStreamAction(inputText, {
                onError: (error) => {
                    console.error('[Galgame] custom input error:', error);
                    setIsWaitingForData(false);
                },
                deduct: true,
                actionId,
            });
        },
        [handleStreamAction]
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
                            await getUserInfo();
                            setLoading(false);
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
