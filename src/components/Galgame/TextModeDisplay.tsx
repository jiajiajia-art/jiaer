import React, { useEffect, useRef, useState, memo } from 'react';
import { extractPlainText } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './TextModeDisplay.module.css';
import { useTranslation } from 'react-i18next';

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
    /** 功能注释：阅读页全局 step 下标（窗口/虚拟列表时不等于本地 index） */
    globalStepIndex?: number;
}

interface TextModeDisplayProps {
    steps: TextModalStep[];
    currentStepIndex: number;
    currentDisplayText: string;
    isTyping: boolean;
    isWaitingForData: boolean;
    isCompressingContext?: boolean;
    historyLength: number;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    onCustomInputSubmit?: (value: string) => void;
    isFreeRound?: boolean;
    /** 只读模式：隐藏自定义输入，选项不可点击（小说阅读等） */
    readOnly?: boolean;
    /** 浅色阅读页（小说阅读器白底） */
    surface?: 'dark' | 'light';
}

import { OPTION_COST, INPUT_COST } from '../../utils/constants';

// 积分消耗配置
const POINTS_CONFIG = {
    option: OPTION_COST,
    custom: INPUT_COST,
};

// 现在不再按历史条数判断是否收费，统一按固定积分展示

interface MessageItemProps {
    step: TextModalStep;
    index: number;
    isCurrentStep: boolean;
    currentDisplayText: string;
    isTyping: boolean;
    historyLength: number;
    isWaitingForData: boolean;
    isCompressingContext?: boolean;
    onChoiceClick?: (option: { id: number; text: string }) => void;
    isFreeRound?: boolean;
    readOnly?: boolean;
    surface?: 'dark' | 'light';
    t: (key: string) => string;
}

