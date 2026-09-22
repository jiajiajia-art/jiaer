import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WorldPanel.module.css';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import InlineFieldSave from '../InlineFieldSave';
import { useLocalizedThemeTags } from '../../../utils/themeTags';
import ContentAudienceField from '../../ContentAudienceField';
import type { ContentAudience } from '../../../utils/contentAudience';

interface WorldSettingFormProps {
    mode: 'visual' | 'worldInteraction';
    title: string;
    tagline: string;
    era: string;
    premise: string;
    playerRole: string;
    opening: string;
    openingPlot: string;
    themeTags: Array<{ id: number; name: string; parentName: string; pathLabel?: string }>;
    selectedThemeTagIds: number[];
    audienceType: ContentAudience | null;
    targetOutputLength?: number;
    minOutputLength?: number;
    maxOutputLength?: number;
    onTitleChange: (value: string) => void;
    onTaglineChange: (value: string) => void;
    onEraChange: (value: string) => void;
    onPremiseChange: (value: string) => void;
    onOpeningChange: (value: string) => void;
    onOpeningPlotChange: (value: string) => void;
    onThemeTagToggle: (tagId: number) => void;
    onAudienceTypeChange: (value: ContentAudience) => void;
    onTargetOutputLengthChange: (value: number | undefined) => void;
    onMinOutputLengthChange: (value: number | undefined) => void;
    onMaxOutputLengthChange: (value: number | undefined) => void;
    titleDirty?: boolean;
    taglineDirty?: boolean;
    eraDirty?: boolean;
    premiseDirty?: boolean;
    openingDirty?: boolean;
    openingPlotDirty?: boolean;
    outputLengthDirty?: boolean;
    inlineSaveDisabled?: boolean;
    onTitleSave?: () => void | Promise<void> | Promise<boolean>;
    onTaglineSave?: () => void | Promise<void> | Promise<boolean>;
    onEraSave?: () => void | Promise<void> | Promise<boolean>;
    onPremiseSave?: () => void | Promise<void> | Promise<boolean>;
    onOpeningSave?: () => void | Promise<void> | Promise<boolean>;
    onOpeningPlotSave?: () => void | Promise<void> | Promise<boolean>;
    onOutputLengthSave?: () => void | Promise<void> | Promise<boolean>;
    openingError?: string;
    openingPlotError?: string;
    themeTagError?: string;
    audienceError?: string;
}

const WORD_LIMITS = {
    title: 20,
    tagline: 50,
    era: 400,
    premise: 400,
    opening: 400,
    openingPlot: 500,
} as const;

/** 功能注释：字段头——标题 +「作用于」徽章 + 写法提示，减少与相邻栏混淆。 */
function FieldHeader(props: {
    label: string;
    required?: boolean;
    actsOn: string;
    hint: string;
    wordCount: number;
    wordLimit: number;
}) {
    const { label, required, actsOn, hint, wordCount, wordLimit } = props;
    return (
        <div className={styles.fieldTopRow}>
            <div className={styles.fieldMeta}>
                <span className={styles.fieldLabel}>
                    {label}
                    {required ? <span className={styles.required}>*</span> : null}
                </span>
                <span className={styles.fieldActsOn}>{actsOn}</span>
                <span className={styles.fieldHint}>{hint}</span>
            </div>
            <span className={styles.wordCounter}>{wordCount}/{wordLimit}</span>
        </div>
    );
}

