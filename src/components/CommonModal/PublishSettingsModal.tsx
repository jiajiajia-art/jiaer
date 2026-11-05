import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './PublishSettingsModal.module.css';
import EditorApi from '../../api/galgame/EditorData';
import getGameDataApi from '../../api/home/getGameData';
import gameTagsApi from '../../api/gameTags/gameTagsApi';
import novelMetaApi from '../../api/novel/novelMetaApi';
import { useAuthStore } from '../../store/useAuthStore';
import { auth } from '../../api/account/authApi';
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
import { isValidContentAudience, type ContentAudience } from '../../utils/contentAudience';
import { hasBothGameCovers } from '../../utils/gameCovers.ts';
import ContentAudienceField from '../ContentAudienceField';
import CoverUpload from '../GameSettingEditor/WorldPanel/CoverUpload';
import {
    descriptionToPlainText,
    normalizeDescriptionForSave,
    toEditorHtml,
} from '../../utils/gameDescriptionHtml';
import { stripReplayMarkerFromTitle } from '../../utils/novelGame';
import SimpleRichTextEditor from '../Common/SimpleRichTextEditor';
import {
    isCreatorFrozen as checkCreatorFrozen,
    isPublishBanned as checkPublishBanned,
    isPublishNeedReview as checkPublishNeedReview,
} from '../../lib/userPunishment';

export type PublishModalMode = 'publish' | 'novel-edit';

export type PublishSubmitPayload = {
    description: string;
    tagIds: number[];
    versionNotes?: string | null;
    notifyFavoritedUsers?: boolean;
    audienceType?: 'male' | 'female' | 'all';
};

interface PublishSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (payload: PublishSubmitPayload) => Promise<void> | void;
    fileId?: string;
    coverUrl?: string;
    portraitCoverUrl?: string;
    onCoverUploaded?: () => void;
    onSaved?: () => void;
    publishing?: boolean;
    mode?: PublishModalMode;
    isNovel?: boolean;
}

