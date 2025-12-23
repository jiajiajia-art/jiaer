import type { GameEvent, NPCInfo, SubsceneInfo } from '../api/worldInteraction/interactionApi.type';
import type { AllGameData } from '../api/worldInteraction/mapWorldData.type';
import type { EventData } from '../page/GalgameMap';

/**
 * 从事件数据构建完整的 EventData
 * 如果事件已经包含 npc 和 subscene，直接使用；否则从 gameData 中查找并构建
 */
export const buildEventDataFromEvent = (
    event: any,
    gameData: AllGameData | null
): EventData | null => {
    if (!gameData || !event) return null;

    if (event.npc && event.subscene) {
        return {
            event: event as GameEvent,
            npc: event.npc,
            subscene: event.subscene,
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
        image: npcImage,
    };

    const subsceneInfo: SubsceneInfo = {
        id: foundSubscene.id,
        name: foundSubscene.name,
        parentSceneName: foundSubscene.parentSceneName || '',
    };

    return {
        event: { ...event, npc: npcInfo, subscene: subsceneInfo } as GameEvent,
        npc: npcInfo,
        subscene: subsceneInfo,
    };
};

