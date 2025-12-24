import { api } from "../base";
import type { CalculatePointsResponse, UploadNpcImageResponse, UploadPlayerImageResponse, UploadSceneImageResponse } from "../worldInteraction/worldEditor.type";
import type { AllGameData, NPC, WorldSetting, Player, GenerateNpcImageRequest, GenerateSceneImageRequest, GenerateVariantImageRequest, GeneratePlayerImageRequest, GenerateAllImageRequest, GenerateImgeResponse, CheckUploadStatusResponse, UploadFileResponse } from "./EditorData.type";
import type { Scene } from "./getGalgamePreset.type";

const EditorApi = {
    uploadGameFile: (file:File) => {
        const formData = new FormData();
        formData.append('document', file);
        return api.post<UploadFileResponse>(`/optical/games/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    checkUploadStatus: (jobId:string) => {
        return api.get<CheckUploadStatusResponse>(`/visual/document/jobs/${jobId}/status`);
    },
    getEditorData: (fileId:string) =>
        api.get<AllGameData>(`/visual/edit/${fileId}/complete`,
            {
                timeout: 150000,
            }
        ),
    updateWorldSetting: (fileId:string, data:Partial<WorldSetting>) =>
        api.put<AllGameData>(`/visual/edit/${fileId}/world`, data),
    addNpc: (fileId:string, data:NPC) =>
        api.post<AllGameData>(`/visual/edit/${fileId}/npcs`, data),
    updateNpc: (fileId:string, data:NPC) =>
        api.put<AllGameData>(`/visual/edit/${fileId}/npcs/${data.id}`, data),
    updatePlayer: (fileId:string, data:Player) =>
        api.put<AllGameData>(`/visual/edit/${fileId}/player`, data),
    deleteNpc: (fileId:string, id:string) =>
        api.delete<AllGameData>(`/visual/edit/${fileId}/npcs/${id}`),
    addScene: (fileId:string, data:Scene) =>
        api.post<AllGameData>(`/visual/edit/${fileId}/scenes`, data),
    deleteScene: (fileId:string, id:string) =>
        api.delete<AllGameData>(`/visual/edit/${fileId}/scenes/${id}`),
    updateScene: (fileId:string, data:Scene) =>
        api.put<AllGameData>(`/visual/edit/${fileId}/scenes/${data.id}`, data),
    uploadGameCover: (fileId:string, file:File) => {
        const formData = new FormData();
        formData.append('cover', file);
        formData.append('fileId', fileId);
        return api.post<AllGameData>(`/optical/games/upload-cover`, 
            formData , {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    uploadPlayerImage: (fileId:string, data:{file:File, variant:string}) => {
        const formData = new FormData();
        formData.append('image', data.file);
        formData.append('variat', data.variant);
        return api.post<UploadPlayerImageResponse>(`/visual/edit/${fileId}/player/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    uploadSceneImage: (fileId:string, sceneId:string, file:File) => {
        const formData = new FormData();
        formData.append('image', file);
        return api.post<UploadSceneImageResponse>(`/visual/edit/${fileId}/scenes/${sceneId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    uploadNpcImage: (fileId:string, npcId:string, data:{file:File, variat:string}) => {
        const formData = new FormData();
        formData.append('image', data.file);
        formData.append('variant', data.variat);
        return api.post<UploadNpcImageResponse>(`/visual/edit/${fileId}/npcs/${npcId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    generateAllImages: (data: GenerateAllImageRequest) => {
        return api.post<AllGameData>(`/visual/images/generate-all`, data, {
            timeout: 180000,
        });
    },
    generatePlayerImage: (data:GeneratePlayerImageRequest) => {
        return api.post<GenerateImgeResponse>(`/visual/images/generate-player`, data, {
            timeout: 180000,
        });
    },
    generateNpcImage: (data: GenerateNpcImageRequest) =>
        api.post<GenerateImgeResponse>(`/visual/images/generate-npc`, data, {
            timeout: 180000,
        }),
    generateSceneImage: (data: GenerateSceneImageRequest) =>
        api.post<GenerateImgeResponse>(`/visual/images/generate-scene`, data, {
            timeout: 180000,
        }),
    generateVariantImage: (data: GenerateVariantImageRequest) =>
        api.post<GenerateImgeResponse>(`/visual/images/generate-npc-variant`, data, {
            timeout: 180000,
        }),
    calculateScenePoints: (fileId: string) =>
        api.post<CalculatePointsResponse>(`/visual/images/generate-scenes/calculate-points`, {
            fileId: fileId,
        }),
    calculateNpcPoints: (fileId: string) =>
        api.post<CalculatePointsResponse>(`/visual/images/generate-npcs/calculate-points`, {
            fileId: fileId,
        }),
    downloadImage: (pluginType:string, fileId:string, type:string, name: string, variant?: string) =>{
        // Player 类型：/players/base.png（不需要 name）
        // NPC 类型：/npcs/{name}/base.png（需要 name）
        // 场景类型：/scenes/{name}.png（不需要 variant）
        let url: string;
        if (type === 'players' && variant) {
            url = `/images/${pluginType}/${fileId}/${type}/${variant}.png`;
        } else if (type === 'npcs' && variant) {
            url = `/images/${pluginType}/${fileId}/${type}/${name}/${variant}.png`;
        } else {
            url = `/images/${pluginType}/${fileId}/${type}/${name}.png`;
        }
        return api.get<Blob>(url, {
            responseType: 'blob',
        });
    }
}

export default EditorApi;