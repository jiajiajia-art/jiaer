/**
 * 功能性NPC专用的流式请求管理 Hook（简化版）
 * 处理：请求状态管理、错误处理、超时处理
 * 不包含：轮询、状态保存（功能性NPC不需要，刷新后退出）
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGES } from '../../../components/GalgameMap/interaction/constants';

export interface AbilityNodeRequestState {
  nodeId: string;
  actionId: string;
  timestamp: number;
}

interface UseAbilityNodeStreamRequestManagerOptions {
  sessionId: string | null;
  setTimeoutModal: (value: { visible: boolean; message: string }) => void;
  setErrorModal: (value: { visible: boolean; message: string }) => void;
  onRequestStart?: () => void;
  onRequestComplete?: () => void;
  onRequestError?: (error: string) => void;
}

export function useAbilityNodeStreamRequestManager(options: UseAbilityNodeStreamRequestManagerOptions) {
  const {
    sessionId,
    setTimeoutModal,
    setErrorModal,
    onRequestStart,
    onRequestComplete,
    onRequestError,
  } = options;

  const [lastRequest, setLastRequest] = useState<AbilityNodeRequestState | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const hasTimedOutRef = useRef<boolean>(false); // 标记是否已经超时
  const cancelledRef = useRef(false);

  // 清理函数
  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * 记录请求开始（请求前调用）
   * 功能性NPC不保存状态，刷新后退出
   */
  const recordRequestStart = useCallback(
    (request: AbilityNodeRequestState) => {
      if (!sessionId) return;

      setLastRequest(request);

      // 设置超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const timeoutId = window.setTimeout(() => {
        // 检查定时器是否仍然有效（没有被清除）
        if (timeoutRef.current === timeoutId) {
          timeoutRef.current = null;
          hasTimedOutRef.current = true; // 标记已超时
          setTimeoutModal({
            visible: true,
            message: TIMEOUT_MESSAGES.ABILITY_NODE,
          });
        }
      }, REQUEST_TIMEOUT_MS);
      timeoutRef.current = timeoutId;

      onRequestStart?.();
    },
    [sessionId, setTimeoutModal, onRequestStart, REQUEST_TIMEOUT_MS]
  );

  /**
   * 记录请求完成（请求成功后调用）
   */
  const recordRequestComplete = useCallback(() => {
    if (!sessionId || !lastRequest) return;

    // 清除超时定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 如果已经超时，不要清除超时弹窗（让用户看到超时提示）
    if (!hasTimedOutRef.current) {
      setTimeoutModal({ visible: false, message: '' });
    }

    onRequestComplete?.();
  }, [sessionId, lastRequest, setTimeoutModal, onRequestComplete]);

  /**
   * 记录请求错误（请求失败时调用）
   */
  const recordRequestError = useCallback(
    (error: string, _shouldRetry: boolean = true) => {
      if (!sessionId) return;

      // 清除超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setTimeoutModal({ visible: false, message: '' });
      setErrorModal({
        visible: true,
        message: error,
      });

      onRequestError?.(error);
    },
    [sessionId, setTimeoutModal, setErrorModal, onRequestError]
  );

  /**
   * 恢复未完成的请求（功能性NPC不支持，刷新后退出）
   */
  const restorePendingRequest = useCallback((): AbilityNodeRequestState | null => {
    // 功能性NPC不保存状态，刷新后退出
    return null;
  }, []);

  /**
   * 清除超时定时器（收到第一个步骤时调用）
   */
  const clearRequestTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    hasTimedOutRef.current = false; // 重置超时标记
    setTimeoutModal({ visible: false, message: '' });
  }, [setTimeoutModal]);

  return {
    lastRequest,
    recordRequestStart,
    recordRequestComplete,
    recordRequestError,
    restorePendingRequest, // 始终返回 null，功能性NPC不支持恢复
    clearRequestTimeout,
    cleanup,
  };
}

