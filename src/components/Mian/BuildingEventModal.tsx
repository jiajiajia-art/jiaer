import React, { useState, useEffect, useRef } from 'react';
import styles from './BuildingEventModal.module.css';
import ReactMarkdown from 'react-markdown';

interface BuildingEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    streamResponse?: Response | null; // 流式响应对象
}

const BuildingEventModal: React.FC<BuildingEventModalProps> = ({ 
    isOpen, 
    onClose, 
    streamResponse 
}) => {
    const [streamText, setStreamText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const textContainerRef = useRef<HTMLDivElement>(null);
    const typingBufferRef = useRef<string>(''); // 待显示的文本缓冲区
    const displayedTextRef = useRef<string>(''); // 已显示的文本
    const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 打字机效果：逐字符显示
    const startTyping = React.useCallback(() => {
        if (typingTimerRef.current) {
            clearInterval(typingTimerRef.current);
        }

        const typeNextChar = () => {
            if (typingBufferRef.current.length > 0) {
                // 每次显示一个字符
                const char = typingBufferRef.current[0];
                typingBufferRef.current = typingBufferRef.current.slice(1);
                displayedTextRef.current += char;
                setStreamText(displayedTextRef.current);
            } else {
                // 缓冲区空了，停止打字
                if (typingTimerRef.current) {
                    clearInterval(typingTimerRef.current);
                    typingTimerRef.current = null;
                }
                setIsTyping(false);
            }
        };

        // 每 50ms 显示一个字符（可调整速度，数值越大越慢）
        typingTimerRef.current = setInterval(typeNextChar, 50);
        setIsTyping(true);
    }, []);

    // 处理流式响应
    const handleStreamResponse = async (response: Response) => {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) return;

        setIsTyping(true);
        setStreamText('');
        displayedTextRef.current = '';
        typingBufferRef.current = '';

        try {
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
                            // 将新内容添加到缓冲区
                            typingBufferRef.current += json.content;
                            // 如果打字机还没启动，启动它
                            if (!typingTimerRef.current) {
                                startTyping();
                            }
                        }
                    } catch {
                        // 解析不完整时忽略
                    }
                }
            }
        } finally {
            // 等待缓冲区内容全部显示完
            const waitForTyping = () => {
                if (typingBufferRef.current.length > 0) {
                    setTimeout(waitForTyping, 100);
                } else {
                    setIsTyping(false);
                }
            };
            waitForTyping();
        }
    };

    // 当 streamResponse 变化时开始处理
    useEffect(() => {
        if (isOpen && streamResponse) {
            handleStreamResponse(streamResponse);
        }
        
        // 清理函数
        return () => {
            // 清除定时器
            if (typingTimerRef.current) {
                clearInterval(typingTimerRef.current);
                typingTimerRef.current = null;
            }
            // 重置状态
            setStreamText('');
            setIsTyping(false);
            typingBufferRef.current = '';
            displayedTextRef.current = '';
        };
    }, [isOpen, streamResponse]);

    // 在最后一个段落内添加光标
    useEffect(() => {
        if (!textContainerRef.current) return;

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
        if (isTyping && paragraphs.length > 0) {
            const lastParagraph = paragraphs[paragraphs.length - 1];
            const cursor = document.createElement('span');
            cursor.className = styles.cursor;
            cursor.textContent = '|';
            lastParagraph.appendChild(cursor);
        }
    }, [streamText, isTyping]);

    if (!isOpen) return null;

    return (
        <div className={styles.modal}>
            <div className={styles.modalContent}>
                <div className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                <div className={styles.streamContent}>
                    <div className={styles.streamText} ref={textContainerRef}>
                        {streamText ? (
                            <ReactMarkdown>{streamText}</ReactMarkdown>
                        ) : (
                            <p>加载中...</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuildingEventModal;