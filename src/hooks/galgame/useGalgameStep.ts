import { useState, useRef, useEffect, useCallback } from 'react';
import { useStepStreamResponse } from '../story/useStepStreamResponse';
import { authFetch } from '../../api/base';
import { HOST_ADDRESS } from '../../config';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
import type { ContextMemoryStatus } from '../../api/galgame/getGalgamePreset.type';
import {
    isGenerationBusyError,
    shouldDeferChoiceUntilStreamReady,
    shouldClearCurrentStepWhenDeferringChoice,
    shouldAutoPromoteReadyChoice,
    GENERATION_BUSY_MAX_RETRIES,
    NETWORK_STREAM_MAX_RETRIES,
    getGenerationBusyRetryDelayMs,
    getNetworkStreamRetryDelayMs,
} from '../../lib/galgame/choiceStepDisplayGate';
import {
    isInsufficientDiamondsError,
    type PlayInteractionType,
    type StreamBusinessError,
} from '../../lib/galgame/playBilling';
import { isTransientNetworkStreamError } from '../../lib/galgame/normalizeStreamErrorMessage';
import { isAliyunFrontendRuntime } from '../../lib/aliyunFrontendRuntime';
import {
    shouldEnableRawTextStepBridge,
    shouldPreserveCanvasOnGenerationRetry,
} from '../../lib/story/rawTextStreamPolicy';
import {
    advanceRawTextBridgePage,
    applyRawTextBridgeDialoguePortrait,
    buildRawTextBridgeCanvasContent,
    createEmptyRawTextBridgePage,
    hasRawTextBridgePagePending,
    ingestRawTextBridgePageSegments,
    RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT,
    shouldShowRawTextBridgeNextButton,
    type RawTextBridgePageState,
} from '../../lib/story/rawTextStepBridge';
import {
    clearStreamPerfHistory,
    markStreamPerfCanvasFirstPaint,
    markStreamPerfRequestStart,
} from '../../lib/galgame/streamPerfDebug';

export function createGalgameActionId(sessionId: string | null, _action: string): string {
    const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `visual-${sessionId || 'session'}-${Date.now()}-${randomPart}`;
}

interface UseGalgameStepOptions {
    sessionId: string | null;
    historyLength?: number;
    onMessagesClear?: () => void;
    // allSteps callback from stream complete event
    onCompleteAllSteps?: (steps: any[]) => void;
    onStreamComplete?: () => void;
    // Called after error alert is shown
    onErrorAfterAlert?: (error: string) => void;
    /** 用户行动发出时回调（用于历史面板即时展示用户选择/输入） */
    onUserAction?: (action: string) => void;
    // Replay mode: avoid showing "AI generating" on queue exhausted
    isReplay?: boolean;
    isTextMode?: boolean;
    onExhausted?: () => void;
    onContextMemoryUpdate?: (status: ContextMemoryStatus) => void;
    onContextCompressionDone?: (status: ContextMemoryStatus | null) => void;
    onStreamActivity?: (data: any) => void;
    onInsufficientDiamonds?: (error: StreamBusinessError) => void;
    /** 功能注释：Aliyun raw 旁白期间正式 scene_change 旁路切背景 */
    onRawTextBridgeSceneChange?: (sceneStep: any) => void;
    /** 功能注释：Aliyun raw 旁白期间正式 dialogue 旁路通知，供 Controlller 独立立绘层 */
    onRawTextBridgeDialoguePortraitNotify?: (dialogueStep: any) => void;
}

