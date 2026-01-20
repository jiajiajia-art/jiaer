import React, { useRef, useState, useCallback, useEffect } from 'react';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import styles from './WorldPanel.module.css';
import { addImageTimestamp, getImageUrl } from '../../../utils/constants';

interface CoverUploadProps {
    fileId?: string;
    coverUrl?: string;
    onCoverUploaded?: (coverUrl: string) => void; // 上传成功后的回调
}

const CoverUpload: React.FC<CoverUploadProps> = ({ fileId, coverUrl, onCoverUploaded }) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const isUploadingRef = useRef<boolean>(false); // 防止重复上传

    // 当 coverUrl prop 变化时，同步更新预览（例如父组件刷新数据后）
    useEffect(() => {
        if (coverUrl) {
            setCoverPreview(coverUrl);
        }
    }, [coverUrl]);

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // 防止重复上传
        if (isUploadingRef.current || coverUploading) {
            return;
        }

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
        
        // 清空 input 值，允许重复选择同一文件
        event.target.value = '';
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

        // 防止重复上传
        if (isUploadingRef.current) {
            return;
        }

        try {
            isUploadingRef.current = true;
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success) {
                toast.success('封面上传成功');
                // 使用返回的 coverUrl 更新预览
                if (response.data.data?.coverUrl) {
                    setCoverPreview(response.data.data.coverUrl);
                    // 通知父组件封面已更新
                    onCoverUploaded?.(response.data.data.coverUrl);
                }
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
        } finally {
            setCoverUploading(false);
            isUploadingRef.current = false;
        }
    }, [fileId, onCoverUploaded]);

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
                        <img src={addImageTimestamp(getImageUrl(coverPreview))} alt="封面预览" className={styles.coverPreview} />
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

