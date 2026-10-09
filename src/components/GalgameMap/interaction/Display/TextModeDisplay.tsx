import React, { useEffect, useRef, memo, useState } from 'react';
import { extractPlainText } from '../../../../utils/textUtils';
import ColoredMarkdownText from '../../../Galgame/ColoredMarkdownText';
import styles from '../../../Galgame/TextModeDisplay.module.css';

interface TextModalStep {
    id: string;
    type: 'narration' | 'dialogue' | 'choice' | 'transition' | 'scene_change';
    content: string;
    speakerName?: string;
    characterName?: string;
    isPlayer?: boolean;
    options?: Array<{ id: number; text: string; optionId?: string }>;
    title?: string;
    description?: string;
}

interface TextModeDisplayProps {
    steps: TextModalStep[];
    currentStepIndex: number;
    currentDisplayText: string;
    isTyping: boolean;
    isWaitingForData: boolean;
    onChoiceClick?: (option: { id: number | string; text: string; optionId?: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
    noPaddingBottom?: boolean; // 当父容器已有 padding-bottom 时，设置为 true 以移除 TextModeDisplay 的 padding-bottom
    isFreeRound?: boolean;
}

interface MessageItemProps {
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    isWaitingForData: boolean;
    onChoiceClick?: (option: { id: number | string; text: string; optionId?: string }) => void;
}

const MessageItem = memo<MessageItemProps>(({ 
    step, 
    isCurrentStep, 
    currentDisplayText, 
    isTyping,
    isWaitingForData,
    onChoiceClick, 
}) => {
    if (!step) return null;

    // 计算要显示的文本
    const getDisplayText = () => {
        // 当前步骤处于打字中：始终使用打字中的文本（即使刚开始还是空串）
        // 这样可以避免"先整段闪一下再开始打字"的问题
        if (isCurrentStep && isTyping) {
            return currentDisplayText || '';
        }
        return step.content || '';
    };

    // 根据类型渲染不同的消息样式
    if (step.type === 'narration' || step.type === 'transition') {
        const displayText = getDisplayText();
        
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
        const displayText = getDisplayText();
        const isPlayer = step.isPlayer || false;
 
        return (
            <div className={styles.messageWrapper}>
                <div className={`${styles.dialogueBubble} ${isPlayer ? styles.playerDialogueBubble : styles.npcDialogueBubble}`}>
                    <div className={styles.speakerName}>{speaker}</div>
                    <div className={styles.dialogueContent}>
                        <ColoredMarkdownText text={displayText} showCursor={isCurrentStep && isTyping} />
                    </div>
                </div>
            </div>
        );
    }

    if (step.type === 'choice') {
        // 只对当前步骤做延迟渲染，历史 choice 不受影响
        // 避免在打字中或等待流时提前把选项插入列表中间
        if (isCurrentStep && (isWaitingForData || isTyping)) {
            return null;
        }

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
                                            if (onChoiceClick && !isTyping && !isWaitingForData) {
                                                onChoiceClick(opt);
                                            }
                                        }}
                                        style={{ 
                                            cursor: onChoiceClick && !isTyping && !isWaitingForData ? 'pointer' : 'default' 
                                        }}
                                    >
                                        <span className={styles.optionNumber}>{opt.id}</span>
                                        <span className={styles.optionText}>{extractPlainText(opt.text)}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (step.type === 'scene_change') {
        // 场景切换不再在文本模式中额外输出 description 文本
        return null;
    }

    return null;
});

const TextModeDisplay: React.FC<TextModeDisplayProps> = ({
    steps,
    currentStepIndex,
    currentDisplayText,
    isTyping,
    isWaitingForData,
    onChoiceClick,
    onCustomInputSubmit,
    noPaddingBottom = false,
}) => {
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const shouldStickToBottomRef = useRef(true);
    const hasInitialAutoScrolledRef = useRef(false);
    const [customInput, setCustomInput] = useState('');

    const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
    const showComposer = Boolean(
        onCustomInputSubmit
        && currentStep?.type === 'choice'
        && !isTyping
        && !(isWaitingForData && currentStepIndex >= 0 && steps[currentStepIndex]?.type === 'choice'),
    );

    useEffect(() => {
        setCustomInput('');
    }, [currentStep?.id]);

    const handleCustomSubmit = () => {
        if (!customInput.trim() || !onCustomInputSubmit || isTyping || isWaitingForData) return;
        onCustomInputSubmit(customInput.trim());
        setCustomInput('');
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

    // 跟踪用户是否“贴底”，避免用户向上滚动阅读时被强制拉回底部
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;

        const handleScroll = () => {
            const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldStickToBottomRef.current = distanceToBottom < 80; // 80px 阈值
        };

        handleScroll();
        el.addEventListener('scroll', handleScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleScroll);
    }, []);


    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;

