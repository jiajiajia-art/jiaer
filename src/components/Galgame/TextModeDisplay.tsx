import React, { useEffect, useRef, useState } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './TextModeDisplay.module.css';
import useGalgameHistory from '../../hooks/galgame/useGalgameHistory';

interface TextModalStep {
    id: string;
    type: 'narration' | 'dialogue' | 'choice' | 'transition' | 'scene_change';
    content: string;
    speakerName?: string;
    characterName?: string;
    options?: Array<{ id: number; text: string }>;
    title?: string;
    description?: string;
}

interface TextModeDisplayProps {
    steps: TextModalStep[];
    currentStepIndex: number;
    currentDisplayText: string;
    isTyping: boolean;
    showNextButton: boolean;
    isWaitingForData: boolean;
    onNextStep: () => void;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
}

// 积分消耗配置
const POINTS_CONFIG = {
    option: 2,      // 选择选项消耗2积分
    custom: 3,      // 自定义输入消耗3积分
};

// 前5回免费（每回2条消息，共10条）
const FREE_ROUNDS_THRESHOLD = 10;

const MessageItem: React.FC<{
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
}> = ({ step, isCurrentStep, currentDisplayText, isTyping, onChoiceClick, onCustomInputSubmit }) => {
    const [customInput, setCustomInput] = useState('');
    const { history } = useGalgameHistory();

    if (!step) return null;

    const handleCustomSubmit = () => {
        if (customInput.trim() && onCustomInputSubmit && !isTyping) {
            onCustomInputSubmit(customInput.trim());
            setCustomInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    // 根据类型渲染不同的消息样式
    if (step.type === 'narration' || step.type === 'transition') {
        const displayText = isCurrentStep && isTyping && currentDisplayText
            ? currentDisplayText
            : (step.content || '');
        
        return (
            <div className={styles.messageWrapper}>
                <div className={styles.narrationBubble}>
                    <div className={styles.narrationLabel}>旁白</div>
                    <div className={styles.narrationContent}>
                        <ColoredMarkdownText text={displayText} showCursor={isCurrentStep && isTyping} />
                    </div>
                </div>
            </div>
        );
    }

    if (step.type === 'dialogue') {
        const speaker = step.speakerName || '';
        const displayText = isCurrentStep && isTyping && currentDisplayText
            ? currentDisplayText
            : (step.content || '');
 
        return (
            <div className={styles.messageWrapper}>
                <div className={styles.dialogueBubble}>
                    <div className={styles.speakerName}>{speaker}</div>
                    <div className={styles.dialogueContent}>
                        <ColoredMarkdownText text={displayText} showCursor={isCurrentStep && isTyping} />
                    </div>
                </div>
            </div>
        );
    }

    if (step.type === 'choice') {
        return (
            <div className={styles.messageWrapper}>
                <div className={styles.choiceBubble}>
                    {step.title && (
                        <div className={styles.choiceTitle}>{step.title}</div>
                    )}
                    {step.description && (
                        <div className={styles.choiceDescription}>
                            <ColoredMarkdownText text={step.description} />
                        </div>
                    )}
                    {step.options && step.options.length > 0 && (
                        <>
                            <div className={styles.optionsList}>
                                {step.options.map((opt) => (
                                    <div 
                                        key={opt.id} 
                                        className={styles.optionItem}
                                        onClick={() => {
                                            if (onChoiceClick && !isTyping) {
                                                onChoiceClick(opt);
                                            }
                                        }}
                                        style={{ 
                                            cursor: onChoiceClick && !isTyping ? 'pointer' : 'default' 
                                        }}
                                    >
                                        <span className={styles.optionNumber}>{opt.id}</span>
                                        <span className={styles.optionText}>{extractPlainText(opt.text)}</span>
                                        {history.length > FREE_ROUNDS_THRESHOLD 
                                            ? <span className={styles.pointsCost}>-{POINTS_CONFIG.option}积分</span>
                                            : <span className={styles.freeBadge}>免费</span>
                                        }
                                    </div>
                                ))}
                            </div>
                            
                            {/* 自定义输入区域 */}
                            <div className={styles.customInputSection}>
                                <div className={styles.customInputHeader}>
                                    <span>或者自定义输入</span>
                                    {history.length > FREE_ROUNDS_THRESHOLD 
                                        ? <span className={styles.pointsCostHint}>消耗 {POINTS_CONFIG.custom} 积分</span>
                                        : <span className={styles.freeHint}>免费</span>
                                    }
                                </div>
                                <div className={styles.customInputWrapper}>
                                    <input
                                        type="text"
                                        className={styles.customInput}
                                        placeholder="输入你想说的话或行动..."
                                        value={customInput}
                                        onChange={(e) => setCustomInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isTyping}
                                    />
                                    <button 
                                        className={styles.customInputButton}
                                        onClick={handleCustomSubmit}
                                        disabled={!customInput.trim() || isTyping}
                                    >
                                        发送
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (step.type === 'scene_change') {
        const displayText = isCurrentStep && isTyping && currentDisplayText
            ? currentDisplayText
            : (step.content || '');
        
        return (
            <div className={styles.messageWrapper}>
                <div className={styles.sceneChangeBubble}>
                    <ColoredMarkdownText text={displayText} showCursor={isCurrentStep && isTyping} />
                </div>
            </div>
        );
    }

    return null;
};

const TextModeDisplay: React.FC<TextModeDisplayProps> = ({
    steps,
    currentStepIndex,
    currentDisplayText,
    isTyping,
    showNextButton,
    isWaitingForData,
    onNextStep,
    onChoiceClick,
    onCustomInputSubmit
}) => {
    const autoPlayTimerRef = useRef<number | null>(null);
    const previousIsTypingRef = useRef<boolean>(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (previousIsTypingRef.current && 
            !isTyping && 
            showNextButton && 
            !isWaitingForData) {
            autoPlayTimerRef.current = window.setTimeout(() => {
                onNextStep();
            }, 500);
        }

        previousIsTypingRef.current = isTyping;

        return () => {
            if (autoPlayTimerRef.current) {
                clearTimeout(autoPlayTimerRef.current);
                autoPlayTimerRef.current = null;
            }
        };
    }, [isTyping, showNextButton, isWaitingForData, onNextStep]);

    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [steps, currentDisplayText]);

    return (
        <div className={styles.textModeContainer}>
            {isWaitingForData && steps.length === 0 && (
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
            
            {steps.length === 0 && !isWaitingForData ? (
                <div className={styles.emptyState}>暂无内容</div>
            ) : (
                <div className={styles.messagesContainer} ref={messagesContainerRef}>
                    {steps.map((step, index) => (
                        <MessageItem
                            key={step.id}
                            step={step}
                            index={index}
                            isCurrentStep={index === currentStepIndex && currentStepIndex >= 0}
                            currentDisplayText={index === currentStepIndex ? currentDisplayText : ''}
                            isTyping={index === currentStepIndex ? isTyping : false}
                            onChoiceClick={onChoiceClick}
                            onCustomInputSubmit={onCustomInputSubmit}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TextModeDisplay;
