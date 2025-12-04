import React, { useEffect, useRef } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './TextModeDisplay.module.css';

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
}

const MessageItem: React.FC<{
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    onChoiceClick?: (option: { id: number; text: string }) => void;
}> = ({ step, isCurrentStep, currentDisplayText, isTyping, onChoiceClick }) => {
    if (!step) return null;

    // 根据类型渲染不同的消息样式
    if (step.type === 'narration' || step.type === 'transition') {
        // 对于当前步骤且正在打字，使用 currentDisplayText（已保留颜色标签，支持丝滑打字效果）
        // 对于已完成步骤，使用原始 content（保留颜色标签）
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
        // console.log(step);
        // 对于当前步骤且正在打字，使用 currentDisplayText（已保留颜色标签，支持丝滑打字效果）
        // 对于已完成步骤，使用原始 content（保留颜色标签）
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
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (step.type === 'scene_change') {
        // 对于当前步骤且正在打字，使用 currentDisplayText（已处理过的）
        // 对于已完成步骤，使用原始 content（保留颜色标签）
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
    onChoiceClick
}) => {
    // 文本模式下自动输出下一个step（默认开启）
    const autoPlayTimerRef = useRef<number | null>(null);
    const previousIsTypingRef = useRef<boolean>(false);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        // 文本模式默认自动播放
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

    // 自动滚动到底部
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
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default TextModeDisplay;

