import React, { useRef, useState, useCallback, useEffect } from 'react';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import styles from './WorldPanel.module.css';
import { getImageUrl } from '../../../utils/constants';
import { addImageTimestamp, bumpCacheBust } from '../../../utils/imageCache';
import ImageCropModal from '../../CommonModal/ImageCropModal';

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
    const previousCoverUrlRef = useRef<string | undefined>(coverUrl);

    // 裁剪相关状态
    const [showCropModal, setShowCropModal] = useState<boolean>(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);

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
        previousCoverUrlRef.current = coverPreview && !coverPreview.startsWith('data:image/') 
            ? coverPreview
            : coverUrl;

        // 读取图片并打开裁剪弹窗
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setImageToCrop(dataUrl);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);

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
                    if (previousCoverUrlRef.current) {
                        bumpCacheBust(previousCoverUrlRef.current);
                    }
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

    // 裁剪完成回调
    const handleCropComplete = useCallback((croppedBlob: Blob) => {
        if (croppedBlob) {
            // 使用裁剪后的 blob 创建新文件
            const croppedFile = new File([croppedBlob], 'cover.jpg', {
                type: 'image/jpeg',
            });
            // 保存本地预览
            const previewUrl = URL.createObjectURL(croppedBlob);
            setCoverPreview(previewUrl);
            // 上传裁剪后的图片
            uploadCover(croppedFile);
        }
        // 清理状态
        setShowCropModal(false);
        setImageToCrop(null);
    }, [uploadCover]);

    // 关闭裁剪弹窗
    const handleCloseCropModal = useCallback(() => {
        setShowCropModal(false);
        setImageToCrop(null);
    }, []);
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
                        <img 
                            src={
                                // 本地预览（base64 或 blob://）直接使用；否则使用服务器URL
                                (coverPreview.startsWith('data:image/') || coverPreview.startsWith('blob:'))
                                    ? coverPreview 
                                    : addImageTimestamp(getImageUrl(coverPreview))
                            } 
                            alt="封面预览" 
                            className={styles.coverPreview} 
                        />
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

            {/* 图片裁剪弹窗 */}
            {imageToCrop && (
                <ImageCropModal
                    isOpen={showCropModal}
                    imageSrc={imageToCrop}
                    onClose={handleCloseCropModal}
                    onCropComplete={handleCropComplete}
                    aspectRatio={16 / 9}
                    outputWidth={800}
                    outputHeight={450}
                />
            )}
        </div>
    );
};

export default CoverUpload;

