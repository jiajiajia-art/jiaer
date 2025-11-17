import { useState, useCallback, useEffect, useRef } from 'react';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import type { NPC } from '../api/game/gameData';
import { useStreamResponse } from './useStreamResponse';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    isTyping?: boolean;
}

// 内部使用的消息格式（适配 useStreamResponse）
interface InternalMessage {
    type: 'system' | 'user';
    text: string;
    isTyping: boolean;
    isMarkdown?: boolean;
    actions?: string[];
    role?: 'user' | 'assistant'; // 保留 role 用于转换
}

export const useChat = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]); // 当前对话的消息（本轮）
    const [currentChatNpc, setCurrentChatNpc] = useState<NPC | null>(null);
    
    // 内部消息状态（用于 useStreamResponse）
    const [internalMessages, setInternalMessages] = useState<InternalMessage[]>([]);
    // 保存用户消息，避免在同步时丢失
    const userMessagesRef = useRef<ChatMessage[]>([]);

    // 将 InternalMessage 转换为 ChatMessage
    const convertToChatMessage = useCallback((msg: InternalMessage): ChatMessage => {
        return {
            role: msg.role || (msg.type === 'user' ? 'user' : 'assistant'),
            text: msg.text,
            isTyping: msg.isTyping
        };
    }, []);

    // 创建适配的 setMessages 函数，用于 useStreamResponse
    const setMessagesAdapter = useCallback((updater: React.SetStateAction<InternalMessage[]>) => {
        setInternalMessages((prev) => {
            const newMessages = typeof updater === 'function' ? updater(prev) : updater;
            // 确保每条消息都有 role
            const messagesWithRole = newMessages.map(msg => ({
                ...msg,
                role: msg.role || (msg.type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant'
            }));
            return messagesWithRole;
        });
    }, []);

    // 使用 useStreamResponse hook
    const { handleStreamResponse } = useStreamResponse({
        setMessages: setMessagesAdapter,
        initialMessage: { type: 'system', isMarkdown: true }
    });

    // 当 internalMessages 更新时，同步更新 chatMessages
    useEffect(() => {
        // 只在 internalMessages 有内容时才同步（避免清空静态消息）
        if (internalMessages.length === 0) {
            return;
        }
        
        setChatMessages((prev) => {
            // 保留所有用户消息
            const userMessages = prev.filter(msg => msg.role === 'user');
            userMessagesRef.current = userMessages;
            
            // 保留所有非流式输出的 assistant 消息（如问候消息）
            // 这些消息的 isTyping 为 undefined 或 false，且不是从 internalMessages 来的
            const staticAssistantMessages = prev.filter(msg => 
                msg.role === 'assistant' && 
                (msg.isTyping === undefined || msg.isTyping === false) &&
                !internalMessages.some(internal => 
                    internal.text === msg.text && 
                    internal.role === 'assistant'
                )
            );
            
            // 将 internalMessages 转换为 ChatMessage 并追加
            const streamAssistantMessages = internalMessages.map(convertToChatMessage);
            
            return [...userMessages, ...staticAssistantMessages, ...streamAssistantMessages];
        });
    }, [internalMessages, convertToChatMessage]);

    const handleStartChatWithNpc = (npc: any) => {
        setCurrentChatNpc(npc);
        setChatOpen(true);
        // 开始新对话时，清空当前对话消息
        setChatMessages([]);
        setInternalMessages([]);
        userMessagesRef.current = [];
    };

    const chatWithNpc = useCallback(async (sessionId: string, npc: any, text: string) => {
        // 先添加用户消息到聊天列表
        const userMessage: ChatMessage = { role: 'user', text };
        setChatMessages((prev: ChatMessage[]) => [...prev, userMessage]);
        userMessagesRef.current = [...userMessagesRef.current, userMessage];
        
        // 清空之前的 assistant 消息，准备接收新的流式响应
        setInternalMessages([]);

        try {
            const response = await authFetch(`${HOST_ADDRESS}/api/backend/npc-chat/${sessionId}/${npc.id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text
                })
            });

            if (response.ok) {
                // 使用 useStreamResponse 处理流式输出
                // internalMessages 会通过 useEffect 自动同步到 chatMessages
                await handleStreamResponse(response);
            } else {
                console.error('Failed to chat with NPC:', response.statusText);
                alert('发送消息失败，请重试');
            }
        } catch (error) {
            console.error('Failed to chat with NPC:', error);
            alert('发送消息时发生错误');
        }
    }, [handleStreamResponse]);

    const loadChatHistory = async (sessionId: string, npc: any): Promise<ChatMessage[]> => {
        try {
            const response = await authFetch(`${HOST_ADDRESS}/api/backend/npc-chat/${sessionId}/${npc.id}/history`, {
                method: 'GET',
            });
            if (response.ok) {
                const data = await response.json();
                // 确保后端返回的是数组格式
                if (Array.isArray(data.history)) {
                    // console.log('聊天历史数据:', data.history);
                    const historyMessages = data.history.map((item: any) => ({ 
                        role: item.role, 
                        text: item.content 
                    }));
                    
                    // 如果历史为空，添加欢迎消息
                    if (historyMessages.length === 0) {
                        return [
                            { role: 'assistant', text: '欢迎来到游戏世界！' },
                            { role: 'assistant', text: `━━━ 开始与 ${npc.name}${npc.job || npc.role ? `（${npc.job || npc.role}）` : ''} 对话 ━━━` }
                        ];
                    }
                    
                    return historyMessages;
                }
            } else {
                console.error('Failed to load chat history:', response.statusText);
                return [];
            }
        } catch (error) {
            console.error('加载聊天历史错误:', error);
            return [];
        }
        return [];
    };

    return {
        chatOpen,
        setChatOpen,
        chatInput,
        setChatInput,
        chatMessages,
        setChatMessages,
        currentChatNpc,
        setCurrentChatNpc,
        handleStartChatWithNpc,
        chatWithNpc,
        loadChatHistory
    };
};
