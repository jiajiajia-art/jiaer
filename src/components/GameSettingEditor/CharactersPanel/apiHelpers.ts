/**
 * API调用辅助函数
 * 统一封装两种模式的API调用差异，消除mode判断
 */
import EditorApi from '../../../api/galgame/EditorData';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import type { NPC, Player, AllGameData, GenerateVariantImageRequest } from '../../../api/galgame/EditorData.type';
import type { ApiResponse } from '../../../api/api.types';
import type { UploadPlayerImageResponse, UploadNpcImageResponse } from '../../../api/worldInteraction/worldEditor.type';
import type { GenerateImgeResponse } from '../../../api/galgame/EditorData.type';

export type ApiHelpers = ReturnType<typeof createApiHelpers>;

export const createApiHelpers = (mode: string) => {
    const isWorldInteraction = mode === 'worldInteraction';    

    return {
        // 玩家相关
        updatePlayer: async (fileId: string, data: Player) => {
            return isWorldInteraction
                ? worldEditor.updatePlayer(fileId, data)
                : EditorApi.updatePlayer(fileId, data);
        },

        uploadPlayerImage: async (fileId: string, file: File, variant?: string) => {
            return isWorldInteraction
                ? worldEditor.uploadPlayerImage(fileId, file)
                : EditorApi.uploadPlayerImage(fileId, { file, variant: variant || 'base' });
        },

        generatePlayerImage: async (fileId: string) => {
            return EditorApi.generatePlayerImage(fileId, {
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // NPC相关
        addNpc: async (fileId: string, data: NPC) => {
            return isWorldInteraction
                ? worldEditor.addNpc(fileId, data)
                : EditorApi.addNpc(fileId, data);
        },

        updateNpc: async (fileId: string, data: NPC) => {
            return isWorldInteraction
                ? worldEditor.updateNpc(fileId, data)
                : EditorApi.updateNpc(fileId, data);
        },

        deleteNpc: async (fileId: string, npcId: string) => {
            return isWorldInteraction
                ? worldEditor.deleteNpc(fileId, npcId)
                : EditorApi.deleteNpc(fileId, npcId);
        },

        uploadNpcImage: async (fileId: string, npcId: string, file: File, variant?: string) => {
            return isWorldInteraction
                ? worldEditor.uploadNpcImage(fileId, npcId, { file, variat: variant || 'base' })
                : EditorApi.uploadNpcImage(fileId, npcId, { file, variat: variant || 'base' });
        },

        generateNpcImage: async (fileId: string, npc: NPC) => {
            return EditorApi.generateNpcImage(npc.id, fileId, {
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // 批量操作
        generateAllNpcImages: async (fileId: string) => {
            return isWorldInteraction
                ? worldEditor.generateAllNpcImages(fileId)
                : EditorApi.generateAllImages(fileId, {
                    generateNPCs: true,
                    generateScenes: false,
                    generateVariants: false,
                    generatePlayer: false,
                    removeBg: true,
                });
        },

        calculateNpcPoints: async (fileId: string) => {
            return isWorldInteraction
                ? worldEditor.calculateNpcPoints(fileId)
                : EditorApi.calculateNpcPoints(fileId);
        },

        // 差分相关
        generateVariantImage: async (
            fileId: string,
            npcId: string,
            variant: GenerateVariantImageRequest['variant']
        ) => {
            return EditorApi.generateVariantImage(fileId, npcId === 'player' ? 'player' : npcId, {
                variant,
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // 下载图片
        downloadImage: async (fileId: string, type: 'npcs' | 'players' | 'scenes' | 'subscenes' | 'worldMap', name: string, variant?: string) => {
            const pluginType = isWorldInteraction ? 'world-interaction' : 'visual';
            // 对于 NPC，需要传递 variant（如 base），场景不需要
            return EditorApi.downloadImage(pluginType, fileId, type, name, variant);
        },
    };
};

/**
 * 响应数据解析辅助函数
 * 根据后端实际返回的数据结构进行解析
 * - 上传/生成图片接口：返回扁平结构 { success, message, imagePath, variant, npcId, ... }
 * - 更新操作接口：返回 ApiResponse<T> { success, message, data: T }
 * - Visual 模式更新操作：返回 AllGameData { success, worldSetting, npcSetting, ... }
 */
export const parseResponse = {
    // 从API响应中提取玩家数据（兼容两种模式）
    // worldInteraction: ApiResponse<Player> -> response.data
    // visual: AllGameData -> response.worldSetting.player
    extractPlayer: (
        response: ApiResponse<Player> | AllGameData,
        mode: string
    ): Player | null => {
        if (mode === 'worldInteraction') {
            const apiResponse = response as ApiResponse<Player>;
            return apiResponse?.data || null;
        } else {
            const allGameData = response as AllGameData;
            return allGameData?.worldSetting?.player || null;
        }
    },

    // 从API响应中提取NPC数据（兼容两种模式）
    // worldInteraction: ApiResponse<NPC> -> response.data
    // visual: AllGameData -> response.npcSetting.npcs
    extractNpc: (
        response: ApiResponse<NPC> | AllGameData,
        mode: string,
        npcId?: string
    ): NPC | null => {
        if (mode === 'worldInteraction') {
            const apiResponse = response as ApiResponse<NPC>;
            return apiResponse?.data || null;
        } else {
            const allGameData = response as AllGameData;
            const npcSetting = allGameData?.npcSetting;
            if (npcId && npcSetting?.npcs) {
                return npcSetting.npcs.find((n: NPC) => n.id === npcId) || null;
            }
            return npcSetting?.npcs?.[0] || null;
        }
    },

    // 从上传玩家图片的响应中提取图片数据
    // 后端返回扁平结构：UploadPlayerImageResponse { success, message, imagePath, variant }
    // 或 GenerateImgeResponse { success, message, imagePath }
    // 注意：visual 模式下单个图片上传/生成接口也返回扁平结构，只有批量生成全部图片才返回 AllGameData
    extractPlayerImage: (
        response: UploadPlayerImageResponse | GenerateImgeResponse,
        _mode: string
    ): { image: string; images?: { [key: string]: string } } => {
        // 上传/生成接口返回扁平结构，直接访问 imagePath
        return {
            image: response.imagePath || '',
            images: 'variant' in response && response.variant ? { [response.variant]: response.imagePath } : undefined,
        };
    },

    // 从上传NPC图片的响应中提取图片数据
    // 后端返回扁平结构：UploadNpcImageResponse { success, message, imagePath, variant, npcId }
    // 或 GenerateImgeResponse { success, message, imagePath }
    extractNpcImage: (
        response: UploadNpcImageResponse | GenerateImgeResponse,
        _mode: string,
        variant?: string
    ): { imagePath?: string; variant?: string; npcId?: string } | null => {
        if ('imagePath' in response) {
            return {
                imagePath: response.imagePath,
                variant: ('variant' in response ? response.variant : variant) || variant,
                npcId: 'npcId' in response ? response.npcId : undefined,
            };
        }

        return null;
    },
};
