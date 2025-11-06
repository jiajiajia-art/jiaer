import { useState, useEffect, useRef, useCallback } from 'react';

export interface StreamResponseResult {
    text: string;
    actions: string[];
    isTyping: boolean;
    fullText: string;
    handleStreamResponse?: (response: Response) => Promise<void>;
}

export interface UseStreamResponseOptions {
    enableTypingEffect?: boolean;
    typingSpeed?: number;
    extractActions?: boolean;
    onUpdate?: (data: { text: string; actions: string[]; isTyping: boolean; fullText: string }) => void;
    onInit?: () => void;
}

export const useStreamResponse = (
    streamResponse: Response | null | undefined,
    isActive: boolean,
    options: UseStreamResponseOptions = {}
): StreamResponseResult => {
    const {
        enableTypingEffect = false,
        typingSpeed = 50,
        extractActions = true,
        onUpdate,
        onInit
    } = options;

    const [text, setText] = useState('');
    const [actions, setActions] = useState<string[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [fullText, setFullText] = useState('');

    // 打字机效果相关 refs
    const typingBufferRef = useRef<string>('');
    const displayedTextRef = useRef<string>('');
    const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const extractedActionsRef = useRef<string[]>([]);
    
    // 流式处理相关 refs（用于避免重复追加）
    const accumulatedTextRef = useRef<string>('');
    const isProcessingRef = useRef<boolean>(false);

    // 清理打字机定时器
    const clearTypingTimer = useCallback(() => {
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
            typingTimerRef.current = null;
        }
    }, []);

    // 更新函数：统一处理状态更新和回调
    const updateData = useCallback((data: { text: string; actions: string[]; isTyping: boolean; fullText: string }) => {
        if (onUpdate) {
            // 回调模式
            onUpdate(data);
        } else {
            // 状态模式
            setText(data.text);
            setActions(data.actions);
            setIsTyping(data.isTyping);
            setFullText(data.fullText);
        }
    }, [onUpdate]);

    // 打字机效果：逐字符显示
    const startTyping = useCallback(() => {
        clearTypingTimer();

        const typeNextChar = () => {
            if (typingBufferRef.current.length > 0) {
                const char = typingBufferRef.current[0];
                typingBufferRef.current = typingBufferRef.current.slice(1);
                displayedTextRef.current += char;
                
                // 更新显示文本（去除 ACTION 部分）
                let displayText = displayedTextRef.current;
                if (extractActions && displayText.includes('[ACTION:')) {
                    displayText = displayText.slice(0, displayText.indexOf('[ACTION:')).trim();
                }

                updateData({
                    text: displayText,
                    actions: extractedActionsRef.current,
                    isTyping: true,
                    fullText: accumulatedTextRef.current
                });
            } else {
                clearTypingTimer();
                // 最终显示文本（去除 ACTION 部分）
                let finalDisplayText = displayedTextRef.current;
                if (extractActions && finalDisplayText.includes('[ACTION:')) {
                    finalDisplayText = finalDisplayText.slice(0, finalDisplayText.indexOf('[ACTION:')).trim();
                }
                
                updateData({
                    text: finalDisplayText,
                    actions: extractedActionsRef.current,
                    isTyping: false,
                    fullText: accumulatedTextRef.current
                });
            }
        };

        typingTimerRef.current = setInterval(typeNextChar, typingSpeed);
    }, [typingSpeed, clearTypingTimer, extractActions, updateData]);

    // 处理流式响应（核心逻辑）
    const handleStreamResponse = useCallback(async (response: Response) => {
        if (isProcessingRef.current) {
            console.warn('流式处理已在进行中，跳过重复请求');
            return;
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) return;

        // 标记为正在处理
        isProcessingRef.current = true;

        // 重置状态
        accumulatedTextRef.current = '';
        displayedTextRef.current = '';
        typingBufferRef.current = '';
        extractedActionsRef.current = [];

        // 调用初始化回调
        if (onInit) {
            onInit();
        }

        // 初始化状态
        updateData({
            text: '',
            actions: [],
            isTyping: true,
            fullText: ''
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const segments = buffer.split(/\r?\n/);
                buffer = segments.pop() || '';

                for (const segment of segments) {
                    const line = segment.trim();
                    if (!line) continue;

                    const cleaned = line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line;

                    try {
                        const json = JSON.parse(cleaned);

                        if (json.content) {
                            const chunk = json.content;
                            // 累积完整文本（不重复追加）
                            accumulatedTextRef.current += chunk;

                            // 检测并提取 ACTION
                            let displayText = accumulatedTextRef.current;
                            let hasAction = false;

                            if (extractActions && accumulatedTextRef.current.includes('[ACTION:')) {
                                hasAction = true;
                                displayText = accumulatedTextRef.current.slice(0, accumulatedTextRef.current.indexOf('[ACTION:'));
                                
                                // 提取所有 ACTION
                                const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                                let match;
                                const newActions: string[] = [];

                                while ((match = actionRegex.exec(accumulatedTextRef.current)) !== null) {
                                    const actionText = match[1].trim();
                                    if (!extractedActionsRef.current.includes(actionText) && !newActions.includes(actionText)) {
                                        newActions.push(actionText);
                                    }
                                }

                                if (newActions.length > 0) {
                                    extractedActionsRef.current = [...extractedActionsRef.current, ...newActions];
                                }
                            }

                            const finalDisplayText = displayText.trim();

                            if (enableTypingEffect) {
                                // 打字机模式：只添加新增的文本部分到缓冲区
                                // 注意：displayedTextRef.current 跟踪的是原始累积文本（可能包含 ACTION）
                                // 我们需要基于原始累积文本计算新增部分
                                const currentAccumulatedLength = displayedTextRef.current.length;
                                const newText = accumulatedTextRef.current.slice(currentAccumulatedLength);
                                
                                if (newText.length > 0) {
                                    // 将新增的原始文本添加到缓冲区
                                    typingBufferRef.current += newText;
                                    // 更新 displayedTextRef 为当前累积的原始文本（用于下次计算）
                                    displayedTextRef.current = accumulatedTextRef.current;
                                    
                                    if (!typingTimerRef.current) {
                                        startTyping();
                                    }
                                }
                            } else {
                                // 实时模式：立即更新（和 DialogueModal 一样，使用 fullText 累积）
                                updateData({
                                    text: finalDisplayText,
                                    actions: extractedActionsRef.current,
                                    isTyping: !hasAction, // 有 ACTION 时停止打字效果
                                    fullText: accumulatedTextRef.current
                                });
                            }
                        }
                    } catch {
                        // 解析不完整时忽略
                    }
                }
            }
        } finally {
            // 流结束时，最终处理
            if (extractActions && accumulatedTextRef.current.includes('[ACTION:')) {
                const textBeforeAction = accumulatedTextRef.current.slice(0, accumulatedTextRef.current.indexOf('[ACTION:'));
                const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                let match;
                const finalActions: string[] = [];

                while ((match = actionRegex.exec(accumulatedTextRef.current)) !== null) {
                    const actionText = match[1].trim();
                    if (!finalActions.includes(actionText)) {
                        finalActions.push(actionText);
                    }
                }

                extractedActionsRef.current = finalActions;
                const displayText = textBeforeAction.trim();

                if (enableTypingEffect) {
                    // 打字机模式：确保所有文本都在缓冲区中
                    // 计算剩余未添加到缓冲区的原始文本
                    const remainingText = accumulatedTextRef.current.slice(displayedTextRef.current.length);
                    if (remainingText.length > 0) {
                        typingBufferRef.current += remainingText;
                        displayedTextRef.current = accumulatedTextRef.current;
                        if (!typingTimerRef.current) {
                            startTyping();
                        }
                    }
                    // 等待缓冲区内容全部显示完
                    const waitForTyping = () => {
                        if (typingBufferRef.current.length > 0) {
                            setTimeout(waitForTyping, 100);
                        } else {
                            // 最终显示文本（去除 ACTION）
                            let finalDisplayText = displayedTextRef.current;
                            if (extractActions && finalDisplayText.includes('[ACTION:')) {
                                finalDisplayText = finalDisplayText.slice(0, finalDisplayText.indexOf('[ACTION:')).trim();
                            }
                            
                            updateData({
                                text: finalDisplayText,
                                actions: finalActions,
                                isTyping: false,
                                fullText: accumulatedTextRef.current
                            });
                        }
                    };
                    waitForTyping();
                } else {
                    // 实时模式
                    updateData({
                        text: displayText,
                        actions: finalActions,
                        isTyping: false,
                        fullText: accumulatedTextRef.current
                    });
                }
            } else {
                if (enableTypingEffect) {
                    // 等待缓冲区内容全部显示完
                    const waitForTyping = () => {
                        if (typingBufferRef.current.length > 0) {
                            setTimeout(waitForTyping, 100);
                        } else {
                            // 最终显示文本（去除 ACTION）
                            let finalDisplayText = displayedTextRef.current;
                            if (extractActions && finalDisplayText.includes('[ACTION:')) {
                                finalDisplayText = finalDisplayText.slice(0, finalDisplayText.indexOf('[ACTION:')).trim();
                            }
                            
                            updateData({
                                text: finalDisplayText,
                                actions: extractedActionsRef.current,
                                isTyping: false,
                                fullText: accumulatedTextRef.current
                            });
                        }
                    };
                    waitForTyping();
                } else {
                    updateData({
                        text: accumulatedTextRef.current.trim(),
                        actions: extractedActionsRef.current,
                        isTyping: false,
                        fullText: accumulatedTextRef.current
                    });
                }
            }

            // 标记处理完成
            isProcessingRef.current = false;
        }
    }, [enableTypingEffect, extractActions, startTyping, updateData, onInit]);

    // 状态模式：当 streamResponse 变化时自动处理
    useEffect(() => {
        if (!onUpdate && isActive && streamResponse) {
            // 如果正在处理旧的流，先停止并重置
            if (isProcessingRef.current) {
                console.log('⚠️ 检测到新的 streamResponse，停止旧的处理');
                clearTypingTimer();
                accumulatedTextRef.current = '';
                displayedTextRef.current = '';
                typingBufferRef.current = '';
                extractedActionsRef.current = [];
                isProcessingRef.current = false;
                // 重置显示状态
                setText('');
                setActions([]);
                setIsTyping(false);
                setFullText('');
            }
            
            // 处理新的流
            handleStreamResponse(streamResponse);
        }

        // 清理函数
        return () => {
            clearTypingTimer();
            if (!isActive) {
                // 重置状态
                accumulatedTextRef.current = '';
                displayedTextRef.current = '';
                typingBufferRef.current = '';
                extractedActionsRef.current = [];
                isProcessingRef.current = false;
                
                if (!onUpdate) {
                    // 只在状态模式下重置状态
                    setText('');
                    setActions([]);
                    setIsTyping(false);
                    setFullText('');
                }
            }
        };
    }, [isActive, streamResponse, handleStreamResponse, clearTypingTimer, onUpdate]);

    return {
        text,
        actions,
        isTyping,
        fullText,
        handleStreamResponse: onUpdate ? handleStreamResponse : undefined // 回调模式才返回函数
    };
};
