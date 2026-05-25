import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WorldPanel.module.css';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import InlineFieldSave from '../InlineFieldSave';

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
    titleDirty?: boolean;
    taglineDirty?: boolean;
    eraDirty?: boolean;
    openingDirty?: boolean;
    openingPlotDirty?: boolean;
    outputLengthDirty?: boolean;
    inlineSaveDisabled?: boolean;
    onTitleSave?: () => void | Promise<void> | Promise<boolean>;
    onTaglineSave?: () => void | Promise<void> | Promise<boolean>;
    onEraSave?: () => void | Promise<void> | Promise<boolean>;
    onOpeningSave?: () => void | Promise<void> | Promise<boolean>;
    onOpeningPlotSave?: () => void | Promise<void> | Promise<boolean>;
    onOutputLengthSave?: () => void | Promise<void> | Promise<boolean>;
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
    titleDirty = false,
    taglineDirty = false,
    eraDirty = false,
    openingDirty = false,
    openingPlotDirty = false,
    outputLengthDirty = false,
    inlineSaveDisabled = false,
    onTitleSave,
    onTaglineSave,
    onEraSave,
    onOpeningSave,
    onOpeningPlotSave,
    onOutputLengthSave,
    openingError,
    openingPlotError,
    themeTagError,
}) => {
    const { t } = useTranslation();
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
                        <div className={styles.fieldTopRow}>
                            <span className={styles.fieldLabel}>{t('createGame.gameTags')}<span className={styles.required}>*</span></span>
                            <span className={styles.fieldHint}>{t('createGame.min1Max2Tags')}</span>
                        </div>
                        <div className={`${styles.themeTagsWrap} ${themeTagError ? styles.themeTagsWrapError : ''}`}>
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
                            <span className={styles.fieldLabel}>{t('createGame.playerIdentity')}</span>
                        </div>
                        <span className={styles.fieldHintItalic}>{t('createGame.playerInfoHint')}</span>
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

                <label className={styles.fieldBlock}>
                    <div className={styles.fieldTopRow}>
                        <span className={styles.fieldLabel}>{t('createGame.eraBackground')}</span>
                        <span className={styles.wordCounter}>{eraWords}/{WORD_LIMITS.era}</span>
                    </div>
                    <InlineFieldSave
                        showSave={eraDirty}
                        onSave={() => onEraSave?.()}
                        disabled={inlineSaveDisabled}
                        buttonPlacement="external"
                    >
                        <textarea
                            rows={6}
                            value={era}
                            {...eraLimit}
                        />
                    </InlineFieldSave>
                </label>
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
                        <div className={styles.fieldTopRow}>
                            <div className={styles.fieldMeta}>
                                <span className={styles.fieldLabel}>{t('createGame.openingStatement')}<span className={styles.required}>*</span></span>
                                <span className={styles.fieldHint}>{t('createGame.openingStatementHint')}</span>
                            </div>
                            <span className={styles.wordCounter}>{openingWords}/{WORD_LIMITS.opening}</span>
                        </div>
                        <InlineFieldSave
                            showSave={openingDirty}
                            onSave={() => onOpeningSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={opening}
                                {...openingLimit}
                                className={openingError ? styles.errorInput : ''}
                            />
                        </InlineFieldSave>
                        {openingError && (
                            <div className={styles.errorMessage}>{openingError}</div>
                        )}
                    </label>

                    <label className={styles.fieldBlock}>
                        <div className={styles.fieldTopRow}>
                            <div className={styles.fieldMeta}>
                                <span className={styles.fieldLabel}>{t('createGame.openingPlot')}<span className={styles.required}>*</span></span>
                                <span className={styles.fieldHint}>{t('createGame.openingPlotHint')}</span>
                            </div>
                            <span className={styles.wordCounter}>{openingPlotWords}/{WORD_LIMITS.openingPlot}</span>
                        </div>
                        <InlineFieldSave
                            showSave={openingPlotDirty}
                            onSave={() => onOpeningPlotSave?.()}
                            disabled={inlineSaveDisabled}
                            buttonPlacement="external"
                        >
                            <textarea
                                rows={5}
                                value={openingPlot}
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
                    <div className={styles.sectionTitleRow}>
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
