import React from 'react';
import { MdArrowDropDown } from 'react-icons/md';
import styles from './WorldPanel.module.css';

export interface StoryLine {
    id: string;
    tag: string;
    content: string;
}

interface StorylinesSectionProps {
    storylines: StoryLine[];
    isExpanded: boolean;
    error?: string;
    isWorldInteractionMode: boolean;
    onToggleExpand: () => void;
    onAddStoryline: () => void;
    onStorylineChange: (id: string, key: 'tag' | 'content', value: string) => void;
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
                        {storylines.length === 0 ? (
                            <p className={isWorldInteractionMode ? styles.emptyHintRequired : styles.emptyHint}>
                                {isWorldInteractionMode
                                    ? '⚠️ 请至少添加一条故事线（世界交互模式下为必填项）'
                                    : '暂未添加故事线。可按时间、好感或章节自定义标签。'}
                            </p>
                        ) : (
                            storylines.map((line) => (
                                <div key={line.id} className={styles.storylineRow}>
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

