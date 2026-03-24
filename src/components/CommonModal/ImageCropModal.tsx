import React, { useState, useRef, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { IoClose } from 'react-icons/io5';
import styles from './ImageCropModal.module.css';

interface ImageCropModalProps {
    isOpen: boolean;
    imageSrc: string;
    onClose: () => void;
    onCropComplete: (croppedBlob: Blob) => void;
    aspectRatio?: number; // 默认 16/9
    outputWidth?: number; // 输出宽度，默认 800
    outputHeight?: number; // 输出高度，默认 450 (16:9)
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
    aspectRatio = 16 / 9,
    outputWidth = 800,
    outputHeight = 450,
}) => {
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);

    // 居中裁剪框
    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const crop = centerCrop(
            makeAspectCrop(
                {
                    unit: '%',
                    width: 90,
                },
                aspectRatio,
                width,
                height,
            ),
            width,
            height,
        );
        setCrop(crop);
    }, [aspectRatio]);

    // 获取裁剪区域的 canvas
    const getCroppedImage = useCallback((): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const image = imgRef.current;
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!image || !ctx || !completedCrop) {
                resolve(null);
                return;
            }

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;

            canvas.width = outputWidth;
            canvas.height = outputHeight;

            ctx.drawImage(
                image,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0,
                0,
                outputWidth,
                outputHeight,
            );

            canvas.toBlob(
                (blob) => {
                    resolve(blob);
                },
                'image/jpeg',
                0.9,
            );
        });
    }, [completedCrop, outputWidth, outputHeight]);

    const handleConfirm = async () => {
        const blob = await getCroppedImage();
        if (blob) {
            onCropComplete(blob);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3>调整封面</h3>
                    <button className={styles.closeBtn} onClick={onClose}>
                        <IoClose size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.cropContainer}>
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspectRatio}
                            className={styles.reactCrop}
                        >
                            <img
                                ref={imgRef}
                                src={imageSrc}
                                alt="待裁剪封面"
                                onLoad={onImageLoad}
                                className={styles.cropImage}
                            />
                        </ReactCrop>
                    </div>

                    <div className={styles.hints}>
                        <p>拖动裁剪框调整封面展示区域</p>
                        <p>输出尺寸: 16:9</p>
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.cancelBtn} onClick={onClose}>
                        取消
                    </button>
                    <button
                        className={styles.confirmBtn}
                        onClick={handleConfirm}
                        disabled={!completedCrop?.width || !completedCrop?.height}
                    >
                        确认裁剪
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageCropModal;
