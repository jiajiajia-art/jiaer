/**
 * API调用辅助函数
 * 统一封装两种模式的API调用差异，消除mode判断
 */
import EditorApi from '../../../api/galgame/EditorData';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import type { NPC, Player } from '../../../api/galgame/EditorData.type';

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

        generatePlayerImage: async (fileId: string, player: any, removeBg: boolean = false) => {
            return EditorApi.generatePlayerImage({
                fileId,
                player,
                removeBg,
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

        generateNpcImage: async (fileId: string, npc: any, removeBg: boolean = false) => {
            return EditorApi.generateNpcImage({
                fileId,
                npc,
                removeBg,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // 批量操作
        generateAllNpcImages: async (fileId: string) => {
            return isWorldInteraction
                ? worldEditor.generateAllNpcImages(fileId)
                : EditorApi.generateAllImages({
                    fileId,
                    generateNPCs: true,
                    generateScenes: false,
                    generateVariants: false,
                    generatePlayer: false,
                    removeBg: false,
                });
        },

        calculateNpcPoints: async (fileId: string) => {
            return isWorldInteraction
                ? worldEditor.calculateNpcPoints(fileId)
                : EditorApi.calculateNpcPoints(fileId);
        },

        // 差分相关
        generateVariantImage: async (fileId: string, npcId: string, baseImagePath: string, variant: any, removeBg: boolean = false) => {
            return EditorApi.generateVariantImage({
                fileId,
                npcId: npcId === 'player' ? 'player' : npcId,
                baseImagePath,
                variant,
                removeBg,
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
 */
export const parseResponse = {
    // 从API响应中提取玩家数据（兼容两种模式）
    extractPlayer: (response: any, mode: string): any => {
        if (mode === 'worldInteraction') {
            return response?.data;
        } else {
            return response?.worldSetting?.player;
        }
    },

    // 从API响应中提取NPC数据（兼容两种模式）
    extractNpc: (response: any, mode: string, npcId?: string): any => {
        if (mode === 'worldInteraction') {
            return response?.data;
        } else {
            const npcSetting = response?.npcSetting;
            if (npcId && npcSetting?.npcs) {
                return npcSetting.npcs.find((n: any) => n.id === npcId);
            }
            return npcSetting?.npcs?.[0];
        }
    },

    // 从上传玩家图片的响应中提取图片数据
    extractPlayerImage: (response: any, mode: string): { image: string; images?: { [key: string]: string } } => {
        const responseAny = response as any;
        
        if (mode === 'worldInteraction') {
            const player = responseAny?.data;
            return {
                image: player?.image || player?.imagePath || responseAny?.imagePath || '',
                images: player?.images,
            };
        } else {
            const worldSetting = responseAny?.worldSetting;
            return {
                image: worldSetting?.player?.image || worldSetting?.player?.imagePath || '',
                images: worldSetting?.player?.images,
            };
        }
    },

    // 从上传NPC图片的响应中提取图片数据（worldInteraction模式）
    extractNpcImage: (response: any, mode: string, variant?: string): { imagePath?: string; variant?: string; npcId?: string } | null => {
        if (mode === 'worldInteraction') {
            const responseData = response as any;
            return {
                imagePath: responseData?.imagePath || responseData?.data?.imagePath,
                variant: responseData?.variant || responseData?.data?.variant || variant,
                npcId: responseData?.npcId || responseData?.data?.npcId,
            };
        }
        return null; // visual模式返回完整数据，不需要单独提取
    },
};

