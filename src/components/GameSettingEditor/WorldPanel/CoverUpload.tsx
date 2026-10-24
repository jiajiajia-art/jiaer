import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import { useImageCropper } from '../../../hooks/useImageCropper';
import { getImageUrl } from '../../../utils/constants';
import { useImageBusinessPrice } from '../../../hooks/useImageBusinessPrice';
import type { CoverOrientation } from '../../../utils/gameCovers.ts';
import { addImageTimestamp, bumpCacheBust } from '../../../utils/imageCache';
import { resolveCoverPreviewSrc } from '../../../utils/resolveCoverPreviewSrc';
import { fileToDataUrl } from '../../../utils/uploadImageCrop';
import { refreshAuthUserPoints } from '../../../lib/auth/refreshUserPoints';
import { compositePosterTitleOntoCover } from '../../../lib/galgame/compositePosterTitle';
import { resolveCoverPosterOverlay } from '../../../utils/coverPosterOverlay';
import { buildCoverAiCreativePrompt } from '../../../utils/buildCoverAiCreativePrompt';
import { getApiErrorMessage } from '../../../utils/error';
import ImageCropModal from '../../CommonModal/ImageCropModal';
import PortraitLightbox from '../CharactersPanel/PortraitLightbox';
import styles from './WorldPanel.module.css';

export type CoverUploadedInfo = {
    orientation: CoverOrientation;
    coverUrl: string;
};

interface CoverUploadProps {
    fileId?: string;
    coverUrl?: string;
    portraitCoverUrl?: string;
    /** 作品标题：海报主标题；提示词为空时也用它 */
    workTitle?: string;
    onCoverUploaded?: (info?: CoverUploadedInfo) => void;
    compact?: boolean;
}

const COVER_PROMPT_MAX = 200;

