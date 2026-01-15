/**
 * 工具函数
 */
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPC } from '../../../api/galgame/EditorData.type';
import type { NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { Character, Variation } from './types';
import { DEFAULT_NPC_PORTRAIT } from './types';
import { getImageUrl, getPlayerImageUrl } from '../../../utils/constants';

// 辅助函数：获取 npcs（兼容两种模式）
export function getNpcs(data: AllGameData | WorldInteractionGameData) {
    if (!data.npcSetting) return [];
    return data.npcSetting.npcs || [];
}

// 为图片 URL 添加时间戳，避免缓存导致的旧图显示
export const withCacheBust = (url?: string | null) => {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
        const isDefaultImage = url.includes('defaultNpc.png') || 
                          url.includes('defaultScene.png') || 
                          url.includes('defaultMap.png') ||
                          url.startsWith(import.meta.env.BASE_URL);
    
    const processedUrl = isDefaultImage || url.startsWith('http://') || url.startsWith('https://') 
        ? url 
        : getImageUrl(url);
    
    if (!processedUrl) return '';
    const separator = processedUrl.includes('?') ? '&' : '?';
    return `${processedUrl}${separator}cb=${Date.now()}`;
};

// 清理 URL 中的 cb 参数，用于传递给后端 API
export const removeCacheBust = (url?: string | null): string => {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
    const urlStr = url.toString();
    if (!urlStr.includes('cb=')) {
        return urlStr;
    }
    const [baseUrl, queryString] = urlStr.split('?');
    if (!queryString) {
        return urlStr;
    }
    const params = queryString.split('&').filter(param => !param.startsWith('cb='));
    return params.length > 0 ? `${baseUrl}?${params.join('&')}` : baseUrl;
};

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
                    img: withCacheBust(img),
                    type: parsed.type,   // type 作为 type
                };
            }
            // 如果不是 type_value 格式，使用 key 作为 label 和 type
            return {
                id: `v${idx}`,
                label: key,
                img: withCacheBust(img),
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

    return {
        ...baseCharacter(),
        id: npc.id || `npc-${indexFallback}`,
        name: npc.name || '',
        callName: npc.name || '',
        gender: npc.gender || '',
        role: npcJob || 'NPC',
        identity: npcRace ? `${npcRace} · ${npcJob || ''}` : (npcJob || ''),
        personality: npc.personality ? [npc.personality] : [],
        speech: npc.tone || '',
        appearance: npc.appearance || '',
        portrait: portrait ? withCacheBust(portrait) : '',
        background: npc.description || '',
        relationships: npcRelationship ? [{
            id: 'r1',
            name: '玩家',
            description: npcRelationship,
        }] : [],
        variations: imagesToVariations(images),
    };
};

// Player转换为Character
export const playerToCharacter = (player: any): Character => {
    const { imagesObject, baseImage } = extractPlayerImages(player);
    const portrait = pickBaseImage(imagesObject, baseImage) || DEFAULT_NPC_PORTRAIT;
    const playerRace = ('race' in player ? player.race : undefined) as string | undefined;

    return {
        ...baseCharacter(),
        id: 'player',
        name: player?.name || '玩家',
        callName: player?.name || '玩家',
        gender: player?.gender || '',
        role: '主角',
        identity: playerRace || '',
        personality: player?.personality ? [player.personality] : [],
        speech: player?.tone || '',
        appearance: player?.appearance || '',
        portrait: portrait ? withCacheBust(portrait) : '',
        background: '',
        relationships: [],
        variations: imagesToVariations(imagesObject),
    };
};

