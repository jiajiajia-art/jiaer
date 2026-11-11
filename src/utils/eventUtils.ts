import type { GameEvent, NPCInfo, SubsceneInfo } from '../api/worldInteraction/interactionApi.type';
import type { AllGameData } from '../api/worldInteraction/mapWorldData.type';
import type { EventData } from '../page/GalgameMap';
import { getImageUrl } from '../utils/constants';

export const buildEventDataFromEvent = (
    event: any,
    gameData: AllGameData | null
): EventData | null => {
    if (!gameData || !event) return null;

    const processImagePath = (img: string | null | undefined): string | undefined => {
        if (!img) return undefined;
        if (img.startsWith('http') || img.includes('data/assets') || img.includes('default')) {
            return img;
        }
        return getImageUrl(img) || undefined;
    };

    if (event.npc && event.subscene) {
        const processedNpc: NPCInfo = {
            ...event.npc,
            image: processImagePath(event.npc.image) || event.npc.image || '',
        };
        
        const processedSubscene: SubsceneInfo = {
            ...event.subscene,
            ...(event.subscene.image && { image: processImagePath(event.subscene.image) || event.subscene.image }),
        };

        return {
            event: { ...event, npc: processedNpc, subscene: processedSubscene } as GameEvent,
            npc: processedNpc,
            subscene: processedSubscene,
        };
    }

    // 否则手动查找并构建
    const foundNpc = gameData.npcSetting?.npcs?.find(npc => npc.id === event.targetNpcId);
    if (!foundNpc) return null;

    let foundSubscene: any = null;
    for (const scene of gameData.sceneSetting?.scenes || []) {
        foundSubscene = scene.subscenes?.find((sub: any) => sub.id === event.targetSubsceneId);
        if (foundSubscene) {
            foundSubscene = { ...foundSubscene, parentSceneName: scene.name };
            break;
        }
    }
    if (!foundSubscene) return null;

    const npcImage = typeof foundNpc.images === 'string' 
        ? foundNpc.images 
        : foundNpc.images?.base || '';

    const npcInfo: NPCInfo = {
        id: foundNpc.id,
        name: foundNpc.name,
        image: processImagePath(npcImage) || npcImage,
    };

    const subsceneInfo: SubsceneInfo = {
        id: foundSubscene.id,
        name: foundSubscene.name,
        parentSceneName: foundSubscene.parentSceneName || '',
        ...(foundSubscene.image && { image: processImagePath(foundSubscene.image) || foundSubscene.image }),
    };

    return {
        event: { ...event, npc: npcInfo, subscene: subsceneInfo } as GameEvent,
        npc: npcInfo,
        subscene: subsceneInfo,
    };
};

