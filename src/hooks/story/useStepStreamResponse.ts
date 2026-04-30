import { useCallback } from 'react';
import { truncateStepsAfterChoice } from '../mapGalgame/common/interactionUtils';
import { cleanHistoryMessage } from '../../utils/textUtils';

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
}

interface ProcessStepStreamResponseOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onErrorAfterAlert?: (error: string) => void; // 错误发生时的回调，传递错误信息用于显示错误弹窗
    onFirstStep?: () => void; // 接收到后端数据，清空一些状态缓存等
    onData?: (data: any) => void; // 任意数据回调（含 type=data/complete 等），便于业务层拿到附加字段
}

/**
 * Step 流式响应处理 Hook
 * 专门用于处理包含 step 类型数据的流式输出
 */
export const useStepStreamResponse = ({
    setStepQueue,
    setSelectedOptionIndex,
    setIsWaitingForData,
    currentRequestId,
    onMissionFlag,
    onCompleteAllSteps,
    enableFallbackEmptyChoice = false,
}: UseStepStreamResponseOptions) => {

    const normalizeUserFacingStreamError = useCallback((error: unknown): string => {
        let message = typeof error === 'string'
            ? error
            : error instanceof Error
                ? error.message
                : '发生错误';

        if (typeof message === 'string' && message.trim().startsWith('{')) {
            try {
                const parsed = JSON.parse(message);
                if (parsed.error?.message) {
                    message = parsed.error.message;
                } else if (parsed.message) {
                    message = parsed.message;
                } else if (parsed.error) {
                    message = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                }
            } catch {
                // JSON 解析失败时保持原始信息
            }
        }

        if (
            typeof message === 'string' &&
            (
                message.includes('Failed to acquire lock') ||
                message.includes('Lock acquisition timeout') ||
                message.includes('visual:locks:')
            )
        ) {
            return '当前内容正在生成中，请稍后再试';
        }

        return message;
    }, []);

    // 从文本中提取 MAIN_OPTION / OPTION 列表
    const extractOptionsFromText = useCallback((text: string): { mainOptions: string[]; options: string[] } => {
        const mainOptions: string[] = [];
        const options: string[] = [];
        if (!text) return { mainOptions, options };

        const mainOptionRegex = /\[MAIN_OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;
        const optionRegex = /\[OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;

        const collect = (raw: string | undefined | null, target: string[]) => {
            let optionText = raw?.trim() || '';
            if (!optionText) return;
            const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
            if (quotedMatch && quotedMatch[1]) {
                optionText = quotedMatch[1];
            } else {
                optionText = optionText.replace(/^["']|["']$/g, '');
            }
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
    const toChoiceIfHasOptions = useCallback((rawStep: any): any => {
        if (!rawStep) return rawStep;

        // 已有有效选项则不处理
        if (rawStep.type === 'choice' && Array.isArray(rawStep.options) && rawStep.options.length > 0) {
            return rawStep;
        }

        // 统一取文案字段
        const content: string | undefined = rawStep.content || rawStep.text || rawStep.message;
        if (!content || typeof content !== 'string') return rawStep;

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

        return rawStep;
    }, [extractOptionsFromText]);

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
        try {
            let missionFlagged = false;
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
                        options?.onData?.(jsonData);

                        if (!missionFlagged && shouldTriggerMissionFlag(jsonData)) {
                            missionFlagged = true;
                            notifyMissionFlag();
                        }

                        // 如果只返回了累计 response 文本，尝试基于 [OPTION: ...] 直接生成 choice
                        if (typeof (jsonData as any).response === 'string' && (jsonData as any).response.length > 0) {
                            aggregatedResponse += String((jsonData as any).response);
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
                            let errorMessage = jsonData.error || jsonData.message || '发生错误';
                            
                            if (typeof errorMessage === 'object' && errorMessage !== null) {
                                errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                            }
                            errorMessage = normalizeUserFacingStreamError(errorMessage);
                            
                            // 显示错误弹窗给用户
                            console.error('❌ 流式响应错误:', errorMessage);
                            options?.onErrorAfterAlert?.(errorMessage);
                            setSelectedOptionIndex(null);
                            setIsWaitingForData(false);
                            options?.onError?.(errorMessage);
                            hasReceivedStep = true;
                            continue;
                        }

                        // 处理 step 类型的数据（增量 step）
                        if (jsonData.type === 'step' && jsonData.step) {
                            // 如果 step 文本中包含 [OPTION: ...]，则转换为 choice，避免依赖其它包裹标签
                            const step = toChoiceIfHasOptions(jsonData.step);
                            hasReceivedStep = true;
                            console.log('step data:', step);

                            // 如果是第一个 step，触发回调（清除超时定时器）
                            if (!firstStepReceived) {
                                firstStepReceived = true;
                                options?.onFirstStep?.();
                            }

                            setStepQueue(prev => {
                                if (currentRequestId.current !== requestId) {
                                    return prev;
                                }
                                
                                // 检查队列中是否已有 choice 步骤
                                const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                if (hasChoice) {
                                    return prev;
                                }
                                
                                // 如果当前步骤是 choice，直接添加
                                if (step?.type === 'choice') {
                                    const newQueue = [...prev, step];
                                    return newQueue;
                                }
                                
                                // 避免连续重复的相同步骤（常见于 step + narrativeSteps 重复）
                                const newQueue = isDuplicateStep(prev, step) ? prev : [...prev, step];
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

                                // 如果是第一个 step（narrativeSteps 不为空），触发回调（清除超时定时器）
                                if (!firstStepReceived && jsonData.narrativeSteps.length > 0) {
                                    firstStepReceived = true;
                                    options?.onFirstStep?.();
                                }

                                setStepQueue(prev => {
                                    if (currentRequestId.current !== requestId) {
                                        return prev;
                                    }
                                    
                                    // 检查队列中是否已有 choice 步骤
                                    const hasChoice = prev.some((s: any) => s?.type === 'choice');
                                    if (hasChoice) {
                                        return prev;
                                    }
                                    
                                    // 逐个转换 narrativeSteps，若包含 [OPTION] 则生成为 choice
                                    const mapped = jsonData.narrativeSteps.map((s: any) => toChoiceIfHasOptions(s));
                                    const truncatedSteps = truncateStepsAfterChoice(mapped);
                                    
                                    // 如果截断后的步骤数组中有 choice，且队列中还没有 choice，则只添加 choice 及其之前的步骤
                                    const newSteps = truncatedSteps;
                                    // 逐一追加，避免与结尾元素重复
                                    let newQueue = prev;
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
                        if (jsonData.type === 'complete' && Array.isArray(jsonData.allSteps)) {
                            try {
                                let finalAllSteps = jsonData.allSteps;

                                // 仅在显式开启时（Galgame）才做「无 choice 自动补空 choice」的兜底
                                if (enableFallbackEmptyChoice) {
                                    // 如果整段剧情里没有任何带 options 的 choice，则在末尾补一个空选项的 choice
                                    const hasChoiceWithOptions = finalAllSteps.some(
                                        (s: any) =>
                                            s &&
                                            s.type === 'choice' &&
                                            Array.isArray(s.options) &&
                                            s.options.length > 0
                                    );

                                    if (!hasChoiceWithOptions) {
                                        const syntheticChoice = {
                                            type: 'choice',
                                            title: undefined,
                                            // 对于兜底空 choice，不再重复上一条叙述，交给前端用固定文案或仅展示自定义输入
                                            description: '',
                                            mainOptions: [],
                                            options: [],
                                        };

                                        finalAllSteps = [...finalAllSteps, syntheticChoice];

                                        // 同时往队列里塞入这个空 choice，保证前端能停在“选择/自定义输入”界面
                                        setStepQueue((prev) => {
                                            if (currentRequestId.current !== requestId) return prev;
                                            const hasChoiceInQueue = prev.some(
                                                (s: any) => s && s.type === 'choice'
                                            );
                                            if (hasChoiceInQueue) return prev;
                                            return [...prev, syntheticChoice];
                                        });
                                    }
                                }

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
                    options?.onData?.(jsonData);

                    if (currentRequestId.current !== requestId) {
                        return;
                    }

                    if (!missionFlagged && shouldTriggerMissionFlag(jsonData)) {
                        missionFlagged = true;
                        notifyMissionFlag();
                    }

                    // 缓冲区结尾也尝试从 response 聚合文本中解析选项
                    if (typeof (jsonData as any).response === 'string' && (jsonData as any).response.length > 0) {
                        aggregatedResponse += String((jsonData as any).response);
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
                        // 优先使用 error 字段，然后是 message 字段
                        let errorMessage = jsonData.error || jsonData.message || '发生错误';
                        
                        // 如果 error 是对象，尝试提取 message
                        if (typeof errorMessage === 'object' && errorMessage !== null) {
                            errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                        }
                        errorMessage = normalizeUserFacingStreamError(errorMessage);
                        
                        // 显示错误弹窗给用户
                        console.error('❌ 流式响应错误（缓冲区）:', errorMessage);
                        options?.onErrorAfterAlert?.(errorMessage);
                        setSelectedOptionIndex(null);
                        setIsWaitingForData(false);
                        options?.onError?.(errorMessage);
                        return;
                    }

                    if (jsonData.type === 'step' && jsonData.step) {
                        hasReceivedStep = true;
                        if (!firstStepReceived) {
                            firstStepReceived = true;
                            options?.onFirstStep?.();
                        }
                        setStepQueue(prev => {
                            if (currentRequestId.current !== requestId) {
                                return prev;
                            }
                            const hasChoice = prev.some((s: any) => s?.type === 'choice');
                            if (hasChoice) {
                                return prev;
                            }
                            
                            // 如果当前步骤（或转换后）是 choice，直接添加
                            const step = toChoiceIfHasOptions(jsonData.step);
                            if (step?.type === 'choice') {
                                return [...prev, step];
                            }
                            
                            // 普通步骤，正常添加（去重）
                            return isDuplicateStep(prev, step) ? prev : [...prev, step];
                        });
                    }
                    if (jsonData.type === 'data' && jsonData.narrativeSteps && Array.isArray(jsonData.narrativeSteps)) {
                        if (jsonData.narrativeSteps.length > 0) {
                            hasReceivedStep = true;
                            if (!firstStepReceived && jsonData.narrativeSteps.length > 0) {
                                firstStepReceived = true;
                                options?.onFirstStep?.();
                            }
                        }
                        setStepQueue(prev => {
                            if (currentRequestId.current !== requestId) {
                                return prev;
                            }
                            
                            const hasChoice = prev.some((s: any) => s?.type === 'choice');
                            if (hasChoice) {
                                return prev;
                            }
                            
                            const mapped = jsonData.narrativeSteps.map((s: any) => toChoiceIfHasOptions(s));
                            const truncatedSteps = truncateStepsAfterChoice(mapped);
                            let merged = prev;
                            for (const s of truncatedSteps) {
                                merged = isDuplicateStep(merged, s) ? merged : [...merged, s];
                            }
                            return merged;
                        });
                    }
                } catch (e) {
                    // 忽略无法解析的数据
                }
            }

            options?.onSuccess?.();
        } catch (error) {
            console.error('❌ 流式数据接收错误:', error);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(normalizeUserFacingStreamError(error));
        }
    }, [setStepQueue, setSelectedOptionIndex, setIsWaitingForData, currentRequestId, normalizeUserFacingStreamError]);

    return {
        processStreamResponse,
    };
};
