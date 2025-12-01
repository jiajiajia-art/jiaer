import React, { type RefObject } from 'react';
import { IoArrowDownCircleOutline } from 'react-icons/io5';
import styles from '../../page/Galgame.module.css';

type MessageType = 'dialogue' | 'narration' | 'choice';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string }>;
}

interface TextModeDisplayProps {
    messageHistory: Message[];
    currentMessage: Message | null;
    finalDisplayText: string;
    finalIsTyping: boolean;
    isWaitingForData: boolean;
    currentStep: any;
    showNextButton: boolean;
    isAutoPlay: boolean;
    onNextMessage: () => void;
    containerRef: RefObject<HTMLDivElement | null>;
}

const TextModeDisplay: React.FC<TextModeDisplayProps> = ({
    messageHistory,
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    isWaitingForData,
    currentStep,
    showNextButton,
    isAutoPlay,
    onNextMessage,
    containerRef,
}) => {
    return (
        <div 
            ref={containerRef}
            className={`${styles.messageContainer} ${styles.textModeContainer}`}
        >
            {/* 历史消息 */}
            {messageHistory.map((msg) => (
                <div key={msg.id}>
                    {msg.type === 'narration' ? (
                        <div className={styles.narrationContainer}>
                            <div className={styles.narrationMessage}>
                                <span>{msg.message}</span>
                            </div>
                        </div>
                    ) : msg.type === 'dialogue' ? (
                        <div className={styles.characterMessage}>
                            <div className={styles.characterName}>{msg.characterName}</div>
                            <div className={styles.characterDivider}></div>
                            <div className={styles.characterText}>
                                <span>{msg.message}</span>
                            </div>
                        </div>
                    ) : null}
                </div>
            ))}
            
            {/* 当前正在显示的消息（带打字机效果） */}
            {!isWaitingForData && currentMessage && 
                (currentMessage.type === 'narration' || currentMessage.type === 'dialogue') && 
                currentMessage.message && (
                <>
                    {currentMessage.type === 'narration' ? (
                        <div className={styles.narrationContainer}>
                            <div className={styles.narrationMessage}>
                                <span>
                                    {finalDisplayText}
                                    {finalIsTyping && <span className={styles.cursor}></span>}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.characterMessage}>
                            <div className={styles.characterName}>{currentMessage.characterName}</div>
                            <div className={styles.characterDivider}></div>
                            <div className={styles.characterText}>
                                <span>
                                    {finalDisplayText}
                                    {finalIsTyping && <span className={styles.cursor}></span>}
                                </span>
                            </div>
                        </div>
                    )}
                    {showNextButton && !finalIsTyping && !isAutoPlay && (
                        <div className={styles.nextButtonContainer}>
                            <button
                                className={styles.nextButton}
                                onClick={onNextMessage}
                                disabled={isWaitingForData}
                            >
                                <IoArrowDownCircleOutline />
                            </button>
                        </div>
                    )}
                </>
            )}
            
            {/* 等待数据时的加载状态 */}
            {isWaitingForData && !currentStep && (
                <div className={styles.narrationContainer}>
                    <div className={styles.narrationMessage}>
                        <span className={styles.cursor}></span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TextModeDisplay;

