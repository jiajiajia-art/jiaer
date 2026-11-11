/**
 * 功能性NPC专用的重试处理器
 * 只处理 ability_node 请求的重试
 */
import { useCallback, useRef } from 'react';

type AbilityNodeRequest = {
  nodeId: string;
  actionId: string;
} | null;

interface UseAbilityNodeRetryHandlerOptions {
  onRetry: (nodeId: string, actionId: string) => Promise<void>;
  setErrorModal: (value: { visible: boolean; message: string }) => void;
  setTimeoutModal: (value: { visible: boolean; message: string }) => void;
}

export function useAbilityNodeRetryHandler({
  onRetry,
  setErrorModal,
  setTimeoutModal,
}: UseAbilityNodeRetryHandlerOptions) {
  const lastRequestRef = useRef<AbilityNodeRequest>(null);

  const recordLastRequest = useCallback((request: AbilityNodeRequest) => {
    lastRequestRef.current = request;
  }, []);

  const handleRetryRequest = useCallback(async () => {
    const lastRequest = lastRequestRef.current;
    
    if (!lastRequest) {
      setErrorModal({
        visible: true,
        message: '没有可重试的请求',
      });
      return;
    }

    try {
      await onRetry(lastRequest.nodeId, lastRequest.actionId);
      setErrorModal({ visible: false, message: '' });
      setTimeoutModal({ visible: false, message: '' });
    } catch (error: any) {
      setErrorModal({
        visible: true,
        message: error?.message || '重试失败，请稍后再试',
      });
    }
  }, [onRetry, setErrorModal, setTimeoutModal]);

  return {
    handleRetryRequest,
    recordLastRequest,
  };
}