const MessageItem = memo<MessageItemProps>(({ 
    step,
    index,
    isCurrentStep, 
    currentDisplayText, 
    isTyping,
    isWaitingForData,
    isCompressingContext = false,
    onChoiceClick, 
    isFreeRound = false,
    readOnly = false,
    t,
    surface = 'dark',
}) => {
    if (!step) return null;

    // 功能注释：只读阅读页用全局下标做目录锚点，避免窗口局部 index 错位
    const stepAnchorProps = readOnly
        ? {
            'data-novel-step-index': String(
                typeof step.globalStepIndex === 'number' ? step.globalStepIndex : index,
            ),
          }
        : {};

    // 根据类型渲染不同的消息样式
    const getDisplayText = () => {
        // 当前步骤处于打字中：始终使用打字中的文本（即使刚开始还是空串）
        // 这样可以避免“先整段闪一下再开始打字”的问题
        if (isCurrentStep && isTyping) {
            return currentDisplayText || '';
        }
        // 其它情况：显示完整内容（包括打字结束后的当前步骤，以及历史步骤）
        return step.content || '';
    };

    if (step.type === 'narration' || step.type === 'transition') {
        const displayText = getDisplayText();
        
        return (
            <div className={styles.messageWrapper} {...stepAnchorProps}>
                <div className={styles.narrationBubble}>
                    {surface !== 'light' ? (
                        <div className={styles.narrationLabel}>{t('createGame.narration')}</div>
                    ) : null}
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
            <div className={styles.messageWrapper} {...stepAnchorProps}>
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

        const hasOptions = !!step.options && step.options.length > 0;

        return (
            <div className={styles.messageWrapper} {...stepAnchorProps}>
                <div className={styles.choiceBubble}>
                    {step.title && (
                        <div className={styles.choiceTitle}>{step.title}</div>
                    )}
                    {step.description && (
                        <div className={styles.choiceDescription}>
                            <ColoredMarkdownText text={step.description} />
                        </div>
                    )}
                    {hasOptions && (
                        <div className={styles.optionsList}>
                            {step.options!.map((opt) => (
                                <div 
                                    key={opt.id} 
                                    className={`${styles.optionItem} ${opt.isMain ? styles.optionItemMain : ''}`}
                                    onClick={() => {
                                        if (!readOnly && onChoiceClick && !isTyping && !isCompressingContext) {
                                            onChoiceClick(opt);
                                        }
                                    }}
                                    style={{ 
                                        cursor: !readOnly && onChoiceClick && !isTyping && !isCompressingContext ? 'pointer' : 'default' 
                                    }}
                                >
                                    <span className={`${styles.optionText} ${opt.isMain ? styles.optionTextMain : ''}`}>
                                        {extractPlainText(opt.text)}
                                    </span>
                                    {!readOnly && !isFreeRound && (
                                        <span className={styles.pointsCost}>-{POINTS_CONFIG.option}{t('createGame.pointsUnit')}</span>
                                    )}
                                </div>
                            ))}
                        </div>
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
    isCompressingContext = false,
    historyLength,
    onChoiceClick,
    onCustomInputSubmit,
    isFreeRound = false,
    readOnly = false,
    surface = 'dark',
}) => {
    const { t } = useTranslation();
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const shouldStickToBottomRef = useRef(true);
    const hasInitialAutoScrolledRef = useRef(false);
    const [customInput, setCustomInput] = useState('');

    const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null;
    const currentChoiceHasOptions = (currentStep?.options?.length ?? 0) > 0;
    const showComposer = Boolean(
        !readOnly
        && onCustomInputSubmit
        && currentStep?.type === 'choice'
        && !isTyping
        && !(isWaitingForData && currentStepIndex >= 0 && steps[currentStepIndex]?.type === 'choice'),
    );

    useEffect(() => {
        setCustomInput('');
    }, [currentStep?.id]);

    const handleCustomSubmit = () => {
        if (!customInput.trim() || !onCustomInputSubmit || isTyping || isCompressingContext) return;
        onCustomInputSubmit(customInput.trim());
        setCustomInput('');
    };

    const handleCustomKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCustomSubmit();
        }
    };

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

    // 功能注释：进入文本模式或步骤骤增时，首帧滚到底部，避免切换后卡在中间无法继续阅读。
    useEffect(() => {
        hasInitialAutoScrolledRef.current = false;
        shouldStickToBottomRef.current = true;
    }, [steps.length > 0 ? steps[0]?.id : 'empty']);

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
        <div className={`${styles.textModeContainer} ${surface === 'light' ? styles.textModeContainerLight : ''}`}>
            {steps.length === 0 && !isWaitingForData ? (
                <div className={styles.emptyState}>{t('createGame.noContent')}</div>
            ) : (
                <>
                <div
                    className={`${styles.messagesContainer}${showComposer ? ` ${styles.messagesContainerWithComposer}` : ''}`}
                    ref={messagesContainerRef}
                >
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
                                isCompressingContext={isCompressingContext}
                                onChoiceClick={onChoiceClick}
                                isFreeRound={isFreeRound}
                                readOnly={readOnly}
                                surface={surface}
                                t={t}
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
                                {isCompressingContext ? t('createGame.organizingMemory') : t('createGame.aiThinking')}<span className={styles.dots}></span>
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
                {showComposer ? (
                    <div className={styles.textModeComposer} aria-label={t('createGame.customInput')}>
                        <div className={styles.customInputHeader}>
                            <span>{currentChoiceHasOptions ? t('createGame.orCustomInput') : t('createGame.customInput')}</span>
                            {!isFreeRound && (
                                <span className={styles.pointsCostHint}>{t('createGame.pointsCostHint').replace('{{cost}}', String(POINTS_CONFIG.custom))}</span>
                            )}
                        </div>
                        <div className={styles.customInputWrapper}>
                            <input
                                type="text"
                                className={styles.customInput}
                                placeholder={t('createGame.inputPlaceholder')}
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                onKeyDown={handleCustomKeyDown}
                                disabled={isCompressingContext}
                            />
                            <button
                                type="button"
                                className={styles.customInputButton}
                                onClick={handleCustomSubmit}
                                disabled={!customInput.trim() || isCompressingContext}
                            >
                                {t('createGame.send')}
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
