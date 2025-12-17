import React, { useEffect, useRef } from 'react';
import styles from './ChatHistory.module.css';
import ReactMarkdown from 'react-markdown';
import { cleanTextOnly } from '../../utils/textUtils';
import historyApi from '../../api/rpgGame/history';
import { useGameStore } from '../../store/gameStore';
import { FaFileExport } from 'react-icons/fa';

export interface ChatMessage {
    role: 'user' | 'assistant';
    text: string;
    isTyping?: boolean;
}

interface ChatHistoryProps {
    isOpen: boolean;
    onClose?: () => void;
    chatMessages: ChatMessage[];
    title?: string;
    npc?: {
        id?: string;
        name?: string;
        icon?: string;
        avatar?: string;
        [key: string]: any;
    } | null;
    loading?: boolean;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({
    isOpen,
    onClose,
    chatMessages,
    loading = false
}) => {
    const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);
    const { sessionId } = useGameStore();

    // 自动滚动到底部的函数
    const scrollToBottom = () => {
        if (chatMessagesContainerRef.current) {
            chatMessagesContainerRef.current.scrollTop = chatMessagesContainerRef.current.scrollHeight;
        }
    };

    // 当聊天消息变化时自动滚动
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // 当聊天面板打开时也滚动到底部
    useEffect(() => {
        if (isOpen) {
            // 稍微延迟确保DOM已经更新
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleExportChat = async () => {
        if (!sessionId) return;
    
        try {
            const response = await historyApi.getGameHistory(sessionId);

            const blob = new Blob([response.data]);
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `chat-history-${sessionId}.doc`;
            link.click();
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (error) {
            console.error('导出失败:', error);
        }
    };

    return (
        <div className={styles.chatHistory}>
            {onClose && (
                <div className={styles.chatHeader}>
                    <button className={styles.closeChatBtn} onClick={onClose}>
                        <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                    </button>
                </div>
            )}
            <button className={styles.exportChatBtn} onClick={handleExportChat}>
                <FaFileExport size={16} className={styles.exportChatIcon}/>
            </button>
            <div
                className={styles.chatMessages}
                ref={chatMessagesContainerRef}
            >
                {loading ? (
                    <div className={styles.loadingMessage}>加载历史记录中...</div>
                ) : chatMessages.length === 0 ? (
                    <div className={styles.emptyMessage}>暂无聊天记录</div>
                ) : (
                    <>
                        {chatMessages.map((m, i) => {
                            // 检测消息中是否包含 [ACTION 字段，如果包含则截断
                            let displayText = m.text;
                            const actionIndex = displayText.indexOf('[ACTION');
                            if (actionIndex !== -1) {
                                // 只显示 [ACTION 之前的内容
                                displayText = displayText.substring(0, actionIndex).trim();
                                // 如果截断后为空，则不显示这条消息
                                if (!displayText) {
                                    return null;
                                }
                            }
                            
                            // 清理标记文字（NARRATION, DIALOGUE, HINT, CHOICE, OPTION）
                            displayText = cleanTextOnly(displayText);
                            
                            // 如果清理后为空，则不显示这条消息
                            if (!displayText) {
                                return null;
                            }

                            // 适配角色类型：assistant (来自 type: 'game') 使用 system 样式
                            // user (来自 type: 'player') 使用 user 样式
                            const messageClass = m.role === 'assistant'
                                ? `${styles.chatMessage} ${styles.system}`
                                : `${styles.chatMessage} ${styles.user}`;

                            return (
                                <div key={i} className={messageClass}>
                                    <span className={styles.chatMessageWrapper}>
                                        <ReactMarkdown>{displayText}</ReactMarkdown>
                                        {m.isTyping && <span className={styles.typingCursor}>|</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </>
                )}
                {/* 添加一个不可见的锚点元素用于滚动 */}
                <div ref={chatMessagesEndRef} />
            </div>
        </div>
    );
};

export default ChatHistory;
