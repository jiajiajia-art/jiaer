import React, { useState, useCallback, useEffect } from 'react';
import { IoArrowDownCircleOutline } from 'react-icons/io5';
import styles from './NormalModeDisplay.module.css';
import { parseColorMarkup, extractPlainText, type ColorMarkupPart } from '../../utils/textUtils';

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    options?: Array<{ id: number; text: string }>;
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
    onChoiceClick: (option: { id: number; text: string }) => void;
    onCustomInputSubmit: (value: string) => void;
}

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

    const { isWaitingForData, currentStep, showNextButton, selectedOptionIndex } = stepHandlers;

    const handleCustomInputClick = useCallback(() => {
        setShowCustomInput(true);
    }, []);

    const handleCustomInputChange = useCallback((value: string) => {
        setCustomInputValue(value);
    }, []);

    const handleCustomInputSubmit = useCallback(() => {
        if (customInputValue.trim()) {
            onCustomInputSubmit(customInputValue.trim());
            setCustomInputValue('');
            setShowCustomInput(false);
        }
    }, [customInputValue, onCustomInputSubmit]);

    const handleCustomInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomInputSubmit();
        }
    }, [handleCustomInputSubmit]);

    useEffect(() => {
        if (currentMessage?.type !== 'choice') {
            setShowCustomInput(false);
            setCustomInputValue('');
        }
    }, [currentMessage?.type]);

    const renderTextWithColors = useCallback((displayedPlainText: string, originalText: string) => {
        if (!displayedPlainText || !originalText) return null;
        
        const colorClassMap: Record<string, string> = {
            red: styles.colorRed,
            yellow: styles.colorYellow,
            green: styles.colorGreen,
            blue: styles.colorBlue,
            purple: styles.colorPurple,
        };
        
        const originalPlainText = extractPlainText(originalText);
        
        if (displayedPlainText.length >= originalPlainText.length) {
            const parts = parseColorMarkup(originalText);
            return parts.map((part, index) => {
                if (part.type === 'color' && part.color) {
                    const colorClass = colorClassMap[part.color];
                    const content = part.nested && part.nested.length > 0
                        ? part.nested.map((nestedPart, nestedIndex) => {
                            if (nestedPart.type === 'color' && nestedPart.color) {
                                const nestedColorClass = colorClassMap[nestedPart.color];
                                return (
                                    <span key={`nested-${nestedIndex}`} className={nestedColorClass}>
                                        {nestedPart.content}
                                    </span>
                                );
                            }
                            return <React.Fragment key={`nested-${nestedIndex}`}>{nestedPart.content}</React.Fragment>;
                        })
                        : part.content;
                    return (
                        <span key={index} className={colorClass}>
                            {content}
                        </span>
                    );
                }
                return <React.Fragment key={index}>{part.content}</React.Fragment>;
            });
        }
        
        const allParts = parseColorMarkup(originalText);
        const result: ColorMarkupPart[] = [];
        let currentPlainLength = 0;
        
        for (const part of allParts) {
            if (currentPlainLength >= displayedPlainText.length) break;
            
            const partPlainText = part.type === 'text' ? part.content : extractPlainText(part.content);
            const partLength = partPlainText.length;
            
            if (currentPlainLength + partLength <= displayedPlainText.length) {
                result.push(part);
                currentPlainLength += partLength;
            } else {
                const remainingLength = displayedPlainText.length - currentPlainLength;
                if (part.type === 'text') {
                    result.push({
                        type: 'text',
                        content: part.content.substring(0, remainingLength)
                    });
                } else {
                    const truncatedContent = partPlainText.substring(0, remainingLength);
                    result.push({
                        type: 'color',
                        content: truncatedContent,
                        color: part.color
                    });
                }
                break;
            }
        }
        
        return result.map((part, index) => {
            if (part.type === 'color' && part.color) {
                const colorClass = colorClassMap[part.color];
                return (
                    <span key={index} className={colorClass}>
                        {part.content}
                    </span>
                );
            }
            return <React.Fragment key={index}>{part.content}</React.Fragment>;
        });
    }, [styles]);
    
    return (
        <>
            <div className={styles.messageContainer}>
                {isWaitingForData && !currentStep && (
                    <div className={styles.narrationContainer}>
                        <div className={styles.narrationMessage}>
                            <span className={styles.cursor}></span>
                        </div>
                    </div>
                )}

                {!isWaitingForData && currentMessage && currentMessage.type === 'narration' && currentMessage.message && (
                    <div>
                        <div className={styles.narrationMessage}>
                            <span>
                                {renderTextWithColors(finalDisplayText, currentMessage.message)}
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

                {!isWaitingForData && currentMessage && currentMessage.type === 'dialogue' && currentMessage.message && (
                    <>
                        <div className={styles.characterMessage}>
                            <div className={styles.characterName}>{currentMessage.characterName}</div>
                            <div className={styles.characterDivider}></div>
                            <div className={styles.characterText}>
                                {renderTextWithColors(finalDisplayText, currentMessage.message)}
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

                {!isWaitingForData && currentMessage && currentMessage.type === 'scene_change' && currentMessage.message && (
                    <div>
                        <div className={styles.narrationMessage}>
                            <span>
                                {renderTextWithColors(finalDisplayText, currentMessage.message)}
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
            </div>

            {!isWaitingForData && currentMessage && currentMessage.type === 'choice' && currentMessage.options && (
                <div className={styles.choiceContainer}>
                    {currentMessage.options.map((option) => (
                        <div
                            key={option.id}
                            className={styles.choiceOption}
                            onClick={() => onChoiceClick(option)}
                            style={{
                                opacity: selectedOptionIndex !== null &&
                                    selectedOptionIndex !== currentMessage.options?.findIndex((opt: any) => opt.text === option.text)
                                    ? 0.5
                                    : 1,
                                pointerEvents: isWaitingForData ? 'none' : 'auto'
                            }}
                        >
                                <span className={styles.choiceText}>{renderTextWithColors(option.text, option.text)}</span>
                            <div className={styles.choicePrice}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                <span>2</span>
                            </div>
                        </div>
                    ))}
                    {!showCustomInput ? (
                        <div
                            className={styles.customInputText}
                            onClick={handleCustomInputClick}
                            style={{
                                pointerEvents: isWaitingForData ? 'none' : 'auto',
                                opacity: isWaitingForData ? 0.5 : 1
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
                                disabled={isWaitingForData}
                                autoFocus
                            />
                            <button
                                onClick={handleCustomInputSubmit}
                                disabled={isWaitingForData || !customInputValue.trim()}
                            >
                                <span>发送</span>
                                <div className={styles.choicePrice}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                    <span>3</span>
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default NormalModeDisplay;

