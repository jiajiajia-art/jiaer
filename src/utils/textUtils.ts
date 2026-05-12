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
    
    let result = stripNonStoryControlMarkup(text);
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
interface ParsedGameTag {
    name: string;
    payload: string;
    start: number;
    end: number;
    raw: string;
    hasPayload: boolean;
}

const GAME_TAG_NAME_REGEX = /^[A-Z_]+$/;
const VISUAL_STEP_MARKER_REGEX = /\[(?:NARRATION|DIALOGUE|SCENE_CHANGE|CHARACTER_IMAGE|TRANSITION|CHOICE|MAIN_OPTION|OPTION|END_CHOICE)(?::|\])/i;
const VISUAL_STEP_MARKER_PREFIX_REGEX = /\[\s*(?:NARRATION|SCENE_CHANGE|CHARACTER_IMAGE|TRANSITION|CHOICE|MAIN_OPTION|OPTION|END_CHOICE)\s*:?\s*/gi;
const ALLOWED_INLINE_TAG_REGEX = /<\/?(?:red|yellow|green|blue|purple|jump|vibration|injury)\b[^>]*>/gi;
const CHINESE_DISPLAY_TEXT_REGEX = /[\u3400-\u9fff]/;
const ORPHAN_LOWERCASE_ENGLISH_TOKEN_REGEX = /(^|[^A-Za-z0-9_])([a-z]{3,})(?=$|[^A-Za-z0-9_])/g;
const FRONTEND_ALLOWED_LOWERCASE_ENGLISH_TOKENS = new Set(['http', 'https', 'www']);

const protectAllowedInlineTags = (text: string, transform: (value: string) => string): string => {
    const placeholders: string[] = [];
    const protectedText = String(text || '').replace(ALLOWED_INLINE_TAG_REGEX, (match) => {
        const token = `\u0000${placeholders.length}\u0000`;
        placeholders.push(match);
        return token;
    });
    return transform(protectedText).replace(/\u0000(\d+)\u0000/g, (_match, index) => placeholders[Number(index)] || '');
};

const stripOrphanLowercaseEnglishNoise = (text: string): string => {
    if (!CHINESE_DISPLAY_TEXT_REGEX.test(text)) return text;
    let changed = false;
    const cleaned = protectAllowedInlineTags(text, (protectedText) => protectedText.replace(ORPHAN_LOWERCASE_ENGLISH_TOKEN_REGEX, (match, prefix, token) => {
        if (FRONTEND_ALLOWED_LOWERCASE_ENGLISH_TOKENS.has(String(token).toLowerCase())) return match;
        changed = true;
        return prefix;
    }));
    return changed
        ? cleaned.replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, '$1$2')
        : text;
};

export const stripNonStoryControlMarkup = (text: string): string => {
    let result = String(text || '');
    let previous = '';

    while (result !== previous) {
        previous = result;
        result = result.replace(/<(think(?:[_-][a-z0-9]+)*|thinking(?:[_-][a-z0-9]+)*)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    }

    return result
        .replace(/<\/?(?:think|thinking)(?:[_-][a-z0-9]+)*\b[^>]*>/gi, '')
        .replace(/<point\b[^>]*>[\s\S]*?<\/point>/gi, '')
        .replace(/<\/?point\b[^>]*>/gi, '')
        .replace(/<\s*\/?\s*>/g, '')
        .replace(/\[METRICS_JSON:\s*\{[^\]]*\}\s*\]/gi, '')
        .replace(/\[(?:SILENT|HIDDEN|DEBUG|ANALYSIS|INTERNAL)[^\]\n>]*(?:\]|\>)/gi, '');
};

const stripInvalidAngleBrackets = (text: string): string => {
    const placeholders: string[] = [];
    const protectedText = String(text || '').replace(ALLOWED_INLINE_TAG_REGEX, (match) => {
        const token = `\u0000${placeholders.length}\u0000`;
        placeholders.push(match);
        return token;
    });
    return protectedText
        .replace(/[<>]/g, '')
        .replace(/\u0000(\d+)\u0000/g, (_match, index) => placeholders[Number(index)] || '');
};

