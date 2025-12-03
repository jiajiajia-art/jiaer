// 颜色标记解析结果类型
export interface ColorMarkupPart {
    type: 'text' | 'color';
    content: string;
    color?: string;
    nested?: ColorMarkupPart[];
}

// 解析颜色标记，将 <red>文本</red> 等标签转换为包含颜色信息的数组
export const parseColorMarkup = (text: string): ColorMarkupPart[] => {
    if (!text) return [];
    
    const colorTags = ['red', 'yellow', 'green', 'blue', 'purple'];
    const parts: ColorMarkupPart[] = [];
    let lastIndex = 0;
    
    const regex = /<(red|yellow|green|blue|purple)>(.*?)<\/\1>/gi;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        // 添加普通文本
        if (match.index > lastIndex) {
            const plainText = text.substring(lastIndex, match.index);
            if (plainText) {
                parts.push({ type: 'text', content: plainText });
            }
        }
        
        // 添加带颜色的文本
        const color = match[1].toLowerCase();
        const content = match[2];
        if (colorTags.includes(color)) {
            // 递归处理嵌套的颜色标签
            const nestedParts = parseColorMarkup(content);
            parts.push({ type: 'color', content, color, nested: nestedParts.length > 0 ? nestedParts : undefined });
        } else {
            parts.push({ type: 'text', content });
        }
        
        lastIndex = regex.lastIndex;
    }
    
    // 添加剩余的普通文本
    if (lastIndex < text.length) {
        const remainingText = text.substring(lastIndex);
        if (remainingText) {
            parts.push({ type: 'text', content: remainingText });
        }
    }
    
    return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

// 提取纯文本（去掉所有颜色标签和动画标签）
export const extractPlainText = (text: string): string => {
    if (!text) return '';
    
    let result = text;
    const animationTags = ['jump', 'vibration', 'injury'];
    const colorTags = ['red', 'yellow', 'green', 'blue', 'purple'];
    
    // 递归去除所有标签，直到没有标签为止（处理嵌套标签）
    let previousResult = '';
    while (result !== previousResult) {
        previousResult = result;
        
        // 1. 先去除动画标签（完全移除标签和内容，不保留任何内容）
        for (const tag of animationTags) {
            // 使用非贪婪匹配，但需要处理嵌套标签
            // 递归移除所有嵌套的动画标签
            let tagRemoved = false;
            do {
                tagRemoved = false;
                const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi');
                const beforeReplace = result;
                result = result.replace(regex, '');
                if (result !== beforeReplace) {
                    tagRemoved = true;
                }
            } while (tagRemoved);
        }
        
        // 2. 去除颜色标签（保留内容，只移除标签）
        for (const tag of colorTags) {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            result = result.replace(regex, '$1');
        }
        
        // 3. 去除可能不完整的开始标签（流式输入时可能出现）
        for (const tag of animationTags) {
            const regex = new RegExp(`<${tag}>`, 'gi');
            result = result.replace(regex, '');
        }
        for (const tag of colorTags) {
            const regex = new RegExp(`<${tag}>`, 'gi');
            result = result.replace(regex, '');
        }
        
        // 4. 去除可能不完整的结束标签
        for (const tag of animationTags) {
            const regex = new RegExp(`<\\/${tag}>`, 'gi');
            result = result.replace(regex, '');
        }
        for (const tag of colorTags) {
            const regex = new RegExp(`<\\/${tag}>`, 'gi');
            result = result.replace(regex, '');
        }
    }
    
    return result;
};

// 检测是否包含 jump 标签
export const hasJumpTag = (text: string): boolean => {
    if (!text) return false;
    return /<jump>.*?<\/jump>/gi.test(text);
};

// 检测是否包含 vibration 标签
export const hasVibrationTag = (text: string): boolean => {
    if (!text) return false;
    return /<vibration>.*?<\/vibration>/gi.test(text);
};

// 检测是否包含 injury 标签
export const hasinjuryTag = (text: string): boolean => {
    if (!text) return false;
    return /<injury>.*?<\/injury>/gi.test(text);
};

