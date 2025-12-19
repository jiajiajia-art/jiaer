import { useEffect, useRef, useCallback } from "react";
import interactionApi from "../../api/worldInteraction/interactionApi";
import type { GetWorldInteractionHistoryResponse } from "../../api/worldInteraction/interactionApi.type";

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

        console.log("[Poll] 轮询 effect 启动", pendingRequest);
        cancelledRef.current = false;

        const { type: pendingType, optionId: pendingOptionId, startTime } = pendingRequest;

        const pollHistory = async () => {
            if (cancelledRef.current) {
                console.log("[Poll] 轮询已取消");
                return;
            }

            const POLL_INTERVAL_MS = 6000; // 轮询间隔（10 秒）
            try {
                const elapsed = Date.now() - startTime;
                console.log(`[Poll] 轮询中... 已过去 ${elapsed}ms`);

                const resp = await interactionApi.getWorldInteractionHistory(sessionId);
                if (cancelledRef.current) return;

                if (!resp.data?.success) {
                    if (elapsed > 60_000) {
                        console.warn("[Poll] 超时：历史获取失败");
                        onTimeout();
                        onPollEnd();
                        return;
                    }
                    pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
                    return;
                }

                const history = resp.data;
                onHistoryUpdate(history);
                console.log("[Poll] 获取到历史，条数:", history.interactions?.length);

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
                        console.log("[Poll] 匹配到 npc_dialogue:", matched.eventId);
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
                        console.log("[Poll] 匹配到 player_choice:", matched.eventId);
                        if (Array.isArray(matched.npcResponse)) {
                            matchedSteps = matched.npcResponse;
                        }
                    }
                }

                // 找到匹配的步骤
                if (matchedSteps && matchedSteps.length > 0) {
                    console.log("[Poll] 轮询成功，步骤数:", matchedSteps.length);
                    onMatchFound(matchedSteps);
                    onPollEnd();
                    return;
                }

                // 超时检查
                if (elapsed > 60_000) {
                    console.warn("[Poll] 超时：未找到匹配记录");
                    onTimeout();
                    onPollEnd();
                    return;
                }

                // 继续轮询
                console.log(`[Poll] 未找到匹配，${POLL_INTERVAL_MS / 6000} 秒后继续...`);
                pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
            } catch (error) {
                console.error("[Poll] 轮询出错:", error);
                if (cancelledRef.current) return;

                const elapsed = Date.now() - startTime;
                if (elapsed > 60_000) {
                    onTimeout();
                    onPollEnd();
                    return;
                }
                pollTimerRef.current = window.setTimeout(pollHistory, POLL_INTERVAL_MS);
            }
        };

        // 启动轮询
        pollHistory();

        return cleanup;
    }, [pendingRequest?.type, pendingRequest?.optionId, pendingRequest?.startTime, sessionId, eventId]);

    return { cleanup };
}

