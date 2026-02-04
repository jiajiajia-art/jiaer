import React from 'react';
import styles from './WorldPanel.module.css';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';

interface WorldSettingFormProps {
    mode: 'visual' | 'worldInteraction';
    title: string;
    tagline: string;
    era: string;
    playerRole: string;
    opening: string;
    openingPlot: string;
    targetOutputLength?: number;
    minOutputLength?: number;
    maxOutputLength?: number;
    onTitleChange: (value: string) => void;
    onTaglineChange: (value: string) => void;
    onEraChange: (value: string) => void;
    onOpeningChange: (value: string) => void;
    onOpeningPlotChange: (value: string) => void;
    onTargetOutputLengthChange: (value: number | undefined) => void;
    onMinOutputLengthChange: (value: number | undefined) => void;
    onMaxOutputLengthChange: (value: number | undefined) => void;
}

const WORD_LIMITS = {
    title: 20,
    tagline: 50,
    era: 500,
    opening: 400,
    openingPlot: 500,
} as const;

const WorldSettingForm: React.FC<WorldSettingFormProps> = ({
    mode,
    title,
    tagline,
    era,
    playerRole,
    opening,
    openingPlot,
    targetOutputLength,
    minOutputLength,
    maxOutputLength,
    onTitleChange,
    onTaglineChange,
    onEraChange,
    onOpeningChange,
    onOpeningPlotChange,
    onTargetOutputLengthChange,
    onMinOutputLengthChange,
    onMaxOutputLengthChange,
}) => {
    // 字数统计
    const titleWords = useWordCount(title);
    const taglineWords = useWordCount(tagline);
    const eraWords = useWordCount(era);
    const openingWords = useWordCount(opening);
    const openingPlotWords = useWordCount(openingPlot);

    // 字数限制处理
    const titleLimit = useWordLimit(WORD_LIMITS.title, onTitleChange);
    const taglineLimit = useWordLimit(WORD_LIMITS.tagline, onTaglineChange);
    const eraLimit = useWordLimit(WORD_LIMITS.era, onEraChange);
    const openingLimit = useWordLimit(WORD_LIMITS.opening, onOpeningChange);
    const openingPlotLimit = useWordLimit(WORD_LIMITS.openingPlot, onOpeningPlotChange);

    return (
        <>
            {/* 作品标题 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>作品标题</span>
                    <span className={styles.wordCounter}>
                        {titleWords}/{WORD_LIMITS.title}
                    </span>
                </div>
                <input
                    type="text"
                    value={title}
                    {...titleLimit}
                />
            </div>

            {/* 一句话概述 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>一句话概述</span>
                    <span className={styles.wordCounter}>
                        {taglineWords}/{WORD_LIMITS.tagline}
                    </span>
                </div>
                <input
                    type="text"
                    value={tagline}
                    {...taglineLimit}
                />
            </div>

            {/* 时代背景 / 前情提要 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>时代背景 / 前情提要</span>
                    <span className={styles.wordCounter}>
                        {eraWords}/{WORD_LIMITS.era}
                    </span>
                </div>
                <textarea
                    rows={6}
                    value={era}
                    {...eraLimit}
                />
            </div>

            {/* 玩家身份（只读） */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>玩家身份</span>
                    <span className={styles.fieldHintItalic}>
                        玩家信息需要在"角色设定"面板中修改
                    </span>
                </div>
                <input
                    type="text"
                    value={playerRole}
                    disabled
                    className={styles.disabledInput}
                />
            </div>

            {/* 开场白 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <span className={styles.fieldLabel}>开场白</span>
                            <span className={styles.fieldHint}>用于玩家进入游戏时的第一段旁白，可随时微调语气。</span>
                        </div>
                        <span className={styles.wordCounter}>
                            {openingWords}/{WORD_LIMITS.opening}
                        </span>
                    </div>
                </div>
                <textarea
                    rows={5}
                    value={opening}
                    {...openingLimit}
                />
            </div>

            {/* 开场剧情 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <span className={styles.fieldLabel}>开场剧情</span>
                            <span className={styles.fieldHint}>描述第一轮推演至玩家做出首个选择前的剧情骨架，用于引导 AI 理解节奏。</span>
                        </div>
                        <span className={styles.wordCounter}>
                            {openingPlotWords}/{WORD_LIMITS.openingPlot}
                        </span>
                    </div>
                </div>
                <textarea
                    rows={5}
                    value={openingPlot}
                    {...openingPlotLimit}
                />
            </div>

            {
                mode === 'visual' && (
                    <div className={styles.formRow}>
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldLabel}>模型输出字数限制</span>
                        </div>
                        <div className={styles.outputLengthContainer}>
                            <div className={styles.outputLengthField}>
                                <label className={styles.outputLengthLabel}>最短</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minOutputLength ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                        onMinOutputLengthChange(isNaN(value as number) ? undefined : value);
                                    }}
                                    placeholder="最短字数"
                                />
                            </div>
                            <div className={styles.outputLengthField}>
                                <label className={styles.outputLengthLabel}>目标</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={targetOutputLength ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                        onTargetOutputLengthChange(isNaN(value as number) ? undefined : value);
                                    }}
                                    placeholder="目标字数"
                                />
                            </div>
                            <div className={styles.outputLengthField}>
                                <label className={styles.outputLengthLabel}>最长</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={maxOutputLength ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                        onMaxOutputLengthChange(isNaN(value as number) ? undefined : value);
                                    }}
                                    placeholder="最长字数"
                                />
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
};

export default WorldSettingForm;

