// ============================================================
// 文本处理工具函数
// ============================================================
// 
// 【标签类型说明】
// 
// 1. 游戏结构标签（API返回的原始消息，需要解析/转换）
//    - [NARRATION: ...]
//    - [DIALOGUE: npcid,npcName, "..."]
//    - [CHOICE: ...]...[END_CHOICE]
//    - [OPTION: ...]
//    - [SCENE_CHANGE: ...]
//    - [TRANSITION: ...]
//
// 2. 动画标签（需要移除标签，保留内容）
//    - <jump>...</jump>
//    - <vibration>...</vibration>
//    - <injury>...</injury>
//
// 3. 颜色标签（保留用于显示）
//    - <red>...</red>
//    - <yellow>...</yellow>
//    - <green>...</green>
//    - <blue>...</blue>
//    - <purple>...</purple>
//
// 【使用场景】
// 
// 1. 正常模式展示 (NormalModeDisplay) - 使用 removeAnimationTags + parseColorMarkup
// 2. 文本模式展示 (TextModeDisplay) - 使用 removeAnimationTags + parseColorMarkup
// 3. 历史记录展示 (GalgameHistoryModal) - 使用 processGameTags + removeAnimationTags + parseColorMarkup
//
// ============================================================

// 颜色标记解析结果类型
export interface ColorMarkupPart {
    type: 'text' | 'color';
    content: string;
    color?: string;
    nested?: ColorMarkupPart[];
}

// 动画标签列表
const ANIMATION_TAGS = ['jump', 'vibration', 'injury'];

// 颜色标签列表
const COLOR_TAGS = ['red', 'yellow', 'green', 'blue', 'purple'];

// ============================================================
// 【核心函数1】移除动画标签，保留内容
// 用于：正常模式、文本模式、历史记录的渲染前处理
// ============================================================
export const removeAnimationTags = (text: string): string => {
    if (!text) return '';
    
    let result = text;
    let previousResult = '';
    
    // 循环处理嵌套的动画标签
    while (result !== previousResult) {
        previousResult = result;
        for (const tag of ANIMATION_TAGS) {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            result = result.replace(regex, '$1');
        }
    }
    
    // 移除不完整的动画标签（流式输入时可能出现）
    for (const tag of ANIMATION_TAGS) {
        result = result.replace(new RegExp(`<${tag}>`, 'gi'), '');
        result = result.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
    }
    
    return result;
};

