import React, { useState, useCallback, useEffect } from 'react';
import { IoArrowDownCircleOutline } from 'react-icons/io5';
import { Converter } from 'showdown';
import styles from './NormalModeDisplay.module.css';
import { parseColorMarkup, extractPlainText } from '../../utils/textUtils';

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

    const renderTextWithMarkdown = useCallback((displayedPlainText: string, originalText: string) => {
        if (!displayedPlainText || !originalText) return null;

        const colorClassMap: Record<string, string> = {
            red: styles.colorRed,
            yellow: styles.colorYellow,
            green: styles.colorGreen,
            blue: styles.colorBlue,
            purple: styles.colorPurple,
        };

        const originalPlainText = extractPlainText(originalText);

        const getTextToRender = (): string => {
            const allParts = parseColorMarkup(originalText);
            
            if (displayedPlainText.length >= originalPlainText.length) {
                // 文本全部输出完成，转换所有颜色标记为 HTML
                return allParts.map(part => {
                    if (part.type === 'color' && part.color) {
                        return `<span class="${colorClassMap[part.color]}">${part.content}</span>`;
                    }
                    return part.content;
                }).join('');
            }

            // 文本正在输出中，根据显示长度截取
            let result = '';
            let currentPlainLength = 0;

            for (const part of allParts) {
                if (currentPlainLength >= displayedPlainText.length) break;

                const partPlainText = part.type === 'text' ? part.content : extractPlainText(part.content);
                const partLength = partPlainText.length;

                if (currentPlainLength + partLength <= displayedPlainText.length) {
                    if (part.type === 'color' && part.color) {
                        result += `<span class="${colorClassMap[part.color]}">${part.content}</span>`;
                    } else {
                        result += part.content;
                    }
                    currentPlainLength += partLength;
                } else {
                    const remainingLength = displayedPlainText.length - currentPlainLength;
                    const truncatedContent = partPlainText.substring(0, remainingLength);
                    if (part.type === 'color' && part.color) {
                        result += `<span class="${colorClassMap[part.color]}">${truncatedContent}</span>`;
                    } else {
                        result += truncatedContent;
                    }
                    break;
                }
            }

            return result;
        };

        const textToRender = getTextToRender();
        const converter = new Converter();
        converter.setOption('simpleLineBreaks', true);
        converter.setOption('strikethrough', true);
        converter.setOption('tables', true);
        converter.setOption('tasklists', true);
        
        const html = converter.makeHtml(textToRender);

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    }, [styles]);

    return (
        <>
            {currentMessage?.type !== 'choice' && (
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
                                {renderTextWithMarkdown(finalDisplayText, currentMessage.message)}
                                {finalIsTyping && <span className={styles.cursor}></span>}
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
                                    {renderTextWithMarkdown(finalDisplayText, currentMessage.message)}
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
                                {renderTextWithMarkdown(finalDisplayText, currentMessage.message)}
                                {finalIsTyping && <span className={styles.cursor}></span>}
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
            )}

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
                            <span className={styles.choiceText}>
                                {(() => {
                                    const colorClassMap: Record<string, string> = {
                                        red: styles.colorRed,
                                        yellow: styles.colorYellow,
                                        green: styles.colorGreen,
                                        blue: styles.colorBlue,
                                        purple: styles.colorPurple,
                                    };
                                    const parts = parseColorMarkup(option.text);
                                    const htmlParts = parts.map(part => {
                                        if (part.type === 'color' && part.color) {
                                            return `<span class="${colorClassMap[part.color]}">${part.content}</span>`;
                                        }
                                        return part.content;
                                    }).join('');
                                    const converter = new Converter();
                                    converter.setOption('simpleLineBreaks', true);
                                    const html = converter.makeHtml(htmlParts);
                                    return <span dangerouslySetInnerHTML={{ __html: html }} />;
                                })()}
                            </span>
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

