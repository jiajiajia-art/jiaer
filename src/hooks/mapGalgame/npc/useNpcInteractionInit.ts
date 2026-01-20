/**
 * 世界交互初始化 Hook
 * 处理：缓存恢复、未完成请求检测、历史获取、初始交互发起
 */
import { useEffect, useRef } from "react";
import interactionApi from "../../../api/worldInteraction/interactionApi";
import type { GetWorldInteractionHistoryResponse } from "../../../api/worldInteraction/interactionApi.type";
import type { PendingRequest } from "../useHistoryPolling";
import { getStorageKeys, safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage } from "../common/interactionUtils";
import { REQUEST_TIMEOUT_MS, TIMEOUT_MESSAGES } from "../../../components/GalgameMap/interaction/constants";

interface InitOptions {
    sessionId: string | null;
    eventId: string | null;
    gameData: any | null;
    fileId: string | null;
    gameStarted: boolean;
    setGameStarted: (value: boolean) => void;
    setLatestHistory: (history: GetWorldInteractionHistoryResponse) => void;
    setHasPendingRequest: (value: boolean) => void;
    setPendingRequestForPoll: (value: PendingRequest | null) => void;
    setTimeoutModal: (value: { visible: boolean; message: string }) => void;
    setErrorModal: (value: { visible: boolean; message: string }) => void;
    // Step handlers
    stepHandlers: {
        setCurrentStep: (step: any) => void;
        setStepQueue: (queue: any[]) => void;
        setShowNextButton: (show: boolean) => void;
        handleInteract: (options: { 
            onBeforeRequest?: () => void;
            onSuccess?: (data: any) => void; 
            onError?: (error: string) => void;
            onFirstStep?: () => void;
        }) => void;
    };
    // Refs for reset
    resetCompletedSteps: () => void;
    setRestoringFromCache: (value: boolean) => void;
    // 属性更新回调
    onUpdateAttributes?: () => Promise<void>;
    // 刷新事件数据回调（用于流式响应完成后立即请求 active 事件）
    onRefreshEventData?: (sessionId: string, gameData: any) => Promise<void>;
    // 设置最后一次请求的回调（用于超时重试）
    setLastRequest?: (request: { type: "interact" } | { type: "choice"; optionId: string; optionIndex: number } | null) => void;
    // 请求管理器回调（用于统一管理请求状态）
    onRequestStart?: () => void;
    onRequestComplete?: () => void;
    onRequestError?: (error: string) => void;
    clearRequestTimeout?: () => void;
}

interface UseInteractionInitReturn {
    interactTimeoutRef: React.MutableRefObject<number | null>;
}