        if (!hasInitialAutoScrolledRef.current) {
            requestAnimationFrame(() => {
                const el2 = messagesContainerRef.current;
                if (!el2) return;
                el2.scrollTop = el2.scrollHeight;
                hasInitialAutoScrolledRef.current = true;
            });
            return;
        }

        if (!shouldStickToBottomRef.current) return;

        requestAnimationFrame(() => {
            const el2 = messagesContainerRef.current;
            if (!el2) return;
            el2.scrollTop = el2.scrollHeight;
        });
    }, [steps.length, currentStepIndex, currentDisplayText, isTyping, isWaitingForData, showComposer]);

    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
    const lastStepIsChoice = lastStep?.type === 'choice';
    
    const showMainLoader = isWaitingForData && (steps.length === 0 || lastStepIsChoice);
    
    const showDotLoader = isWaitingForData && steps.length > 0 && !isTyping && !lastStepIsChoice;

    return (
        <div className={`${styles.textModeContainer} ${noPaddingBottom ? styles.noPaddingBottom : ''}`}>
            {steps.length === 0 && !isWaitingForData ? (
                <div className={styles.emptyState}>暂无内容</div>
            ) : showMainLoader ? (
                <div className={styles.messagesContainer} ref={messagesContainerRef}>
                    <div className={styles.loadingContainer}>
                        <div className={styles.aiLoader}>
                            <div className={styles.orbit}></div>
                            <div className={styles.orbitInner}></div>
                            <div className={styles.core}></div>
                        </div>
                        <div className={styles.statusText}>
                            剧情展开中<span className={styles.dots}></span>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                <div
                    className={`${styles.messagesContainer}${showComposer ? ` ${styles.messagesContainerWithComposer}` : ''}`}
                    ref={messagesContainerRef}
                >
                    {steps.map((step, index) => {
                        // 只有当前步骤才传递打字相关状态
                        const isCurrent = index === currentStepIndex && currentStepIndex >= 0;

                        // 避免等待流数据时把"当前正在生成"的 choice 插入中间；历史 choice 正常显示
                        if (isCurrent && isWaitingForData && step.type === 'choice') {
                            return null;
                        }
                        
                        return (
                                <MessageItem
                                    key={step.id}
                                    step={step}
                                    index={index}
                                    isCurrentStep={isCurrent}
                                    currentDisplayText={isCurrent ? currentDisplayText : ''}
                                    isTyping={isCurrent ? isTyping : false}
                                    isWaitingForData={isWaitingForData}
                                    onChoiceClick={onChoiceClick}
                                />
                        );
                    })}
                    
                    {showDotLoader && (
                        <div className={styles.inlineLoadingWrapper}>
                            <div className={styles.inlineLoader}>
                                <div className={styles.loaderDot}></div>
                                <div className={styles.loaderDot}></div>
                                <div className={styles.loaderDot}></div>
                            </div>
                        </div>
                    )}
                </div>
                {showComposer ? (
                    <div className={styles.textModeComposer} aria-label="自定义输入">
                        <div className={styles.customInputHeader}>
                            <span>或者自定义输入</span>
                        </div>
                        <div className={styles.customInputWrapper}>
                            <input
                                type="text"
                                className={styles.customInput}
                                placeholder="输入你想说的话或行动..."
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                disabled={isWaitingForData}
                            />
                            <button
                                type="button"
                                className={styles.customInputButton}
                                onClick={handleCustomSubmit}
                                disabled={!customInput.trim() || isWaitingForData}
                            >
                                发送
                            </button>
                        </div>
                    </div>
                ) : null}
                </>
            )}
        </div>
    );
};

export default TextModeDisplay;

