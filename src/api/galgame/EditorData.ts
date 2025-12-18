import { api } from "../base";
import type { AllGameData, NPC, WorldSetting, Player, GenerateNpcImageRequest, GenerateSceneImageRequest, GenerateVariantImageRequest, GeneratePlayerImageRequest } from "./EditorData.type";
import type { Scene } from "./getGalgamePreset.type";

const EditorApi = {
    getEditorData: (fileId:string) =>
        api.get<AllGameData>(`/visual/edit/${fileId}/complete`),
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
        return api.post<AllGameData>(`/visual/edit/${fileId}/player/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    uploadSceneImage: (fileId:string, sceneId:string, file:File) => {
        const formData = new FormData();
        formData.append('image', file);
        return api.post<AllGameData>(`/visual/edit/${fileId}/scenes/${sceneId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    uploadNpcImage: (fileId:string, npcId:string, data:{file:File, variat:string}) => {
        const formData = new FormData();
        formData.append('image', data.file);
        formData.append('variant', data.variat);
        return api.post<AllGameData>(`/visual/edit/${fileId}/npcs/${npcId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    generatePlayerImage: (data:GeneratePlayerImageRequest) => {
        return api.post<AllGameData>(`/visual/images/generate-player`, data, {
            timeout: 150000,
        });
    },
    generateNpcImage: (data: GenerateNpcImageRequest) =>
        api.post<AllGameData>(`/visual/images/generate-npc`, data, {
            timeout: 150000,
        }),
    generateSceneImage: (data: GenerateSceneImageRequest) =>
        api.post<AllGameData>(`/visual/images/generate-scene`, data, {
            timeout: 150000,
        }),
    generateVariantImage: (data: GenerateVariantImageRequest) =>
        api.post<AllGameData>(`/visual/images/generate-npc-variant`, data, {
            timeout: 150000,
        }),
}

export default EditorApi;