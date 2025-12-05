import { useState, useEffect, useRef } from 'react';

interface UseStoryTypingOptions {
    text: string;
    enabled: boolean;
    speed?: number;
}

// 解析文本，将文本分成多个部分，完全跳过动画标签
interface TextPart {
    type: 'text' | 'color';
    content: string;
    color?: string;
}

const parseTextParts = (text: string): TextPart[] => {
    if (!text) return [{ type: 'text', content: '' }];
    
    const parts: TextPart[] = [];
    const animationTags = ['jump', 'vibration', 'injury'];
    const colorTags = ['red', 'yellow', 'green', 'blue', 'purple'];
    
    // 移除所有动画标签，但保留内容（包括嵌套的情况）
    let processedText = text;
    for (const tag of animationTags) {
        // 使用非贪婪匹配，但需要处理嵌套标签
        // 递归移除所有嵌套的动画标签，但保留内容
        let previousText = '';
        while (processedText !== previousText) {
            previousText = processedText;
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            processedText = processedText.replace(regex, '$1');
        }
    }
    // 移除不完整的动画标签
    for (const tag of animationTags) {
        processedText = processedText.replace(new RegExp(`<${tag}>`, 'gi'), '');
        processedText = processedText.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
    }
    
    // 现在处理颜色标签
    let lastIndex = 0;
    const regex = /<(red|yellow|green|blue|purple)>(.*?)<\/\1>/gi;
    let match;
    
    while ((match = regex.exec(processedText)) !== null) {
        // 添加标签前的普通文本
        if (match.index > lastIndex) {
            const plainText = processedText.substring(lastIndex, match.index);
            if (plainText) {
                parts.push({ type: 'text', content: plainText });
            }
        }
        
        const tagName = match[1].toLowerCase();
        const content = match[2];
        
        // 颜色标签，保留内容（但需要递归处理内容中可能残留的标签）
        if (colorTags.includes(tagName)) {
            // 递归处理内容，确保去除其中的动画标签，但保留内容
            const cleanedContent = content.replace(/<(jump|vibration|injury)>([\s\S]*?)<\/\1>/gi, '$1');
            parts.push({ type: 'color', content: cleanedContent, color: tagName });
        }
        
        lastIndex = regex.lastIndex;
    }
    
    // 添加剩余的普通文本
    if (lastIndex < processedText.length) {
        const remainingText = processedText.substring(lastIndex);
        if (remainingText) {
            parts.push({ type: 'text', content: remainingText });
        }
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content: processedText }];
};

export const useStoryTyping = ({ text, enabled, speed = 60 }: UseStoryTypingOptions) => {
    const [displayedText, setDisplayedText] = useState<string>('');
    const [isTyping, setIsTyping] = useState(false);
    const rafRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const currentIndexRef = useRef<number>(0);
    const plainTextRef = useRef<string>('');

    useEffect(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }

        if (!enabled || !text) {
            setDisplayedText('');
            setIsTyping(false);
            return;
        }

        // 解析文本部分，完全跳过动画标签
        const textParts = parseTextParts(text);
        
        // 构建纯文本（只包含普通文本和颜色标签的内容）
        const plainText = textParts
            .filter(part => part.type === 'text' || part.type === 'color')
            .map(part => part.content)
            .join('');
        
        plainTextRef.current = plainText;
        currentIndexRef.current = 0;
        lastTimeRef.current = 0;
        
        setDisplayedText('');
        setIsTyping(true);

        // 使用 requestAnimationFrame 实现更流畅的打字效果
        const typeNextChar = (timestamp: number) => {
            if (!lastTimeRef.current) {
                lastTimeRef.current = timestamp;
            }
            
            const elapsed = timestamp - lastTimeRef.current;
            
            // 根据经过的时间计算应该显示多少字符
            if (elapsed >= speed) {
                const charsToAdd = Math.floor(elapsed / speed);
                currentIndexRef.current = Math.min(
                    currentIndexRef.current + charsToAdd,
                    plainTextRef.current.length
                );
                lastTimeRef.current = timestamp;
                
                const partialText = plainTextRef.current.substring(0, currentIndexRef.current);
                setDisplayedText(partialText);
            }
            
            if (currentIndexRef.current < plainTextRef.current.length) {
                rafRef.current = requestAnimationFrame(typeNextChar);
            } else {
                setIsTyping(false);
                setDisplayedText(plainTextRef.current);
            }
        };

        rafRef.current = requestAnimationFrame(typeNextChar);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [text, enabled, speed]);

    return { displayedText, isTyping };
};

