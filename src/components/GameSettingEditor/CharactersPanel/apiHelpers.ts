/**
 * API调用辅助函数
 * 统一封装两种模式的API调用差异，消除mode判断
 */
import EditorApi from '../../../api/galgame/EditorData';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import type { NPC, Player, GenerateVariantImageRequest } from '../../../api/galgame/EditorData.type';
import type { UploadPlayerImageResponse, UploadNpcImageResponse } from '../../../api/worldInteraction/worldEditor.type';
import type { GenerateImgeResponse } from '../../../api/galgame/EditorData.type';
import type { PlayerCharacter as WIPlayer, NPC as WINPC } from '../../../api/worldInteraction/worldInteractionApi.type';

export type ApiHelpers = ReturnType<typeof createApiHelpers>;

export const createApiHelpers = (mode: string) => {
    const isWorldInteraction = mode === 'worldInteraction';    

    return {
        // 玩家相关
        updatePlayer: async (fileId: string, data: Player) => {
            if (isWorldInteraction) {
                // 将 Galgame 的 Player 转换为 WI 的 PlayerCharacter
                const wiPlayerData: Partial<WIPlayer> = {
                    ...data,
                    age: data.age || 0,
                    gender: data.gender || '',
                    personality: data.personality || '',
                    appearance: data.appearance || '',
                    tone: data.tone || '',
                    images: typeof data.images === 'string' ? data.images : (data.image || ''),
                };
                
                // 只有当 data 中确实存在 attributes 时才传递，避免覆盖后端数据
                if ((data as any).attributes) {
                    wiPlayerData.attributes = (data as any).attributes;
                }
                
                return worldEditor.updatePlayer(fileId, wiPlayerData);
            }
            return EditorApi.updatePlayer(fileId, data);
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
            if (isWorldInteraction) {
                const wiNpcData: WINPC = {
                    ...data,
                    age: data.age || 0,
                    description: data.description || '',
                    appearance: data.appearance || '',
                    personality: data.personality || '',
                    tone: data.tone || '',
                    images: {
                        base: typeof data.images === 'string' ? data.images : (data as any).image || '',
                        ...(typeof data.images === 'object' ? data.images : {}),
                    },
                };
                
                if ((data as any).attributes) {
                    wiNpcData.attributes = (data as any).attributes;
                }

                return worldEditor.addNpc(fileId, wiNpcData);
            }
            return EditorApi.addNpc(fileId, data);
        },

        updateNpc: async (fileId: string, data: NPC) => {
            if (isWorldInteraction) {
                const wiNpcData: Partial<WINPC> = {
                    ...data,
                    age: data.age || 0,
                    description: data.description || '',
                    appearance: data.appearance || '',
                    personality: data.personality || '',
                    tone: data.tone || '',
                    images: {
                        base: typeof data.images === 'string' ? data.images : (data as any).image || '',
                        ...(typeof data.images === 'object' ? data.images : {}),
                    },
                };

                if ((data as any).attributes) {
                    wiNpcData.attributes = (data as any).attributes;
                }

                return worldEditor.updateNpc(fileId, wiNpcData);
            }
            return EditorApi.updateNpc(fileId, data);
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

        generateNpcImage: async (fileId: string, npcId: string) => {
            return EditorApi.generateNpcImage(fileId, npcId, {
                removeBg: true,
                pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
            });
        },

        // 批量操作
        generateAllNpcImages: async (fileId: string) => {
            return EditorApi.generateAllImages(fileId, {
                    generateNPCs: true,
                    generateScenes: false,
                    generateVariants: false,
                    generatePlayer: true,
                    removeBg: true,
                    pluginType: isWorldInteraction ? 'world-interaction' : 'visual',
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

        deleteVariantImage: async (fileId: string, npcId: string, variant: string) => {
            return EditorApi.deleteVariantImage(fileId, npcId, variant);
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
 */
export const parseResponse = {
    extractPlayer: (
        response: any,
        mode: string
    ): any => {
        if (mode === 'worldInteraction') {
            return response?.data || null;
        } else {
            return response?.worldSetting?.player || null;
        }
    },

    extractNpc: (
        response: any,
        mode: string,
        npcId?: string
    ): any => {
        if (mode === 'worldInteraction') {
            return response?.data || null;
        } else {
            const npcSetting = response?.npcSetting;
            if (npcId && npcSetting?.npcs) {
                return npcSetting.npcs.find((n: any) => n.id === npcId) || null;
            }
            return npcSetting?.npcs?.[0] || null;
        }
    },

    extractPlayerImage: (
        response: UploadPlayerImageResponse | GenerateImgeResponse,
        _mode: string
    ): { image: string; images?: { [key: string]: string } } => {
        return {
            image: response.imagePath || '',
            images: 'variant' in response && response.variant ? { [response.variant]: response.imagePath } : undefined,
        };
    },

    extractNpcImage: (
        response: UploadNpcImageResponse | GenerateImgeResponse | any,
        _mode: string,
        variant?: string,
        expectedType?: string,
        expectedValue?: string
    ): { imagePath?: string; variant?: string; variantKey?: string; npcId?: string } | null => {
        if (response.images && typeof response.images === 'object') {
            let variantKey: string | null = null;
            let imagePath: string | undefined = undefined;

            if (variant === 'base' && response.images.base) {
                variantKey = 'base';
                imagePath = response.images.base;
            }
            else if (expectedType && expectedValue) {
                const expectedKey = `${expectedType}_${expectedValue}`;
                if (response.images[expectedKey]) {
                    variantKey = expectedKey;
                    imagePath = response.images[expectedKey];
                } else {
                    variantKey = Object.keys(response.images).find(key => {
                        const parts = key.split('_');
                        return parts.length >= 2 && parts[0] === expectedType && parts.slice(1).join('_') === expectedValue;
                    }) || null;
                    if (variantKey) {
                        imagePath = response.images[variantKey];
                    }
                }
            } else {
                if (response.images.base) {
                    variantKey = 'base';
                    imagePath = response.images.base;
                } else {
                    variantKey = Object.keys(response.images).find(key => key !== 'base') || null;
                    if (variantKey) {
                        imagePath = response.images[variantKey];
                    }
                }
            }

            if (variantKey && imagePath) {
                return {
                    imagePath,
                    variant: variantKey,
                    variantKey,
                    npcId: 'npcId' in response ? response.npcId : undefined,
                };
            }
        }

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