export function useNpcInteractionInit(options: InitOptions): UseInteractionInitReturn {
    const {
        sessionId,
        eventId,
        gameData,
        fileId,
        gameStarted,
        setGameStarted,
        setLatestHistory,
        setHasPendingRequest,
        setPendingRequestForPoll,
        setTimeoutModal,
        setErrorModal,
        stepHandlers,
        resetCompletedSteps,
        setRestoringFromCache,
        onUpdateAttributes,
        onRefreshEventData,
        setLastRequest,
        onRequestStart,
        onRequestComplete,
        onRequestError,
        clearRequestTimeout,
    } = options;

    const hasInitializedRef = useRef(false);
    const interactTimeoutRef = useRef<number | null>(null);
    // 使用 ref 存储最新的 onUpdateAttributes，避免闭包问题
    const onUpdateAttributesRef = useRef(onUpdateAttributes);
    const onRefreshEventDataRef = useRef(onRefreshEventData);
    
    // 每次回调变化时更新 ref
    useEffect(() => {
        onUpdateAttributesRef.current = onUpdateAttributes;
        onRefreshEventDataRef.current = onRefreshEventData;
    }, [onUpdateAttributes, onRefreshEventData]);

    // 组件卸载时清理超时定时器
    useEffect(() => {
        return () => {
            if (interactTimeoutRef.current) {
                clearTimeout(interactTimeoutRef.current);
                interactTimeoutRef.current = null;
            }
        };
    }, []);

    // 主初始化逻辑
    useEffect(() => {
        if (hasInitializedRef.current) {
            console.log("[useNpcInteractionInit] ⏭️ 已经初始化过，跳过");
            return;
        }
        if (!sessionId) {
            console.warn("[useNpcInteractionInit] ⚠️ 没有 sessionId，跳过初始化");
            return;
        }
        if (!eventId) {
            console.warn("[useNpcInteractionInit] ⚠️ 没有 eventId，跳过初始化（用于功能性NPC场景）");
            return; // 如果没有 eventId，跳过初始化（用于功能性NPC场景）
        }

        console.log("[useNpcInteractionInit] ✅ 开始执行初始化逻辑", {
            sessionId,
            eventId,
            fileId
        });
        let cancelled = false;
        const storageKeys = getStorageKeys(sessionId, eventId);

        const initFromServerHistory = async () => {
            // 立即设置 gameStarted，避免空白等待
            if (!gameStarted) {
                setGameStarted(true);
            }
            
            try {
                // 1）优先尝试从本地缓存恢复
                if (storageKeys.allSteps && storageKeys.incomplete) {
                    const isIncomplete = safeGetLocalStorage(storageKeys.incomplete) === 'true';
                    const raw = safeGetLocalStorage(storageKeys.allSteps);
                    
                    if (isIncomplete && raw) {
                        try {
                            const savedSteps = JSON.parse(raw);
                            if (Array.isArray(savedSteps) && savedSteps.length > 0) {
                                const [first, ...rest] = savedSteps;
                                
                                hasInitializedRef.current = true;
                                setRestoringFromCache(true);
                                resetCompletedSteps();

                                stepHandlers.setCurrentStep(first || null);
                                stepHandlers.setStepQueue(rest || []);
                                stepHandlers.setShowNextButton(first?.type !== 'choice');

                                setTimeout(() => setRestoringFromCache(false), 1000);
                                return;
                            }
                        } catch (e) {
                            console.warn('[Init] 解析本地缓存失败:', e);
                        }
                    }
                }

                // 2）检查是否有未完成的请求
                if (storageKeys.pendingRequest) {
                    const pendingRequestRaw = safeGetLocalStorage(storageKeys.pendingRequest);
                    if (pendingRequestRaw) {
                        try {
                            const parsed = JSON.parse(pendingRequestRaw);
                            const requestAge = Date.now() - (parsed?.timestamp || 0);
                            
                            if (requestAge < 5 * 60 * 1000) {
                                hasInitializedRef.current = true;
                                setHasPendingRequest(true);
                                stepHandlers.setCurrentStep(null);
                                stepHandlers.setStepQueue([]);
                                stepHandlers.setShowNextButton(false);
                                
                                setPendingRequestForPoll({
                                    type: parsed.type,
                                    optionId: parsed.optionId,
                                    startTime: Date.now(),
                                });
                                return;
                            } else {
                                safeRemoveLocalStorage(storageKeys.pendingRequest);
                            }
                        } catch (e) {
                            console.warn("[Init] 解析未完成请求失败:", e);
                        }
                    }
                }

                // 3）正常获取历史
                const resp = await interactionApi.getWorldInteractionHistory(sessionId);
                if (cancelled) return;

                if (resp.data?.success) {
                    const history = resp.data;
                    setLatestHistory(history);

                    const lastInteraction = history.interactions?.[history.interactions.length - 1] as any;

                    // 如果历史最后一条是 npc_dialogue，直接用历史选项
                    if (lastInteraction?.type === 'npc_dialogue') {
                        hasInitializedRef.current = true;
                        return;
                    }
                }

                // 4）发起初始交互
                if (gameData && sessionId && eventId && fileId) {
                    hasInitializedRef.current = true;
                    
                    // 使用请求管理器记录请求开始（如果提供）
                    if (onRequestStart) {
                        onRequestStart();
                    } else {
                        // 兼容旧逻辑：如果没有提供请求管理器，使用旧的方式
                        if (storageKeys.pendingRequest) {
                            safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify({
                                type: "interact" as const,
                                timestamp: Date.now(),
                            }));
                        }
                        setHasPendingRequest(true);
                        
                        // 启动 60 秒超时计时器
                        if (interactTimeoutRef.current) {
                            clearTimeout(interactTimeoutRef.current);
                        }
                        interactTimeoutRef.current = window.setTimeout(() => {
                            if (interactTimeoutRef.current) {
                                console.warn("[Init] /interact 超时");
                                setTimeoutModal({
                                    visible: true,
                                    message: TIMEOUT_MESSAGES.INTERACT,
                                });
                            }
                        }, REQUEST_TIMEOUT_MS);
                    }
                    
                    // 在调用 handleInteract 之前设置 lastRequest，确保超时重试时能正确重试
                    if (setLastRequest) {
                        setLastRequest({ type: "interact" });
                    }
                    
                    setTimeout(() => {
                        stepHandlers.handleInteract({
                            onFirstStep: () => {
                                // 收到第一个步骤时清除超时计时器
                                if (clearRequestTimeout) {
                                    clearRequestTimeout();
                                } else {
                                    // 兼容旧逻辑
                                    if (interactTimeoutRef.current) {
                                        clearTimeout(interactTimeoutRef.current);
                                        interactTimeoutRef.current = null;
                                    }
                                    setTimeoutModal({ visible: false, message: '' });
                                }
                                // 更新属性
                                const updateFn = onUpdateAttributesRef.current;
                                if (updateFn) {
                                    updateFn().catch(error => {
                                        console.error('[Init] ❌ 更新属性失败:', error);
                                    });
                                }
                            },
                            onSuccess: async () => {
                                // 使用请求管理器记录请求完成（如果提供）
                                if (onRequestComplete) {
                                    onRequestComplete();
                                } else {
                                    // 兼容旧逻辑
                                    if (interactTimeoutRef.current) {
                                        clearTimeout(interactTimeoutRef.current);
                                        interactTimeoutRef.current = null;
                                    }
                                    setTimeoutModal({ visible: false, message: '' });
                                    safeRemoveLocalStorage(storageKeys.pendingRequest);
                                    setHasPendingRequest(false);
                                }
                                
                                // 流式响应完成后立即刷新 active 事件，用于判断显示继续游戏还是开始下一回合
                                const refreshFn = onRefreshEventDataRef.current;
                                if (refreshFn && sessionId && gameData) {
                                    await refreshFn(sessionId, gameData).catch((error) => {
                                        console.error('[Init] ❌ 刷新 active 事件失败:', error);
                                    });
                                }
                            },
                            onError: (error) => {
                                console.error("[Init] /interact 失败:", error);
                                // 重置初始化标记，允许重试
                                hasInitializedRef.current = false;
                                
                                // 使用请求管理器记录请求错误（如果提供）
                                if (onRequestError) {
                                    onRequestError(error || '开始游戏失败，请检查网络或稍后重试。');
                                } else {
                                    // 兼容旧逻辑
                                    if (interactTimeoutRef.current) {
                                        clearTimeout(interactTimeoutRef.current);
                                        interactTimeoutRef.current = null;
                                    }
                                    setTimeoutModal({ visible: false, message: '' });
                                    setErrorModal({
                                        visible: true,
                                        message: error || '开始游戏失败，请检查网络或稍后重试。',
                                    });
                                    safeRemoveLocalStorage(storageKeys.pendingRequest);
                                    setHasPendingRequest(false);
                                }
                            }
                        });
                    }, 100);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("[Init] 初始化失败:", error);
                }
            }
        };

        void initFromServerHistory();

        return () => {
            cancelled = true;
        };
    }, [gameData, sessionId, eventId, fileId]);

    return { interactTimeoutRef };
}

