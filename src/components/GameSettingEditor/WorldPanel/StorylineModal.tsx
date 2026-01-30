import React, { useState, useEffect } from 'react';
import styles from './WorldPanel.module.css';
import { useWordLimit, useWordCount } from '../../../hooks/useWordLimit';

// 字数限制配置
const STORYLINE_WORD_LIMITS = {
    tag: 20,
    content: 400,
} as const;

export interface StoryLine {
    id: string;
    tag: string;
    content: string;
    order: number; // 顺序字段
    index: number; // 用户可见的序号
}

interface StorylineModalProps {
    visible: boolean;
    storyline: StoryLine | null; // null 表示新增，非 null 表示编辑
    defaultIndex?: number; // 新增时的默认序号
    maxIndex?: number; // 最大序号，用于验证
    onClose: () => void;
    onSave: (storyline: Omit<StoryLine, 'id' | 'order'>) => void;
}

const StorylineModal: React.FC<StorylineModalProps> = ({
    visible,
    storyline,
    defaultIndex = 1,
    maxIndex = 100,
    onClose,
    onSave,
}) => {
    const [tag, setTag] = useState('');
    const [content, setContent] = useState('');
    const [index, setIndex] = useState<number>(defaultIndex);
    const [indexInput, setIndexInput] = useState<string>(String(defaultIndex)); // 用于输入框的临时字符串值，允许清空

    // 字数统计和限制
    const tagWords = useWordCount(tag);
    const contentWords = useWordCount(content);
    const tagLimit = useWordLimit(STORYLINE_WORD_LIMITS.tag, setTag);
    const contentLimit = useWordLimit(STORYLINE_WORD_LIMITS.content, setContent);

    useEffect(() => {
        if (visible) {
            if (storyline) {
                // 编辑模式：填充现有数据
                setTag(storyline.tag);
                setContent(storyline.content);
                setIndex(storyline.index);
                setIndexInput(String(storyline.index));
            } else {
                // 新增模式：清空表单，使用默认序号
                setTag('');
                setContent('');
                setIndex(defaultIndex);
                setIndexInput(String(defaultIndex));
            }
        }
    }, [visible, storyline, defaultIndex]);

    const handleSave = () => {
        if (!tag.trim()) {
            return;
        }
        if (index < 1 || index > maxIndex) {
            return;
        }
        onSave({
            tag: tag.trim(),
            content: content.trim(),
            index: index,
        });
        onClose();
    };

    if (!visible) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3>{storyline ? '编辑故事线' : '添加故事线'}</h3>
                    <button className={styles.modalCloseBtn} onClick={onClose}>×</button>
                </div>
                <div className={styles.modalBody}>
                    <div className={styles.formGroup}>
                        <label>
                            <span>序号 <span className={styles.required}>*</span></span>
                            <input
                                type="number"
                                min="1"
                                max={maxIndex}
                                value={indexInput}
                                onChange={(e) => {
                                    // 允许用户输入任何值，包括清空输入框
                                    const inputValue = e.target.value;
                                    setIndexInput(inputValue);
                                    
                                    // 如果输入的是有效数字且在范围内，同时更新 index 状态
                                    const val = parseInt(inputValue, 10);
                                    if (!isNaN(val) && val >= 1 && val <= maxIndex) {
                                        setIndex(val);
                                    }
                                }}
                                onBlur={(e) => {
                                    // 失去焦点时，验证并修正值
                                    const inputValue = e.target.value.trim();
                                    if (!inputValue) {
                                        // 如果为空，恢复为当前 index 值
                                        setIndexInput(String(index));
                                    } else {
                                        const val = parseInt(inputValue, 10);
                                        if (isNaN(val) || val < 1) {
                                            setIndexInput('1');
                                            setIndex(1);
                                        } else if (val > maxIndex) {
                                            setIndexInput(String(maxIndex));
                                            setIndex(maxIndex);
                                        } else {
                                            setIndexInput(String(val));
                                            setIndex(val);
                                        }
                                    }
                                }}
                                placeholder="输入序号"
                            />
                        </label>
                    </div>
                    <div className={styles.formGroup}>
                        <label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span>标签 <span className={styles.required}>*</span></span>
                                <span className={styles.wordCounter}>
                                    {tagWords}/{STORYLINE_WORD_LIMITS.tag}
                                </span>
                            </div>
                            <input
                                type="text"
                                value={tag}
                                {...tagLimit}
                                placeholder="例如：阶段 1、第一章、关键转折点"
                                autoFocus
                            />
                        </label>
                    </div>
                    <div className={styles.formGroup}>
                        <label>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                <span>内容</span>
                                <span className={styles.wordCounter}>
                                    {contentWords}/{STORYLINE_WORD_LIMITS.content}
                                </span>
                            </div>
                            <textarea
                                rows={6}
                                value={content}
                                {...contentLimit}
                                placeholder="描述关键剧情走向..."
                            />
                        </label>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.ghost} onClick={onClose}>
                        取消
                    </button>
                    <button
                        className={styles.primary}
                        onClick={handleSave}
                        disabled={!tag.trim() || index < 1 || index > maxIndex}
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StorylineModal;

