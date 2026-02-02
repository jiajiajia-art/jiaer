import React, { useRef, useCallback, useState } from 'react';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import styles from './PublishSettingsModal.module.css';
import EditorApi from '../../api/galgame/EditorData';
import { getImageUrl } from '../../utils/constants';
import { addImageTimestamp } from '../../utils/imageCache';

interface PublishSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPublish: () => void;
    fileId?: string;
    coverUrl?: string;
    onCoverUploaded?: () => void;
}

const PublishSettingsModal: React.FC<PublishSettingsModalProps> = ({
    isOpen,
    onClose,
    onPublish,
    fileId,
    coverUrl,
    onCoverUploaded,
}) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError('缺少文件ID，无法上传封面');
            return;
        }
        try {
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success) {
                toast.success('封面上传成功');
                setCoverPreview(getImageUrl(response.data.data.coverUrl));
                if (onCoverUploaded) {
                    onCoverUploaded();
                }
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
        } finally {
            setCoverUploading(false);
        }
    }, [fileId, onCoverUploaded]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        onPublish();
    };

    // 封面上传相关处理函数
    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setCoverError('请上传图片文件');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setCoverError('图片大小不能超过 5MB');
            return;
        }

        setCoverError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            setCoverPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        uploadCover(file);
    };

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleRemoveCover = () => {
        coverInputRef.current && (coverInputRef.current.value = '');
    };

    return (
        <div className={`${styles.modal} ${styles.modalShow}`}>
            <div className={styles.publishModalContent}>
                <button className={styles.closeBtn} onClick={onClose}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/关闭.png`} alt="关闭" />
                </button>
                <h2 className={styles.modalTitle}>发布设置</h2>

                <div className={styles.formContent}>
                        <div className={styles.coverFormGroup}>
                            <label className={styles.label}>封面图片</label>
                            <div 
                                className={`${styles.coverUploadArea} ${(coverUploading || !fileId) ? styles.coverUploadAreaDisabled : ''}`}
                                onClick={handleCoverClick}
                            >
                                <input
                                    ref={coverInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/jpg,image/webp"
                                    hidden
                                    onChange={handleCoverSelect}
                                    disabled={coverUploading || !fileId}
                                />
                                {coverPreview ? (
                                    <div className={styles.coverPreviewContainer}>
                                        <img src={addImageTimestamp(getImageUrl(coverPreview))} alt="封面预览" className={styles.coverPreview} />
                                        <div className={styles.coverActions}>
                                            <button
                                                type="button"
                                                className={styles.removeCoverBtn}
                                                onClick={handleRemoveCover}
                                                disabled={coverUploading}
                                            >
                                                替换
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.coverPlaceholder}>
                                        <BsUpload className={styles.coverUploadIcon} size={32} />
                                        <p className={styles.coverUploadText}>点击上传封面图片</p>
                                        <p className={styles.coverUploadHint}>支持 JPG、PNG、WEBP，最大 5MB</p>
                                    </div>
                                )}
                            </div>
                            {coverError && (
                                <p className={styles.coverErrorText}>{coverError}</p>
                            )}
                        </div>
                        <div className={styles.buttonGroup}>
                            <button className={styles.publishBtn} onClick={handleSubmit}>
                                发布
                            </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublishSettingsModal;

