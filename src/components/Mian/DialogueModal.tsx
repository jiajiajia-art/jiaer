import React, { useState, useRef, useEffect } from 'react';
import styles from './DialogueModal.module.css';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';
import ReactMarkdown from 'react-markdown';

interface DialogueModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    playerName?: string;
}

const DialogueModal: React.FC<DialogueModalProps> = ({
    isOpen,
    onClose,
    title = '对话',
    playerName = '玩家'
}) => {
    const [gameStarted, setGameStarted] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<
        Array<{
            type: 'system' | 'user';
            text: string;
            isTyping?: boolean;
            isMarkdown?: boolean;
            actions?: string[];
        }>
    >([{ type: 'system', text: `欢迎来到游戏世界，${playerName}！` }]);

    const pdfFileId = useGameStore((state) => state.pdfFileId);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const createSession = async (): Promise<string | null> => {
        if (!pdfFileId) {
            console.error('没有 pdfFileId，无法创建 session');
            return null;
        }

        try {
            const response = await fetch(`${HOST_ADDRESS}/api/backend/game/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: pdfFileId,
                    playerName: playerName
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Session 创建成功:', data);
                return data.sessionId || data.id;
            } else {
                console.error('❌ Session 创建失败:', response.statusText);
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            return null;
        }
    };

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
        try {
            setLoading(true);
            setMessages((prev) => [...prev, { type: 'system', text: '正在建立游戏会话...' }]);

            const newSessionId = await createSession();
            if (!newSessionId) {
                setMessages((prev) => [
                    ...prev,
                    { type: 'system', text: '会话创建失败，请重试...' }
                ]);
                return;
            }

            setSessionId(newSessionId);
            setMessages((prev) => [
                ...prev,
                { type: 'system', text: '会话已建立，正在开始游戏...' }
            ]);

            const response = await fetch(
                `${HOST_ADDRESS}/api/backend/game/session/${newSessionId}/stream/action-live`,
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
            }
        } catch (error) {
            console.error('❌ 游戏开始错误:', error);
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

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.dialogueModal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{title}</h3>
                    <button className={styles.closeBtn} onClick={onClose}>×</button>
                </div>

                <div className={styles.messagesContainer}>
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`${styles.message} ${msg.type === 'system' ? styles.system : styles.user}`}>
                            {msg.isMarkdown ? (
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                            ) : (
                                msg.text
                            )}
                            {msg.isTyping && <span className={styles.cursor}>|</span>}

                            {/* 🔹 动作按钮区 */}
                            {msg.actions && msg.actions.length > 0 && (
                                <div className={styles.actionButtons}>
                                    {msg.actions.map((action, i) => (
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
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {!gameStarted ? (
                    <div className={styles.startGameContainer}>
                        <button
                            className={styles.startGameBtn}
                            onClick={handleStartGame}
                            disabled={loading}
                        >
                            {loading ? '⏳ 处理中...' : '🚀 开始游戏'}
                        </button>
                    </div>
                ) : (
                    <div className={styles.inputContainer}>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="输入你的回应..."
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
                            {loading ? '⏳' : '发送'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DialogueModal;
