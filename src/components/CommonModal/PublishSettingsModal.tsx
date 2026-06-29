import React, { useRef, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BsUpload, BsChevronDown } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import styles from './PublishSettingsModal.module.css';
import EditorApi from '../../api/galgame/EditorData';
import getGameDataApi from '../../api/home/getGameData';
import { useImageCropper } from '../../hooks/useImageCropper';
import { getImageUrl } from '../../utils/constants';
import { addImageTimestamp, bumpCacheBust } from '../../utils/imageCache';
import { fileToDataUrl } from '../../utils/uploadImageCrop';
import ImageCropModal from './ImageCropModal';
import { CURRENCY_OPTIONS, type Currency } from '../../api/common/currency';

interface PublishSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: (description: string, shareType?: Currency, versionNotes?: string, notifyFavoritedUsers?: boolean) => Promise<void> | void;
    fileId?: string;
    coverUrl?: string;
    onCoverUploaded?: () => void;
    publishing?: boolean;
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

    const selectedOption = SHARE_TYPE_OPTIONS.find(opt => opt.value === value);

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
                    {SHARE_TYPE_OPTIONS.map(option => (
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
    publishing = false,
    gameTags,
    engine,
}) => {
    const { t } = useTranslation();
    const DESCRIPTION_MAX_LENGTH = 300;
    const VERSION_NOTES_MAX_LENGTH = 500;
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const [description, setDescription] = useState<string>('');
    const [versionNotes, setVersionNotes] = useState<string>('');
    const [notifyFavoritedUsers, setNotifyFavoritedUsers] = useState<boolean>(false);
    const [shareType, setShareType] = useState<'points' | 'diamonds'>('points');

    const isTxtMode = !gameTags && !engine || gameTags === 'TXT' || engine === 'TXT';
    const requiresShareType = !isTxtMode;

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
        // 同步发布弹窗封面回显
        setCoverPreview(coverUrl || null);
    }, [coverUrl, isOpen]);

    useEffect(() => {
        if (!isOpen || !fileId) return;

        const fetchGameDetail = async () => {
            try {
                const response = await getGameDataApi.getGameDetail({ fileId });
                if (response.data.success && response.data.data) {
                    // 同步发布弹窗最新详情
                    setDescription(response.data.data.description || '');
                    setVersionNotes(response.data.data.version_notes || '');
                    setCoverPreview(response.data.data.cover_url || null);
                }
            } catch (error) {
                console.error('Failed to fetch publish details:', error);
            }
        };

        void fetchGameDetail();
    }, [isOpen, fileId]);

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
            setCoverError(t('common.publishSettings.uploadFailed'));
        } finally {
            setCoverUploading(false);
        }
    }, [fileId, onCoverUploaded, t]);

    if (!isOpen) return null;

    const handleSubmit = (event?: React.MouseEvent<HTMLButtonElement>) => {
        event?.preventDefault();
        event?.stopPropagation();
        if (publishing) {
            return;
        }
        if (!coverPreview) {
            toast.error(t('common.publishSettings.coverRequired'));
            return;
        }

        const trimmed = description.trim();
        if (!trimmed) {
            toast.error(t('common.publishSettings.descriptionRequired'));
            return;
        }
        if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
            toast.error(t('common.publishSettings.descriptionTooLong', { max: DESCRIPTION_MAX_LENGTH }));
            return;
        }

        const trimmedVersionNotes = versionNotes.trim();
        if (trimmedVersionNotes.length > VERSION_NOTES_MAX_LENGTH) {
            toast.error(t('common.publishSettings.versionNotesTooLong', { max: VERSION_NOTES_MAX_LENGTH }));
            return;
        }

        onPublish(
            trimmed,
            requiresShareType ? shareType : undefined,
            trimmedVersionNotes,
            notifyFavoritedUsers,
        );
    };

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError(t('common.publishSettings.invalidImageType'));
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setCoverError(t('common.publishSettings.imageTooLarge'));
            return;
        }

        setCoverError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCoverPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        void uploadCover(file);
    };

    const handleCoverSelectForCrop = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError('Please upload an image file.');
            return;
        }

        setCoverError(null);
        void openCropper(file).catch((error) => {
            console.error('open publish cover cropper failed:', error);
            setCoverError('Failed to load image.');
        });
    };
    void handleCoverSelect;

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleReplaceCover = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        coverInputRef.current?.click();
    };

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.publishModalContent}>
                <button type="button" className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/关闭.png`} alt={t('common.close')} />
                </button>
                <h2 className={styles.modalTitle}>{t('common.publishSettings.title')}</h2>

                <div className={styles.formContent}>
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
                        <label className={styles.label}>{t('common.publishSettings.gameDescription')}</label>
                        <textarea
                            className={styles.descriptionInput}
                            placeholder={t('common.publishSettings.descriptionPlaceholder', { max: DESCRIPTION_MAX_LENGTH })}
                            value={description}
                            maxLength={DESCRIPTION_MAX_LENGTH}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <div className={styles.descriptionMetaRow}>
                            <span className={styles.descriptionCount}>
                                {description.length}/{DESCRIPTION_MAX_LENGTH}
                            </span>
                        </div>
                    </div>

                    {requiresShareType && (
                        <div className={styles.shareTypeFormGroup}>
                            <label className={styles.label}>结算货币类型</label>
                            <CustomSelect
                                value={shareType}
                                onChange={setShareType}
                            />
                        </div>
                    )}

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

                    <label className={styles.notifyCheckboxRow}>
                        <input
                            type="checkbox"
                            className={styles.notifyCheckbox}
                            checked={notifyFavoritedUsers}
                            onChange={(event) => setNotifyFavoritedUsers(event.target.checked)}
                        />
                        <span>{t('common.publishSettings.notifyFavoritedUsers')}</span>
                    </label>

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.publishBtn} onClick={handleSubmit} disabled={publishing}>
                            {t('common.publishSettings.publish')}
                        </button>
                    </div>
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
