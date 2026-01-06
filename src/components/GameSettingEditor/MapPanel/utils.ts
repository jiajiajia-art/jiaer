// MapPanel 共享工具函数

import type { ImageDisplayBounds } from './types';

/**
 * 计算图片在 object-fit: contain 模式下的实际显示尺寸和偏移
 */
export const getImageDisplayBounds = (
    image: HTMLImageElement,
    container: HTMLDivElement
): ImageDisplayBounds => {
    // 必须确保图片完全加载
    if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
        return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0 };
    }

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // 如果容器尺寸无效，返回0
    if (containerWidth <= 0 || containerHeight <= 0) {
        return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0 };
    }
    
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    
    // 计算 object-fit: contain 的实际显示尺寸
    const containerAspect = containerWidth / containerHeight;
    const imageAspect = naturalWidth / naturalHeight;
    
    let displayWidth: number;
    let displayHeight: number;
    let offsetX = 0;
    let offsetY = 0;
    
    if (imageAspect > containerAspect) {
        // 图片更宽，宽度填满容器，高度按比例缩放
        displayWidth = containerWidth;
        displayHeight = containerWidth / imageAspect;
        offsetY = (containerHeight - displayHeight) / 2;
    } else {
        // 图片更高，高度填满容器，宽度按比例缩放
        displayHeight = containerHeight;
        displayWidth = containerHeight * imageAspect;
        offsetX = (containerWidth - displayWidth) / 2;
    }
    
    return { displayWidth, displayHeight, offsetX, offsetY };
};

