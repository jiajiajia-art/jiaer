/**
 * 处理选择选项的逻辑 Hook
 */
import { useCallback, useRef } from 'react';
import { getStorageKeys, safeSetLocalStorage, safeRemoveLocalStorage } from './interactionUtils';
import { REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGES, ERROR_MESSAGES } from '../../components/GalgameMap/InteractWithNpc';

interface UseChoiceHandlerOptions {
    sessionId: string | null;
    eventId: string | null;
    hasPendingRequest: boolean;
    stepHandlers: {
        currentStep: any;
        isWaitingForData: boolean;
        handleChoiceOption: (
            optionId: string,
            optionIndex: number,
            callbacks?: {
                onSuccess?: () => void;
                onFirstStep?: () => void;
                onError?: (error: string) => void;
            }
        ) => void;
    };
    currentMessage: any;
    setHasPendingRequest: (value: boolean) => void;
    setCompletedSteps: (value: any[] | ((prev: any[]) => any[])) => void;
    setTimeoutModal: (value: { visible: boolean; message: string }) => void;
    setErrorModal: (value: { visible: boolean; message: string }) => void;
    onLastRequestRecord?: (request: { type: 'choice'; optionId: string; optionIndex: number }) => void;
}

export function useChoiceHandler({
    sessionId,
    eventId,
    hasPendingRequest,
    stepHandlers,
    currentMessage,
    setHasPendingRequest,
    setCompletedSteps,
    setTimeoutModal,
    setErrorModal,
    onLastRequestRecord,
}: UseChoiceHandlerOptions) {
    const choiceTimeoutRef = useRef<number | null>(null);
    const choiceInFlightRef = useRef(false);

    const clearChoiceTimeout = useCallback(() => {
        if (choiceTimeoutRef.current) {
            clearTimeout(choiceTimeoutRef.current);
            choiceTimeoutRef.current = null;
        }
    }, []);

    const clearPending = useCallback(() => {
        const storageKeys = getStorageKeys(sessionId, eventId);
        if (storageKeys.pendingRequest) {
            safeRemoveLocalStorage(storageKeys.pendingRequest);
        }
        setHasPendingRequest(false);
    }, [sessionId, eventId, setHasPendingRequest]);

    const handleChoiceClick = useCallback(
        (option: { text: string; optionId?: string }) => {
            if (choiceInFlightRef.current || hasPendingRequest || stepHandlers.isWaitingForData) {
                return;
            }
            choiceInFlightRef.current = true;
            setCompletedSteps([]);

            let optionId: string | undefined = option.optionId;
            let optionIndex = -1;

            // 从 currentStep 中查找 optionId
            if (!optionId && stepHandlers.currentStep?.type === 'choice') {
                optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                    if (typeof opt === 'string') {
                        return opt === option.text;
                    }
                    return opt.text === option.text || opt.optionId === option.optionId;
                }) ?? -1;

                if (optionIndex >= 0) {
                    const stepOption = stepHandlers.currentStep.options?.[optionIndex];
                    if (stepOption && typeof stepOption !== 'string') {
                        optionId = stepOption.optionId ? String(stepOption.optionId) : undefined;
                    }
                }
            }

            // 从 currentMessage 中查找 optionId
            if (optionIndex < 0 && currentMessage?.type === 'choice' && currentMessage.options) {
                optionIndex = currentMessage.options.findIndex((opt: any) => {
                    return opt.text === option.text || opt.optionId === option.optionId;
                });

                if (optionIndex >= 0) {
                    const msgOption = currentMessage.options[optionIndex] as any;
                    optionId = msgOption.optionId ? String(msgOption.optionId) : undefined;
                }
            }

            // 如果 optionId 已提供，从选项中查找索引
            if (optionId && optionIndex < 0) {
                if (stepHandlers.currentStep?.type === 'choice') {
                    optionIndex = stepHandlers.currentStep.options?.findIndex((opt: any) => {
                        if (typeof opt === 'string') return false;
                        return opt.optionId === optionId || String(opt.optionId) === optionId;
                    }) ?? -1;
                }

                if (optionIndex < 0 && currentMessage?.type === 'choice' && currentMessage.options) {
                    optionIndex = currentMessage.options.findIndex((opt: any) => {
                        return opt.optionId === optionId || String(opt.optionId) === optionId;
                    });
                }
            }

            if (!optionId) {
                console.error('无法找到选项或 optionId:', { option, optionIndex, optionId });
                choiceInFlightRef.current = false;
                return;
            }

            const finalOptionIndex = optionIndex >= 0 ? optionIndex : -1;

            // 记录最后一次请求
            if (onLastRequestRecord) {
                onLastRequestRecord({ type: 'choice', optionId, optionIndex: finalOptionIndex });
            }

            // 保存请求状态
            const storageKeys = getStorageKeys(sessionId, eventId);
            if (storageKeys.pendingRequest) {
                const payload = {
                    type: 'select-option' as const,
                    optionId,
                    timestamp: Date.now(),
                };
                safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify(payload));
                setHasPendingRequest(true);
            }

            // 设置超时
            clearChoiceTimeout();
            choiceTimeoutRef.current = window.setTimeout(() => {
                setTimeoutModal({
                    visible: true,
                    message: TIMEOUT_MESSAGES.CHOICE,
                });
            }, REQUEST_TIMEOUT_MS);

            // 发送请求
            stepHandlers.handleChoiceOption(optionId, finalOptionIndex, {
                onSuccess: () => {
                    clearChoiceTimeout();
                    setTimeoutModal({ visible: false, message: '' });
                    choiceInFlightRef.current = false;
                    clearPending();
                },
                onFirstStep: () => {
                    clearChoiceTimeout();
                    setTimeoutModal({ visible: false, message: '' });
                    choiceInFlightRef.current = false;
                    clearPending();
                },
                onError: (error) => {
                    console.error('选择选项失败:', error);
                    clearChoiceTimeout();
                    setTimeoutModal({ visible: false, message: '' });
                    choiceInFlightRef.current = false;
                    setErrorModal({
                        visible: true,
                        message: error || ERROR_MESSAGES.CHOICE_FAILED,
                    });
                    clearPending();
                },
            });
        },
        [
            hasPendingRequest,
            stepHandlers,
            currentMessage,
            sessionId,
            eventId,
            setHasPendingRequest,
            setCompletedSteps,
            setTimeoutModal,
            setErrorModal,
            clearChoiceTimeout,
            clearPending,
            onLastRequestRecord,
        ]
    );

    // 清理函数
    const cleanup = useCallback(() => {
        clearChoiceTimeout();
    }, [clearChoiceTimeout]);

    return {
        handleChoiceClick,
        choiceTimeoutRef,
        cleanup,
    };
}