// 清理历史记录中的标记文字，并提取 OPTION
export const cleanHistoryMessage = (text: string): { cleanedText: string; options: string[] } => {
    if (!text) return { cleanedText: '', options: [] };
    
    let cleaned = text;
    const options: string[] = [];
    
    // 提取 OPTION 信息
    const optionRegex = /\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(text)) !== null) {
        const optionText = optionMatch[1]?.trim();
        if (optionText && !options.includes(optionText)) {
            options.push(optionText);
        }
    }
    
    // 处理 NARRATION - 保留内容
    cleaned = cleaned.replace(/\[NARRATION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
        return content ? content.trim() : '';
    });
    
    // 处理 DIALOGUE - 保留说话人和对话内容
    cleaned = cleaned.replace(/\[DIALOGUE:\s*([^,]*),\s*"([^"]*)"\]/gi, (_match, speaker, content) => {
        if (speaker && content) {
            return `${speaker.trim()}：“${content.trim()}”`;
        }
        return content ? content.trim() : '';
    });
    
    // 处理 HINT - 保留内容
    cleaned = cleaned.replace(/\[HINT:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
        return content ? `提示：${content.trim()}` : '';
    });
    
    // 移除 CHOICE 相关的标签（OPTION 已经提取）
    cleaned = cleaned.replace(/\[CHOICE:[\s\S]*?\[END_CHOICE\]/gi, '');
    cleaned = cleaned.replace(/\[CHOICE:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, '');
    cleaned = cleaned.replace(/\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, '');
    
    // 清理多余的符号和空格
    cleaned = cleaned.replace(/\]/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    
    return { cleanedText: cleaned, options };
};

// 仅清理文本，不提取 OPTION（用于 ChatHistory 等不需要选项的场景）
export const cleanTextOnly = (text: string): string => {
    const { cleanedText } = cleanHistoryMessage(text);
    return cleanedText;
};

// 提取 CHOICE 相关的完整信息，用于转换为 step 格式
export const extractChoiceFromHistory = (text: string): {
    title: string;
    text: string;
    options: string[];
} | null => {
    if (!text) return null;
    
    // 匹配完整的 CHOICE 块（从 [CHOICE: 到 [END_CHOICE]）
    const choiceBlockRegex = /\[CHOICE:([^\]]*)\]([\s\S]*?)\[END_CHOICE\]/i;
    const choiceBlockMatch = text.match(choiceBlockRegex);
    
    if (!choiceBlockMatch) {
        // 如果没有完整的 CHOICE 块，尝试匹配简单的 CHOICE 标签和后续的 OPTION
        const simpleChoiceRegex = /\[CHOICE:\s*([^\]]*)\]/i;
        const simpleChoiceMatch = text.match(simpleChoiceRegex);
        
        if (!simpleChoiceMatch) {
            // 检查是否有 OPTION，如果有，说明可能是 choice 但没有 CHOICE 标签
            const hasOptions = /\[OPTION:/i.test(text);
            if (!hasOptions) {
                return null;
            }
        }
    }
    
    // 提取 title（CHOICE 标签中的内容）
    let title = '';
    const choiceTitleRegex = /\[CHOICE:\s*([^\]]*)\]/i;
    const titleMatch = text.match(choiceTitleRegex);
    if (titleMatch && titleMatch[1]) {
        title = titleMatch[1].trim();
    }
    
    // 提取所有 OPTION
    const options: string[] = [];
    const optionRegex = /\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(text)) !== null) {
        const optionText = optionMatch[1]?.trim();
        if (optionText && !options.includes(optionText)) {
            options.push(optionText);
        }
    }
    
    // 如果没有选项，返回 null
    if (options.length === 0) {
        return null;
    }
    
    // 提取 CHOICE 和 OPTION 之间的文本作为描述文本
    let choiceText = '';
    
    if (choiceBlockMatch && choiceBlockMatch[2]) {
        // 如果有完整的 CHOICE 块，提取中间的内容
        let middleText = choiceBlockMatch[2];
        // 移除所有 OPTION 标签
        middleText = middleText.replace(/\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, '');
        // 保留对话中的说话人信息
        middleText = middleText.replace(/\[DIALOGUE:\s*([^,]*),\s*"([^"]*)"\]/gi, (_match, speaker, content) => {
            if (speaker && content) {
                return `${speaker.trim()}：“${content.trim()}”`;
            }
            return content ? content.trim() : '';
        });
        middleText = middleText.replace(/\[NARRATION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
            return content ? content.trim() : '';
        });
        middleText = middleText.replace(/\[HINT:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
            return content ? content.trim() : '';
        });
        middleText = middleText.replace(/\]/g, '\n');
        middleText = middleText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
        choiceText = middleText;
    } else {
        // 如果没有完整的 CHOICE 块，尝试提取 CHOICE 标签后的文本（直到第一个 OPTION）
        const afterChoiceMatch = text.match(/\[CHOICE:[^\]]*\]([\s\S]*?)(?=\[OPTION:|$)/i);
        if (afterChoiceMatch && afterChoiceMatch[1]) {
            let extractedText = afterChoiceMatch[1];
            // 保留对话中的说话人信息
            extractedText = extractedText.replace(/\[DIALOGUE:\s*([^,]*),\s*"([^"]*)"\]/gi, (_match, speaker, content) => {
                if (speaker && content) {
                    return `${speaker.trim()}：“${content.trim()}”`;
                }
                return content ? content.trim() : '';
            });
            extractedText = extractedText.replace(/\[NARRATION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
                return content ? content.trim() : '';
            });
            extractedText = extractedText.replace(/\[HINT:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi, (_match, content) => {
                return content ? content.trim() : '';
            });
            extractedText = extractedText.replace(/\]/g, '\n');
            extractedText = extractedText.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
            choiceText = extractedText;
        }
    }
    
    return {
        title: title || '',
        text: choiceText,
        options
    };
};