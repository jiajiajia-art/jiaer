import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './CreateEmptyGameModal.module.css';
import { TXT_IDEA_GENERATE_COST, TXT_IDEA_TEXT_COST } from '../../../utils/constants';
import EditorApi from '../../../api/galgame/EditorData';
import { useAuthStore } from '../../../store/useAuthStore';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import {
    DEFAULT_FULL_ASSET_FLAGS,
    DEFAULT_TEXT_GENERATE_OPTIONS,
    EST_COVER_COUNT,
    EST_PORTRAIT_COUNT,
    EST_SCENE_COUNT,
    estimateFullWorkPoints,
    type IdeaAssetFlags,
    type IdeaGenerateMode,
    type IdeaGenerateOptions,
} from '../../../lib/galgame/ideaFullWorkEstimate';

export type { IdeaGenerateOptions };

interface GenerateFromIdeaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (idea: string, options: IdeaGenerateOptions) => Promise<boolean | void>;
    /** 入口卡片预选范围 */
    initialMode?: IdeaGenerateMode;
}

const IDEA_MAX_LENGTH = 300;

const GenerateFromIdeaModal: React.FC<GenerateFromIdeaModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    initialMode = 'text',
}) => {
    const { t } = useTranslation();
    const updateUser = useAuthStore((s) => s.updateUser);
    const [idea, setIdea] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAiBusy, setIsAiBusy] = useState(false);
    const [mode, setMode] = useState<IdeaGenerateMode>(initialMode);
    const [assets, setAssets] = useState<IdeaAssetFlags>(DEFAULT_FULL_ASSET_FLAGS);

    useEffect(() => {
        if (!isOpen) return;
        setMode(initialMode);
        setAssets(initialMode === 'full' ? DEFAULT_FULL_ASSET_FLAGS : DEFAULT_TEXT_GENERATE_OPTIONS.assets);
        setError('');
    }, [isOpen, initialMode]);

    const estimatedPoints = useMemo(
        () => estimateFullWorkPoints({ mode, assets }),
        [mode, assets],
    );

    if (!isOpen) return null;

    /**
     * 功能注释：标签旁 AI 生成创意描述；成功扣 1 积分并回填输入框。
     */
    const handleAiGenerateIdeaText = async () => {
        setError('');
        try {
            setIsAiBusy(true);
            const latestPoints = await refreshAuthUserPoints();
            const current = typeof latestPoints === 'number'
                ? latestPoints
                : (useAuthStore.getState().user?.user?.points ?? 0);
            if (current < TXT_IDEA_TEXT_COST) {
                toast.error(t('createGame.insufficientPointsForDoc', {
                    required: TXT_IDEA_TEXT_COST,
                    current,
                }));
                return;
            }

            const res = await EditorApi.generateIdeaText(idea.trim());
            const payload = res.data;
            if (!payload?.success || !payload.data?.text) {
                toast.error(payload?.message || payload?.error || t('createGame.generateFailedRetry'));
                return;
            }

            setIdea(payload.data.text.slice(0, IDEA_MAX_LENGTH));
            if (typeof payload.data.remainingPoints === 'number') {
                updateUser({ points: payload.data.remainingPoints });
            } else {
                await refreshAuthUserPoints();
            }
            toast.success(
                t('createGame.ideaTextSuccessDeducted', {
                    points: payload.data.pointsDeducted ?? TXT_IDEA_TEXT_COST,
                }),
            );
        } catch (err: unknown) {
            const anyErr = err as {
                response?: { data?: { message?: string; error?: string } };
                message?: string;
            };
            toast.error(
                anyErr?.response?.data?.message
                || anyErr?.response?.data?.error
                || anyErr?.message
                || t('createGame.generateFailedRetry'),
            );
        } finally {
            setIsAiBusy(false);
        }
    };

    const toggleAsset = (key: keyof IdeaAssetFlags) => {
        setAssets((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!idea.trim()) {
            setError(t('createGame.enterGameIdea'));
            return;
        }

        if (idea.trim().length < 10) {
            setError(t('createGame.ideaAtLeast10Chars'));
            return;
        }

        if (mode === 'full' && !assets.portraits && !assets.scenes && !assets.cover) {
            setError(t('createGame.fullWorkSelectAtLeastOneAsset'));
            return;
        }

        try {
            setIsSubmitting(true);
            const options: IdeaGenerateOptions = {
                mode,
                assets: mode === 'full' ? assets : DEFAULT_TEXT_GENERATE_OPTIONS.assets,
            };
            const result = await onSubmit(idea.trim(), options);
            if (result !== false) {
                setIdea('');
                onClose();
            }
        } catch (err: unknown) {
            setError((err as { message?: string })?.message || t('createGame.generateFailedRetry'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setIdea('');
        setError('');
        onClose();
    };

    const busy = isSubmitting || isAiBusy;
    const submitLabel = mode === 'full'
        ? t('createGame.startGenerateFullWorkWithCost', { points: estimatedPoints })
        : t('createGame.startGenerateWithCost', { points: TXT_IDEA_GENERATE_COST });

    const modalContent = (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={`${styles.modalWrapper} ${styles.ideaModalWide}`} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modal}>
                    <div className={styles.modalHeader}>
                        <h2 className={styles.title}>{t('createGame.generateFromIdeaTitle')}</h2>
                        <button
                            className={styles.closeButton}
                            onClick={handleClose}
                            disabled={busy}
                            type="button"
                        >
                            ×
                        </button>
                    </div>

                    <form className={styles.modalBody} onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <div className={styles.labelWithAi}>
                                <label htmlFor="gameIdea" className={styles.label}>
                                    {t('createGame.gameIdea')}
                                </label>
                                <button
                                    type="button"
                                    className={styles.fieldAiBtn}
                                    onClick={handleAiGenerateIdeaText}
                                    disabled={busy}
                                >
                                    {isAiBusy
                                        ? t('createGame.generating')
                                        : t('createGame.aiGenerateIdeaTextWithCost', {
                                            points: TXT_IDEA_TEXT_COST,
                                        })}
                                </button>
                            </div>
                            <div className={styles.textareaWrap}>
                                <textarea
                                    id="gameIdea"
                                    className={styles.textarea}
                                    value={idea}
                                    onChange={(e) => {
                                        setIdea(e.target.value.slice(0, IDEA_MAX_LENGTH));
                                        setError('');
                                    }}
                                    placeholder={t('createGame.gameIdeaPlaceholder')}
                                    autoFocus
                                    rows={5}
                                    disabled={busy}
                                    maxLength={IDEA_MAX_LENGTH}
                                />
                                <span className={styles.charCount}>{idea.length}/{IDEA_MAX_LENGTH}</span>
                            </div>
                            {error && <p className={styles.errorText}>{error}</p>}
                            <p className={styles.hintText}>
                                {t('createGame.gameIdeaHint')}
                            </p>
                        </div>

                        <div className={styles.formGroup}>
                            <p className={styles.scopeLabel}>{t('createGame.generateScope')}</p>

                            <button
                                type="button"
                                className={`${styles.scopeOption} ${mode === 'text' ? styles.scopeOptionActive : ''}`}
                                onClick={() => setMode('text')}
                                disabled={busy}
                            >
                                <span className={styles.scopeRadio} aria-hidden />
                                <span className={styles.scopeBody}>
                                    <span className={styles.scopeTitle}>{t('createGame.scopeTextOnlyTitle')}</span>
                                    <span className={styles.scopeDesc}>{t('createGame.scopeTextOnlyDesc')}</span>
                                </span>
                                <span className={styles.scopeBadge}>
                                    {t('createGame.scopePointsBadge', { points: TXT_IDEA_GENERATE_COST })}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`${styles.scopeOption} ${mode === 'full' ? styles.scopeOptionActive : ''}`}
                                onClick={() => setMode('full')}
                                disabled={busy}
                            >
                                <span className={styles.scopeRadio} aria-hidden />
                                <span className={styles.scopeBody}>
                                    <span className={styles.scopeTitle}>{t('createGame.scopeFullWorkTitle')}</span>
                                    <span className={styles.scopeDesc}>{t('createGame.scopeFullWorkDesc')}</span>
                                </span>
                                <span className={styles.scopeBadge}>
                                    {t('createGame.scopeEstimatedPointsBadge', { points: estimatedPoints })}
                                </span>
                            </button>

                            {mode === 'full' && (
                                <div className={styles.assetPickPanel}>
                                    <p className={styles.assetPickLabel}>{t('createGame.estimatedGenerate')}</p>
                                    <div className={styles.assetPickRow}>
                                        <label className={`${styles.assetChip} ${assets.portraits ? styles.assetChipOn : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={assets.portraits}
                                                onChange={() => toggleAsset('portraits')}
                                                disabled={busy}
                                            />
                                            <span>{t('createGame.assetPortraits')}</span>
                                            <span className={styles.assetCount}>
                                                {t('createGame.assetCountSheets', { count: EST_PORTRAIT_COUNT })}
                                            </span>
                                        </label>
                                        <label className={`${styles.assetChip} ${assets.scenes ? styles.assetChipOn : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={assets.scenes}
                                                onChange={() => toggleAsset('scenes')}
                                                disabled={busy}
                                            />
                                            <span>{t('createGame.assetScenes')}</span>
                                            <span className={styles.assetCount}>
                                                {t('createGame.assetCountSheets', { count: EST_SCENE_COUNT })}
                                            </span>
                                        </label>
                                        <label className={`${styles.assetChip} ${assets.cover ? styles.assetChipOn : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={assets.cover}
                                                onChange={() => toggleAsset('cover')}
                                                disabled={busy}
                                            />
                                            <span>{t('createGame.assetCover')}</span>
                                            <span className={styles.assetCount}>
                                                {t('createGame.assetCountSheets', { count: EST_COVER_COUNT })}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            <p className={styles.hintText}>{t('createGame.fullWorkFooterHint')}</p>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button
                                type="button"
                                className={styles.cancelButton}
                                onClick={handleClose}
                                disabled={busy}
                            >
                                {t('createGame.cancel')}
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={busy || !idea.trim() || idea.trim().length < 10}
                            >
                                {isSubmitting ? t('createGame.generating') : submitLabel}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    if (typeof document === 'undefined') {
        return modalContent;
    }
    return createPortal(modalContent, document.body);
};

export default GenerateFromIdeaModal;
