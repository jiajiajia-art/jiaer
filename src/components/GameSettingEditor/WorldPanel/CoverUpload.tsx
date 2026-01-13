import React, { useRef, useState, useCallback } from 'react';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import styles from './WorldPanel.module.css';

interface CoverUploadProps {
    fileId?: string;
}

const CoverUpload: React.FC<CoverUploadProps> = ({ fileId }) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);

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

    const handleRemoveCover = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCoverPreview(null);
        coverInputRef.current && (coverInputRef.current.value = '');
    };

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
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
        } finally {
            setCoverUploading(false);
        }
    }, [fileId]);

    return (
        <div className={styles.uploadCover}>
            <p className={styles.eyebrow}>Step 2</p>
            <h2>游戏封面图片上传</h2>
            <div className={styles.coverUploadArea} onClick={handleCoverClick}>
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
                        <img src={coverPreview} alt="封面预览" className={styles.coverPreview} />
                        <div className={styles.coverActions}>
                            <button
                                type="button"
                                className={styles.removeCoverBtn}
                                onClick={handleRemoveCover}
                                disabled={coverUploading}
                            >
                                移除
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
    );
};

export default CoverUpload;

