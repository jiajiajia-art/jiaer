import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactCrop, { centerCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { IoClose } from 'react-icons/io5';
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
    quality?: number;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void | Promise<void>;
}

const DEFAULT_QUALITY = 0.92;

const ImageCropModal: React.FC<ImageCropModalProps> = ({
    isOpen,
    imageSrc,
    title,
    description,
    aspectRatio,
    aspectLabel,
    defaultCropScale,
    mimeType = 'image/jpeg',
    quality = DEFAULT_QUALITY,
    onClose,
    onCropComplete,
}) => {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [isExporting, setIsExporting] = useState(false);
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
    }, [createDefaultCrop]);

    const getCroppedImage = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const image = imgRef.current;
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!image || !context || !completedCrop?.width || !completedCrop?.height) {
                resolve(null);
                return;
            }

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            const sourceWidth = Math.max(Math.round(completedCrop.width * scaleX), 1);
            const sourceHeight = Math.max(Math.round(completedCrop.height * scaleY), 1);

            canvas.width = sourceWidth;
            canvas.height = sourceHeight;
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';

            context.drawImage(
                image,
                Math.round(completedCrop.x * scaleX),
                Math.round(completedCrop.y * scaleY),
                sourceWidth,
                sourceHeight,
                0,
                0,
                sourceWidth,
                sourceHeight,
            );

            canvas.toBlob(
                (blob) => resolve(blob),
                mimeType,
                quality,
            );
        });
    }, [completedCrop, mimeType, quality]);

    const handleConfirm = useCallback(async () => {
        setIsExporting(true);
        try {
            const blob = await getCroppedImage();
            if (blob) {
                await onCropComplete(blob);
            }
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
                            onChange={(nextCrop) => setCrop(nextCrop)}
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
                        <p>宽高比: {aspectLabel}</p>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isExporting}>
                        取消
                    </button>
                    <button
                        type="button"
                        className={styles.confirmBtn}
                        onClick={handleConfirm}
                        disabled={isExporting || !completedCrop?.width || !completedCrop?.height}
                    >
                        {isExporting ? '裁剪中...' : '确认'}
                    </button>
                </div>
            </div>
        </div>
    );

    // Render above page shells to avoid clipping and stacking issues in nested layouts.
    return createPortal(modalContent, document.body);
};

export default ImageCropModal;
