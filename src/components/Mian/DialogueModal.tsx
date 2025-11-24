import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import styles from './DialogueModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';
import ReactMarkdown from 'react-markdown';
import ChatHistory, { type ChatMessage } from './ChatHistory';
import PlayerFloatingPanel from './PlayerFloatingPanel';
import type { PlayerData, Inventory, InventoryItem } from '../../api/game/gameData';
import InventoryFloatingPanel from './InventoryFloatingPanel';
import { useGameData } from '../../hooks/useGameData';
import { authFetch } from '../../api/base';
import statisticsApi from '../../api/statistics/statisticsApi';
import MissionsModal from './MissionsModal';
import MissionApi from '../../api/game/missionApi';
import type { MissionData } from '../../api/game/missionApi.type';
import { useStreamResponse } from '../../hooks/useStreamResponse';
import { useAuthStore } from '../../store/useAuthStore';

// EquipmentSlots 类型定义（后端数据结构：equipment 存储的是物品ID字符串）
type EquipmentSlots = {
    head: string | null;
    body: string | null;
    legs: string | null;
    hands: string | null;
    feet: string | null;
    back: string | null;
    leftHand: string | null;
    rightHand: string | null;
};

// 常量定义
const DEFAULT_WELCOME_MESSAGE = (playerName: string) => `欢迎来到游戏世界，${playerName}！`;

