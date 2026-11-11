import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MdKeyboardArrowDown } from 'react-icons/md';
import styles from './WorldPanel.module.css';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';

// 字数限制配置
const STORYLINE_WORD_LIMITS = {
    tag: 20,
    content: 400,
} as const;

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

// 故事线单项组件（内部管理字数限制）
const StorylineItem: React.FC<{
    line: StoryLine;
    onStorylineChange: (id: string, key: 'tag' | 'content' | 'index', value: string | number) => void;
}> = ({ line, onStorylineChange }) => {
    const { t } = useTranslation();
    const tagWords = useWordCount(line.tag);
    const contentWords = useWordCount(line.content);
    const tagLimit = useWordLimit(STORYLINE_WORD_LIMITS.tag, (value) => onStorylineChange(line.id, 'tag', value));
    const contentLimit = useWordLimit(STORYLINE_WORD_LIMITS.content, (value) => onStorylineChange(line.id, 'content', value));

    return (
        <div className={styles.storylineContent}>
            <div className={styles.storylineMeta}>
                <label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <span>{t('createGame.storylineTag')}</span>
                        <span className={styles.wordCounter}>
                            {tagWords}/{STORYLINE_WORD_LIMITS.tag}
                        </span>
                    </div>
                    <input
                        type="text"
                        value={line.tag}
                        {...tagLimit}
                    />
                </label>
            </div>
            <label className={styles.wide}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{t('createGame.storylineContent')}</span>
                    <span className={styles.wordCounter}>
                        {contentWords}/{STORYLINE_WORD_LIMITS.content}
                    </span>
                </div>
                <textarea
                    rows={3}
                    value={line.content}
                    {...contentLimit}
                />
            </label>
        </div>
    );
};

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
    const { t } = useTranslation();
    // 按 index 排序（用户可见的序号）
    const sortedStorylines = [...storylines].sort((a, b) => a.index - b.index);

    // 本地状态保存用户正在输入的序号值（避免输入时被重置）
    const [editingIndex, setEditingIndex] = useState<Record<string, string>>({});
    return (
        <div className={styles.storylineSection}>
            {/* 功能注释：效果图为设置行手风琴——标题左、chevron 右；新增按钮下沉到展开区 */}
            <button
                type="button"
                className={styles.accordionTrigger}
                onClick={onToggleExpand}
                aria-expanded={isExpanded}
            >
                <span className={styles.accordionTitle}>
                    {isWorldInteractionMode ? (
                        <>
                            {t('createGame.storyline')}
                            <span className={styles.required}>*</span>
                            <span className={styles.accordionRequiredHint}>{t('createGame.storylineRequired2')}</span>
                        </>
                    ) : (
                        t('createGame.storylineOptional')
                    )}
                </span>
                <MdKeyboardArrowDown
                    className={`${styles.accordionChevron} ${isExpanded ? styles.accordionChevronOpen : ''}`}
                    size={22}
                    aria-hidden
                />
            </button>
            {!isExpanded && isWorldInteractionMode && storylines.length === 0 && (
                <span className={styles.errorText}>{t('createGame.storylineAddRequired')}</span>
            )}
            {isExpanded && (
                <div className={styles.accordionBody}>
                    {isWorldInteractionMode && (
                        <span className={styles.fieldHint}>{t('createGame.storylineHint')}</span>
                    )}
                    <span className={styles.fieldHint}>{t('createGame.storylineDescription')}</span>
                    <button
                        type="button"
                        className={styles.ghostSmall}
                        onClick={onAddStoryline}
                    >
                        {t('createGame.addStoryline')}
                    </button>
                    {error && (
                        <span className={styles.errorText}>{error}</span>
                    )}
                    <div className={styles.storylineList}>
                        {sortedStorylines.length === 0 ? (
                            <p className={isWorldInteractionMode ? styles.emptyHintRequired : styles.emptyHint}>
                                {isWorldInteractionMode
                                    ? t('createGame.storylineEmptyRequired')
                                    : t('createGame.storylineEmptyOptional')}
                            </p>
                        ) : (
                            sortedStorylines.map((line) => (
                                <div key={line.id} className={styles.storylineRow}>
                                    <label className={styles.storylineOrderLabel}>
                                        <span>{t('createGame.storylineOrder')}</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={editingIndex[line.id] !== undefined ? editingIndex[line.id] : line.index}
                                            onChange={(e) => {
                                                setEditingIndex(prev => ({ ...prev, [line.id]: e.target.value }));
                                            }}
                                            onBlur={(e) => {
                                                const newIndex = parseInt(e.target.value, 10);
                                                if (!isNaN(newIndex) && newIndex > 0) {
                                                    onStorylineChange(line.id, 'index', newIndex);
                                                }
                                                setEditingIndex(prev => {
                                                    const next = { ...prev };
                                                    delete next[line.id];
                                                    return next;
                                                });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            className={styles.orderInput}
                                        />
                                    </label>
                                    <StorylineItem
                                        line={line}
                                        onStorylineChange={onStorylineChange}
                                    />
                                    <button
                                        className={styles.ghostTiny}
                                        onClick={() => onRemoveStoryline(line.id)}
                                    >
                                        {t('createGame.storylineDelete')}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StorylinesSection;
