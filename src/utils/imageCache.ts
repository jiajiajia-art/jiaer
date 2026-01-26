import { getImageUrl } from './constants';

const imageCacheBustMap = new Map<string, string>();

export const withCacheBust = (url?: string | null): string => {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
    
    const processedUrl = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : getImageUrl(url);
    
    if (!processedUrl) return '';
    
    if (processedUrl.includes('?t=') || processedUrl.includes('&t=') || 
        processedUrl.includes('?cb=') || processedUrl.includes('&cb=')) {
        return processedUrl;
    }
    
    const cached = imageCacheBustMap.get(processedUrl);
    if (cached) return cached;
    
    const separator = processedUrl.includes('?') ? '&' : '?';
    const timestamp = Date.now();
    const busted = `${processedUrl}${separator}t=${timestamp}`;
    imageCacheBustMap.set(processedUrl, busted);
    return busted;
};

export const bumpCacheBust = (url?: string | null): void => {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return;
    
    const processedUrl = url.startsWith('http://') || url.startsWith('https://')
        ? url
        : getImageUrl(url);
    
    if (!processedUrl) return;
    
    const cleanUrl = processedUrl.split('?')[0].split('&')[0];
    
    imageCacheBustMap.delete(cleanUrl);
};

export const clearImageCache = (): void => {
    imageCacheBustMap.clear();
};

export const addImageTimestamp = (url: string | undefined): string => {
    return withCacheBust(url);
};

/**
 * 从图片路径中提取文件扩展名
 * @param imagePath 图片路径
 * @returns 文件扩展名（包含点号），如 '.png', '.jpg'，如果无法提取则返回 '.png'
 */
export const extractImageExtension = (imagePath?: string | null): string => {
    if (!imagePath) return '.png';
    
    const match = imagePath.match(/\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|$)/i);
    if (match) {
        let extension = match[1].toLowerCase();
        if (extension === 'jpeg') extension = 'jpg';
        return `.${extension}`;
    }
    
    return '.png';
};

