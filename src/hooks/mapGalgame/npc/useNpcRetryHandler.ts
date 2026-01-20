/**
 * 处理请求重试的逻辑 Hook
 */
import { useCallback, useRef } from 'react';
import { ERROR_MESSAGES } from '../../../components/GalgameMap/interaction/constants';

type LastRequest = 
    | { type: 'interact' }
    | { type: 'choice'; optionId: string; optionIndex: number }
    | null;

interface UseRetryHandlerOptions {
    stepHandlers: {
        handleInteract: (options?: {
            onSuccess?: () => void;
            onError?: (error: string) => void;
        }) => void;
        handleChoiceOption: (
            optionId: string,
            optionIndex: number,
            callbacks?: {
                onSuccess?: () => void;
                onError?: (error: string) => void;
            }
        ) => void;
    };
    setErrorModal: (value: { visible: boolean; message: string }) => void;
    setTimeoutModal: (value: { visible: boolean; message: string }) => void;
}

export function useNpcRetryHandler({
    stepHandlers,
    setErrorModal,
    setTimeoutModal,
}: UseRetryHandlerOptions) {
    const lastRequestRef = useRef<LastRequest>(null);

    const recordLastRequest = useCallback((request: LastRequest) => {
        lastRequestRef.current = request;
    }, []);

    const handleRetryRequest = useCallback(() => {
        const lastRequest = lastRequestRef.current;
        
        if (!lastRequest) {
            // 如果没有记录最后一次请求，可能是初始交互，尝试调用 handleInteract
            stepHandlers.handleInteract({
                onSuccess: () => {
                    setErrorModal({ visible: false, message: '' });
                    setTimeoutModal({ visible: false, message: '' });
                },
                onError: (error) => {
                    setErrorModal({
                        visible: true,
                        message: error || ERROR_MESSAGES.RETRY_FAILED,
                    });
                },
            });
            return;
        }

        if (lastRequest.type === 'choice') {
            // 重试选择请求
            stepHandlers.handleChoiceOption(lastRequest.optionId, lastRequest.optionIndex, {
                onSuccess: () => {
                    setErrorModal({ visible: false, message: '' });
                    setTimeoutModal({ visible: false, message: '' });
                },
                onError: (error) => {
                    setErrorModal({
                        visible: true,
                        message: error || ERROR_MESSAGES.RETRY_FAILED,
                    });
                },
            });
        } else if (lastRequest.type === 'interact') {
            // 重试初始交互请求
            stepHandlers.handleInteract({
                onSuccess: () => {
                    setErrorModal({ visible: false, message: '' });
                    setTimeoutModal({ visible: false, message: '' });
                },
                onError: (error) => {
                    setErrorModal({
                        visible: true,
                        message: error || ERROR_MESSAGES.RETRY_FAILED,
                    });
                },
            });
        }
    }, [stepHandlers, setErrorModal, setTimeoutModal]);

    return {
        handleRetryRequest,
        recordLastRequest,
    };
}

