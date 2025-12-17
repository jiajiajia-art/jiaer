import React, { useEffect, useRef, memo, useState } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import ColoredMarkdownText from '../Galgame/ColoredMarkdownText';
import styles from '../Galgame/TextModeDisplay.module.css';

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
}

interface MessageItemProps {
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    isWaitingForData: boolean;
    onChoiceClick?: (option: { id: number | string; text: string; optionId?: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
}

const MessageItem = memo<MessageItemProps>(({ 
    step, 
    isCurrentStep, 
    currentDisplayText, 
    isTyping,
    isWaitingForData,
    onChoiceClick, 
    onCustomInputSubmit 
}) => {
    const [customInput, setCustomInput] = useState('');

    if (!step) return null;

    const handleCustomSubmit = () => {
        if (customInput.trim() && onCustomInputSubmit && !isTyping && !isWaitingForData) {
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
        // 只有当前步骤且正在打字时，才显示打字文本
        // 打字完成后，应该显示完整内容，而不是部分文本
        if (isCurrentStep && isTyping && currentDisplayText) {
            return currentDisplayText;
        }
        // 否则显示完整内容（包括打字完成后的当前步骤）
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
                            
                            {/* 自定义输入区域 */}
                            <div className={styles.customInputSection}>
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
                                        onKeyDown={handleKeyDown}
                                        disabled={isTyping || isWaitingForData}
                                    />
                                    <button 
                                        className={styles.customInputButton}
                                        onClick={handleCustomSubmit}
                                        disabled={!customInput.trim() || isTyping || isWaitingForData}
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
    onChoiceClick,
    onCustomInputSubmit
}) => {
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    useEffect(() => {
        if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [steps]);

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