const WorldSettingForm: React.FC<WorldSettingFormProps> = ({
    mode,
    title,
    tagline,
    era,
    premise,
    playerRole,
    opening,
    openingPlot,
    themeTags,
    selectedThemeTagIds,
    audienceType,
    targetOutputLength,
    minOutputLength,
    maxOutputLength,
    onTitleChange,
    onTaglineChange,
    onEraChange,
    onPremiseChange,
    onOpeningChange,
    onOpeningPlotChange,
    onThemeTagToggle,
    onAudienceTypeChange,
    onTargetOutputLengthChange,
    onMinOutputLengthChange,
    onMaxOutputLengthChange,
    titleDirty = false,
    taglineDirty = false,
    eraDirty = false,
    premiseDirty = false,
    openingDirty = false,
    openingPlotDirty = false,
    outputLengthDirty = false,
    inlineSaveDisabled = false,
    onTitleSave,
    onTaglineSave,
    onEraSave,
    onPremiseSave,
    onOpeningSave,
    onOpeningPlotSave,
    onOutputLengthSave,
    openingError,
    openingPlotError,
    themeTagError,
    audienceError,
}) => {
    const { t } = useTranslation();
    const displayThemeTags = useLocalizedThemeTags(themeTags);
    const titleWords = useWordCount(title);
    const taglineWords = useWordCount(tagline);
    const eraWords = useWordCount(era);
    const premiseWords = useWordCount(premise);
    const openingWords = useWordCount(opening);
    const openingPlotWords = useWordCount(openingPlot);

    const titleLimit = useWordLimit(WORD_LIMITS.title, onTitleChange);
    const taglineLimit = useWordLimit(WORD_LIMITS.tagline, onTaglineChange);
    const eraLimit = useWordLimit(WORD_LIMITS.era, onEraChange);
    const premiseLimit = useWordLimit(WORD_LIMITS.premise, onPremiseChange);
    const openingLimit = useWordLimit(WORD_LIMITS.opening, onOpeningChange);
    const openingPlotLimit = useWordLimit(WORD_LIMITS.openingPlot, onOpeningPlotChange);

    return (
        <>
            <section className={styles.detailBlock}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <h3 className={styles.sectionTitle}>{t('createGame.basicInfo')}</h3>
                        <p className={styles.sectionDescription}>{t('createGame.basicInfoDescription')}</p>
                    </div>
                </div>

                <div className={styles.formGrid}>
                    <label>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>{t('createGame.gameTitle')}</span>
                            <span className={styles.wordCounter}>{titleWords}/{WORD_LIMITS.title}</span>
                        </div>
                        <InlineFieldSave
                            showSave={titleDirty}
                            onSave={() => onTitleSave?.()}
                            disabled={inlineSaveDisabled}
                        >
                            <input
                                type="text"
                                value={title}
                                {...titleLimit}
                            />
                        </InlineFieldSave>
                    </label>

                    <label>
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>{t('createGame.oneLineSummary')}</span>
                            <span className={styles.wordCounter}>{taglineWords}/{WORD_LIMITS.tagline}</span>
                        </div>
                        <InlineFieldSave
                            showSave={taglineDirty}
                            onSave={() => onTaglineSave?.()}
                            disabled={inlineSaveDisabled}
                        >
                            <input
                                type="text"
                                value={tagline}
                                {...taglineLimit}
                            />
                        </InlineFieldSave>
                    </label>

                    <div className={styles.wide}>
                        {/* 功能注释：作品分类在作品标签之前，必选且单选 */}
                        <ContentAudienceField
                            value={audienceType}
                            onChange={onAudienceTypeChange}
                            required
                            error={audienceError}
                            disabled={inlineSaveDisabled}
                        />
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldLabel}>{t('createGame.gameTags')}<span className={styles.required}>*</span></span>
                            <span className={styles.fieldHint}>{t('createGame.min1Max2Tags')}</span>
                        </div>
                        <div className={`${styles.themeTagsWrap} ${themeTagError ? styles.themeTagsWrapError : ''}`}>
                            {displayThemeTags.map((tag) => {
                                const selected = selectedThemeTagIds.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        className={`${styles.themeTagChip} ${selected ? styles.themeTagChipActive : ''}`}
                                        onClick={() => onThemeTagToggle(tag.id)}
                                        aria-pressed={selected}
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
                        <div className={styles.fieldHeader}>
                            <span className={styles.fieldLabel}>{t('createGame.playerIdentity')}</span>
                            <span className={styles.fieldHint}>{t('createGame.playerInfoHint')}</span>
                        </div>
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
                        <h3 className={styles.sectionTitle}>{t('createGame.worldBackground')}</h3>
                        <p className={styles.sectionDescription}>{t('createGame.worldBackgroundDescription')}</p>
                    </div>
                </div>

                <div className={styles.formStack}>
                    <label className={styles.fieldBlock}>
                        <FieldHeader
                            label={t('createGame.worldview')}
                            actsOn={t('createGame.worldviewActsOn')}
                            hint={t('createGame.worldviewHint')}
                            wordCount={eraWords}
                            wordLimit={WORD_LIMITS.era}
                        />
                        <InlineFieldSave
                            showSave={eraDirty}
                            onSave={() => onEraSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={era}
                                placeholder={t('createGame.worldviewPlaceholder')}
                                {...eraLimit}
                            />
                        </InlineFieldSave>
                    </label>

                    <label className={styles.fieldBlock}>
                        <FieldHeader
                            label={t('createGame.premise')}
                            actsOn={t('createGame.premiseActsOn')}
                            hint={t('createGame.premiseHint')}
                            wordCount={premiseWords}
                            wordLimit={WORD_LIMITS.premise}
                        />
                        <InlineFieldSave
                            showSave={premiseDirty}
                            onSave={() => onPremiseSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={premise}
                                placeholder={t('createGame.premisePlaceholder')}
                                {...premiseLimit}
                            />
                        </InlineFieldSave>
                    </label>
                </div>
            </section>

            <section className={styles.detailBlock}>
                <div className={styles.sectionTitleRow}>
                    <div>
                        <h3 className={styles.sectionTitle}>{t('createGame.openingContent')}</h3>
                        <p className={styles.sectionDescription}>{t('createGame.openingContentDescription')}</p>
                    </div>
                </div>

                <div className={styles.formStack}>
                    <label className={styles.fieldBlock}>
                        <FieldHeader
                            label={t('createGame.openingStatement')}
                            required
                            actsOn={t('createGame.openingStatementActsOn')}
                            hint={t('createGame.openingStatementHint')}
                            wordCount={openingWords}
                            wordLimit={WORD_LIMITS.opening}
                        />
                        <InlineFieldSave
                            showSave={openingDirty}
                            onSave={() => onOpeningSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={opening}
                                placeholder={t('createGame.openingStatementPlaceholder')}
                                {...openingLimit}
                                className={openingError ? styles.errorInput : ''}
                            />
                        </InlineFieldSave>
                        {openingError && (
                            <div className={styles.errorMessage}>{openingError}</div>
                        )}
                    </label>

                    <label className={styles.fieldBlock}>
                        <FieldHeader
                            label={t('createGame.openingPlot')}
                            required
                            actsOn={t('createGame.openingPlotActsOn')}
                            hint={t('createGame.openingPlotHint')}
                            wordCount={openingPlotWords}
                            wordLimit={WORD_LIMITS.openingPlot}
                        />
                        <InlineFieldSave
                            showSave={openingPlotDirty}
                            onSave={() => onOpeningPlotSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={openingPlot}
                                placeholder={t('createGame.openingPlotPlaceholder')}
                                {...openingPlotLimit}
                                className={openingPlotError ? styles.errorInput : ''}
                            />
                        </InlineFieldSave>
                        {openingPlotError && (
                            <div className={styles.errorMessage}>{openingPlotError}</div>
                        )}
                    </label>
                </div>
            </section>

            {mode === 'visual' && (
                <section className={styles.detailBlock}>
                    {/* 功能注释：效果图输出字数标题居中，与下方设置行手风琴形成「主区块 + 可选折叠」节奏 */}
                    <div className={`${styles.sectionTitleRow} ${styles.sectionTitleCentered}`}>
                        <div>
                            <h3 className={styles.sectionTitle}>{t('createGame.outputLength')}</h3>
                            <p className={styles.sectionDescription}>{t('createGame.outputLengthDescription')}</p>
                        </div>
                    </div>

                    <InlineFieldSave
                        variant="group"
                        showSave={outputLengthDirty}
                        onSave={() => onOutputLengthSave?.()}
                        disabled={inlineSaveDisabled}
                    >
                    <div className={styles.outputLengthGrid}>
                        <label>
                            <span className={styles.fieldLabel}>{t('createGame.minimum')}</span>
                            <input
                                type="number"
                                min="0"
                                value={minOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onMinOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder={t('createGame.minChars')}
                            />
                        </label>

                        <label>
                            <span className={styles.fieldLabel}>{t('createGame.target')}</span>
                            <input
                                type="number"
                                min="0"
                                value={targetOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onTargetOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder={t('createGame.targetChars')}
                            />
                        </label>

                        <label>
                            <span className={styles.fieldLabel}>{t('createGame.maximum')}</span>
                            <input
                                type="number"
                                min="0"
                                value={maxOutputLength ?? ''}
                                onChange={(event) => {
                                    const value = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                                    onMaxOutputLengthChange(isNaN(value as number) ? undefined : value);
                                }}
                                placeholder={t('createGame.maxChars')}
                            />
                        </label>
                    </div>
                    </InlineFieldSave>
                </section>
            )}
        </>
    );
};

export default WorldSettingForm;
