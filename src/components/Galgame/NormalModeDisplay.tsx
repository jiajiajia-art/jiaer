import React, { useState, useCallback, useEffect } from 'react';
import styles from './NormalModeDisplay.module.css';
import { extractPlainText, truncateTextWithTags } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import { IoArrowDownCircleOutline } from 'react-icons/io5';
import { MdAutorenew } from 'react-icons/md';
import { OPTION_COST, INPUT_COST } from '../../utils/constants';
import { useTranslation } from 'react-i18next';

type MessageType = 'dialogue' | 'narration' | 'choice' | 'scene_change' | 'transition';

interface Message {
    id: number;
    type: MessageType;
    message: string;
    characterName?: string;
    characterImage?: string;
    characterPosition?: 'left' | 'right';
    portraitScale?: number;
    portraitOffsetX?: number;
    portraitOffsetY?: number;
    options?: Array<{ id: number; text: string; isMain?: boolean }>;
}

interface StepHandlers {
    isWaitingForData: boolean;
    isCompressingContext?: boolean;
    currentStep: any;
    showNextButton: boolean;
    selectedOptionIndex: number | null;
}

interface NormalModeDisplayProps {
    currentMessage: Message | null;
    finalDisplayText: string;
    finalIsTyping: boolean;
    canRegenerateCurrentMessage?: boolean;
    stepHandlers: StepHandlers;
    isAutoPlay: boolean;
    historyLength: number;
    onNextMessage: () => void;
    onRegenerateCurrentMessage?: () => void;
    onChoiceClick: (option: { id: number; text: string }) => void;
    onCustomInputSubmit: (value: string) => void;
    isFreeRound?: boolean;
}

const POINTS_CONFIG = {
    option: OPTION_COST,
    custom: INPUT_COST,
};

// 不再按历史条数判断是否收费，统一按固定积分展示

