/**
 * 字数限制工具函数
 * 支持中文输入法（IME）组合状态
 */

// 计算字符权重：中文=1字，其他=0.5字
export const getCharWeight = (ch: string): number => {
    return /[\u4e00-\u9fa5]/.test(ch) ? 1 : 0.5;
};

// 计算字数
export const countWords = (value: string): number => {
    if (!value) return 0;
    let count = 0;
    for (const ch of value) {
        count += getCharWeight(ch);
    }
    return count;
};

// 按字数限制文本
export const limitByWords = (value: string, maxWords: number): string => {
    if (!value) return '';
    let count = 0;
    let result = '';
    for (const ch of value) {
        const inc = getCharWeight(ch);
        if (count + inc > maxWords) break;
        count += inc;
        result += ch;
    }
    return result;
};

