import React, { useEffect, useRef, useState, memo } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './TextModeDisplay.module.css';

interface TextModalStep {
    id: string;
    type: 'narration' | 'dialogue' | 'choice' | 'transition' | 'scene_change';
    content: string;
    speakerName?: string;
    characterName?: string;
    isPlayer?: boolean;
    options?: Array<{ id: number; text: string; isMain?: boolean }>;
    title?: string;
    description?: string;
}

interface TextModeDisplayProps {
    steps: TextModalStep[];
    currentStepIndex: number;
    currentDisplayText: string;
    isTyping: boolean;
    isWaitingForData: boolean;
    historyLength: number;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
}

import { OPTION_COST, INPUT_COST, HISTORY_MESSAGE_THRESHOLD } from '../../utils/constants';

// 积分消耗配置
const POINTS_CONFIG = {
    option: OPTION_COST,
    custom: INPUT_COST,
};

// 前5条历史消息免费
const FREE_ROUNDS_THRESHOLD = HISTORY_MESSAGE_THRESHOLD * 2; // 每回2条消息

interface MessageItemProps {
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    historyLength: number;
    isWaitingForData: boolean;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
}

const MessageItem = memo<MessageItemProps>(({ 
    step, 
    isCurrentStep, 
    currentDisplayText, 
    isTyping, 
    historyLength,
    isWaitingForData,
    onChoiceClick, 
    onCustomInputSubmit 
}) => {
    const [customInput, setCustomInput] = useState('');

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

    // 计算要显示的文本
    const getDisplayText = () => {
        // 当前步骤处于打字中：始终使用打字中的文本（即使刚开始还是空串）
        // 这样可以避免“先整段闪一下再开始打字”的问题
        if (isCurrentStep && isTyping) {
            return currentDisplayText || '';
        }
        // 其它情况：显示完整内容（包括打字结束后的当前步骤，以及历史步骤）
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
                                        className={`${styles.optionItem} ${opt.isMain ? styles.optionItemMain : ''}`}
                                        onClick={() => {
                                            if (onChoiceClick && !isTyping) {
                                                onChoiceClick(opt);
                                            }
                                        }}
                                        style={{ 
                                            cursor: onChoiceClick && !isTyping ? 'pointer' : 'default' 
                                        }}
                                        >
                                        <span className={`${styles.optionText} ${opt.isMain ? styles.optionTextMain : ''}`}>
                                            {extractPlainText(opt.text)}
                                        </span>
                                        {historyLength >= FREE_ROUNDS_THRESHOLD && (
                                            <span className={styles.pointsCost}>-{POINTS_CONFIG.option}积分</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {/* 自定义输入区域 */}
                            <div className={styles.customInputSection}>
                                <div className={styles.customInputHeader}>
                                    <span>或者自定义输入</span>
                                    {historyLength >= FREE_ROUNDS_THRESHOLD && (
                                        <span className={styles.pointsCostHint}>消耗 {POINTS_CONFIG.custom} 积分</span>
                                    )}
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
        const displayText = getDisplayText();
        
        return (
            <div className={styles.messageWrapper}>
                <div className={styles.sceneChangeBubble}>
                    <ColoredMarkdownText text={displayText} showCursor={isCurrentStep && isTyping} />
                </div>
            </div>
        );
    }

    return null;
});

const TextModeDisplay: React.FC<TextModeDisplayProps> = ({
    steps,
    currentStepIndex,
    currentDisplayText,
    isTyping,
    isWaitingForData,
    historyLength,
    onChoiceClick,
    onCustomInputSubmit
}) => {
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const shouldStickToBottomRef = useRef(true);
    const hasInitialAutoScrolledRef = useRef(false);

    // 跟踪用户是否“贴底”（用户往上滚动阅读时不要强制拉回底部）
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;

        const handleScroll = () => {
            const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            shouldStickToBottomRef.current = distanceToBottom < 80; // 80px 阈值
        };

        // 初始化一次
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
    }, [steps.length, currentStepIndex, currentDisplayText, isTyping, isWaitingForData]);

    const lastStep = steps.length > 0 ? steps[steps.length - 1] : null;
    const lastStepIsChoice = lastStep?.type === 'choice';
    
    const showMainLoader = isWaitingForData && (steps.length === 0 || lastStepIsChoice);
    
    const showDotLoader = isWaitingForData && steps.length > 0 && !isTyping && !lastStepIsChoice;

    return (
        <div className={styles.textModeContainer}>
            {steps.length === 0 && !isWaitingForData ? (
                <div className={styles.emptyState}>暂无内容</div>
            ) : (
                <div className={styles.messagesContainer} ref={messagesContainerRef}>
                    {steps.map((step, index) => {
                        // 只有当前步骤才传递打字相关状态
                        const isCurrent = index === currentStepIndex && currentStepIndex >= 0;

                        // 避免等待流数据时把“当前正在生成”的 choice 插入中间；历史 choice 正常显示
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
                                historyLength={historyLength}
                                isWaitingForData={isWaitingForData}
                                onChoiceClick={onChoiceClick}
                                onCustomInputSubmit={onCustomInputSubmit}
                            />
                        );
                    })}
                    
                    {showMainLoader && (
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
                    
                    {/* Step 之间的间隙：三点加载 */}
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
            )}
        </div>
    );
};

export default TextModeDisplay;
