import React from 'react';
import styles from './WorldPanel.module.css';

interface WorldSettingFormProps {
    mode: 'visual' | 'worldInteraction';
    title: string;
    tagline: string;
    era: string;
    worldRules: string;
    playerRole: string;
    opening: string;
    openingPlot: string;
    targetOutputLength?: number;
    minOutputLength?: number;
    maxOutputLength?: number;
    onTitleChange: (value: string) => void;
    onTaglineChange: (value: string) => void;
    onEraChange: (value: string) => void;
    onWorldRulesChange: (value: string) => void;
    onOpeningChange: (value: string) => void;
    onOpeningPlotChange: (value: string) => void;
    onTargetOutputLengthChange: (value: number | undefined) => void;
    onMinOutputLengthChange: (value: number | undefined) => void;
    onMaxOutputLengthChange: (value: number | undefined) => void;
}

const WorldSettingForm: React.FC<WorldSettingFormProps> = ({
    mode,
    title,
    tagline,
    era,
    worldRules,
    playerRole,
    opening,
    openingPlot,
    targetOutputLength,
    minOutputLength,
    maxOutputLength,
    onTitleChange,
    onTaglineChange,
    onEraChange,
    onWorldRulesChange,
    onOpeningChange,
    onOpeningPlotChange,
    onTargetOutputLengthChange,
    onMinOutputLengthChange,
    onMaxOutputLengthChange,
}) => {
    return (
        <>
            {/* 作品标题 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>作品标题</span>
                </div>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                />
            </div>

            {/* 一句话概述 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>一句话概述</span>
                </div>
                <input
                    type="text"
                    value={tagline}
                    onChange={(e) => onTaglineChange(e.target.value)}
                />
            </div>

            {/* 时代背景 / 前情提要 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>时代背景 / 前情提要</span>
                </div>
                <textarea
                    rows={6}
                    value={era}
                    onChange={(e) => onEraChange(e.target.value)}
                />
            </div>

            {/* 世界规则 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>世界规则</span>
                </div>
                <textarea
                    rows={4}
                    value={worldRules}
                    onChange={(e) => onWorldRulesChange(e.target.value)}
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
                    <span className={styles.fieldLabel}>开场白</span>
                    <span className={styles.fieldHint}>用于玩家进入游戏时的第一段旁白，可随时微调语气。</span>
                </div>
                <textarea
                    rows={5}
                    value={opening}
                    onChange={(e) => onOpeningChange(e.target.value)}
                />
            </div>

            {/* 开场剧情 */}
            <div className={styles.formRow}>
                <div className={styles.fieldHeader}>
                    <span className={styles.fieldLabel}>开场剧情</span>
                    <span className={styles.fieldHint}>描述第一轮推演至玩家做出首个选择前的剧情骨架，用于引导 AI 理解节奏。</span>
                </div>
                <textarea
                    rows={5}
                    value={openingPlot}
                    onChange={(e) => onOpeningPlotChange(e.target.value)}
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

