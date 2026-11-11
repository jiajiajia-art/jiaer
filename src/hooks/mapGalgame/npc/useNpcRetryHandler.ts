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
            onFirstStep?: () => void;
            isRetry?: boolean;
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
    onRetryInteractStart?: () => void; // 重试初始交互时的回调，用于记录请求开始
}

export function useNpcRetryHandler({
    stepHandlers,
    setErrorModal,
    setTimeoutModal,
    onRetryInteractStart,
}: UseRetryHandlerOptions) {
    const lastRequestRef = useRef<LastRequest>(null);

    const recordLastRequest = useCallback((request: LastRequest) => {
        lastRequestRef.current = request;
    }, []);

    const handleRetryRequest = useCallback(() => {
        const lastRequest = lastRequestRef.current;
        
        // 重试初始交互请求的逻辑（无论是否有 lastRequest 记录）
        const retryInteract = () => {
            console.log('[useNpcRetryHandler] 重试初始交互请求');
            // 先记录请求开始（用于超时检测和状态管理）
            if (onRetryInteractStart) {
                onRetryInteractStart();
            }
            // 记录最后一次请求类型
            recordLastRequest({ type: 'interact' });
            // 调用 handleInteract
            stepHandlers.handleInteract({
                isRetry: true, // 标记为重试请求
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
        };

        if (!lastRequest) {
            retryInteract();
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
            retryInteract();
        }
    }, [stepHandlers, setErrorModal, setTimeoutModal, onRetryInteractStart, recordLastRequest]);

    return {
        handleRetryRequest,
        recordLastRequest,
    };
}

