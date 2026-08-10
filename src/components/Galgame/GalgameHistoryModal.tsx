import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MdRefresh, MdEdit, MdCheck, MdClose } from 'react-icons/md';
import type { HistoryWithId } from '../../hooks/galgame/useGalgameHistory';
import { processGameTags } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './GalgameHistoryModal.module.css';
import { logVisualButtonClick } from "../../api/statistics/scriptButtonEvent";
import { useTranslation } from 'react-i18next';

interface GalgameHistoryModalProps {
    isOpen: boolean;
    history: HistoryWithId[];
    backgroundImage: string;
    hasMoreBefore?: boolean;
    loadingMoreBefore?: boolean;
    onLoadMoreBefore?: () => Promise<void> | void;
    onRegenerate?: (messageIndex: number) => void;
    onEditSave?: (historyIndex: number, content: string) => Promise<boolean>;
    /** 历史面板底部「导出视觉小说」 */
    onExportVisualNovel?: () => void;
    /** 历史面板底部「返回」关闭历史 */
    onClose?: () => void;
    canExportVisualNovel?: boolean;
}

const GalgameHistoryModal = ({
    isOpen,
    history,
    onRegenerate,
    onEditSave,
    backgroundImage,
    hasMoreBefore = false,
    loadingMoreBefore = false,
    onLoadMoreBefore,
    onExportVisualNovel,
    onClose,
    canExportVisualNovel = false,
}: GalgameHistoryModalProps) => {
    const { t } = useTranslation();
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editContent, setEditContent] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const modalBodyRef = useRef<HTMLDivElement>(null);

    // 自动调整 textarea 高度
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    // 当编辑内容变化或开始编辑时调整高度
    useEffect(() => {
        if (editingIndex !== null) {
            adjustTextareaHeight();
        }
    }, [editContent, editingIndex, adjustTextareaHeight]);

    // 当历史记录变化或模态框打开时，滚动到底部
    const previousFirstIndexRef = useRef<number | null>(null);

    useEffect(() => {
        const firstIndex = history[0]?.absoluteIndex ?? null;
        const prependedEarlierHistory = previousFirstIndexRef.current !== null
            && firstIndex !== null
            && firstIndex < previousFirstIndexRef.current;
        previousFirstIndexRef.current = firstIndex;

        if (isOpen && modalBodyRef.current && !prependedEarlierHistory) {
            // 使用 requestAnimationFrame 和 setTimeout 确保 DOM 已完全渲染
            const scrollToBottom = () => {
                if (modalBodyRef.current) {
                    const container = modalBodyRef.current;
                    // 滚动到底部
                    container.scrollTop = container.scrollHeight;
                }
            };
            
            // 使用双重延迟确保内容已渲染
            requestAnimationFrame(() => {
                setTimeout(scrollToBottom, 100);
            });
        }
    }, [isOpen, history]);

    const handleBodyScroll = useCallback(() => {
        const container = modalBodyRef.current;
        if (!container || !hasMoreBefore || loadingMoreBefore || !onLoadMoreBefore) {
            return;
        }
        if (container.scrollTop > 80) {
            return;
        }
        const previousHeight = container.scrollHeight;
        Promise.resolve(onLoadMoreBefore()).then(() => {
            requestAnimationFrame(() => {
                const next = modalBodyRef.current;
                if (!next) return;
                next.scrollTop = next.scrollHeight - previousHeight + next.scrollTop;
            });
        });
    }, [hasMoreBefore, loadingMoreBefore, onLoadMoreBefore]);

    const processedAssistantContent = useMemo(() => {
        if (!isOpen) return [];

        return history.map((item, index) => {
            if (item.role === 'user') {
                return item.content || '';
            }
            if (
                item.kind === 'protagonist_change'
                || String(item.content || '').startsWith('【主角变更】')
            ) {
                return item.content || '';
            }

            const start = performance.now();
            const processed = processGameTags(item.content || '', t);
            const duration = performance.now() - start;

            if (duration > 20) {
                console.warn(
                    `[GalgameHistoryModal] processGameTags slow: ${duration.toFixed(2)}ms, index=${index}, content.length=${item.content?.length || 0}`
                );
            }

            return processed;
        });
    }, [history, isOpen, t]);

    if (!isOpen) return null;

    // 计算每条消息在原始历史中的索引
    const getMessageIndex = (itemIndex: number): number => {
        return history[itemIndex]?.absoluteIndex ?? itemIndex;
    };

    const handleRegenerate = (itemIndex: number) => {
        if (onRegenerate) {
            const messageIndex = getMessageIndex(itemIndex) + 1;
            logVisualButtonClick("history_regenerate");
            onRegenerate(messageIndex);
        }
    };

    const handleStartEdit = (index: number, originalContent: string) => {
        logVisualButtonClick("history_edit");
        setEditingIndex(index);
        setEditContent(originalContent);
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setEditContent('');
    };

    const handleSaveEdit = async (index: number) => {
        if (!onEditSave || !editContent.trim()) return;
        
        setIsSaving(true);
        try {
            // historyIndex 从 1 开始
            await onEditSave(index + 1, editContent);
            setEditingIndex(null);
            setEditContent('');
        } catch (error) {
            console.error('保存编辑失败:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={styles.modalOverlay} >
            <div className={styles.modalContent}
            style={{
                backgroundImage: `url(${backgroundImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            }}
             onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>{t('createGame.history')}</h2>
                </div>
                <div className={styles.modalBody} ref={modalBodyRef} onScroll={handleBodyScroll}>
                    {history.length === 0 ? (
                        <div className={styles.emptyState}>{t('createGame.noHistory')}</div>
                    ) : (
                        <div className={styles.chatMessages}>
                            {(hasMoreBefore || loadingMoreBefore) && (
                                <button
                                    type="button"
                                    className={styles.loadMoreButton}
                                    onClick={() => {
                                        void onLoadMoreBefore?.();
                                    }}
                                    disabled={loadingMoreBefore}
                                >
                                    {loadingMoreBefore ? 'Loading...' : 'Load earlier'}
                                </button>
                            )}
                            {history.map((item, index) => {
                                const isUser = item.role === 'user';
                                const isProtagonistChange =
                                    item.kind === 'protagonist_change'
                                    || String(item.content || '').startsWith('【主角变更】');
                                const isEditing = editingIndex === item.absoluteIndex;

                                if (isProtagonistChange) {
                                    return (
                                        <div key={item.id} className={styles.messageWrapper}>
                                            <div
                                                className={styles.protagonistChangeNotice}
                                                role="status"
                                            >
                                                {item.content}
                                            </div>
                                        </div>
                                    );
                                }

                                // 用户消息 - 右侧气泡
                                if (isUser) {
                                    return (
                                        <div key={item.id} className={styles.messageWrapper}>
                                            <div className={styles.userBubble}>
                                                {item.content}
                                            </div>
                                        </div>
                                    );
                                }
                                const processedContent = processedAssistantContent[index] || '';
                                return (
                                    <div key={item.id} className={styles.messageWrapper}>
                                        <div className={styles.assistantBubbleWrapper}>
                                            {isEditing ? (
                                                // 编辑模式
                                                <div className={styles.editContainer}>
                                                    <textarea
                                                        ref={textareaRef}
                                                        className={styles.editTextarea}
                                                        value={editContent}
                                                        onChange={(e) => {
                                                            setEditContent(e.target.value);
                                                            adjustTextareaHeight();
                                                        }}
                                                        disabled={isSaving}
                                                    />
                                                    <div className={styles.editActions}>
                                                        <button
                                                            className={styles.saveButton}
                                                            onClick={() => handleSaveEdit(item.absoluteIndex)}
                                                            disabled={isSaving}
                                                        >
                                                            <MdCheck />
                                                            <span>{isSaving ? t('createGame.saving') : t('createGame.save')}</span>
                                                        </button>
                                                        <button
                                                            className={styles.cancelButton}
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                        >
                                                            <MdClose />
                                                            <span>{t('createGame.cancel')}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // 显示模式
                                                <>
                                                    <div className={styles.assistantBubble}>
                                                        <ColoredMarkdownText text={processedContent} />
                                                    </div>
                                                    <div className={styles.actionButtons}>
                                                        {onEditSave && (
                                                            <button 
                                                                className={styles.editButton}
                                                                onClick={() => handleStartEdit(item.absoluteIndex, item.content || '')}
                                                                title={t('createGame.editMessage')}
                                                            >
                                                                <MdEdit />
                                                                <span>{t('createGame.edit')}</span>
                                                            </button>
                                                        )}
                                                        {onRegenerate && (
                                                            <button 
                                                                className={styles.regenerateButton}
                                                                onClick={() => handleRegenerate(index)}
                                                                title={t('createGame.regenerate')}
                                                            >
                                                                <MdRefresh />
                                                                <span>{t('createGame.regenerate')}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {(onExportVisualNovel || onClose) && (
                    <div className={styles.historyFooter}>
                        {onExportVisualNovel && (
                            <button
                                type="button"
                                className={styles.exportNovelButton}
                                disabled={!canExportVisualNovel}
                                onClick={() => {
                                    logVisualButtonClick('export_visual_novel');
                                    onExportVisualNovel();
                                }}
                            >
                                {t('galgame.exportVisualNovel')}
                            </button>
                        )}
                        {onClose && (
                            <button
                                type="button"
                                className={styles.historyBackButton}
                                onClick={() => {
                                    logVisualButtonClick('history_back');
                                    onClose();
                                }}
                            >
                                {t('galgame.historyBack')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GalgameHistoryModal;
