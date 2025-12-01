import React from 'react';
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

interface NormalModeDisplayProps {
    currentMessage: Message | null;
    finalDisplayText: string;
    finalIsTyping: boolean;
    isWaitingForData: boolean;
    currentStep: any;
    showNextButton: boolean;
    isAutoPlay: boolean;
    onNextMessage: () => void;
}

const NormalModeDisplay: React.FC<NormalModeDisplayProps> = ({
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    isWaitingForData,
    currentStep,
    showNextButton,
    isAutoPlay,
    onNextMessage,
}) => {
    return (
        <div className={styles.messageContainer}>
            {/* 等待数据时的加载状态 */}
            {isWaitingForData && !currentStep && (
                <div className={styles.narrationContainer}>
                    <div className={styles.narrationMessage}>
                        <span className={styles.cursor}></span>
                    </div>
                </div>
            )}

            {/* 旁白类型 */}
            {!isWaitingForData && currentMessage && currentMessage.type === 'narration' && currentMessage.message && (
                <div className={styles.narrationContainer}>
                    <div className={styles.narrationMessage}>
                        <span>
                            {finalDisplayText}
                            {finalIsTyping && <span className={styles.cursor}></span>}
                        </span>
                    </div>
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
                </div>
            )}

            {/* 角色对话类型 */}
            {!isWaitingForData && currentMessage && currentMessage.type === 'dialogue' && currentMessage.message && (
                <>
                    <div className={styles.characterMessage}>
                        <div className={styles.characterName}>{currentMessage.characterName}</div>
                        <div className={styles.characterDivider}></div>
                        <div className={styles.characterText}>
                            {finalDisplayText}
                            {finalIsTyping && <span className={styles.cursor}></span>}
                        </div>
                    </div>
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
        </div>
    );
};

export default NormalModeDisplay;

