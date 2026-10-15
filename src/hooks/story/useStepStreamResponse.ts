import { useCallback } from 'react';
import { truncateStepsAfterChoice } from '../mapGalgame/common/interactionUtils';
import { cleanHistoryMessage, sanitizeVisualOptionText, stripNonStoryControlMarkup } from '../../utils/textUtils';
import { isGenerationBusyError } from '../../lib/galgame/choiceStepDisplayGate';
import { choiceStepHasPlayableOptions } from '../../lib/galgame/playChoiceOptions';
import { normalizeUserFacingStreamError } from '../../lib/galgame/normalizeStreamErrorMessage';
import {
    appendRawTextBridge,
    filterFormalStepsAfterRawAppend,
    flushRawTextBridge,
    isRawTextBridgeStep,
    pickLatestDialogueStep,
    pickLatestSceneChangeStep,
} from '../../lib/story/rawTextStepBridge';
import { shouldDeferFormalStepForRawTextBridge } from '../../lib/story/rawTextStreamPolicy';

interface UseStepStreamResponseOptions {
    setStepQueue: React.Dispatch<React.SetStateAction<any[]>>;
    setSelectedOptionIndex: React.Dispatch<React.SetStateAction<number | null>>;
    setIsWaitingForData: React.Dispatch<React.SetStateAction<boolean>>;
    currentRequestId: React.MutableRefObject<number>;
    onMissionFlag?: () => void | Promise<void>;
    // 完整 steps（allSteps）回调，用于在 type: 'complete' 时一次性拿到所有 step
    onCompleteAllSteps?: (steps: any[]) => void;
    // 是否启用「无 choice 时自动补一个空 choice」的兜底逻辑（仅 Galgame 需要，世界交互不启用）
    enableFallbackEmptyChoice?: boolean;
    /**
     * 功能注释：Aliyun 在正式 step 迟到时，把 raw_text 拆句入同一 stepQueue（非另写画布）。
     * CF 不启用以保持原行为。
     */
    enableRawTextStepBridge?: boolean;
}

interface ProcessStepStreamResponseOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onGenerationRetry?: () => void;
    onErrorAfterAlert?: (error: string) => void; // 错误发生时的回调，传递错误信息用于显示错误弹窗
    onFirstStep?: () => void; // 接收到后端数据，清空一些状态缓存等
    onActivity?: (data: any) => void;
    onData?: (data: any) => void; // 任意数据回调（含 type=data/complete 等），便于业务层拿到附加字段
    /** 正式 step 接手时清掉当前 raw 旁白，便于同一套 promote 上屏 */
    onRawTextBridgeHandoff?: () => void;
    /**
     * 功能注释：Aliyun 按句追加到同一画布旁白（非新 step 覆盖）。
     * 传入已完句文案数组；未提供时回退为入 stepQueue。
     */
    onRawTextBridgeAppend?: (segments: string[]) => void;
    /**
     * 功能注释：Aliyun 未完句也立刻刷画布预览（满 3 句后不再刷），减少「一直加载」空等。
     */
    onRawTextBridgeLive?: (unfinishedBuffer: string) => void;
    /**
     * 功能注释：Aliyun raw 旁白期间正式 dialogue 不入队，但要把立绘说话人挂回当前旁白。
     */
    onRawTextBridgeDialoguePortrait?: (dialogueStep: any) => void;
    /**
     * 功能注释：Aliyun raw 旁白期间 scene_change 不入队，但要立刻切背景，避免开场白屏。
     */
    onRawTextBridgeSceneChange?: (sceneStep: any) => void;
}

/**
 * Step 流式响应处理 Hook
 * 专门用于处理包含 step 类型数据的流式输出
 */
const SUPPRESS_ALERT_ERROR_CODES = new Set(['ACTION_IN_PROGRESS']);

