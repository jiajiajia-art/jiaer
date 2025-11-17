import { useCallback } from 'react';

// ACTION 提取工具函数
const ACTION_REGEX_PATTERN = /\[ACTION:\s*(.*?)\]/g;

const extractActions = (text: string): { text: string; actions: string[] } => {
    if (!text.includes('[ACTION:')) {
        return { text: text.trim(), actions: [] };
    }

    const actions: string[] = [];
    const actionRegex = new RegExp(ACTION_REGEX_PATTERN.source, ACTION_REGEX_PATTERN.flags);
    let match;

    while ((match = actionRegex.exec(text)) !== null) {
        const actionText = match[1].trim();
        if (actionText && !actions.includes(actionText)) {
            actions.push(actionText);
        }
    }

    const textWithoutAction = text.replace(/\[ACTION:\s*.*?\]/g, '').trim();
    return { text: textWithoutAction, actions };
};

interface UseStreamResponseOptions {
    /**
     * 更新消息的函数
     */
    setMessages: React.Dispatch<React.SetStateAction<any[]>>;
    
    /**
     * 初始消息的配置（可选）
     */
    initialMessage?: {
        type?: 'system' | 'user';
        isMarkdown?: boolean;
    };
}

/**
 * 流式响应处理 Hook
 * 统一处理流式数据解析、ACTION 提取和消息更新
 * 刷新数据的方法由各组件在流结束后自行调用
 */
export const useStreamResponse = ({ setMessages, initialMessage }: UseStreamResponseOptions) => {
    const handleStreamResponse = useCallback(async (response: Response) => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let actions: string[] = [];

        if (!reader) {
            return;
        }

        // 添加初始"打字中"消息
        setMessages((prev) => {
            const newMessage = {
                type: initialMessage?.type || 'system',
                text: '',
                isTyping: true,
                isMarkdown: initialMessage?.isMarkdown ?? true,
                actions: [] as string[]
            };
            return [...prev, newMessage];
        });

        let chunkCount = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const segments = buffer.split(/\r?\n/);
            buffer = segments.pop() || '';

            for (const segment of segments) {
                const line = segment.trim();
                if (!line) continue;

                const cleaned = line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line;

                try {
                    const json = JSON.parse(cleaned);

                    // 支持多种格式：
                    // 1. json.content（无 type 或 type 为 'chunk'）
                    // 2. json.type === 'stream' && json.content
                    // 3. json.type === 'chunk' && json.content
                    const chunk = json.content && (json.type === undefined || json.type === 'chunk' || json.type === 'stream')
                        ? json.content 
                        : null;

                    if (chunk) {
                        chunkCount++;
                        fullText += chunk;

                        // 检测 ACTION
                        if (fullText.includes('[ACTION:')) {
                            const { text: textWithoutAction, actions: extractedActions } = extractActions(fullText);
                            
                            // 合并新的 actions
                            const newActions = extractedActions.filter(action => !actions.includes(action));
                            if (newActions.length > 0) {
                                actions = [...actions, ...newActions];
                            }

                            // 更新消息：有 ACTION 时停止打字效果
                            setMessages((prev) => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last) {
                                    updated[updated.length - 1] = {
                                        ...last,
                                        text: textWithoutAction,
                                        isTyping: false,
                                        actions: actions.length > 0 ? [...actions] : undefined
                                    };
                                    return updated;
                                }
                                return prev;
                            });
                        } else {
                            // 没有 ACTION 时持续更新文字
                            setMessages((prev) => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last && last.isTyping) {
                                    updated[updated.length - 1] = {
                                        ...last,
                                        text: fullText.trim(),
                                    };
                                    return updated;
                                }
                                if (last && !last.isTyping) {
                                    console.warn('⚠️ [useStreamResponse] last.isTyping 为 false，跳过更新');
                                }
                                return updated;
                            });
                        }
                    }
                } catch {
                    // 解析不完整时忽略
                }
            }
        }

        // 流结束时，确保最终文本和关闭打字效果
        setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
                // 确保最终文本是完整的（去除 ACTION 部分）
                let finalText = fullText.trim();
                if (finalText.includes('[ACTION:')) {
                    finalText = finalText.slice(0, finalText.indexOf('[ACTION:')).trim();
                }

                updated[updated.length - 1] = {
                    ...last,
                    text: finalText,
                    isTyping: false
                };
                return updated;
            }
            return updated;
        });
    }, [setMessages, initialMessage]);

    return {
        handleStreamResponse
    };
};
