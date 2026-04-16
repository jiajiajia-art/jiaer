export type UploadCropPresetKey =
    | 'gameCover'
    | 'homeBanner'
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

export const uploadCropPresets: Record<UploadCropPresetKey, UploadCropPreset> = {
    gameCover: {
        title: '调整游戏封面',
        aspectRatio: 16 / 9,
        aspectLabel: '16:9',
        description: '拖动裁剪区域以选择可见封面区域',
        defaultCropScale: 0.94,
    },
    homeBanner: {
        title: '调整banner',
        aspectRatio: 16 / 9,
        aspectLabel: '16:9',
        description: '拖动裁剪区域以选择banner展示区域',
        defaultCropScale: 0.94,
    },
    avatar: {
        title: '调整头像',
        aspectRatio: 1,
        aspectLabel: '1:1',
        description: '拖动裁剪区域以选择可见的头像区域',
        defaultCropScale: 0.82,
    },
    promotionCover: {
        title: '调整封面',
        aspectRatio: 4 / 3,
        aspectLabel: '4:3',
        description: '拖动裁剪区域以选择可见封面区域',
        defaultCropScale: 0.90,
    },
    objectIcon: {
        title: '调整物体',
        aspectRatio: 1,
        aspectLabel: '1:1',
        description: '拖动裁剪区域以选择可见物体图像',
        defaultCropScale: 0.86,
    },
};

export const MAX_UPLOAD_IMAGE_SIZE = 5 * 1024 * 1024;

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
