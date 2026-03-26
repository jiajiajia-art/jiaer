/**
 * 工具函数
 */
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPC } from '../../../api/galgame/EditorData.type';
import type { NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { Character, Variation } from './types';
import { DEFAULT_NPC_PORTRAIT } from './types';
import { getPlayerImageUrl } from '../../../utils/constants';

// 辅助函数：获取 npcs（兼容两种模式）
export function getNpcs(data: AllGameData | WorldInteractionGameData) {
    if (!data.npcSetting) return [];
    return data.npcSetting.npcs || [];
}

// 重新导出图片缓存管理函数
export { withCacheBust, bumpCacheBust, extractImageExtension } from '../../../utils/imageCache';

// 拆分 variant 键名（格式：type_value）为 type 和 value
export const parseVariantKey = (key: string): { type: string; value: string } | null => {
    if (!key || typeof key !== 'string') return null;
    const parts = key.split('_');
    if (parts.length < 2) return null;
    const type = parts[0];
    const value = parts.slice(1).join('_');
    return { type, value };
};

// 从 images 对象中查找匹配的 variant 键（根据 type 和 value）
export const findVariantKey = (images: Record<string, string> | undefined, type: string, value: string): string | null => {
    if (!images) return null;
    const exactKey = `${type}_${value}`;
    if (images[exactKey]) return exactKey;
    const matchingKey = Object.keys(images).find(key => {
        const parsed = parseVariantKey(key);
        return parsed && parsed.type === type && parsed.value === value;
    });
    return matchingKey || null;
};

const PERSONALITY_SPLIT_REGEX = /[，,、/／；;\n\r]+/g;
const PERSONALITY_TRAILING_PUNCTUATION_REGEX = /[。.!?！？]+$/g;

/**
 * 统一性格标签解析：兼容 string / string[]，输出标准化 string[]
 */
export const normalizePersonalityTags = (input: unknown): string[] => {
    const rawValues = Array.isArray(input)
        ? input.filter((item): item is string => typeof item === 'string')
        : (typeof input === 'string' ? [input] : []);

    const tags = rawValues
        .flatMap(value => value.split(PERSONALITY_SPLIT_REGEX))
        .map(tag => tag.trim().replace(PERSONALITY_TRAILING_PUNCTUATION_REGEX, '').trim())
        .filter(Boolean);

    return Array.from(new Set(tags));
};

/**
 * 统一性格标签序列化：用于保存到后端字符串字段
 */
export const stringifyPersonalityTags = (tags: unknown): string => {
    return normalizePersonalityTags(tags).join(', ');
};

// 基础角色数据模板
export const baseCharacter = (): Omit<Character, 'id' | 'name' | 'callName' | 'gender' | 'role' | 'identity' | 'personality' | 'speech' | 'appearance' | 'portrait' | 'background' | 'relationships' | 'variations'> => {
    return {
        growth: '',
        goalShort: '',
        goalLong: '',
        secret: '',
    };
};

// 将images对象转换为variations数组（过滤掉base，因为base已经存储在portrait中）
export const imagesToVariations = (images?: Record<string, string>): Variation[] => {
    if (!images) return [];
    return Object.entries(images)
        .filter(([key]) => key !== 'base') // 过滤掉 base，base 图片已存储在 portrait 中
        .map(([key, img], idx) => {
            // 尝试解析 type_value 格式
            const parsed = parseVariantKey(key);
            if (parsed) {
                return {
                    id: `v${idx}`,
                    label: parsed.value, // value 作为 label
                    img,                 // 保持原始路径，展示时再处理
                    type: parsed.type,   // type 作为 type
                };
            }
            // 如果不是 type_value 格式，使用 key 作为 label 和 type
            return {
                id: `v${idx}`,
                label: key,
                img, // 保持原始路径，展示时再处理
                type: key,
            };
        });
};

// 从images对象中选取base图片
export const pickBaseImage = (images?: Record<string, string>, fallback?: string) => {
    const isValidUrl = (url?: string | null): url is string => {
        return !!url && url !== 'null' && url !== 'undefined' && url.trim() !== '';
    };

    if (isValidUrl(images?.base)) return images!.base;
    const first = images ? Object.values(images).find(v => isValidUrl(v)) : undefined;
    return first || (isValidUrl(fallback) ? fallback : undefined);
};

// 统一处理 player 的图片字段（支持多种格式）
const extractPlayerImages = (player: any): {
    imagesObject?: Record<string, string>;
    baseImage?: string;
} => {
    const isValidUrl = (url?: string | null): url is string => {
        return !!url && 
               url !== 'null' && 
               url !== 'undefined' && 
               typeof url === 'string' && 
               url.trim() !== '';
    };

    // 情况1: images 是对象格式 { base: string, ... }
    if (player?.images && typeof player.images === 'object' && !Array.isArray(player.images)) {
        const imagesObj = player.images as Record<string, any>;
        // 检查是否是有效的对象（不是 null）
        if (imagesObj !== null) {
            // 转换为 Record<string, string>，过滤无效值
            const validImages: Record<string, string> = {};
            for (const [key, value] of Object.entries(imagesObj)) {
                if (isValidUrl(value)) {
                    validImages[key] = value as string;
                }
            }
            if (Object.keys(validImages).length > 0) {
                return { imagesObject: validImages };
            }
        }
    }

    // 情况2-4: 使用统一的 getPlayerImageUrl 函数处理 imagePath、image、images 字段
    const playerImageUrl = getPlayerImageUrl(player);
    if (isValidUrl(playerImageUrl)) {
        return {
            baseImage: playerImageUrl,
        };
    }
    return {};
};

// NPC转换为Character
export const npcToCharacter = (npc: NPC | WorldNPC, indexFallback: number): Character => {
    const npcJob = 'job' in npc ? npc.job : undefined;
    const npcRace = 'race' in npc ? npc.race : undefined;
    const npcRelationship = 'relationship' in npc ? npc.relationship : undefined;

    const images = (npc.images || undefined) as Record<string, string> | undefined;
    const portrait = pickBaseImage(images, DEFAULT_NPC_PORTRAIT);

    const mergedNpcBackground = mergeLegacyFieldsIntoBackground(npc, npc.description || '');

    return {
        ...baseCharacter(),
        id: npc.id || `npc-${indexFallback}`,
        name: npc.name || '',
        callName: extractCallName(npc, npc.name || ''),
        gender: npc.gender || '',
        role: npcJob || 'NPC',
        identity: npcRace ? `${npcRace} · ${npcJob || ''}` : (npcJob || ''),
        personality: normalizePersonalityTags(npc.personality),
        speech: npc.tone || '',
        appearance: npc.appearance || '',
        portrait: portrait || '',
        background: mergedNpcBackground,
        relationships: npcRelationship ? [{
            id: 'r1',
            name: '玩家',
            description: npcRelationship,
        }] : [],
        variations: imagesToVariations(images),
    };
};

// Player转换为Character
const extractPlayerIdentity = (player: any): string => {
    // 统一读取主角“身份/当前身份”，优先标准 race，兼容历史字段
    const candidates = [
        player?.race,
        player?.job,
        player?.identity,
        player?.currentIdentity,
        player?.current_identity,
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
};

const extractPlayerBackground = (player: any): string => {
    // 统一读取主角背景字段，兼容历史数据别名
    const candidates = [
        player?.background,
        player?.description,
        player?.backstory,
        player?.story,
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
};

const trimText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const extractCallName = (source: any, fallback = ''): string => {
    const candidates = [
        source?.callName,
        source?.callname,
        source?.nickname,
        source?.alias,
        source?.appellation,
    ];

    for (const value of candidates) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }

    return fallback;
};

const hasSectionLabel = (text: string, label: string): boolean => {
    if (!text) return false;
    return text.includes(`${label}：`) || text.includes(`${label}:`);
};

const extractRelationshipSummary = (source: any): string => {
    const result: string[] = [];
    const seen = new Set<string>();
    const pushUnique = (item: string) => {
        const normalized = item.trim();
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(normalized);
    };

    const singleRelationship = trimText(source?.relationship);
    if (singleRelationship) {
        pushUnique(`玩家（${singleRelationship}）`);
    }

    const relArray = Array.isArray(source?.relationships) ? source.relationships : [];
    relArray.forEach((rel: any) => {
        if (typeof rel === 'string') {
            pushUnique(rel);
            return;
        }
        if (!rel || typeof rel !== 'object') return;
        const name = trimText(rel?.name || rel?.target || rel?.callName || rel?.title);
        const description = trimText(rel?.description || rel?.content || rel?.relationship);
        if (name && description) {
            pushUnique(`${name}（${description}）`);
            return;
        }
        pushUnique(name || description);
    });

    const relObject = source?.relationships;
    if (relObject && typeof relObject === 'object' && !Array.isArray(relObject)) {
        Object.entries(relObject).forEach(([name, description]) => {
            const relationName = trimText(name);
            const relationDesc = trimText(description);
            if (relationName && relationDesc) {
                pushUnique(`${relationName}（${relationDesc}）`);
                return;
            }
            pushUnique(relationName || relationDesc);
        });
    }

    return result.join('；');
};

const mergeLegacyFieldsIntoBackground = (source: any, rawBackground: string): string => {
    // 把历史可选字段合并到“人物背景故事”，保证旧数据只用一个入口展示与保存
    const baseBackground = trimText(rawBackground);
    const sections: string[] = [];
    const appendSection = (label: string, value: string) => {
        const content = trimText(value);
        if (!content) return;
        if (hasSectionLabel(baseBackground, label)) return;
        sections.push(`${label}：${content}`);
    };

    appendSection('成长经历 / 转折', source?.growth);
    appendSection('短期目标', source?.goalShort);
    appendSection('长期愿景', source?.goalLong);
    appendSection('隐藏秘密 / 禁忌', source?.secret);
    appendSection('人物关系', extractRelationshipSummary(source));

    if (sections.length === 0) return baseBackground;
    return baseBackground ? `${baseBackground}\n\n${sections.join('\n')}` : sections.join('\n');
};

export const playerToCharacter = (player: any): Character => {
    const { imagesObject, baseImage } = extractPlayerImages(player);
    const portrait = pickBaseImage(imagesObject, baseImage) || DEFAULT_NPC_PORTRAIT;
    const playerIdentity = extractPlayerIdentity(player);
    const playerBackground = mergeLegacyFieldsIntoBackground(player, extractPlayerBackground(player));

    return {
        ...baseCharacter(),
        id: 'player',
        name: player?.name || '玩家',
        callName: extractCallName(player, player?.name || '玩家'),
        gender: player?.gender || '',
        role: '主角',
        identity: playerIdentity,
        personality: normalizePersonalityTags(player?.personality),
        speech: player?.tone || '',
        appearance: player?.appearance || '',
        portrait: portrait || '',
        background: playerBackground,
        relationships: [],
        variations: imagesToVariations(imagesObject),
    };
};

