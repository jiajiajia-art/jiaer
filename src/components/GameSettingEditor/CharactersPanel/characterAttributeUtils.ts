import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';

/**
 * 角色属性项
 */
export interface CharacterAttributeItem {
    key: string;
    displayName: string;
    value: number;
    defaultValue: number;
    maxValue: number;
    unit: string;
    formula?: string;
}

/**
 * 获取角色的属性列表（player 或 NPC）
 */
export function getCharacterAttributes(
    attributeSetting: AttributeSetting | undefined,
    characterId: string,
    isPlayer: boolean,
): CharacterAttributeItem[] {
    if (!attributeSetting) return [];

    const attributes: CharacterAttributeItem[] = [];

    if (isPlayer) {
        // 玩家属性
        const playerStates = attributeSetting.attributeStates.player?.player;
        const playerDefinitions = attributeSetting.attributeDefinitions.player;

        if (playerStates && playerDefinitions) {
            Object.entries(playerStates).forEach(([key, state]) => {
                const definition = playerDefinitions[key];
                if (definition) {
                    attributes.push({
                        key,
                        displayName: definition.displayName,
                        value: state.value,
                        defaultValue: definition.defaultValue,
                        maxValue: definition.maxValue,
                        unit: definition.unit,
                        formula: state.formula || definition.formula || undefined,
                    });
                }
            });
        }
    } else {
        // NPC 属性
        const npcStates = attributeSetting.attributeStates.npc?.[characterId];
        const npcDefinitions = attributeSetting.attributeDefinitions.npc;

        if (npcStates && npcDefinitions) {
            Object.entries(npcStates).forEach(([key, state]) => {
                const definition = npcDefinitions[key];
                if (definition) {
                    attributes.push({
                        key,
                        displayName: definition.displayName,
                        value: state.value,
                        defaultValue: definition.defaultValue,
                        maxValue: definition.maxValue,
                        unit: definition.unit,
                        formula: state.formula || definition.formula || undefined,
                    });
                }
            });
        }
    }

    return attributes;
}

/**
 * 获取可添加的属性列表（角色尚未拥有的属性）
 */
export function getAvailableAttributes(
    attributeSetting: AttributeSetting | undefined,
    characterId: string,
    isPlayer: boolean,
): Array<{ key: string; displayName: string }> {
    if (!attributeSetting) return [];

    const available: Array<{ key: string; displayName: string }> = [];

    if (isPlayer) {
        const playerStates = attributeSetting.attributeStates.player?.player || {};
        const playerDefinitions = attributeSetting.attributeDefinitions.player;

        if (playerDefinitions) {
            Object.entries(playerDefinitions).forEach(([key, definition]) => {
                if (!playerStates[key]) {
                    available.push({
                        key,
                        displayName: definition.displayName,
                    });
                }
            });
        }
    } else {
        const npcStates = attributeSetting.attributeStates.npc?.[characterId] || {};
        const npcDefinitions = attributeSetting.attributeDefinitions.npc;

        if (npcDefinitions) {
            Object.entries(npcDefinitions).forEach(([key, definition]) => {
                if (!npcStates[key]) {
                    available.push({
                        key,
                        displayName: definition.displayName,
                    });
                }
            });
        }
    }

    return available;
}


