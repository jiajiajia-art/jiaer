import React, { useCallback, useState, useEffect } from 'react';
import styles from '../Galgame/NormalModeDisplay.module.css';
import { extractPlainText, truncateTextWithTags } from '../../utils/textUtils';
import ColoredMarkdownText from '../Galgame/ColoredMarkdownText';
import { IoArrowDownCircleOutline } from 'react-icons/io5';

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string; optionId?: string }>;
}

interface StepHandlers {
    isWaitingForData: boolean;
    currentStep: any;
    showNextButton: boolean;
    selectedOptionIndex: number | null;
}

interface NormalModeDisplayProps {
    currentMessage: Message | null;
    finalDisplayText: string;
    finalIsTyping: boolean;
    stepHandlers: StepHandlers;
    isAutoPlay: boolean;
    onNextMessage: () => void;
    onChoiceClick: (option: { id: number | string; text: string; optionId?: string }) => void;
    onCustomInputSubmit: (value: string) => void;
}

const FREE_ROUNDS_THRESHOLD = 5;

const NormalModeDisplay: React.FC<NormalModeDisplayProps> = ({
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    stepHandlers,
    isAutoPlay,
    onNextMessage,
    onChoiceClick,
    onCustomInputSubmit,
}) => {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInputValue, setCustomInputValue] = useState('');

    const { isWaitingForData, currentStep, showNextButton } = stepHandlers;

    const handleCustomInputClick = useCallback(() => {
        setShowCustomInput(true);
    }, []);

    const handleCustomInputChange = useCallback((value: string) => {
        setCustomInputValue(value);
    }, []);

    const handleCustomInputSubmitClick = useCallback(() => {
        if (customInputValue.trim()) {
            onCustomInputSubmit(customInputValue.trim());
            setCustomInputValue('');
            setShowCustomInput(false);
        }
    }, [customInputValue, onCustomInputSubmit]);

    const handleCustomInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomInputSubmitClick();
        }
    }, [handleCustomInputSubmitClick]);

    useEffect(() => {
        if (currentMessage?.type !== 'choice') {
            setShowCustomInput(false);
            setCustomInputValue('');
        }
    }, [currentMessage?.type]);

    // 渲染带颜色标签和 Markdown 的文本
    // 使用统一的 truncateTextWithTags 截取带颜色标签的文本
    // 使用统一的 ColoredMarkdownText 组件渲染
    const renderTextWithMarkdown = useCallback((displayedPlainText: string, originalText: string, showCursor: boolean = false) => {
        if (!displayedPlainText || !originalText) return null;
        
        // 使用 truncateTextWithTags 根据纯文本长度截取带颜色标签的文本
        const textToRender = truncateTextWithTags(originalText, displayedPlainText.length);
        
        return <ColoredMarkdownText text={textToRender} showCursor={showCursor} />;
    }, []);

    return (
        <>
            {currentMessage?.type !== 'choice' && (
                <div
                    className={styles.messageContainer}
                    onClick={() => {
                        // 只有在有下一步按钮、不在打字、不在自动播放时才允许点击
                        if (showNextButton && !finalIsTyping && !isAutoPlay && !isWaitingForData) {
                            onNextMessage();
                        }
                    }}
                    style={{
                        cursor: (showNextButton && !finalIsTyping && !isAutoPlay && !isWaitingForData) ? 'pointer' : 'default'
                    }}
                >
                    {isWaitingForData && !currentStep && currentMessage && (
                        <div className={styles.loadingContainer}>
                            <div className={styles.aiLoader}>
                                <div className={styles.orbit}></div>
                                <div className={styles.orbitInner}></div>
                                <div className={styles.core}></div>
                            </div>
                            <div className={styles.statusText}>
                                AI 推演中<span className={styles.dots}></span>
                            </div>
                        </div>
                    )}

                    {!isWaitingForData && currentMessage && currentMessage.type === 'narration' && currentMessage.message && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(finalDisplayText, currentMessage.message, finalIsTyping)}
                        </div>
                    )}

                    {!isWaitingForData && currentMessage && currentMessage.type === 'dialogue' && currentMessage.message && (
                        <>
                            <div className={styles.characterMessage}>
                                <div className={styles.characterName}>{currentMessage.characterName}</div>
                                <div className={styles.characterDivider}></div>
                                <div className={styles.characterText}>
                                    {renderTextWithMarkdown(finalDisplayText, currentMessage.message, finalIsTyping)}
                                </div>
                            </div>
                        </>
                    )}

                    {!isWaitingForData && currentMessage && (currentMessage.type === 'scene_change' || currentMessage.type === 'transition') && currentMessage.message && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(finalDisplayText, currentMessage.message, finalIsTyping)}
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
                </div>
            )}

            {currentMessage && currentMessage.type === 'choice' && currentMessage.options && currentMessage.options.length > 0 && !isWaitingForData && (
                <div className={styles.choiceContainer}>
                    {currentMessage.options.map((option) => (
                        <div
                            key={option.id}
                            className={styles.choiceOption}
                            onClick={() => onChoiceClick(option)}
                        >
                            <span className={styles.choiceText}>
                                {extractPlainText(option.text)}
                            </span>
                            {history.length > FREE_ROUNDS_THRESHOLD && (
                                <div className={styles.choicePrice}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                    <span>2</span>
                                </div>
                            )}
                        </div>
                    ))}
                    {!showCustomInput ? (
                        <div
                            className={styles.customInputText}
                            onClick={handleCustomInputClick}
                            style={{ 
                                cursor: (!isWaitingForData && !finalIsTyping) ? 'pointer' : 'default',
                                opacity: (isWaitingForData || finalIsTyping) ? 0.6 : 1
                            }}
                        >
                            <span>自定义输入</span>
                        </div>
                    ) : (
                        <div className={styles.customInput}>
                            <input
                                type="text"
                                placeholder="请输入..."
                                value={customInputValue}
                                onChange={(e) => handleCustomInputChange(e.target.value)}
                                onKeyDown={handleCustomInputKeyDown}
                                autoFocus
                                disabled={isWaitingForData || finalIsTyping}
                            />
                            <button
                                onClick={handleCustomInputSubmitClick}
                                disabled={!customInputValue.trim() || isWaitingForData || finalIsTyping}
                                className={styles.customInputButton}
                            >
                                <span>发送</span>
                                {history.length > FREE_ROUNDS_THRESHOLD && (
                                    <div className={styles.choicePrice}>
                                        <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                        <span>3</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {currentMessage && currentMessage.type === 'choice' && isWaitingForData && (
                <div className={styles.loadingContainer}>
                    <div className={styles.aiLoader}>
                        <div className={styles.orbit}></div>
                        <div className={styles.orbitInner}></div>
                        <div className={styles.core}></div>
                    </div>
                    <div className={styles.statusText}>
                        AI 推演中<span className={styles.dots}></span>
                    </div>
                </div>
            )}
        </>
    );
};

export default NormalModeDisplay;

