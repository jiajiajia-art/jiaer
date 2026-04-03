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
    onCoverUploaded?: (coverUrl: string) => void;
}

const CoverUpload: React.FC<CoverUploadProps> = ({ fileId, coverUrl, onCoverUploaded }) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState<boolean>(false);
    const [coverError, setCoverError] = useState<string | null>(null);
    const isUploadingRef = useRef<boolean>(false);
    const previousCoverUrlRef = useRef<string | undefined>(coverUrl);
    const objectPreviewRef = useRef<string | null>(null);

    const [showCropModal, setShowCropModal] = useState<boolean>(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);

    useEffect(() => {
        if (coverUrl) {
            setCoverPreview(coverUrl);
        }
    }, [coverUrl]);

    useEffect(() => () => {
        if (objectPreviewRef.current) {
            URL.revokeObjectURL(objectPreviewRef.current);
        }
    }, []);

    const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

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
        previousCoverUrlRef.current = coverPreview && !coverPreview.startsWith('data:image/') && !coverPreview.startsWith('blob:')
            ? coverPreview
            : coverUrl;

        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setImageToCrop(dataUrl);
            setShowCropModal(true);
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const handleCoverClick = () => {
        coverInputRef.current?.click();
    };

    const handleRemoveCover = (event: React.MouseEvent) => {
        event.stopPropagation();
        setCoverPreview(null);
        setCoverError(null);
        if (objectPreviewRef.current) {
            URL.revokeObjectURL(objectPreviewRef.current);
            objectPreviewRef.current = null;
        }
        if (coverInputRef.current) {
            coverInputRef.current.value = '';
        }
    };

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError('缺少文件ID，无法上传封面');
            return;
        }

        if (isUploadingRef.current) {
            return;
        }

        try {
            isUploadingRef.current = true;
            setCoverUploading(true);
            setCoverError(null);
            const response = await EditorApi.uploadGameCover(fileId, file);
            if (response.data.success && response.data.data?.coverUrl) {
                toast.success('封面上传成功');
                // 同步最新封面地址
                if (previousCoverUrlRef.current) {
                    bumpCacheBust(previousCoverUrlRef.current);
                }
                if (objectPreviewRef.current) {
                    URL.revokeObjectURL(objectPreviewRef.current);
                    objectPreviewRef.current = null;
                }
                setCoverPreview(response.data.data.coverUrl);
                onCoverUploaded?.(response.data.data.coverUrl);
            } else {
                setCoverError(response.data.message || '封面上传成功，但未获取到最新封面地址');
            }
        } catch (error) {
            console.error('上传封面失败:', error);
            setCoverError('封面上传失败，请重试');
        } finally {
            setCoverUploading(false);
            isUploadingRef.current = false;
        }
    }, [fileId, onCoverUploaded]);

    const handleCropComplete = useCallback((croppedBlob: Blob) => {
        if (croppedBlob) {
            const croppedFile = new File([croppedBlob], 'cover.jpg', {
                type: 'image/jpeg',
            });

            if (objectPreviewRef.current) {
                URL.revokeObjectURL(objectPreviewRef.current);
            }
            const previewUrl = URL.createObjectURL(croppedBlob);
            objectPreviewRef.current = previewUrl;
            setCoverPreview(previewUrl);
            void uploadCover(croppedFile);
        }

        setShowCropModal(false);
        setImageToCrop(null);
    }, [uploadCover]);

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
