/**
 * 业务逻辑处理函数
 * 提取主要的业务逻辑，降低主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Character, Variation, PendingImage } from './types';
import type { NPC, GenerateImgeResponse } from '../../../api/galgame/EditorData.type';
import { npcToCharacter, playerToCharacter, bumpCacheBust, stringifyPersonalityTags } from './utils';
import type { ApiHelpers } from './apiHelpers';
import { parseResponse } from './apiHelpers';
import type { User } from '../../../api/account/auth.type';
import { auth } from '../../../api/account/authApi';

interface HandlersContext {
    fileId: string;
    mode: string;
    api: ApiHelpers;
    userPoints: number;
    updateUser?: (user: Partial<User>) => void;
    // State setters
    characterData: Character[];
    setCharacterData: React.Dispatch<React.SetStateAction<Character[]>>;
    setActiveCharacterId: React.Dispatch<React.SetStateAction<string>>;
    setIsAddingNew: React.Dispatch<React.SetStateAction<boolean>>;
    setNewCharacterData: React.Dispatch<React.SetStateAction<Character | null>>;
    setIsGeneratingSingleNpcImage: React.Dispatch<React.SetStateAction<boolean>>;
    setGeneratingCharacterId: React.Dispatch<React.SetStateAction<string | null>>;
    setIsGeneratingNpcImages: React.Dispatch<React.SetStateAction<boolean>>;
    setNpcCostPoints: React.Dispatch<React.SetStateAction<number | null>>;
    setNpcCostModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setIsLoadingNpcCost: React.Dispatch<React.SetStateAction<boolean>>;
    // 一键生成结果弹窗
    setNpcResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setNpcGenerationResult: React.Dispatch<React.SetStateAction<{
        generatedCount: number;
        totalCount: number;
        pointsDeducted: number;
        remainingPoints?: number;
    } | null>>;
    // 暂存图片 setters
    setPendingImages: React.Dispatch<React.SetStateAction<{ [characterId: string]: { [variant: string]: PendingImage } }>>;
    setHasUnsavedChanges: (value: boolean) => void;
    // State getters
    activeCharacterId: string;
    isAddingNew: boolean;
    newCharacterData: Character | null;
    pendingImages: { [characterId: string]: { [variant: string]: PendingImage } };
    // 暂存图片 blob URL refs
    pendingImageUrlsRef: React.MutableRefObject<{ [key: string]: string }>;
    onDataChange?: () => void;
}

interface ConfirmEditResult {
    success: boolean;
    characters: Character[];
    activeCharacterId: string;
    savedCharacterId: string | null;
    clearAddState?: boolean;
}

export const createHandlers = (ctx: HandlersContext) => {
    const {
        fileId,
        mode,
        api,
        updateUser,
        characterData,
        setCharacterData,
        setActiveCharacterId,
        setIsAddingNew,
        setNewCharacterData,
        setIsGeneratingSingleNpcImage,
        setGeneratingCharacterId,
        setIsGeneratingNpcImages,
        setNpcCostPoints,
        setNpcCostModalOpen,
        setIsLoadingNpcCost,
        setNpcResultModalOpen,
        setNpcGenerationResult,
        setPendingImages,
        setHasUnsavedChanges,
        activeCharacterId,
        isAddingNew,
        newCharacterData,
        onDataChange,
        pendingImageUrlsRef,
    } = ctx;

    const replaceCharacter = (list: Character[], targetCharacterId: string, nextCharacter: Character): Character[] =>
        list.map((character) => character.id === targetCharacterId ? nextCharacter : character);

    /**
     * 更新角色图片的辅助函数
     */
    const updateCharacterImage = (
        characterId: string,
        imageUrl: string,
        variantName: string,
        variationType?: string,
        variationDescription?: string
    ) => {
        setCharacterData(prev => prev.map(char => {
            if (char.id !== characterId) return char;

            // base 图片更新 portrait，不在 variations 中显示
            if (variantName === 'base') {
                return { ...char, portrait: imageUrl };
            }

            const varIndex = char.variations.findIndex(v => v.label === variantName);
            if (varIndex >= 0) {
                const newVariations = [...char.variations];
                newVariations[varIndex] = { ...newVariations[varIndex], img: imageUrl };
                return { ...char, variations: newVariations };
            } else {
                const newVar: Variation = {
                    id: `v-${Date.now()}`,
                    label: variantName,
                    img: imageUrl,
                    type: variationType || variantName,
                    description: variationDescription,
                };
                return { ...char, variations: [...char.variations, newVar] };
            }
        }));
    };

    /**
     * 设置暂存图片（用于 AI 生成结果或用户上传）
     * 同时更新 characterData 触发 UI 重新渲染
     * @param characterId 角色 ID
     * @param imageData 可以是 URL 字符串、File 对象、Blob、ArrayBuffer（二进制数据）
     * @param variant 变体名称
     */
    const setPendingImage = (
        characterId: string,
        imageData: string | File | Blob | ArrayBuffer,
        variant: string
    ) => {
        let previewUrl: string;
        let file: File | undefined;
        const pendingImageKey = `${characterId}-${variant}`;

        const createOrReplacePendingUrl = (imageFile: File): string => {
            const previousUrl = pendingImageUrlsRef.current[pendingImageKey];
            if (previousUrl) {
                URL.revokeObjectURL(previousUrl);
            }
            const objectUrl = URL.createObjectURL(imageFile);
            pendingImageUrlsRef.current[pendingImageKey] = objectUrl;
            return objectUrl;
        };

        if (typeof imageData === 'string') {
            previewUrl = imageData;
        } else if (imageData instanceof File) {
            file = imageData;
            previewUrl = createOrReplacePendingUrl(file);
        } else if (imageData instanceof Blob) {//
            file = new File([imageData], `generated_${variant}.webp`, { type: imageData.type || 'image/webp' });
            previewUrl = createOrReplacePendingUrl(file);
        } else if (imageData instanceof ArrayBuffer) {
            const blob = new Blob([imageData], { type: 'image/webp' });
            file = new File([blob], `generated_${variant}.webp`, { type: 'image/webp' });
            previewUrl = createOrReplacePendingUrl(file);
        } else {
            console.error('无效的图片数据类型');
            return;
        }
        updateCharacterImage(characterId, previewUrl, variant, variant);

        setPendingImages(prev => ({
            ...prev,
            [characterId]: {
                ...(prev[characterId] || {}),
                [variant]: {
                    previewUrl,
                    file,
                    sourceType: file ? 'generate' : 'url',
                    variant,
                }
            }
        }));
        setHasUnsavedChanges(true);
    };

    // 刷新用户积分，确保弹窗/扣除后与后端一致
    const refreshUserPoints = async () => {
        if (!updateUser) return;
        try {
            const resp = await auth.getUserInfo();
            const latestUser = resp.data?.data;
            if (latestUser && typeof latestUser.points === 'number') {
                updateUser({ points: latestUser.points });
            }
        } catch (error) {
            console.error('刷新用户积分失败:', error);
        }
    };

    // 从 API 响应中更新角色数据
    const updateCharacterFromResponse = (responseData: any, characterId: string) => {
        const npc = parseResponse.extractNpc(responseData, mode, characterId);
        if (npc) {
            const updatedCharacter = npcToCharacter(npc, 0);
            setCharacterData(prev => prev.map(char => char.id === characterId ? updatedCharacter : char));
        }
    };

    const normalizePersistedImagePath = (imagePath?: string): string | undefined => {
        if (!imagePath) return undefined;
        const trimmed = imagePath.trim();
        if (!trimmed || trimmed.startsWith('blob:')) {
            return undefined;
        }
        return trimmed;
    };
    const getVariationImageKey = (variation: Pick<Variation, 'type' | 'label'>): string =>
        variation.type && variation.label
            ? `${variation.type}_${variation.label}`
            : variation.label || variation.type || '';

    const parseVariantKey = (variantKey: string): { type: string; label: string } => {
        if (!variantKey.includes('_')) {
            return { type: 'expression', label: variantKey };
        }
        const [variantType, ...rest] = variantKey.split('_');
        return {
            type: variantType || 'expression',
            label: rest.join('_') || variantKey,
        };
    };

    const splitIdentity = (identity: string, fallbackRole?: string): { race?: string; job?: string } => {
        const identityParts = identity.split(/\s*·\s*/);
        if (identityParts.length > 1) {
            return { race: identityParts[0], job: identityParts[1] };
        }
        return { race: undefined, job: identityParts[0] || fallbackRole };
    };

    const buildCharacterImages = (
        character: Character,
        options?: { normalize?: boolean; includeEmptyBase?: boolean }
    ): { [key: string]: string } => {
        const { normalize = false, includeEmptyBase = false } = options || {};
        const images: { [key: string]: string } = {};
        const baseImage = normalize
            ? normalizePersistedImagePath(character.portrait)
            : character.portrait?.trim();

        if (baseImage) {
            images.base = baseImage;
        } else if (includeEmptyBase) {
            images.base = '';
        }

        character.variations
            .filter(v => v.label !== 'base')
            .forEach(variation => {
                const variationImage = normalize
                    ? normalizePersistedImagePath(variation.img)
                    : variation.img?.trim();
                const key = getVariationImageKey(variation);
                if (variationImage && key) {
                    images[key] = variationImage;
                }
            });

        return images;
    };

    // 确认修改/新增角色 - 不管是用户上传还是 AI 生成，都统一调用存储接口
    // const uploadImage = async (
    //     imageUrl: string | undefined,
    //     characterId: string,
    //     variant: string
    // ): Promise<string | undefined> => {
    //     if (!imageUrl) {
    //         return undefined;
    //     }

    //     try {
    //         // 从 pendingImages 中获取文件
    //         const pendingImage = pendingImages[characterId]?.[variant];
    //         if (!pendingImage?.file) {
    //             console.warn(`未找到 ${characterId}-${variant} 的暂存图片文件`);
    //             return imageUrl;
    //         }

    //         const file = pendingImage.file;
    //         toast.loading('正在存储图片...', { id: 'uploading-image' });

    //         // 调用对应的上传 API
    //         let response;
    //         if (characterId === 'player') {
    //             response = await api.uploadPlayerImage(fileId, file, variant);
    //         } else {
    //             const npcId = characterId.startsWith('temp-') ? `npc_${Date.now()}` : characterId;
    //             response = await api.uploadNpcImage(fileId, npcId, file, variant);
    //         }

    //         toast.dismiss('uploading-image');

    //         if (response.data?.success) {
    //             // 从响应中提取服务器返回的图片路径
    //             const serverPath = response.data.imagePath;
    //             if (serverPath) {
    //                 return serverPath;
    //             }
    //         }
    //         toast.error('图片存储失败');
    //         return imageUrl;
    //     } catch (error) {
    //         console.error('存储图片失败:', error);
    //         toast.dismiss('uploading-image');
    //         toast.error('图片存储失败，请重试');
    //         return imageUrl;
    //     }
    // };

    // 确认修改/新增角色
    const confirmEdit = async (characterToSave: Character): Promise<ConfirmEditResult> => {
        const failResult: ConfirmEditResult = {
            success: false,
            characters: characterData,
            activeCharacterId,
            savedCharacterId: null,
        };

        if (!fileId || !characterToSave) {
            toast.error('缺少必要数据，无法保存修改');
            return failResult;
        }

        // 主角资料保存
        if (characterToSave.id === 'player') {
            const persistedBaseImage = normalizePersistedImagePath(characterToSave.portrait);
            const images = buildCharacterImages(characterToSave, { normalize: true });

            const playerData = {
                name: characterToSave.name || '',
                callName: characterToSave.callName || '',
                gender: characterToSave.gender || '',
                race: characterToSave.identity || undefined,
                appearance: characterToSave.appearance || '',
                personality: stringifyPersonalityTags(characterToSave.personality) || undefined,
                tone: characterToSave.speech || undefined,
                // 过滤 blob 预览地址，仅提交可持久化图片路径
                background: characterToSave.background || undefined,
                image: persistedBaseImage,
                images: Object.keys(images).length > 0 ? images : undefined,
            };

            try {
                const response = await api.updatePlayer(fileId, playerData as any);
                if (!response.data?.success) {
                    toast.error('更新主角信息失败');
                    return failResult;
                }

                toast.success('主角信息更新成功');
                const p = parseResponse.extractPlayer(response.data, mode);
                if (p) {
                    const nextPlayer = playerToCharacter(p);
                    return {
                        success: true,
                        characters: replaceCharacter(characterData, 'player', nextPlayer),
                        activeCharacterId: 'player',
                        savedCharacterId: 'player',
                    };
                }
                return {
                    success: true,
                    characters: replaceCharacter(characterData, 'player', characterToSave),
                    activeCharacterId: 'player',
                    savedCharacterId: 'player',
                };
            } catch (error) {
                console.error('更新主角信息时出错:', error);
                toast.error('更新主角信息失败，请重试');
                return failResult;
            }
        }

        // NPC 资料保存
        const { race, job } = splitIdentity(characterToSave.identity, characterToSave.role);
        const images = buildCharacterImages(characterToSave, { normalize: true });

        const finalImages: { [key: string]: string } | undefined = Object.keys(images).length > 0 ? images : undefined;
        const playerRelationship = characterToSave.relationships.find(
            r => r.name === '玩家' || r.name.toLowerCase().includes('player'),
        );

        const npcData: NPC & { callName?: string } = {
            id: characterToSave.id.startsWith('temp-') ? `npc_${Date.now()}` : characterToSave.id,
            name: characterToSave.name || '',
            callName: characterToSave.callName || '',
            gender: characterToSave.gender || '',
            job: job || undefined,
            race: race || undefined,
            description: characterToSave.background || ' ',
            appearance: characterToSave.appearance || '',
            personality: stringifyPersonalityTags(characterToSave.personality) || undefined,
            tone: characterToSave.speech || '',
            relationship: playerRelationship?.description || undefined,
            images: finalImages,
        };

        try {
            const response = isAddingNew
                ? await api.addNpc(fileId, npcData)
                : await api.updateNpc(fileId, npcData);

            if (!response.data?.success) {
                toast.error(isAddingNew ? '创建角色失败' : '更新角色失败');
                return failResult;
            }

            toast.success(isAddingNew ? '角色创建成功' : '角色更新成功');
            const finalNpcId = npcData.id;
            const npc = parseResponse.extractNpc(response.data, mode, finalNpcId);

            if (npc) {
                const newCharacter = npcToCharacter(npc, 0);
                if (isAddingNew) {
                    return {
                        success: true,
                        characters: [newCharacter, ...characterData],
                        activeCharacterId: newCharacter.id,
                        savedCharacterId: newCharacter.id,
                        clearAddState: true,
                    };
                }
                return {
                    success: true,
                    characters: replaceCharacter(characterData, finalNpcId, newCharacter),
                    activeCharacterId: newCharacter.id,
                    savedCharacterId: newCharacter.id,
                };
            }

            if (!isAddingNew) {
                updateCharacterFromResponse(response.data, finalNpcId);
                const optimisticCharacter: Character = {
                    ...characterToSave,
                    id: finalNpcId,
                };
                return {
                    success: true,
                    characters: replaceCharacter(characterData, finalNpcId, optimisticCharacter),
                    activeCharacterId: finalNpcId,
                    savedCharacterId: finalNpcId,
                };
            }

            const createdCharacter: Character = {
                ...characterToSave,
                id: finalNpcId,
            };
            return {
                success: true,
                characters: [createdCharacter, ...characterData],
                activeCharacterId: finalNpcId,
                savedCharacterId: finalNpcId,
                clearAddState: true,
            };
        } catch (error) {
            toast.error(isAddingNew ? '创建角色失败，请重试' : '更新角色失败，请重试');
            return failResult;
        }
    };

    const handleConfirmDelete = async (characterToDelete: string) => {
        if (!characterToDelete || !fileId) {
            return;
        }

        if (characterToDelete === 'player') {
            toast.error('不能删除玩家角色');
            return;
        }

        try {
            const response = await api.deleteNpc(fileId, characterToDelete);
            if (response.data?.success) {
                setCharacterData(prev => {
                    const filtered = prev.filter(char => char.id !== characterToDelete);
                    if (characterToDelete === activeCharacterId) {
                        if (filtered.length > 0) {
                            setActiveCharacterId(filtered[0].id);
                        } else {
                            setActiveCharacterId('');
                        }
                    }
                    return filtered;
                });
                toast.success('角色删除成功');
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('删除角色失败');
            }
        } catch (error) {
            console.error('删除角色时出错:', error);
            toast.error('删除角色失败，请重试');
        }
    };

    // 创建新NPC（用于新增模式下上传图片前先创建角色）
    const createNewNpcForUpload = async (): Promise<string | null> => {
        if (!fileId || !newCharacterData) {
            return null;
        }

        const targetCharacterId = `npc_${Date.now()}`;
        const { race, job } = splitIdentity(newCharacterData.identity, newCharacterData.role);
        const images = buildCharacterImages(newCharacterData, { includeEmptyBase: true });

        const finalImages: { [key: string]: string } | undefined =
            newCharacterData.portrait || Object.keys(images).length > 1 ? images : undefined;

        const playerRelationship = newCharacterData.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

        const newNpc: NPC & { callName?: string } = {
            id: targetCharacterId,
            name: newCharacterData.name || '未命名角色',
            callName: newCharacterData.callName || '',
            gender: newCharacterData.gender || '',
            job: job || undefined,
            race: race || undefined,
            description: newCharacterData.background || '暂无描述',
            appearance: newCharacterData.appearance || '',
            personality: stringifyPersonalityTags(newCharacterData.personality) || undefined,
            tone: newCharacterData.speech || '',
            relationship: playerRelationship?.description || undefined,
            images: finalImages,
        };

        try {
            const createResponse = await api.addNpc(fileId, newNpc);
            if (!createResponse.data?.success) {
                toast.error('创建角色失败，无法上传图片');
                return null;
            }

            const createdCharacter: Character = {
                ...newCharacterData,
                id: targetCharacterId,
            };
            setCharacterData(prev => [createdCharacter, ...prev]);
            setActiveCharacterId(targetCharacterId);
            setIsAddingNew(false);
            setNewCharacterData(null);
            return targetCharacterId;
        } catch (error) {
            console.error('创建角色时出错:', error);
            toast.error('创建角色失败，请重试');
            return null;
        }
    };

    // 统一的上传图片方法
    const handleUploadImage = async (
        file: File,
        options: {
            type: 'player' | 'npc' | 'variation';
            characterId?: string | null;
            variant?: string;
            inputRef?: React.RefObject<HTMLInputElement | null> | { current: HTMLInputElement | null };
        }
    ): Promise<boolean> => {
        const validateFile = (file: File): boolean => {
            if (!file.type.startsWith('image/')) {
                toast.error('请选择图片文件');
                return false;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error('图片大小不能超过 5MB');
                return false;
            }
            return true;
        };

        if (!validateFile(file)) {
            return false;
        }

        if (!fileId) {
            toast.error('缺少文件ID，无法上传');
            return false;
        }

        const { type, characterId, variant = 'base', inputRef } = options;

        try {
            let response;
            let targetCharacterId: string | undefined = characterId || undefined;

            // 新增流程下上传 NPC 图片前先落库角色
            if (type === 'npc' && isAddingNew && newCharacterData && !targetCharacterId) {
                const newId = await createNewNpcForUpload();
                if (!newId) {
                    return false;
                }
                targetCharacterId = newId;
            }

            if (type === 'player' || (type === 'variation' && targetCharacterId === 'player')) {
                response = await api.uploadPlayerImage(fileId, file, variant);
            } else if (type === 'npc' || type === 'variation') {
                if (!targetCharacterId) {
                    toast.error('缺少角色ID，无法上传');
                    return false;
                }
                response = await api.uploadNpcImage(fileId, targetCharacterId, file, variant);
            } else {
                toast.error('未知的上传类型');
                return false;
            }

            if (!response.data?.success) {
                toast.error('上传失败，请重试');
                return false;
            }

                // 如果是玩家图片，更新 portrait 或 variations
            if ((type === 'player' || (type === 'variation' && targetCharacterId === 'player')) && !isAddingNew) {
                const { image: playerImage, images: playerImages } = parseResponse.extractPlayerImage(response.data, mode);

                if (variant === 'base') {
                        const newPortrait = (playerImages && playerImages.base) || playerImage;
                        if (newPortrait) {
                            setCharacterData(prev =>
                                prev.map(char =>
                                    char.id === 'player'
                                        ? { ...char, portrait: newPortrait }
                                        : char
                                )
                            );
                            // 手动刷新缓存，强制浏览器重新加载图片
                            bumpCacheBust(newPortrait);
                        } else {
                            // 如果无法提取图片数据，触发数据刷新以获取最新数据
                            if (onDataChange) {
                                onDataChange();
                            }
                        }
                    } else {
                        // 差分图片：解析 type_label 格式的 variant（如 expression_伤心）
                        const { type: finalType, label: finalLabel } = parseVariantKey(variant);
                        const variantImg = (playerImages && playerImages[variant]) || playerImage;
                        if (variantImg) {
                            setCharacterData(prev =>
                                prev.map(char => {
                                    if (char.id !== 'player') return char;
                                    const existingVarIndex = char.variations.findIndex(v => v.label === finalLabel);
                                    if (existingVarIndex >= 0) {
                                        const newVariations = [...char.variations];
                                        newVariations[existingVarIndex] = {
                                            ...newVariations[existingVarIndex],
                                            img: variantImg,
                                        };
                                        bumpCacheBust(variantImg);
                                        return { ...char, variations: newVariations };
                                    } else {
                                        const newVar: Variation = {
                                            id: `v-${Date.now()}`,
                                            label: finalLabel,
                                            img: variantImg,
                                            type: finalType,
                                        };
                                        return { ...char, variations: [...char.variations, newVar] };
                                    }
                                })
                            );
                        } else {
                            // 如果无法提取图片数据，触发数据刷新以获取最新数据
                            if (onDataChange) {
                                onDataChange();
                            }
                        }
                    }
                }

                // 如果是NPC图片（基础立绘或差分），使用返回的数据更新本地状态
                if ((type === 'npc' || (type === 'variation' && targetCharacterId !== 'player')) && targetCharacterId && !isAddingNew) {
                    const imageData = parseResponse.extractNpcImage(response.data, mode, variant);
                    if (imageData?.imagePath) {
                        const imageUrl = imageData.imagePath;
                        if (variant === 'base') {
                            updateCharacterImage(targetCharacterId, imageUrl, 'base');
                            // 同步其他差分图片
                            if (imageData.allVariants) {
                                for (const [variantKey, variantUrl] of Object.entries(imageData.allVariants)) {
                                    if (variantKey !== 'base') {
                                        // 解析 variantKey 获取 type 和 label
                                        const { type: finalType, label: finalLabel } = parseVariantKey(variantKey);
                                        updateCharacterImage(targetCharacterId, variantUrl, finalLabel, finalType);
                                    }
                                }
                            }
                            bumpCacheBust(imageUrl);
                        } else {
                            // 上传图片时，处理 type_label 格式的 variant（如 expression_伤心）
                            // 解析 variant 获取 type 和 label
                            const { type: finalType, label: finalValue } = parseVariantKey(variant);
                            updateCharacterImage(targetCharacterId, imageUrl, finalValue, finalType);
                            // 同步 base 图片（如果有）
                            if (imageData.allVariants?.base) {
                                updateCharacterImage(targetCharacterId, imageData.allVariants.base, 'base');
                            }
                            bumpCacheBust(imageUrl);
                        }
                    } else {
                        // 如果无法提取图片数据，使用后端返回的完整数据进行更新
                        updateCharacterFromResponse(response.data, targetCharacterId);
                    }
                }

            return true;
        } catch (error) {
            console.error('上传图片失败:', error);
            toast.error('上传图片失败，请重试');
            return false;
        } finally {
            if (inputRef && 'current' in inputRef && inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    const regenerateNpcImage = async (npc: Character) => {
        if (!fileId || !npc) {
            return;
        }
        try {
            setIsGeneratingSingleNpcImage(true);
            setGeneratingCharacterId(npc.id);
            const response = await api.generateNpcImage(fileId, npc.id);
            if (response.data?.success && response.data.blob) {
                toast.success('NPC图片生成成功，请在确认修改后保存');

                // 直接使用返回的 blob 数据
                setPendingImage(npc.id, response.data.blob, 'base');
            } else {
                toast.error(response.data?.message || '当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            toast.error('重新生成NPC图片失败，请检查网络连接');
        } finally {
            setIsGeneratingSingleNpcImage(false);
            setGeneratingCharacterId(null);
        }
    };

    // 重新生成玩家图片（改为暂存模式）
    const regeneratePlayerImage = async (playerChar: Character) => {
        if (!fileId || !playerChar) return;
        try {
            setIsGeneratingSingleNpcImage(true);
            setGeneratingCharacterId(playerChar.id);
            const response = await api.generatePlayerImage(fileId);
            if (response.data?.success && response.data.blob) {
                toast.success('主角图片生成成功，请在确认修改后保存');

                // 直接使用返回的 blob 数据
                setPendingImage('player', response.data.blob, 'base');
            } else {
                toast.error(response.data?.message || '当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            toast.error('重新生成主角图片失败，请检查网络连接');
        } finally {
            setIsGeneratingSingleNpcImage(false);
            setGeneratingCharacterId(null);
        }
    };

    // 重新生成差分图片（改为暂存模式）
    const regenerateVariationImage = async (variation: Variation, currentCharacter: Character | null) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error('缺少必要数据，无法生成');
            return;
        }

        if (!currentCharacter.portrait) {
            toast.error('请先上传角色基础立绘');
            return;
        }

        try {
            const variantRequest = {
                type: (variation.type || 'expression') as 'expression' | 'clothing' | 'pose',
                value: variation.label,
                description: variation.description,
            };
            const response = await api.generateVariantImage(
                fileId,
                currentCharacter.id === 'player' ? 'player' : currentCharacter.id,
                variantRequest
            );

            const imageResponse = response.data as GenerateImgeResponse;
            if (imageResponse?.success && imageResponse.imagePath) {
                toast.success('差分图片生成成功');

                // 直接使用返回的 imagePath 更新角色数据
                const newVariation: Variation = {
                    id: `${Date.now()}`,
                    type: (variation.type || 'expression') as 'expression' | 'clothing' | 'pose',
                    label: variation.label,
                    description: variation.description,
                    img: imageResponse.imagePath,
                };
                setCharacterData(prev => prev.map(char => {
                    if (char.id !== currentCharacter.id) return char;
                    const existingIndex = char.variations.findIndex(v => v.label === variation.label);
                    if (existingIndex >= 0) {
                        const updatedVariations = [...char.variations];
                        updatedVariations[existingIndex] = newVariation;
                        return { ...char, variations: updatedVariations };
                    }
                    return { ...char, variations: [...char.variations, newVariation] };
                }));
            } else {
                toast.error(response.data?.message || '当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            toast.error('生成差分图片失败，请检查网络连接');
        }
    };

    // 删除差分图片
    const deleteVariationImage = async (variation: Variation, currentCharacter: Character | null) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error('缺少必要数据，无法删除差分');
            return;
        }

        try {
            let response;
            if (currentCharacter.id === 'player') {
                response = await api.deletePlayerImageVariant(fileId, variation.label);
            } else {
                response = await api.deleteVariantImage(fileId, currentCharacter.id, variation.label);
            }

            if (response.data?.success) {
                setCharacterData(prev => prev.map(char => {
                    if (char.id !== currentCharacter.id) return char;
                    return {
                        ...char,
                        variations: char.variations.filter(v => v.id !== variation.id),
                    };
                }));
                toast.success('差分删除成功');
            } else {
                toast.error('删除差分失败');
            }
        } catch (error) {
            console.error('删除差分失败:', error);
            toast.error('删除差分失败，请稍后重试');
        }
    };

    // 批量生成所有NPC图片
    const generateAllNpcImages = async (npcCostPoints: number | null) => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsGeneratingNpcImages(true);
            const response = await api.generateAllNpcImages(fileId);
            if (response.data?.success) {
                const respAny: any = response.data;
                const payload = respAny.data || respAny;

                // 从 results 中获取新的字段
                const npcsTotalRaw = Number(payload?.npcs?.total ?? 0);
                const npcsTotal = Number.isFinite(npcsTotalRaw) ? Math.max(0, npcsTotalRaw) : 0;
                const playerTotalRaw = Number(payload?.player?.total ?? 0);
                const playerTotal = Number.isFinite(playerTotalRaw) ? Math.max(0, playerTotalRaw) : 0;
                const totalCount = npcsTotal + playerTotal;

                const npcsEffectiveRaw = Number(
                    payload?.npcs?.effective ?? 0
                );
                const npcsEffective = Number.isFinite(npcsEffectiveRaw) ? Math.max(0, npcsEffectiveRaw) : 0;
                const playerEffectiveRaw = Number(payload?.player?.effective ?? 0);
                const playerEffective = Number.isFinite(playerEffectiveRaw) ? Math.max(0, playerEffectiveRaw) : 0;
                const generatedRaw = payload?.npcs || payload?.player ? npcsEffective + playerEffective : npcsEffective;
                const generatedCount = totalCount > 0 ? Math.min(generatedRaw, totalCount) : generatedRaw;

                const pointsDeductedRaw = Number(
                    payload?.points?.deducted ?? npcCostPoints ?? 0
                );
                const pointsDeducted = Number.isFinite(pointsDeductedRaw) ? Math.max(0, pointsDeductedRaw) : 0;

                const remainingPointsRaw = payload?.points?.remaining;
                const remainingPointsValue = Number(remainingPointsRaw);
                const remainingPoints = Number.isFinite(remainingPointsValue)
                    ? Math.max(0, remainingPointsValue)
                    : undefined;

                // 弹出结果弹窗
                setNpcGenerationResult({
                    generatedCount,
                    totalCount,
                    pointsDeducted,
                    remainingPoints,
                });
                setNpcResultModalOpen(true);
                if (onDataChange) {
                    onDataChange();
                }
                await refreshUserPoints();
            } else {
                toast.error('当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            toast.error('生成所有角色立绘失败，请检查网络连接');
        } finally {
            setIsGeneratingNpcImages(false);
        }
    };

    // 打开积分确认弹窗
    const openNpcCostModal = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsLoadingNpcCost(true);
            const response = await api.calculateNpcPoints(fileId);
            if(response.data){
                const points = response.data.points;
                setNpcCostPoints(points);
                setNpcCostModalOpen(true);
            }
        } catch (error) {
            console.error('获取角色生图积分消耗失败:', error);
            toast.error('获取积分消耗失败，请稍后重试');
        } finally {
            setIsLoadingNpcCost(false);
        }
    };

    return {
        confirmEdit,
        handleConfirmDelete,
        handleUploadImage,
        regenerateNpcImage,
        regeneratePlayerImage,
        regenerateVariationImage,
        deleteVariationImage,
        generateAllNpcImages,
        openNpcCostModal,
        updateCharacterFromResponse,
    };
};



