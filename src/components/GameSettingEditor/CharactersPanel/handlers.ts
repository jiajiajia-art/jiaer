/**
 * 业务逻辑处理函数
 * 提取主要的业务逻辑，降低主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Character, Variation } from './types';
import type { NPC, Player } from '../../../api/galgame/EditorData.type';
import { npcToCharacter, playerToCharacter, withCacheBust } from './utils';
import type { ApiHelpers } from './apiHelpers';
import { parseResponse } from './apiHelpers';

interface HandlersContext {
    fileId: string;
    mode: string;
    api: ApiHelpers;
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
        activeCharacterId,
        isAddingNew,
        newCharacterData,
        onDataChange,
    } = ctx;

    // 从 API 响应中更新角色数据
    const updateCharacterFromResponse = (responseData: any, characterId: string) => {
        const npc = parseResponse.extractNpc(responseData, mode, characterId);
        if (npc) {
            const updatedCharacter = npcToCharacter(npc, 0);
            setCharacterData(prev => prev.map(char => char.id === characterId ? updatedCharacter : char));
        }
    };

    // 确认修改/新增角色
    const confirmEdit = async (characterToSave: Character) => {
        if (!fileId || !characterToSave) {
            toast.error('缺少必要数据，无法保存修改');
            return;
        }

        // 如果是主角，使用 updatePlayer API
        if (characterToSave.id === 'player') {
            const images: { [key: string]: string } = {};
            characterToSave.variations.forEach(variation => {
                if (variation.type && variation.img) {
                    images[variation.type] = variation.img;
                } else if (variation.label && variation.img) {
                    images[variation.label] = variation.img;
                }
            });

            const playerData = {
                name: characterToSave.name || '',
                gender: characterToSave.gender || '',
                race: characterToSave.identity || undefined,
                appearance: characterToSave.appearance || '',
                personality: characterToSave.personality && characterToSave.personality.length > 0 ? characterToSave.personality.join(', ') : undefined,
                tone: characterToSave.speech || undefined,
                image: characterToSave.portrait || '',
                images: Object.keys(images).length > 0 ? images : undefined,
            };

            try {
                const response = await api.updatePlayer(fileId, playerData as Player);
                if (response.data?.success) {
                    toast.success('主角信息更新成功');
                    const p = parseResponse.extractPlayer(response.data, mode);
                    if (p) {
                        setCharacterData(prev => prev.map(char => char.id === 'player' ? playerToCharacter(p) : char));
                    }
                } else {
                    toast.error('更新主角信息失败');
                }
            } catch (error) {
                console.error('更新主角信息时出错:', error);
                toast.error('更新主角信息失败，请重试');
            }
        } else {
            // 更新或新增 NPC 信息
            const identityParts = characterToSave.identity.split(' · ');
            const race = identityParts.length > 1 ? identityParts[0] : undefined;
            const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || characterToSave.role);

            const images: { [key: string]: string } = {};
            characterToSave.variations.forEach(variation => {
                if (variation.type && variation.img) {
                    images[variation.type] = variation.img;
                } else if (variation.label && variation.img) {
                    images[variation.label] = variation.img;
                }
            });

            let finalImages: { base: string;[key: string]: string } | undefined = undefined;
            if (Object.keys(images).length > 0) {
                if (!images.base) {
                    images.base = characterToSave.portrait || Object.values(images)[0] || '';
                }
                finalImages = images as { base: string;[key: string]: string };
            }

            const playerRelationship = characterToSave.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

            const npcData: NPC = {
                id: characterToSave.id.startsWith('temp-') ? `npc_${Date.now()}` : characterToSave.id,
                name: characterToSave.name || '',
                gender: characterToSave.gender || '',
                job: job || undefined,
                race: race || undefined,
                description: characterToSave.background || ' ',
                appearance: characterToSave.appearance || '',
                personality: characterToSave.personality && characterToSave.personality.length > 0 ? characterToSave.personality.join(', ') : undefined,
                tone: characterToSave.speech || '',
                relationship: playerRelationship?.description || undefined,
                images: finalImages,
            };

            try {
                const response = isAddingNew
                    ? await api.addNpc(fileId, npcData)
                    : await api.updateNpc(fileId, npcData);

                if (response.data?.success) {
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
                } else {
                    toast.error(isAddingNew ? '创建角色失败' : '更新角色失败');
                }
            } catch (error) {
                toast.error(isAddingNew ? '创建角色失败，请重试' : '更新角色失败，请重试');
            }
        }
    };

    // 删除角色
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

        const images: { [key: string]: string } = {};
        newCharacterData.variations.forEach(variation => {
            if (variation.type && variation.img) {
                images[variation.type] = variation.img;
            } else if (variation.label && variation.img) {
                images[variation.label] = variation.img;
            }
        });

        let finalImages: { base: string;[key: string]: string } | undefined = undefined;
        if (Object.keys(images).length > 0) {
            if (!images.base) {
                images.base = newCharacterData.portrait || Object.values(images)[0] || '';
            }
            finalImages = images as { base: string;[key: string]: string };
        }

        const playerRelationship = newCharacterData.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

        const newNpc: NPC = {
            id: targetCharacterId,
            name: newCharacterData.name || '未命名角色',
            gender: newCharacterData.gender || '',
            job: job || undefined,
            race: race || undefined,
            description: newCharacterData.background || '暂无描述',
            appearance: newCharacterData.appearance || '',
            personality: newCharacterData.personality && newCharacterData.personality.length > 0 ? newCharacterData.personality.join(', ') : undefined,
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
    ) => {
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
            return;
        }

        if (!fileId) {
            toast.error('缺少文件ID，无法上传');
            return;
        }

        const { type, characterId, variant = 'base', inputRef, successMessage } = options;

        try {
            let response;
            let targetCharacterId: string | undefined = characterId || undefined;

            // 如果是新增模式且上传NPC图片，需要先创建角色
            if (type === 'npc' && isAddingNew && newCharacterData && !targetCharacterId) {
                const newId = await createNewNpcForUpload();
                if (!newId) {
                    return;
                }
                targetCharacterId = newId;
            }

            // 根据类型调用不同的API
            if (type === 'player') {
                response = await api.uploadPlayerImage(fileId, file, variant);
            } else if (type === 'npc' || type === 'variation') {
                if (!targetCharacterId) {
                    toast.error('缺少角色ID，无法上传');
                    return;
                }
                response = await api.uploadNpcImage(fileId, targetCharacterId, file, variant);
            } else {
                toast.error('未知的上传类型');
                return;
            }

            if (response.data?.success) {
                toast.success(successMessage || '图片上传成功');

                // 如果是玩家图片，更新 portrait 或 variations
                if (type === 'player' && !isAddingNew) {
                    setCharacterData(prev =>
                        prev.map(char => {
                            if (char.id === 'player') {
                                const { image: playerImage, images: playerImages } = parseResponse.extractPlayerImage(response.data, mode);

                                if (variant === 'base') {
                                    let newPortrait = playerImages?.base || playerImage;
                                    if (!newPortrait && char.portrait) {
                                        const baseUrl = char.portrait.split('?')[0];
                                        newPortrait = baseUrl;
                                    }
                                    return { ...char, portrait: newPortrait ? withCacheBust(newPortrait) : char.portrait };
                                }
                                
                                const existingVarIndex = char.variations.findIndex(v => v.label === variant);
                                const variantImg = playerImages?.[variant] || playerImage;
                                if (existingVarIndex >= 0) {
                                    const newVariations = [...char.variations];
                                    let imgUrl = variantImg;
                                    if (!imgUrl && newVariations[existingVarIndex].img) {
                                        imgUrl = newVariations[existingVarIndex].img.split('?')[0];
                                    }
                                    newVariations[existingVarIndex] = {
                                        ...newVariations[existingVarIndex],
                                        img: imgUrl ? withCacheBust(imgUrl) : newVariations[existingVarIndex].img,
                                    };
                                    return { ...char, variations: newVariations };
                                } else if (variantImg) {
                                    const newVar: Variation = {
                                        id: `v-${Date.now()}`,
                                        label: variant,
                                        img: withCacheBust(variantImg),
                                        type: variant,
                                    };
                                    return { ...char, variations: [...char.variations, newVar] };
                                }
                            }
                            return char;
                        })
                    );
                }

                // 如果是NPC图片（基础立绘或差分），使用返回的数据更新本地状态
                if ((type === 'npc' || type === 'variation') && targetCharacterId && !isAddingNew) {
                    const imageData = parseResponse.extractNpcImage(response.data, mode, variant);
                    if (imageData?.imagePath && imageData.npcId) {
                        const imageUrl = withCacheBust(imageData.imagePath);
                        const variantName = imageData.variant || variant;
                        setCharacterData(prev => prev.map(char => {
                            if (char.id === imageData.npcId) {
                                if (variantName === 'base') {
                                    return { ...char, portrait: imageUrl };
                                } else {
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
                                            type: variantName,
                                        };
                                        return { ...char, variations: [...char.variations, newVar] };
                                    }
                                }
                            }
                            return char;
                        }));
                    } else {
                        updateCharacterFromResponse(response.data, targetCharacterId);
                    }
                }
            } else {
                toast.error('上传失败，请重试');
            }
        } catch (error) {
            console.error('上传图片时出错:', error);
            toast.error('上传图片失败，请重试');
        } finally {
            if (inputRef && 'current' in inputRef && inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    // 重新生成NPC图片
    const regenerateNpcImage = async (npc: Character) => {
        if (!fileId || !npc) {
            return;
        }
        try {
            setIsGeneratingSingleNpcImage(true);
            setGeneratingCharacterId(npc.id);
            const { id, name, age, gender, job, race, description, appearance } = npc as any;
            const response = await api.generateNpcImage(fileId, {
                id, name, age, gender, job, race, description, appearance,
            });
            if (response.data?.success) {
                toast.success('NPC图片重新生成成功');
                
                // 使用后端返回的数据更新本地状态
                const imageData = parseResponse.extractNpcImage(response.data, mode);
                if (imageData?.imagePath) {
                    const imageUrl = withCacheBust(imageData.imagePath);
                    setCharacterData(prev => prev.map(char =>
                        char.id === npc.id
                            ? { ...char, portrait: imageUrl }
                            : char
                    ));
                } else if (npc.portrait) {
                    // 如果无法提取图片数据，使用原有图片并添加缓存破坏
                    const baseUrl = npc.portrait.split('?')[0];
                    setCharacterData(prev => prev.map(char =>
                        char.id === npc.id
                            ? { ...char, portrait: withCacheBust(baseUrl) }
                            : char
                    ));
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

    // 重新生成玩家图片
    const regeneratePlayerImage = async (playerChar: Character) => {
        if (!fileId || !playerChar) return;
        try {
            setIsGeneratingSingleNpcImage(true);
            setGeneratingCharacterId(playerChar.id);
            const identityParts = (playerChar.identity || '').split(' · ');
            const race = identityParts.length > 1 ? identityParts[0] : playerChar.identity || undefined;
            const payloadPlayer: any = {
                name: playerChar.name,
                gender: playerChar.gender,
                race,
                appearance: playerChar.appearance,
                personality: playerChar.personality?.length ? playerChar.personality.join(', ') : undefined,
                tone: playerChar.speech || '',
            };
            const response = await api.generatePlayerImage(fileId, payloadPlayer);
            if (response.data?.success) {
                toast.success('主角图片重新生成成功');
                const { image: newImageUrl } = parseResponse.extractPlayerImage(response.data, mode);

                if (newImageUrl) {
                    setCharacterData(prev => prev.map(char =>
                        char.id === 'player'
                            ? { ...char, portrait: withCacheBust(newImageUrl) }
                            : char
                    ));
                } else if (playerChar.portrait) {
                    const baseUrl = playerChar.portrait.split('?')[0];
                    setCharacterData(prev => prev.map(char =>
                        char.id === 'player'
                            ? { ...char, portrait: withCacheBust(baseUrl) }
                            : char
                    ));
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

    // 重新生成差分图片
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
            const response = await api.generateVariantImage(
                fileId,
                currentCharacter.id === 'player' ? 'player' : currentCharacter.id,
                currentCharacter.portrait,
                {
                    type: (variation.type || 'expression') as 'expression' | 'clothing' | 'pose',
                    value: variation.label,
                    description: variation.description,
                }
            );
            if (response.data?.success) {
                toast.success('差分图片生成成功');
                
                // 使用后端返回的数据更新本地状态
                const imageData = parseResponse.extractNpcImage(response.data, mode, variation.label);
                if (imageData?.imagePath) {
                    const imageUrl = withCacheBust(imageData.imagePath);
                    const variantName = variation.label;
                    
                    setCharacterData(prev => prev.map(char => {
                        if (char.id === currentCharacter.id) {
                            const varIndex = char.variations.findIndex(v => v.label === variantName);
                            if (varIndex >= 0) {
                                // 更新已存在的差分
                                const newVariations = [...char.variations];
                                newVariations[varIndex] = { ...newVariations[varIndex], img: imageUrl };
                                return { ...char, variations: newVariations };
                            } else {
                                // 添加新的差分
                                const newVar: Variation = {
                                    id: `v-${Date.now()}`,
                                    label: variantName,
                                    img: imageUrl,
                                    type: variation.type || 'expression',
                                    description: variation.description,
                                };
                                return { ...char, variations: [...char.variations, newVar] };
                            }
                        }
                        return char;
                    }));
                } else {
                    // 如果无法提取图片数据，回退到刷新整个数据
                    if (onDataChange) {
                        onDataChange();
                    }
                }
            } else {
                toast.error('当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            toast.error('生成差分图片失败，请检查网络连接');
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
            const response: any = await api.calculateNpcPoints(fileId);
            const points = response?.data?.points ?? response?.data?.data?.points ?? response?.data?.cost ?? null;
            setNpcCostPoints(points);
            setNpcCostModalOpen(true);
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
        generateAllNpcImages,
        openNpcCostModal,
        updateCharacterFromResponse,
    };
};

