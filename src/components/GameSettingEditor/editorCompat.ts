import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';

export type EditorGameData = AllGameData | WorldInteractionGameData;

export type VisualScene = NonNullable<NonNullable<AllGameData['sceneSetting']>['scenes']>[number];
export type WorldScene = NonNullable<NonNullable<WorldInteractionGameData['sceneSetting']>['scenes']>[number];
export type SceneLike = VisualScene | WorldScene;

export type VisualSubScene = NonNullable<NonNullable<VisualScene['subscenes']>[number]>;
export type WorldSubScene = NonNullable<NonNullable<WorldScene['subscenes']>[number]>;
export type SubSceneLike = VisualSubScene | WorldSubScene;

export function isVisualMode(data: EditorGameData | null | undefined): data is AllGameData {
    if (!data) return false;
    return 'metadata' in data && data.metadata !== undefined;
}

export function isWorldInteractionMode(data: EditorGameData | null | undefined): data is WorldInteractionGameData {
    return !!data && !isVisualMode(data);
}

export function isWorldScene(scene: SceneLike | undefined | null): scene is WorldScene {
    if (!scene) return false;
    return 'subscenes' in scene && Array.isArray((scene as WorldScene).subscenes);
}

export function isWorldSubScene(sub: SubSceneLike | undefined | null): sub is WorldSubScene {
    if (!sub) return false;
    // worldInteraction 的 SubScene 有 position 字段
    return 'position' in sub && Array.isArray((sub as WorldSubScene).position);
}

export function getScenes(data: EditorGameData | null | undefined) {
    if (!data?.sceneSetting) return [];
    return data.sceneSetting.scenes || [];
}

export function getSceneById(gameData: EditorGameData | null | undefined, sceneId: string): SceneLike | undefined {
    return gameData?.sceneSetting?.scenes?.find((s: SceneLike) => s.id === sceneId);
}

export function getSubSceneById(scene: SceneLike | undefined, subsceneId: string): SubSceneLike | undefined {
    if (!scene) return undefined;
    if (!('subscenes' in scene)) return undefined;
    const subscenes = scene.subscenes || [];
    return subscenes.find((sub: SubSceneLike) => sub.id === subsceneId);
}


