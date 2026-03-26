/**
 * 业务逻辑处理函数
 * 提取主要的业务逻辑，降低主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Character, Variation, PendingImage } from './types';
import type { NPC } from '../../../api/galgame/EditorData.type';
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
    // 暂存图片 setters
    setPendingImages: React.Dispatch<React.SetStateAction<{ [characterId: string]: { [variant: string]: PendingImage } }>>;
    setHasUnsavedChanges: (value: boolean) => void;
    // State getters
    activeCharacterId: string;
    isAddingNew: boolean;
    newCharacterData: Character | null;
    onDataChange?: () => void;
}

export const createHandlers = (ctx: HandlersContext) => {
    const {
        fileId,
        mode,
        api,
        // userPoints,
        updateUser,
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
        setPendingImages,
        setHasUnsavedChanges,
        activeCharacterId,
        isAddingNew,
        newCharacterData,
        onDataChange,
    } = ctx;

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
     * 设置暂存图片（用于 AI 生成结果）
     * 同时更新 characterData 触发 UI 重新渲染
     */
    const setPendingImageFromUrl = (
        characterId: string,
        imageUrl: string,
        variant: string
    ) => {
        // 同时更新 characterData，触发 UI 重新渲染
        setCharacterData(prev => prev.map(char => {
            if (char.id !== characterId) return char;

            // base 图片更新 portrait
            if (variant === 'base') {
                return { ...char, portrait: imageUrl };
            }

            // 差分图片更新 variations
            const varIndex = char.variations.findIndex(v => v.label === variant);
            if (varIndex >= 0) {
                const newVariations = [...char.variations];
                newVariations[varIndex] = { ...newVariations[varIndex], img: imageUrl };
                return { ...char, variations: newVariations };
            } else {
                // 如果找不到差分，先添加一个占位差分
                const newVar: Variation = {
                    id: `v-${Date.now()}`,
                    label: variant,
                    img: imageUrl,
                    type: variant,
                };
                return { ...char, variations: [...char.variations, newVar] };
            }
        }));

        // 更新暂存图片（用于确认/取消时恢复原值）
        setPendingImages(prev => ({
            ...prev,
            [characterId]: {
                ...(prev[characterId] || {}),
                [variant]: {
                    previewUrl: imageUrl,
                    sourceType: 'generate',
                    variant,
                }
            }
        }));
        // 标记有未保存修改
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

    // 过滤本地 blob 预览地址，避免提交时覆盖后端正式图片路径
    const normalizePersistedImagePath = (imagePath?: string): string | undefined => {
        if (!imagePath) return undefined;
        const trimmed = imagePath.trim();
        if (!trimmed || trimmed.startsWith('blob:')) {
            return undefined;
        }
        return trimmed;
    };

    // 确认修改/新增角色
    const confirmEdit = async (characterToSave: Character): Promise<boolean> => {
        if (!fileId || !characterToSave) {
            toast.error('缺少必要数据，无法保存修改');
            return false;
        }

        // 主角资料保存
        if (characterToSave.id === 'player') {
            const persistedBaseImage = normalizePersistedImagePath(characterToSave.portrait);
            const images: { [key: string]: string } = {};
            if (persistedBaseImage) {
                images.base = persistedBaseImage;
            }

            characterToSave.variations
                .filter(v => v.label !== 'base')
                .forEach(variation => {
                    const persistedVariationImage = normalizePersistedImagePath(variation.img);
                    if (persistedVariationImage) {
                        const key = variation.type && variation.label
                            ? `${variation.type}_${variation.label}`
                            : variation.label || variation.type || '';
                        if (key) {
                            images[key] = persistedVariationImage;
                        }
                    }
                });

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
                    return false;
                }

                toast.success('主角信息更新成功');
                const p = parseResponse.extractPlayer(response.data, mode);
                if (p) {
                    setCharacterData(prev => prev.map(char => char.id === 'player' ? playerToCharacter(p) : char));
                }
                return true;
            } catch (error) {
                console.error('更新主角信息时出错:', error);
                toast.error('更新主角信息失败，请重试');
                return false;
            }
        }

        // NPC 资料保存
        const identityParts = characterToSave.identity.split(/\s*·\s*/);
        const race = identityParts.length > 1 ? identityParts[0] : undefined;
        const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || characterToSave.role);
        const persistedBaseImage = normalizePersistedImagePath(characterToSave.portrait);

        const images: { [key: string]: string } = {};
        if (persistedBaseImage) {
            images.base = persistedBaseImage;
        }

        characterToSave.variations
            .filter(v => v.label !== 'base')
            .forEach(variation => {
                const persistedVariationImage = normalizePersistedImagePath(variation.img);
                if (persistedVariationImage) {
                    const key = variation.type && variation.label
                        ? `${variation.type}_${variation.label}`
                        : variation.label || variation.type || '';
                    if (key) {
                        images[key] = persistedVariationImage;
                    }
                }
            });

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
                return false;
            }

            toast.success(isAddingNew ? '角色创建成功' : '角色更新成功');
            const finalNpcId = npcData.id;
            const npc = parseResponse.extractNpc(response.data, mode, finalNpcId);

            if (npc) {
                const newCharacter = npcToCharacter(npc, 0);
                if (isAddingNew) {
                    setCharacterData(prev => [newCharacter, ...prev]);
                    setActiveCharacterId(newCharacter.id);
                    setIsAddingNew(false);
                    setNewCharacterData(null);
                } else {
                    setCharacterData(prev => prev.map(char => char.id === finalNpcId ? newCharacter : char));
                }
            } else if (!isAddingNew) {
                updateCharacterFromResponse(response.data, finalNpcId);
            }
            return true;
        } catch (error) {
            toast.error(isAddingNew ? '创建角色失败，请重试' : '更新角色失败，请重试');
            return false;
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
        const identityParts = newCharacterData.identity.split(' · ');
        const race = identityParts.length > 1 ? identityParts[0] : undefined;
        const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || newCharacterData.role);

        // 将 variations 转换回 images 对象（variations 中不包含 base，base 存储在 portrait 中）
        // 键名格式：type_value（如 "clothing_happy"）
        const images: { base: string; [key: string]: string } = {
            base: newCharacterData.portrait || '', // base 图片来自 portrait
        };
        newCharacterData.variations
            .filter(v => v.label !== 'base') // 确保不包含 base
            .forEach(variation => {
                if (variation.img) {
                    // 键名格式：type_value
                    const key = variation.type && variation.label 
                        ? `${variation.type}_${variation.label}` 
                        : variation.label || variation.type || '';
                    if (key) {
                        images[key] = variation.img;
                    }
                }
            });

        const finalImages: { base: string; [key: string]: string } | undefined = 
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
            successMessage?: string;
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

        const { type, characterId, variant = 'base', inputRef, successMessage } = options;

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

            if (type === 'player') {
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

            toast.success(successMessage || '图片上传成功');

            if (type === 'player' && !isAddingNew) {
                const { image: playerImage, images: playerImages } = parseResponse.extractPlayerImage(response.data, mode);

                if (variant === 'base') {
                    const newPortrait = (playerImages && playerImages.base) || playerImage;
                    if (newPortrait) {
                        setCharacterData(prev =>
                            prev.map(char =>
                                char.id === 'player'
                                    ? { ...char, portrait: newPortrait }
                                    : char,
                            ),
                        );
                        bumpCacheBust(newPortrait);
                    } else if (onDataChange) {
                        onDataChange();
                    }
                } else {
                    const variantImg = (playerImages && playerImages[variant]) || playerImage;
                    if (variantImg) {
                        setCharacterData(prev =>
                            prev.map(char => {
                                if (char.id !== 'player') return char;

                                const existingVarIndex = char.variations.findIndex(v => v.label === variant);
                                if (existingVarIndex >= 0) {
                                    const newVariations = [...char.variations];
                                    newVariations[existingVarIndex] = {
                                        ...newVariations[existingVarIndex],
                                        img: variantImg,
                                    };
                                    bumpCacheBust(variantImg);
                                    return { ...char, variations: newVariations };
                                }

                                const newVar: Variation = {
                                    id: `v-${Date.now()}`,
                                    label: variant,
                                    img: variantImg,
                                    type: variant,
                                };
                                return { ...char, variations: [...char.variations, newVar] };
                            }),
                        );
                    } else if (onDataChange) {
                        onDataChange();
                    }
                }
            }

            if ((type === 'npc' || type === 'variation') && targetCharacterId && !isAddingNew) {
                const imageData = parseResponse.extractNpcImage(response.data, mode, variant);
                if (imageData?.imagePath) {
                    const imageUrl = imageData.imagePath;

                    if (variant === 'base') {
                        updateCharacterImage(targetCharacterId, imageUrl, 'base');
                        bumpCacheBust(imageUrl);
                    } else {
                        let finalType = 'expression';
                        let finalValue = variant || '';

                        setCharacterData(prev => {
                            const currentChar = prev.find(c => c.id === targetCharacterId);
                            const currentVariation = currentChar?.variations.find(v => v.label === variant);
                            if (currentVariation?.type) {
                                finalType = currentVariation.type;
                                finalValue = currentVariation.label;
                            }
                            return prev;
                        });

                        updateCharacterImage(targetCharacterId, imageUrl, finalValue, finalType);
                        bumpCacheBust(imageUrl);
                    }
                } else {
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
            if (response.data?.success) {
                toast.success('NPC图片生成成功，请在确认修改后保存');

                // 提取生成的图片 URL 并存为暂存
                const imageData = parseResponse.extractNpcImage(response.data, mode, 'base');
                if (imageData?.imagePath) {
                    // 使用暂存图片模式，不直接更新 characterData
                    setPendingImageFromUrl(npc.id, imageData.imagePath, 'base');
                    // 手动刷新缓存
                    bumpCacheBust(imageData.imagePath);
                } else {
                    // 如果无法提取图片数据，提示用户
                    toast.error('生成成功但无法获取图片，请稍后重试');
                }
            } else {
                toast.error('当前使用人数过多，请稍后再试');
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
            if (response.data?.success) {
                toast.success('主角图片生成成功，请在确认修改后保存');
                const { image: newImageUrl } = parseResponse.extractPlayerImage(response.data, mode);

                if (newImageUrl) {
                    // 使用暂存图片模式
                    setPendingImageFromUrl('player', newImageUrl, 'base');
                    // 手动刷新缓存
                    bumpCacheBust(newImageUrl);
                } else {
                    toast.error('生成成功但无法获取图片，请稍后重试');
                }
            } else {
                toast.error('当前使用人数过多，请稍后再试');
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

            if (response.data?.success) {
                toast.success('差分图片生成成功，请在确认修改后保存');

                // 使用后端返回的数据设置暂存图片
                const imageData = parseResponse.extractNpcImage(
                    response.data,
                    mode,
                    variation.label,
                    variation.type || 'expression',
                    variation.label
                );

                if (imageData?.imagePath) {
                    const imageUrl = imageData.imagePath;
                    // 使用暂存图片模式
                    setPendingImageFromUrl(currentCharacter.id, imageUrl, variation.label);
                    // 手动刷新缓存
                    bumpCacheBust(imageUrl);
                } else {
                    toast.error('生成成功但无法获取图片，请稍后重试');
                }
            } else {
                toast.error('当前使用人数过多，请稍后再试');
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
        if (currentCharacter.id === 'player') {
            toast.error('暂不支持删除主角差分');
            return;
        }

        try {
            const response = await api.deleteVariantImage(fileId, currentCharacter.id, variation.label);
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
                const results = payload?.results;
                const npcsGenerated: number | undefined = results?.npcsGenerated ?? results?.generated;
                const npcsTotal: number | undefined = results?.npcsTotal ?? results?.total;
                const errors: number | undefined = typeof results?.errors === 'number' ? results.errors : undefined;

                const usedPoints = npcCostPoints ?? (typeof npcsGenerated === 'number' ? npcsGenerated * 10 : undefined);

                if (typeof npcsGenerated === 'number' && typeof npcsTotal === 'number') {
                    toast.success(
                        `所有角色立绘生成完成：成功 ${npcsGenerated}/${npcsTotal} 个` +
                        (typeof errors === 'number' ? `，失败 ${errors} 个` : '') +
                        (typeof usedPoints === 'number' ? `，本次预计扣除 ${usedPoints} 积分` : '')
                    );
                } else {
                    toast.success(
                        typeof usedPoints === 'number'
                            ? `所有角色立绘生成成功，本次预计扣除 ${usedPoints} 积分`
                            : '所有角色立绘生成成功'
                    );
                }
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

