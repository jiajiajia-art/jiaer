import React, { useMemo } from 'react';
import { Converter } from 'showdown';
import { removeAnimationTags, parseColorMarkup } from '../../utils/textUtils';
import styles from './ColoredMarkdownText.module.css';

// ============================================================
// ColoredMarkdownText 组件
// ============================================================
// 
// 统一处理文本渲染：
// 1. 移除动画标签（保留内容）
// 2. 解析颜色标签并渲染
// 3. Markdown 转换
// 4. 可选的打字光标
//
// 使用场景：
// - NormalModeDisplay (正常模式展示)
// - TextModeDisplay (文本模式展示)
// - GalgameHistoryModal (历史记录展示)
//
// ============================================================

interface ColoredMarkdownTextProps {
    /** 要渲染的文本（可能包含动画/颜色标签） */
    text: string;
    /** 是否显示打字光标 */
    showCursor?: boolean;
    /** 自定义类名 */
    className?: string;
}

// 颜色 class 映射
const colorClassMap: Record<string, string> = {
    red: styles.colorRed,
    yellow: styles.colorYellow,
    green: styles.colorGreen,
    blue: styles.colorBlue,
    purple: styles.colorPurple,
};

// showdown 转换器（单例，避免重复创建）
const createConverter = (): Converter => {
    const converter = new Converter();
    converter.setOption('simpleLineBreaks', true);
    converter.setOption('strikethrough', true);
    converter.setOption('tables', true);
    converter.setOption('tasklists', true);
    return converter;
};

const converter = createConverter();

/**
 * 将带颜色标签的文本转换为 HTML
 * @param text 原始文本
 * @returns HTML 字符串
 */
export const convertToColoredHtml = (text: string): string => {
    if (!text) return '';
    
    // 1. 移除动画标签，保留颜色标签
    const cleanedText = removeAnimationTags(text);
    
    // 2. 解析颜色标签
    const parts = parseColorMarkup(cleanedText);
    
    // 3. 构建带颜色 class 的 HTML
    const htmlParts = parts.map(part => {
        if (part.type === 'color' && part.color) {
            const colorClass = colorClassMap[part.color];
            return `<span class="${colorClass}">${part.content}</span>`;
        }
        return part.content;
    }).join('');
    
    // 4. Markdown 转换
    return converter.makeHtml(htmlParts);
};

/**
 * ColoredMarkdownText 组件
 * 统一渲染带颜色和 Markdown 的文本
 */
const ColoredMarkdownText: React.FC<ColoredMarkdownTextProps> = ({
    text,
    showCursor = false,
    className,
}) => {
    const html = useMemo(() => {
        if (!text) return '';
        
        let result = convertToColoredHtml(text);
        
        // 如果显示光标，插入到末尾
        if (showCursor) {
            const cursorHtml = `<span class="${styles.cursor}"></span>`;
            if (result.endsWith('</p>')) {
                result = result.slice(0, -4) + cursorHtml + '</p>';
            } else if (result.endsWith('</div>')) {
                result = result.slice(0, -6) + cursorHtml + '</div>';
            } else {
                result += cursorHtml;
            }
        }
        
        return result;
    }, [text, showCursor]);
    
    if (!text) return null;
    
    return (
        <div
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
};

export default ColoredMarkdownText;