// ============================================================
// 【核心函数2】解析颜色标签
// 用于：渲染带颜色的文本
// ============================================================
export const parseColorMarkup = (text: string): ColorMarkupPart[] => {
    if (!text) return [];
    
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
        if (COLOR_TAGS.includes(color)) {
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

// ============================================================
// 【核心函数3】处理游戏结构标签（用于历史记录展示）
// 将 [NARRATION:], [DIALOGUE:] 等转换为可读文本
// ============================================================
export const processGameTags = (content: string): string => {
    if (!content) return '';
    
    let result = content;
    
    // 处理 NARRATION 标签 - 保留内容
    result = result.replace(/\[NARRATION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_match, text) => {
        return text ? text.trim() : '';
    });
    

    result = result.replace(
        /\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([\s\S]*?)"\s*\]/gi,
        (_match, speaker, meta, text) => {
            const speakerId = speaker ? String(speaker).trim() : '';
            const metaText = meta ? String(meta).trim() : '';
            const displayName = metaText
                ? metaText.replace(/,?\s*$/, '')
                : speakerId;
            const finalText = text ? String(text).trim() : '';
            if (displayName && finalText) {
                return `${displayName}："${finalText}"`;
            }
            return finalText;
        }
    );
    // 向后兼容旧格式 [DIALOGUE: speaker, "..."]
    result = result.replace(
        /\[DIALOGUE:\s*([^,\]]+),\s*"([^"]*(?:<[^>]*>[^"]*)*?)"\s*\]/gi,
        (_match, speaker, text) => {
            const displayName = speaker ? String(speaker).trim() : '';
            const finalText = text ? String(text).trim() : '';
            if (displayName && finalText) {
                return `${displayName}："${finalText}"`;
            }
            return finalText;
        }
    );
    
    // 处理 TRANSITION 标签 - 保留内容
    result = result.replace(/\[TRANSITION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_match, text) => {
        return text ? text.trim() : '';
    });
    
    // 处理 CHOICE 块
    result = result.replace(/\[CHOICE:([^\]]*)\]([\s\S]*?)\[END_CHOICE\]/gi, (_match, title, innerContent) => {
        let choiceText = '';
        if (title) {
            choiceText += `【${title.trim()}】\n`;
        }
        let cleanedContent = innerContent.replace(/\[MAIN_OPTION:\s*"?([^"\]]*(?:<[^>]*>[^"\]]*)*?)"?\]/gi, '');
        cleanedContent = cleanedContent.replace(/\[OPTION:\s*"?([^"\]]*(?:<[^>]*>[^"\]]*)*?)"?\]/gi, '');
        // 处理内容中的其他标签
        cleanedContent = cleanedContent.replace(
            /\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([\s\S]*?)"\s*\]/gi,
            (_m: string, speaker: string, meta: string, text: string) => {
                const speakerId = speaker ? String(speaker).trim() : '';
                const metaText = meta ? String(meta).trim() : '';
                const displayName = metaText
                    ? metaText.replace(/,?\s*$/, '')
                    : speakerId;
                const finalText = text ? String(text).trim() : '';
                if (displayName && finalText) {
                    return `${displayName}："${finalText}"`;
                }
                return finalText;
            }
        );
        // 兼容旧格式
        cleanedContent = cleanedContent.replace(
            /\[DIALOGUE:\s*([^,\]]+),\s*"([^"]*(?:<[^>]*>[^"]*)*?)"\s*\]/gi,
            (_m: string, speaker: string, text: string) => {
                const displayName = speaker ? String(speaker).trim() : '';
                const finalText = text ? String(text).trim() : '';
                if (displayName && finalText) {
                    return `${displayName}："${finalText}"`;
                }
                return finalText;
            }
        );
        cleanedContent = cleanedContent.replace(/\[NARRATION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_m: string, text: string) => {
            return text ? text.trim() : '';
        });
        choiceText += cleanedContent.trim();
        return choiceText;
    });
    
    // 处理单独的 CHOICE 标签
    result = result.replace(/\[CHOICE:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_match, title) => {
        return title ? `【${title.trim()}】\n` : '';
    });
    
    // 处理 MAIN_OPTION 和 OPTION 标签（转换为选项列表格式）
    const mainOptions: string[] = [];
    const options: string[] = [];
    
    // 先提取 MAIN_OPTION（主选项，需要优先显示）
    result = result.replace(/\[MAIN_OPTION:\s*"?([^"\]]*(?:<[^>]*>[^"\]]*)*?)"?\]/gi, (_match, text) => {
        if (text) {
            mainOptions.push(text.trim());
        }
        return '';
    });
    
    // 再提取 OPTION（普通选项）
    result = result.replace(/\[OPTION:\s*"?([^"\]]*(?:<[^>]*>[^"\]]*)*?)"?\]/gi, (_match, text) => {
        if (text) {
            options.push(text.trim());
        }
        return '';
    });
    
    // 处理 SCENE_CHANGE 标签
    result = result.replace(/\[SCENE_CHANGE:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_match, text) => {
        return text ? `场景切换：${text.trim()}` : '';
    });
    
    // 清理多余的换行和空格
    result = result.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
    
    // 如果有选项，添加到末尾（主选项优先显示）
    if (mainOptions.length > 0 || options.length > 0) {
        result += '\n\n选项：\n';
        let optionIndex = 1;
        
        // 先显示主选项（标记为推荐）
        mainOptions.forEach((opt) => {
            result += `${optionIndex}. 【推荐】${opt}\n`;
            optionIndex++;
        });
        
        // 再显示普通选项
        options.forEach((opt) => {
            result += `${optionIndex}. ${opt}\n`;
            optionIndex++;
        });
    }
    
    return result;
};

// ============================================================
// 【核心函数4】提取纯文本（去掉所有颜色标签和动画标签）
// 用于：计算打字机进度、选项文本显示等
// ============================================================
export const extractPlainText = (text: string): string => {
    if (!text) return '';
    
    // 先移除动画标签
    let result = removeAnimationTags(text);
    
    // 循环移除颜色标签（处理嵌套）
    let previousResult = '';
    while (result !== previousResult) {
        previousResult = result;
        for (const tag of COLOR_TAGS) {
            const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
            result = result.replace(regex, '$1');
        }
    }
    
    // 移除不完整的颜色标签（流式输入时可能出现）
    for (const tag of COLOR_TAGS) {
        result = result.replace(new RegExp(`<${tag}>`, 'gi'), '');
        result = result.replace(new RegExp(`<\\/${tag}>`, 'gi'), '');
    }
    
    return result;
};

// ============================================================
// 【核心函数5】根据纯文本长度截取带标签的文本（保留颜色标签）
// 用于：打字机效果中保留颜色显示
// ============================================================
export const truncateTextWithTags = (originalText: string, plainTextLength: number): string => {
    if (!originalText || plainTextLength <= 0) return '';
    
    // 先移除动画标签，保留颜色标签
    const cleanedText = removeAnimationTags(originalText);
    
    // 解析颜色标签
    const parts = parseColorMarkup(cleanedText);
    
    // 计算每个部分的纯文本长度，找到截取点
    let currentPlainLength = 0;
    let result = '';
    
    for (const part of parts) {
        // 计算这个部分的纯文本长度（递归处理嵌套的颜色标签）
        let partPlainText = part.content;
        if (part.type === 'color') {
            let previousPartText = '';
            while (partPlainText !== previousPartText) {
                previousPartText = partPlainText;
                partPlainText = partPlainText.replace(/<(red|yellow|green|blue|purple)>([\s\S]*?)<\/\1>/gi, '$2');
            }
        }
        const partLength = partPlainText.length;
        
        if (currentPlainLength + partLength <= plainTextLength) {
            // 整个部分都包含在内
            if (part.type === 'color' && part.color) {
                result += `<${part.color}>${part.content}</${part.color}>`;
            } else {
                result += part.content;
            }
            currentPlainLength += partLength;
        } else {
            // 部分包含，需要截取
            const remainingLength = plainTextLength - currentPlainLength;
            if (remainingLength > 0) {
                const truncatedContent = partPlainText.substring(0, remainingLength);
                if (part.type === 'color' && part.color) {
                    result += `<${part.color}>${truncatedContent}</${part.color}>`;
                } else {
                    result += truncatedContent;
                }
            }
            break;
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
    cleaned = cleaned.replace(/\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([\s\S]*?)"\s*\]/gi, (_match, speaker, meta, content) => {
        const speakerId = speaker ? String(speaker).trim() : '';
        const metaText = meta ? String(meta).trim() : '';
        const displayName = metaText
            ? metaText.replace(/,?\s*$/, '')
            : speakerId;
        const finalContent = content ? String(content).trim() : '';
        if (displayName && finalContent) {
            return `${displayName}：“${finalContent}”`;
        }
        return finalContent;
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
    
    // 无视 title：不再依赖/提取 CHOICE 标签中的标题内容
// 提取所有 MAIN_OPTION / OPTION
    // 支持多种格式：
    // 1. [MAIN_OPTION: "内容"] / [OPTION: "内容"]
    // 2. [MAIN_OPTION: 内容] / [OPTION: 内容]
    // 3. [MAIN_OPTION: 文本："内容"] / [OPTION: 文本："内容"]
    const mainOptions: string[] = [];
    const normalOptions: string[] = [];

    const mainOptionRegex = /\[MAIN_OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;
    const optionRegex = /\[OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;

    const collectOption = (raw: string | undefined | null, target: string[]) => {
        let optionText = raw?.trim() || '';
        if (!optionText) return;

        // 如果包含引号，提取引号内的内容
        const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
        if (quotedMatch && quotedMatch[1]) {
            optionText = quotedMatch[1];
        } else {
            // 如果没有引号格式，移除可能的引号
            optionText = optionText.replace(/^["']|["']$/g, '');
        }

        if (optionText && !target.includes(optionText)) {
        target.push(optionText);
        }
    };

    let mainMatch;
    while ((mainMatch = mainOptionRegex.exec(text)) !== null) {
        collectOption(mainMatch[1], mainOptions);
    }

    let optionMatch;
    while ((optionMatch = optionRegex.exec(text)) !== null) {
        collectOption(optionMatch[1], normalOptions);
    }

    const options: string[] = [...mainOptions, ...normalOptions];
    
    console.log('extractChoiceFromHistory - 提取的 options:', options);
    
    // 如果没有选项，返回 null
    if (options.length === 0 || options.length > 5) {
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
        middleText = middleText.replace(/\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([\s\S]*?)"\s*\]/gi, (_match, speaker, meta, content) => {
            const speakerId = speaker ? String(speaker).trim() : '';
            const metaText = meta ? String(meta).trim() : '';
            const displayName = metaText
                ? metaText.replace(/,?\s*$/, '')
                : speakerId;
            const finalContent = content ? String(content).trim() : '';
            if (displayName && finalContent) {
                return `${displayName}：“${finalContent}”`;
            }
            return finalContent;
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
            extractedText = extractedText.replace(/\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([\s\S]*?)"\s*\]/gi, (_match, speaker, meta, content) => {
                const speakerId = speaker ? String(speaker).trim() : '';
                const metaText = meta ? String(meta).trim() : '';
                const displayName = metaText
                    ? metaText.replace(/,?\s*$/, '')
                    : speakerId;
                const finalContent = content ? String(content).trim() : '';
                if (displayName && finalContent) {
                    return `${displayName}：“${finalContent}”`;
                }
                return finalContent;
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
        // 无视 title，提高兼容性
        title: '',
        text: choiceText,
        options
    };
};

// ============================================================
// 【核心函数6】将历史记录内容解析为文本模式步骤数组
// 用于：文本模式下显示历史记录的最后一条消息
// ============================================================
export interface HistoryStep {
    id: string;
    type: 'narration' | 'dialogue' | 'choice' | 'transition' | 'scene_change';
    content: string;
    speakerName?: string;
    title?: string;
    description?: string;
    options?: Array<{ id: number; text: string }>;
}

export const parseHistoryToSteps = (content: string): HistoryStep[] => {
    if (!content) return [];
    
    const steps: HistoryStep[] = [];
    let stepIndex = 0;
    
    // 先提取 CHOICE 块（包含完整的 CHOICE 内容）
    const choiceBlockRegex = /\[CHOICE:([^\]]*)\]([\s\S]*?)\[END_CHOICE\]/gi;
    const choiceBlocks: Array<{ match: string; title: string; innerContent: string; startIndex: number; endIndex: number }> = [];
    let choiceMatch;
    while ((choiceMatch = choiceBlockRegex.exec(content)) !== null) {
        choiceBlocks.push({
            match: choiceMatch[0],
            title: choiceMatch[1]?.trim() || '',
            innerContent: choiceMatch[2] || '',
            startIndex: choiceMatch.index,
            endIndex: choiceMatch.index + choiceMatch[0].length
        });
    }
    
    // 移除 CHOICE 块，然后解析其他内容
    let contentWithoutChoice = content;
    choiceBlocks.forEach(block => {
        contentWithoutChoice = contentWithoutChoice.replace(block.match, '');
    });
    
    // 提取所有 MAIN_OPTION / OPTION（从整个 content 中提取，因为它们可能在 CHOICE 块内）
    // 支持多种格式：
    // 1. [MAIN_OPTION: "内容"] / [OPTION: "内容"]
    // 2. [MAIN_OPTION: 内容] / [OPTION: 内容]
    // 3. [MAIN_OPTION: 文本："内容"] / [OPTION: 文本："内容"]
    const mainOptions: string[] = [];
    const normalOptions: string[] = [];

    const mainOptionRegex = /\[MAIN_OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;
    const optionRegex = /\[OPTION:\s*([^\]]+?)\](\s*\[END_CHOICE\])?/gi;

    const collectOption = (raw: string | undefined | null, target: string[]) => {
        let optionText = raw?.trim() || '';
        if (!optionText) return;

        const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
        if (quotedMatch && quotedMatch[1]) {
            optionText = quotedMatch[1];
        } else {
            optionText = optionText.replace(/^["']|["']$/g, '');
        }

        if (optionText && !target.includes(optionText)) {
            target.push(optionText);
        }
    };

    let mainMatch;
    mainOptionRegex.lastIndex = 0;
    while ((mainMatch = mainOptionRegex.exec(content)) !== null) {
        collectOption(mainMatch[1], mainOptions);
    }

    let optionMatch;
    optionRegex.lastIndex = 0;
    while ((optionMatch = optionRegex.exec(content)) !== null) {
        collectOption(optionMatch[1], normalOptions);
    }

    const options: string[] = [...mainOptions, ...normalOptions];
    
    console.log('parseHistoryToSteps - 提取的 options:', options);
    
    // 解析 NARRATION
    const narrationRegex = /\[NARRATION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi;
    let narrationMatch;
    while ((narrationMatch = narrationRegex.exec(contentWithoutChoice)) !== null) {
        const text = narrationMatch[1]?.trim();
        if (text) {
            steps.push({
                id: `history-narration-${stepIndex++}`,
                type: 'narration',
                content: text
            });
        }
    }
    
    // 解析 DIALOGUE (支持 [DIALOGUE: npcId,npcName,"..."] 格式)
    const dialogueRegex = /\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([^"]*(?:<[^>]*>[^"]*)*?)"\s*\]/gi;
    let dialogueMatch;
    while ((dialogueMatch = dialogueRegex.exec(contentWithoutChoice)) !== null) {
        const rawSpeaker = dialogueMatch[1];
        const meta = dialogueMatch[2];
        const text = dialogueMatch[3]?.trim();
        const speakerId = rawSpeaker ? String(rawSpeaker).trim() : '';
        const metaText = meta ? String(meta).trim() : '';
        const displayName = metaText
            ? metaText.replace(/,?\s*$/, '')
            : speakerId;
        if (displayName && text) {
            steps.push({
                id: `history-dialogue-${stepIndex++}`,
                type: 'dialogue',
                content: text,
                speakerName: displayName
            });
        }
    }
    
    // 解析 TRANSITION
    const transitionRegex = /\[TRANSITION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi;
    let transitionMatch;
    while ((transitionMatch = transitionRegex.exec(contentWithoutChoice)) !== null) {
        const text = transitionMatch[1]?.trim();
        if (text) {
            steps.push({
                id: `history-transition-${stepIndex++}`,
                type: 'transition',
                content: text
            });
        }
    }
    
    // 解析 SCENE_CHANGE
    const sceneChangeRegex = /\[SCENE_CHANGE:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi;
    let sceneChangeMatch;
    while ((sceneChangeMatch = sceneChangeRegex.exec(contentWithoutChoice)) !== null) {
        const text = sceneChangeMatch[1]?.trim();
        if (text) {
            steps.push({
                id: `history-scene-${stepIndex++}`,
                type: 'scene_change',
                content: text
            });
        }
    }
    
    // 如果提取到了 OPTION，则添加一个 choice 步骤（不再强依赖 CHOICE 块）
    if (options.length > 0 && options.length <= 5) {
        let description = '';
        if (choiceBlocks.length > 0) {
            const lastChoice = choiceBlocks[choiceBlocks.length - 1];
            description = lastChoice.innerContent || '';
        } else {
            // 无 CHOICE 包裹时，直接将正文清理为描述
            const { cleanedText } = cleanHistoryMessage(content);
            description = cleanedText || '';
        }

        // 去掉描述中的 OPTION 标签
        description = description.replace(/\[OPTION:\s*"?([^"\]]*(?:<[^>]*>[^"\]]*)*?)"?\]/gi, '');
        // 处理对话/旁白标签为可读文本 (支持 npcId,npcName)
        description = description.replace(/\[DIALOGUE:\s*([^,\]]+),([\s\S]*?)"([^"]*(?:<[^>]*>[^"]*)*?)"\s*\]/gi, (_m: string, speaker: string, meta: string, text: string) => {
            const speakerId = speaker ? String(speaker).trim() : '';
            const metaText = meta ? String(meta).trim() : '';
            const displayName = metaText
                ? metaText.replace(/,?\s*$/, '')
                : speakerId;
            if (displayName && text) {
                return `${displayName}："${text.trim()}"`;
            }
            return text ? text.trim() : '';
        });
        description = description.replace(/\[NARRATION:\s*((?:[^\[\]]*|\[[^\]]*\])*)\]/gi, (_m: string, text: string) => {
            return text ? text.trim() : '';
        });
        description = description.trim();

        const choiceOptions = options.map((opt, idx) => ({ id: idx + 1, text: opt }));

        steps.push({
            id: `history-choice-${stepIndex++}`,
            type: 'choice',
            content: '',
            title: undefined,
            description,
            options: choiceOptions
        });
    }
    
    return steps;
};// 无视 title：不再依赖/提取 CHOICE 标签中的标题内容
