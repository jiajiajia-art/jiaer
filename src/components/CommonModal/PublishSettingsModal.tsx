import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BsUpload, BsChevronDown } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import styles from './PublishSettingsModal.module.css';
import EditorApi from '../../api/galgame/EditorData';
import getGameDataApi from '../../api/home/getGameData';
import gameTagsApi from '../../api/gameTags/gameTagsApi';
import novelMetaApi from '../../api/novel/novelMetaApi';
import { useImageCropper } from '../../hooks/useImageCropper';
import { getImageUrl } from '../../utils/constants';
import { addImageTimestamp, bumpCacheBust } from '../../utils/imageCache';
import { fileToDataUrl } from '../../utils/uploadImageCrop';
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../../utils/themeTags';
import {
    NOVEL_DESCRIPTION_MAX_LENGTH,
    THEME_TAG_MAX,
    THEME_TAG_MIN_PUBLISH,
    toggleThemeTagSelection,
    validateNovelDraftSave,
    validateNovelPublish,
    mapNovelEditErrorToI18nKey,
} from '../../utils/novelEdit';
import {
    descriptionToPlainText,
    normalizeDescriptionForSave,
    toEditorHtml,
} from '../../utils/gameDescriptionHtml';
import { stripReplayMarkerFromTitle } from '../../utils/novelGame';
import ImageCropModal from './ImageCropModal';
import SimpleRichTextEditor from '../Common/SimpleRichTextEditor';
import { CURRENCY_OPTIONS, type Currency } from '../../api/common/currency';

export type PublishModalMode = 'publish' | 'novel-edit';

export type PublishSubmitPayload = {
    description: string;
    tagIds: number[];
    shareType?: Currency;
    versionNotes?: string;
    notifyFavoritedUsers?: boolean;
};

interface PublishSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (payload: PublishSubmitPayload) => Promise<void> | void;
    fileId?: string;
    coverUrl?: string;
    onCoverUploaded?: () => void;
    onSaved?: () => void;
    publishing?: boolean;
    mode?: PublishModalMode;
    isNovel?: boolean;
    gameTags?: string;
    engine?: string;
}


const SHARE_TYPE_OPTIONS = CURRENCY_OPTIONS;

