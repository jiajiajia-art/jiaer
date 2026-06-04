import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadCropPreset, UploadCropPresetKey } from '../utils/uploadImageCrop';
import {
    fileToDataUrl,
    getMimeTypeExtension,
    getSafeCropMimeType,
    uploadCropPresets,
} from '../utils/uploadImageCrop';

type PendingCropFile = {
    file: File;
    imageSrc: string;
    mimeType: string;
};

type UseImageCropperOptions = {
    preset: UploadCropPresetKey;
    onCropped: (file: File, blob: Blob) => void | Promise<void>;
};

export function useImageCropper({ preset, onCropped }: UseImageCropperOptions) {
    const { t } = useTranslation();
    const [pendingCropFile, setPendingCropFile] = useState<PendingCropFile | null>(null);
    const rawPreset = useMemo(() => uploadCropPresets[preset], [preset]);
    const cropPreset: UploadCropPreset = useMemo(() => ({
        title: t(rawPreset.titleKey),
        aspectRatio: rawPreset.aspectRatio,
        aspectLabel: rawPreset.aspectLabel,
        description: t(rawPreset.descriptionKey),
        defaultCropScale: rawPreset.defaultCropScale,
    }), [rawPreset, t]);

    const openCropper = useCallback(async (file: File) => {
        const imageSrc = await fileToDataUrl(file);
        setPendingCropFile({
            file,
            imageSrc,
            mimeType: getSafeCropMimeType(file),
        });
    }, []);

    const closeCropper = useCallback(() => {
        setPendingCropFile(null);
    }, []);

    const handleCropComplete = useCallback(async (blob: Blob) => {
        if (!pendingCropFile) return;

        const extension = getMimeTypeExtension(blob.type || pendingCropFile.mimeType);
        const baseName = pendingCropFile.file.name.replace(/\.[^.]+$/, '') || 'cropped-image';
        const croppedFile = new File([blob], `${baseName}.${extension}`, {
            type: blob.type || pendingCropFile.mimeType,
        });

        await onCropped(croppedFile, blob);
        setPendingCropFile(null);
    }, [onCropped, pendingCropFile]);

    return {
        cropPreset,
        pendingCropFile,
        openCropper,
        closeCropper,
        handleCropComplete,
    };
}
