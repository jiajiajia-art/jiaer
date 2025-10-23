import { useState } from 'react';

export interface ChatMessage {
    type: 'user' | 'system';
    text: string;
}

export const useChat = () => {
    const [chatOpen, setChatOpen] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
        { type: 'system', text: '欢迎来到游戏世界！' },
    ]);
    const [currentChatNpc, setCurrentChatNpc] = useState<any | null>(null);

    const sendChat = () => {
        const text = chatInput.trim();
        if (!text) return;
        setChatMessages((msgs) => [...msgs, { type: 'user', text }]);
        setChatInput('');
        setTimeout(() => {
            if (currentChatNpc) {
                const npcName = currentChatNpc.name || 'NPC';
                setChatMessages((msgs) => [...msgs, { type: 'system', text: `${npcName}: "我明白了，让我想想..."` }]);
            } else {
                setChatMessages((msgs) => [...msgs, { type: 'system', text: '收到您的消息：' + text }]);
            }
        }, 500);
    };

    const handleStartChatWithNpc = (npc: any) => {
        setCurrentChatNpc(npc);
        setChatOpen(true);
        // 系统提示：开始与 NPC 对话
        setChatMessages((msgs) => [...msgs, { type: 'system', text: `━━━ 开始与 ${npc.name}${npc.job || npc.type ? `（${npc.job || npc.type}）` : ''} 对话 ━━━` }]);
        // NPC 开场白（随机）
        setTimeout(() => {
            const greetings = [
                `${npc.name}: "你好，冒险者！有什么我可以帮助你的吗？"`,
                `${npc.name}: "欢迎！很高兴见到你。"`,
                `${npc.name}: "你找我有什么事吗？"`,
                `${npc.name}: "看起来你是个有趣的冒险者。"`
            ];
            const greet = greetings[Math.floor(Math.random() * greetings.length)];
            setChatMessages((msgs) => [...msgs, { type: 'system', text: greet }]);
        }, 500);
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
        sendChat,
        handleStartChatWithNpc
    };
};
