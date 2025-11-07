import type { GameFiles, Scene } from "./gameData";

export interface ChangeSceneRequest {
    sceneId: string;
    description?: string;
}

export interface ChangeSceneSuccessResponse {
    success: true;
    message: string;
    previousScene: string;
    currentScene: string;
    sceneData: Scene;
    updatedFiles: GameFiles;
    timestamp: string;
}

export interface ChangeSceneErrorResponse {
    success: false;
    error: string;
    message: string;
    sceneId?: string;
    sceneName?: string;
    locked?: boolean;
}

export type ChangeSceneResponse =
    | ChangeSceneSuccessResponse
    | ChangeSceneErrorResponse;
