import React, { useState, useCallback, useEffect } from 'react';
import { Converter } from 'showdown';
import styles from './NormalModeDisplay.module.css';
import { parseColorMarkup, extractPlainText } from '../../utils/textUtils';
import { IoArrowDownCircleOutline } from 'react-icons/io5';

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

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

    const renderTextWithMarkdown = useCallback((displayedPlainText: string, originalText: string, showCursor: boolean = false) => {
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
            // 先完全移除所有动画标签，然后再解析颜色标签
            let cleanedText = originalText;
            // 移除所有动画标签及其内容
            cleanedText = cleanedText.replace(/<(jump|vibration|injury)>[\s\S]*?<\/\1>/gi, '');
            // 移除不完整的动画标签
            cleanedText = cleanedText.replace(/<(jump|vibration|injury)>/gi, '');
            cleanedText = cleanedText.replace(/<\/(jump|vibration|injury)>/gi, '');
            
            const allParts = parseColorMarkup(cleanedText);

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

        let html = converter.makeHtml(textToRender);
        
        // 如果显示光标，将光标 HTML 直接插入到文本末尾
        if (showCursor) {
            const cursorClassName = styles.cursor;
            const cursorHtml = `<span class="${cursorClassName}"></span>`;
            if (html.endsWith('</p>')) {
                html = html.slice(0, -4) + cursorHtml + '</p>';
            } else if (html.endsWith('</div>')) {
                html = html.slice(0, -6) + cursorHtml + '</div>';
            } else {
                html += cursorHtml;
            }
        }

        return <div dangerouslySetInnerHTML={{ __html: html }} />;
    }, [styles]);

    return (
        <>
            {currentMessage?.type !== 'choice' && (
                <div
                    className={styles.messageContainer}
                    onClick={() => {
                        if (showNextButton && !finalIsTyping && !isAutoPlay) {
                            onNextMessage();
                        }
                    }}
                >
                    {isWaitingForData && !currentStep && currentMessage && (
                        //  <div className={styles.narrationContainer}>
                        //  <div className={styles.narrationMessage}>
                        //      <span className={styles.cursor}></span>
                        //      </div>
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

            {currentMessage && currentMessage.type === 'choice' && currentMessage.options && (
                <div className={styles.choiceContainer}>
                    {currentMessage.options.map((option) => {
                        const isSelected = selectedOptionIndex !== null &&
                            selectedOptionIndex === currentMessage.options?.findIndex((opt: any) => opt.text === option.text);
                        // const isWaiting = isWaitingForData && isSelected;

                        return (
                            <div
                                key={option.id}
                                className={styles.choiceOption}
                                onClick={() => onChoiceClick(option)}
                                style={{
                                    opacity: selectedOptionIndex !== null && !isSelected
                                        ? 0.5
                                        : 1,
                                    pointerEvents: isWaitingForData ? 'none' : 'auto'
                                }}
                            >
                                {/* {isWaiting && (
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill}></div>
                                    </div>
                                )} */}
                                <span className={styles.choiceText}>
                                    {extractPlainText(option.text)}
                                </span>
                                <div className={styles.choicePrice}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                    <span>2</span>
                                </div>
                            </div>
                        );
                    })}
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
                                className={styles.customInputButton}
                            >
                                {isWaitingForData && (
                                    <div className={styles.progressBar}>
                                        <div className={styles.progressFill}></div>
                                    </div>
                                )}
                                {isWaitingForData ? (
                                    <span style={{ opacity: 0.7 }}>发送中...</span>
                                ) : (
                                    <span>发送</span>
                                )}
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