export const useGalgameStep = ({
    sessionId,
    historyLength,
    onMessagesClear,
    onCompleteAllSteps,
    onStreamComplete,
    onErrorAfterAlert,
    onUserAction,
    isReplay = false,
    isTextMode = false,
    onExhausted,
    onContextMemoryUpdate,
    onContextCompressionDone,
    onStreamActivity,
    onInsufficientDiamonds,
    onRawTextBridgeSceneChange,
    onRawTextBridgeDialoguePortraitNotify,
}: UseGalgameStepOptions) => {
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepQueue, setStepQueue] = useState<any[]>([]);
    const [showNextButton, setShowNextButton] = useState(false);
    const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
    const [isWaitingForData, setIsWaitingForData] = useState(false);
    const [isCompressingContext, setIsCompressingContext] = useState(false);
    const [contextMemory, setContextMemory] = useState<ContextMemoryStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const currentRequestId = useRef(0);
    const currentStepRef = useRef<any>(null);
    const isProcessingStepRef = useRef(false);
    const loadingRef = useRef(false);
    /** 功能注释：Aliyun raw 旁白分页（同屏最多 3 句，其余点下一步整页替换） */
    const rawTextPageRef = useRef<RawTextBridgePageState>(createEmptyRawTextBridgePage());
    /** 功能注释：对白立绘可能早于旁白上屏，先记下，append 时再挂 */
    const pendingDialoguePortraitRef = useRef<any>(null);
    // 功能注释：本地 Vite 也开 raw 按句上屏（localhost 不算 Aliyun hostname）
    const aliyunRuntime = isAliyunFrontendRuntime();
    const rawTextBridgeEnabled = shouldEnableRawTextStepBridge({
        aliyunRuntime,
        isDev: Boolean(import.meta.env.DEV),
    });
    const { updateUser } = useAuthStore();

    const resetRawTextBridgePage = useCallback(() => {
        rawTextPageRef.current = createEmptyRawTextBridgePage();
        pendingDialoguePortraitRef.current = null;
    }, []);

    /** 功能注释：按 pending + 队列 + 流式状态同步「下一步」，流进行中勿因 choice 入队误亮 */
    const syncAliyunRawNextButton = useCallback((stepQueueLength: number) => {
        setShowNextButton(shouldShowRawTextBridgeNextButton({
            pendingCount: rawTextPageRef.current.pending.length,
            stepQueueLength,
            streamLoading: loadingRef.current,
        }));
    }, []);

    /** 功能注释：Aliyun 画布立刻落字（可见字即上屏，不等句号）；并记画布首字打点 */
    const paintAliyunRawCanvas = useCallback((unfinished = '') => {
        const page = rawTextPageRef.current;
        const content = buildRawTextBridgeCanvasContent({
            displayed: page.displayed,
            unfinished,
        });
        if (!content.trim()) return;
        markStreamPerfCanvasFirstPaint(currentRequestId.current);
        setCurrentStep((prev: any) => {
            const portraitSource = pendingDialoguePortraitRef.current
                || ((prev?._portraitFromRawBridge || prev?.type === 'dialogue') ? prev : null);
            const step = {
                type: 'narration' as const,
                content,
                _fromRawText: true as const,
            };
            if (portraitSource) {
                return applyRawTextBridgeDialoguePortrait(step, portraitSource);
            }
            return step;
        });
        // 功能注释：无对白时也通知旁路挂主角，避免纯旁白流画布无人
        if (!pendingDialoguePortraitRef.current) {
            onRawTextBridgeDialoguePortraitNotify?.({
                type: 'dialogue',
                isPlayer: true,
                speakerId: 'player',
            });
        } else {
            onRawTextBridgeDialoguePortraitNotify?.(pendingDialoguePortraitRef.current);
        }
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
    }, [onRawTextBridgeDialoguePortraitNotify]);

    // Track assistant round count from history
    const historyLengthRef = useRef<number>(historyLength ?? 0);
    useEffect(() => {
        historyLengthRef.current = historyLength ?? 0;
    }, [historyLength]);

    // Sync currentStep to ref
    useEffect(() => {
        currentStepRef.current = currentStep;
    }, [currentStep]);

    useEffect(() => {
        loadingRef.current = loading;
    }, [loading]);

    // Reset all state when session changes
    useEffect(() => {
        currentRequestId.current = 0;
        // 功能注释：换局清空 STREAM_PERF 累计，避免上一局残留被当成「本局多条」
        clearStreamPerfHistory();
        resetRawTextBridgePage();
        setCurrentStep(null);
        setStepQueue([]);
        setShowNextButton(false);
        setSelectedOptionIndex(null);
        setIsWaitingForData(false);
        setIsCompressingContext(false);
        setContextMemory(null);
        setLoading(false);
        isProcessingStepRef.current = false;
    }, [sessionId, resetRawTextBridgePage]);

    // Refresh user info after stream success
    const getUserInfo = useCallback(async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('[Galgame] Failed to fetch user info:', error);
        }
    }, [updateUser]);

    const resetStreamRetryDisplay = useCallback(() => {
        // 功能注释：已上屏旁白时保留画布，避免 generation_retry 闪成「出完字又重载」
        const preserveCanvas = shouldPreserveCanvasOnGenerationRetry(currentStepRef.current);
        if (!preserveCanvas) {
            resetRawTextBridgePage();
            setCurrentStep(null);
        }
        setStepQueue([]);
        setShowNextButton(false);
        setSelectedOptionIndex(null);
        setIsWaitingForData(true);
        setLoading(true);
        isProcessingStepRef.current = false;
    }, [resetRawTextBridgePage]);

    const { processStreamResponse } = useStepStreamResponse({
        setStepQueue,
        setSelectedOptionIndex,
        setIsWaitingForData,
        currentRequestId,
        // Galgame does not need mission flag handling
        onMissionFlag: undefined,
        onCompleteAllSteps,
        // Add fallback empty choice step if stream has no explicit choice
        enableFallbackEmptyChoice: true,
        // 功能注释：Aliyun 或本地 Vite 启用；CF 生产构建不启用
        enableRawTextStepBridge: rawTextBridgeEnabled,
    });

    const showStep = useCallback(async (step: any) => {
        if (!step) return;
        setCurrentStep(step);
        setIsWaitingForData(false);
        setSelectedOptionIndex(null);
        setShowNextButton(step.type !== 'choice');
    }, []);

    // 对话步可边生成边播；choice 必须等本轮 stream loading 结束再上屏，避免抢锁报错
    useEffect(() => {
        if (stepQueue.length === 0) return;
        if (isProcessingStepRef.current) return;

        const nextStep = stepQueue[0];
        if (shouldDeferChoiceUntilStreamReady({
            stepType: nextStep?.type,
            streamLoading: loading,
        })) {
            return;
        }

        // 功能注释：与 CF 相同——有 currentStep 时不自动抢播；仅 Aliyun 在流结束后把队首 choice 衔上
        // raw 分页尚有 pending 时不抢 choice，让用户先点下一步翻完
        if (currentStep && !isWaitingForData) {
            if (rawTextBridgeEnabled && hasRawTextBridgePagePending(rawTextPageRef.current)) {
                return;
            }
            if (!shouldAutoPromoteReadyChoice({
                aliyunRuntime: rawTextBridgeEnabled,
                currentStepType: currentStep?.type,
                nextStepType: nextStep?.type,
                streamLoading: loading,
                hasCurrentStep: true,
                isWaitingForData,
            })) {
                return;
            }
        }

        isProcessingStepRef.current = true;
        setStepQueue((prev) => prev.slice(1));
        // 功能注释：正式步（含 choice）上屏时清掉 raw 分页，避免下一步误吃 pending
        if (!nextStep?._fromRawText) {
            resetRawTextBridgePage();
        }

        void (async () => {
            await showStep(nextStep);
            isProcessingStepRef.current = false;
        })();
    }, [stepQueue, currentStep, isWaitingForData, loading, showStep, rawTextBridgeEnabled, resetRawTextBridgePage]);

    // Handle stream request (galgame endpoint)
    const handleStreamAction = useCallback(
        async (
            action: string,
            options?: {
                onBeforeRequest?: () => void;
                onSuccess?: () => void;
                onFirstStep?: () => void;
                onError?: (error: string) => void;
                deduct?: boolean;
                actionId?: string;
                interactionType?: PlayInteractionType;
                choiceSnapshot?: unknown;
            }
        ) => {
            if (!sessionId) {
                options?.onError?.('No sessionId, cannot send request.');
                return;
            }

            try {
                const requestId = ++currentRequestId.current;
                const choiceSnapshot = options?.choiceSnapshot
                    || (currentStepRef.current?.type === 'choice' ? currentStepRef.current : null);
                const interactionType = options?.interactionType
                    || (options?.deduct ? 'custom_input' : 'preset_option');
                // 功能注释：STREAM_PERF 画布首字相对此打点计时
                markStreamPerfRequestStart(requestId);

                // Start fresh for new request so previous step does not block queue
                resetRawTextBridgePage();
                setCurrentStep(null);
                setStepQueue([]);
                setShowNextButton(false);
                setIsWaitingForData(true);
                setLoading(true);

                onMessagesClear?.();
                if (!isReplay && (interactionType === 'preset_option' || interactionType === 'custom_input')) {
                    onUserAction?.(action);
                }
                options?.onBeforeRequest?.();

                const requestBody: any = {
                    action,
                    actionId: options?.actionId || createGalgameActionId(sessionId, action),
                    interactionType,
                };
                if (options?.deduct) {
                    requestBody.deduct = true;
                }
                if (isTextMode && !isReplay) {
                    requestBody.textModeMemoryEnabled = true;
                }

                const response = await authFetch(
                    `${HOST_ADDRESS}/api/visual/session/${sessionId}/action/stream`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                    }
                );

                if (response.ok) {
                    await processStreamResponse(response, requestId, {
                        onSuccess: async () => {
                            setIsCompressingContext(false);
                            if (options?.onSuccess) {
                                await options.onSuccess();
                            }
                            if (onStreamComplete) {
                                try {
                                    await onStreamComplete();
                                } catch (e) {
                                    console.error('Failed to run onStreamComplete:', e);
                                }
                            }
                            // 功能注释：锁可见性缓冲；过长会叠在「出选项前空等」上，Aliyun 压到 250ms
                            await new Promise((resolve) => window.setTimeout(resolve, rawTextBridgeEnabled ? 250 : 700));
                            if (currentRequestId.current !== requestId) {
                                return;
                            }
                            setLoading(false);
                            // 功能注释：流结束后按 pending/队列重新打开「下一步」；loading 已 false，可因队列亮按钮
                            if (rawTextBridgeEnabled) {
                                loadingRef.current = false;
                                setStepQueue((q) => {
                                    syncAliyunRawNextButton(q.length);
                                    return q;
                                });
                            }
                            await getUserInfo();
                        },
                        onError: (error) => {
                            setIsCompressingContext(false);
                            setLoading(false);
                            // 功能注释：断流时若已有旁白，保留画布，避免清空后 history 自动重发再失败
                            const preserveCanvas = shouldPreserveCanvasOnGenerationRetry(currentStepRef.current);
                            if (!preserveCanvas) {
                                resetRawTextBridgePage();
                                setCurrentStep(null);
                            }
                            setStepQueue([]);
                            setShowNextButton(false);
                            options?.onError?.(error);
                        },
                        onBusinessError: (error) => {
                            if (!isInsufficientDiamondsError(error)) {
                                return false;
                            }
                            setIsCompressingContext(false);
                            setLoading(false);
                            setCurrentStep(choiceSnapshot);
                            setStepQueue([]);
                            setShowNextButton(false);
                            setSelectedOptionIndex(null);
                            setIsWaitingForData(false);
                            onInsufficientDiamonds?.(error);
                            return true;
                        },
                        onFirstStep: options?.onFirstStep,
                        // 功能注释：正式 step 接手时若当前仍是 raw 旁白则清掉，走原 promote
                        onRawTextBridgeHandoff: () => {
                            resetRawTextBridgePage();
                            if (currentStepRef.current?._fromRawText) {
                                setCurrentStep(null);
                                setIsWaitingForData(true);
                            }
                        },
                        // 功能注释：Aliyun 遇句号最多叠 3 句；超出进 pending，点下一步整页替换
                        onRawTextBridgeAppend: (segments) => {
                            if (currentRequestId.current !== requestId) return;
                            const { state, displayChanged } = ingestRawTextBridgePageSegments(
                                rawTextPageRef.current,
                                segments,
                            );
                            rawTextPageRef.current = state;
                            if (displayChanged || state.displayed.length > 0) {
                                // 功能注释：完句后用「仅完句」重绘，去掉预览尾巴，避免重复字
                                paintAliyunRawCanvas('');
                            }
                            setStepQueue((q) => {
                                syncAliyunRawNextButton(q.length);
                                return q;
                            });
                        },
                        // 功能注释：未完句预览上屏；已满 3 句则忽略，后台继续收 pending
                        onRawTextBridgeLive: (unfinishedBuffer) => {
                            if (currentRequestId.current !== requestId) return;
                            if (rawTextPageRef.current.displayed.length >= RAW_TEXT_BRIDGE_PAGE_SENTENCE_LIMIT) {
                                return;
                            }
                            paintAliyunRawCanvas(unfinishedBuffer);
                            setStepQueue((q) => {
                                syncAliyunRawNextButton(q.length);
                                return q;
                            });
                        },
                        // 功能注释：正式 dialogue 不入队时仍挂立绘；无当前旁白则写入 pending
                        onRawTextBridgeDialoguePortrait: (dialogueStep) => {
                            if (currentRequestId.current !== requestId) return;
                            if (!dialogueStep || String(dialogueStep.type || '') !== 'dialogue') return;
                            pendingDialoguePortraitRef.current = dialogueStep;
                            setCurrentStep((prev: any) => {
                                if (!prev?._fromRawText) return prev;
                                return applyRawTextBridgeDialoguePortrait(prev, dialogueStep);
                            });
                            // 功能注释：同时通知 Controller 独立立绘层（不依赖 currentStep 类型转换）
                            onRawTextBridgeDialoguePortraitNotify?.(dialogueStep);
                        },
                        // 功能注释：正式 scene_change 不入队时立刻切背景，避免开场几句白屏
                        onRawTextBridgeSceneChange: (sceneStep) => {
                            if (currentRequestId.current !== requestId) return;
                            onRawTextBridgeSceneChange?.(sceneStep);
                        },
                        onActivity: onStreamActivity,
                        onData: (data) => {
                            if (data?.contextMemory) {
                                setContextMemory(data.contextMemory);
                                onContextMemoryUpdate?.(data.contextMemory);
                            }
                            if (data?.type === 'error' && data?.code === 'ACTION_IN_PROGRESS') {
                                setIsCompressingContext(false);
                                setLoading(false);
                                return;
                            }
                            if (data?.type === 'context_compression_start') {
                                setIsCompressingContext(true);
                                return;
                            }
                            if (data?.type === 'context_compression_done') {
                                setIsCompressingContext(false);
                                onContextCompressionDone?.(data?.contextMemory || null);
                                return;
                            }
                            if (data?.type === 'error') {
                                setIsCompressingContext(false);
                            }
                        },
                        onGenerationRetry: resetStreamRetryDisplay,
                        onErrorAfterAlert,
                    });
                } else {
                    // 功能注释：statusText 常为空（HTTP/2），补上 status 便于排查
                    const errorMsg = `Request failed: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
                    setIsCompressingContext(false);
                    setLoading(false);
                    setSelectedOptionIndex(null);
                    setIsWaitingForData(false);
                    options?.onError?.(errorMsg);
                }
            } catch (error) {
                const errorMsg = `Request error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error('[Galgame] handleStreamAction error:', errorMsg);
                setIsCompressingContext(false);
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        },
        [sessionId, processStreamResponse, onMessagesClear, onStreamComplete, onErrorAfterAlert, onUserAction, getUserInfo, isTextMode, isReplay, onContextMemoryUpdate, onContextCompressionDone, onStreamActivity, onInsufficientDiamonds, resetStreamRetryDisplay, resetRawTextBridgePage, rawTextBridgeEnabled, syncAliyunRawNextButton, paintAliyunRawCanvas, onRawTextBridgeSceneChange, onRawTextBridgeDialoguePortraitNotify]
    );

    // Handle next step in queue
    const handleNextStep = useCallback(() => {
        // 功能注释：Aliyun raw 分页优先——pending 有余句时整页替换，不同屏超过 3 句
        if (rawTextBridgeEnabled && hasRawTextBridgePagePending(rawTextPageRef.current)) {
            const { state, advanced, step } = advanceRawTextBridgePage(rawTextPageRef.current);
            if (advanced && step) {
                rawTextPageRef.current = state;
                // 功能注释：整页替换文案时保留立绘元数据，画布人物不随翻页消失
                setCurrentStep((prev: any) => {
                    if (prev?._portraitFromRawBridge || prev?.type === 'dialogue') {
                        return applyRawTextBridgeDialoguePortrait(step, prev);
                    }
                    return step;
                });
                setIsWaitingForData(false);
                setSelectedOptionIndex(null);
                setStepQueue((q) => {
                    syncAliyunRawNextButton(q.length);
                    return q;
                });
                return;
            }
        }

        setStepQueue((prev) => {
            if (prev.length === 0) {
                // 功能注释：Aliyun 仍在展示 raw 旁白且无余句时，空点不清屏（避免「点了没反应/闪没」）
                if (rawTextBridgeEnabled && currentStepRef.current?._fromRawText) {
                    setShowNextButton(false);
                    // 功能注释：流已结束时不要假 waiting，否则像「生成中」且易诱发重复请求
                    if (!loadingRef.current) {
                        setIsWaitingForData(false);
                    }
                    return prev;
                }
                setCurrentStep(null);
                setShowNextButton(false);
                if (isReplay) {
                    // Replay mode: queue exhausted means finish replay
                    setIsWaitingForData(false);
                    try {
                        onExhausted && onExhausted();
                    } catch {}
                } else if (loadingRef.current) {
                    // 功能注释：仅真正还在拉流时进入 waiting；勿空点制造假 loading
                    setIsWaitingForData(true);
                } else {
                    setIsWaitingForData(false);
                }
                return prev;
            }

            const [nextStep, ...rest] = prev;
            // 点「下一步」也不能提前露出 choice，否则会绕过 loading 门闩抢锁
            if (shouldDeferChoiceUntilStreamReady({
                stepType: nextStep?.type,
                streamLoading: loadingRef.current,
            })) {
                // 功能注释：Aliyun 不清空旁白；CF 保持原 setCurrentStep(null)
                if (shouldClearCurrentStepWhenDeferringChoice(rawTextBridgeEnabled)) {
                    setCurrentStep(null);
                    setIsWaitingForData(true);
                }
                setShowNextButton(false);
                return prev;
            }

            // 正式步接手后清掉 raw 分页状态
            resetRawTextBridgePage();
            void (async () => {
                isProcessingStepRef.current = true;
                await showStep(nextStep);
                isProcessingStepRef.current = false;
            })();
            return rest;
        });
    }, [showStep, isReplay, onExhausted, rawTextBridgeEnabled, resetRawTextBridgePage, syncAliyunRawNextButton]);

    // Handle selecting a choice option
    const handleChoiceOption = useCallback(
        async (option: { text: string; nextId: string }, optionIndex: number, actionId?: string, choiceSnapshot?: unknown) => {
            setSelectedOptionIndex(optionIndex);
            setIsWaitingForData(true);
            setShowNextButton(false);

            const run = async (attempt: number) => {
                await handleStreamAction(option.text, {
                    onError: (error) => {
                        // 属性/任务落盘或 KV 可见性延迟时静默重试，避免弹出「正在生成中」
                        if (isGenerationBusyError(error) && attempt < GENERATION_BUSY_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getGenerationBusyRetryDelayMs(attempt));
                            return;
                        }
                        if (isTransientNetworkStreamError(error) && attempt < NETWORK_STREAM_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getNetworkStreamRetryDelayMs(attempt));
                            return;
                        }
                        console.error('[Galgame] choice option error:', error);
                        setIsWaitingForData(false);
                        setSelectedOptionIndex(null);
                        if (isGenerationBusyError(error) || isTransientNetworkStreamError(error)) {
                            onErrorAfterAlert?.(String(error));
                        }
                    },
                    actionId,
                    interactionType: 'preset_option',
                    choiceSnapshot,
                });
            };
            await run(0);
        },
        [handleStreamAction, onErrorAfterAlert]
    );

    // Handle custom input send
    const handleChoiceSend = useCallback(
        async (inputText: string, actionId?: string, choiceSnapshot?: unknown) => {
            if (!inputText.trim()) {
                return;
            }

            setIsWaitingForData(true);
            setShowNextButton(false);

            const run = async (attempt: number) => {
                await handleStreamAction(inputText, {
                    onError: (error) => {
                        if (isGenerationBusyError(error) && attempt < GENERATION_BUSY_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getGenerationBusyRetryDelayMs(attempt));
                            return;
                        }
                        if (isTransientNetworkStreamError(error) && attempt < NETWORK_STREAM_MAX_RETRIES) {
                            window.setTimeout(() => {
                                void run(attempt + 1);
                            }, getNetworkStreamRetryDelayMs(attempt));
                            return;
                        }
                        console.error('[Galgame] custom input error:', error);
                        setIsWaitingForData(false);
                        if (isGenerationBusyError(error) || isTransientNetworkStreamError(error)) {
                            onErrorAfterAlert?.(String(error));
                        }
                    },
                    deduct: true,
                    actionId,
                    interactionType: 'custom_input',
                    choiceSnapshot,
                });
            };
            await run(0);
        },
        [handleStreamAction, onErrorAfterAlert]
    );

    // Handle regenerate from a history index
    const handleRegenerate = useCallback(
        async (
            messageIndex: number,
            options?: {
                onBeforeRequest?: () => void;
                onSuccess?: () => void;
                onError?: (error: string) => void;
            }
        ) => {
            if (!sessionId) {
                options?.onError?.('No sessionId, cannot send request.');
                return;
            }

            try {
                const requestId = ++currentRequestId.current;

                setCurrentStep(null);
                setStepQueue([]);
                setShowNextButton(false);
                setIsWaitingForData(true);
                setLoading(true);

                onMessagesClear?.();
                options?.onBeforeRequest?.();

                const response = await authFetch(
                    `${HOST_ADDRESS}/api/visual/session/${sessionId}/regenerate`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ historyIndex: messageIndex }),
                    }
                );

                if (response.ok) {
                    await processStreamResponse(response, requestId, {
                        onSuccess: async () => {
                            if (options?.onSuccess) {
                                await options.onSuccess();
                            }
                            if (onStreamComplete) {
                                try {
                                    await onStreamComplete();
                                } catch (e) {
                                    console.error('Failed to run onStreamComplete:', e);
                                }
                            }
                            // 功能注释：与主流程一致，Aliyun 缩短锁缓冲，减少出选项前空等
                            await new Promise((resolve) => window.setTimeout(resolve, rawTextBridgeEnabled ? 250 : 700));
                            if (currentRequestId.current !== requestId) {
                                return;
                            }
                            setLoading(false);
                            await getUserInfo();
                        },
                        onError: (error) => {
                            setLoading(false);
                            const preserveCanvas = shouldPreserveCanvasOnGenerationRetry(currentStepRef.current);
                            if (!preserveCanvas) {
                                setCurrentStep(null);
                            }
                            setStepQueue([]);
                            setShowNextButton(false);
                            options?.onError?.(error);
                        },
                        onGenerationRetry: resetStreamRetryDisplay,
                        onErrorAfterAlert,
                    });
                } else {
                    // 功能注释：statusText 常为空（HTTP/2），补上 status 便于排查
                    const errorMsg = `Request failed: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
                    setLoading(false);
                    setSelectedOptionIndex(null);
                    setIsWaitingForData(false);
                    options?.onError?.(errorMsg);
                }
            } catch (error) {
                const errorMsg = `Request error: ${error instanceof Error ? error.message : 'Unknown error'}`;
                console.error('[Galgame] handleRegenerate error:', errorMsg);
                setLoading(false);
                setSelectedOptionIndex(null);
                setIsWaitingForData(false);
                options?.onError?.(errorMsg);
            }
        },
        [sessionId, processStreamResponse, onMessagesClear, onStreamComplete, onErrorAfterAlert, getUserInfo, resetStreamRetryDisplay]
    );

    return {
        currentStep,
        stepQueue,
        showNextButton,
        selectedOptionIndex,
        isWaitingForData,
        isCompressingContext,
        contextMemory,
        loading,
        handleStreamAction,
        handleNextStep,
        handleChoiceOption,
        handleChoiceSend,
        handleRegenerate,
        setCurrentStep,
        setShowNextButton,
        currentRequestId,
        processStreamResponse,
        setStepQueue,
    };
};
