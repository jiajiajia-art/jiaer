import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './BuildingEventModal.module.css';
import ReactMarkdown from 'react-markdown';
import { HOST_ADDRESS } from '../../config';
import { useGameStore } from '../../store/gameStore';
import { authFetch } from '../../api/base';
import { useGameData } from '../../hooks/useGameData';
import type { BuildingData } from './EventModal';
import { useStreamResponse } from '../../hooks/useStreamResponse';

interface BuildingEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamResponse?: Response | null; // 流式响应对象
    buildingData: BuildingData | null;
}

interface Message {
    type: 'system' | 'user';
    text: string;
    isTyping?: boolean;
    isMarkdown?: boolean;
    actions?: string[];
    selectedAction?: string; // 用户选择的 ACTION
}

const BuildingEventModal: React.FC<BuildingEventModalProps> = ({ 
    isOpen, 
    onClose, 
    streamResponse,
    buildingData
}) => {
    const sessionId = useGameStore((state) => state.sessionId);
    const { getNewScene, getNewPlayer } = useGameData();
    const textContainerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasProcessedInitial, setHasProcessedInitial] = useState(false);
    
    // 当弹窗关闭时，重置状态
    useEffect(() => {
        if (!isOpen) {
            setMessages([]);
            setHasProcessedInitial(false);
        }
    }, [isOpen]);
    
    // 自动滚动到底部
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);
    
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
            getNewScene().catch(err => {
                console.warn('⚠️ 刷新场景数据失败:', err);
            });
            getNewPlayer().catch(err => {
                console.warn('⚠️ 刷新玩家数据失败:', err);
            });
        } catch (error) {
            console.error('❌ [BuildingEventModal] 流式响应处理失败:', error);
        }
    }, [baseHandleStreamResponse, getNewScene, getNewPlayer]);

    // 当弹窗打开且收到初始 streamResponse 时，处理第一个消息
    useEffect(() => {
        if (isOpen && streamResponse && !hasProcessedInitial && buildingData) {
            setHasProcessedInitial(true);
            handleStreamResponse(streamResponse);
        }
    }, [isOpen, streamResponse, hasProcessedInitial, buildingData, handleStreamResponse]);
    
    // 在最后一个段落内添加光标
    useEffect(() => {
        if (!textContainerRef.current) return;

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || !lastMessage.isTyping) return;

        // 找到所有段落
        const paragraphs = textContainerRef.current.querySelectorAll('p');
        
        // 移除所有之前添加的光标
        paragraphs.forEach(p => {
            const existingCursor = p.querySelector(`.${styles.cursor}`);
            if (existingCursor) {
                existingCursor.remove();
            }
        });

        // 如果正在打字，在最后一个段落末尾添加光标
        if (paragraphs.length > 0) {
            const lastParagraph = paragraphs[paragraphs.length - 1];
            const cursor = document.createElement('span');
            cursor.className = styles.cursor;
            cursor.textContent = '|';
            lastParagraph.appendChild(cursor);
        }
    }, [messages]);

    // 处理 ACTION 按钮点击
    const handleActionClick = async (action: string, messageIndex: number) => {
        if (!buildingData) return;
        
        // 检查是否已经有消息被选中
        const hasSelected = messages.some(msg => msg.selectedAction);
        if (hasSelected) return;
                
        // 标记该消息的选中 ACTION
        setMessages((prev) => {
            const updated = [...prev];
            if (updated[messageIndex]) {
                updated[messageIndex] = {
                    ...updated[messageIndex],
                    selectedAction: action
                };
            }
            return updated;
        });
        
        try {
            const response = await authFetch(`${HOST_ADDRESS}/api/backend/game/session/${sessionId}/building-feature/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sceneId: buildingData.sceneId,
                    buildingId: buildingData.buildingId,
                    feature: buildingData.feature,
                    selectedOption: action
                })
            });
            
            if (response.ok) {
                // 处理新的流式响应（会自动添加新的系统消息）
                await handleStreamResponse(response);
            } else {
                // 请求失败，移除选中标记
                setMessages((prev) => {
                    const updated = [...prev];
                    if (updated[messageIndex]) {
                        updated[messageIndex] = {
                            ...updated[messageIndex],
                            selectedAction: undefined
                        };
                    }
                    return updated;
                });
            }
        } catch (error) {
            console.error("❌ ACTION 流式请求错误:", error);
            // 请求失败，移除选中标记
            setMessages((prev) => {
                const updated = [...prev];
                if (updated[messageIndex]) {
                    updated[messageIndex] = {
                        ...updated[messageIndex],
                        selectedAction: undefined
                    };
                }
                return updated;
            });
        }
    };

    if (!isOpen) return null;

    // 检查是否有任何消息被选中
    const hasSelected = messages.some(msg => msg.selectedAction);

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                <div className={styles.streamContent}>
                    <div className={styles.streamText} ref={textContainerRef}>
                        {messages.length === 0 || messages[0].text.length === 0 ? (
                            <p>加载中...</p>
                        ) : (
                            messages.map((message, index) => (
                                <div key={index} className={styles.messageBlock}>
                                    {/* 只显示系统消息，不显示用户消息 */}
                                    {message.type === 'system' && (
                                        <div className={styles.systemMessage}>
                                            {message.isMarkdown ? (
                                                <ReactMarkdown>{message.text}</ReactMarkdown>
                                            ) : (
                                                <p>{message.text}</p>
                                            )}
                                            
                                            {/* ACTION 按钮区域 */}
                                            {message.actions && message.actions.length > 0 && (
                                                <div className={styles.actionButtons}>
                                                    {message.actions.map((action, i) => {
                                                        const isSelected = message.selectedAction === action;
                                                        const isDisabled = hasSelected;
                                                        
                                                        return (
                                                            <button
                                                                key={i}
                                                                className={`${styles.actionBtn} ${isSelected ? styles.actionBtnSelected : ''} ${isDisabled && !isSelected ? styles.actionBtnDisabled : ''}`}
                                                                onClick={() => handleActionClick(action, index)}
                                                                disabled={isDisabled}
                                                            >
                                                                {action}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuildingEventModal;