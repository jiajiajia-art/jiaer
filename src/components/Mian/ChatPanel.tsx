import React, { useEffect, useRef, useState } from 'react';
import styles from './ChatPanel.module.css';
import ChatHistory from './ChatHistory';
import ReactMarkdown from 'react-markdown';
import { HOST_ADDRESS } from '../../config';
import { useGameData } from '../../hooks/useGameData';
import type { NPC } from '../../api/game/gameData';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    isTyping?: boolean;
}

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    chatMessages: ChatMessage[]; // 当前对话的消息（本轮）
    chatInput: string;
    onInputChange: (value: string) => void;
    onSendMessage: (message: string) => void;
    onAddMessage?: (message: ChatMessage) => void; // 添加消息到聊天列表（用于显示问候消息等）
    title?: string;
    npc: NPC;
    sessionId?: string | null;
    onLoadHistory?: (sessionId: string, npc: any) => Promise<ChatMessage[]>; // 加载历史记录的函数
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    chatMessages,
    chatInput,
    onInputChange,
    onSendMessage,
    onAddMessage,
    npc,
    sessionId = null,
    onLoadHistory
}) => {
    const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const { getNewScene } = useGameData();
    const hasSentGreetingRef = useRef(false);
    const hasSentFirstMessageRef = useRef(false);
    const lastSentMessageRef = useRef<string | null>(null);

    useEffect(() => {
        if (isOpen && npc && npc.greetings && npc.greetings.length > 0 && !hasSentGreetingRef.current && onAddMessage) {
            hasSentGreetingRef.current = true;
            const randomIndex = Math.floor(Math.random() * npc.greetings.length);
            const greetingMessage = npc.greetings[randomIndex];
            onAddMessage({
                role: 'assistant',
                text: greetingMessage,
                isTyping: false
            });
        }
        if (!isOpen) {
            hasSentGreetingRef.current = false;
            hasSentFirstMessageRef.current = false;
            lastSentMessageRef.current = null;
        }
    }, [isOpen, npc, onAddMessage]);

    const scrollToBottom = () => {
        if (chatMessagesContainerRef.current) {
            chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
        }
    };

    // 加载历史记录的函数
    const loadHistoryMessages = React.useCallback(async () => {
        if (!onLoadHistory || !sessionId || !npc) return;

        setLoadingHistory(true);
        try {
            const history = await onLoadHistory(sessionId, npc);
            setHistoryMessages(history);
            
            // 如果历史记录为空且还没有发送过第一条消息，重置标记
            if (history.length === 0 && hasSentFirstMessageRef.current) {
                hasSentFirstMessageRef.current = false;
            }
        } catch (error) {
            console.error('加载历史失败:', error);
        } finally {
            setLoadingHistory(false);
        }
    }, [onLoadHistory, sessionId, npc]);

    const handleOpenHistory = React.useCallback(() => {
        setShowHistory(prev => !prev);
    }, []);

    // 当历史弹窗打开时加载历史记录
    useEffect(() => {
        if (showHistory) {
            loadHistoryMessages();
        }
    }, [showHistory, loadHistoryMessages]);

    // 当聊天消息变化时自动滚动（只关注 assistant 消息）
    useEffect(() => {
        const assistantMessages = chatMessages.filter(m => m.role === 'assistant');
        if (assistantMessages.length > 0) {
            scrollToBottom();
        }
    }, [chatMessages]);

    // 记录上一次的 isTyping 状态和消息数量，用于检测流式输出完成和消息发送
    const prevIsTypingRef = useRef<boolean | undefined>(undefined);
    const prevMessageCountRef = useRef(0);
    const isStreamingRef = useRef(false);
    const getNewSceneRef = useRef(getNewScene);
    
    // 保持 getNewScene 的最新引用
    useEffect(() => {
        getNewSceneRef.current = getNewScene;
    }, [getNewScene]);

    // 获取最新的 assistant 消息（用于检测流式输出状态）
    const assistantMessagesForTyping = chatMessages.filter(m => m.role === 'assistant');
    const latestAssistantMessageForTyping = assistantMessagesForTyping.length > 0
        ? assistantMessagesForTyping[assistantMessagesForTyping.length - 1]
        : null;
    const currentIsTyping = latestAssistantMessageForTyping?.isTyping ?? false;

    // 当用户发送消息或 AI 流式输出完成时，刷新历史记录
    useEffect(() => {
        const currentMessageCount = chatMessages.length;
        const prevIsTyping = prevIsTypingRef.current;

        // 1. 检测用户发送消息：消息数量增加且新增的是 user 消息
        if (showHistory && currentMessageCount > prevMessageCountRef.current) {
            const lastMessage = chatMessages[chatMessages.length - 1];
            if (lastMessage && lastMessage.role === 'user') {
                console.log('🔄 用户发送消息，刷新历史记录');
                loadHistoryMessages();
            }
        }

        // 2. 检测流式输出开始
        if (currentIsTyping === true && prevIsTyping !== true) {
            isStreamingRef.current = true;
        }

        // 3. 检测流式输出完成：从 typing 状态变为非 typing 状态
        if (prevIsTyping === true && currentIsTyping === false && isStreamingRef.current) {
            isStreamingRef.current = false;
            console.log('🔄 AI 流式输出完成，刷新场景数据和历史记录');
            // 立即刷新场景数据，使用 ref 避免依赖问题
            getNewSceneRef.current().catch(err => {
                console.warn('⚠️ 刷新场景数据失败:', err);
            });
            // 如果历史记录窗口打开，也刷新历史记录
            if (showHistory) {
                setTimeout(() => {
                    loadHistoryMessages();
                }, 800);
            }
        }

        // 更新 ref
        prevIsTypingRef.current = currentIsTyping;
        prevMessageCountRef.current = currentMessageCount;
    }, [chatMessages, showHistory, loadHistoryMessages, currentIsTyping]); // 移除 getNewScene 依赖

    // 当聊天面板打开时阻止页面滚动，关闭时恢复
    useEffect(() => {
        if (isOpen) {
            const originalBodyOverflow = document.body.style.overflow;
            const originalHtmlOverflow = document.documentElement.style.overflow;
            
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            
            setTimeout(() => {
                scrollToBottom();
            }, 100);
            
            return () => {
                document.body.style.overflow = originalBodyOverflow;
                document.documentElement.style.overflow = originalHtmlOverflow;
            };
        }
    }, [isOpen]);

    const handleSendMessage = React.useCallback((message: string) => {
        if (!message.trim()) return;

        const isFirstMessage = !hasSentFirstMessageRef.current;
        const isEmptyHistory = historyMessages.length === 0;

        // 发送消息
        onSendMessage(message);
        lastSentMessageRef.current = message;

        // 如果是第一条消息且历史记录为空，延迟后再次发送
        if (isFirstMessage && isEmptyHistory) {
            hasSentFirstMessageRef.current = true;
            console.log('📤 历史记录为空，第一条消息将自动发送两次');
            // 延迟一段时间后再次发送
            setTimeout(() => {
                console.log('📤 自动发送第二次消息');
                onSendMessage(message);
            }, 300);
        } else {
            hasSentFirstMessageRef.current = true;
        }
    }, [onSendMessage, historyMessages.length]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && chatInput.trim()) {
            handleSendMessage(chatInput);
        }
    };

    const handleSendClick = () => {
        if (chatInput.trim()) {
            handleSendMessage(chatInput);
        }
    };

    if (!isOpen) return null;

    // 只获取最新的 assistant 消息（过滤掉用户消息，只保留最后一条 assistant 回复）
    const assistantMessages = chatMessages.filter(m => m.role === 'assistant');
    const latestAssistantMessage = assistantMessages.length > 0
        ? assistantMessages[assistantMessages.length - 1]
        : null;

    return (
        <>
            <div className={styles.chatPanel}>
                <button className={styles.closeChatBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </button>
                <div className={styles.chatContent}>
                    {/* 左侧头像区域 - 显示NPC信息 */}
                    <div className={styles.avatarSection}>
                        {npc && (
                            <>
                                <div className={styles.relationShip}>
                                    {npc.relationships ?? 0}
                                </div>
                                <div className={styles.avatarFrame}>
                                    <img
                                        src={`${HOST_ADDRESS}${npc.icon}` || `${import.meta.env.BASE_URL}data/avatars/default.png`}
                                        alt={npc.name || 'NPC'}
                                        className={styles.avatarImage}
                                    />
                                    <div className={styles.avatarNameBox}>
                                        <span className={styles.avatarName}>{npc.name || 'NPC'}</span>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                    {/* 右侧对话区域 - 只显示最新一条 assistant 回复 */}
                    <div className={styles.dialogueSection}>
                        <div
                            className={styles.chatMessages}
                            ref={chatMessagesContainerRef}
                        >
                            {/* 只显示最新的一条 assistant 消息 */}
                            {!latestAssistantMessage ? (
                                <div className={styles.emptyMessage}>
                                    <p>正在与 {npc?.name || 'NPC'} 对话...</p>
                                    <p className={styles.hintText}>点击历史对话图标查看聊天记录</p>
                                </div>
                            ) : (
                                <div className={`${styles.chatMessage} ${styles.system}`}>
                                    <span className={styles.chatMessageWrapper}>
                                        <ReactMarkdown>{latestAssistantMessage.text}</ReactMarkdown>
                                        {latestAssistantMessage.isTyping && <span className={styles.typingCursor}>|</span>}
                                    </span>
                                </div>
                            )}
                            <div ref={chatMessagesEndRef} />
                        </div>
                        <div className={styles.chatInputArea}>
                            <img
                                src={`${import.meta.env.BASE_URL}data/asset/对话界面/历史对话图标.png`}
                                alt="历史对话"
                                className={styles.historyChatIcon}
                                onClick={handleOpenHistory}
                            />
                            <div className={styles.inputWrapper}>
                                <input
                                    type="text"
                                    className={styles.chatInput}
                                    value={chatInput}
                                    onChange={(e) => onInputChange(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入消息..."
                                />
                                <button
                                    className={styles.sendChatBtn}
                                    onClick={handleSendClick}
                                >
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className={styles.chatHistoryWrapper}>
                <ChatHistory
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    chatMessages={historyMessages} // ChatHistory显示从后端加载的完整历史（包括所有用户消息和assistant回复）
                    npc={npc}
                    loading={loadingHistory}
                />
            </div>

        </>
    );
};

export default ChatPanel;

