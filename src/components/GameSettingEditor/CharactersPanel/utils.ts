/**
 * 工具函数
 */
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPC } from '../../../api/galgame/EditorData.type';
import type { NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { Character, Variation } from './types';
import { DEFAULT_NPC_PORTRAIT } from './types';

// 辅助函数：获取 player（兼容两种模式）
export function getPlayer(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.worldSetting) return undefined;
    const ws = data.worldSetting;

    // worldInteraction 模式使用 Player（大写）
    if ('Player' in ws && ws.Player) {
        return ws.Player;
    }

    // visual 模式使用 player（小写）
    if ('player' in ws && ws.player) {
        return ws.player;
    }

    return undefined;
}

// 辅助函数：获取 npcs（兼容两种模式）
export function getNpcs(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.npcSetting) return [];
    return data.npcSetting.npcs || [];
}

// 为图片 URL 添加时间戳，避免缓存导致的旧图显示
export const withCacheBust = (url?: string | null) => {
    if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cb=${Date.now()}`;
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

// 将images对象转换为variations数组
export const imagesToVariations = (images?: Record<string, string>): Variation[] => {
    if (!images) return [];
    return Object.entries(images).map(([label, img], idx) => ({
        id: `v${idx}`,
        label,
        img: withCacheBust(img),
        type: label,
    }));
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
    const playerImages = ('images' in player ? player.images : undefined) as Record<string, string> | undefined;
    const rawImage = ('image' in player ? player.image : ('imagePath' in player ? player.imagePath : undefined)) as string | undefined;
    const playerImage = (rawImage && rawImage !== 'null' && rawImage !== 'undefined') ? rawImage : undefined;
    const portrait = pickBaseImage(playerImages, playerImage) || DEFAULT_NPC_PORTRAIT;
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
        variations: imagesToVariations(playerImages),
    };
};

