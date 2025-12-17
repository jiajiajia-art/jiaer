/**
 * 游戏数据适配器
 * 将不同 API 模式的响应转换为统一的内部格式
 */

import type { UnifiedGameData, Player, NPC, Scene, WorldSetting } from './gameData.type';
import type { AllGameData as VisualGameData } from '../galgame/EditorData.type';
import type { WorldInteractionGameData } from '../worldInteraction/worldInteractionApi.type';

/**
 * 将 visual 模式的 API 响应转换为统一格式
 */
export function adaptVisualGameData(data: VisualGameData): UnifiedGameData {
    return {
        success: data.success,
        fileId: data.fileId,
        worldSetting: adaptVisualWorldSetting(data.worldSetting),
        npcSetting: {
            npcs: data.npcSetting.npcs?.map(adaptVisualNPC) || [], // 添加空值检查
        },
        sceneSetting: {
            scenes: data.sceneSetting.scenes?.map(adaptVisualScene) || [], // 添加空值检查
        },
        metadata: data.metadata || null,
    };
}

/**
 * 将 worldInteraction 模式的 API 响应转换为统一格式
 */
export function adaptWorldGameData(data: WorldInteractionGameData): UnifiedGameData {
    return {
        success: data.success,
        fileId: data.fileId,
        worldSetting: adaptWorldWorldSetting(data.worldSetting),
        npcSetting: {
            npcs: data.npcSetting?.npcs?.map(adaptWorldNPC) || [], // 添加空值检查
        },
        sceneSetting: {
            scenes: data.sceneSetting?.scenes?.map(adaptWorldScene) || [], // 添加空值检查
        },
        metadata: undefined, // worldInteraction 模式没有 metadata
    };
}

// ========== WorldSetting 适配器 ==========

function adaptVisualWorldSetting(ws: VisualGameData['worldSetting']): WorldSetting {
    return {
        title: ws.title,
        summary: ws.summary,
        background: ws.background,
        Theme: ws.Theme,
        preamble: ws.preamble,
        initialPlot: ws.initialPlot,
        literary: ws.literary,
        keyEvents: ws.keyEvents,
        WorldRules: ws.WorldRules,
        player: adaptVisualPlayer(ws.player),
        worldMapImage: undefined, // visual 模式没有 worldMapImage
    };
}

function adaptWorldWorldSetting(ws?: WorldInteractionGameData['worldSetting']): WorldSetting {
    if (!ws) {
        return {
            title: '',
            summary: '',
            background: '',
            Theme: undefined,
            preamble: '',
            initialPlot: '',
            literary: '',
            keyEvents: [],
            WorldRules: undefined,
            player: adaptWorldPlayer(undefined),
            worldMapImage: undefined,
        };
    }
    return {
        title: ws.title,
        summary: ws.summary,
        background: ws.background,
        Theme: ws.Theme,
        preamble: ws.preamble,
        initialPlot: ws.initialPlot,
        literary: ws.literary,
        keyEvents: ws.keyEvents,
        WorldRules: undefined, // worldInteraction 模式没有 WorldRules
        // 后端实际返回的是 player（小写），兼容 Player（大写）
        player: adaptWorldPlayer((ws as any).player || (ws as any).Player),
        worldMapImage: ws.worldMapImage,
    };
}

// ========== Player 适配器 ==========

function adaptVisualPlayer(p: VisualGameData['worldSetting']['player']): Player {
    return {
        name: p.name,
        age: p.age,
        gender: p.gender,
        race: p.race,
        appearance: p.appearance,
        personality: p.personality,
        tone: p.tone,
        image: p.image,
        images: p.images,
        imagePath: undefined, // visual 模式使用 image
    };
}

function adaptWorldPlayer(p?: WorldInteractionGameData['worldSetting']['Player'] | any): Player {
    if (!p) {
        return {
            name: '',
            age: undefined,
            gender: '',
            race: undefined,
            appearance: '',
            personality: '',
            tone: '',
            image: undefined,
            images: undefined,
            imagePath: undefined,
        };
    }
    
    // 处理 images：如果 images 是空对象或不存在，使用 imagePath 作为 base
    let images: { base: string; [key: string]: string } | undefined = undefined;
    if (p.images && typeof p.images === 'object' && Object.keys(p.images).length > 0) {
        // images 有内容，直接使用（确保所有值都是有效的字符串路径）
        const processedImages: { [key: string]: string } = {};
        for (const [key, value] of Object.entries(p.images)) {
            // 过滤掉 null、undefined 和 "null" 字符串
            if (value && typeof value === 'string' && value !== 'null' && !value.startsWith('null')) {
                processedImages[key] = value;
            }
        }
        // 确保有 base 属性
        if (Object.keys(processedImages).length > 0) {
            if (!processedImages.base && processedImages['base']) {
                processedImages.base = processedImages['base'];
            } else if (!processedImages.base) {
                // 如果没有 base，使用第一个值作为 base
                const firstValue = Object.values(processedImages)[0];
                if (firstValue) {
                    processedImages.base = firstValue;
                }
            }
            images = processedImages as { base: string; [key: string]: string };
        }
    } else if (p.imagePath && p.imagePath !== 'null' && !p.imagePath.startsWith('null')) {
        // images 为空或不存在，使用 imagePath 作为 base
        images = { base: p.imagePath };
    }
    
    // image 字段：优先使用 imagePath，否则使用 images.base
    // 过滤掉 "null" 字符串
    let image: string | undefined = undefined;
    if (p.imagePath && p.imagePath !== 'null' && !p.imagePath.startsWith('null')) {
        image = p.imagePath;
    } else if (images?.base) {
        image = images.base;
    }
    
    return {
        name: p.name || '',
        age: p.age,
        gender: p.gender || '',
        race: undefined, // worldInteraction 模式没有 race
        appearance: p.appearance || '',
        personality: p.personality || '',
        tone: p.tone || '',
        image: image,
        images: images,
        imagePath: p.imagePath && p.imagePath !== 'null' && !p.imagePath.startsWith('null') ? p.imagePath : undefined,
    };
}

