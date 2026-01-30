import { useState, useCallback } from 'react';
import { limitByWords, countWords } from '../utils/wordLimit';

/**
 * 字数限制 Hook
 * 自动处理中文输入法（IME）组合状态
 */
export const useWordLimit = (maxWords: number, onChange: (value: string) => void) => {
    const [isComposing, setIsComposing] = useState(false);

    const handleCompositionStart = useCallback(() => {
        setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback(
        (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setIsComposing(false);
            const limited = limitByWords(e.currentTarget.value, maxWords);
            if (limited !== e.currentTarget.value) {
                onChange(limited);
            }
        },
        [maxWords, onChange]
    );

    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = e.target.value;
            if (isComposing) {
                // 组合状态中，直接更新值，不限制
                onChange(value);
            } else {
                // 组合结束后，应用字数限制
                const limited = limitByWords(value, maxWords);
                onChange(limited);
            }
        },
        [isComposing, maxWords, onChange]
    );

    return {
        onCompositionStart: handleCompositionStart,
        onCompositionEnd: handleCompositionEnd,
        onChange: handleChange,
    };
};

/**
 * 计算字数（用于显示）
 */
export const useWordCount = (value: string): number => {
    return Math.floor(countWords(value));
};

