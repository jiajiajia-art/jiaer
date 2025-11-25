import { useState, useRef, useCallback, useEffect } from 'react';
import { authFetch } from '../api/base';
import { HOST_ADDRESS } from '../config';
import type { ChatMessage } from '../components/Mian/ChatHistory';
import { cleanHistoryMessage, extractChoiceFromHistory } from '../utils/textUtils';
import type { MissionData } from '../api/game/missionApi.type';

interface UseStoryHistoryOptions {
    sessionId: string | null;
    missionData: MissionData | null;
    onGameStarted?: () => void;
    onChoiceDetected?: (choiceStep: any) => void;
    onMessageLoaded?: (message: any) => void;
}

export const useStoryHistory = ({
    sessionId,
    missionData,
    onGameStarted,
    onChoiceDetected,
    onMessageLoaded
}: UseStoryHistoryOptions) => {
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const hasLoadedInitialMessage = useRef(false);
    
    // 使用 ref 存储回调函数和 missionData，避免依赖项变化导致无限循环
    const missionDataRef = useRef(missionData);
    const onGameStartedRef = useRef(onGameStarted);
    const onChoiceDetectedRef = useRef(onChoiceDetected);
    const onMessageLoadedRef = useRef(onMessageLoaded);
    
    // 同步 ref 值
    useEffect(() => {
        missionDataRef.current = missionData;
        onGameStartedRef.current = onGameStarted;
        onChoiceDetectedRef.current = onChoiceDetected;
        onMessageLoadedRef.current = onMessageLoaded;
    }, [missionData, onGameStarted, onChoiceDetected, onMessageLoaded]);

    const loadHistoryMessages = useCallback(async (isInitialLoad = false) => {
        if (!sessionId) {
            console.warn('没有 sessionId，无法加载历史记录');
            return;
        }

        try {
            setLoadingHistory(true);
            const response = await authFetch(`${HOST_ADDRESS}/api/backend/history/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                const historyArray = data.history || [];

                const convertedMessages: ChatMessage[] = historyArray.map((item: {
                    message: string;
                    timestamp: string;
                    type: 'player' | 'game';
                }) => ({
                    role: item.type === 'player' ? 'user' : 'assistant',
                    text: item.message || '',
                    isTyping: false
                }));

                setHistoryMessages(convertedMessages);

                if (convertedMessages.length > 0) {
                    onGameStartedRef.current?.();

                    if (isInitialLoad && !hasLoadedInitialMessage.current) {
                        const lastMessage = convertedMessages[convertedMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            let processedText = lastMessage.text || '';

                            // 提取 ACTION
                            const actions: string[] = [];
                            if (processedText.includes('[ACTION:')) {
                                const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                                let match;
                                while ((match = actionRegex.exec(processedText)) !== null) {
                                    const actionText = match[1].trim();
                                    if (actionText && !actions.includes(actionText)) {
                                        actions.push(actionText);
                                    }
                                }
                                processedText = processedText.replace(/\[ACTION:\s*.*?\]/g, '').trim();
                            }

                            const hasActiveMissions = missionDataRef.current?.activeMissions && missionDataRef.current.activeMissions.length > 0;
                            const choiceData = extractChoiceFromHistory(processedText);

                            if (choiceData && choiceData.options.length > 0 && !hasActiveMissions) {
                                const virtualChoiceStep = {
                                    id: 'history_choice',
                                    type: 'choice',
                                    title: choiceData.title || '',
                                    text: choiceData.text || '',
                                    options: choiceData.options.map((opt, idx) => ({
                                        text: opt,
                                        nextId: `history_choice_${idx}`
                                    }))
                                };
                                onChoiceDetectedRef.current?.(virtualChoiceStep);
                            } else if (!hasActiveMissions) {
                                const { cleanedText, options: extractedOptions } = cleanHistoryMessage(processedText);
                                if (cleanedText || extractedOptions.length > 0) {
                                    onMessageLoadedRef.current?.({
                                        type: 'system',
                                        text: cleanedText,
                                        isTyping: false,
                                        isMarkdown: true,
                                        actions: actions.length > 0 ? actions : undefined,
                                        options: extractedOptions.length > 0 ? extractedOptions : undefined
                                    });
                                }
                            }
                            hasLoadedInitialMessage.current = true;
                        }
                    }
                } else if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    hasLoadedInitialMessage.current = true;
                }
            } else {
                setHistoryMessages([]);
                if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    hasLoadedInitialMessage.current = true;
                }
            }
        } catch (error) {
            console.error('❌ 历史记录加载错误:', error);
            setHistoryMessages([]);
            if (isInitialLoad && !hasLoadedInitialMessage.current) {
                hasLoadedInitialMessage.current = true;
            }
        } finally {
            setLoadingHistory(false);
        }
    }, [sessionId]);

    const resetInitialLoad = useCallback(() => {
        hasLoadedInitialMessage.current = false;
    }, []);

    return {
        historyMessages,
        loadingHistory,
        loadHistoryMessages,
        resetInitialLoad
    };
};

