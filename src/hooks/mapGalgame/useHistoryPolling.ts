import { useEffect, useRef, useCallback } from "react";
import interactionApi from "../../api/worldInteraction/interactionApi";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";
import { REQUEST_TIMEOUT_MS } from "../../components/GalgameMap/interaction/constants";

export interface PendingRequest {
    type: "interact" | "select-option";
    optionId?: string;
    startTime: number;
}

interface UseHistoryPollingOptions {
    sessionId: string | null;
    eventId: string | null;
    pendingRequest: PendingRequest | null;
    onHistoryUpdate: (history: GetWorldInteractionHistoryResponse) => void;
    onMatchFound: (matchedSteps: any[]) => void;
    onTimeout: () => void;
    onError?: (error: string) => void; // 轮询错误回调
    onPollEnd: () => void;
}

/**
 * 独立的历史轮询 Hook
 * 当 pendingRequest 不为 null 时，自动启动轮询
 * 默认：每 10 秒请求一次历史（相对 6 秒更温和，减轻后端压力）
 * 直到找到匹配的记录或超时（60 秒）
 */
export function useHistoryPolling({
    sessionId,
    eventId,
    pendingRequest,
    onHistoryUpdate,
    onMatchFound,
    onTimeout,
    onError,
    onPollEnd,
}: UseHistoryPollingOptions) {
    const pollTimerRef = useRef<number | null>(null);
    const cancelledRef = useRef(false);

    // 清理函数
    const cleanup = useCallback(() => {
        cancelledRef.current = true;
        if (pollTimerRef.current) {
            clearTimeout(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!pendingRequest || !sessionId || !eventId) {
            return;
        }

        cancelledRef.current = false;

        const { type: pendingType, optionId: pendingOptionId, startTime } = pendingRequest;

        const pollHistory = async () => {
            if (cancelledRef.current) {
                return;
            }

            const POLL_INTERVAL_MS = 10000; // 轮询间隔（10 秒，减少请求频率）
            const POLL_TIMEOUT_MS = REQUEST_TIMEOUT_MS; // 轮询超时时间（使用统一常量）
            try {
                const elapsed = Date.now() - startTime;

                const resp = await interactionApi.getWorldInteractionHistory(sessionId);
                if (cancelledRef.current) return;

                if (!resp.data?.success) {
                    if (elapsed > POLL_TIMEOUT_MS) {
                        onTimeout();
                        onPollEnd();
                        return;
                    }
                    pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
                    return;
                }

                const history = resp.data;
                onHistoryUpdate(history);

                const interactions = (history.interactions || []) as any[];
                let matchedSteps: any[] | null = null;

                const lastInteraction = interactions.length > 0
                    ? interactions[interactions.length - 1]
                    : null;

                // 根据请求类型匹配历史记录
                if (pendingType === "interact") {
                    let matched: any = null;
                    // 先看最后一条
                    if (lastInteraction?.type === "npc_dialogue" && lastInteraction.eventId === eventId) {
                        matched = lastInteraction;
                    }
                    // 再扫描所有记录
                    if (!matched) {
                        matched = interactions.find(
                            (it: any) => it.type === "npc_dialogue" && it.eventId === eventId
                        );
                    }
                    if (matched) {
                        if (Array.isArray(matched.narrativeSteps)) {
                            matchedSteps = matched.narrativeSteps;
                        }
                    }
                } else if (pendingType === "select-option") {
                    let matched: any = null;
                    if (lastInteraction?.type === "player_choice" && lastInteraction.eventId === eventId) {
                        if (!pendingOptionId) {
                            matched = lastInteraction;
                        } else if (
                            lastInteraction.selectedOption &&
                            String(lastInteraction.selectedOption.optionId) === String(pendingOptionId)
                        ) {
                            matched = lastInteraction;
                        }
                    }
                    if (matched) {
                        if (Array.isArray(matched.npcResponse)) {
                            matchedSteps = matched.npcResponse;
                        }
                    }
                }

                // 找到匹配的步骤
                if (matchedSteps && matchedSteps.length > 0) {
                    onMatchFound(matchedSteps);
                    onPollEnd();
                    return;
                }

                // 超时检查
                if (elapsed > POLL_TIMEOUT_MS) {
                    onTimeout();
                    onPollEnd();
                    return;
                }

                // 继续轮询
                pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
            } catch (error) {
                if (cancelledRef.current) return;

                const elapsed = Date.now() - startTime;
                
                // 如果超过超时时间，调用超时回调
                if (elapsed > REQUEST_TIMEOUT_MS) {
                    onTimeout();
                    onPollEnd();
                    return;
                }
                
                // 如果有错误回调，调用它（用于显示错误弹窗）
                if (onError) {
                    const errorMessage = error instanceof Error 
                        ? error.message 
                        : '轮询请求失败，请检查网络连接后重试。';
                    onError(errorMessage);
                    onPollEnd();
                    return;
                }
                
                // 如果没有错误回调，继续轮询（兼容旧代码）
                pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
            }
        };

        // 启动轮询
        pollHistory();

        return cleanup;
    }, [pendingRequest?.type, pendingRequest?.optionId, pendingRequest?.startTime, sessionId, eventId]);

    return { cleanup };
}

