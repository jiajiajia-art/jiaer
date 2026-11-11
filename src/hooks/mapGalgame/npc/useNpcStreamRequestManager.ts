/**
 * 普通NPC专用的流式请求管理 Hook
 * 处理：请求状态管理、缓存恢复、轮询、错误处理
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { getStorageKeys, safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage } from '../common/interactionUtils';
import interactionApi from '../../../api/worldInteraction/interactionApi';
import type { PendingRequest } from '../useHistoryPolling';
import { REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGES } from '../../../components/GalgameMap/interaction/constants';

export type NpcRequestType = 'interact' | 'choice';

export interface NpcRequestState {
  type: NpcRequestType;
  optionId?: string;
  optionIndex?: number;
  timestamp: number;
}

interface UseNpcStreamRequestManagerOptions {
  sessionId: string | null;
  eventId: string | null;
  // 状态管理
  setHasPendingRequest: (value: boolean) => void;
  setPendingRequestForPoll: (value: PendingRequest | null) => void;
  setTimeoutModal: (value: { visible: boolean; message: string }) => void;
  setErrorModal: (value: { visible: boolean; message: string }) => void;
  // 回调
  onRequestStart?: () => void;
  onRequestComplete?: () => void;
  onRequestError?: (error: string) => void;
}

const PENDING_REQUEST_MAX_AGE = 5 * 60 * 1000; // 5分钟

export function useNpcStreamRequestManager(options: UseNpcStreamRequestManagerOptions) {
  const {
    sessionId,
    eventId,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal,
    setErrorModal,
    onRequestStart,
    onRequestComplete,
    onRequestError,
  } = options;

  const [lastRequest, setLastRequest] = useState<NpcRequestState | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  // 清理函数
  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  /**
   * 记录请求开始（请求前调用）
   */
  const recordRequestStart = useCallback(
    (request: NpcRequestState) => {
      if (!sessionId || !eventId) return;

      setLastRequest(request);
      setHasPendingRequest(true);

      // 保存到 localStorage
      const storageKeys = getStorageKeys(sessionId, eventId);
      if (storageKeys.pendingRequest) {
        const payload = {
          type: request.type === 'choice' ? 'select-option' : 'interact',
          optionId: request.optionId,
          timestamp: request.timestamp,
        };
        safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify(payload));
      }

      // 设置超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        if (timeoutRef.current) {
          const timeoutMessage =
            request.type === 'choice'
              ? TIMEOUT_MESSAGES.CHOICE
              : TIMEOUT_MESSAGES.INTERACT;
          setTimeoutModal({
            visible: true,
            message: timeoutMessage,
          });
        }
      }, REQUEST_TIMEOUT_MS);

      onRequestStart?.();
    },
    [
      sessionId,
      eventId,
      setHasPendingRequest,
      setPendingRequestForPoll,
      setTimeoutModal,
      onRequestStart,
      REQUEST_TIMEOUT_MS, // 添加到依赖数组
    ]
  );

  /**
   * 记录请求完成（请求成功后调用）
   */
  const recordRequestComplete = useCallback(() => {
    if (!sessionId || !eventId) return;

    // 清除超时定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 清除 localStorage
    const storageKeys = getStorageKeys(sessionId, eventId);
    if (storageKeys.pendingRequest) {
      safeRemoveLocalStorage(storageKeys.pendingRequest);
    }

    // 清除轮询
    setPendingRequestForPoll(null);
    setHasPendingRequest(false);
    setTimeoutModal({ visible: false, message: '' });

    onRequestComplete?.();
  }, [
    sessionId,
    eventId,
    setHasPendingRequest,
    setPendingRequestForPoll,
    setTimeoutModal,
    onRequestComplete,
  ]);

  /**
   * 记录请求错误（请求失败时调用）
   */
  const recordRequestError = useCallback(
    (error: string, shouldRetry: boolean = true) => {
      if (!sessionId || !eventId) return;

      // 清除超时定时器
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // 如果不需要重试，清除 pending 状态
      if (!shouldRetry) {
        const storageKeys = getStorageKeys(sessionId, eventId);
        if (storageKeys.pendingRequest) {
          safeRemoveLocalStorage(storageKeys.pendingRequest);
        }
        setPendingRequestForPoll(null);
        setHasPendingRequest(false);
      }

      setTimeoutModal({ visible: false, message: '' });
      setErrorModal({
        visible: true,
        message: error,
      });

      onRequestError?.(error);
    },
    [
      sessionId,
      eventId,
      setHasPendingRequest,
      setPendingRequestForPoll,
      setTimeoutModal,
      setErrorModal,
      onRequestError,
    ]
  );

  /**
   * 恢复未完成的请求（页面刷新后调用）
   */
  const restorePendingRequest = useCallback((): NpcRequestState | null => {
    if (!sessionId || !eventId) return null;

    const storageKeys = getStorageKeys(sessionId, eventId);
    if (!storageKeys.pendingRequest) return null;

    const pendingRequestRaw = safeGetLocalStorage(storageKeys.pendingRequest);
    if (!pendingRequestRaw) return null;

    try {
      const parsed = JSON.parse(pendingRequestRaw);
      const requestAge = Date.now() - (parsed?.timestamp || 0);

      // 检查请求是否过期（超过5分钟）
      if (requestAge > PENDING_REQUEST_MAX_AGE) {
        safeRemoveLocalStorage(storageKeys.pendingRequest);
        return null;
      }

      // 恢复请求状态
      const restoredRequest: NpcRequestState = {
        type: parsed.type === 'select-option' ? 'choice' : 'interact',
        optionId: parsed.optionId,
        timestamp: parsed.timestamp,
      };

      setLastRequest(restoredRequest);
      setHasPendingRequest(true);

      // 启动轮询
      setPendingRequestForPoll({
        type: parsed.type,
        optionId: parsed.optionId,
        startTime: parsed.timestamp,
      });

      return restoredRequest;
    } catch (e) {
      console.warn('[useNpcStreamRequestManager] 解析未完成请求失败:', e);
      safeRemoveLocalStorage(storageKeys.pendingRequest);
      return null;
    }
  }, [sessionId, eventId]);

  /**
   * 检查并处理 event 已完成但前端状态未更新的情况
   */
  const checkEventCompletion = useCallback(
    async (): Promise<boolean> => {
      if (!sessionId) return false;

      try {
        // 检查是否有活跃事件
        const activeEventsResponse = await interactionApi.getActiveEvents(sessionId);
        if (activeEventsResponse.data.success) {
          const activeEvents = activeEventsResponse.data.events || [];
          const hasActiveEvent = Array.isArray(activeEvents) && activeEvents.length > 0;

          // 如果没有活跃事件，说明 event 已完成
          if (!hasActiveEvent) {
            // 清除 pending 状态
            const storageKeys = getStorageKeys(sessionId, eventId);
            if (storageKeys.pendingRequest) {
              safeRemoveLocalStorage(storageKeys.pendingRequest);
            }
            setPendingRequestForPoll(null);
            setHasPendingRequest(false);

            return true; // 返回 true 表示 event 已完成
          }
        }
      } catch (error) {
        console.error('[useNpcStreamRequestManager] 检查 event 完成状态失败:', error);
      }

      return false;
    },
    [sessionId, eventId]
  );

  /**
   * 清除超时定时器（收到第一个步骤时调用）
   */
  const clearRequestTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setTimeoutModal({ visible: false, message: '' });
  }, [setTimeoutModal]);

  return {
    lastRequest,
    recordRequestStart,
    recordRequestComplete,
    recordRequestError,
    restorePendingRequest,
    checkEventCompletion,
    clearRequestTimeout,
    cleanup,
  };
}

