/**
 * 世界交互初始化 Hook
 * 处理：缓存恢复、未完成请求检测、历史获取、初始交互发起
 */
import { useEffect, useRef } from "react";
import interactionApi from "../../api/worldInteraction/interactionApi";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";
import type { PendingRequest } from "./useHistoryPolling";
import { getStorageKeys, safeGetLocalStorage, safeSetLocalStorage, safeRemoveLocalStorage } from "./interactionUtils";

interface InitOptions {
    sessionId: string | null;
    eventId: string | null;
    gameData: any | null;
    fileId: string | null;
    gameStarted: boolean;
    // Setters
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
        handleInteract: (options: { onSuccess?: () => void; onError?: (error: string) => void }) => void;
    };
    // Refs for reset
    resetCompletedSteps: () => void;
    setRestoringFromCache: (value: boolean) => void;
    // 属性更新回调
    onUpdateAttributes?: () => Promise<void>;
}

interface UseInteractionInitReturn {
    interactTimeoutRef: React.MutableRefObject<number | null>;
}

export function useInteractionInit(options: InitOptions): UseInteractionInitReturn {
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
    } = options;

    const hasInitializedRef = useRef(false);
    const interactTimeoutRef = useRef<number | null>(null);
    // 使用 ref 存储最新的 onUpdateAttributes，避免闭包问题
    const onUpdateAttributesRef = useRef(onUpdateAttributes);
    
    // 每次 onUpdateAttributes 变化时更新 ref
    useEffect(() => {
        onUpdateAttributesRef.current = onUpdateAttributes;
    }, [onUpdateAttributes]);

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
        if (hasInitializedRef.current) return;
        if (!sessionId) return;
        if (!eventId) return; // 如果没有 eventId，跳过初始化（用于功能性NPC场景）

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
                    
                    // 保存请求状态
                    if (storageKeys.pendingRequest) {
                        safeSetLocalStorage(storageKeys.pendingRequest, JSON.stringify({
                            type: "interact" as const,
                            timestamp: Date.now(),
                        }));
                    }

                    // 启动 60 秒超时计时器
                    if (interactTimeoutRef.current) {
                        clearTimeout(interactTimeoutRef.current);
                    }
                    interactTimeoutRef.current = window.setTimeout(() => {
                        console.warn("[Init] /interact 超时");
                        setTimeoutModal({
                            visible: true,
                            message: '开始游戏请求已超过 60 秒仍未返回，是否刷新页面重试？',
                        });
                    }, 60000);
                    
                    setTimeout(() => {
                        stepHandlers.handleInteract({
                            onSuccess: () => {
                                if (interactTimeoutRef.current) {
                                    clearTimeout(interactTimeoutRef.current);
                                    interactTimeoutRef.current = null;
                                }
                                setTimeoutModal({ visible: false, message: '' });
                                safeRemoveLocalStorage(storageKeys.pendingRequest);
                                setHasPendingRequest(false);
                                
                                // 更新属性
                                const updateFn = onUpdateAttributesRef.current;
                                if (updateFn) {
                                    updateFn().catch(error => {
                                        console.error('[Init] ❌ 更新属性失败:', error);
                                    });
                                }
                            },
                            onError: (error) => {
                                console.error("[Init] /interact 失败:", error);
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

