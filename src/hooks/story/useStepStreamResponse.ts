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

        // 开始处理流式响应时，设置等待状态
        setIsWaitingForData(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let hasReceivedStep = false;
        let firstStepReceived = false;
        try {
            let missionFlagged = false;

            while (true) {
                const { value, done } = await reader.read();

                if (done) {
                    // 流式响应结束
                    if (!hasReceivedStep) {
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

                        if (jsonData.type === 'error') {
                            let errorMessage = jsonData.error || jsonData.message || '发生错误';
                            
                            if (typeof errorMessage === 'object' && errorMessage !== null) {
                                errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                            }
                            
                            if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
                                try {
                                    const parsed = JSON.parse(errorMessage);
                                    if (parsed.error?.message) {
                                        errorMessage = parsed.error.message;
                                    } else if (parsed.message) {
                                        errorMessage = parsed.message;
                                    } else if (parsed.error) {
                                        errorMessage = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                                    }
                                } catch (e) {
                                    // 解析失败，使用原始 message
                                }
                            }
                            
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
                            const step = jsonData.step;
                            hasReceivedStep = true;

                            // 如果是第一个 step，触发回调（清除超时定时器）
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

                            // 注意：不在这里设置 setIsWaitingForData(false)
                            // 等待 currentStep 被设置后再关闭等待态（由 showStep 函数负责）
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
                                    const newQueue = [...prev, ...jsonData.narrativeSteps];
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

                    // 处理顶层的 error 类型
                    if (jsonData.type === 'error') {
                        // 优先使用 error 字段，然后是 message 字段
                        let errorMessage = jsonData.error || jsonData.message || '发生错误';
                        
                        // 如果 error 是对象，尝试提取 message
                        if (typeof errorMessage === 'object' && errorMessage !== null) {
                            errorMessage = errorMessage.message || errorMessage.error || JSON.stringify(errorMessage);
                        }
                        
                        // 尝试解析 message 中可能包含的嵌套 JSON
                        if (typeof errorMessage === 'string' && errorMessage.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(errorMessage);
                                if (parsed.error?.message) {
                                    errorMessage = parsed.error.message;
                                } else if (parsed.message) {
                                    errorMessage = parsed.message;
                                } else if (parsed.error) {
                                    errorMessage = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                                }
                            } catch (e) {
                                // 解析失败，使用原始 message
                            }
                        }
                        
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
                    // 忽略无法解析的数据
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