const NormalModeDisplay: React.FC<NormalModeDisplayProps> = ({
    currentMessage,
    finalDisplayText,
    finalIsTyping,
    canRegenerateCurrentMessage = false,
    stepHandlers,
    isAutoPlay,
    onNextMessage,
    onRegenerateCurrentMessage,
    onChoiceClick,
    onCustomInputSubmit,
    isFreeRound = false,
}) => {
    const { t } = useTranslation();
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInputValue, setCustomInputValue] = useState('');
    // 是否强制展示当前 step 的完整文本（用于点击跳过打字机效果）
    const [forceShowFullText, setForceShowFullText] = useState(false);

    const { isWaitingForData, isCompressingContext = false, currentStep, showNextButton } = stepHandlers;

    const handleCustomInputClick = useCallback(() => {
        setShowCustomInput(true);
    }, []);

    const handleCustomInputChange = useCallback((value: string) => {
        setCustomInputValue(value);
    }, []);

    const handleCustomInputSubmit = useCallback(() => {
        if (customInputValue.trim() && !isCompressingContext) {
            onCustomInputSubmit(customInputValue.trim());
            setCustomInputValue('');
            setShowCustomInput(false);
        }
    }, [customInputValue, isCompressingContext, onCustomInputSubmit]);

    const handleCustomInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleCustomInputSubmit();
        }
    }, [handleCustomInputSubmit]);

    // step / 消息切换时重置一些本地状态
    useEffect(() => {
        if (currentMessage?.type !== 'choice') {
            setShowCustomInput(false);
            setCustomInputValue('');
        }
        // 每当当前消息变化时，取消“强制全显”状态
        setForceShowFullText(false);
    }, [currentMessage?.type, currentMessage?.id, currentMessage?.message]);

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
                    onClick={(e) => {
                        const clickedButton = (e.target as HTMLElement).closest(`.${styles.nextButtonContainer}`);
                        if (clickedButton) {
                            return;
                        }
                        // 如果当前还在打字中，优先跳过打字机，立刻展示完整文本
                        if (finalIsTyping && !forceShowFullText) {
                            setForceShowFullText(true);
                            return;
                        }
                        if (showNextButton && !isAutoPlay && !isCompressingContext) {
                            onNextMessage();
                        }
                    }}
                >
                    {(isWaitingForData || isCompressingContext) && !currentStep && currentMessage && (
                        <div className={styles.loadingContainer}>
                            <div className={styles.aiLoader}>
                                <div className={styles.orbit}></div>
                                <div className={styles.orbitInner}></div>
                                <div className={styles.core}></div>
                            </div>
                            <div className={styles.statusText}>
                                {isCompressingContext ? t('createGame.organizingMemory') : t('createGame.aiThinking')}<span className={styles.dots}></span>
                            </div>
                        </div>
                    )}

                    {!isWaitingForData && currentMessage && currentMessage.type === 'narration' && currentMessage.message && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(
                                forceShowFullText ? extractPlainText(currentMessage.message) : finalDisplayText,
                                currentMessage.message,
                                finalIsTyping && !forceShowFullText
                            )}
                        </div>
                    )}

                    {!isWaitingForData && currentMessage && currentMessage.type === 'dialogue' && currentMessage.message && (
                        <>
                            <div className={styles.characterMessage}>
                                <div className={styles.characterName}>{currentMessage.characterName}</div>
                                <div className={styles.characterDivider}></div>
                                <div className={styles.characterText}>
                                    {renderTextWithMarkdown(
                                        forceShowFullText ? extractPlainText(currentMessage.message) : finalDisplayText,
                                        currentMessage.message,
                                        finalIsTyping && !forceShowFullText
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {!isWaitingForData && currentMessage && (currentMessage.type === 'scene_change' || currentMessage.type === 'transition') && currentMessage.message && (
                        <div className={styles.narrationMessage}>
                            <div className={styles.characterDivider} style={{ marginBottom: '8px' }}></div>
                            {renderTextWithMarkdown(
                                forceShowFullText ? extractPlainText(currentMessage.message) : finalDisplayText,
                                currentMessage.message,
                                finalIsTyping && !forceShowFullText
                            )}
                        </div>
                    )}

                    {(showNextButton || canRegenerateCurrentMessage) && (!finalIsTyping || forceShowFullText) && !isAutoPlay && (
                        <div className={styles.nextButtonContainer}>
                            {canRegenerateCurrentMessage && onRegenerateCurrentMessage && (
                                <button
                                    className={styles.regenerateButton}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRegenerateCurrentMessage();
                                    }}
                                    disabled={isWaitingForData || isCompressingContext}
                                    title={t('createGame.regenerate')}
                                    aria-label={t('createGame.regenerate')}
                                >
                                    <MdAutorenew />
                                </button>
                            )}
                            <button
                                className={styles.nextButton}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onNextMessage();
                                }}
                                disabled={isWaitingForData || isCompressingContext}
                            >
                                <IoArrowDownCircleOutline />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {currentMessage && currentMessage.type === 'choice' && !isWaitingForData && !isCompressingContext && (
                <div className={styles.choiceContainer}>
                    {currentMessage.options && currentMessage.options.length > 0 && (
                        <>
                            {currentMessage.options.map((option) => (
                                <div
                                    key={option.id}
                                    className={`${styles.choiceOption} ${option.isMain ? styles.choiceOptionMain : ''}`}
                                    onClick={() => onChoiceClick(option)}
                                >
                                    <span className={`${styles.choiceText} ${option.isMain ? styles.choiceTextMain : ''}`}>
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
                        </>
                    )}
                    {!showCustomInput ? (
                        <div
                            className={styles.customInputText}
                            onClick={handleCustomInputClick}
                        >
                            <span>{t('createGame.customInput')}</span>
                        </div>
                    ) : (
                        <div className={styles.customInput}>
                            <input
                                type="text"
                                placeholder={t('createGame.inputPlaceholder')}
                                value={customInputValue}
                                onChange={(e) => handleCustomInputChange(e.target.value)}
                                onKeyDown={handleCustomInputKeyDown}
                                disabled={isCompressingContext}
                                autoFocus
                            />
                            <button
                                onClick={handleCustomInputSubmit}
                                disabled={!customInputValue.trim() || isCompressingContext}
                                className={styles.customInputButton}
                            >
                                <span>{t('createGame.send')}</span>
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

            {currentMessage && currentMessage.type === 'choice' && (isWaitingForData || isCompressingContext) && (
                <div className={styles.loadingContainer}>
                    <div className={styles.aiLoader}>
                        <div className={styles.orbit}></div>
                        <div className={styles.orbitInner}></div>
                        <div className={styles.core}></div>
                    </div>
                    <div className={styles.statusText}>
                        {isCompressingContext ? t('createGame.organizingMemory') : t('createGame.aiThinking')}<span className={styles.dots}></span>
                    </div>
                </div>
            )}
        </>
    );
};

export default NormalModeDisplay;

