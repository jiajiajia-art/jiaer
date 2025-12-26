import type { ApiResponse } from "../api.types";
import { api } from "../base";
import type { CheckUploadStatusResponse, GenerateImgeResponse, NPC, Player, WorldSetting } from "../galgame/EditorData.type";
import type { Scene, SubScene } from "./mapWorldData.type";
import type { CalculatePointsResponse, GenerateALLSceneImage, GenerateNpcImage, NpcSlot, UploadMusicResponse, UploadNpcImageResponse, UploadPlayerImageResponse, UploadSceneImageResponse, UploadSubSceneImageResponse } from "./worldEditor.type";
import type { UploadWorldFileResponse } from "./worldInteractionApi.type";

const worldEditor = {
    uploadWorldFile: (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<UploadWorldFileResponse>(
            `/worldInteraction/document/upload`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 1500000,
            }
        );
    },
    checkUploadStatus: (jobId: string) => {
        return api.get<CheckUploadStatusResponse>(`/world-interaction/document/jobs/${jobId}/status`);
    },
    updateWorldSetting: (fileId: string, data: Partial<WorldSetting>) => {
        return api.put<ApiResponse<WorldSetting>>(
            `/world-interaction/edit/${fileId}/world-setting`,
            data
        );
    },
    updatePlayer: (fileId: string, data: Player) => {
        return api.put<ApiResponse<Player>>(
            `/world-interaction/edit/${fileId}/player`,
            data
        );
    },
    updateNpc: (fileId: string, data: NPC) => {
        return api.put<ApiResponse<NPC>>(
            `/world-interaction/edit/${fileId}/npcs/${data.id}`,
            data
        );
    },
    updateScene: (fileId: string, data: Scene) => {
        return api.put<ApiResponse<Scene>>(
            `/world-interaction/edit/${fileId}/scenes/${data.id}`,
            data
        );
    },
    updateSubScene: (fileId: string, sceneId: string, data: SubScene) => {
        return api.put<ApiResponse<SubScene>>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${data.id}`,
            data
        );
    },
    deleteNpc: (fileId: string, id: string) => {
        return api.delete<ApiResponse<NPC>>(
            `/world-interaction/edit/${fileId}/npcs/${id}`
        );
    },
    deleteScene: (fileId: string, id: string) => {
        return api.delete<ApiResponse<Scene>>(
            `/world-interaction/edit/${fileId}/scenes/${id}`
        );
    },
    deleteSubScene: (fileId: string, sceneId: string, id: string) => {
        return api.delete<ApiResponse<SubScene>>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${id}`
        );
    },
    addNpc: (fileId: string, data: NPC) => {
        return api.post<ApiResponse<NPC>>(
            `/world-interaction/edit/${fileId}/npcs`,
            data
        );
    },
    addScene: (fileId: string, data: Scene) => {
        return api.post<ApiResponse<Scene>>(
            `/world-interaction/edit/${fileId}/scenes`,
            data
        );
    },
    addSubScene: (fileId: string, sceneId: string, data: SubScene) => {
        return api.post<ApiResponse<SubScene>>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes`,
            data
        );
    },
    generateAllSceneImages: (fileId: string) => {
        return api.post<ApiResponse<GenerateALLSceneImage>>(
            `/world-interaction/images/generate-scenes-subscenes`,
            {
                fileId: fileId
            },
            {
                timeout: 1500000,
            }
        );
    },
    uploadSubSceneImage: (fileId: string, sceneId: string, subsceneId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<UploadSubSceneImageResponse>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/subscenes/${subsceneId}/image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
    uploadSceneImage: (fileId: string, sceneId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<UploadSceneImageResponse>(
            `/world-interaction/edit/${fileId}/scenes/${sceneId}/image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
    uploadNpcImage: (fileId: string, npcId: string, data: {file: File, variat:string}) => {
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('variant', data.variat);
        return api.post<UploadNpcImageResponse>(
            `/world-interaction/edit/${fileId}/npcs/${npcId}/image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
    uploadPlayerImage: (fileId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<UploadPlayerImageResponse>(
            `/world-interaction/edit/${fileId}/player/image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
    },
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
        formData.append('file', file);
        return api.post<GenerateImgeResponse>(
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
        return api.post<GenerateImgeResponse>(
            `/world-interaction/images/generate-world-map`,
            {
                fileId: fileId
            },
            {
                timeout: 180000,
            }
        );
    },
    generateSubSceneImage: (fileId: string, sceneId: string, subsceneId: string) => {
        return api.post<{
            success: boolean,
            message: string,
            subsceneId: string,
            imagePath: string
        }>(
            `/world-interaction/images/generate-subscene`,
            {
                fileId: fileId,
                sceneId: sceneId,
                subsceneId: subsceneId
            },
            {
                timeout: 180000,
            }
        );
    },
    calculateScenePoints: (fileId: string) => {
        return api.post<CalculatePointsResponse>(
            `/world-interaction/images/generate-scenes/calculate-points`,
            {
                fileId: fileId,
            }
        );
    },
    calculateNpcPoints: (fileId: string) => {
        return api.post<CalculatePointsResponse>(
            `/world-interaction/images/generate-npcs/calculate-points`,
            {
                fileId: fileId,
            }
        );
    },

    uploadMusic: (fileId: string, file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post<UploadMusicResponse>(
            `/world-interaction/edit/${fileId}/music`,
            formData,
        );
    },
};

export default worldEditor;