/**
 * 场景相关 API 调用辅助函数
 * 统一封装两种模式的 API 调用差异，消除 mode 判断
 */
import EditorApi from '../../../api/galgame/EditorData';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import type { Scene as ApiScene } from '../../../api/galgame/getGalgamePreset.type';
import type { GenerateImgeResponse } from '../../../api/galgame/EditorData.type';
import type { UploadSceneImageResponse, UploadSubSceneImageResponse } from '../../../api/worldInteraction/worldEditor.type';

export type SceneApiHelpers = ReturnType<typeof createSceneApiHelpers>;

export const createSceneApiHelpers = (mode: string) => {
    const isWorldInteraction = mode === 'worldInteraction';

    return {
        // 单场景增删改
        addScene: async (fileId: string, data: ApiScene) => {
            return isWorldInteraction
                ? worldEditor.addScene(fileId, data as any)
                : EditorApi.addScene(fileId, data);
        },

        updateScene: async (fileId: string, data: ApiScene) => {
            return isWorldInteraction
                ? worldEditor.updateScene(fileId, data as any)
                : EditorApi.updateScene(fileId, data);
        },

        deleteScene: async (fileId: string, sceneId: string) => {
            return isWorldInteraction
                ? worldEditor.deleteScene(fileId, sceneId)
                : EditorApi.deleteScene(fileId, sceneId);
        },

        // 场景图片上传/生成
        uploadSceneImage: async (fileId: string, sceneId: string, file: File) => {
            return isWorldInteraction
                ? worldEditor.uploadSceneImage(fileId, sceneId, file)
                : EditorApi.uploadSceneImage(fileId, sceneId, file);
        },

        generateSceneImage: async (params: {
            fileId: string;
            scene: { id: string; name: string; description: string };
        }) => {
            const { fileId, scene } = params;
            return EditorApi.generateSceneImage(scene.id, fileId, {
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // 子场景（仅 worldInteraction）
        addSubScene: async (fileId: string, sceneId: string, data: any) => {
            return worldEditor.addSubScene(fileId, sceneId, data);
        },

        updateSubScene: async (fileId: string, sceneId: string, data: any) => {
            return worldEditor.updateSubScene(fileId, sceneId, data);
        },

        deleteSubScene: async (fileId: string, sceneId: string, subsceneId: string) => {
            return worldEditor.deleteSubScene(fileId, sceneId, subsceneId);
        },

        uploadSubSceneImage: async (fileId: string, sceneId: string, subsceneId: string, file: File) => {
            return worldEditor.uploadSubSceneImage(fileId, sceneId, subsceneId, file);
        },

        generateSubSceneImage: async (fileId: string, sceneId: string, subsceneId: string) => {
            return worldEditor.generateSubSceneImage(fileId, sceneId, subsceneId);
        },

        // 大地图 & 批量生图（仅场景）
        generateWorldMapImage: async (fileId: string) => {
            return worldEditor.generateWorldMapImage(fileId);
        },

        setWorldMapImage: async (fileId: string, file: File) => {
            return worldEditor.setWorldMapImage(fileId, file);
        },

        generateAllSceneImages: async (fileId: string) => {
            if (isWorldInteraction) {
                return worldEditor.generateAllSceneImages(fileId);
            }
            return EditorApi.generateAllImages(fileId, {
                generateNPCs: false,
                generateScenes: true,
                generateVariants: false,
                generatePlayer: false,
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        calculateScenePoints: async (fileId: string) => {
            return isWorldInteraction
                ? worldEditor.calculateScenePoints(fileId)
                : EditorApi.calculateScenePoints(fileId);
        },

        // 下载图片
        downloadImage: async (fileId: string, type: 'npcs' | 'scenes' | 'subscenes' | 'worldMap', name: string, variant?: string) => {
            const pluginType = isWorldInteraction ? 'world-interaction' : 'visual';
            // 对于 NPC，需要传递 variant（如 base），场景不需要
            return EditorApi.downloadImage(pluginType, fileId, type, name, variant);
        },
    };
};

/**
 * 响应数据解析辅助函数
 * 根据后端实际返回的数据结构进行解析
 * - 上传/生成图片接口：返回扁平结构 { success, message, imagePath, sceneId, ... }
 */
export const parseSceneResponse = {
    extractSceneImage: (
        response: UploadSceneImageResponse | GenerateImgeResponse,
        _mode: string,
        sceneId?: string
    ): { imagePath?: string; sceneId?: string } | null => {
        return {
            imagePath: response.imagePath,
            sceneId: 'sceneId' in response ? response.sceneId : sceneId,
        };
    },

    extractSubSceneImage: (
        response: UploadSubSceneImageResponse | GenerateImgeResponse
    ): { imagePath?: string; sceneId?: string; subsceneId?: string } | null => {
        if ('imagePath' in response) {
            return {
                imagePath: response.imagePath,
                sceneId: 'sceneId' in response ? response.sceneId : undefined,
                subsceneId: 'subsceneId' in response ? response.subsceneId : undefined,
            };
        }

        return null;
    },
};


