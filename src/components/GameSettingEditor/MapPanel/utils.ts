// MapPanel 共享工具函数

import type { ImageDisplayBounds } from './types';

/**
 * 计算图片在 object-fit: cover 模式下的实际显示尺寸和偏移
 * 图片会填满容器，但拖拽区域限制在图片的固定尺寸内
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
    
    // 获取图片的实际渲染尺寸（CSS 设置的固定尺寸）
    const imageRect = image.getBoundingClientRect();
    const imageDisplayWidth = imageRect.width;
    const imageDisplayHeight = imageRect.height;
    
    // 计算图片在容器中的居中偏移
    const offsetX = (containerWidth - imageDisplayWidth) / 2;
    const offsetY = (containerHeight - imageDisplayHeight) / 2;
    
    return { 
        displayWidth: imageDisplayWidth, 
        displayHeight: imageDisplayHeight, 
        offsetX: Math.max(0, offsetX), 
        offsetY: Math.max(0, offsetY) 
    };
};

