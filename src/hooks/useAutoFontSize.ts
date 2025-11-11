import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * 自动调整字体大小的 Hook
 * 根据容器宽度和文字内容自动计算合适的字体大小，确保文字完整显示
 * 
 * @param text - 要显示的文本内容
 * @param options - 配置选项
 * @returns [ref, fontSize] - 容器 ref 和计算出的字体大小
 * 
 * @example
 * const [textRef, fontSize] = useAutoFontSize(gameTimeText, {
 *   minFontSize: 8,
 *   maxFontSize: 13,
 *   padding: 28 // 左右内边距总和
 * });
 * 
 * <div ref={textRef} style={{ fontSize: `${fontSize}px` }}>
 *   {gameTimeText}
 * </div>
 */
export const useAutoFontSize = <T extends HTMLElement>(
    text: string,
    options?: {
        minFontSize?: number;
        maxFontSize?: number;
        padding?: number; // 容器内边距（左右总和）
        lineHeight?: number; // 行高倍数
        maxLines?: number; // 最大行数（用于多行文本）
    }
): [RefObject<T>, number] => {
    const containerRef = useRef<T>(null);
    const [fontSize, setFontSize] = useState(options?.maxFontSize || 16);

    const calculateFontSize = () => {
        const container = containerRef.current;
        if (!container || !text) return;

        const {
            minFontSize = 8,
            maxFontSize = 16,
            padding = 0,
            lineHeight = 1.2,
            maxLines = 1
        } = options || {};

        // 创建一个临时元素来测量文字宽度
        const measureElement = document.createElement('span');
        measureElement.style.visibility = 'hidden';
        measureElement.style.position = 'absolute';
        measureElement.style.whiteSpace = 'nowrap';
        measureElement.style.fontSize = `${maxFontSize}px`;
        measureElement.style.fontFamily = getComputedStyle(container).fontFamily;
        measureElement.style.fontWeight = getComputedStyle(container).fontWeight;
        measureElement.style.letterSpacing = getComputedStyle(container).letterSpacing;
        measureElement.textContent = text;
        document.body.appendChild(measureElement);

        const containerWidth = container.clientWidth - padding;
        const textWidth = measureElement.offsetWidth;
        
        document.body.removeChild(measureElement);

        // 如果文字宽度小于容器宽度，使用最大字体
        if (textWidth <= containerWidth) {
            setFontSize(maxFontSize);
            return;
        }

        // 计算合适的字体大小
        const availableWidth = containerWidth;
        const availableHeight = container.clientHeight;
        const maxHeight = maxFontSize * lineHeight * maxLines;
        
        // 如果高度受限，需要同时考虑宽度和高度
        if (availableHeight < maxHeight && maxLines > 1) {
            const heightBasedSize = (availableHeight / (lineHeight * maxLines));
            const widthBasedSize = (availableWidth / textWidth) * maxFontSize;
            setFontSize(Math.max(minFontSize, Math.min(heightBasedSize, widthBasedSize, maxFontSize)));
        } else {
            // 只考虑宽度（单行文本）
            const calculatedSize = (availableWidth / textWidth) * maxFontSize;
            setFontSize(Math.max(minFontSize, Math.min(calculatedSize, maxFontSize)));
        }
    };

    useEffect(() => {
        calculateFontSize();
    }, [text, options]);

    // 监听窗口大小变化和容器大小变化
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            calculateFontSize();
        });

        resizeObserver.observe(container);

        window.addEventListener('resize', calculateFontSize);
        
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', calculateFontSize);
        };
    }, [text, options]);

    return [containerRef as RefObject<T>, fontSize];
};

