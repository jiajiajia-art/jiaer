import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import { useImageCropper } from '../../../hooks/useImageCropper';
import { getImageUrl, SCENE_GENERATION_COST } from '../../../utils/constants';
import { addImageTimestamp, bumpCacheBust } from '../../../utils/imageCache';
import { fileToDataUrl } from '../../../utils/uploadImageCrop';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import { compositePosterTitleOntoCover } from '../../../lib/galgame/compositePosterTitle';
import ImageCropModal from '../../CommonModal/ImageCropModal';
import PortraitLightbox from '../CharactersPanel/PortraitLightbox';
import styles from './WorldPanel.module.css';

interface CoverUploadProps {
    fileId?: string;
    coverUrl?: string;
    /** 作品标题：海报主标题；提示词为空时也用它 */
    workTitle?: string;
    onCoverUploaded?: () => void;
}

const COVER_PROMPT_MAX = 200;

const CoverUpload: React.FC<CoverUploadProps> = ({
    fileId,
    coverUrl,
    workTitle = '',
    onCoverUploaded,
}) => {
    const { t } = useTranslation();
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [coverGenerating, setCoverGenerating] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [promptDraft, setPromptDraft] = useState('');
    const [coverError, setCoverError] = useState<string | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    const resolvedWorkTitle = String(workTitle || '').trim();

    const coverDisplaySrc = coverPreview
        ? (coverPreview.startsWith('data:image/')
            ? coverPreview
            : addImageTimestamp(getImageUrl(coverPreview)))
        : '';

    useEffect(() => {
        setCoverPreview(coverUrl || null);
    }, [coverUrl]);

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError(t('common.coverUpload.missingFileId'));
            return;
        }

        try {
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success) {
                const nextCoverUrl = response.data.data.coverUrl;
                bumpCacheBust(nextCoverUrl);
                setCoverPreview(nextCoverUrl);
                toast.success(t('common.coverUpload.uploadSuccess'));
                onCoverUploaded?.();
            } else {
                setCoverError(response.data.message || t('common.coverUpload.uploadFailed'));
            }
        } catch (error) {
            console.error('upload world cover failed:', error);
            const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setCoverError(apiMessage || t('common.coverUpload.uploadFailed'));
        } finally {
            setCoverUploading(false);
        }
    }, [fileId, onCoverUploaded, t]);

    const {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    } = useImageCropper({
        preset: 'gameCover',
        onCropped: async (croppedFile) => {
            const preview = await fileToDataUrl(croppedFile);
            setCoverPreview(preview);
            await uploadCover(croppedFile);
        },
    });

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError(t('common.coverUpload.invalidImage'));
            return;
        }

        setCoverError(null);
        void openCropper(file).catch((error) => {
            console.error('open world cover cropper failed:', error);
            setCoverError(t('common.coverUpload.imageLoadFailed'));
        });
    };

    /** 选完文件后浏览器可能回放一次 click，短暂屏蔽预览 */
    const suppressPreviewRef = useRef(false);

    const armSuppressPreview = () => {
        suppressPreviewRef.current = true;
        window.setTimeout(() => {
            suppressPreviewRef.current = false;
        }, 1000);
    };

    /** 无封面：整块区域点选上传 */
    const handleEmptyCoverClick = () => {
        if (coverUploading || coverGenerating || !fileId) return;
        armSuppressPreview();
        coverInputRef.current?.click();
    };

    /** 点图放大；「更换」在同层但不在此 hit 内，并 stopPropagation */
    const handlePreviewCover = (event?: React.MouseEvent) => {
        event?.stopPropagation();
        if (suppressPreviewRef.current) return;
        if (coverUploading || coverGenerating || !coverDisplaySrc) return;
        setLightboxOpen(true);
    };

    const handleReplaceCover = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!fileId || coverUploading || coverGenerating) return;
        armSuppressPreview();
        coverInputRef.current?.click();
    };

    const openPromptModal = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!fileId || coverUploading || coverGenerating) return;
        if (!resolvedWorkTitle) {
            toast.error(t('common.coverUpload.titleRequired'));
            return;
        }
        const latestPoints = await refreshAuthUserPoints();
        if (typeof latestPoints === 'number' && latestPoints < SCENE_GENERATION_COST) {
            toast.error(
                t('common.coverUpload.pointsInsufficient', {
                    cost: SCENE_GENERATION_COST,
                    current: latestPoints,
                }),
            );
            return;
        }
        setPromptDraft('');
        setPromptModalOpen(true);
    };

    const closePromptModal = () => {
        if (coverGenerating) return;
        setPromptModalOpen(false);
    };

    const runAiGenerate = async () => {
        if (!fileId || coverGenerating) return;
        const creativePrompt = String(promptDraft || '').trim() || resolvedWorkTitle;
        if (!creativePrompt) {
            toast.error(t('common.coverUpload.titleRequired'));
            return;
        }

        setPromptModalOpen(false);
        try {
            setCoverGenerating(true);
            setCoverError(null);
            const response = await EditorApi.generateGameCover(fileId, {
                prompt: creativePrompt,
                title: resolvedWorkTitle,
            });
            if (!response.data?.success || !response.data?.data?.coverUrl) {
                toast.error(response.data?.message || t('common.coverUpload.aiGenerateFailed'));
                return;
            }
            let nextCoverUrl = response.data.data.coverUrl;
            const posterTitle = String(
                response.data.data.posterTitle || resolvedWorkTitle || '',
            ).trim();
            const needsOverlay = response.data.data.needsTitleOverlay === true
                || response.data.data.titleMode === 'overlay'
                || response.data.data.abArm === 'treatment';

            // treatment：用真实字体叠正确标题，再写回封面（不二次扣积分）
            if (needsOverlay && posterTitle) {
                try {
                    const composited = await compositePosterTitleOntoCover(
                        addImageTimestamp(getImageUrl(nextCoverUrl)),
                        posterTitle,
                    );
                    const uploadRes = await EditorApi.uploadGameCover(fileId, composited);
                    if (uploadRes.data?.success && uploadRes.data?.data?.coverUrl) {
                        nextCoverUrl = uploadRes.data.data.coverUrl;
                    }
                } catch (overlayErr) {
                    console.error('composite poster title failed:', overlayErr);
                    toast.error(t('common.coverUpload.titleOverlayFailed'));
                }
            }

            bumpCacheBust(nextCoverUrl);
            setCoverPreview(nextCoverUrl);
            const deducted = response.data.data.pointsDeducted ?? SCENE_GENERATION_COST;
            toast.success(
                t('common.coverUpload.aiGenerateSuccess', { cost: deducted }),
            );
            await refreshAuthUserPoints();
            onCoverUploaded?.();
        } catch (error) {
            console.error('AI generate game cover failed:', error);
            const apiMessage = (error as { response?: { data?: { message?: string; error?: string } } })
                ?.response?.data?.message
                || (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
            toast.error(apiMessage || t('common.coverUpload.aiGenerateFailed'));
        } finally {
            setCoverGenerating(false);
        }
    };

    const busy = coverUploading || coverGenerating;

    const promptModal = promptModalOpen
        ? createPortal(
            <div
                className={styles.coverBriefOverlay}
                onClick={closePromptModal}
                role="presentation"
            >
                <div
                    className={styles.coverBriefSheet}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cover-brief-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.coverBriefTop}>
                        <div>
                            <p className={styles.coverBriefEyebrow}>
                                {t('common.coverUpload.promptModalEyebrow')}
                            </p>
                            <h2 id="cover-brief-title" className={styles.coverBriefHeading}>
                                {t('common.coverUpload.promptModalTitle')}
                            </h2>
                        </div>
                        <button
                            type="button"
                            className={styles.coverBriefClose}
                            onClick={closePromptModal}
                            aria-label={t('common.coverUpload.pointsConfirmCancel')}
                        >
                            ×
                        </button>
                    </div>

                    <div className={styles.coverBriefBody}>
                        <div className={styles.coverBriefStage} aria-hidden>
                            <div className={styles.coverBriefStageGrain} />
                            <p className={styles.coverBriefStageLabel}>
                                {t('common.coverUpload.posterTitlePreview')}
                            </p>
                            <p className={styles.coverBriefStageTitle}>{resolvedWorkTitle}</p>
                        </div>

                        <div className={styles.coverBriefMetaRow}>
                            <p className={styles.coverBriefHint}>
                                {t('common.coverUpload.promptModalHint')}
                            </p>
                            <span className={styles.coverBriefCost}>
                                {t('common.coverUpload.promptCostBadge', { cost: SCENE_GENERATION_COST })}
                            </span>
                        </div>

                        <div className={styles.coverBriefField}>
                            <div className={styles.coverBriefLabelRow}>
                                <label className={styles.coverBriefLabel} htmlFor="cover-ai-prompt">
                                    {t('common.coverUpload.promptLabel')}
                                </label>
                                <span className={styles.coverBriefOptional}>
                                    {t('common.coverUpload.promptOptional')}
                                </span>
                            </div>
                            <textarea
                                id="cover-ai-prompt"
                                className={styles.coverBriefTextarea}
                                value={promptDraft}
                                maxLength={COVER_PROMPT_MAX}
                                placeholder={t('common.coverUpload.promptPlaceholder')}
                                onChange={(e) => setPromptDraft(e.target.value.slice(0, COVER_PROMPT_MAX))}
                                rows={3}
                                // eslint-disable-next-line jsx-a11y/no-autofocus -- 打开弹窗即编辑提示词
                                autoFocus
                            />
                            <span className={styles.coverBriefCount}>
                                {promptDraft.length}/{COVER_PROMPT_MAX}
                            </span>
                        </div>

                        <div className={styles.coverBriefActions}>
                            <button
                                type="button"
                                className={styles.coverBriefGhost}
                                onClick={closePromptModal}
                            >
                                {t('common.coverUpload.pointsConfirmCancel')}
                            </button>
                            <button
                                type="button"
                                className={styles.coverBriefPrimary}
                                onClick={() => void runAiGenerate()}
                            >
                                {t('common.coverUpload.pointsConfirmOk')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body,
        )
        : null;

    return (
        <div className={styles.uploadCover}>
            <div className={styles.coverHeaderRow}>
                <h2>{t('common.coverUpload.title')}</h2>
                <button
                    type="button"
                    className={styles.coverAiBtn}
                    onClick={(e) => void openPromptModal(e)}
                    disabled={!fileId || busy}
                >
                    {coverGenerating
                        ? t('common.coverUpload.aiGenerating')
                        : t('common.coverUpload.aiGenerate', { cost: SCENE_GENERATION_COST })}
                </button>
            </div>
            <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                hidden
                onChange={handleCoverSelect}
                disabled={busy || !fileId}
            />

            {coverPreview ? (
                <div className={`${styles.coverUploadArea} ${styles.coverUploadAreaPreview}`}>
                    <div className={styles.coverPreviewContainer}>
                        <button
                            type="button"
                            className={styles.coverPreviewHit}
                            onClick={handlePreviewCover}
                            disabled={busy}
                            aria-label={t('common.coverUpload.clickToPreview')}
                        >
                            <img
                                src={coverDisplaySrc}
                                alt={resolvedWorkTitle || 'Game cover preview'}
                                className={styles.coverPreview}
                                draggable={false}
                            />
                            {!coverGenerating ? (
                                <span className={styles.coverPreviewHint}>
                                    {t('common.coverUpload.clickToPreview')}
                                </span>
                            ) : null}
                        </button>
                        <div
                            className={styles.coverActions}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                className={styles.removeCoverBtn}
                                onClick={handleReplaceCover}
                                disabled={busy}
                            >
                                {t('common.coverUpload.replace')}
                            </button>
                        </div>
                        {coverGenerating ? (
                            <div className={styles.coverGeneratingOverlay} aria-live="polite">
                                <div className={styles.coverGeneratingSpinner} />
                                <span>{t('common.coverUpload.aiGenerating')}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div
                    className={styles.coverUploadArea}
                    onClick={handleEmptyCoverClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleEmptyCoverClick();
                        }
                    }}
                    aria-label={t('common.coverUpload.clickToUpload')}
                >
                    <div className={styles.coverPlaceholder}>
                        <BsUpload className={styles.coverUploadIcon} size={32} />
                        <p className={styles.coverUploadText}>{t('common.coverUpload.clickToUpload')}</p>
                        <p className={styles.coverUploadHint}>{t('common.coverUpload.supportFormats')}</p>
                        {coverGenerating ? (
                            <p className={styles.coverUploadHint}>{t('common.coverUpload.aiGenerating')}</p>
                        ) : null}
                    </div>
                </div>
            )}

            {coverError ? (
                <p className={styles.coverErrorText}>{coverError}</p>
            ) : null}

            {pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCropFile.imageSrc}
                    title={cropPreset.title}
                    description={cropPreset.description}
                    aspectRatio={cropPreset.aspectRatio}
                    aspectLabel={cropPreset.aspectLabel}
                    defaultCropScale={cropPreset.defaultCropScale}
                    mimeType={pendingCropFile.mimeType}
                    onClose={closeCropper}
                    onCropComplete={handleCropComplete}
                />
            ) : null}

            <PortraitLightbox
                open={lightboxOpen && Boolean(coverDisplaySrc)}
                src={coverDisplaySrc || null}
                title={resolvedWorkTitle || t('common.coverUpload.title')}
                onClose={() => setLightboxOpen(false)}
            />

            {promptModal}
        </div>
    );
};

export default CoverUpload;
