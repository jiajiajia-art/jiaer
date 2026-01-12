import type { AttributeSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { AttributeConfig, AttributeTarget } from './types';

/**
 * 将 AttributeSetting 转换为 AttributeConfig[] 格式
 * 用于在 UI 中显示属性列表（只显示属性定义，不区分具体 NPC 实体）
 */
export function convertAttributeSettingToConfigs(
    attributeSetting: AttributeSetting,
): AttributeConfig[] {
    const configs: AttributeConfig[] = [];

    // 转换玩家属性定义
    Object.entries(attributeSetting.attributeDefinitions.player).forEach(([key, meta]) => {
        configs.push({
            id: `player-${key}`,
            target: 'player' as AttributeTarget,
            key,
            name: meta.displayName,
            displayName: meta.displayName,
            description: meta.description,
            defaultValue: meta.defaultValue,
            maxValue: meta.maxValue,
            unit: meta.unit,
            required: false, // 可以根据需要调整
            visible: meta.visible,
            formula: meta.formula || undefined,
        });
    });

    // 转换 NPC 属性定义（所有 NPC 共享相同的属性定义）
    Object.entries(attributeSetting.attributeDefinitions.npc).forEach(([key, meta]) => {
        configs.push({
            id: `npc-${key}`,
            target: 'npc' as AttributeTarget,
            key,
            name: meta.displayName,
            displayName: meta.displayName,
            description: meta.description,
            defaultValue: meta.defaultValue,
            maxValue: meta.maxValue,
            unit: meta.unit,
            required: false, // 可以根据需要调整
            visible: meta.visible,
            formula: meta.formula || undefined,
        });
    });

    return configs;
}