const CoverUpload: React.FC<CoverUploadProps> = ({
    fileId,
    coverUrl,
    portraitCoverUrl,
    workTitle = '',
    onCoverUploaded,
    compact = false,
}) => {
    const { t } = useTranslation();
    const landscapePricing = useImageBusinessPrice('visual_cover_landscape', fileId);
    const portraitPricing = useImageBusinessPrice('visual_cover_portrait', fileId);
    const priceFor = (orientation: CoverOrientation) => (
        orientation === 'portrait' ? portraitPricing.estimatedPoints : landscapePricing.estimatedPoints
    );
    const landscapeInputRef = useRef<HTMLInputElement>(null);
    const portraitInputRef = useRef<HTMLInputElement>(null);
    const [landscapePreview, setLandscapePreview] = useState<string | null>(coverUrl || null);
    const [portraitPreview, setPortraitPreview] = useState<string | null>(portraitCoverUrl || null);
    const [busyOrientation, setBusyOrientation] = useState<CoverOrientation | null>(null);
    const [coverGenerating, setCoverGenerating] = useState(false);
    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [promptTarget, setPromptTarget] = useState<CoverOrientation>('landscape');
    const [promptDraft, setPromptDraft] = useState('');
    const [coverError, setCoverError] = useState<string | null>(null);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const resolvedWorkTitle = String(workTitle || '').trim();
    const busy = Boolean(busyOrientation) || coverGenerating;

    const displaySrc = (preview: string | null) => {
        if (!preview) return '';
        if (preview.startsWith('data:image/') || preview.startsWith('blob:')) return preview;
        // 功能注释：已是带 ?t= 的绝对地址则直接用，避免再包一层旧 cache
        if (/^https?:\/\//i.test(preview) && /[?&]t=/.test(preview)) return preview;
        return addImageTimestamp(getImageUrl(preview));
    };

    // 功能注释：父级刷新瞬间 coverUrl 可能短暂为空，禁止清空已成功的 AI/上传预览
    useEffect(() => {
        if (coverUrl) setLandscapePreview(coverUrl);
    }, [coverUrl]);

    useEffect(() => {
        if (portraitCoverUrl) setPortraitPreview(portraitCoverUrl);
    }, [portraitCoverUrl]);

    const setPreviewFor = (orientation: CoverOrientation, next: string | null) => {
        if (orientation === 'portrait') setPortraitPreview(next);
        else setLandscapePreview(next);
    };

    /** 功能注释：生图/上传成功后预取封面，降低 ERR_CONNECTION_CLOSED 导致的裂图 */
    const applyCoverPreview = async (orientation: CoverOrientation, nextCoverUrl: string) => {
        const previewSrc = await resolveCoverPreviewSrc(nextCoverUrl);
        setPreviewFor(orientation, previewSrc || nextCoverUrl);
    };

    const uploadCover = useCallback(async (file: File, orientation: CoverOrientation) => {
        if (!fileId) {
            setCoverError(t('common.coverUpload.missingFileId'));
            return;
        }

        try {
            setBusyOrientation(orientation);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file, orientation);
            if (response.data.success) {
                const nextCoverUrl = response.data.data.coverUrl;
                await applyCoverPreview(orientation, nextCoverUrl);
                toast.success(t('common.coverUpload.uploadSuccess'));
                onCoverUploaded?.({ orientation, coverUrl: nextCoverUrl });
            } else {
                const msg = response.data.message || t('common.coverUpload.uploadFailed');
                setCoverError(msg);
                toast.error(msg);
            }
        } catch (error) {
            console.error('upload world cover failed:', error);
            const apiMessage = getApiErrorMessage(error, t('common.coverUpload.uploadFailed'));
            setCoverError(apiMessage);
            toast.error(apiMessage);
        } finally {
            setBusyOrientation(null);
        }
    }, [fileId, onCoverUploaded, t]);

    const landscapeCropper = useImageCropper({
        preset: 'gameCover',
        onCropped: async (croppedFile) => {
            const preview = await fileToDataUrl(croppedFile);
            setLandscapePreview(preview);
            await uploadCover(croppedFile, 'landscape');
        },
    });

    const portraitCropper = useImageCropper({
        preset: 'gamePortraitCover',
        onCropped: async (croppedFile) => {
            const preview = await fileToDataUrl(croppedFile);
            setPortraitPreview(preview);
            await uploadCover(croppedFile, 'portrait');
        },
    });

    const handleCoverSelect = (orientation: CoverOrientation, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setCoverError(t('common.coverUpload.invalidImage'));
            return;
        }
        setCoverError(null);
        const cropper = orientation === 'portrait' ? portraitCropper : landscapeCropper;
        void cropper.openCropper(file).catch((error) => {
            console.error('open world cover cropper failed:', error);
            setCoverError(t('common.coverUpload.imageLoadFailed'));
        });
    };

    const suppressPreviewRef = useRef(false);
    const armSuppressPreview = () => {
        suppressPreviewRef.current = true;
        window.setTimeout(() => {
            suppressPreviewRef.current = false;
        }, 1000);
    };

    const inputRefFor = (orientation: CoverOrientation) => (
        orientation === 'portrait' ? portraitInputRef : landscapeInputRef
    );

    const handleEmptyCoverClick = (orientation: CoverOrientation) => {
        if (busy || !fileId) return;
        armSuppressPreview();
        inputRefFor(orientation).current?.click();
    };

    const handlePreviewCover = (src: string, event?: React.MouseEvent) => {
        event?.stopPropagation();
        if (suppressPreviewRef.current) return;
        if (busy || !src) return;
        setLightboxSrc(src);
    };

    const handleReplaceCover = (orientation: CoverOrientation, event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!fileId || busy) return;
        armSuppressPreview();
        inputRefFor(orientation).current?.click();
    };

    const openPromptModal = async (orientation: CoverOrientation, event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (!fileId || busy) return;
        if (!resolvedWorkTitle) {
            toast.error(t('common.coverUpload.titleRequired'));
            return;
        }
        const latestPoints = await refreshAuthUserPoints();
        const coverPrice = priceFor(orientation);
        if (coverPrice == null) {
            toast.error('Price unavailable');
            return;
        }
        if (typeof latestPoints === 'number' && latestPoints < coverPrice) {
            toast.error(
                t('common.coverUpload.pointsInsufficient', {
                    cost: coverPrice,
                    current: latestPoints,
                }),
            );
            return;
        }
        setPromptTarget(orientation);
        setPromptDraft('');
        setPromptModalOpen(true);
    };

    const closePromptModal = () => {
        if (coverGenerating) return;
        setPromptModalOpen(false);
    };

    const runAiGenerate = async () => {
        if (!fileId || coverGenerating) return;
        if (!resolvedWorkTitle) {
            toast.error(t('common.coverUpload.titleRequired'));
            return;
        }
        const orientation = promptTarget;
        // 功能注释：仅用户输入进提示词；空则后端垫图时沿用参考图标题字效
        const creativePrompt = buildCoverAiCreativePrompt({ promptDraft });

        setPromptModalOpen(false);
        try {
            setCoverGenerating(true);
            setBusyOrientation(orientation);
            setCoverError(null);
            const response = await EditorApi.generateGameCover(fileId, {
                prompt: creativePrompt,
                title: resolvedWorkTitle,
                orientation,
                // 功能注释：模型画标题；无提示词+有参考图时保持参考字效只改尺寸
                abArm: 'control',
            });
            if (!response.data?.success || !response.data?.data?.coverUrl) {
                toast.error(response.data?.message || t('common.coverUpload.aiGenerateFailed'));
                return;
            }
            let nextCoverUrl = response.data.data.coverUrl;
            const { overlayTitle, shouldOverlay } = resolveCoverPosterOverlay({
                workTitle: resolvedWorkTitle,
                serverPosterTitle: response.data.data.posterTitle,
                needsTitleOverlay: response.data.data.needsTitleOverlay,
                titleMode: response.data.data.titleMode,
                abArm: response.data.data.abArm,
            });

            if (shouldOverlay && overlayTitle) {
                try {
                    const composited = await compositePosterTitleOntoCover(
                        addImageTimestamp(getImageUrl(nextCoverUrl)),
                        overlayTitle,
                        {
                            orientation,
                            prompt: promptDraft,
                        },
                    );
                    const uploadRes = await EditorApi.uploadGameCover(fileId, composited, orientation);
                    if (uploadRes.data?.success && uploadRes.data?.data?.coverUrl) {
                        nextCoverUrl = uploadRes.data.data.coverUrl;
                    }
                } catch (overlayErr) {
                    console.error('composite poster title failed:', overlayErr);
                    toast.error(t('common.coverUpload.titleOverlayFailed'));
                }
            }

            await applyCoverPreview(orientation, nextCoverUrl);
            const deducted = response.data.data.pointsDeducted ?? priceFor(orientation) ?? 0;
            toast.success(
                t('common.coverUpload.aiGenerateSuccess', { cost: deducted }),
            );
            await refreshAuthUserPoints();
            onCoverUploaded?.({ orientation, coverUrl: nextCoverUrl });
        } catch (error) {
            console.error('AI generate game cover failed:', error);
            const err = error as {
                code?: string;
                message?: string;
                response?: { data?: { message?: string; error?: string } };
            };
            const timedOut = err?.code === 'ECONNABORTED'
                || /timeout/i.test(String(err?.message || ''));
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            toast.error(
                timedOut
                    ? t('common.coverUpload.aiGenerateTimeout')
                    : (apiMessage || t('common.coverUpload.aiGenerateFailed')),
            );
        } finally {
            setCoverGenerating(false);
            setBusyOrientation(null);
        }
    };

    const slotMeta = (orientation: CoverOrientation) => {
        const preview = orientation === 'portrait' ? portraitPreview : landscapePreview;
        return {
            preview,
            src: displaySrc(preview),
            slotBusy: busyOrientation === orientation,
            titleKey: orientation === 'portrait'
                ? 'common.coverUpload.portraitTitle'
                : 'common.coverUpload.landscapeTitle',
            hintKey: orientation === 'portrait'
                ? 'common.coverUpload.portraitHint'
                : 'common.coverUpload.landscapeHint',
        };
    };

    const renderSlotHeader = (orientation: CoverOrientation) => {
        const { slotBusy, titleKey, hintKey } = slotMeta(orientation);
        return (
            <div className={styles.coverHeaderRow} key={`${orientation}-head`}>
                <div>
                    <h3 className={styles.coverSlotTitle}>{t(titleKey)}</h3>
                    <p className={styles.coverSlotHint}>{t(hintKey)}</p>
                </div>
                <button
                    type="button"
                    className={styles.coverAiBtn}
                    onClick={(e) => void openPromptModal(orientation, e)}
                    disabled={!fileId || busy}
                >
                    {slotBusy && coverGenerating
                        ? t('common.coverUpload.aiGenerating')
                        : t('common.coverUpload.aiGenerate', { cost: priceFor(orientation) ?? '—' })}
                </button>
            </div>
        );
    };

    const renderSlotFrame = (orientation: CoverOrientation) => {
        const { preview, src, slotBusy, titleKey } = slotMeta(orientation);
        const ratioClass = orientation === 'portrait'
            ? styles.coverUploadAreaPortrait
            : styles.coverUploadAreaLandscape;
        const fileInput = (
            <input
                ref={inputRefFor(orientation)}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                hidden
                onChange={(event) => handleCoverSelect(orientation, event)}
                disabled={busy || !fileId}
            />
        );

        if (preview) {
            return (
                <div
                    className={`${styles.coverUploadArea} ${styles.coverUploadAreaPreview} ${ratioClass}`}
                    key={`${orientation}-frame`}
                >
                    {fileInput}
                    <div
                        className={`${styles.coverPreviewContainer} ${
                            orientation === 'portrait' ? styles.coverPreviewPortrait : ''
                        }`}
                    >
                        <button
                            type="button"
                            className={styles.coverPreviewHit}
                            onClick={(event) => handlePreviewCover(src, event)}
                            disabled={busy}
                            aria-label={t('common.coverUpload.clickToPreview')}
                        >
                            <img
                                src={src}
                                alt={resolvedWorkTitle || t(titleKey)}
                                className={styles.coverPreview}
                                draggable={false}
                                onError={(event) => {
                                    // 功能注释：首次拉取闪断时换新 bust 再试一次，避免一直裂图
                                    const img = event.currentTarget;
                                    const failed = String(img.dataset.coverRetry || '');
                                    if (failed === '1' || !preview) return;
                                    img.dataset.coverRetry = '1';
                                    bumpCacheBust(preview);
                                    img.src = addImageTimestamp(getImageUrl(preview));
                                }}
                            />
                            {!(slotBusy && coverGenerating) ? (
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
                                onClick={(event) => handleReplaceCover(orientation, event)}
                                disabled={busy}
                            >
                                {t('common.coverUpload.replace')}
                            </button>
                        </div>
                        {slotBusy && coverGenerating ? (
                            <div className={styles.coverGeneratingOverlay} aria-live="polite">
                                <div className={styles.coverGeneratingSpinner} />
                                <span>{t('common.coverUpload.aiGenerating')}</span>
                            </div>
                        ) : null}
                    </div>
                </div>
            );
        }

        return (
            <div
                className={`${styles.coverUploadArea} ${ratioClass}`}
                key={`${orientation}-frame`}
                onClick={() => handleEmptyCoverClick(orientation)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleEmptyCoverClick(orientation);
                    }
                }}
                aria-label={t('common.coverUpload.clickToUpload')}
            >
                {fileInput}
                <div className={styles.coverPlaceholder}>
                    <BsUpload className={styles.coverUploadIcon} size={32} />
                    <p className={styles.coverUploadText}>{t('common.coverUpload.clickToUpload')}</p>
                    <p className={styles.coverUploadHint}>{t('common.coverUpload.supportFormats')}</p>
                    {slotBusy && coverGenerating ? (
                        <p className={styles.coverUploadHint}>{t('common.coverUpload.aiGenerating')}</p>
                    ) : null}
                </div>
            </div>
        );
    };

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
                                {promptTarget === 'portrait'
                                    ? t('common.coverUpload.promptModalTitlePortrait')
                                    : t('common.coverUpload.promptModalTitle')}
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
                            <p className={styles.coverBriefStageTitle}>
                                {resolvedWorkTitle}
                            </p>
                        </div>

                        <div className={styles.coverBriefMetaRow}>
                            <p className={styles.coverBriefHint}>
                                {(promptTarget === 'portrait' && landscapePreview)
                                    || (promptTarget === 'landscape' && portraitPreview)
                                    ? t('common.coverUpload.promptModalHintWithRef')
                                    : t('common.coverUpload.promptModalHint')}
                            </p>
                            <span className={styles.coverBriefCost}>
                                {t('common.coverUpload.promptCostBadge', { cost: priceFor(promptTarget) ?? '—' })}
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
                                onChange={(e) => {
                                    setPromptDraft(e.target.value.slice(0, COVER_PROMPT_MAX));
                                }}
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

    const pendingCrop = landscapeCropper.pendingCropFile
        ? landscapeCropper
        : portraitCropper.pendingCropFile
            ? portraitCropper
            : null;

    return (
        <div className={`${styles.uploadCover} ${compact ? styles.uploadCoverCompact : ''}`}>
            {compact ? null : <h2>{t('common.coverUpload.title')}</h2>}
            <p className={styles.coverDualHint}>{t('common.coverUpload.bothRequired')}</p>
            <div className={styles.coverSlots}>
                {renderSlotHeader('landscape')}
                {renderSlotHeader('portrait')}
                {renderSlotFrame('landscape')}
                {renderSlotFrame('portrait')}
            </div>

            {coverError ? (
                <p className={styles.coverErrorText}>{coverError}</p>
            ) : null}

            {pendingCrop?.pendingCropFile ? (
                <ImageCropModal
                    isOpen
                    imageSrc={pendingCrop.pendingCropFile.imageSrc}
                    title={pendingCrop.cropPreset.title}
                    description={pendingCrop.cropPreset.description}
                    aspectRatio={pendingCrop.cropPreset.aspectRatio}
                    aspectLabel={pendingCrop.cropPreset.aspectLabel}
                    defaultCropScale={pendingCrop.cropPreset.defaultCropScale}
                    mimeType={pendingCrop.pendingCropFile.mimeType}
                    onClose={pendingCrop.closeCropper}
                    onCropComplete={pendingCrop.handleCropComplete}
                />
            ) : null}

            <PortraitLightbox
                open={Boolean(lightboxSrc)}
                src={lightboxSrc}
                title={resolvedWorkTitle || t('common.coverUpload.title')}
                onClose={() => setLightboxSrc(null)}
            />

            {promptModal}
        </div>
    );
};

export default CoverUpload;
