import { useState } from 'react';
import { HOST_ADDRESS } from '../config';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    isTyping?: boolean;
}

export const useChat = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    ]);
    const [currentChatNpc, setCurrentChatNpc] = useState<any | null>(null);

    const handleStartChatWithNpc = (npc: any) => {
        setCurrentChatNpc(npc);
        setChatOpen(true);
    };

    const chatWithNpc = async (sessionId: string, npc: any, text: string) => {
        // 先添加用户消息到聊天列表
        setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'user', text }]);

        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/npc-chat/${sessionId}/${npc.id}/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text
                })
            });

            if (response.ok) {
                // 先添加一条空的NPC消息，用于流式输出
                setChatMessages((prev: ChatMessage[]) => [...prev, { role: 'assistant', text: '', isTyping: true }]);

                // 处理流式输出
                const reader = response.body?.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n').filter(line => line.trim());

                        for (const line of lines) {
                            const cleaned = line.startsWith('data:') ? line.replace(/^data:\s*/, '') : line;

                            try {
                                const json = JSON.parse(cleaned);
                                console.log('流式数据:', json);

                                if (json.type === 'chunk' && json.content) {
                                    fullText += json.content;
                                    // 实时更新最后一条系统消息
                                    setChatMessages((prev: ChatMessage[]) => {
                                        const updated = [...prev];
                                        const last = updated[updated.length - 1];
                                        if (last && last.role === 'assistant') {
                                            updated[updated.length - 1] = { ...last, text: fullText, isTyping: true };
                                        }
                                        return updated;
                                    });
                                }
                            } catch (e) {
                                console.warn('解析JSON失败:', cleaned);
                            }
                        }
                    }

                    // 流结束时关闭打字效果
                    setChatMessages((prev: ChatMessage[]) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last && last.role === 'assistant') {
                            updated[updated.length - 1] = { ...last, isTyping: false };
                        }
                        return updated;
                    });
                }
            } else {
                console.error('Failed to chat with NPC:', response.statusText);
                alert('发送消息失败，请重试');
            }
        } catch (error) {
            console.error('Failed to chat with NPC:', error);
            alert('发送消息时发生错误');
        }
    };

    const loadChatHistory = async (sessionId: string, npc: any) => {
        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/npc-chat/${sessionId}/${npc.id}/history`, {
                method: 'GET',
            });
            if (response.ok) {
                const data = await response.json();
                // 确保后端返回的是数组格式
                if (Array.isArray(data.history)) {
                    console.log('聊天历史数据:', data.history);
                    setChatMessages(data.history.map((item: any) => ({ role: item.role, text: item.content })));
                    if (data.history.length === 0) {
                        setChatMessages((msgs) => [...msgs, { role: 'assistant', text: '欢迎来到游戏世界！' },
                            { role: 'assistant', text: `━━━ 开始与 ${npc.name}${npc.job || npc.role ? `（${npc.job || npc.role}）` : ''} 对话 ━━━` }
                        ]);
                    }
                }
            } else {
                console.error('Failed to load chat history:', response.statusText);
                // 不显示 alert，直接初始化空消息
                setChatMessages([]);
            }
        } catch (error) {
            console.error('加载聊天历史错误:', error);
            setChatMessages([]);
        }
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