interface DialogueModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    playerName?: string;
    initialInput?: string; // 初始输入值
    player?: PlayerData | null;
    inventory?: Inventory | null;
    onEquipItem?: (item: InventoryItem, slot: keyof EquipmentSlots) => void;
    onUseItem?: (item: InventoryItem) => void;
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
    const hasLoadedInitialMessage = useRef(false);
    const { getNewPlayer } = useGameData();
    const [missionData, setMissionData] = useState<MissionData | null>(null);
    const [loadingMissions, setLoadingMissions] = useState(false);
    const { user } = useAuthStore();

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
    >([]);

    const sessionId = useGameStore((state) => state.sessionId);
    const pdfFileId = useGameStore((state) => state.pdfFileId);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // 计算最新的 system 消息（用于滚动效果）
    const systemMessages = useMemo(() => 
        messages.filter(m => m.type === 'system'), 
        [messages]
    );
    const latestSystemMessage = useMemo(() => 
        systemMessages.length > 0 ? systemMessages[systemMessages.length - 1] : null,
        [systemMessages]
    );

    // 当最新的 system 消息变化时自动滚动
    useEffect(() => {
        if (latestSystemMessage && messagesEndRef.current) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, [latestSystemMessage]);

    // 加载历史记录（从后端获取）
    const loadHistoryMessages = React.useCallback(async (isInitialLoad = false) => {
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
                    setGameStarted(true);
                    
                    // 如果是初始加载且还没有加载过初始消息，加载最后一条历史记录作为初始消息
                    if (isInitialLoad && !hasLoadedInitialMessage.current) {
                        const lastMessage = convertedMessages[convertedMessages.length - 1];
                        if (lastMessage && lastMessage.role === 'assistant') {
                            // 简单提取 ACTION（用于历史记录显示）
                            let textWithoutAction = lastMessage.text || '';
                            const actions: string[] = [];
                            if (textWithoutAction.includes('[ACTION:')) {
                                const actionRegex = /\[ACTION:\s*(.*?)\]/g;
                                let match;
                                while ((match = actionRegex.exec(textWithoutAction)) !== null) {
                                    const actionText = match[1].trim();
                                    if (actionText && !actions.includes(actionText)) {
                                        actions.push(actionText);
                                    }
                                }
                                textWithoutAction = textWithoutAction.replace(/\[ACTION:\s*.*?\]/g, '').trim();
                            }
                            
                            setMessages([{
                                type: 'system',
                                text: textWithoutAction,
                                isTyping: false,
                                isMarkdown: true,
                                actions: actions.length > 0 ? actions : undefined
                            }]);
                            hasLoadedInitialMessage.current = true;
                        }
                    }
                } else if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    // 如果没有历史记录且是初始加载，显示默认欢迎消息
                    setMessages([{ type: 'system', text: DEFAULT_WELCOME_MESSAGE(playerName) }]);
                    hasLoadedInitialMessage.current = true;
                }
            } else {
                setHistoryMessages([]);
                // 如果加载失败且是初始加载，显示默认欢迎消息
                if (isInitialLoad && !hasLoadedInitialMessage.current) {
                    setMessages([{ type: 'system', text: DEFAULT_WELCOME_MESSAGE(playerName) }]);
                    hasLoadedInitialMessage.current = true;
                }
            }
        } catch (error) {
            console.error('❌ 历史记录加载错误:', error);
            setHistoryMessages([]);
            // 如果加载失败且是初始加载，显示默认欢迎消息
            if (isInitialLoad && !hasLoadedInitialMessage.current) {
                setMessages([{ type: 'system', text: DEFAULT_WELCOME_MESSAGE(playerName) }]);
                hasLoadedInitialMessage.current = true;
            }
        } finally {
            setLoadingHistory(false);
        }
    }, [sessionId, playerName]);

    // 获取任务列表
    const loadMissions = useCallback(async () => {        
        if (!sessionId) {
            return;
        }

        try {
            setLoadingMissions(true);
            const response = await MissionApi.getMissions(sessionId);
            if (response.data.success && response.data.data) {
                setMissionData(response.data.data);
                console.log(response.data.data);
            }
        } catch (error) {
            console.error('获取任务列表失败:', error);
        } finally {
            setLoadingMissions(false);
        }
    }, [sessionId]);

    // 当弹窗打开时，初始加载历史记录和任务列表
    useEffect(() => {
        if (isOpen && sessionId && !hasLoadedInitialMessage.current) {
            loadHistoryMessages(true);
            loadMissions();
        }
        // 当弹窗关闭时，重置标志，以便下次打开时可以重新加载
        if (!isOpen) {
            hasLoadedInitialMessage.current = false;
        }
    }, [isOpen, sessionId, loadHistoryMessages, loadMissions]);

    useEffect(() => {
        if (showHistory && sessionId) {
            loadHistoryMessages(false);
        }
    }, [showHistory, sessionId, loadHistoryMessages]);

    const refreshHistoryAndMissions = useCallback(async () => {
        await Promise.allSettled([
            loadHistoryMessages(),
            loadMissions()
        ]);
    }, [loadHistoryMessages, loadMissions]);

    // 当 AI 流式输出完成时刷新历史记录和任务列表
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
            // 延迟刷新，确保后端已保存新消息，同时刷新历史记录和任务列表
            const timer = setTimeout(() => {
                refreshHistoryAndMissions();
            }, 800);
            prevIsTypingRef.current = currentIsTyping;
            return () => clearTimeout(timer);
        }

        // 更新 ref
        if (prevIsTyping !== currentIsTyping) {
            prevIsTypingRef.current = currentIsTyping;
        }
    }, [currentIsTyping, showHistory, refreshHistoryAndMissions]);

    // 使用流式处理 Hook
    const { handleStreamResponse: baseHandleStreamResponse } = useStreamResponse({
        setMessages,
        initialMessage: { type: 'system', isMarkdown: true }
    });

    // 包装 handleStreamResponse，在流结束后刷新数据
    const handleStreamResponse = useCallback(async (response: Response) => {
        try {
            await baseHandleStreamResponse(response);
            // 流式输出完成后刷新数据
            getNewPlayer();
            setTimeout(() => {
                refreshHistoryAndMissions();
            }, 800);
        } catch (error) {
            console.error('❌ [DialogueModal] 流式响应处理失败:', error);
        }
    }, [baseHandleStreamResponse, getNewPlayer, refreshHistoryAndMissions]);

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

            // 记录游戏开始统计（异步执行，不阻塞游戏开始）
            if (pdfFileId) {
                statisticsApi.addConversion({ 
                    fileId: pdfFileId, 
                    userId: String(user?.user.id)  
                }).catch((error) => {
                    console.error('记录游戏统计失败:', error);
                });
            }

            const response = await authFetch(
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
            const response = await authFetch(
                `${HOST_ADDRESS}/api/backend/game/session/${sessionId}/stream/action-live`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: text })
                }
            );

            if (response.ok) {
                loadHistoryMessages();

                await handleStreamResponse(response);
                console.log(response);

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


    // 历史记录只使用从后端加载的数据
    const historyMessagesData: ChatMessage[] = historyMessages;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/时间暂停按钮.png`} alt="关闭" />
                </button>
                {/* 左侧：历史记录 */}
                <div className={`${styles.leftPanel} ${showHistory ? styles.mobileHistoryOpen : ''}`}>
                    {showHistory && (
                        <ChatHistory
                            isOpen={showHistory}
                            chatMessages={historyMessagesData}
                            loading={loadingHistory}
                            onClose={() => setShowHistory(false)}
                        />
                    )}
                    <div className={styles.missionsModalWrapper}>
                        <MissionsModal missionData={missionData} loading={loadingMissions} />
                    </div>
                </div>

                {/* 中间：编年纪事对话 - 只显示最新一条 AI 回复 */}
                <div className={styles.dialogueModal}>
                    <div className={styles.modalHeader}>
                        <button className={styles.historyBtn} onClick={() => setShowHistory(!showHistory)}>
                            <img src={`${import.meta.env.BASE_URL}data/asset/对话界面/历史对话图标.png`} alt="关闭" />
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
                                <img src={`${import.meta.env.BASE_URL}data/asset/编年史/按钮.png`} alt="开始游戏" />
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
                                <img src={`${import.meta.env.BASE_URL}data/asset/聊天框/按钮.png`} alt="发送" />
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