const PublishSettingsModal: React.FC<PublishSettingsModalProps> = ({
    isOpen,
    onClose,
    onPublish,
    fileId,
    coverUrl,
    portraitCoverUrl,
    onCoverUploaded,
    onSaved,
    publishing = false,
    mode = 'publish',
    isNovel = false,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const updateUser = useAuthStore((s) => s.updateUser);
    const publishBanUntil = useAuthStore((s) => s.user?.user?.publishBanUntil);
    const publishNeedReviewFlag = useAuthStore((s) => s.user?.user?.publishNeedReview);
    const creatorFrozenFlag = useAuthStore((s) => s.user?.user?.creatorFrozen);
    const isPublishBanned = useMemo(
        () => checkPublishBanned(publishBanUntil),
        [publishBanUntil],
    );
    const isCreatorFrozen = useMemo(
        () => checkCreatorFrozen(creatorFrozenFlag),
        [creatorFrozenFlag],
    );
    const needsPublishReview = useMemo(
        () => checkPublishNeedReview(publishNeedReviewFlag) && !isPublishBanned && !isCreatorFrozen,
        [publishNeedReviewFlag, isPublishBanned, isCreatorFrozen],
    );

    useEffect(() => {
        if (!isOpen) return;
        // 功能注释：打开发布弹窗时刷新处罚字段，避免 store 过期
        void auth.getUserInfo().then((response) => {
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        }).catch(() => {
            /* 忽略：仍用 store 现有值 */
        });
    }, [isOpen, updateUser]);
    const VERSION_NOTES_MAX_LENGTH = 500;
    const isNovelEditMode = mode === 'novel-edit';
    // 后端 publish 对所有作品校验题材；发布弹窗必须可选，不能只给小说展示
    const showThemeTags = true;
    const themeTagsRequired = mode === 'publish';

    const [landscapePreview, setLandscapePreview] = useState<string | null>(coverUrl || null);
    const [isTakenDown, setIsTakenDown] = useState(false);
    const [portraitPreview, setPortraitPreview] = useState<string | null>(portraitCoverUrl || null);
    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [selectedThemeTagIds, setSelectedThemeTagIds] = useState<number[]>([]);
    const [selectedAudienceType, setSelectedAudienceType] = useState<ContentAudience | null>(null);
    const [availableThemeTags, setAvailableThemeTags] = useState<FlatThemeTag[]>([]);
    const [themeTagError, setThemeTagError] = useState<string>('');
    const [audienceError, setAudienceError] = useState<string>('');
    const displayThemeTags = useLocalizedThemeTags(availableThemeTags);
    const [saving, setSaving] = useState<boolean>(false);
    const [generatingDescription, setGeneratingDescription] = useState<boolean>(false);
    const [versionNotes, setVersionNotes] = useState<string>('');
    // 功能注释：已上架作品更新时先问要不要写日志；不写则传 null，避免空日志刷收藏通知
    const [isUpdateSubmission, setIsUpdateSubmission] = useState(false);
    const [updateLogChoice, setUpdateLogChoice] = useState<'with' | 'without' | null>(null);
    const [notifyFavoritedUsers, setNotifyFavoritedUsers] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) {
            setNotifyFavoritedUsers(false);
            setUpdateLogChoice(null);
            return;
        }
        setLandscapePreview(coverUrl || null);
        setPortraitPreview(portraitCoverUrl || null);
    }, [coverUrl, portraitCoverUrl, isOpen]);

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
                    setIsUpdateSubmission(
                        Number(detail.is_public) === 1
                        || Number(detail.published_version || 0) > 0,
                    );
                    setUpdateLogChoice(null);
                    setLandscapePreview(detail.cover_url || null);
                    setPortraitPreview(detail.portrait_cover_url || null);
                    const tagIds = Array.isArray(detail.theme_tag_ids)
                        ? detail.theme_tag_ids.filter((id) => Number.isFinite(Number(id)))
                        : [];
                    setSelectedThemeTagIds(tagIds.map((id) => Number(id)));
                    setSelectedAudienceType(isValidContentAudience(detail.audience_type) ? detail.audience_type : null);
                    setAudienceError('');
                    const moderation = String(detail.moderationStatus || detail.moderation_status || 'none');
                    setIsTakenDown(moderation === 'taken_down');
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

    const buildFormInput = useCallback(() => ({
        title,
        description,
        hasCover: hasBothGameCovers({
            cover_url: landscapePreview,
            portrait_cover_url: portraitPreview,
        }),
        themeTagIds: selectedThemeTagIds,
        audienceType: selectedAudienceType,
    }), [title, description, landscapePreview, portraitPreview, selectedThemeTagIds, selectedAudienceType]);

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

    const handleAudienceSelect = (next: ContentAudience) => {
        setSelectedAudienceType(next);
        setAudienceError('');
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
                if (result.error === 'AUDIENCE_REQUIRED') {
                    setAudienceError(t('createGame.contentAudienceRequired'));
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
                if (result.error === 'AUDIENCE_REQUIRED') {
                    setAudienceError(t('createGame.contentAudienceRequired'));
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
        if (!hasBothGameCovers({
            cover_url: landscapePreview,
            portrait_cover_url: portraitPreview,
        })) {
            toast.error(t('common.publishSettings.coverRequired'));
            return false;
        }

        // 实现发布前作品分类必填（男性向/女性向/全性向，单选）
        if (!isValidContentAudience(selectedAudienceType)) {
            setAudienceError(t('createGame.contentAudienceRequired'));
            toast.error(t('createGame.contentAudienceRequired'));
            return false;
        }

        if (selectedThemeTagIds.length < THEME_TAG_MIN_PUBLISH || selectedThemeTagIds.length > THEME_TAG_MAX) {
            setThemeTagError(t('createGame.themeTagRequired'));
            toast.error(t('createGame.themeTagRequired'));
            return false;
        }

        const trimmedVersionNotes = versionNotes.trim();
        if (isUpdateSubmission && updateLogChoice === null) {
            toast.error('请选择是否填写更新日志');
            return false;
        }
        if (isUpdateSubmission && updateLogChoice === 'with' && !trimmedVersionNotes) {
            toast.error('更新日志不能为空');
            return false;
        }
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
            // 草稿编辑也可顺带保存已选分类；发布路径必有合法值
            ...(isValidContentAudience(selectedAudienceType)
                ? { audienceType: selectedAudienceType }
                : {}),
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
        if (publishing || saving) {
            return;
        }

        if (!isNovelEditMode && isCreatorFrozen) {
            toast.error(t('report.creatorFrozenHint'));
            return;
        }

        if (!isNovelEditMode && isPublishBanned) {
            toast.error(t('report.publishBannedHint'));
            return;
        }

        if (!isNovelEditMode && isTakenDown) {
            toast.error(t('report.publishLockedHint'));
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
            versionNotes: isUpdateSubmission
                ? (updateLogChoice === 'with' ? versionNotes.trim() : null)
                : versionNotes.trim(),
            notifyFavoritedUsers,
            audienceType: selectedAudienceType || undefined,
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
                        <CoverUpload
                            compact
                            fileId={fileId}
                            coverUrl={landscapePreview || undefined}
                            portraitCoverUrl={portraitPreview || undefined}
                            workTitle={title}
                            onCoverUploaded={(info) => {
                                if (info?.orientation === 'portrait') {
                                    setPortraitPreview(info.coverUrl);
                                } else if (info?.orientation === 'landscape') {
                                    setLandscapePreview(info.coverUrl);
                                }
                                onCoverUploaded?.();
                            }}
                        />
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
                        <>
                            {/* 功能注释：作品分类放在作品标签之前，发布必选且只能选一项 */}
                            <ContentAudienceField
                                value={selectedAudienceType}
                                onChange={handleAudienceSelect}
                                required={themeTagsRequired}
                                error={audienceError}
                                disabled={publishing || saving}
                            />
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
                        </>
                    ) : null}

                    {!isNovelEditMode && (
                        <div className={styles.descriptionFormGroup}>
                            {isUpdateSubmission ? (
                                <>
                                    <label className={styles.label}>要填写更新日志吗？</label>
                                    <div className={styles.themeTagsWrap}>
                                        <button
                                            type="button"
                                            className={`${styles.themeTagChip} ${updateLogChoice === 'with' ? styles.themeTagChipActive : ''}`}
                                            onClick={() => setUpdateLogChoice('with')}
                                        >
                                            填写
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.themeTagChip} ${updateLogChoice === 'without' ? styles.themeTagChipActive : ''}`}
                                            onClick={() => setUpdateLogChoice('without')}
                                        >
                                            不填写
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <label className={styles.label}>{t('common.publishSettings.versionNotes')}</label>
                            )}
                            {(!isUpdateSubmission || updateLogChoice === 'with') ? (
                                <>
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
                                </>
                            ) : null}
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

                {!isNovelEditMode && (isCreatorFrozen || isPublishBanned || isTakenDown) ? (
                    <p className={styles.publishLockHint}>
                        {isCreatorFrozen
                            ? t('report.creatorFrozenHint')
                            : isPublishBanned
                                ? t('report.publishBannedHint')
                                : t('report.publishLockedHint')}
                        {isTakenDown && !isPublishBanned && !isCreatorFrozen ? (
                            <>
                                {' '}
                                <button
                                    type="button"
                                    className={styles.appealLinkBtn}
                                    onClick={() => {
                                        onClose();
                                        navigate('/appeals');
                                    }}
                                >
                                    {t('appeal.goAppeal')}
                                </button>
                            </>
                        ) : null}
                    </p>
                ) : null}
                {!isNovelEditMode && needsPublishReview ? (
                    <p className={styles.publishLockHint}>
                        {t('report.publishNeedReviewHint')}
                    </p>
                ) : null}

                <div className={styles.footerBar}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={onClose}
                        disabled={publishing || saving}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        className={styles.publishBtn}
                        onClick={handleSubmit}
                        disabled={
                            publishing
                            || saving
                            || generatingDescription
                            || (!isNovelEditMode && (isCreatorFrozen || isPublishBanned || isTakenDown))
                        }
                    >
                        {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublishSettingsModal;
