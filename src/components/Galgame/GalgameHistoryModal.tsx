import { useState, useRef, useEffect, useCallback } from 'react';
import { MdRefresh, MdEdit, MdCheck, MdClose } from 'react-icons/md';
import type { HistoryWithId } from '../../hooks/galgame/useGalgameHistory';
import { processGameTags } from '../../utils/textUtils';
import ColoredMarkdownText from './ColoredMarkdownText';
import styles from './GalgameHistoryModal.module.css';

interface GalgameHistoryModalProps {
    isOpen: boolean;
    history: HistoryWithId[];
    backgroundImage: string;
    onClose: () => void;
    onRegenerate?: (messageIndex: number) => void;
    onEditSave?: (historyIndex: number, content: string) => Promise<boolean>;
}

const GalgameHistoryModal = ({ isOpen, history, onClose, onRegenerate, onEditSave, backgroundImage }: GalgameHistoryModalProps) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editContent, setEditContent] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    if (!isOpen) return null;

    // 计算每条消息在原始历史中的索引
    const getMessageIndex = (itemIndex: number): number => {
        return itemIndex;
    };

    const handleRegenerate = (itemIndex: number) => {
        if (onRegenerate) {
            const messageIndex = getMessageIndex(itemIndex + 1);
            onRegenerate(messageIndex);
        }
    };

    const handleStartEdit = (index: number, originalContent: string) => {
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
        <div className={styles.modalOverlay}
            style={{
                backgroundImage: `url(${backgroundImage})`
            }}
         onClick={onClose}>
            <div className={styles.modalContent}
             onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2 className={styles.modalTitle}>历史记录</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    {history.length === 0 ? (
                        <div className={styles.emptyState}>暂无历史记录</div>
                    ) : (
                        <div className={styles.chatMessages}>
                            {history.map((item, index) => {
                                const isUser = item.role === 'user';
                                const isEditing = editingIndex === index;
                                
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
                                
                                // 助手消息 - 左侧气泡（使用统一的 processGameTags 处理游戏标签）
                                const processedContent = processGameTags(item.content || '');
                                
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
                                                            onClick={() => handleSaveEdit(index)}
                                                            disabled={isSaving}
                                                        >
                                                            <MdCheck />
                                                            <span>{isSaving ? '保存中...' : '保存'}</span>
                                                        </button>
                                                        <button
                                                            className={styles.cancelButton}
                                                            onClick={handleCancelEdit}
                                                            disabled={isSaving}
                                                        >
                                                            <MdClose />
                                                            <span>取消</span>
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
                                                                onClick={() => handleStartEdit(index, item.content || '')}
                                                                title="编辑消息"
                                                            >
                                                                <MdEdit />
                                                                <span>编辑</span>
                                                            </button>
                                                        )}
                                                        {onRegenerate && (
                                                            <button 
                                                                className={styles.regenerateButton}
                                                                onClick={() => handleRegenerate(index)}
                                                                title="重新生成"
                                                            >
                                                                <MdRefresh />
                                                                <span>重新生成</span>
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
            </div>
        </div>
    );
};

export default GalgameHistoryModal;
