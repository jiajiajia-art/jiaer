import { useCallback } from 'react';

interface UseStepStreamResponseOptions {
    setStepQueue: React.Dispatch<React.SetStateAction<any[]>>;
    setSelectedOptionIndex: React.Dispatch<React.SetStateAction<number | null>>;
    setIsWaitingForData: React.Dispatch<React.SetStateAction<boolean>>;
    currentRequestId: React.MutableRefObject<number>;
    onMissionFlag?: () => void | Promise<void>;
    // 完整 steps（allSteps）回调，用于在 type: 'complete' 时一次性拿到所有 step
    onCompleteAllSteps?: (steps: any[]) => void;
}

interface ProcessStepStreamResponseOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onErrorAfterAlert?: (error: string) => void; // 错误发生时的回调，传递错误信息用于显示错误弹窗
    onFirstStep?: () => void; // 收到第一个 step 时的回调
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
}: UseStepStreamResponseOptions) => {
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

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
            let hasReceivedStep = false;
            let firstStepReceived = false;

        try {
            let missionFlagged = false;
            console.log('📡 开始接收流式数据...');

            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    console.log('✅ 流式数据接收完成，请求 ID:', requestId);
                    if (!hasReceivedStep) {
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
                            console.log('⚠️ 忽略旧请求的数据');
                            continue;
                        }

                        // 透传给上层（例如 worldInteraction 想拿到 interaction / allSteps 等）
                        options?.onData?.(jsonData);

                        // 透传给上层（例如 worldInteraction 想拿到 interaction / allSteps 等）
                        options?.onData?.(jsonData);

                        if (!missionFlagged && shouldTriggerMissionFlag(jsonData)) {
                            missionFlagged = true;
                            notifyMissionFlag();
                        }

                        // 处理顶层的 error 类型（不是 step 格式）
                        if (jsonData.type === 'error') {
                            let errorMessage = jsonData.message || jsonData.error || '发生错误';
                            
                            // 尝试解析 message 中可能包含的嵌套 JSON
                            if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
                                try {
                                    const parsed = JSON.parse(errorMessage);
                                    if (parsed.error?.message) {
                                        errorMessage = parsed.error.message;
                                    } else if (parsed.message) {
                                        errorMessage = parsed.message;
                                    }
                                } catch (e) {
                                    // 解析失败，使用原始 message
                                }
                            }
                            
                            // 不再使用 alert，改为通过回调传递错误信息显示错误弹窗
                            options?.onErrorAfterAlert?.(errorMessage);
                            setSelectedOptionIndex(null);
                            setIsWaitingForData(false);
                            options?.onError?.(errorMessage);
                            hasReceivedStep = true;
                            continue;
                        }

                        // 处理 step 类型的数据（增量 step）
                    if (jsonData.type === 'step' && jsonData.step) {
                            const step = jsonData.step;
                            console.log('📝 收到新的 step:', step.type);
                            hasReceivedStep = true;

                            // 如果是第一个 step，触发回调
                            if (!firstStepReceived) {
                                firstStepReceived = true;
                                options?.onFirstStep?.();
                            }

                            setStepQueue(prev => {
                                if (currentRequestId.current !== requestId) {
                                    return prev;
                                }
                                const newQueue = [...prev, step];
                                return newQueue;
                            });

                            // 首个 step 收到时，立即关闭等待态，避免等 complete 才渲染
                            setIsWaitingForData(false);
                        }

                        // 处理完整数据（包含 narrativeSteps）
                    if (jsonData.type === 'data' && jsonData.narrativeSteps && Array.isArray(jsonData.narrativeSteps)) {
                            console.log('📚 收到完整数据，包含', jsonData.narrativeSteps.length, '个 steps');
                            if (jsonData.narrativeSteps.length > 0) {
                                hasReceivedStep = true;

                                // 如果是第一个 step，触发回调
                                if (!firstStepReceived && jsonData.narrativeSteps.length > 0) {
                                    firstStepReceived = true;
                                    options?.onFirstStep?.();
                                }

                                setStepQueue(prev => {
                                    if (currentRequestId.current !== requestId) {
                                        return prev;
                                    }
                                    const newQueue = [...prev, ...jsonData.narrativeSteps];
                                    console.log('📋 队列更新（完整数据），当前队列长度:', newQueue.length);
                                    return newQueue;
                                });
                            }
                        }

                        // 处理 complete 事件，携带 allSteps（后端已完全生成的步骤列表）
                        if (jsonData.type === 'complete' && Array.isArray(jsonData.allSteps)) {
                            try {
                                onCompleteAllSteps?.(jsonData.allSteps);
                            } catch (e) {
                                console.warn('onCompleteAllSteps 回调执行失败:', e);
                            }
                        }
                    } catch (e) {
                        console.log('📦 收到流式数据（原始）:', trimmedLine);
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

                    // 处理顶层的 error 类型
                    if (jsonData.type === 'error') {
                        let errorMessage = jsonData.message || jsonData.error || '发生错误';
                        
                        // 尝试解析 message 中可能包含的嵌套 JSON
                        if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(errorMessage);
                                if (parsed.error?.message) {
                                    errorMessage = parsed.error.message;
                                } else if (parsed.message) {
                                    errorMessage = parsed.message;
                                }
                            } catch (e) {
                                // 解析失败，使用原始 message
                            }
                        }
                        
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
                            return [...prev, jsonData.step];
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
                            return [...prev, ...jsonData.narrativeSteps];
                        });
                    }
                } catch (e) {
                    console.log('📦 收到流式数据（最后，原始）:', dataStr);
                }
            }

            options?.onSuccess?.();
        } catch (error) {
            console.error('❌ 流式数据接收错误:', error);
            setSelectedOptionIndex(null);
            setIsWaitingForData(false);
            options?.onError?.(error instanceof Error ? error.message : '流式数据接收错误');
        }
    }, [setStepQueue, setSelectedOptionIndex, setIsWaitingForData, currentRequestId]);

    return {
        processStreamResponse,
    };
};
