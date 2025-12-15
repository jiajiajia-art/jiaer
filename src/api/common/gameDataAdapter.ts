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
        player: adaptWorldPlayer(ws.Player), // 注意：worldInteraction 使用大写的 Player
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

function adaptWorldPlayer(p?: WorldInteractionGameData['worldSetting']['Player']): Player {
    return {
        name: p?.name || '',
        age: p?.age,
        gender: p?.gender || '',
        race: undefined, // worldInteraction 模式没有 race
        appearance: p?.appearance || '',
        personality: p?.personality || '',
        tone: p?.tone || '',
        image: undefined, // worldInteraction 模式使用 imagePath
        images: undefined,
        imagePath: p?.imagePath,
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
        images: npc.images, // worldInteraction 模式 images 是必填的
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
    return {
        id: scene.id,
        name: scene.name,
        type: undefined, // worldInteraction 模式没有 type
        description: scene.description,
        atmosphere: undefined, // worldInteraction 模式没有 atmosphere
        dangerLevel: undefined, // worldInteraction 模式没有 dangerLevel
        image: scene.image, // worldInteraction 模式 image 是必填的
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
    return {
        id: subscene.id,
        name: subscene.name,
        description: subscene.description,
        image: subscene.image,
        npcs: subscene.npcs,
        position: subscene.position,
        npcs_slots: subscene.npcs_slots || [], // worldInteraction 模式 npcs_slots 是可选的，转换为空数组
    };
}

