import React, { useState } from 'react';
import { MdArrowDropDown } from 'react-icons/md';
import styles from './WorldPanel.module.css';

export interface StoryLine {
    id: string;
    tag: string;
    content: string;
    order: number; // 顺序字段，用于排序
    index: number; // 用户可见的序号，用于排序
}

interface StorylinesSectionProps {
    storylines: StoryLine[];
    isExpanded: boolean;
    error?: string;
    isWorldInteractionMode: boolean;
    onToggleExpand: () => void;
    onAddStoryline: () => void;
    onStorylineChange: (id: string, key: 'tag' | 'content' | 'index', value: string | number) => void;
    onRemoveStoryline: (id: string) => void;
}

const StorylinesSection: React.FC<StorylinesSectionProps> = ({
    storylines,
    isExpanded,
    error,
    isWorldInteractionMode,
    onToggleExpand,
    onAddStoryline,
    onStorylineChange,
    onRemoveStoryline,
}) => {
    // 按 index 排序（用户可见的序号）
    const sortedStorylines = [...storylines].sort((a, b) => a.index - b.index);
    
    // 本地状态保存用户正在输入的序号值（避免输入时被重置）
    const [editingIndex, setEditingIndex] = useState<Record<string, string>>({});
    return (
        <div className={styles.storylineSection}>
            <div className={styles.storylineHeader} style={{ cursor: 'pointer' }} onClick={onToggleExpand}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <span className={styles.fieldLabel}>
                        {isWorldInteractionMode ? (
                            <>
                                故事线
                                <span className={styles.required}>*</span>
                                <span style={{ color: 'var(--primary)', fontWeight: 600, marginLeft: '8px' }}>（必填）</span>
                            </>
                        ) : (
                            '故事线（可选）'
                        )}
                    </span>
                    {isWorldInteractionMode && (
                        <span className={styles.fieldHint} style={{ fontSize: '0.8rem', color: 'rgba(224, 61, 75, 0.8)' }}>
                            用于约束世界交互节奏，必须至少添加一条
                        </span>
                    )}
                    {!isExpanded && isWorldInteractionMode && storylines.length === 0 && (
                        <span className={styles.errorText} style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                            请添加至少一条故事线
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isExpanded && (
                        <button
                            className={styles.ghostSmall}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddStoryline();
                            }}
                        >
                            + 添加故事线
                        </button>
                    )}
                    <MdArrowDropDown size={30} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
            </div>
            {isExpanded && (
                <>
                    <span className={styles.fieldHint} style={{ marginBottom: '16px', display: 'block' }}>
                        用标签 + 内容描述关键剧情走向，方便约束 AI 推演。
                    </span>
                    {error && (
                        <span className={styles.errorText} style={{ marginBottom: '12px', display: 'block' }}>
                            {error}
                        </span>
                    )}
                    <div className={styles.storylineList}>
                        {sortedStorylines.length === 0 ? (
                            <p className={isWorldInteractionMode ? styles.emptyHintRequired : styles.emptyHint}>
                                {isWorldInteractionMode
                                    ? '⚠️ 请至少添加一条故事线（世界交互模式下为必填项）'
                                    : '暂未添加故事线。可按时间、好感或章节自定义标签。'}
                            </p>
                        ) : (
                            sortedStorylines.map((line) => (
                                <div key={line.id} className={styles.storylineRow}>
                                    <label className={styles.storylineOrderLabel}>
                                        <span>序号</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editingIndex[line.id] !== undefined ? editingIndex[line.id] : line.index}
                                            onChange={(e) => {
                                                // 保存用户正在输入的值到本地状态
                                                setEditingIndex(prev => ({ ...prev, [line.id]: e.target.value }));
                                            }}
                                            onBlur={(e) => {
                                                const newIndex = parseInt(e.target.value, 10);
                                                if (!isNaN(newIndex) && newIndex > 0) {
                                                    onStorylineChange(line.id, 'index', newIndex);
                                                }
                                                // 清除本地状态
                                                setEditingIndex(prev => {
                                                    const next = { ...prev };
                                                    delete next[line.id];
                                                    return next;
                                                });
                                            }}
                                            onKeyDown={(e) => {
                                                // 按Enter键时也触发blur
                                                if (e.key === 'Enter') {
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className={styles.orderInput}
                                        />
                                    </label>
                                    <div className={styles.storylineContent}>
                                        <div className={styles.storylineMeta}>
                                            <label>
                                                <span>标签</span>
                                                <input
                                                    type="text"
                                                    value={line.tag}
                                                    onChange={(e) => onStorylineChange(line.id, 'tag', e.target.value)}
                                                />
                                            </label>
                                        </div>
                                        <label className={styles.wide}>
                                            <span>内容</span>
                                            <textarea
                                                rows={3}
                                                value={line.content}
                                                onChange={(e) => onStorylineChange(line.id, 'content', e.target.value)}
                                            />
                                        </label>
                                    </div>
                                    <button
                                        className={styles.ghostTiny}
                                        onClick={() => onRemoveStoryline(line.id)}
                                    >
                                        删除
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default StorylinesSection;

