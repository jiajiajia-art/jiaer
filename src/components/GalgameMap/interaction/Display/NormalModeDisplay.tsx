import React, { useCallback, useState, useEffect } from 'react';
import styles from '../../../../components/Galgame/NormalModeDisplay.module.css';
import { extractPlainText, truncateTextWithTags } from '../../../../utils/textUtils';
import ColoredMarkdownText from '../../../Galgame/ColoredMarkdownText';
import { IoArrowDownCircleOutline } from 'react-icons/io5';
import { OPTION_COST, INPUT_COST } from '../../../../utils/constants';

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
    stepQueue?: any[]; // 步骤队列，用于判断是否有待处理的步骤
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
    isFreeRound?: boolean;
}

const POINTS_CONFIG = {
    option: OPTION_COST,
    custom: INPUT_COST,
};

const NormalModeDisplay: React.FC<NormalModeDisplayProps> = ({
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    stepHandlers,
    isAutoPlay,
    onNextMessage,
    onChoiceClick,
    onCustomInputSubmit,
    isFreeRound = false,
}) => {
    const debugNext = useCallback((source: 'button' | 'container') => {
        const nextFromQueue = stepQueue && stepQueue.length > 0 ? stepQueue[0] : undefined;
        const pickText = (step: any) => step?.message ?? step?.content ?? step?.text ?? step?.data?.text ?? step?.data?.content;

        console.groupCollapsed(`[NormalModeDisplay] next click (${source})`);
        console.log('showNextButton:', showNextButton);
        console.log('finalIsTyping:', finalIsTyping);
        console.log('isAutoPlay:', isAutoPlay);
        console.log('isWaitingForData:', isWaitingForData);
        console.log('shouldDisableButton:', shouldDisableButton);
        console.log('stepQueue length:', stepQueue?.length ?? 0);
        console.log('currentStep:', currentStep);
        console.log('currentMessage:', currentMessage);
        console.log('next step (from queue):', nextFromQueue);
        console.log('next step text:', pickText(nextFromQueue));
        console.groupEnd();
    }, [currentMessage, finalIsTyping, isAutoPlay]);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInputValue, setCustomInputValue] = useState('');

    const { isWaitingForData, currentStep, showNextButton, stepQueue } = stepHandlers;
    
    // 优化：如果有下一步按钮（showNextButton），说明有步骤可以继续
    // 即使 isWaitingForData 为 true，只要队列中有步骤，就应该允许点击（后端存在一次性返回一坨step的情况，兜底处理）
    const shouldDisableButton = isWaitingForData && (!stepQueue || stepQueue.length === 0);

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
        if (!originalText) return null;
        
        // 关键：切 step 的瞬间，打字机 hook 会先把 displayedPlainText 清空。
        // 如果此时回退渲染完整 originalText，会出现“先闪一下完整文本 -> 再开始打字”的视觉闪烁。
        // 因此：正在打字(showCursor=true)且 displayedPlainText 为空时，渲染空文本（仅保留光标）。
        if (!displayedPlainText) {
            return <ColoredMarkdownText text={showCursor ? '' : originalText} showCursor={showCursor} />;
        }
        
        // 使用 truncateTextWithTags 根据纯文本长度截取带颜色标签的文本
        const textToRender = truncateTextWithTags(originalText, displayedPlainText.length);
        
        return <ColoredMarkdownText text={textToRender} showCursor={showCursor} />;
    }, []);

    return (
        <>
            {currentMessage?.type !== 'choice' && (
                <div
                    className={styles.messageContainer}
                    onClick={(e) => {
                        const clickedButton = (e.target as HTMLElement).closest(`.${styles.nextButtonContainer}`);
                        if (clickedButton) {
                            return;
                        }
                        
                        // 只有在有下一步按钮、不在打字、不在自动播放时才允许点击
                        // 在非自动模式下，必须等待打字完成才能点击
                        if (showNextButton && !finalIsTyping && !isAutoPlay && !isWaitingForData) {
                            // 额外检查：确保显示文本已经完整（打字已完成）
                            const originalPlainText = currentMessage?.message ? extractPlainText(currentMessage.message) : '';
                            const displayedPlainText = finalDisplayText ? extractPlainText(finalDisplayText) : '';
                            const isTextComplete = originalPlainText.length > 0 && 
                                displayedPlainText.length >= originalPlainText.length;
                            console.log("是否允许点击:", {
                                isTextComplete,
                                originalPlainText,
                                displayedPlainText,
                            });
                            
                            
                            // 只有在文本完整时才允许点击（非自动模式下）
                            if (isTextComplete) {
                                debugNext('container');
                                onNextMessage();
                            }
                        }
                    }}
                    style={{
                        cursor: (showNextButton && !finalIsTyping && !isAutoPlay && !isWaitingForData) ? 'pointer' : 'default'
                    }}
                >
                    {isWaitingForData && !currentStep && (
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

                    {/* 与文本模式保持一致：只要有 currentStep 或 currentMessage，即使 isWaitingForData 为 true 也渲染 */}
                    {(currentStep || !isWaitingForData) && currentMessage && currentMessage.type === 'narration' && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(
                                finalDisplayText, 
                                currentMessage.message || (currentStep?.content || currentStep?.text || ''), 
                                finalIsTyping
                            )}
                        </div>
                    )}

                    {(currentStep || !isWaitingForData) && currentMessage && currentMessage.type === 'dialogue' && (
                        <>
                            <div className={styles.characterMessage}>
                                <div className={styles.characterName}>{currentMessage.characterName}</div>
                                <div className={styles.characterDivider}></div>
                                <div className={styles.characterText}>
                                    {renderTextWithMarkdown(
                                        finalDisplayText, 
                                        currentMessage.message || (currentStep?.content || currentStep?.text || ''), 
                                        finalIsTyping
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {(currentStep || !isWaitingForData) && currentMessage && (currentMessage.type === 'scene_change' || currentMessage.type === 'transition') && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(
                                finalDisplayText, 
                                currentMessage.message || (currentStep?.content || currentStep?.text || ''), 
                                finalIsTyping
                            )}
                        </div>
                    )}

                    {showNextButton && !finalIsTyping && !isAutoPlay && (
                        <div className={styles.nextButtonContainer}>
                            <button
                                className={styles.nextButton}
                                onClick={(e) => {
                                    e.stopPropagation(); // 阻止事件冒泡到消息容器
                                    debugNext('button');
                                    onNextMessage();
                                }}
                                disabled={shouldDisableButton}
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
                            {!isFreeRound && (
                                <div className={styles.choicePrice}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                    <span>{POINTS_CONFIG.option}</span>
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
                                {!isFreeRound && (
                                    <div className={styles.choicePrice}>
                                        <img src={`${import.meta.env.BASE_URL}data/assets/金币.png`} alt="金币" />
                                        <span>{POINTS_CONFIG.custom}</span>
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
