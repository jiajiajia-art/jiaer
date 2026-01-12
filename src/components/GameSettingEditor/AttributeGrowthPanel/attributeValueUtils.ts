import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';

/**
 * 获取玩家属性的当前值
 */
export function getPlayerAttributeValue(
    attributeSetting: AttributeSetting | undefined,
    attributeKey: string,
): number | undefined {
    if (!attributeSetting) return undefined;
    const playerState = attributeSetting.attributeStates.player?.player;
    if (!playerState || !playerState[attributeKey]) return undefined;
    return playerState[attributeKey].value;
}

/**
 * 获取所有 NPC 的属性值列表
 */
export interface NPCAttributeValue {
    npcId: string;
    npcName: string;
    value: number;
}

export function getNPCAttributeValues(
    attributeSetting: AttributeSetting | undefined,
    gameData: WorldInteractionGameData | null,
    attributeKey: string,
): NPCAttributeValue[] {
    if (!attributeSetting || !gameData) return [];

    const npcAttributeStates = attributeSetting.attributeStates.npc;
    if (!npcAttributeStates) return [];

    const npcs = gameData.npcSetting?.npcs || [];
    const npcMap = new Map(npcs.map(npc => [npc.id, npc.name]));

    const values: NPCAttributeValue[] = [];

    Object.entries(npcAttributeStates).forEach(([npcId, attributes]) => {
        const attributeState = attributes[attributeKey];
        if (attributeState) {
            values.push({
                npcId,
                npcName: npcMap.get(npcId) || npcId,
                value: attributeState.value,
            });
        }
    });

    return values;
}