export const useStepStreamResponse = ({
    setStepQueue,
    setSelectedOptionIndex,
    setIsWaitingForData,
    currentRequestId,
    onMissionFlag,
    onCompleteAllSteps,
    enableRawTextStepBridge = false,
}: UseStepStreamResponseOptions) => {

    // 从文本中提取 MAIN_OPTION / OPTION 列表
    const extractOptionsFromText = useCallback((text: string): { mainOptions: string[]; options: string[] } => {
        const mainOptions: string[] = [];
        const options: string[] = [];
        if (!text) return { mainOptions, options };

        const mainOptionRegex = /\[MAIN_OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;
        const optionRegex = /\[OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;

        const collect = (raw: string | undefined | null, target: string[]) => {
            let optionText = sanitizeVisualOptionText(raw || '');
            if (!optionText) return;
            const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
            if (quotedMatch && quotedMatch[1]) {
                optionText = quotedMatch[1];
            } else {
                optionText = optionText.replace(/^["']|["']$/g, '');
            }
            optionText = sanitizeVisualOptionText(optionText);
            if (optionText && !target.includes(optionText)) target.push(optionText);
        };

        let m: RegExpExecArray | null;
        mainOptionRegex.lastIndex = 0;
        while ((m = mainOptionRegex.exec(text)) !== null) collect(m[1], mainOptions);
        optionRegex.lastIndex = 0;
        while ((m = optionRegex.exec(text)) !== null) collect(m[1], options);

        return { mainOptions, options };
    }, []);

    // 将包含 [OPTION: ...] 的文本内容转换为 choice step
    // 注意：某些后端会直接返回 type: 'choice'，但把选项仍然写在 content 文本里（没有显式的 options 数组）。
    // 之前这里遇到 type === 'choice' 会直接 return rawStep，导致未能从文本中解析出 [OPTION]。
    // 现在的策略：
    //  - 如果已有有效的 options 数组（length > 0），则保持原样；
    //  - 否则，无论类型为何，都尝试从 content 中提取 [OPTION]，成功则补全为标准的 choice 结构。
    const sanitizeStreamStep = useCallback((rawStep: any): any => {
        if (!rawStep || typeof rawStep !== 'object') return rawStep;
        const cleanString = (value: unknown) => typeof value === 'string' ? stripNonStoryControlMarkup(value) : value;
        const cleanOptionString = (value: unknown) => {
            if (typeof value !== 'string') return value;
            return sanitizeVisualOptionText(value);
        };

        return {
            ...rawStep,
            content: cleanString(rawStep.content),
            text: cleanString(rawStep.text),
            message: cleanString(rawStep.message),
            title: cleanString(rawStep.title),
            description: cleanString(rawStep.description),
            mainOptions: Array.isArray(rawStep.mainOptions) ? rawStep.mainOptions.map(cleanOptionString).filter(Boolean) : rawStep.mainOptions,
            options: Array.isArray(rawStep.options)
                ? rawStep.options.map((option: any) => {
                    if (typeof option === 'string') return cleanOptionString(option);
                    if (option && typeof option === 'object') {
                        return {
                            ...option,
                            text: cleanOptionString(option.text),
                            content: cleanString(option.content),
                            message: cleanString(option.message),
                        };
                    }
                    return option;
                }).filter(Boolean)
                : rawStep.options,
        };
    }, []);

    const toChoiceIfHasOptions = useCallback((rawStep: any): any => {
        const step = sanitizeStreamStep(rawStep);
        if (!step) return step;

        // 已有有效选项（含仅 mainOptions）则不处理
        if (choiceStepHasPlayableOptions(step)) {
            return step;
        }

        // 统一取文案字段
        const content: string | undefined = step.content || step.text || step.message;
        if (!content || typeof content !== 'string') return step;

        try {
            const { options, cleanedText } = cleanHistoryMessage(content);
            const { mainOptions } = extractOptionsFromText(content);
            // 最大兼容性：只要存在完整 [OPTION: ...] 就解析；但当数量 > 5 时，视为异常不转换
            if (Array.isArray(options) && options.length > 0 && options.length <= 5) {
                return {
                    type: 'choice',
                    // 无视 title，提高兼容性
                    title: undefined,
                    description: cleanedText || '',
                    mainOptions: mainOptions.length > 0 ? mainOptions : undefined,
                    options: options.map((t) => t),
                };
            }
        } catch {
            // 忽略解析错误，保持原样
        }

        return step;
    }, [extractOptionsFromText, sanitizeStreamStep]);

    const notifyMissionFlag = useCallback(() => {
        if (!onMissionFlag) return;
        try {
            const result = onMissionFlag();
            if (result instanceof Promise) {
                result.catch((error) => {
                    console.error('❌ mission flag handler error:', error);
                });
            }
        } catch (error) {
            console.error('❌ mission flag handler error:', error);
        }
    }, [onMissionFlag]);

    const shouldTriggerMissionFlag = (data: any) => {
        if (!data) return false;
        if (data.newMission) {
            return true;
        }
        if (typeof data.response === 'string' && data.response.includes('[MISSION')) {
            return true;
        }
        if (typeof data.mission === 'boolean') {
            return data.mission;
        }
        return false;
    };
    /**
     * 处理流式响应（step 类型）
     */
    const processStreamResponse = useCallback(async (
        response: Response,
        requestId: number,
        options?: ProcessStepStreamResponseOptions
    ) => {
        if (!response.ok || !response.body) {
            options?.onError?.(`请求失败: ${response.statusText}`);
            return;
        }

        // 开始处理流式响应时，设置等待状态
        setIsWaitingForData(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasReceivedStep = false;
        let firstStepReceived = false;
        // 累积顶层 response 字段（某些后端只流式返回拼接文本，不包含 step/narrativeSteps）
        let aggregatedResponse = '';
        let choiceEmittedFromResponse = false;
        let streamFailed = false;
        let rawTextBridgeBuffer = '';
        let formalStepsStarted = false;
        let rawTextAppendActive = false;
        /** 功能注释：dialogue 可能早于首句上屏；记下最近立绘，raw flush 后再补挂 */
        let latestDialoguePortrait: any = null;
        try {
            let missionFlagged = false;
            const markFirstStep = () => {
                if (!firstStepReceived) {
                    firstStepReceived = true;
                    options?.onFirstStep?.();
                }
            };
            /**
             * 功能注释：选项后流式会连发多句不同说话人对白。
             * 策略：只「记住」最新对白；本轮首次立刻挂一张；中间换人不刷；
             * complete/data/handoff 再刷最终说话人一次。避免连环进场像多个立绘在闪。
             */
            let portraitCoalesceHandle: ReturnType<typeof setTimeout> | number | null = null;
            let portraitFlushedOnce = false;
            const clearPortraitCoalesceHandle = () => {
                if (portraitCoalesceHandle == null) return;
                if (typeof portraitCoalesceHandle === 'number'
                    && typeof cancelAnimationFrame === 'function') {
                    cancelAnimationFrame(portraitCoalesceHandle);
                } else {
                    clearTimeout(portraitCoalesceHandle as ReturnType<typeof setTimeout>);
                }
                portraitCoalesceHandle = null;
            };
            const flushRawTextBridgeDialoguePortrait = () => {
                clearPortraitCoalesceHandle();
                const step = latestDialoguePortrait;
                if (!step || typeof options?.onRawTextBridgeDialoguePortrait !== 'function') return;
                portraitFlushedOnce = true;
                options.onRawTextBridgeDialoguePortrait(step);
            };
            const rememberRawTextBridgeDialoguePortrait = (dialogueStep: any) => {
                if (!enableRawTextStepBridge) return;
                if (!dialogueStep || String(dialogueStep.type || '') !== 'dialogue') return;
                latestDialoguePortrait = dialogueStep;
            };
            /** 本轮首次立绘：立刻挂；已挂过则只更新 latest，等 final flush */
            const emitRawTextBridgeDialoguePortrait = (dialogueStep: any) => {
                rememberRawTextBridgeDialoguePortrait(dialogueStep);
                if (typeof options?.onRawTextBridgeDialoguePortrait !== 'function') return;
                if (portraitFlushedOnce) return;
                clearPortraitCoalesceHandle();
                if (typeof requestAnimationFrame === 'function') {
                    portraitCoalesceHandle = requestAnimationFrame(() => {
                        flushRawTextBridgeDialoguePortrait();
                    });
                    return;
                }
                flushRawTextBridgeDialoguePortrait();
            };
            /** 收尾：强制刷最新说话人（允许与首次不同） */
            const finalizeRawTextBridgeDialoguePortrait = (dialogueStep?: any) => {
                if (dialogueStep) rememberRawTextBridgeDialoguePortrait(dialogueStep);
                if (!latestDialoguePortrait) return;
                if (typeof options?.onRawTextBridgeDialoguePortrait !== 'function') return;
                flushRawTextBridgeDialoguePortrait();
            };
            const emitRawTextBridgeSceneChange = (sceneStep: any) => {
                if (!enableRawTextStepBridge) return;
                if (!sceneStep || String(sceneStep.type || '') !== 'scene_change') return;
                if (typeof options?.onRawTextBridgeSceneChange === 'function') {
                    options.onRawTextBridgeSceneChange(sceneStep);
                }
            };
            const emitRawTextBridgeSideEffectsFromSteps = (steps: any[]) => {
                // 功能注释：整包 steps 视为收尾，刷最终立绘 + 场景
                finalizeRawTextBridgeDialoguePortrait(pickLatestDialogueStep(steps));
                emitRawTextBridgeSceneChange(pickLatestSceneChangeStep(steps));
            };
            const enqueueBridgeSteps = (bridgeSteps: ReturnType<typeof appendRawTextBridge>['steps']) => {
                if (!bridgeSteps.length || formalStepsStarted) return;
                hasReceivedStep = true;
                markFirstStep();
                // 功能注释：Aliyun 追加到同一旁白；避免新句入队后 promote 覆盖已显示句子
                if (typeof options?.onRawTextBridgeAppend === 'function') {
                    rawTextAppendActive = true;
                    options.onRawTextBridgeAppend(bridgeSteps.map((step) => String(step.content || '')));
                    // 功能注释：若对白立绘先于首句到达，上屏后立刻补挂（仅首次；已挂过不中途换人）
                    if (latestDialoguePortrait) {
                        emitRawTextBridgeDialoguePortrait(latestDialoguePortrait);
                    }
                    return;
                }
                setStepQueue((prev) => {
                    if (currentRequestId.current !== requestId) return prev;
                    if (formalStepsStarted) return prev;
                    const hasChoice = prev.some((s: any) => s?.type === 'choice');
                    if (hasChoice) return prev;
                    let next = prev;
                    for (const step of bridgeSteps) {
                        next = isDuplicateStep(next, step) ? next : [...next, step];
                    }
                    return next;
                });
            };
            const handoffFromRawTextBridge = () => {
                if (!enableRawTextStepBridge || formalStepsStarted) return;
                // 功能注释：交接前强制刷最终说话人，避免 rAF 未跑完被 formal 门闩丢掉
                finalizeRawTextBridgeDialoguePortrait();
                formalStepsStarted = true;
                rawTextBridgeBuffer = '';
                // 功能注释：已追加展示时不清空画布，只停止继续 bridge；由下方过滤正式旁白防覆盖
                if (!rawTextAppendActive) {
                    options?.onRawTextBridgeHandoff?.();
                }
                setStepQueue((prev) => {
                    if (currentRequestId.current !== requestId) return prev;
                    return prev.filter((s) => !isRawTextBridgeStep(s));
                });
            };
            const resetTransientStreamStateForRetry = () => {
                aggregatedResponse = '';
                choiceEmittedFromResponse = false;
                hasReceivedStep = false;
                firstStepReceived = false;
                streamFailed = false;
                rawTextBridgeBuffer = '';
                formalStepsStarted = false;
                rawTextAppendActive = false;
                latestDialoguePortrait = null;
                portraitFlushedOnce = false;
                clearPortraitCoalesceHandle();
                setSelectedOptionIndex(null);
                setStepQueue([]);
                setIsWaitingForData(true);
                options?.onGenerationRetry?.();
            };
            const isDuplicateStep = (prev: any[], incoming: any): boolean => {
                if (!incoming) return false;
                const last = prev[prev.length - 1];
                if (!last) return false;
                if (last.type !== incoming.type) return false;
                const lastText = last?.content || last?.text || last?.message || '';
                const newText = incoming?.content || incoming?.text || incoming?.message || '';
                if (!lastText || !newText) return false;
                return lastText === newText;
            };

            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    // 流式响应结束：仍无正式 step 时冲刷 raw 半句入队
                    if (enableRawTextStepBridge && !formalStepsStarted) {
                        const flushed = flushRawTextBridge(rawTextBridgeBuffer);
                        rawTextBridgeBuffer = flushed.buffer;
                        enqueueBridgeSteps(flushed.steps);
                    }
                    // 流式响应结束
                    if (!hasReceivedStep) {
                        // 兜底：如果累计的 response 文本里有 [OPTION]，在结束时生成一个 choice
                        if (!choiceEmittedFromResponse && aggregatedResponse) {
                            try {
                                const { options: opts, cleanedText } = cleanHistoryMessage(aggregatedResponse);
                                const { mainOptions } = extractOptionsFromText(aggregatedResponse);
                                if (Array.isArray(opts) && opts.length > 0 && opts.length <= 5) {
                                    choiceEmittedFromResponse = true;
                                    hasReceivedStep = true;
                                    if (!firstStepReceived) {
                                        firstStepReceived = true;
                                        options?.onFirstStep?.();
                                    }
                                    setStepQueue(prev => {
                                        if (currentRequestId.current !== requestId) return prev;
                                        const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                        if (hasChoice) return prev;
                                        const choiceStep = {
                                            type: 'choice',
                                            title: undefined,
                                            description: cleanedText || '',
                                            mainOptions: mainOptions.length > 0 ? mainOptions : undefined,
                                            options: opts.map((t: string) => t),
                                        };
                                        return [...prev, choiceStep];
                                    });
                                }
                            } catch {}
                        }
                        // 如果没有收到任何 step，说明响应为空或立即结束
                        // 注意：这里不会调用 onFirstStep，所以超时定时器不会被清除
                        // 如果设置了超时定时器，它会在超时后触发
                        setSelectedOptionIndex(null);
                        setIsWaitingForData(false);
                    }
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) continue;

                    let dataStr = trimmedLine;
                    if (trimmedLine.startsWith('data:')) {
                        dataStr = trimmedLine.replace(/^data:\s*/, '');
                    }

                    try {
                        const raw = JSON.parse(dataStr);
                        // 兼容后端包了一层 data 的响应结构
                        const jsonData = (raw && typeof raw === 'object' && raw.data && raw.data.type)
                            ? raw.data
                            : raw;

                        // 检查是否是当前请求的数据
                        if (currentRequestId.current !== requestId) {
                            continue;
                        }

                        // 透传给上层（例如 worldInteraction 想拿到 interaction / allSteps 等）
                        options?.onActivity?.(jsonData);
                        options?.onData?.(jsonData);

                        if (jsonData.type === 'generation_retry') {
                            resetTransientStreamStateForRetry();
                            continue;
                        }

                        // 功能注释：正式 step 未到前，raw_text 按句入同一 stepQueue（Aliyun bridge）
                        if (
                            enableRawTextStepBridge
                            && !formalStepsStarted
                            && (jsonData.type === 'raw_text' || jsonData.type === 'new_text')
                            && typeof jsonData.text === 'string'
                            && jsonData.text
                        ) {
                            const bridged = appendRawTextBridge(rawTextBridgeBuffer, jsonData.text);
                            rawTextBridgeBuffer = bridged.buffer;
                            enqueueBridgeSteps(bridged.steps);
                            // 功能注释：完句入页后，未完句也预览上屏，避免等句号才出字
                            if (typeof options?.onRawTextBridgeLive === 'function') {
                                options.onRawTextBridgeLive(rawTextBridgeBuffer);
                            }
                        }

                        if (!missionFlagged && shouldTriggerMissionFlag(jsonData)) {
                            missionFlagged = true;
                            notifyMissionFlag();
                        }

                        // 如果只返回了累计 response 文本，尝试基于 [OPTION: ...] 直接生成 choice
                        if (typeof (jsonData as any).response === 'string' && (jsonData as any).response.length > 0) {
                            aggregatedResponse += stripNonStoryControlMarkup(String((jsonData as any).response));
                            if (!choiceEmittedFromResponse) {
                                try {
                                const { options: opts, cleanedText } = cleanHistoryMessage(aggregatedResponse);
                                const { mainOptions } = extractOptionsFromText(aggregatedResponse);
                                if (Array.isArray(opts) && opts.length > 0 && opts.length <= 5) {
                                        choiceEmittedFromResponse = true;
                                        hasReceivedStep = true;
                                        if (!firstStepReceived) {
                                            firstStepReceived = true;
                                            options?.onFirstStep?.();
                                        }
                                        setStepQueue(prev => {
                                            if (currentRequestId.current !== requestId) return prev;
                                            const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                            if (hasChoice) return prev;
                                            const choiceStep = {
                                                type: 'choice',
                                            title: undefined,
                                                description: cleanedText || '',
                                                mainOptions: mainOptions.length > 0 ? mainOptions : undefined,
                                                options: opts.map((t: string) => t),
                                            };
                                            return [...prev, choiceStep];
                                        });
                                    }
                                } catch {}
                            }
                        }

                        if (jsonData.type === 'error') {
                            const errorCode = typeof jsonData.code === 'string' ? jsonData.code : '';
                            let errorMessage = jsonData.error || jsonData.message || '发生错误';
                            
                            if (typeof errorMessage === 'object' && errorMessage !== null) {
                                errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                            }
                            errorMessage = normalizeUserFacingStreamError(errorMessage);
                            streamFailed = true;
                            
                            const suppressError = SUPPRESS_ALERT_ERROR_CODES.has(errorCode)
                                || isGenerationBusyError(errorMessage);
                            // busy/锁冲突是并发保护，不当作失败红错刷屏
                            if (suppressError) {
                                console.warn('[stream] busy/in-progress:', errorMessage, errorCode || '');
                            } else {
                                console.error('❌ 流式响应错误:', errorMessage);
                                options?.onErrorAfterAlert?.(errorMessage);
                            }
                            setSelectedOptionIndex(null);
                            setStepQueue([]);
                            setIsWaitingForData(false);
                            // busy 类错误仍回调 onError，便于上层静默重试
                            options?.onError?.(errorMessage);
                            hasReceivedStep = true;
                            continue;
                        }

                        // 处理 step 类型的数据（增量 / 收尾 step）
                        if (jsonData.type === 'step' && jsonData.step) {
                            // 功能注释：Aliyun bridge 开启时忽略 formal step，避免 handoff 清掉按句旁白；CF 仍即时入队
                            if (shouldDeferFormalStepForRawTextBridge(enableRawTextStepBridge)) {
                                // 功能注释：不依赖 rawTextAppendActive——对白/场景常比首句更早到达
                                emitRawTextBridgeDialoguePortrait(jsonData.step);
                                emitRawTextBridgeSceneChange(jsonData.step);
                                continue;
                            }
                            // 如果 step 文本中包含 [OPTION: ...]，则转换为 choice，避免依赖其它包裹标签
                            const step = toChoiceIfHasOptions(jsonData.step);
                            hasReceivedStep = true;
                            console.log('step data:', step);
                            handoffFromRawTextBridge();
                            markFirstStep();

                            setStepQueue(prev => {
                                if (currentRequestId.current !== requestId) {
                                    return prev;
                                }
                                const base = enableRawTextStepBridge
                                    ? prev.filter((s) => !isRawTextBridgeStep(s))
                                    : prev;
                                
                                // 检查队列中是否已有 choice 步骤
                                const hasChoice = base.some((s: any) => s?.type === 'choice');
                                if (hasChoice) {
                                    return base;
                                }
                                
                                // 如果当前步骤是 choice，直接添加
                                if (step?.type === 'choice') {
                                    const newQueue = [...base, step];
                                    return newQueue;
                                }
                                
                                // 避免连续重复的相同步骤（常见于 step + narrativeSteps 重复）
                                const newQueue = isDuplicateStep(base, step) ? base : [...base, step];
                                console.log('[流式接收] 单个step加入队列:', {
                                    stepType: step?.type,
                                    queueLength: newQueue.length,
                                    requestId,
                                });
                                return newQueue;
                            });
                        }

                        // 处理完整数据（包含 narrativeSteps）
                        if (jsonData.type === 'data' && jsonData.narrativeSteps && Array.isArray(jsonData.narrativeSteps)) {
                            if (jsonData.narrativeSteps.length > 0) {
                                hasReceivedStep = true;
                                handoffFromRawTextBridge();
                                markFirstStep();

                                const mapped = jsonData.narrativeSteps.map((s: any) => toChoiceIfHasOptions(s));
                                const truncatedSteps = truncateStepsAfterChoice(mapped);
                                // 功能注释：过滤前挂立绘/切场景（不要求 raw 已上屏）
                                emitRawTextBridgeSideEffectsFromSteps(truncatedSteps);

                                setStepQueue(prev => {
                                    if (currentRequestId.current !== requestId) {
                                        return prev;
                                    }
                                    const base = enableRawTextStepBridge
                                        ? prev.filter((s) => !isRawTextBridgeStep(s))
                                        : prev;
                                    
                                    // 检查队列中是否已有 choice 步骤
                                    const hasChoice = base.some((s: any) => s?.type === 'choice');
                                    if (hasChoice) {
                                        return base;
                                    }
                                    
                                    // 功能注释：Aliyun 已按句追加时跳过正式旁白，只入队 choice，避免整段覆盖
                                    const newSteps = filterFormalStepsAfterRawAppend(truncatedSteps, {
                                        rawAppendActive: enableRawTextStepBridge && rawTextAppendActive,
                                    });
                                    let newQueue = base;
                                    for (const s of newSteps) {
                                        newQueue = isDuplicateStep(newQueue, s) ? newQueue : [...newQueue, s];
                                    }
                                    
                                    console.log('[流式接收] narrativeSteps加入队列:', {
                                        originalCount: jsonData.narrativeSteps.length,
                                        truncatedCount: newSteps.length,
                                        queueLength: newQueue.length,
                                        requestId,
                                    });
                                    return newQueue;
                                });
                            }
                        }

                        // 处理 complete 事件，携带 allSteps（后端已完全生成的步骤列表）
                        if (!streamFailed && jsonData.type === 'complete' && Array.isArray(jsonData.allSteps)) {
                            try {
                                const finalAllSteps = jsonData.allSteps.map((s: any) => toChoiceIfHasOptions(s));
                                // 功能注释：complete 可能早于 data；再挂立绘/场景兜底
                                emitRawTextBridgeSideEffectsFromSteps(finalAllSteps);
                                onCompleteAllSteps?.(finalAllSteps);
                            } catch (e) {
                                console.warn('onCompleteAllSteps 回调执行失败:', e);
                            }
                        }
                    } catch (e) {
                        // 忽略无法解析的数据
                    }
                }
            }

            // 处理缓冲区中剩余的数据
            if (buffer.trim()) {
                let dataStr = buffer.trim();
                if (dataStr.startsWith('data:')) {
                    dataStr = dataStr.replace(/^data:\s*/, '');
                }
                try {
                    const jsonData = JSON.parse(dataStr);

                    // 透传给上层
                    options?.onActivity?.(jsonData);
                    options?.onData?.(jsonData);

                    if (currentRequestId.current !== requestId) {
                        return;
                    }

                    if (jsonData.type === 'generation_retry') {
                        resetTransientStreamStateForRetry();
                        return;
                    }

                    if (!missionFlagged && shouldTriggerMissionFlag(jsonData)) {
                        missionFlagged = true;
                        notifyMissionFlag();
                    }

                    // 缓冲区结尾也尝试从 response 聚合文本中解析选项
                    if (typeof (jsonData as any).response === 'string' && (jsonData as any).response.length > 0) {
                        aggregatedResponse += stripNonStoryControlMarkup(String((jsonData as any).response));
                        if (!choiceEmittedFromResponse) {
                            try {
                                const { options: opts, cleanedText } = cleanHistoryMessage(aggregatedResponse);
                                const { mainOptions } = extractOptionsFromText(aggregatedResponse);
                                if (Array.isArray(opts) && opts.length > 0 && opts.length <= 5) {
                                        choiceEmittedFromResponse = true;
                                        hasReceivedStep = true;
                                        if (!firstStepReceived) {
                                            firstStepReceived = true;
                                            options?.onFirstStep?.();
                                        }
                                        setStepQueue(prev => {
                                            if (currentRequestId.current !== requestId) return prev;
                                            const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                            if (hasChoice) return prev;
                                    const choiceStep = {
                                        type: 'choice',
                                        title: undefined,
                                        description: cleanedText || '',
                                        mainOptions: mainOptions.length > 0 ? mainOptions : undefined,
                                        options: opts.map((t: string) => t),
                                    };
                                            return [...prev, choiceStep];
                                        });
                                    }
                                } catch {}
                            }
                        }

                    // 处理顶层的 error 类型
                    if (jsonData.type === 'error') {
                        const errorCode = typeof jsonData.code === 'string' ? jsonData.code : '';
                        // 优先使用 error 字段，然后是 message 字段
                        let errorMessage = jsonData.error || jsonData.message || '发生错误';
                        
                        // 如果 error 是对象，尝试提取 message
                        if (typeof errorMessage === 'object' && errorMessage !== null) {
                            errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                        }
                        errorMessage = normalizeUserFacingStreamError(errorMessage);
                        streamFailed = true;
                        
                        // 显示错误弹窗给用户
                        console.error('❌ 流式响应错误（缓冲区）:', errorMessage);
                        const suppressError = SUPPRESS_ALERT_ERROR_CODES.has(errorCode)
                            || isGenerationBusyError(errorMessage);
                        if (!suppressError) {
                            options?.onErrorAfterAlert?.(errorMessage);
                        }
                        setSelectedOptionIndex(null);
                        setStepQueue([]);
                        setIsWaitingForData(false);
                        options?.onError?.(errorMessage);
                        return;
                    }

                    if (jsonData.type === 'step' && jsonData.step) {
                        if (shouldDeferFormalStepForRawTextBridge(enableRawTextStepBridge)) {
                            emitRawTextBridgeDialoguePortrait(jsonData.step);
                            emitRawTextBridgeSceneChange(jsonData.step);
                        } else {
                            hasReceivedStep = true;
                            handoffFromRawTextBridge();
                            markFirstStep();
                            setStepQueue(prev => {
                                if (currentRequestId.current !== requestId) {
                                    return prev;
                                }
                                const base = enableRawTextStepBridge
                                    ? prev.filter((s) => !isRawTextBridgeStep(s))
                                    : prev;
                                const hasChoice = base.some((s: any) => s?.type === 'choice');
                                if (hasChoice) {
                                    return base;
                                }
                                
                                // 如果当前步骤（或转换后）是 choice，直接添加
                                const step = toChoiceIfHasOptions(jsonData.step);
                                if (step?.type === 'choice') {
                                    return [...base, step];
                                }
                                
                                // 普通步骤，正常添加（去重）
                                return isDuplicateStep(base, step) ? base : [...base, step];
                            });
                        }
                    }
                    if (jsonData.type === 'data' && jsonData.narrativeSteps && Array.isArray(jsonData.narrativeSteps)) {
                        if (jsonData.narrativeSteps.length > 0) {
                            hasReceivedStep = true;
                            handoffFromRawTextBridge();
                            if (!firstStepReceived && jsonData.narrativeSteps.length > 0) {
                                firstStepReceived = true;
                                options?.onFirstStep?.();
                            }
                            const mapped = jsonData.narrativeSteps.map((s: any) => toChoiceIfHasOptions(s));
                            const truncatedSteps = truncateStepsAfterChoice(mapped);
                            emitRawTextBridgeSideEffectsFromSteps(truncatedSteps);
                            setStepQueue(prev => {
                                if (currentRequestId.current !== requestId) {
                                    return prev;
                                }
                                
                                const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                if (hasChoice) {
                                    return prev;
                                }
                                
                                const newSteps = filterFormalStepsAfterRawAppend(truncatedSteps, {
                                    rawAppendActive: enableRawTextStepBridge && rawTextAppendActive,
                                });
                                let merged = prev;
                                for (const s of newSteps) {
                                    merged = isDuplicateStep(merged, s) ? merged : [...merged, s];
                                }
                                return merged;
                            });
                        }
                    }
                } catch (e) {
                    // 忽略无法解析的数据
                }
            }

            if (!streamFailed) {
                options?.onSuccess?.();
            }
        } catch (error) {
            console.error('❌ 流式数据接收错误:', error);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(normalizeUserFacingStreamError(error));
        }
    }, [setStepQueue, setSelectedOptionIndex, setIsWaitingForData, currentRequestId, enableRawTextStepBridge]);

    return {
        processStreamResponse,
    };
};