const CustomSelect: React.FC<{
    value: Currency;
    onChange: (value: Currency) => void;
}> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = SHARE_TYPE_OPTIONS.find((opt) => opt.value === value);

    return (
        <div ref={selectRef} className={styles.customSelectWrapper}>
            <button
                type="button"
                className={`${styles.customSelectTrigger} ${isOpen ? styles.customSelectTriggerOpen : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedOption?.label}</span>
                <BsChevronDown className={`${styles.customSelectArrow} ${isOpen ? styles.customSelectArrowOpen : ''}`} />
            </button>
            {isOpen && (
                <ul className={styles.customSelectDropdown}>
                    {SHARE_TYPE_OPTIONS.map((option) => (
                        <li
                            key={option.value}
                            className={`${styles.customSelectOption} ${option.value === value ? styles.customSelectOptionSelected : ''}`}
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                        >
                            {option.label}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const PublishSettingsModal: React.FC<PublishSettingsModalProps> = ({
    isOpen,
    onClose,
    onPublish,
    fileId,
    coverUrl,
    onCoverUploaded,
    onSaved,
    publishing = false,
    mode = 'publish',
    isNovel = false,
    gameTags,
    engine,
}) => {
    const { t } = useTranslation();
    const VERSION_NOTES_MAX_LENGTH = 500;
    const isNovelEditMode = mode === 'novel-edit';
    // 后端 publish 对所有作品校验题材；发布弹窗必须可选，不能只给小说展示
    const showThemeTags = true;
    const themeTagsRequired = mode === 'publish';
    const isTxtMode = !gameTags && !engine || gameTags === 'TXT' || engine === 'TXT';
    const requiresShareType = !isTxtMode;

    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
    const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
    const [themeTagError, setThemeTagError] = useState<string>('');
    const displayThemeTags = useLocalizedThemeTags(availableThemeTags);
    const [saving, setSaving] = useState<boolean>(false);
    const [generatingDescription, setGeneratingDescription] = useState<boolean>(false);
    const [versionNotes, setVersionNotes] = useState<string>('');
    const [notifyFavoritedUsers, setNotifyFavoritedUsers] = useState<boolean>(false);
    const [shareType, setShareType] = useState<Currency>('points');

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

    useEffect(() => {
        if (!isOpen) {
            setNotifyFavoritedUsers(false);
            return;
        }
        setCoverPreview(coverUrl || null);
    }, [coverUrl, isOpen]);

    useEffect(() => {
        if (!isOpen || !fileId) return;

        const fetchGameDetail = async () => {
            try {
                const response = await getGameDataApi.getGameDetail({ fileId });
                if (response.data.success && response.data.data) {
                    const detail = response.data.data;
                    const rawTitle = detail.title || '';
                    setTitle(
                        (isNovel || isNovelEditMode)
                            ? (stripReplayMarkerFromTitle(rawTitle) || rawTitle)
                            : rawTitle,
                    );
                    setDescription(toEditorHtml(detail.description || ''));
                    setVersionNotes(detail.version_notes || '');
                    setCoverPreview(detail.cover_url || null);
                    const tagIds = Array.isArray(detail.theme_tag_ids)
                        ? detail.theme_tag_ids.filter((id) => Number.isFinite(Number(id)))
                        : [];
                    setSelectedThemeTagIds(tagIds.map((id) => Number(id)));
                }
            } catch (error) {
                console.error('Failed to fetch publish details:', error);
            }
        };

        void fetchGameDetail();
    }, [isOpen, fileId, isNovel, isNovelEditMode]);

    useEffect(() => {
        if (!isOpen || !showThemeTags) return;

        const fetchThemeTags = async () => {
            try {
                const response = await gameTagsApi.getGameTagsTree();
                if (response.data.success && Array.isArray(response.data.data)) {
                    setAvailableThemeTags(flattenThemeTags(response.data.data));
                }
            } catch (error) {
                console.error('Failed to fetch theme tags:', error);
            }
        };

        void fetchThemeTags();
    }, [isOpen, showThemeTags]);

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError(t('common.publishSettings.missingFileId'));
            return;
        }

        try {
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success) {
                toast.success(t('common.publishSettings.uploadSuccess'));
                bumpCacheBust(response.data.data.coverUrl);
                setCoverPreview(response.data.data.coverUrl);
                if (onCoverUploaded) {
                    onCoverUploaded();
                }
            } else {
                setCoverError(response.data.message || t('common.publishSettings.uploadFailed'));
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setCoverError(apiMessage || t('common.publishSettings.uploadFailed'));
        } finally {
            setCoverUploading(false);
        }
    }, [fileId, onCoverUploaded, t]);

    const buildFormInput = useCallback(() => ({
        title,
        description,
        hasCover: Boolean(coverPreview),
        themeTagIds: selectedThemeTagIds,
    }), [title, description, coverPreview, selectedThemeTagIds]);

    const handleThemeTagToggle = (tagId: number) => {
        const { next, atMax } = toggleThemeTagSelection(selectedThemeTagIds, tagId);
        if (atMax) {
            setThemeTagError(t('createGame.themeTagRequired'));
            return;
        }
        setSelectedThemeTagIds(next);
        if (themeTagsRequired && next.length >= 1) {
            setThemeTagError('');
        } else if (!themeTagsRequired && next.length <= 2) {
            setThemeTagError('');
        }
    };

    const handleGenerateDescription = async () => {
        if (!fileId || generatingDescription || publishing || saving) {
            return;
        }
        if (!title.trim()) {
            toast.error(t('common.publishSettings.titleRequired'));
            return;
        }

        try {
            setGeneratingDescription(true);
            const response = await novelMetaApi.generateDescription(fileId, {
                title: title.trim(),
            });
            const nextDescription = response.data?.data?.description || '';
            if (!response.data?.success || !nextDescription) {
                toast.error(response.data?.message || t('common.publishSettings.aiGenerateFailed'));
                return;
            }
            setDescription(toEditorHtml(nextDescription));
            toast.success(t('common.publishSettings.aiGenerateSuccess'));
        } catch (error: any) {
            console.error('AI 生成简介失败:', error);
            toast.error(error?.response?.data?.message || t('common.publishSettings.aiGenerateFailed'));
        } finally {
            setGeneratingDescription(false);
        }
    };

    const validateForm = () => {
        const input = buildFormInput();

        if (isNovelEditMode) {
            const result = validateNovelDraftSave(input);
            if (!result.valid && result.error) {
                const key = mapNovelEditErrorToI18nKey(result.error);
                if (result.error === 'DESCRIPTION_TOO_LONG') {
                    toast.error(t(key, { max: NOVEL_DESCRIPTION_MAX_LENGTH }));
                } else {
                    toast.error(t(key));
                }
                if (result.error === 'THEME_TAG_MIN' || result.error === 'THEME_TAG_MAX') {
                    setThemeTagError(t('createGame.themeTagRequired'));
                }
                return false;
            }
            return true;
        }

        if (isNovel && mode === 'publish') {
            const result = validateNovelPublish(input);
            if (!result.valid && result.error) {
                const key = mapNovelEditErrorToI18nKey(result.error);
                if (result.error === 'DESCRIPTION_TOO_LONG') {
                    toast.error(t(key, { max: NOVEL_DESCRIPTION_MAX_LENGTH }));
                } else {
                    toast.error(t(key));
                }
                if (result.error === 'THEME_TAG_MIN' || result.error === 'THEME_TAG_MAX') {
                    setThemeTagError(t('createGame.themeTagRequired'));
                }
                return false;
            }
            return true;
        }

        const trimmed = descriptionToPlainText(description);
        if (!trimmed) {
            toast.error(t('common.publishSettings.descriptionRequired'));
            return false;
        }
        if (Array.from(trimmed).length > NOVEL_DESCRIPTION_MAX_LENGTH) {
            toast.error(t('common.publishSettings.descriptionTooLong', { max: NOVEL_DESCRIPTION_MAX_LENGTH }));
            return false;
        }
        if (!coverPreview) {
            toast.error(t('common.publishSettings.coverRequired'));
            return false;
        }

        if (selectedThemeTagIds.length < THEME_TAG_MIN_PUBLISH || selectedThemeTagIds.length > THEME_TAG_MAX) {
            setThemeTagError(t('createGame.themeTagRequired'));
            toast.error(t('createGame.themeTagRequired'));
            return false;
        }

        const trimmedVersionNotes = versionNotes.trim();
        if (trimmedVersionNotes.length > VERSION_NOTES_MAX_LENGTH) {
            toast.error(t('common.publishSettings.versionNotesTooLong', { max: VERSION_NOTES_MAX_LENGTH }));
            return false;
        }

        return true;
    };

    const persistThemeTags = async () => {
        if (!fileId) {
            throw new Error(t('common.publishSettings.missingFileId'));
        }
        await gameTagsApi.setGameTagsForGame({
            fileId,
            tagIds: selectedThemeTagIds,
        });
    };

    const persistNovelMetaAndTags = async () => {
        if (!fileId) {
            throw new Error(t('common.publishSettings.missingFileId'));
        }

        await novelMetaApi.patchNovelMeta(fileId, {
            title: title.trim(),
            description: normalizeDescriptionForSave(description),
        });
        await persistThemeTags();
    };

    const handleSubmit = async (event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.preventDefault();
        event?.stopPropagation();
        if (publishing || saving || coverUploading) {
            return;
        }

        if (!validateForm()) {
            return;
        }

        if (isNovelEditMode) {
            try {
                setSaving(true);
                await persistNovelMetaAndTags();
                toast.success(t('common.publishSettings.saveSuccess'));
                if (onSaved) {
                    onSaved();
                }
                onClose();
            } catch (error) {
                console.error('保存小说元信息失败:', error);
                toast.error(t('common.publishSettings.saveFailed'));
            } finally {
                setSaving(false);
            }
            return;
        }

        const trimmed = normalizeDescriptionForSave(description);
        try {
            setSaving(true);
            if (isNovel) {
                await persistNovelMetaAndTags();
            } else {
                // 非小说：弹窗选题材后先写入，再走发布（后端查 game_tag_map）
                await persistThemeTags();
            }
        } catch (error) {
            console.error('保存发布题材失败:', error);
            toast.error(t('common.publishSettings.saveFailed'));
            setSaving(false);
            return;
        }
        setSaving(false);

        await onPublish({
            description: trimmed,
            tagIds: selectedThemeTagIds,
            shareType: requiresShareType ? shareType : undefined,
            versionNotes: versionNotes.trim(),
            notifyFavoritedUsers,
        });
    };

    const modalTitle = useMemo(() => {
        if (isNovelEditMode) {
            return t('common.publishSettings.editNovelTitle');
        }
        if (isNovel && mode === 'publish') {
            return t('common.publishSettings.listOnShelfTitle');
        }
        return t('common.publishSettings.title');
    }, [isNovelEditMode, isNovel, mode, t]);

    const submitLabel = useMemo(() => {
        if (isNovelEditMode) {
            return t('common.publishSettings.saveChanges');
        }
        if (isNovel && mode === 'publish') {
            return t('common.publishSettings.listOnShelf');
        }
        return t('common.publishSettings.publish');
    }, [isNovelEditMode, isNovel, mode, t]);

    if (!isOpen) return null;

    const handleCoverSelectForCrop = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError(t('common.publishSettings.invalidImageType'));
            return;
        }

        setCoverError(null);
        void openCropper(file).catch((error) => {
            console.error('open publish cover cropper failed:', error);
            setCoverError(t('common.coverUpload.imageLoadFailed'));
        });
    };

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleReplaceCover = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        coverInputRef.current?.click();
    };

    const showTitleField = isNovelEditMode || (mode === 'publish' && isNovel);

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.publishModalContent}>
                <div className={styles.modalHead}>
                    <h2 className={styles.modalTitle}>{modalTitle}</h2>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label={t('common.close')}
                    >
                        ×
                    </button>
                </div>

                <div className={styles.formScroll}>
                <div className={styles.formContent}>
                    {showTitleField ? (
                        <div className={styles.textFormGroup}>
                            <label className={styles.label}>{t('common.publishSettings.novelTitle')}</label>
                            <input
                                className={styles.titleInput}
                                placeholder={t('common.publishSettings.novelTitlePlaceholder')}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>
                    ) : null}

                    <div className={styles.coverFormGroup}>
                        <label className={styles.label}>{t('common.publishSettings.coverImage')}</label>
                        <div
                            className={`${styles.coverUploadArea} ${(coverUploading || !fileId) ? styles.coverUploadAreaDisabled : ''}`}
                            onClick={handleCoverClick}
                        >
                            <input
                                ref={coverInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg,image/webp"
                                hidden
                                onChange={handleCoverSelectForCrop}
                                disabled={coverUploading || !fileId}
                            />
                            {coverPreview ? (
                                <div className={styles.coverPreviewContainer}>
                                    <img
                                        src={
                                            coverPreview.startsWith('data:image/')
                                                ? coverPreview
                                                : addImageTimestamp(getImageUrl(coverPreview))
                                        }
                                        alt={t('common.publishSettings.coverPreview')}
                                        className={styles.coverPreview}
                                    />
                                    <div className={styles.coverActions}>
                                        <button
                                            type="button"
                                            className={styles.removeCoverBtn}
                                            onClick={handleReplaceCover}
                                            disabled={coverUploading}
                                        >
                                            {t('common.publishSettings.replace')}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.coverPlaceholder}>
                                    <BsUpload className={styles.coverUploadIcon} size={32} />
                                    <p className={styles.coverUploadText}>{t('common.publishSettings.clickToUpload')}</p>
                                    <p className={styles.coverUploadHint}>{t('common.publishSettings.supportFormats')}</p>
                                </div>
                            )}
                        </div>
                        {coverError && (
                            <p className={styles.coverErrorText}>{coverError}</p>
                        )}
                    </div>

                    <div className={styles.descriptionFormGroup}>
                            <div className={styles.descriptionLabelRow}>
                                <label className={styles.label}>{t('common.publishSettings.gameDescription')}</label>
                                {(isNovelEditMode || isNovel) ? (
                                    <button
                                        type="button"
                                        className={styles.aiGenerateBtn}
                                        onClick={handleGenerateDescription}
                                        disabled={generatingDescription || publishing || saving || !fileId}
                                    >
                                        {generatingDescription
                                            ? t('common.publishSettings.aiGenerating')
                                            : t('createGame.aiGenerate')}
                                    </button>
                                ) : null}
                            </div>
                            <SimpleRichTextEditor
                                className={styles.richEditorDark}
                                value={description}
                                onChange={setDescription}
                                maxPlainLength={NOVEL_DESCRIPTION_MAX_LENGTH}
                                placeholder={t('common.publishSettings.descriptionPlaceholder', { max: NOVEL_DESCRIPTION_MAX_LENGTH })}
                                disabled={generatingDescription || publishing || saving}
                                onUploadImage={async (file) => {
                                    if (!fileId) {
                                        throw new Error(t('common.publishSettings.missingFileId'));
                                    }
                                    const resp = await EditorApi.uploadDescImage(fileId, file);
                                    const url = resp.data?.data?.url;
                                    if (!resp.data?.success || !url) {
                                        throw new Error(resp.data?.message || t('common.richEditor.imageUploadFailed', { defaultValue: '图片上传失败' }));
                                    }
                                    return url.startsWith('/') ? url : `/${url}`;
                                }}
                            />
                        </div>

                    {showThemeTags ? (
                        <div className={styles.themeTagsPanel}>
                            <div className={styles.themeTagsHeader}>
                                <span className={styles.themeTagsLabel}>
                                    {t('common.publishSettings.gameTags')}
                                    {themeTagsRequired ? <span className={styles.requiredMark}>*</span> : null}
                                </span>
                                <span className={styles.themeTagsHint}>
                                    {themeTagsRequired
                                        ? t('createGame.min1Max2Tags')
                                        : t('common.publishSettings.draftTagsOptionalHint')}
                                </span>
                            </div>
                            <div className={styles.themeTagsWrap}>
                                {displayThemeTags.map((tag) => {
                                    const active = selectedThemeTagIds.includes(tag.id);
                                    return (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            className={`${styles.themeTagChip} ${active ? styles.themeTagChipActive : ''}`}
                                            onClick={() => handleThemeTagToggle(tag.id)}
                                            title={tag.pathLabel || tag.name}
                                        >
                                            {tag.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {themeTagError ? <div className={styles.themeTagError}>{themeTagError}</div> : null}
                        </div>
                    ) : null}

                    {!isNovelEditMode && requiresShareType && (
                        <div className={styles.shareTypeFormGroup}>
                            <label className={styles.label}>{t('common.publishSettings.shareType', { defaultValue: '结算货币类型' })}</label>
                            <CustomSelect
                                value={shareType}
                                onChange={setShareType}
                            />
                        </div>
                    )}

                    {!isNovelEditMode && (
                        <div className={styles.descriptionFormGroup}>
                            <label className={styles.label}>{t('common.publishSettings.versionNotes')}</label>
                            <textarea
                                className={styles.descriptionInput}
                                placeholder={t('common.publishSettings.versionNotesPlaceholder', { max: VERSION_NOTES_MAX_LENGTH })}
                                value={versionNotes}
                                maxLength={VERSION_NOTES_MAX_LENGTH}
                                onChange={(e) => setVersionNotes(e.target.value)}
                            />
                            <div className={styles.descriptionMetaRow}>
                                <span className={styles.descriptionCount}>
                                    {versionNotes.length}/{VERSION_NOTES_MAX_LENGTH}
                                </span>
                            </div>
                        </div>
                    )}

                    {!isNovelEditMode && (
                        <label className={styles.notifyCheckboxRow}>
                            <input
                                type="checkbox"
                                className={styles.notifyCheckbox}
                                checked={notifyFavoritedUsers}
                                onChange={(event) => setNotifyFavoritedUsers(event.target.checked)}
                            />
                            <span>{t('common.publishSettings.notifyFavoritedUsers')}</span>
                        </label>
                    )}
                </div>
                </div>

                <div className={styles.footerBar}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onClose}
                        disabled={publishing || saving || coverUploading}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        className={styles.publishBtn}
                        onClick={handleSubmit}
                        disabled={publishing || saving || coverUploading || generatingDescription}
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
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
        </div>
    );
};

export default PublishSettingsModal;