const removeUnbalancedQuoteResidue = (text: string): string => {
    let value = String(text || '');
    if ((value.match(/"/g) || []).length % 2 === 1) {
        value = value.replace(/"/g, '');
    }
    const pairs: Array<[string, string]> = [['\u201c', '\u201d'], ['\u300c', '\u300d'], ['\u300e', '\u300f']];
    pairs.forEach(([open, close]) => {
        const openCount = (value.match(new RegExp(open, 'g')) || []).length;
        const closeCount = (value.match(new RegExp(close, 'g')) || []).length;
        if (openCount !== closeCount) {
            value = value.split(open).join('').split(close).join('');
        }
    });
    return value;
};

export const sanitizeVisualDisplayText = (text: string): string => {
    let value = stripNonStoryControlMarkup(text).trim();
    if (!value) return '';
    value = stripInvalidAngleBrackets(value);
    value = removeUnbalancedQuoteResidue(value);
    value = stripOrphanLowercaseEnglishNoise(value);
    return value
        .replace(/^[\]\u3011]+/g, '')
        .replace(/[\]\u3011]+$/g, '')
        .replace(/\s+([,，。！？!?;；:：])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
};

export const sanitizeVisualOptionText = (text: string): string => {
    let value = sanitizeVisualDisplayText(text);
    if (!value) return '';
    value = value
        .replace(/^["']+|["']+$/g, '')
        .replace(/[\]\u3011\u300d\u300f]+$/g, '')
        .trim();
    if (/[\u3400-\u9fff]/.test(value)) {
        value = value.replace(/\s+(?:revive|undefined|null|none)$/i, '').trim();
    }
    return value;
};

const findGameTagCloseIndex = (text: string, payloadStart: number): number => {
    let nestedDepth = 0;
    let inQuote = false;

    for (let i = payloadStart; i < text.length; i++) {
        const char = text[i];
        const previousChar = i > 0 ? text[i - 1] : '';

        if (char === '"' && previousChar !== '\\') {
            inQuote = !inQuote;
            continue;
        }

        if (inQuote) continue;

        if (char === '[') {
            nestedDepth++;
            continue;
        }

        if (char === ']') {
            if (nestedDepth === 0) {
                return i;
            }
            nestedDepth--;
        }
    }

    return -1;
};

const parseGameTagAt = (text: string, start: number): ParsedGameTag | null => {
    if (text[start] !== '[') return null;

    let cursor = start + 1;
    while (cursor < text.length && text[cursor] !== ':' && text[cursor] !== ']') {
        cursor++;
    }
    if (cursor >= text.length) return null;

    const rawName = text.slice(start + 1, cursor).trim();
    if (!rawName) return null;

    const name = rawName.toUpperCase();
    if (!GAME_TAG_NAME_REGEX.test(name)) return null;

    if (text[cursor] === ']') {
        return {
            name,
            payload: '',
            start,
            end: cursor,
            raw: text.slice(start, cursor + 1),
            hasPayload: false,
        };
    }

    const payloadStart = cursor + 1;
    const closeIndex = findGameTagCloseIndex(text, payloadStart);
    if (closeIndex < 0) return null;

    return {
        name,
        payload: text.slice(payloadStart, closeIndex),
        start,
        end: closeIndex,
        raw: text.slice(start, closeIndex + 1),
        hasPayload: true,
    };
};

const formatDialoguePayload = (payload: string): string => {
    payload = stripNonStoryControlMarkup(payload);
    const firstComma = payload.indexOf(',');
    if (firstComma < 0) {
        return payload.trim();
    }

    const speaker = payload.slice(0, firstComma).trim();
    const remainder = payload.slice(firstComma + 1).trim();
    if (!remainder) return speaker;

    const quoteStart = remainder.indexOf('"');
    const quoteEnd = quoteStart >= 0 ? remainder.lastIndexOf('"') : -1;

    let meta = '';
    let dialogueText = '';

    if (quoteStart >= 0 && quoteEnd > quoteStart) {
        meta = remainder.slice(0, quoteStart).trim().replace(/,?\s*$/, '');
        dialogueText = remainder.slice(quoteStart + 1, quoteEnd).trim();
    } else {
        dialogueText = remainder.replace(/^["']|["']$/g, '').trim();
    }

    const displayName = meta || speaker;
    if (displayName && dialogueText) {
        return `${displayName}：“${dialogueText}”`;
    }

    return dialogueText || displayName;
};

const normalizeOptionPayload = (payload: string): string => {
    let value = sanitizeVisualOptionText(payload);
    if (!value) return '';

    const quoted = value.match(/"([\s\S]*?)"/);
    if (quoted && quoted[1]?.trim()) {
        return quoted[1].trim();
    }

    return sanitizeVisualOptionText(value.replace(/^["']|["']$/g, '').trim());
};

const findEndChoiceStartIndex = (text: string, from: number): number => {
    let cursor = from;
    while (cursor < text.length) {
        const openIndex = text.indexOf('[', cursor);
        if (openIndex < 0) return -1;

        const tag = parseGameTagAt(text, openIndex);
        if (!tag) {
            cursor = openIndex + 1;
            continue;
        }

        if (tag.name === 'END_CHOICE' && !tag.hasPayload) {
            return openIndex;
        }

        cursor = tag.end + 1;
    }

    return -1;
};

interface ProcessTagContext {
    collectOptions: boolean;
}

interface OptionStore {
    mainOptions: string[];
    options: string[];
}

const processGameTagText = (content: string, context: ProcessTagContext, optionStore: OptionStore): string => {
    let result = '';
    let cursor = 0;
    content = stripNonStoryControlMarkup(content);

    while (cursor < content.length) {
        const openIndex = content.indexOf('[', cursor);
        if (openIndex < 0) {
            result += content.slice(cursor);
            break;
        }

        result += content.slice(cursor, openIndex);
        const tag = parseGameTagAt(content, openIndex);

        if (!tag) {
            result += content[openIndex];
            cursor = openIndex + 1;
            continue;
        }

        switch (tag.name) {
            case 'NARRATION':
            case 'TRANSITION':
                result += tag.payload.trim();
                cursor = tag.end + 1;
                break;

            case 'DIALOGUE':
                result += formatDialoguePayload(tag.payload);
                cursor = tag.end + 1;
                break;

            case 'CHARACTER_IMAGE':
                cursor = tag.end + 1;
                break;

            case 'SCENE_CHANGE':
                result += tag.payload.trim() ? `场景切换：${tag.payload.trim()}` : '';
                cursor = tag.end + 1;
                break;

            case 'MAIN_OPTION': {
                if (context.collectOptions) {
                    const optionText = normalizeOptionPayload(tag.payload);
                    if (optionText) {
                        optionStore.mainOptions.push(optionText);
                    }
                }
                cursor = tag.end + 1;
                break;
            }

            case 'OPTION': {
                if (context.collectOptions) {
                    const optionText = normalizeOptionPayload(tag.payload);
                    if (optionText) {
                        optionStore.options.push(optionText);
                    }
                }
                cursor = tag.end + 1;
                break;
            }

            case 'CHOICE': {
                const title = tag.payload.trim();
                const endChoiceStart = findEndChoiceStartIndex(content, tag.end + 1);

                if (endChoiceStart >= 0) {
                    const innerContent = content.slice(tag.end + 1, endChoiceStart);
                    const cleanedInner = processGameTagText(innerContent, { collectOptions: false }, optionStore).trim();
                    if (title) {
                        result += `【${title}】\n`;
                    }
                    if (cleanedInner) {
                        result += cleanedInner;
                    }
                    cursor = endChoiceStart + '[END_CHOICE]'.length;
                } else {
                    if (title) {
                        result += `【${title}】\n`;
                    }
                    cursor = tag.end + 1;
                }
                break;
            }

            case 'END_CHOICE':
                cursor = tag.end + 1;
                break;

            default:
                result += tag.raw;
                cursor = tag.end + 1;
                break;
        }
    }

    return result;
};

export const processGameTags = (content: string): string => {
    if (!content) return '';
    content = stripNonStoryControlMarkup(content);

    const optionStore: OptionStore = {
        mainOptions: [],
        options: [],
    };

    let result = processGameTagText(content, { collectOptions: true }, optionStore);
    result = result.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

    if (optionStore.mainOptions.length > 0 || optionStore.options.length > 0) {
        result += '\n\n选项：\n';
        let optionIndex = 1;

        optionStore.mainOptions.forEach((option) => {
            result += `${optionIndex}. 【推荐】${option}\n`;
            optionIndex++;
        });

        optionStore.options.forEach((option) => {
            result += `${optionIndex}. ${option}\n`;
            optionIndex++;
        });
    }

    return result;
};

// ============================================================
// 【核心函数4】提取纯文本（去掉所有颜色标签和动画标签）
// 用于：计算打字机进度、选项文本显示等
// ============================================================
export const sanitizeVisualStepText = (text: string): string => {
    if (!text) return '';
    text = sanitizeVisualDisplayText(text);
    if (!VISUAL_STEP_MARKER_REGEX.test(text)) return text;

    let cleaned = processGameTags(text);
    if (VISUAL_STEP_MARKER_REGEX.test(cleaned) || cleaned.includes(']')) {
        cleaned = cleaned
            .replace(/\[DIALOGUE:\s*([^,\]]+),\s*([^,\]]+),\s*["']([^"'\]]*)["']?/gi, (_match, _speaker, speakerName, content) => {
                const name = speakerName ? String(speakerName).trim() : '';
                const value = content ? String(content).trim() : '';
                return name && value ? `${name}: "${value}"` : value || name;
            })
            .replace(/\[DIALOGUE:\s*([^,\]]+),\s*["']([^"'\]]*)["']?/gi, (_match, speaker, content) => {
                const name = speaker ? String(speaker).trim() : '';
                const value = content ? String(content).trim() : '';
                return name && value ? `${name}: "${value}"` : value || name;
            })
            .replace(VISUAL_STEP_MARKER_PREFIX_REGEX, '')
            .replace(/\]/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/[ \t]+/g, ' ')
            .trim();
    }

    return cleaned;
};

export const extractPlainText = (text: string): string => {
    if (!text) return '';
    text = stripNonStoryControlMarkup(text);
    
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
    
    text = stripNonStoryControlMarkup(text);
    let cleaned = text;
    const options: string[] = [];
    
    // 提取 OPTION 信息
    const optionRegex = /\[OPTION:\s*([^\]]*(?:\[[^\]]*\][^\]]*)*)\]/gi;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(text)) !== null) {
        const optionText = sanitizeVisualOptionText(optionMatch[1] || '');
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
    cleaned = sanitizeVisualDisplayText(cleaned);
    
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
    text = stripNonStoryControlMarkup(text);
    
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
        let optionText = sanitizeVisualOptionText(raw || '');
        if (!optionText) return;

        // 如果包含引号，提取引号内的内容
        const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
        if (quotedMatch && quotedMatch[1]) {
            optionText = quotedMatch[1];
        } else {
            // 如果没有引号格式，移除可能的引号
            optionText = sanitizeVisualOptionText(optionText.replace(/^["']|["']$/g, ''));
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
    content = stripNonStoryControlMarkup(content);
    
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
        let optionText = sanitizeVisualOptionText(raw || '');
        if (!optionText) return;

        const quotedMatch = optionText.match(/^[^"]*:\s*"([^"]+)"$/);
        if (quotedMatch && quotedMatch[1]) {
            optionText = quotedMatch[1];
        } else {
            optionText = sanitizeVisualOptionText(optionText.replace(/^["']|["']$/g, ''));
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
