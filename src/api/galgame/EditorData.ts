import type { ApiResponse } from "../api.types";
import { api, UPLOAD_TIMEOUT_MS } from "../base";
import type { CalculatePointsResponse, GetMusicListResponse, UploadMusicResponse, UploadNpcImageResponse, UploadPlayerImageResponse, UploadSceneImageResponse } from "../worldInteraction/worldEditor.type";
import type {
    AllGameData,
    NPC,
    WorldSetting,
    Player,
    GenerateVariantImageRequest,
    GenerateAllImageRequest,
    GenerateAllImagesResponse,
    GenerateImgeResponse,
    CheckUploadStatusResponse,
    UploadFileResponse,
    GenerateImageRequest,
    StartBatchImageJobResponse,
    BatchImageJobStatus,
    BatchImageJobResult,
    UploadGameCoverResponse,
    StoryStructure,
    DynamicEntry,
    CheckGenerateStatusResponse,
    GetGenerateResultResponse,
    GenerateStoryStructureResponse,
} from "./EditorData.type";
import type { Scene } from "./getGalgamePreset.type";
import { extractImageExtension } from "../../utils/imageCache";

const EditorApi = {
    generateGameFromIdea: (
        idea: string,
        options?: {
            generateAssets?: boolean;
            assetFlags?: { portraits?: boolean; scenes?: boolean; cover?: boolean };
        },
    ) => {
        return api.post<UploadFileResponse>(`/visual/document/generate-from-idea`, {
            idea,
            generateAssets: Boolean(options?.generateAssets),
            assetFlags: options?.assetFlags || undefined,
        });
    },
    /** 一句话弹窗：AI 生成/扩写创意描述（扣 1 积分） */
    generateIdeaText: (seed?: string) => {
        return api.post<{
            success: boolean;
            data?: {
                text: string;
                pointsDeducted: number;
                remainingPoints: number;
            };
            message?: string;
            error?: string;
        }>(`/visual/document/generate-idea-text`, {
            seed: seed || '',
        });
    },
    uploadGameFile: (file:File) => {
        const formData = new FormData();
        formData.append('document', file);
        return api.post<UploadFileResponse>(`/optical/games/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    createVisualEmptyGame: (title:string) => {
        return api.post<UploadFileResponse>(`/visual/document/create-empty`, { title: title });
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
    generateStoryStructure: (fileId:string, description:string) =>
        api.post<UploadFileResponse | GenerateStoryStructureResponse>(`/visual/edit/${fileId}/story-structure/generate`, {
            description: description,
        }, {
            timeout: 1500000,
        }),
    checkGenerateStatus: (jobId:string) =>
        api.get<CheckGenerateStatusResponse>(`/visual/story-generation/jobs/${jobId}/status`),
    getGenerateResult: (jobId:string) =>
        api.get<GetGenerateResultResponse>(`/visual/story-generation/jobs/${jobId}/result`),
    // story-structure phases CRUD
    addStoryPhase: (fileId: string, phase: StoryStructure['phases'][number]) =>
        api.post<StoryStructure>(`/visual/edit/${fileId}/story-phases/phases`, phase),
    updateStoryPhase: (fileId: string, phaseId: string, phase: StoryStructure['phases'][number]) =>
        api.put<StoryStructure>(`/visual/edit/${fileId}/story-phases/phases/${phaseId}`, phase),
    deleteStoryPhase: (fileId: string, phaseId: string) =>
        api.delete<ApiResponse<null>>(`/visual/edit/${fileId}/story-phases/phases/${phaseId}`),
    // dynamicEntries CRUD
    addDynamicEntry: (fileId: string, entry: DynamicEntry) =>
        api.post<DynamicEntry>(`/visual/edit/${fileId}/dynamic-entries`, entry),
    updateDynamicEntry: (fileId: string, entryId: string, entry: DynamicEntry) =>
        api.put<DynamicEntry>(`/visual/edit/${fileId}/dynamic-entries/${entryId}`, entry),
    deleteDynamicEntry: (fileId: string, entryId: string) =>
        api.delete<ApiResponse<null>>(`/visual/edit/${fileId}/dynamic-entries/${entryId}`),
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
    uploadGameCover: (fileId:string, file:File, orientation: 'landscape' | 'portrait' = 'landscape') => {
        const formData = new FormData();
        formData.append('cover', file);
        formData.append('fileId', fileId);
        formData.append('orientation', orientation);
        return api.post<UploadGameCoverResponse>(`/optical/games/upload-cover`, 
            formData , {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            timeout: UPLOAD_TIMEOUT_MS,
        });
    },
    /** 游戏简介配图（返回 /public/... URL，写入 description HTML） */
    uploadDescImage: (fileId: string, file: File) => {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('fileId', fileId);
        return api.post<{ success: boolean; message?: string; data?: { url: string } }>(
            `/optical/games/upload-desc-image`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: UPLOAD_TIMEOUT_MS,
            },
        );
    },
    /** AI 生成游戏封面（扣积分，规则同场景生图） */
    generateGameCover: (
        fileId: string,
        data?: {
            prompt?: string;
            title?: string;
            orientation?: 'landscape' | 'portrait';
            /** control=模型画标题字效；treatment=无字生图+客户端叠字 */
            abArm?: 'treatment' | 'control';
        },
    ) =>
        api.post<UploadGameCoverResponse>(`/optical/games/generate-cover`, {
            fileId,
            ...(data?.prompt != null ? { prompt: data.prompt } : {}),
            ...(data?.title != null ? { title: data.title } : {}),
            ...(data?.orientation != null ? { orientation: data.orientation } : {}),
            ...(data?.abArm != null ? { abArm: data.abArm } : {}),
        }, {
            timeout: UPLOAD_TIMEOUT_MS,
        }),
    uploadPlayerImage: (fileId:string, data:{file:File, variant:string, variationDescription?: string}) => {
        const formData = new FormData();
        formData.append('image', data.file);
        formData.append('variant', data.variant);
        if (data.variationDescription !== undefined) {
            formData.append('variationDescription', data.variationDescription);
        }
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
            // 上传/后端处理可能超过全局默认 10s，单独放宽超时，避免 ECONNABORTED
            timeout: UPLOAD_TIMEOUT_MS,
        });
    },
    uploadNpcImage: (fileId:string, npcId:string, data:{file:File, variat:string, variationDescription?: string}) => {
        const formData = new FormData();
        formData.append('image', data.file);
        formData.append('variant', data.variat);
        if (data.variationDescription !== undefined) {
            formData.append('variationDescription', data.variationDescription);
        }
        return api.post<UploadNpcImageResponse>(`/visual/edit/${fileId}/npcs/${npcId}/image`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
    },
    generateAllImages: (fileId: string, data: GenerateAllImageRequest) => {
        return api.post<GenerateAllImagesResponse | ApiResponse<GenerateAllImagesResponse>>(
            `/visual/generate-images/${fileId}/all`,
            data,
            {
            timeout: 0,
            }
        );
    },
    startGenerateAllImages: (fileId: string, data: GenerateAllImageRequest) => {
        return api.post<StartBatchImageJobResponse>(`/visual/generate-images/${fileId}/all/start`, data, {
            timeout: 0,
        });
    },
    getGenerateAllImagesJobStatus: (jobId: string) => {
        // 切片批任务在 status 内 await 生图，需与单人生图同「不限时」
        return api.get<BatchImageJobStatus>(`/visual/generate-images/jobs/${jobId}/status`, {
            timeout: 0,
        });
    },
    getGenerateAllImagesJobResult: (jobId: string) => {
        return api.get<BatchImageJobResult>(`/visual/generate-images/jobs/${jobId}/result`);
    },
    generatePlayerImage: (fileId: string, data: GenerateImageRequest) => {
        return api.post<GenerateImgeResponse>(`/visual/generate-images/${fileId}/player`, data, {
            timeout: 0,
        });
    },
    generateNpcImage: ( fileId: string, npcId: string, data: GenerateImageRequest) =>
        api.post<GenerateImgeResponse>(`/visual/generate-images/${fileId}/npcs/${npcId}`, data, {
            timeout: 0,
        }),
    generateSceneImage: (sceneId: string, fileId: string, data: GenerateImageRequest) =>
        api.post<Blob>(`/visual/generate-images/${fileId}/scenes/${encodeURIComponent(sceneId)}`, data, {
            responseType: 'blob',
            timeout: 0,
        }),
    generateVariantImage: (fileId: string, npcId: string, data: GenerateVariantImageRequest) =>
        api.post<GenerateImgeResponse>(`/visual/generate-images/${fileId}/npcs/${npcId}/variant`, data, {
            timeout: 0,
        }),
    deleteVariantImage: (fileId:string, npcId:string, variant:string) =>
        api.delete<ApiResponse<null>>(`/visual/edit/${fileId}/npcs/${npcId}/image/${variant}`),
    deletePlayerImageVariant: (fileId:string, variant:string) =>
        api.delete<ApiResponse<null>>(`/visual/edit/${fileId}/player/image/${variant}`),
    calculateScenePoints: (fileId: string) =>
        api.post<CalculatePointsResponse>(`/visual/scenes/calculate-points`, {
            fileId: fileId,
        }),
    calculateNpcPoints: (fileId: string, body: Record<string, unknown> = {}) =>
        api.post<CalculatePointsResponse>(`/visual/npcs/calculate-points`, {
            fileId: fileId,
            ...body,
        }),
    downloadImage: (pluginType:string, fileId:string, type:string, name: string, variant?: string, imagePath?: string) =>{
        // Player 类型：/players/base.png（不需要 name）
        // NPC 类型：/npcs/{name}/base.png（需要 name）
        // 场景类型：/scenes/{name}.png（不需要 variant）
        const extension = extractImageExtension(imagePath);
        let url: string;
        if (type === 'players' && variant) {
            url = `/${pluginType}/images/${fileId}/${type}/${variant}${extension}`;
        } else if (type === 'npcs' && variant) {
            url = `/${pluginType}/images/${fileId}/${type}/${name}/${variant}${extension}`;
        } else {
            url = `/${pluginType}/images/${fileId}/${type}/${name}${extension}`;
        }
        return api.get<Blob>(url, {
            responseType: 'blob',
        });
    },
    uploadVisualMusic: (fileId: string, file: File, name: string, description: string) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', name);
        formData.append('description', description);
        return api.post<UploadMusicResponse>(
            `/visual/edit/${fileId}/music`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 1500000,
            }
        );
    },
    getVisualMusicList: (fileId: string) => {
        return api.get<GetMusicListResponse>(
            `/visual/edit/${fileId}/music`,
        );
    },
    getVisualMusic: (fileId: string, musicId: string) => {
        return api.get<Blob>(
            `/visual/music/${fileId}/${musicId}`,
            {
                responseType: 'blob',
                headers: {
                    'Cache-Control': 'no-cache',
                },
            }
        );
    },
    deleteVisualMusic: (fileId: string, filename: string) => {
        return api.delete<ApiResponse<null>>(
            `/visual/edit/${fileId}/music/${filename}`
        );
    },
}

export default EditorApi;
