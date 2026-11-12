export type UploadCropPresetKey =
    | 'gameCover'
    | 'gamePortraitCover'
    | 'homeBanner'
    | 'accountBanner'
    | 'avatar'
    | 'promotionCover'
    | 'objectIcon';

export type UploadCropPreset = {
    title: string;
    aspectRatio: number;
    aspectLabel: string;
    description: string;
    defaultCropScale: number;
};

export type CropExportAttempt = {
    mimeType: string;
    quality?: number;
    scale: number;
};

export const uploadCropPresets: Record<UploadCropPresetKey, Omit<UploadCropPreset, 'title' | 'description'> & { titleKey: string; descriptionKey: string }> = {
    gameCover: {
        titleKey: 'common.imageCrop.gameCover.title',
        aspectRatio: 16 / 9,
        aspectLabel: '16:9',
        descriptionKey: 'common.imageCrop.gameCover.description',
        defaultCropScale: 0.94,
    },
    gamePortraitCover: {
        titleKey: 'common.imageCrop.gamePortraitCover.title',
        aspectRatio: 3 / 4,
        aspectLabel: '3:4',
        descriptionKey: 'common.imageCrop.gamePortraitCover.description',
        defaultCropScale: 0.94,
    },
    homeBanner: {
        titleKey: 'common.imageCrop.homeBanner.title',
        aspectRatio: 16 / 9,
        aspectLabel: '16:9',
        descriptionKey: 'common.imageCrop.homeBanner.description',
        defaultCropScale: 0.94,
    },
    accountBanner: {
        titleKey: 'common.imageCrop.accountBanner.title',
        aspectRatio: 16 / 9,
        aspectLabel: '16:9',
        descriptionKey: 'common.imageCrop.accountBanner.description',
        defaultCropScale: 0.94,
    },
    avatar: {
        titleKey: 'common.imageCrop.avatar.title',
        aspectRatio: 1,
        aspectLabel: '1:1',
        descriptionKey: 'common.imageCrop.avatar.description',
        // 功能注释：头像默认铺满最大 1:1 选区；原图已是方图时不再缩成中间小框
        defaultCropScale: 1,
    },
    promotionCover: {
        titleKey: 'common.imageCrop.promotionCover.title',
        aspectRatio: 4 / 3,
        aspectLabel: '4:3',
        descriptionKey: 'common.imageCrop.promotionCover.description',
        defaultCropScale: 0.90,
    },
    objectIcon: {
        titleKey: 'common.imageCrop.objectIcon.title',
        aspectRatio: 1,
        aspectLabel: '1:1',
        descriptionKey: 'common.imageCrop.objectIcon.description',
        defaultCropScale: 1,
    },
};

export const MAX_UPLOAD_IMAGE_SIZE = 5 * 1024 * 1024;
export const UPLOAD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const UPLOAD_IMAGE_ACCEPT = UPLOAD_IMAGE_MIME_TYPES.join(',');
export const CROP_EXPORT_SCALES = [1, 0.9, 0.8, 0.7, 0.6];
export const CROP_EXPORT_QUALITIES = [0.92, 0.85, 0.78, 0.7];

export function getMimeTypeExtension(mimeType: string): string {
    switch (mimeType) {
        case 'image/png':
            return 'png';
        case 'image/webp':
            return 'webp';
        default:
            return 'jpg';
    }
}

export function getSafeCropMimeType(file?: File | null): string {
    if (!file) return 'image/jpeg';
    if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg') {
        return file.type;
    }
    return 'image/jpeg';
}

export function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
    });
}

function buildExportMimeOrder(sourceMimeType: string): string[] {
    if (sourceMimeType === 'image/png') {
        return ['image/png', 'image/webp'];
    }
    if (sourceMimeType === 'image/webp') {
        return ['image/webp'];
    }
    return ['image/jpeg', 'image/webp'];
}

export function buildCropExportAttempts(sourceMimeType: string): CropExportAttempt[] {
    const mimeOrder = buildExportMimeOrder(sourceMimeType);
    const attempts: CropExportAttempt[] = [];

    for (const scale of CROP_EXPORT_SCALES) {
        for (const mimeType of mimeOrder) {
            if (mimeType === 'image/png') {
                attempts.push({ mimeType, scale });
                continue;
            }

            for (const quality of CROP_EXPORT_QUALITIES) {
                attempts.push({ mimeType, quality, scale });
            }
        }
    }

    return attempts;
}
