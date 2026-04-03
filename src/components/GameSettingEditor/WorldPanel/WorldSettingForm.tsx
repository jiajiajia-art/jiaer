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
    themeTags: Array<{ id: number; name: string; parentName: string; pathLabel?: string }>;
    selectedThemeTagIds: number[];
    targetOutputLength?: number;
    minOutputLength?: number;
    maxOutputLength?: number;
    onTitleChange: (value: string) => void;
    onTaglineChange: (value: string) => void;
    onEraChange: (value: string) => void;
    onOpeningChange: (value: string) => void;
    onOpeningPlotChange: (value: string) => void;
    onThemeTagToggle: (tagId: number) => void;
    onTargetOutputLengthChange: (value: number | undefined) => void;
    onMinOutputLengthChange: (value: number | undefined) => void;
    onMaxOutputLengthChange: (value: number | undefined) => void;
    openingError?: string;
    openingPlotError?: string;
    themeTagError?: string;
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
    themeTags,
    selectedThemeTagIds,
    targetOutputLength,
    minOutputLength,
    maxOutputLength,
    onTitleChange,
    onTaglineChange,
    onEraChange,
    onOpeningChange,
    onOpeningPlotChange,
    onThemeTagToggle,
    onTargetOutputLengthChange,
    onMinOutputLengthChange,
    onMaxOutputLengthChange,
    openingError,
    openingPlotError,
    themeTagError,
}) => {
    const titleWords = useWordCount(title);
    const taglineWords = useWordCount(tagline);
    const eraWords = useWordCount(era);
    const openingWords = useWordCount(opening);
    const openingPlotWords = useWordCount(openingPlot);

    const titleLimit = useWordLimit(WORD_LIMITS.title, onTitleChange);
    const taglineLimit = useWordLimit(WORD_LIMITS.tagline, onTaglineChange);
    const eraLimit = useWordLimit(WORD_LIMITS.era, onEraChange);
    const openingLimit = useWordLimit(WORD_LIMITS.opening, onOpeningChange);
    const openingPlotLimit = useWordLimit(WORD_LIMITS.openingPlot, onOpeningPlotChange);

    return (
        <>
            {/* 按 Step3、Step4 的分块结构重组世界观表单。 */}
            <section className={styles.detailBlock}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <h3 className={styles.sectionTitle}>基础信息</h3>
                        <p className={styles.sectionDescription}>先确认作品的对外信息与玩家身份描述。</p>
                    </div>
                </div>

                <div className={styles.formGrid}>
                    <label>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>作品标题</span>
                            <span className={styles.wordCounter}>{titleWords}/{WORD_LIMITS.title}</span>
                        </div>
                        <input
                            type="text"
                            value={title}
                            {...titleLimit}
                        />
                    </label>

                    <label>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>一句话概述</span>
                            <span className={styles.wordCounter}>{taglineWords}/{WORD_LIMITS.tagline}</span>
                        </div>
                        <input
                            type="text"
                            value={tagline}
                            {...taglineLimit}
                        />
                    </label>

                    {/* 修复题材按钮误命中首个标签 */}
                    <div className={styles.wide}>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>作品标签<span className={styles.required}>*</span></span>
                            <span className={styles.fieldHint}>最少 1 个，最多 2 个</span>
                        </div>
                        <div className={styles.themeTagsWrap}>
                            {themeTags.map((tag) => {
                                const selected = selectedThemeTagIds.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`${styles.themeTagChip} ${selected ? styles.themeTagChipActive : ''}`}
                                        onClick={() => onThemeTagToggle(tag.id)}
                                        title={tag.pathLabel || tag.name}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                        {themeTagError && (
                            <div className={styles.errorMessage}>{themeTagError}</div>
                        )}
                    </div>

                    <label className={styles.wide}>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>玩家身份</span>
                        </div>
                        <span className={styles.fieldHintItalic}>玩家信息需要在“角色设定”面板中修改。</span>
                        <input
                            type="text"
                            value={playerRole}
                            disabled
                            className={styles.disabledInput}
                        />
                    </label>
                </div>
            </section>

            <section className={styles.detailBlock}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <h3 className={styles.sectionTitle}>世界背景</h3>
                        <p className={styles.sectionDescription}>整理时代背景、前情提要与世界运行规则。</p>
                    </div>
                </div>

                <label className={styles.fieldBlock}>
                    <div className={styles.fieldTopRow}>
                        <span className={styles.fieldLabel}>时代背景 / 前情提要</span>
                        <span className={styles.wordCounter}>{eraWords}/{WORD_LIMITS.era}</span>
                    </div>
                    <textarea
                        rows={6}
                        value={era}
                        {...eraLimit}
                    />
                </label>
            </section>

            <section className={styles.detailBlock}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <h3 className={styles.sectionTitle}>开场内容</h3>
                        <p className={styles.sectionDescription}>补齐玩家第一次进入游戏时最关键的文案与剧情骨架。</p>
                    </div>
                </div>

                <div className={styles.formStack}>
                    <label className={styles.fieldBlock}>
                        <div className={styles.fieldTopRow}>
                            <div className={styles.fieldMeta}>
                                <span className={styles.fieldLabel}>开场白<span className={styles.required}>*</span></span>
                                <span className={styles.fieldHint}>用于玩家进入游戏时的第一段旁白，可随时微调语气。</span>
                            </div>
                            <span className={styles.wordCounter}>{openingWords}/{WORD_LIMITS.opening}</span>
                        </div>
                        <textarea
                            rows={5}
                            value={opening}
                            {...openingLimit}
                            className={openingError ? styles.errorInput : ''}
                        />
                        {openingError && (
                            <div className={styles.errorMessage}>{openingError}</div>
                        )}
                    </label>

                    <label className={styles.fieldBlock}>
                        <div className={styles.fieldTopRow}>
                            <div className={styles.fieldMeta}>
                                <span className={styles.fieldLabel}>开场剧情<span className={styles.required}>*</span></span>
                                <span className={styles.fieldHint}>描述首轮推演到玩家做出第一个选择前的剧情骨架，用于引导 AI 把握节奏。</span>
                            </div>
                            <span className={styles.wordCounter}>{openingPlotWords}/{WORD_LIMITS.openingPlot}</span>
                        </div>
                        <textarea
                            rows={5}
                            value={openingPlot}
                            {...openingPlotLimit}
                            className={openingPlotError ? styles.errorInput : ''}
                        />
                        {openingPlotError && (
                            <div className={styles.errorMessage}>{openingPlotError}</div>
                        )}
                    </label>
                </div>
            </section>

            {mode === 'visual' && (
                <section className={styles.detailBlock}>
                    <div className={styles.sectionTitleRow}>
                        <div>
                            <h3 className={styles.sectionTitle}>输出字数</h3>
                            <p className={styles.sectionDescription}>按需约束模型回复长度，避免文本过短或过长。</p>
                        </div>
                    </div>

                    <div className={styles.outputLengthGrid}>
                        <label>
                            <span className={styles.fieldLabel}>最短</span>
                            <input
                                type="number"
                                min="0"
                                value={minOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onMinOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder="最短字数"
                            />
                        </label>

                        <label>
                            <span className={styles.fieldLabel}>目标</span>
                            <input
                                type="number"
                                min="0"
                                value={targetOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onTargetOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder="目标字数"
                            />
                        </label>

                        <label>
                            <span className={styles.fieldLabel}>最长</span>
                            <input
                                type="number"
                                min="0"
                                value={maxOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onMaxOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder="最长字数"
                            />
                        </label>
                    </div>
                </section>
            )}
        </>
    );
};

export default WorldSettingForm;
