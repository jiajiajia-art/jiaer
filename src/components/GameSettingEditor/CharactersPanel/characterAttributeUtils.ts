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

type NpcAttributeState = {
    displayName: string;
    value: number;
    formula: string;
};

/**
 * 获取角色的属性列表（player 或 NPC）
 * NPC 优先使用 npcSetting 中的 attributes，兼容旧的 attributeStates.npc 结构
 */
export function getCharacterAttributes(
    attributeSetting: AttributeSetting | undefined,
    characterId: string,
    isPlayer: boolean,
    npcAttributes?: Record<string, NpcAttributeState>,
): CharacterAttributeItem[] {
    if (!attributeSetting) return [];

    const attributes: CharacterAttributeItem[] = [];

    if (isPlayer) {
        // 玩家属性
        // 兼容两种后端数据结构：
        // 1) 标准：attributeStates.player = { player: { health: {...}, ... } }
        // 2) 扁平：attributeStates.player = { health: {...}, ... }
        const playerStatesContainer: any = attributeSetting.attributeStates.player;
        const playerStates = (playerStatesContainer?.player || playerStatesContainer) as Record<
            string,
            { value: number; formula?: string }
        > | undefined;
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
        const npcDefinitions = attributeSetting.attributeDefinitions.npc;
        // 优先使用 npcSetting 中的 attributes，其次兼容旧的 attributeStates.npc 结构
        const npcStatesSource =
            (npcAttributes as Record<string, { value: number; formula?: string }> | undefined) ||
            attributeSetting.attributeStates.npc?.[characterId];

        if (npcStatesSource && npcDefinitions) {
            Object.entries(npcStatesSource).forEach(([key, state]) => {
                const definition = npcDefinitions[key];
                if (definition && typeof state.value === 'number') {
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
 * NPC 同样优先使用 npcSetting 中的 attributes 作为“已拥有”的集合
 */
export function getAvailableAttributes(
    attributeSetting: AttributeSetting | undefined,
    characterId: string,
    isPlayer: boolean,
    npcAttributes?: Record<string, NpcAttributeState>,
): Array<{ key: string; displayName: string }> {
    if (!attributeSetting) return [];

    const available: Array<{ key: string; displayName: string }> = [];

    if (isPlayer) {
        // 同样兼容两种后端结构
        const playerStatesContainer: any = attributeSetting.attributeStates.player;
        const playerStates = (playerStatesContainer?.player || playerStatesContainer || {}) as Record<string, unknown>;
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
        const npcDefinitions = attributeSetting.attributeDefinitions.npc;
        // 已拥有的属性：优先使用 npcSetting.attributes，其次使用 attributeStates.npc
        const npcStatesSource =
            (npcAttributes as Record<string, unknown> | undefined) ||
            attributeSetting.attributeStates.npc?.[characterId] ||
            {};

        if (npcDefinitions) {
            Object.entries(npcDefinitions).forEach(([key, definition]) => {
                if (!Object.prototype.hasOwnProperty.call(npcStatesSource, key)) {
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


