import React, { useState, useRef, useEffect } from 'react';
import styles from './DialogueModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';
import ReactMarkdown from 'react-markdown';
import ChatHistory, { type ChatMessage } from './ChatHistory';
import PlayerFloatingPanel from './PlayerFloatingPanel';
import type { Item } from '../../hooks/useGameData';
import type { PlayerState, InventoryState, EquipmentSlots } from '../../hooks/useGameData';
import InventoryFloatingPanel from './InventoryFloatingPanel';

interface DialogueModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    playerName?: string;
    initialInput?: string; // 初始输入值
    player?: PlayerState | null;
    inventory?: InventoryState | null;
    onEquipItem?: (item: Item, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: Item) => void;
}

const DialogueModal: React.FC<DialogueModalProps> = ({
    isOpen,
    onClose,
    playerName = '玩家',
    initialInput = '',
    player = null,
    inventory = null,
    onEquipItem,
    onUseItem
}) => {
    const [gameStarted, setGameStarted] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(true);
    const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    // 当 initialInput 变化时，更新 inputValue
    useEffect(() => {
        if (initialInput && isOpen) {
            setInputValue(initialInput);
        }
    }, [initialInput, isOpen]);
    const [messages, setMessages] = useState<
        Array<{
            type: 'system' | 'user';
            text: string;
            isTyping?: boolean;
            isMarkdown?: boolean;
            actions?: string[];
        }>
    >([{ type: 'system', text: `欢迎来到游戏世界，${playerName}！` }]);

    const sessionId = useGameStore((state) => state.sessionId);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // 计算最新的 system 消息（用于滚动效果）
    const systemMessages = messages.filter(m => m.type === 'system');
    const latestSystemMessage = systemMessages.length > 0
        ? systemMessages[systemMessages.length - 1]
        : null;

    // 当最新的 system 消息变化时自动滚动
    useEffect(() => {
        if (latestSystemMessage && messagesEndRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [latestSystemMessage]);

    // 加载历史记录（从后端获取）
    const loadHistoryMessages = React.useCallback(async () => {
        if (!sessionId) {
            console.warn('没有 sessionId，无法加载历史记录');
            return;
        }

        try {
            setLoadingHistory(true);
            const response = await fetch(`${HOST_ADDRESS}/api/backend/history/${sessionId}`);

            if (response.ok) {
                const data = await response.json();
                // 后端返回格式：{ history: [{ message: string, timestamp: string, type: "player" | "game" }] }
                const historyArray = data.history || [];

                // 转换为 ChatMessage 格式
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
            } else {
                setHistoryMessages([]);
            }
        } catch (error) {
            console.error('❌ 历史记录加载错误:', error);
            setHistoryMessages([]);
        } finally {
            setLoadingHistory(false);
        }
    }, [sessionId]);

    // 当历史记录弹窗打开时加载历史记录
    useEffect(() => {
        if (showHistory && sessionId) {
            loadHistoryMessages();
        }
    }, [showHistory, sessionId, loadHistoryMessages]);

    // 当 AI 流式输出完成时刷新历史记录
    const prevIsTypingRef = useRef<boolean | undefined>(undefined);
    const isStreamingRef = useRef(false);
    const currentIsTyping = latestSystemMessage?.isTyping ?? false;

    useEffect(() => {
        const prevIsTyping = prevIsTypingRef.current;

        // 开始流式输出
        if (currentIsTyping === true && prevIsTyping !== true) {
            isStreamingRef.current = true;
        }

        // 流式输出完成：从 true 变为 false
        if (prevIsTyping === true && currentIsTyping === false && isStreamingRef.current && showHistory) {
            isStreamingRef.current = false;
            // 延迟刷新，确保后端已保存新消息
            const timer = setTimeout(() => {
                loadHistoryMessages();
            }, 800);
            prevIsTypingRef.current = currentIsTyping;
            return () => clearTimeout(timer);
        }

        // 更新 ref
        if (prevIsTyping !== currentIsTyping) {
            prevIsTypingRef.current = currentIsTyping;
        }
    }, [currentIsTyping, showHistory, loadHistoryMessages]);

    // 🔹 改进后的流式响应解析（支持实时 ACTION 提取）
    const handleStreamResponse = async (response: Response) => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let actions: string[] = [];

        if (!reader) return;

        // 添加初始“打字中”提示
        setMessages((prev) => [
            ...prev,
            { type: 'system', text: '', isTyping: true, isMarkdown: true, actions: [] }
        ]);

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
                        fullText += chunk;

                        // ✅ 检测 ACTION
                        if (fullText.includes('[ACTION:')) {
                            const textBeforeAction = fullText.slice(0, fullText.indexOf('[ACTION:'));
                            const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                            let match;
                            const newActions: string[] = [];

                            while ((match = actionRegex.exec(fullText)) !== null) {
                                const actionText = match[1].trim();
                                if (!actions.includes(actionText)) {
                                    newActions.push(actionText);
                                }
                            }

                            if (newActions.length > 0) {
                                actions = [...actions, ...newActions];
                            }

                            // ✅ 更新消息（不再要求 isTyping 必须为 true）
                            setMessages((prev) => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last) {
                                    const newMessage = {
                                        ...last,
                                        text: textBeforeAction.trim(),
                                        isTyping: false,
                                        actions: actions.length > 0 ? [...actions] : undefined
                                    };
                                    updated[updated.length - 1] = newMessage;
                                    return [...updated];
                                }
                                return prev;
                            });


                        } else {
                            // 🔹 没有 ACTION 时持续更新文字
                            setMessages((prev) => {
                                const updated = [...prev];
                                const last = updated[updated.length - 1];
                                if (last && last.isTyping) {
                                    updated[updated.length - 1] = {
                                        ...last,
                                        text: fullText.trim(),
                                    };
                                    return [...updated];
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

        // 🔹 流结束时，关闭打字效果
        setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
                updated[updated.length - 1] = {
                    ...last,
                    isTyping: false
                };
                return [...updated];
            }
            return updated;
        });
    };

    const handleStartGame = async () => {
        if (!sessionId) {
            setMessages((prev) => [
                ...prev,
                { type: 'system', text: '没有 sessionId，无法开始游戏...' }
            ]);
            return;
        }

        try {
            setLoading(true);
            setMessages((prev) => [...prev, { type: 'system', text: '正在开始游戏...' }]);

            const response = await fetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/stream/action-live`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: '开始游戏' })
                }
            );

            if (response.ok) {
                setGameStarted(true);
                await handleStreamResponse(response);
            } else {
                console.error('❌ 游戏开始失败:', response.statusText);
                setMessages((prev) => [
                    ...prev,
                    { type: 'system', text: '游戏开始失败，请重试...' }
                ]);
            }
        } catch (error) {
            console.error('❌ 游戏开始错误:', error);
            setMessages((prev) => [
                ...prev,
                { type: 'system', text: '游戏开始错误，请重试...' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async (actionText?: string) => {
        const text = actionText || inputValue.trim();
        if (!text || !sessionId) return;

        setMessages((prev) => [...prev, { type: 'user', text }]);
        setInputValue('');

        try {
            setLoading(true);
            const response = await fetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/stream/action-live`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: text })
                }
            );

            if (response.ok) {
                await handleStreamResponse(response);
            } else {
                console.error('❌ 消息发送失败:', response.statusText);
            }
        } catch (error) {
            console.error('❌ 消息发送错误:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!gameStarted) handleStartGame();
            else handleSend();
        }
    };

    if (!isOpen) return null;

    // const handleGenerate = async () => {
    //     const response = await fetch(`${HOST_ADDRESS}/api/backend/novel/generate`, {
    //         method: 'POST',
    //         body: JSON.stringify({ 
    //             sessionId: sessionId,
    //             fileId: pdfFileId,
    //             title: title,
    //             theme: 'adventure',
    //             chapterCount: 5,
    //             style: 'classic',
    //         })
    //     });
    //     if (!response.ok) {
    //         console.error('❌ 小说生成失败:', response.statusText);
    //         return;
    //     }
    //     const data = await response.json();
    //     console.log('✅ 小说生成成功:', data);
    // };


    // 历史记录只使用从后端加载的数据
    const historyMessagesData: ChatMessage[] = historyMessages;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src="/data/asset/对话界面/时间暂停按钮.png" alt="关闭" />
                </button>
                {/* 左侧：历史记录 */}
                <div className={styles.leftPanel}>
                    {showHistory && (
                        <ChatHistory
                            isOpen={showHistory}
                            chatMessages={historyMessagesData}
                            loading={loadingHistory}
                        />
                    )}
                </div>

                {/* 中间：编年纪事对话 - 只显示最新一条 AI 回复 */}
                <div className={styles.dialogueModal}>
                    <div className={styles.modalHeader}>
                        <button className={styles.historyBtn} onClick={() => setShowHistory(!showHistory)}>
                            <img src="/data/asset/对话界面/历史对话图标.png" alt="关闭" />
                        </button>
                    </div>

                    <div className={styles.messagesContainer}>
                        {/* 只显示最新的一条 system 消息 */}
                        {!latestSystemMessage ? (
                            <div className={styles.emptyMessage}>
                                <p>欢迎来到游戏世界，{playerName}！</p>
                                <p className={styles.hintText}>点击历史记录图标查看聊天记录</p>
                            </div>
                        ) : (
                            <div className={`${styles.message} ${styles.system}`}>
                                {latestSystemMessage.isMarkdown ? (
                                    <ReactMarkdown>{latestSystemMessage.text}</ReactMarkdown>
                                ) : (
                                    latestSystemMessage.text
                                )}
                                {latestSystemMessage.isTyping && <span className={styles.cursor}>|</span>}

                                {/* 🔹 动作按钮区 */}
                                {latestSystemMessage.actions && latestSystemMessage.actions.length > 0 && (
                                    <div className={styles.actionButtons}>
                                        {latestSystemMessage.actions.map((action, i) => (
                                            <button
                                                key={i}
                                                className={styles.actionBtn}
                                                onClick={() => handleSend(action)}
                                                disabled={loading}
                                            >
                                                {action}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {!gameStarted ? (
                        <div className={styles.startGameContainer}>
                            <button
                                className={styles.startGameBtn}
                                onClick={handleStartGame}
                                disabled={loading}
                            >
                                <img src="/data/asset/编年史/按钮.png" alt="开始游戏" />
                            </button>
                        </div>
                    ) : (
                        <div className={styles.inputContainer}>
                            <input
                                type="text"
                                className={styles.input}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={loading}
                            />
                            <button
                                className={styles.sendBtn}
                                onClick={() => handleSend()}
                                disabled={loading || !inputValue.trim()}
                            >
                                <img src="/data/asset/聊天框/按钮.png" alt="发送" />
                            </button>
                        </div>
                    )}
                </div>

                {/* 右侧：玩家信息和背包 */}
                <div className={styles.rightPanel}>
                    <div className={styles.playerPanelWrapper}>
                        <PlayerFloatingPanel
                            isOpen={true}
                            player={player}
                        />
                    </div>
                    <div className={styles.inventoryPanelWrapper}>
                        {inventory && onEquipItem && onUseItem && (
                            <InventoryFloatingPanel
                                isOpen={true}
                                inventory={inventory}
                                onEquipItem={onEquipItem}
                                onUseItem={onUseItem}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DialogueModal;