// ========== NPC 适配器 ==========

function adaptVisualNPC(npc: VisualGameData['npcSetting']['npcs'][0]): NPC {
    return {
        id: npc.id,
        name: npc.name,
        age: npc.age,
        gender: npc.gender,
        job: npc.job,
        race: npc.race,
        description: npc.description,
        appearance: npc.appearance,
        personality: npc.personality,
        tone: npc.tone,
        relationship: npc.relationship,
        images: npc.images,
        abilities: npc.abilities,
        dialogue: npc.dialogue,
    };
}

function adaptWorldNPC(npc: WorldInteractionGameData['npcSetting']['npcs'][0]): NPC {
    // 处理 images：过滤掉 null、undefined 和 "null" 字符串
    let images: { base: string; [key: string]: string } | undefined = undefined;
    if (npc.images && typeof npc.images === 'object') {
        const processedImages: { [key: string]: string } = {};
        for (const [key, value] of Object.entries(npc.images)) {
            // 过滤掉 null、undefined 和 "null" 字符串
            if (value && typeof value === 'string' && value !== 'null' && !value.startsWith('null')) {
                processedImages[key] = value;
            }
        }
        // 确保有 base 属性
        if (Object.keys(processedImages).length > 0) {
            if (!processedImages.base && processedImages['base']) {
                processedImages.base = processedImages['base'];
            } else if (!processedImages.base) {
                // 如果没有 base，使用第一个值作为 base
                const firstValue = Object.values(processedImages)[0];
                if (firstValue) {
                    processedImages.base = firstValue;
                }
            }
            images = processedImages as { base: string; [key: string]: string };
        }
    }
    
    return {
        id: npc.id,
        name: npc.name,
        age: npc.age,
        gender: npc.gender,
        job: undefined, // worldInteraction 模式没有 job
        race: undefined, // worldInteraction 模式没有 race
        description: npc.description,
        appearance: npc.appearance,
        personality: npc.personality,
        tone: npc.tone,
        relationship: undefined, // worldInteraction 模式没有 relationship
        images: images, // 处理后的 images
        abilities: undefined, // worldInteraction 模式没有 abilities
        dialogue: undefined, // worldInteraction 模式没有 dialogue
    };
}

// ========== Scene 适配器 ==========

function adaptVisualScene(scene: VisualGameData['sceneSetting']['scenes'][0]): Scene {
    return {
        id: scene.id,
        name: scene.name,
        type: scene.type,
        description: scene.description,
        atmosphere: scene.atmosphere,
        dangerLevel: scene.dangerLevel,
        image: scene.image,
        items: scene.items,
        events: scene.events,
        soundtrack: scene.soundtrack,
        subscenes: scene.subscenes?.map(adaptVisualSubScene) || [], // 添加空值检查
        position: undefined, // visual 模式没有 position
    };
}

function adaptWorldScene(scene: WorldInteractionGameData['sceneSetting']['scenes'][0]): Scene {
    // 处理 image：过滤掉 "null" 字符串
    const image = scene.image && scene.image !== 'null' && !scene.image.startsWith('null')
        ? scene.image
        : undefined;
    
    return {
        id: scene.id,
        name: scene.name,
        type: undefined, // worldInteraction 模式没有 type
        description: scene.description,
        atmosphere: undefined, // worldInteraction 模式没有 atmosphere
        dangerLevel: undefined, // worldInteraction 模式没有 dangerLevel
        image: image, // 处理后的 image
        items: undefined, // worldInteraction 模式没有 items
        events: undefined, // worldInteraction 模式没有 events
        soundtrack: scene.soundtrack, // worldInteraction 模式 soundtrack 是必填的
        subscenes: scene.subscenes?.map(adaptWorldSubScene) || [], // 添加空值检查
        position: scene.position, // worldInteraction 模式有 position
    };
}

// ========== SubScene 适配器 ==========

function adaptVisualSubScene(subscene: VisualGameData['sceneSetting']['scenes'][0]['subscenes'][0]): Scene['subscenes'][0] {
    return {
        id: subscene.id,
        name: subscene.name,
        description: subscene.description,
        image: subscene.image,
        npcs: subscene.npcs || [], // 添加空值检查
        position: subscene.position,
        npcs_slots: subscene.npcs_slots || [], // 添加空值检查，如果不存在则使用空数组
    };
}

function adaptWorldSubScene(subscene: WorldInteractionGameData['sceneSetting']['scenes'][0]['subscenes'][0]): Scene['subscenes'][0] {
    // 处理 image：过滤掉 "null" 字符串
    const image = subscene.image && typeof subscene.image === 'string' && subscene.image !== 'null' && !subscene.image.startsWith('null')
        ? subscene.image
        : '';
    
    return {
        id: subscene.id,
        name: subscene.name,
        description: subscene.description,
        image: image, // 处理后的 image
        npcs: subscene.npcs,
        position: subscene.position,
        npcs_slots: subscene.npcs_slots || [], // worldInteraction 模式 npcs_slots 是可选的，转换为空数组
    };
}

