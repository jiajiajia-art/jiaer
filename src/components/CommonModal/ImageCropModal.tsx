import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { centerCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { IoClose } from 'react-icons/io5';
import {
    buildCropExportAttempts,
    CROP_EXPORT_ERROR_MESSAGE,
    MAX_UPLOAD_IMAGE_SIZE,
} from '../../utils/uploadImageCrop';
import styles from './ImageCropModal.module.css';

interface ImageCropModalProps {
    isOpen: boolean;
    imageSrc: string;
    title: string;
    description: string;
    aspectRatio: number;
    aspectLabel: string;
    defaultCropScale: number;
    mimeType?: string;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void | Promise<void>;
}

type CropMetrics = {
    image: HTMLImageElement;
    sx: number;
    sy: number;
    sourceWidth: number;
    sourceHeight: number;
};

const ImageCropModal: React.FC<ImageCropModalProps> = ({
    isOpen,
    imageSrc,
    title,
    description,
    aspectRatio,
    aspectLabel,
    defaultCropScale,
    mimeType = 'image/jpeg',
    onClose,
    onCropComplete,
}) => {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState('');
    const imgRef = useRef<HTMLImageElement>(null);

    const createDefaultCrop = useCallback((
        mediaWidth: number,
        mediaHeight: number,
    ): PixelCrop => {
        const safeScale = Math.min(Math.max(defaultCropScale, 0.01), 1);
        const mediaAspectRatio = mediaWidth / mediaHeight;

        let maxWidth = mediaWidth;
        let maxHeight = mediaHeight;

        if (mediaAspectRatio > aspectRatio) {
            maxWidth = mediaHeight * aspectRatio;
        } else {
            maxHeight = mediaWidth / aspectRatio;
        }

        const cropWidth = Math.max(Math.round(maxWidth * safeScale), 1);
        const cropHeight = Math.max(Math.round(maxHeight * safeScale), 1);

        return centerCrop(
            {
                unit: 'px',
                width: cropWidth,
                height: cropHeight,
                x: 0,
                y: 0,
            },
            mediaWidth,
            mediaHeight,
        ) as PixelCrop;
    }, [aspectRatio, defaultCropScale]);

    const onImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = event.currentTarget;
        const nextCrop = createDefaultCrop(width, height);
        setCrop(nextCrop);
        setCompletedCrop(nextCrop);
        setExportError('');
    }, [createDefaultCrop]);

    const getCropMetrics = useCallback((): CropMetrics | null => {
        const image = imgRef.current;
        if (!image || !completedCrop?.width || !completedCrop?.height) {
            return null;
        }

        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;

        return {
            image,
            sx: Math.round(completedCrop.x * scaleX),
            sy: Math.round(completedCrop.y * scaleY),
            sourceWidth: Math.max(Math.round(completedCrop.width * scaleX), 1),
            sourceHeight: Math.max(Math.round(completedCrop.height * scaleY), 1),
        };
    }, [completedCrop]);

    const exportAttempt = useCallback((
        metrics: CropMetrics,
        exportMimeType: string,
        exportScale: number,
        exportQuality?: number,
    ): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
                resolve(null);
                return;
            }

            const targetWidth = Math.max(Math.round(metrics.sourceWidth * exportScale), 1);
            const targetHeight = Math.max(Math.round(metrics.sourceHeight * exportScale), 1);

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';

            context.drawImage(
                metrics.image,
                metrics.sx,
                metrics.sy,
                metrics.sourceWidth,
                metrics.sourceHeight,
                0,
                0,
                targetWidth,
                targetHeight,
            );

            canvas.toBlob(
                (blob) => resolve(blob),
                exportMimeType,
                exportQuality,
            );
        });
    }, []);

    const getCroppedImage = useCallback(async (): Promise<Blob | null> => {
        const metrics = getCropMetrics();
        if (!metrics) {
            return null;
        }

        for (const attempt of buildCropExportAttempts(mimeType)) {
            const blob = await exportAttempt(metrics, attempt.mimeType, attempt.scale, attempt.quality);
            if (blob && blob.size <= MAX_UPLOAD_IMAGE_SIZE) {
                return blob;
            }
        }

        return null;
    }, [exportAttempt, getCropMetrics, mimeType]);

    const handleConfirm = useCallback(async () => {
        setIsExporting(true);
        setExportError('');
        try {
            const blob = await getCroppedImage();
            if (blob) {
                await onCropComplete(blob);
                return;
            }

            setExportError(CROP_EXPORT_ERROR_MESSAGE);
        } finally {
            setIsExporting(false);
        }
    }, [getCroppedImage, onCropComplete]);

    if (!isOpen || typeof document === 'undefined') return null;

    const modalContent = (
        <div
            className={styles.overlay}
            onClick={() => {
                if (!isExporting) {
                    onClose();
                }
            }}
        >
            <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                <div className={styles.header}>
                    <h3>{title}</h3>
                    <button type="button" className={styles.closeBtn} onClick={onClose} disabled={isExporting}>
                        <IoClose size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.cropContainer}>
                        <ReactCrop
                            key={imageSrc}
                            crop={crop}
                            onChange={(nextCrop) => {
                                setCrop(nextCrop);
                                setExportError('');
                            }}
                            onComplete={(nextCrop) => setCompletedCrop(nextCrop)}
                            aspect={aspectRatio}
                            className={styles.reactCrop}
                        >
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt={title}
                                onLoad={onImageLoad}
                                className={styles.cropImage}
                            />
                        </ReactCrop>
                    </div>

                    <div className={styles.hints}>
                        <p>{description}</p>
                        <p>Aspect ratio: {aspectLabel}</p>
                        {exportError ? <p className={styles.errorText}>{exportError}</p> : null}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isExporting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={styles.confirmBtn}
                        onClick={handleConfirm}
                        disabled={isExporting || !completedCrop?.width || !completedCrop?.height}
                    >
                        {isExporting ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default ImageCropModal;
