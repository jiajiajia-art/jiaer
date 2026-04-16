import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BsUpload } from 'react-icons/bs';
import { toast } from 'react-hot-toast';
import EditorApi from '../../../api/galgame/EditorData';
import { useImageCropper } from '../../../hooks/useImageCropper';
import { getImageUrl } from '../../../utils/constants';
import { addImageTimestamp, bumpCacheBust } from '../../../utils/imageCache';
import { fileToDataUrl, MAX_UPLOAD_IMAGE_SIZE } from '../../../utils/uploadImageCrop';
import ImageCropModal from '../../CommonModal/ImageCropModal';
import styles from './WorldPanel.module.css';

interface CoverUploadProps {
    fileId?: string;
    coverUrl?: string;
    onCoverUploaded?: () => void;
}

const CoverUpload: React.FC<CoverUploadProps> = ({
    fileId,
    coverUrl,
    onCoverUploaded,
}) => {
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(coverUrl || null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);

    useEffect(() => {
        setCoverPreview(coverUrl || null);
    }, [coverUrl]);

    const uploadCover = useCallback(async (file: File) => {
        if (!fileId) {
            setCoverError('Missing file id.');
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
                toast.success('封面更新');
                onCoverUploaded?.();
            } else {
                setCoverError(response.data.message || 'Failed to upload cover.');
            }
        } catch (error) {
            console.error('upload world cover failed:', error);
            setCoverError('Failed to upload cover.');
        } finally {
            setCoverUploading(false);
        }
    }, [fileId, onCoverUploaded]);

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
            setCoverError('Please upload an image file.');
            return;
        }

        if (file.size > MAX_UPLOAD_IMAGE_SIZE) {
            setCoverError('Image size must be under 5MB.');
            return;
        }

        setCoverError(null);
        void openCropper(file).catch((error) => {
            console.error('open world cover cropper failed:', error);
            setCoverError('Failed to load image.');
        });
    };

    const handleCoverClick = () => {
        if (!fileId || coverUploading) {
            return;
        }
        coverInputRef.current?.click();
    };

    const handleReplaceCover = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        handleCoverClick();
    };

    return (
        <div className={styles.uploadCover}>
            <h2>Game cover</h2>
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
                                coverPreview.startsWith('data:image/')
                                    ? coverPreview
                                    : addImageTimestamp(getImageUrl(coverPreview))
                            }
                            alt="Game cover preview"
                            className={styles.coverPreview}
                        />
                        <div className={styles.coverActions}>
                            <button
                                type="button"
                                className={styles.removeCoverBtn}
                                onClick={handleReplaceCover}
                                disabled={coverUploading}
                            >
                                Replace
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.coverPlaceholder}>
                        <BsUpload className={styles.coverUploadIcon} size={32} />
                        <p className={styles.coverUploadText}>Click to upload cover image</p>
                        <p className={styles.coverUploadHint}>Supports JPG, PNG, WEBP, up to 5MB</p>
                    </div>
                )}
            </div>

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
        </div>
    );
};

export default CoverUpload;
