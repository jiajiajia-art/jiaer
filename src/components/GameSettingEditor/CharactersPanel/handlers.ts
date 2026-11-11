/**
 * 业务逻辑处理函数
 * 提取主要的业务逻辑，降低主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Character, Variation, PendingImage } from './types';
import type { NPC, GenerateImgeResponse, BatchImageJobStatus } from '../../../api/galgame/EditorData.type';
import { npcToCharacter, playerToCharacter, bumpCacheBust, stringifyPersonalityTags } from './utils';
import type { ApiHelpers } from './apiHelpers';
import { parseResponse } from './apiHelpers';
import type { User } from '../../../api/account/auth.type';
import { auth } from '../../../api/account/authApi';
import { isMiniProgramEnv } from '../../../utils/miniProgram';
import {
    BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
    resolveBatchImageJobPollStep,
} from '../../../utils/batchImageJobPoll';
import {
    countBatchNpcBoardFailures,
    isBatchNpcBoardSettled,
    markNextPendingNpcAsGenerating,
} from '../../../utils/batchNpcBoardSettlement';
import { resolveCharacterBatchSelection } from '../../../lib/galgame/characterBatchSelection';

interface HandlersContext {
    fileId: string;
    mode: string;
    api: ApiHelpers;
    userPoints: number;
    updateUser?: (user: Partial<User>) => void;
    t: (key: string) => string;
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
    setNpcBatchJobStatus: React.Dispatch<React.SetStateAction<BatchImageJobStatus | null>>;
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
    onDataChange?: () => void | Promise<void>;
    /** 用户点击取消时置为 true，轮询循环据此提前退出 */
    npcBatchGenerationCancelRef: React.MutableRefObject<boolean>;
    /** 批量任务世代号：新开/重试时递增，作废旧轮询 */
    npcBatchGenerationSessionRef: React.MutableRefObject<number>;
    /** 角色列表勾选；空 = 一键全量 */
    selectedCharacterIdsRef: React.MutableRefObject<Set<string>>;
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
        setNpcBatchJobStatus,
        setPendingImages,
        setHasUnsavedChanges,
        activeCharacterId,
        isAddingNew,
        newCharacterData,
        onDataChange,
        pendingImageUrlsRef,
        npcBatchGenerationCancelRef,
        npcBatchGenerationSessionRef,
        selectedCharacterIdsRef,
        t,
    } = ctx;

    const replaceCharacter = (list: Character[], targetCharacterId: string, nextCharacter: Character): Character[] =>
        list.map((character) => character.id === targetCharacterId ? nextCharacter : character);

    const tToast = (key: string, fallback: string) => t(key) || fallback;

    const bumpExistingCharacterImageCache = () => {
        characterData.forEach((character) => {
            if (character.id.startsWith('temp-')) return;
            if (
                character.portrait &&
                !character.portrait.startsWith('blob:') &&
                !character.portrait.startsWith('data:')
            ) {
                bumpCacheBust(character.portrait);
            }
        });
    };

    /** 功能注释：批量任务中已抠图落盘的角色，立刻写入本地立绘，不等整批结束。 */
    const applyPartialSavedCharacterImages = (
        statusPayload: BatchImageJobStatus | null | undefined,
        appliedIds: Set<string>,
    ) => {
        const saved = Array.isArray(statusPayload?.savedResults) ? statusPayload.savedResults : [];
        const fromItems = Array.isArray(statusPayload?.items)
            ? statusPayload.items
                .filter((item) => item?.stage === 'item_done' && typeof item.imagePath === 'string' && item.imagePath.trim())
                .map((item) => ({
                    id: String(item.id || ''),
                    imagePath: String(item.imagePath || '').trim(),
                    type: String(item.id) === 'player' ? 'player' : 'npc',
                }))
            : [];
        const merged = [...saved, ...fromItems].filter((row) => row.id && row.imagePath);
        if (merged.length === 0) return;

        let changed = false;
        const nextById = new Map<string, string>();
        for (const row of merged) {
            const key = String(row.id);
            if (appliedIds.has(key)) continue;
            nextById.set(key, row.imagePath);
            appliedIds.add(key);
            bumpCacheBust(row.imagePath);
            changed = true;
        }
        if (!changed) return;

        setCharacterData((prev) => prev.map((character) => {
            const imagePath = nextById.get(character.id);
            if (!imagePath) return character;
            return {
                ...character,
                portrait: imagePath,
            };
        }));
    };

    const createPreviewUrl = async (
        imageFile: File,
        previousUrl?: string
    ): Promise<string> => {
        if (previousUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(previousUrl);
        }

        if (!isMiniProgramEnv()) {
            return URL.createObjectURL(imageFile);
        }

        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                    return;
                }
                reject(new Error('Failed to build image preview'));
            };
            reader.onerror = () => reject(reader.error || new Error('Failed to read image preview'));
            reader.readAsDataURL(imageFile);
        });
    };

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
    const setPendingImage = async (
        characterId: string,
        imageData: string | File | Blob | ArrayBuffer,
        variant: string
    ): Promise<void> => {
        let previewUrl: string;
        let file: File | undefined;
        const pendingImageKey = `${characterId}-${variant}`;

        const createOrReplacePendingUrl = async (imageFile: File): Promise<string> => {
            const previousUrl = pendingImageUrlsRef.current[pendingImageKey];
            const nextUrl = await createPreviewUrl(imageFile, previousUrl);
            pendingImageUrlsRef.current[pendingImageKey] = nextUrl;
            return nextUrl;
        };

        if (typeof imageData === 'string') {
            previewUrl = imageData;
        } else if (imageData instanceof File) {
            file = imageData;
            previewUrl = await createOrReplacePendingUrl(file);
        } else if (imageData instanceof Blob) {
            file = new File([imageData], `generated_${variant}.webp`, { type: imageData.type || 'image/webp' });
            previewUrl = await createOrReplacePendingUrl(file);
        } else if (imageData instanceof ArrayBuffer) {
            const blob = new Blob([imageData], { type: 'image/webp' });
            file = new File([blob], `generated_${variant}.webp`, { type: 'image/webp' });
            previewUrl = await createOrReplacePendingUrl(file);
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

    // 刷新用户积分，确保弹窗/扣除后与后端一致；返回最新积分
    const refreshUserPoints = async (): Promise<number | undefined> => {
        if (!updateUser) return undefined;
        try {
            const resp = await auth.getUserInfo();
            const latestUser = resp.data?.data;
            if (latestUser && typeof latestUser.points === 'number') {
                updateUser({ points: latestUser.points });
                return latestUser.points;
            }
        } catch (error) {
            console.error('刷新用户积分失败:', error);
        }
        return undefined;
    };

    // 从 API 响应中更新角色数据
    // 功能注释：扣费/余额只信后端真实结算；禁止把 null 显示成 0；禁止用治愈假结果冒充已扣费。
    const applyNpcBatchResult = async (payload: any, _npcCostPointsValue: number | null, jobStatus?: BatchImageJobStatus | null) => {
        // 治愈假结果且仍有成功张数：不算正式结算，交给轮询等 Worker complete
        if (payload?.healed && Number(payload?.points?.deducted ?? payload?.results?.pointsDeducted ?? 0) === 0) {
            const healedSuccess = Number(
                payload?.npcs?.effective
                ?? payload?.results?.npcsGenerated
                ?? 0
            );
            if (healedSuccess > 0) {
                return false;
            }
        }

        const npcsTotalRaw = Number(
            payload?.npcs?.total
            ?? payload?.results?.npcsTotal
            ?? jobStatus?.totalCount
            ?? 0
        );
        const npcsTotal = Number.isFinite(npcsTotalRaw) ? Math.max(0, npcsTotalRaw) : 0;
        const playerTotalRaw = Number(payload?.player?.total ?? 0);
        const playerTotal = Number.isFinite(playerTotalRaw) ? Math.max(0, playerTotalRaw) : 0;
        let totalCount = npcsTotal + playerTotal;
        if (totalCount <= 0 && Number(jobStatus?.totalCount) > 0) {
            totalCount = Number(jobStatus?.totalCount);
        }

        const npcsEffectiveRaw = Number(
            payload?.npcs?.effective
            ?? payload?.results?.npcsGenerated
            ?? payload?.results?.effectiveSuccessful
            ?? NaN
        );
        const npcsEffective = Number.isFinite(npcsEffectiveRaw) ? Math.max(0, npcsEffectiveRaw) : NaN;
        const playerEffectiveRaw = Number(payload?.player?.effective ?? 0);
        const playerEffective = Number.isFinite(playerEffectiveRaw) ? Math.max(0, playerEffectiveRaw) : 0;

        let generatedCount: number;
        if (Number.isFinite(npcsEffective)) {
            generatedCount = Math.max(0, npcsEffective + playerEffective);
        } else {
            const items = Array.isArray(jobStatus?.items) ? jobStatus.items : [];
            generatedCount = items.filter((item) => String(item?.stage || '') === 'item_done').length;
        }
        if (totalCount > 0) {
            generatedCount = Math.min(generatedCount, totalCount);
        }

        const hasDeductedField = payload?.points?.deducted != null
            || payload?.results?.pointsDeducted != null;
        const pointsDeductedRaw = Number(
            payload?.points?.deducted
            ?? payload?.results?.pointsDeducted
            ?? 0
        );
        const pointsDeducted = generatedCount > 0 && hasDeductedField && Number.isFinite(pointsDeductedRaw)
            ? Math.max(0, pointsDeductedRaw)
            : (generatedCount <= 0 ? 0 : Math.max(0, pointsDeductedRaw));

        const remainingRaw = payload?.points?.remaining ?? payload?.results?.remainingPoints;
        // null/undefined 不能 Number()→0；先刷账户再展示
        const refreshed = await refreshUserPoints();
        let remainingPoints: number | undefined;
        if (remainingRaw != null && remainingRaw !== '' && Number.isFinite(Number(remainingRaw))) {
            remainingPoints = Math.max(0, Number(remainingRaw));
        } else if (typeof refreshed === 'number') {
            remainingPoints = Math.max(0, refreshed);
        } else {
            remainingPoints = undefined;
        }

        setNpcGenerationResult({
            generatedCount,
            totalCount,
            pointsDeducted,
            remainingPoints,
        });
        bumpExistingCharacterImageCache();
        try {
            await onDataChange?.();
        } catch (refreshError) {
            console.error('Failed to refresh character data after batch generation:', refreshError);
        }
        setNpcResultModalOpen(true);
        return true;
    };

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

    const buildVariationDescriptions = (character: Character): { [key: string]: string } => {
        const descriptions: { [key: string]: string } = {};
        character.variations
            .filter(v => v.label !== 'base')
            .forEach(variation => {
                const key = getVariationImageKey(variation);
                const description = variation.description?.trim();
                if (key && description) {
                    descriptions[key] = description;
                }
            });
        return descriptions;
    };

    // 确认修改/新增角色
    const confirmEdit = async (characterToSave: Character): Promise<ConfirmEditResult> => {
        const failResult: ConfirmEditResult = {
            success: false,
            characters: characterData,
            activeCharacterId,
            savedCharacterId: null,
        };

        if (!fileId || !characterToSave) {
            toast.error(t('common.editorSubmit.missingData'));
            return failResult;
        }

        // 主角资料保存
        if (characterToSave.id === 'player') {
            const persistedBaseImage = normalizePersistedImagePath(characterToSave.portrait);
            const images = buildCharacterImages(characterToSave, { normalize: true });
            const variationDescriptions = buildVariationDescriptions(characterToSave);

            const playerData = {
                name: characterToSave.name || '',
                callName: characterToSave.callName || '',
                gender: characterToSave.gender || '',
                identity: characterToSave.identity || undefined,
                race: characterToSave.identity || undefined,
                appearance: characterToSave.appearance || '',
                personality: stringifyPersonalityTags(characterToSave.personality) || undefined,
                tone: characterToSave.speech || undefined,
                // 过滤 blob 预览地址，仅提交可持久化图片路径
                background: characterToSave.background || undefined,
                image: persistedBaseImage,
                images: Object.keys(images).length > 0 ? images : undefined,
                portraitScale: characterToSave.portraitScale,
                portraitOffsetX: characterToSave.portraitOffsetX,
                portraitOffsetY: characterToSave.portraitOffsetY,
                variationDescriptions: Object.keys(variationDescriptions).length > 0 ? variationDescriptions : undefined,
            };

            try {
                const response = await api.updatePlayer(fileId, playerData as any);
                if (!response.data?.success) {
                    toast.error(t('createGame.updateCharacterFailed'));
                    return failResult;
                }

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
                toast.error(t('createGame.updatePlayerFailedRetry'));
                return failResult;
            }
        }

        // NPC 资料保存
        const { race, job } = splitIdentity(characterToSave.identity, characterToSave.role);
        const images = buildCharacterImages(characterToSave, { normalize: true });
        const variationDescriptions = buildVariationDescriptions(characterToSave);

        const finalImages: { [key: string]: string } | undefined = Object.keys(images).length > 0 ? images : undefined;
        const playerRelationship = characterToSave.relationships.find(
            r => r.name === '玩家' || r.name.toLowerCase().includes('player'),
        );

        const npcData: NPC & { callName?: string; identity?: string; variationDescriptions?: Record<string, string> } = {
            id: characterToSave.id.startsWith('temp-') ? `npc_${Date.now()}` : characterToSave.id,
            name: characterToSave.name || '',
            callName: characterToSave.callName || '',
            gender: characterToSave.gender || '',
            identity: characterToSave.identity || undefined,
            job: job || undefined,
            race: race || undefined,
            description: characterToSave.background || ' ',
            appearance: characterToSave.appearance || '',
            personality: stringifyPersonalityTags(characterToSave.personality) || undefined,
            tone: characterToSave.speech || '',
            relationship: playerRelationship?.description || undefined,
            images: finalImages,
            portraitScale: characterToSave.portraitScale,
            portraitOffsetX: characterToSave.portraitOffsetX,
            portraitOffsetY: characterToSave.portraitOffsetY,
            variationDescriptions: Object.keys(variationDescriptions).length > 0 ? variationDescriptions : undefined,
        };

        try {
            const response = isAddingNew
                ? await api.addNpc(fileId, npcData)
                : await api.updateNpc(fileId, npcData);

            if (!response.data?.success) {
                toast.error(isAddingNew ? '创建角色失败' : '更新角色失败');
                return failResult;
            }

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
            toast.error(tToast('createGame.cannotDeletePlayerCharacter', '不能删除玩家角色'));
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
                toast.success(tToast('createGame.characterDeleted', '角色删除成功'));
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error(tToast('createGame.deleteCharacterFailed', '删除角色失败'));
            }
        } catch (error) {
            console.error('删除角色时出错:', error);
            toast.error(tToast('createGame.deleteCharacterFailedRetry', '删除角色失败，请重试'));
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
        const variationDescriptions = buildVariationDescriptions(newCharacterData);

        const finalImages: { [key: string]: string } | undefined =
            newCharacterData.portrait || Object.keys(images).length > 1 ? images : undefined;

        const playerRelationship = newCharacterData.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

        const newNpc: NPC & { callName?: string; identity?: string; variationDescriptions?: Record<string, string> } = {
            id: targetCharacterId,
            name: newCharacterData.name || '未命名角色',
            callName: newCharacterData.callName || '',
            gender: newCharacterData.gender || '',
            identity: newCharacterData.identity || undefined,
            job: job || undefined,
            race: race || undefined,
            description: newCharacterData.background || '暂无描述',
            appearance: newCharacterData.appearance || '',
            personality: stringifyPersonalityTags(newCharacterData.personality) || undefined,
            tone: newCharacterData.speech || '',
            relationship: playerRelationship?.description || undefined,
            images: finalImages,
            variationDescriptions: Object.keys(variationDescriptions).length > 0 ? variationDescriptions : undefined,
        };

        try {
            const createResponse = await api.addNpc(fileId, newNpc);
            if (!createResponse.data?.success) {
                toast.error(tToast('createGame.createCharacterFailedUploadImage', '创建角色失败，无法上传图片'));
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
            toast.error(tToast('createGame.createCharacterFailedRetry', '创建角色失败，请重试'));
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
            variationDescription?: string;
            inputRef?: React.RefObject<HTMLInputElement | null> | { current: HTMLInputElement | null };
        }
    ): Promise<boolean> => {
        const validateFile = (file: File): boolean => {
            if (!file.type.startsWith('image/')) {
                toast.error(tToast('createGame.pleaseSelectImageFile', '请选择图片文件'));
                return false;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error(tToast('createGame.imageSizeCannotExceed5MB', '图片大小不能超过 5MB'));
                return false;
            }
            return true;
        };


        if (!validateFile(file)) {
            return false;
        }

        if (!fileId) {
            toast.error(tToast('createGame.missingFileIdCannotUpload', '缺少文件ID，无法上传'));
            return false;
        }


        const { type, characterId, variant = 'base', variationDescription, inputRef } = options;

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
                response = await api.uploadPlayerImage(fileId, file, variant, variationDescription);
            } else if (type === 'npc' || type === 'variation') {
                if (!targetCharacterId) {
                    toast.error(tToast('createGame.missingCharacterIdCannotUpload', '缺少角色ID，无法上传'));
                    return false;
                }

                response = await api.uploadNpcImage(fileId, targetCharacterId, file, variant, variationDescription);
            } else {
                toast.error(tToast('createGame.unknownUploadType', '未知的上传类型'));
                return false;
            }

            if (!response.data?.success) {
                toast.error(tToast('createGame.uploadFailed', '上传失败，请重试'));
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
                        bumpCacheBust(newPortrait);
                    } else {
                        if (onDataChange) {
                            onDataChange();
                        }
                    }
                } else {
                    // 差分图片
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
                        if (onDataChange) {
                            onDataChange();
                        }
                    }
                }
            }

            // 如果是 NPC 图片
            if ((type === 'npc' || (type === 'variation' && targetCharacterId !== 'player')) && targetCharacterId && !isAddingNew) {
                const imageData = parseResponse.extractNpcImage(response.data, mode, variant);
                if (imageData?.imagePath) {
                    const imageUrl = imageData.imagePath;
                    if (variant === 'base') {
                        updateCharacterImage(targetCharacterId, imageUrl, 'base');
                        if (imageData.allVariants) {
                            for (const [variantKey, variantUrl] of Object.entries(imageData.allVariants)) {
                                if (variantKey !== 'base') {
                                    const { type: finalType, label: finalLabel } = parseVariantKey(variantKey);
                                    updateCharacterImage(targetCharacterId, variantUrl, finalLabel, finalType);
                                }
                            }
                        }
                        bumpCacheBust(imageUrl);
                    } else {
                        const { type: finalType, label: finalValue } = parseVariantKey(variant);
                        updateCharacterImage(targetCharacterId, imageUrl, finalValue, finalType);
                        if (imageData.allVariants?.base) {
                            updateCharacterImage(targetCharacterId, imageData.allVariants.base, 'base');
                        }
                        bumpCacheBust(imageUrl);
                    }
                } else {
                    updateCharacterFromResponse(response.data, targetCharacterId);
                }
            }

            return true;
        } catch (error) {
            console.error('上传图片失败:', error);
            toast.error(tToast('createGame.uploadFailedRetry', '上传图片失败，请重试'));
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
                toast.success(tToast('createGame.npcImageGeneratedSaveLater', 'NPC图片生成成功，请在确认修改后保存'));

                // 直接使用返回的 blob 数据
                await setPendingImage(npc.id, response.data.blob, 'base');
                await refreshUserPoints();
            } else {
                toast.error(
                    response.data?.message
                    || tToast('createGame.currentUserCountTooHighTryLater', '当前使用人数过多，请稍后再试'),
                );
            }
        } catch (error) {
            toast.error(tToast('createGame.regenerateNpcImageFailedCheckNetwork', '重新生成NPC图片失败，请检查网络连接'));
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
                toast.success(tToast('createGame.playerImageGeneratedSaveLater', '主角图片生成成功，请在确认修改后保存'));

                // 直接使用返回的 blob 数据
                await setPendingImage('player', response.data.blob, 'base');
                await refreshUserPoints();
            } else {
                toast.error(
                    response.data?.message
                    || tToast('createGame.currentUserCountTooHighTryLater', '当前使用人数过多，请稍后再试'),
                );
            }
        } catch (error) {
            toast.error(tToast('createGame.regeneratePlayerImageFailedCheckNetwork', '重新生成主角图片失败，请检查网络连接'));
        } finally {
            setIsGeneratingSingleNpcImage(false);
            setGeneratingCharacterId(null);
        }
    };

    // 重新生成差分图片（改为暂存模式）
    const regenerateVariationImage = async (variation: Variation, currentCharacter: Character | null) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error(tToast('createGame.missingDataCannotGenerate', '缺少必要数据，无法生成'));
            return;
        }

        if (!currentCharacter.portrait) {
            toast.error(tToast('createGame.pleaseUploadCharacterBasePortrait', '请先上传角色基础立绘'));
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
                toast.success(tToast('createGame.variationImageGenerated', '差分图片生成成功'));

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
                await refreshUserPoints();
            } else {
                toast.error(tToast('createGame.currentUserCountTooHighTryLater', '当前使用人数过多，请稍后再试'));
            }
        } catch (error) {
            toast.error(tToast('createGame.generateVariationImageFailedCheckNetwork', '生成差分图片失败，请检查网络连接'));
        }
    };

    // 删除差分图片
    const deleteVariationImage = async (variation: Variation, currentCharacter: Character | null) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error(tToast('createGame.missingDataCannotDeleteVariation', '缺少必要数据，无法删除差分'));
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
                toast.success(tToast('createGame.variationDeleted', '差分删除成功'));
            } else {
                toast.error(tToast('createGame.deleteVariationFailed', '删除差分失败'));
            }
        } catch (error) {
            console.error('删除差分失败:', error);
            toast.error(tToast('createGame.deleteVariationFailedRetry', '删除差分失败，请稍后重试'));
        }
    };

    /** 一键/重试共用：打开积分确认前可暂存限定角色选择 */
    let pendingBatchSelection: ReturnType<typeof resolveCharacterBatchSelection> | null = null;

    // 批量生成：仅生成勾选角色（进入页默认全选）；可传入 selection 只重跑失败项
    const generateAllNpcImages = async (
        npcCostPoints: number | null,
        selectionOverride?: ReturnType<typeof resolveCharacterBatchSelection> | null,
    ) => {
        let lastJobStatus: BatchImageJobStatus | null = null;
        let activeJobId = '';
        if (!fileId) {
            toast.error(tToast('createGame.missingDataCannotGenerate', '缺少必要数据，无法生成'));
            return;
        }
        const usedOverride = Boolean(selectionOverride || pendingBatchSelection);
        const selection = selectionOverride
            || pendingBatchSelection
            || resolveCharacterBatchSelection(selectedCharacterIdsRef.current);
        pendingBatchSelection = null;
        if (!usedOverride
            && (!selectedCharacterIdsRef.current || selectedCharacterIdsRef.current.size === 0)) {
            toast.error(tToast('createGame.selectCharactersToGenerate', '请先勾选要生成的角色'));
            return;
        }
        if (selection.hasSelection
            && !selection.generatePlayer
            && (!selection.npcIds || selection.npcIds.length === 0)) {
            toast.error(tToast('createGame.selectCharactersToGenerate', '请先勾选要生成的角色'));
            return;
        }
        const bootstrapTotal = Math.max(
            0,
            (selection.generatePlayer ? 1 : 0) + (selection.generateNPCs ? selection.npcIds.length : 0),
        );
        const sessionId = ++npcBatchGenerationSessionRef.current;
        try {
            npcBatchGenerationCancelRef.current = false;
            // 先清空旧任务再打开遮罩，避免闪现上一轮进度/日志
            setNpcBatchJobStatus({
                success: true,
                jobId: '',
                fileId,
                status: 'queued',
                totalCount: bootstrapTotal,
                completedCount: 0,
                failedCount: 0,
                estimatedRemainingSeconds: null,
                items: [],
                logs: [],
                stageStats: {
                    generateActive: 0,
                    generateDone: 0,
                    rembgActive: 0,
                    rembgDone: 0,
                    failed: 0,
                    pending: bootstrapTotal,
                    total: bootstrapTotal,
                },
            } as BatchImageJobStatus);
            setIsGeneratingNpcImages(true);

            const startResponse: any = await api.startGenerateAllNpcImages(fileId, selection);
            const startPayload: any = startResponse?.data || startResponse;
            const jobId = startPayload?.jobId;
            if (!startPayload?.success || !jobId) {
                toast.error(startPayload?.error || startPayload?.message || '当前使用人数过多，请稍后再试');
                return;
            }
            activeJobId = String(jobId);
            const startItems = Array.isArray(startPayload?.items) ? startPayload.items : [];
            const startLogs = Array.isArray(startPayload?.logs) ? startPayload.logs : [];
            const startTotal = Number(startPayload?.totalCount ?? bootstrapTotal) || bootstrapTotal;
            setNpcBatchJobStatus({
                success: true,
                jobId: activeJobId,
                fileId: startPayload?.fileId ?? fileId,
                status: startPayload?.status ?? 'queued',
                totalCount: startTotal,
                completedCount: Number(startPayload?.completedCount) || 0,
                failedCount: Number(startPayload?.failedCount) || 0,
                estimatedRemainingSeconds: null,
                items: startItems,
                logs: startLogs,
                stageStats: startPayload?.stageStats || {
                    generateActive: 0,
                    generateDone: Number(startPayload?.generateDoneCount) || 0,
                    rembgActive: 0,
                    rembgDone: Number(startPayload?.rembgDoneCount) || 0,
                    failed: Number(startPayload?.failedCount) || 0,
                    pending: startItems.length > 0
                        ? startItems.filter((row: { stage?: string }) => {
                            const stage = String(row?.stage || 'pending');
                            return stage === 'pending' || stage === '';
                        }).length
                        : startTotal,
                    total: startTotal,
                },
            } as BatchImageJobStatus);
            const appliedPartialIds = new Set<string>();
            for (let attempt = 0; attempt < BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS; attempt += 1) {
                if (sessionId !== npcBatchGenerationSessionRef.current) {
                    return;
                }
                const pollStep = resolveBatchImageJobPollStep({
                    cancelRequested: npcBatchGenerationCancelRef.current,
                    status: '',
                    attempt,
                });
                if (pollStep === 'cancelled') {
                    applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                    if (appliedPartialIds.size > 0) {
                        try { await onDataChange?.(); } catch { /* ignore */ }
                    }
                    return;
                }
                if (pollStep === 'timeout') {
                    break;
                }

                // status 内 await 单张约 60s：先乐观标「生图中」，避免整段只显示排队
                setNpcBatchJobStatus((prev) => markNextPendingNpcAsGenerating(prev) || prev);

                const statusResponse: any = await api.getNpcBatchJobStatus(activeJobId);
                if (sessionId !== npcBatchGenerationSessionRef.current) {
                    return;
                }
                const statusPayload = statusResponse?.data || statusResponse;
                // 旧轮询/错任务不得写回 UI
                if (statusPayload?.jobId && String(statusPayload.jobId) !== activeJobId) {
                    continue;
                }
                lastJobStatus = statusPayload as BatchImageJobStatus;
                setNpcBatchJobStatus(lastJobStatus);
                // 已完成抠图的角色立刻刷新本地立绘（不等整批结束）
                applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                if (!statusPayload?.success) {
                    throw new Error(statusPayload?.error || statusPayload?.message || 'Failed to fetch NPC batch job status');
                }

                // 仅「全终态 + 有失败」才停轮询。卡住≥90s 仍要继续轮询，才能触发后端 130s 治愈。
                // （此前误用 shouldShowRetry… 含卡住判定，90s 停轮询 → 153s 仍停在生图中）
                const totalForSettle = Number(statusPayload?.totalCount) || 0;
                const boardSettledWithFailures = isBatchNpcBoardSettled(
                    statusPayload?.items,
                    totalForSettle,
                ) && countBatchNpcBoardFailures(statusPayload?.items) > 0;
                const statusStep = resolveBatchImageJobPollStep({
                    cancelRequested: npcBatchGenerationCancelRef.current,
                    status: String(statusPayload.status || ''),
                    attempt,
                    boardSettledWithFailures,
                });
                if (statusStep === 'cancelled') {
                    applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                    if (appliedPartialIds.size > 0) {
                        try { await onDataChange?.(); } catch { /* ignore */ }
                    }
                    return;
                }
                if (statusStep === 'board_settled_retry') {
                    // 分项已全终态且有失败：提前结束轮询，保留看板给「重新生成未完成任务」
                    applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                    if (appliedPartialIds.size > 0) {
                        try { await onDataChange?.(); } catch { /* ignore */ }
                        toast.success(tToast('createGame.partialCharacterImagesSaved', `已保存 ${appliedPartialIds.size} 张已完成抠图的立绘`));
                    }
                    setNpcBatchJobStatus((prev) => {
                        if (!prev) return lastJobStatus;
                        const status = String(prev.status || '');
                        if (status === 'queued' || status === 'running' || status === 'pending') {
                            return { ...prev, ...lastJobStatus, status: 'failed' };
                        }
                        return { ...prev, ...lastJobStatus };
                    });
                    return;
                }
                if (statusStep === 'failed') {
                    applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                    if (appliedPartialIds.size > 0) {
                        try { await onDataChange?.(); } catch { /* ignore */ }
                        toast.success(tToast('createGame.partialCharacterImagesSaved', `已保存 ${appliedPartialIds.size} 张已完成抠图的立绘`));
                    }
                    // 有失败可重试时不 toast 整批失败，留给看板 CTA
                    if (
                        boardSettledWithFailures
                        || Number(statusPayload?.failedCount) > 0
                    ) {
                        return;
                    }
                    throw new Error(statusPayload?.error || statusPayload?.message || 'NPC batch job failed');
                }
                if (statusStep === 'timeout') {
                    break;
                }
                if (statusStep === 'completed' || statusPayload.status === 'completed') {
                    applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
                    const resultResponse: any = await api.getNpcBatchJobResult(activeJobId);
                    const resultPayload = resultResponse?.data || resultResponse;
                    if (!resultPayload?.success || !resultPayload?.result) {
                        throw new Error(resultPayload?.error || resultPayload?.message || 'Failed to fetch NPC batch job result');
                    }
                    const applied = await applyNpcBatchResult(resultPayload.result, npcCostPoints, lastJobStatus);
                    if (!applied) {
                        // 治愈假结算：继续等 Worker 写入真实扣费 result
                        await new Promise((resolve) => window.setTimeout(resolve, 1500));
                        continue;
                    }
                    return;
                }
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }
            // 轮询超时：仍保留已抠完并落盘的角色图
            applyPartialSavedCharacterImages(lastJobStatus, appliedPartialIds);
            if (appliedPartialIds.size > 0) {
                try { await onDataChange?.(); } catch { /* ignore */ }
                toast.success(tToast('createGame.partialCharacterImagesSaved', `已保存 ${appliedPartialIds.size} 张已完成抠图的立绘`));
            }
            throw new Error('NPC batch job polling timed out');
        } catch (error) {
            if (sessionId !== npcBatchGenerationSessionRef.current) {
                return;
            }
            if (npcBatchGenerationCancelRef.current) {
                return;
            }
            console.error('生成所有角色立绘时出错:', error);
            toast.error(tToast('createGame.generateAllNpcImageFailed', '生成所有角色立绘失败，请检查网络连接'));
        } finally {
            if (sessionId !== npcBatchGenerationSessionRef.current) {
                return;
            }
            setIsGeneratingNpcImages(false);
            if (npcBatchGenerationCancelRef.current) {
                setNpcBatchJobStatus(null);
            } else {
                // 失败或未终态（含卡住的 generate_start）保留看板；仅全成功才清掉
                setNpcBatchJobStatus((prev) => {
                    if (!prev) return null;
                    const items = Array.isArray(prev.items) ? prev.items : [];
                    const total = Math.max(0, Number(prev.totalCount) || items.length || 0);
                    const terminal = new Set(['item_done', 'rembg_done', 'generate_fail', 'rembg_fail']);
                    const allSuccess = total > 0
                        && items.length >= total
                        && items.every((row) => {
                            const stage = String(row?.stage || '');
                            return stage === 'item_done' || stage === 'rembg_done';
                        })
                        && Number(prev.failedCount || 0) <= 0;
                    if (allSuccess) return null;
                    const hasIncomplete = items.some((row) => !terminal.has(String(row?.stage || '')))
                        || Number(prev.failedCount) > 0
                        || items.some((row) => {
                            const stage = String(row?.stage || '');
                            return stage === 'generate_fail' || stage === 'rembg_fail';
                        });
                    if (!hasIncomplete && items.length === 0) return null;
                    const status = String(prev.status || '');
                    if (status === 'queued' || status === 'running' || status === 'pending') {
                        return { ...prev, status: 'failed' };
                    }
                    return prev;
                });
            }
            npcBatchGenerationCancelRef.current = false;
        }
    };

    /** 停止前端轮询并关闭进度遮罩；服务端任务可能仍在后台执行 */
    const cancelGenerateAllNpcImages = () => {
        if (!npcBatchGenerationCancelRef.current) {
            npcBatchGenerationCancelRef.current = true;
            setIsGeneratingNpcImages(false);
            setNpcBatchJobStatus(null);
            pendingBatchSelection = null;
            toast(tToast('createGame.batchCharacterGenerationCancelled', '已取消角色立绘生成'));
        } else {
            setNpcBatchJobStatus(null);
            pendingBatchSelection = null;
        }
    };

    /** 关闭失败重试看板（不发取消 toast） */
    const dismissBatchNpcProgress = () => {
        pendingBatchSelection = null;
        setIsGeneratingNpcImages(false);
        setNpcBatchJobStatus(null);
    };

    // 打开积分确认弹窗（按勾选试算；可传入失败项 selection）
    const openNpcCostModal = async (
        selectionOverride?: ReturnType<typeof resolveCharacterBatchSelection> | null,
    ) => {
        if (!fileId) {
            toast.error(tToast('createGame.missingDataCannotGenerate', '缺少必要数据，无法生成'));
            return;
        }
        const selection = selectionOverride
            || resolveCharacterBatchSelection(selectedCharacterIdsRef.current);
        if (selection.hasSelection
            && !selection.generatePlayer
            && (!selection.npcIds || selection.npcIds.length === 0)) {
            toast.error(tToast('createGame.selectCharactersToGenerate', '请先勾选要生成的角色'));
            return;
        }
        if (!selection.hasSelection
            && (!selectedCharacterIdsRef.current || selectedCharacterIdsRef.current.size === 0)
            && !selectionOverride) {
            toast.error(tToast('createGame.selectCharactersToGenerate', '请先勾选要生成的角色'));
            return;
        }
        try {
            setIsLoadingNpcCost(true);
            pendingBatchSelection = selectionOverride || null;
            const response = await api.calculateNpcPoints(fileId, selection);
            if (response.data) {
                const points = response.data.points;
                setNpcCostPoints(points);
                setNpcCostModalOpen(true);
            }
        } catch (error) {
            pendingBatchSelection = null;
            console.error('获取角色生图积分消耗失败:', error);
            toast.error(tToast('createGame.fetchNpcImageCostFailedRetry', '获取织梦豆消耗失败，请稍后重试'));
        } finally {
            setIsLoadingNpcCost(false);
        }
    };

    const clearPendingBatchSelection = () => {
        pendingBatchSelection = null;
    };

    /**
     * 功能注释：仅重跑失败角色（生图失败 / 抠图失败），先弹积分确认。
     */
    const continueFailedBatchNpcImages = async (characterIds: string[]) => {
        const ids = [...new Set((characterIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
        if (ids.length === 0) {
            toast.error(tToast('createGame.selectCharactersToGenerate', '请先勾选要生成的角色'));
            return;
        }
        const selection = resolveCharacterBatchSelection(ids);
        await openNpcCostModal(selection);
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
        cancelGenerateAllNpcImages,
        dismissBatchNpcProgress,
        openNpcCostModal,
        clearPendingBatchSelection,
        continueFailedBatchNpcImages,
        updateCharacterFromResponse,
    };
};



