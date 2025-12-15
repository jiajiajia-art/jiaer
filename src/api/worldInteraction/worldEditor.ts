import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { Scene, SubScene } from "./mapWorldData.type";
import type { generateWorldMapImageResponse, NpcSlot } from "./worldEditor.type";

const worldEditor = {
    setZoomNpc: (fileId: string, sceneId: string, subsceneId: string, npcSlots: NpcSlot[]) => {
        return api.put<ApiResponse<SubScene>>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${subsceneId}/npc-slots`,
            {
                npcSlots: npcSlots
            }
        );
    },
    setSubScenePosition: (fileId: string, sceneId: string, positions: { [key: string]: [number, number] }) => {
        return api.put<ApiResponse<SubScene>>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/positions`,
            {
                positions: positions
            }
        );
    },
    setScenePosition: (fileId: string, positions: { [key: string]: [number, number] }) => {
        return api.put<ApiResponse<Scene>>(
            `/world-interaction/edit/${fileId}/scenes/positions`,
            {
                positions: positions
            }
        );
    },
    changeSubSceneScene: (fileId: string, subSceneId: string, fromSceneId: string, toSceneId: string) => {
        return api.post<ApiResponse<Scene>>(
            `/world-interaction/edit/${fileId}/subscenes/${subSceneId}/move`,
            {
                fromSceneId: fromSceneId,
                toSceneId: toSceneId
            }
        );
    },
    setWorldMapImage: (fileId: string, file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        return api.post<generateWorldMapImageResponse>(
            `/world-interaction/edit/${fileId}/world-map/image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
    generateWorldMapImage: (fileId: string) => {
        return api.post<generateWorldMapImageResponse>(
            `/world-interaction/images/generate-world-map`,
            {
                fileId: fileId
            },
            {
                timeout: 100000,
            }
        );
    }
};

export default worldEditor;