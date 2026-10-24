import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CharactersPanel.module.css';
import CharacterLayer from '../../Galgame/CharacterLayer';
import { useImageBusinessPrice } from '../../../hooks/useImageBusinessPrice';
import type { AllGameData, BatchImageJobStatus } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPCSetting, NPC } from '../../../api/galgame/EditorData.type';
import type { NPCSetting as WorldNPCSetting, NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { MdDownload } from 'react-icons/md';
import { MdEdit } from 'react-icons/md';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { FaMagic } from 'react-icons/fa';
import { withCacheBust, extractImageExtension } from './utils';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import SaveConfirmModal from '../../CommonModal/SaveConfirmModal';
import GenerateResultModal from '../../CommonModal/GenerateResultModal';
import { toast } from 'react-hot-toast';
import { useGameStore } from '../../../store/gameStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { Character, Variation, PendingImage } from './types';
import { VARIATION_TYPES, DEFAULT_NPC_PORTRAIT } from './types';
import { getNpcs, npcToCharacter, playerToCharacter, normalizePersonalityTags, stringifyPersonalityTags } from './utils';
import { createApiHelpers } from './apiHelpers';
import { createHandlers } from './handlers';
import CharacterAttributesPanel, { type CharacterAttributesPanelRef } from './CharacterAttributesPanel';
import CharactersSidebar from './CharactersSidebar';
import PortraitLightbox from './PortraitLightbox';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import { HOST_ADDRESS } from '../../../config';
import { authFetch } from '../../../api/base';
import { useGenerationEta } from '../../../hooks/editor/useGenerationEta';
import GenerationActionBar from '../GenerationActionBar';
import InlineFieldSave from '../InlineFieldSave';
import CurrencyIcon from '../../CurrencyIcon';
import {
    listBatchNpcRetryTargetItems,
    resolveRetryCharacterIdsFromBoard,
    shouldShowBatchProgressOverlay,
    shouldShowRetryIncompleteBatchTasks,
} from '../../../utils/batchNpcBoardSettlement';
import { LEGACY_WORLD_CHARACTER_GENERATION_COST } from '../../../utils/constants';

// 字数限制配置
const CHARACTER_WORD_LIMITS = {
    name: 10,
    gender: 2,
    identity: 10,
    personality: 100,
    speech: 100,
    appearance: 500,
    background: 800,
    /** 对齐局内 SystemsPanel「玩家目前定位」上限 */
    positioningIdentity: 80,
    positioningTraits: 200,
    positioningSecret: 400,
} as const;

const SINGLE_CHARACTER_ETA_SECONDS = 95;
const SINGLE_PLAYER_ETA_SECONDS = 85;
const BATCH_CHARACTER_BUFFER_SECONDS = 60;

interface CharactersPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void | Promise<void>; // 数据变化回调，用于刷新数据
    mode: string;
}

export interface CharactersPanelRef {
    checkBeforeLeave: (action?: () => void) => boolean;
}

interface CharacterFieldDirtyState {
    name: boolean;
    callName: boolean;
    gender: boolean;
    identity: boolean;
    personality: boolean;
    speech: boolean;
    appearance: boolean;
    background: boolean;
    positioningIdentity: boolean;
    positioningTraits: boolean;
    positioningSecret: boolean;
}

const EMPTY_CHARACTER_FIELD_DIRTY_STATE: CharacterFieldDirtyState = {
    name: false,
    callName: false,
    gender: false,
    identity: false,
    personality: false,
    speech: false,
    appearance: false,
    background: false,
    positioningIdentity: false,
    positioningTraits: false,
    positioningSecret: false,
};

const CharactersPanel = React.forwardRef<CharactersPanelRef, CharactersPanelProps>(({
    gameData,
    isLoading = false,
    onGetData,
    onDataChange,
    mode = 'visual',
}, ref) => {
    const { t } = useTranslation();
    const { fileId } = useGameStore();
    const { user, updateUser } = useAuthStore();
    const api = createApiHelpers(mode);
    const userPoints = user?.user?.points ?? 0;
    const { estimatedPoints: dynamicCharacterPrice } = useImageBusinessPrice(
        mode === 'visual' ? 'visual_character' : null,
        fileId,
    );
    const { estimatedPoints: dynamicVariantPrice } = useImageBusinessPrice(
        mode === 'visual' ? 'visual_character_variant' : null,
        fileId,
    );
    const characterPrice = mode === 'visual'
        ? dynamicCharacterPrice
        : LEGACY_WORLD_CHARACTER_GENERATION_COST;
    const variantPrice = mode === 'visual'
        ? dynamicVariantPrice
        : LEGACY_WORLD_CHARACTER_GENERATION_COST;
    
    const discountedCost = characterPrice ?? 0;
    const variantDiscountedCost = variantPrice ?? 0;
    // const isMember = user?.user?.isMember ?? false;
    // const showDiscount = isMember && MEMBER_CREATION_DISCOUNT < 1; // TODO: 恢复折扣UI时取消注释
    
    const [activeCharacterId, setActiveCharacterId] = useState<string>('');
    const [characterData, setCharacterData] = useState<Character[]>([]);
    const [isBackgroundExpanded, setIsBackgroundExpanded] = useState<boolean>(false);
    const [isPositioningExpanded, setIsPositioningExpanded] = useState<boolean>(true);
    const [isVariationExpanded, setIsVariationExpanded] = useState<boolean>(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newCharacterData, setNewCharacterData] = useState<Character | null>(null);
    const [variationModalOpen, setVariationModalOpen] = useState<boolean>(false);
    const [newVariationType, setNewVariationType] = useState<string>('');
    const [newVariationLabel, setNewVariationLabel] = useState<string>('');
    const [newVariationDescription, setNewVariationDescription] = useState<string>('');
    const [editingVariationId, setEditingVariationId] = useState<string | null>(null);
    const playerFileInputRef = useRef<HTMLInputElement>(null);
    const npcFileInputRef = useRef<HTMLInputElement>(null);
    const variationFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const [isGeneratingNpcImages, setIsGeneratingNpcImages] = useState<boolean>(false);
    const [npcBatchJobStatus, setNpcBatchJobStatus] = useState<BatchImageJobStatus | null>(null);
    const [isGeneratingSingleNpcImage, setIsGeneratingSingleNpcImage] = useState<boolean>(false);
    const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
    const [isUploadingPortrait, setIsUploadingPortrait] = useState<boolean>(false);
    const [isSavingCharacter, setIsSavingCharacter] = useState<boolean>(false);
    // 保存遮罩层状态
    const [isSaveOverlayVisible, setIsSaveOverlayVisible] = useState<boolean>(false);
    // 差分生成加载状态
    const [isGeneratingVariation, setIsGeneratingVariation] = useState<boolean>(false);
    const [generatingVariationId, setGeneratingVariationId] = useState<string | null>(null);
    // 一键生成积分提示
    const [npcCostModalOpen, setNpcCostModalOpen] = useState<boolean>(false);
    const [npcCostPoints, setNpcCostPoints] = useState<number | null>(null);
    const [isLoadingNpcCost, setIsLoadingNpcCost] = useState<boolean>(false);
    // 一键生成结果弹窗
    const [npcResultModalOpen, setNpcResultModalOpen] = useState<boolean>(false);
    const [npcGenerationResult, setNpcGenerationResult] = useState<{
        generatedCount: number;
        totalCount: number;
        pointsDeducted: number;
        remainingPoints?: number;
    } | null>(null);


    // 单个角色立绘生成积分确认
    const [singleNpcCostModalOpen, setSingleNpcCostModalOpen] = useState<boolean>(false);
    const [pendingCharacterForGenerate, setPendingCharacterForGenerate] = useState<Character | null>(null);
    // 差分图片生成积分确认
    const [variationCostModalOpen, setVariationCostModalOpen] = useState<boolean>(false);
    const [pendingVariationForGenerate, setPendingVariationForGenerate] = useState<{ variation: Variation; character: Character } | null>(null);
    const attributePanelRef = useRef<CharacterAttributesPanelRef>(null);
    const detailCardRef = useRef<HTMLDivElement>(null);
    const originalCharacterDataRef = useRef<Character[]>([]);
    const [deleteVariationModalOpen, setDeleteVariationModalOpen] = useState(false);
    const [pendingVariationToDelete, setPendingVariationToDelete] = useState<{ variation: Variation; character: Character } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

    // 未保存修改相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    // 立绘预览模式状态（游戏内尺寸/偏移）
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
    /** 点击立绘放大预览 */
    const [portraitLightbox, setPortraitLightbox] = useState<{ src: string; title: string } | null>(null);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchCharacter' | 'switchPanel' | 'createCharacter';
        targetCharacterId?: string | null;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    const [personalityInputValue, setPersonalityInputValue] = useState('');
    const pendingPanelActionRef = useRef<(() => void) | null>(null);
    const addDraftReturnCharacterIdRef = useRef<string | null>(null);

    // 暂存图片状态 - 用于图片上传/生成后、确认前的预览
    const [pendingImages, setPendingImages] = useState<{ [characterId: string]: { [variant: string]: PendingImage } }>({});
    // 暂存图片的 Object URL，需要手动清理
    const pendingImageUrlsRef = useRef<{ [key: string]: string }>({});
    const npcBatchGenerationCancelRef = useRef(false);
    /** 功能注释：批量任务世代号，重试/新开任务时递增，使旧轮询 finally 失效 */
    const npcBatchGenerationSessionRef = useRef(0);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(() => new Set());
    const selectedCharacterIdsRef = useRef(selectedCharacterIds);
    selectedCharacterIdsRef.current = selectedCharacterIds;
    /** 功能注释：是否已按角色列表做过默认全选（避免用户清空勾选后又被刷回全选） */
    const characterSelectionInitializedRef = useRef(false);
    const knownSelectableCharacterIdsRef = useRef<Set<string>>(new Set());

    // 进入页面默认全选；列表新增角色也默认勾选；已删除角色从勾选中剔除
    useEffect(() => {
        const allIds = characterData
            .map((character) => String(character?.id || '').trim())
            .filter(Boolean);
        const allIdSet = new Set(allIds);
        const knownIds = knownSelectableCharacterIdsRef.current;

        setSelectedCharacterIds((prev) => {
            if (allIds.length === 0) {
                characterSelectionInitializedRef.current = false;
                knownSelectableCharacterIdsRef.current = new Set();
                return new Set();
            }

            if (!characterSelectionInitializedRef.current) {
                characterSelectionInitializedRef.current = true;
                knownSelectableCharacterIdsRef.current = allIdSet;
                return new Set(allIds);
            }

            const next = new Set<string>();
            for (const id of prev) {
                if (allIdSet.has(id)) next.add(id);
            }
            for (const id of allIds) {
                if (!knownIds.has(id)) next.add(id);
            }
            knownSelectableCharacterIdsRef.current = allIdSet;
            return next;
        });
    }, [characterData]);

    // 清理暂存图片 Object URL
    const clearPendingImageUrl = (key: string) => {
        if (pendingImageUrlsRef.current[key]) {
            if (pendingImageUrlsRef.current[key].startsWith('blob:')) {
                URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            }
            delete pendingImageUrlsRef.current[key];
        }
    };

    // Canvas 缩放图片（返回缩放后的 Blob）
    const scaleImageWithCanvas = async (
        imageUrl: string,
        scale: number
    ): Promise<Blob | null> => {
        try {
            // 使用 fetch 方式加载图片，避免跨域 CORS 问题
            const response = await fetch(imageUrl);
            if (!response.ok) {
                console.error('fetch 失败:', response.status, response.statusText);
                return null;
            }
            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);
            
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth * scale;
                    canvas.height = img.naturalHeight * scale;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        URL.revokeObjectURL(imgUrl);
                        resolve(null);
                        return;
                    }
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(imgUrl);
                    canvas.toBlob((resultBlob) => {
                        resolve(resultBlob);
                    }, 'image/png');
                };
                img.onerror = (e) => {
                    console.error('Image onerror:', e);
                    URL.revokeObjectURL(imgUrl);
                    resolve(null);
                };
                img.src = imgUrl;
            });
        } catch (error) {
            console.error('scaleImageWithCanvas 异常:', error);
            return null;
        }
    };

    // 清理所有暂存图片
    const clearAllPendingImages = () => {
        Object.keys(pendingImageUrlsRef.current).forEach(key => {
            if (pendingImageUrlsRef.current[key].startsWith('blob:')) {
                URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            }
        });
        pendingImageUrlsRef.current = {};
        setPendingImages({});
    };

    // 仅清理单个角色的暂存图，确保保存失败时不误丢其它角色待保存数据
    const clearPendingImagesForCharacter = useCallback((characterId: string) => {
        const pendingForCharacter = pendingImagesRef.current[characterId];
        if (!pendingForCharacter) return;

        Object.keys(pendingForCharacter).forEach((variant) => {
            clearPendingImageUrl(`${characterId}-${variant}`);
        });

        setPendingImages(prev => {
            const next = { ...prev };
            delete next[characterId];
            return next;
        });
    }, []);

    // 获取有效的图片（优先使用暂存预览，否则使用原图）
    const getEffectiveImage = (character: Character, variant: string): string | undefined => {
        const pending = pendingImages[character.id]?.[variant];
        if (pending?.previewUrl) {
            return pending.previewUrl;
        }
        if (variant === 'base') {
            return character.portrait;
        }
        const variation = character.variations.find(v => v.label === variant);
        return variation?.img;
    };

    // 切换角色时处理暂存图片清理
    const handleCharacterSelect = useCallback((newCharacterId: string) => {
        // 如果当前有暂存图片，恢复原图
        if (activeCharacterId && pendingImages[activeCharacterId]) {
            const originalChar = originalCharacterDataRef.current.find(c => c.id === activeCharacterId);
            if (originalChar) {
                setCharacterData(prev => prev.map(char => {
                    if (char.id !== activeCharacterId) return char;
                    return originalChar;
                }));
            }
            Object.keys(pendingImages[activeCharacterId]).forEach(variant => {
                clearPendingImageUrl(`${activeCharacterId}-${variant}`);
            });
        }
        setFieldErrors({});
        setActiveCharacterId(newCharacterId);
    }, [activeCharacterId, pendingImages]);

    // 切换面板时清理所有暂存图片
    useEffect(() => {
        return () => {
            clearAllPendingImages();
        };
    }, []);

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    const pendingImagesRef = useRef(pendingImages);
    const activeCharacterIdRef = useRef(activeCharacterId);
    const cloneCharacters = useCallback((list: Character[]): Character[] => (
        list.map((character) => ({
            ...character,
            personality: [...character.personality],
            relationships: character.relationships.map((relationship) => ({ ...relationship })),
            variations: character.variations.map((variation) => ({ ...variation })),
        }))
    ), []);
    const buildCharactersFromGameData = useCallback((sourceGameData: AllGameData | WorldInteractionGameData): Character[] => {
        const convertedCharacters: Character[] = [];

        if (sourceGameData.worldSetting.player) {
            convertedCharacters.push(playerToCharacter(sourceGameData.worldSetting.player));
        }

        const npcs = getNpcs(sourceGameData);
        if (npcs && npcs.length > 0) {
            const npcCharacters = npcs.map((npc: NPC | WorldNPC, index: number) => npcToCharacter(npc, index));
            convertedCharacters.push(...npcCharacters);
        }

        return convertedCharacters;
    }, []);
    const commitSavedCharacters = useCallback((
        nextCharacters: Character[],
        nextActiveCharacterId: string,
        options?: { clearAddState?: boolean },
    ) => {
        setCharacterData(nextCharacters);
        originalCharacterDataRef.current = cloneCharacters(nextCharacters);
        setActiveCharacterId(nextActiveCharacterId);
        setHasUnsavedChanges(false);

        if (options?.clearAddState) {
            setIsAddingNew(false);
            setNewCharacterData(null);
            addDraftReturnCharacterIdRef.current = null;
        }
    }, [cloneCharacters]);

    const resolveExistingCharacterId = useCallback((preferredCharacterId?: string | null) => {
        if (preferredCharacterId && characterData.some((character) => character.id === preferredCharacterId)) {
            return preferredCharacterId;
        }

        const returnCharacterId = addDraftReturnCharacterIdRef.current;
        if (returnCharacterId && characterData.some((character) => character.id === returnCharacterId)) {
            return returnCharacterId;
        }

        return characterData[0]?.id || '';
    }, [characterData]);

    const discardNewCharacterDraft = useCallback((options?: { nextCharacterId?: string | null }) => {
        const nextCharacterId = resolveExistingCharacterId(options?.nextCharacterId);

        setFieldErrors({});
        setHasUnsavedChanges(false);
        setIsAddingNew(false);
        setNewCharacterData(null);
        setActiveCharacterId(nextCharacterId);
        addDraftReturnCharacterIdRef.current = null;
    }, [resolveExistingCharacterId]);

    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);

    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    useEffect(() => {
        activeCharacterIdRef.current = activeCharacterId;
    }, [activeCharacterId]);

    useEffect(() => {
        pendingImagesRef.current = pendingImages;
    }, [pendingImages]);

    // 检测是否有未保存的修改（通过比较当前数据和原始数据）
    // 这里有意忽略图片字段（portrait / variations.img），避免「已上传并保存的图片」导致误判为未保存
    useEffect(() => {
        if (originalCharacterDataRef.current.length === 0) {
            return;
        }

        // 归一化角色数据：排除临时角色，并忽略图片相关字段
        const normalizeCharacters = (list: Character[]) =>
            list
                .filter(c => !c.id.startsWith('temp-'))
                .map((c) => ({
                    ...c,
                    portrait: '', // 忽略基础立绘
                    variations: c.variations.map(v => ({
                        ...v,
                        img: '', // 忽略差分图片
                    })),
                }));

        const currentDataStr = JSON.stringify(normalizeCharacters(characterData));
        const originalDataStr = JSON.stringify(normalizeCharacters(originalCharacterDataRef.current));
        const hasChanges = currentDataStr !== originalDataStr;
        
        // 如果数据确实有变化，则设置
        if (hasChanges) {
            setHasUnsavedChanges(true);
        } else {
            // 如果数据没有变化，清除标记
            setHasUnsavedChanges(false);
        }
    }, [characterData]);

    // 当 gameData 变化时，回填最新角色数据
    useEffect(() => {
        if (!gameData) return;

        const convertedCharacters = buildCharactersFromGameData(gameData);
        setCharacterData(convertedCharacters);
        originalCharacterDataRef.current = cloneCharacters(convertedCharacters);
        setHasUnsavedChanges(false);

        setActiveCharacterId((prev) => {
            if (prev && convertedCharacters.some((character) => character.id === prev)) {
                return prev;
            }
            return convertedCharacters[0]?.id || '';
        });
    }, [buildCharactersFromGameData, cloneCharacters, gameData]);

    // 将 characterData 转换为 npcSetting 格式
    const getNpcSettingData = useCallback((): NPCSetting | WorldNPCSetting | null => {
        if (!gameData?.npcSetting) return null;

        // 过滤掉玩家角色，只处理 NPC
        const npcs = characterData
            .filter(char => char.id !== 'player')
            .map(char => {
                const identityParts = char.identity.split(' · ');
                const race = identityParts.length > 1 ? identityParts[0] : undefined;
                const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || char.role);

                // 将 variations 转换回 images 对象（variations 中不包含 base，base 存储在 portrait 中）
                // 键名格式：type_value（如 "clothing_happy"）
                const images: { base: string; [key: string]: string } = {
                    base: char.portrait || '', // base 图片来自 portrait
                };
                const variationDescriptions: Record<string, string> = {};
                char.variations
                    .filter(v => v.label !== 'base') // 确保不包含 base
                    .forEach(variation => {
                        const key = variation.type && variation.label
                            ? `${variation.type}_${variation.label}`
                            : variation.label || variation.type || '';
                        if (variation.img) {
                            // 键名格式：type_value
                            if (key) {
                                images[key] = variation.img;
                            }
                        }
                        const description = variation.description?.trim();
                        if (key && description) {
                            variationDescriptions[key] = description;
                        }
                    });

                const finalImages: { base: string; [key: string]: string } | undefined = 
                    char.portrait || Object.keys(images).length > 1 ? images : undefined;
                const finalVariationDescriptions: Record<string, string> | undefined =
                    Object.keys(variationDescriptions).length > 0 ? variationDescriptions : undefined;

                // 获取与玩家的关系（从 relationships 中查找）
                const playerRelationship = char.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

                return {
                    id: char.id,
                    name: char.name,
                    callName: char.callName || '',
                    gender: char.gender,
                    job: job || undefined,
                    race: race || undefined,
                    description: char.background || '',
                    appearance: char.appearance || '',
                    personality: stringifyPersonalityTags(char.personality) || undefined,
                    tone: char.speech || '',
                    relationship: playerRelationship?.description || undefined,
                    images: finalImages,
                    variationDescriptions: finalVariationDescriptions,
                };
            });

        return {
            npcs,
        };
    }, [characterData, gameData]);

    // 执行待处理的操作
    const executePendingAction = useCallback(() => {
        const action = pendingAction;
        const pendingPanelAction = pendingPanelActionRef.current;

        setPendingAction(null);
        pendingPanelActionRef.current = null;

        if (!action) {
            if (pendingPanelAction) {
                pendingPanelAction();
            }
            return;
        }

        if (action.type === 'switchCharacter') {
            if (isAddingNew) {
                discardNewCharacterDraft({ nextCharacterId: action.targetCharacterId || null });
                return;
            }

            setFieldErrors({});
            setActiveCharacterId(action.targetCharacterId || '');
            return;
        }

        if (action.type === 'switchPanel') {
            if (isAddingNew) {
                discardNewCharacterDraft();
            }
            if (pendingPanelAction) {
                pendingPanelAction();
            }
            return;
        }

        if (action.type === 'createCharacter') {
            return;
        }
    }, [discardNewCharacterDraft, isAddingNew, pendingAction]);

    // 丢弃当前角色的暂存立绘并恢复到原始数据
    const discardCurrentCharacterPendingImages = useCallback(() => {
        if (!activeCharacterId) return;

        const originalChar = originalCharacterDataRef.current.find(c => c.id === activeCharacterId);
        if (originalChar) {
            setCharacterData(prev => prev.map(char => (
                char.id === activeCharacterId ? originalChar : char
            )));
        }
        clearPendingImagesForCharacter(activeCharacterId);
    }, [activeCharacterId, clearPendingImagesForCharacter]);

    // 检查是否可以切换（如果有未保存修改或暂存图片，显示确认弹窗）
    const checkBeforeSwitch = useCallback((action: { type: 'switchCharacter' | 'switchPanel' | 'createCharacter'; targetCharacterId?: string | null }) => {
        // 检查是否有暂存图片
        const hasPendingImages = activeCharacterId && pendingImages[activeCharacterId] && Object.keys(pendingImages[activeCharacterId]).length > 0;
        if (hasPendingImages || hasUnsavedChanges) {
            pendingPanelActionRef.current = null;
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            isBlockingSwitchRef.current = true;
            return false;
        }
        return true;
    }, [hasUnsavedChanges, activeCharacterId, pendingImages]);

    // 暴露给父组件的方法，用于在切换面板前检查
    useImperativeHandle(ref, () => ({
        checkBeforeLeave: (action?: () => void) => {
            const hasChanges = hasUnsavedChangesRef.current;
            const isBlocking = isBlockingSwitchRef.current;
            const currentActiveCharacterId = activeCharacterIdRef.current;
            const pendingForActiveCharacter = currentActiveCharacterId
                ? pendingImagesRef.current[currentActiveCharacterId]
                : undefined;
            const hasPendingImages = !!pendingForActiveCharacter &&
                Object.keys(pendingForActiveCharacter).length > 0;

            if ((hasChanges || hasPendingImages) && !isBlocking) {
                pendingPanelActionRef.current = action || null;
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
                isBlockingSwitchRef.current = true;
                return false;
            }

            if (isBlocking) {
                return false;
            }

            return true;
        },
    }), []);

    // 提供给父组件的数据获取函数
    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const npcSetting = getNpcSettingData();
                if (!npcSetting) return null;
                return { npcSetting };
            });
        }
    }, [onGetData, getNpcSettingData]);

    // 创建业务逻辑handlers
    const handlers = useMemo(() => {
        if (!fileId) return null;
        return createHandlers({
            fileId,
            mode,
            api,
            userPoints,
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
            pendingImages,
            pendingImageUrlsRef,
            npcBatchGenerationCancelRef,
            npcBatchGenerationSessionRef,
            selectedCharacterIdsRef,
            onDataChange,
            t,
        });
    }, [fileId, mode, api, userPoints, characterData, activeCharacterId, isAddingNew, newCharacterData, pendingImages, pendingImageUrlsRef, onDataChange]);

    // 获取当前显示的角色（统一处理新增和编辑模式）
    const currentCharacter = isAddingNew && newCharacterData
        ? newCharacterData
        : (characterData.find(c => c.id === activeCharacterId) || characterData[0]);

    useEffect(() => {
        // 切换角色后自动回到详情顶部，确保优先看到基础立绘区域
        if (detailCardRef.current) {
            detailCardRef.current.scrollTop = 0;
        }
    }, [activeCharacterId, isAddingNew]);

    // 切换角色时同步 portraitScale
    useEffect(() => {
        if (currentCharacter && currentCharacter.portraitScale !== undefined) {
            setPreviewScale(currentCharacter.portraitScale);
        }
    }, [currentCharacter?.id]);

    useEffect(() => {
        // 保留用户输入态，确认保存时再统一格式
        setPersonalityInputValue(currentCharacter?.personality.join(' / ') ?? '');
    }, [currentCharacter?.id, currentCharacter?.personality, isAddingNew]);

    // 获取当前角色的属性设置（仅在 worldInteraction 模式下）
    const isWorldInteractionMode = mode === 'worldInteraction';
    const attributeSetting = isWorldInteractionMode && gameData && 'attributeSetting' in gameData
        ? gameData.attributeSetting
        : undefined;

    // 获取当前 NPC 的属性（来自 npcSetting.npcs[].attributes），用于统一使用 npcSetting 中的属性状态
    const currentNpcAttributes = useMemo(() => {
        if (!isWorldInteractionMode || !gameData || !currentCharacter || currentCharacter.id === 'player') {
            return undefined;
        }
        if (!('npcSetting' in gameData) || !gameData.npcSetting) {
            return undefined;
        }
        const worldNpc = (gameData as WorldInteractionGameData).npcSetting.npcs?.find(
            (npc) => npc.id === currentCharacter.id,
        );
        return worldNpc?.attributes;
    }, [isWorldInteractionMode, gameData, currentCharacter]);

    const currentPortraitImage = currentCharacter
        ? getEffectiveImage(currentCharacter, 'base')
        : undefined;
    // 使用 useMemo 缓存 displayPortraitImage，避免每次渲染都调用 withCacheBust 生成新时间戳
    // 防止 CharacterLayer 的 key 变化导致不必要的重新挂载
    const displayPortraitImage = useMemo(() => {
        if (!currentPortraitImage) return DEFAULT_NPC_PORTRAIT;
        if (currentPortraitImage.startsWith('blob:') || currentPortraitImage.startsWith('data:')) {
            return currentPortraitImage;
        }
        return withCacheBust(currentPortraitImage);
    }, [currentPortraitImage]);
    const isCurrentPortraitGenerating = Boolean(
        currentCharacter && isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id,
    );
    const batchCharacterCount = useMemo(
        () => characterData.filter((character) => !character.id.startsWith('temp-')).length,
        [characterData],
    );
    const effectiveBatchCharacterCount = Math.max(
        0,
        Number(npcBatchJobStatus?.totalCount ?? batchCharacterCount) || 0,
    );
    const batchGenerationLogs = useMemo(() => {
        const raw = npcBatchJobStatus?.logs;
        if (!Array.isArray(raw) || raw.length === 0) return [];

        const inferStage = (message: string, stage?: string) => {
            const known = String(stage || '').trim();
            if (known) return known;
            if (/失败/.test(message)) return 'fail';
            if (/全部完成/.test(message)) return 'item_done';
            if (/抠图完成/.test(message)) return 'rembg_done';
            if (/抠图/.test(message)) return 'rembg_start';
            if (/完成了.*生图|生图完成/.test(message)) return 'generate_done';
            if (/生图/.test(message)) return 'generate_start';
            if (/开始/.test(message)) return 'batch_start';
            return 'info';
        };

        return raw
            .map((entry) => {
                if (typeof entry === 'string') {
                    const message = entry.trim();
                    if (!message) return null;
                    return { message, stage: inferStage(message) };
                }
                if (entry && typeof entry === 'object' && typeof entry.message === 'string') {
                    const message = entry.message.trim();
                    if (!message) return null;
                    return {
                        message,
                        stage: inferStage(message, entry.stage),
                        name: typeof entry.name === 'string' ? entry.name : undefined,
                        id: typeof (entry as { id?: string }).id === 'string'
                            ? String((entry as { id?: string }).id)
                            : undefined,
                        index: Number.isFinite(Number((entry as { index?: number }).index))
                            ? Number((entry as { index?: number }).index)
                            : undefined,
                    };
                }
                return null;
            })
            .filter((item): item is {
                message: string;
                stage: string;
                name?: string;
                id?: string;
                index?: number;
            } => Boolean(item));
    }, [npcBatchJobStatus?.logs]);

    // 本阶段耗时本地每秒刷新（轮询间隔 1.5s，否则会长时间停在 0s）
    const [batchBoardNowMs, setBatchBoardNowMs] = useState(() => Date.now());

    const batchStageBoard = useMemo(() => {
        const total = Math.max(0, Number(npcBatchJobStatus?.totalCount ?? effectiveBatchCharacterCount) || 0);
        const backendItems = Array.isArray(npcBatchJobStatus?.items) ? npcBatchJobStatus.items : [];

        type BoardItem = {
            index: number;
            id?: string;
            name: string;
            stage: string;
            stageElapsedSeconds: number;
        };

        const stageLabel = (stage: string) => {
            if (stage === 'generate_start') return '生图中';
            if (stage === 'generate_done') return '待抠图';
            if (stage === 'rembg_start') return '抠图中';
            if (stage === 'rembg_done') return '抠图完成';
            if (stage === 'item_done') return '已完成';
            if (stage === 'generate_fail') return '生图失败';
            if (stage === 'rembg_fail') return '抠图失败';
            if (stage === 'pending') return '排队中';
            return '等待中';
        };

        const stageRank = (stage: string) => {
            switch (stage) {
                case 'pending': return 0;
                case 'generate_start': return 1;
                case 'generate_done': return 2;
                case 'rembg_start': return 3;
                case 'rembg_done': return 4;
                case 'item_done':
                case 'generate_fail':
                case 'rembg_fail':
                    return 5;
                default: return -1;
            }
        };
        const advanceStage = (current: string, next: string) => {
            if (!next || next === current) return current;
            if (next === 'generate_fail' || next === 'rembg_fail') return next;
            return stageRank(next) > stageRank(current) ? next : current;
        };

        let items: BoardItem[] = [];
        const hasBackendBoard = backendItems.length > 0;
        // 启动占位（jobId 为空）或尚无分项时，只展示排队槽，禁止用旧日志拼板
        const isBootstrap = !npcBatchJobStatus?.jobId;
        if (hasBackendBoard && !isBootstrap) {
            items = backendItems.map((row) => {
                const stageUpdatedAtMs = Date.parse(String(row.stageUpdatedAt || row.updatedAt || ''));
                const localElapsed = Number.isFinite(stageUpdatedAtMs)
                    ? Math.max(0, Math.floor((batchBoardNowMs - stageUpdatedAtMs) / 1000))
                    : Math.max(0, Number(row.stageElapsedSeconds) || 0);
                let stage = row.stage || 'pending';
                // 后端硬超时 120s / 治愈 130s；若 KV 被僵尸写回盖住，前端 130s 强制按失败展示以便重试
                if (stage === 'generate_start' && localElapsed >= 130) {
                    stage = 'generate_fail';
                } else if (stage === 'rembg_start' && localElapsed >= 180) {
                    stage = 'rembg_fail';
                }
                return {
                    index: Number(row.index) || 0,
                    id: row.id ? String(row.id) : undefined,
                    name: row.name || `第 ${(Number(row.index) || 0) + 1} 张`,
                    stage,
                    stageElapsedSeconds: localElapsed,
                };
            });
        } else if (!isBootstrap && batchGenerationLogs.length > 0) {
            const byIndex = new Map<number, BoardItem>();
            for (const entry of batchGenerationLogs) {
                const match = entry.message.match(/第\s*(\d+)\s*张/);
                const index = Number.isFinite(Number(entry.index))
                    ? Number(entry.index)
                    : (match ? Number(match[1]) - 1 : -1);
                if (index < 0) continue;
                const nameMatch = entry.message.match(/（([^）]+)）/);
                const rawStage = entry.stage === 'fail'
                    ? (/生图/.test(entry.message) ? 'generate_fail' : 'rembg_fail')
                    : entry.stage;
                const prev = byIndex.get(index);
                byIndex.set(index, {
                    index,
                    id: entry.id ? String(entry.id) : prev?.id,
                    name: entry.name || nameMatch?.[1] || prev?.name || `第 ${index + 1} 张`,
                    stage: prev ? advanceStage(prev.stage, rawStage) : rawStage,
                    stageElapsedSeconds: 0,
                });
            }
            items = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
        }

        // 日志往往比 items 更新更完整：用日志把分项阶段单调补齐，避免顶部生图数被打回
        if (!isBootstrap && items.length > 0 && batchGenerationLogs.length > 0) {
            const byIndex = new Map(items.map((item) => [item.index, item]));
            for (const entry of batchGenerationLogs) {
                const match = entry.message.match(/第\s*(\d+)\s*张/);
                const index = Number.isFinite(Number(entry.index))
                    ? Number(entry.index)
                    : (match ? Number(match[1]) - 1 : -1);
                if (index < 0) continue;
                const rawStage = entry.stage === 'fail'
                    ? (/生图/.test(entry.message) ? 'generate_fail' : 'rembg_fail')
                    : entry.stage;
                if (!rawStage || ['batch_start', 'info'].includes(rawStage)) continue;
                const nameMatch = entry.message.match(/（([^）]+)）/);
                const prev = byIndex.get(index);
                if (!prev) {
                    byIndex.set(index, {
                        index,
                        id: entry.id ? String(entry.id) : undefined,
                        name: entry.name || nameMatch?.[1] || `第 ${index + 1} 张`,
                        stage: rawStage,
                        stageElapsedSeconds: 0,
                    });
                    continue;
                }
                prev.stage = advanceStage(prev.stage, rawStage);
                if (entry.id) prev.id = String(entry.id);
                if (entry.name || nameMatch?.[1]) {
                    prev.name = entry.name || nameMatch?.[1] || prev.name;
                }
            }
            items = Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
        }

        if (total > 0) {
            const known = new Set(items.map((item) => item.index));
            for (let i = 0; i < total; i += 1) {
                if (!known.has(i)) {
                    items.push({
                        index: i,
                        name: `第 ${i + 1} 张`,
                        stage: 'pending',
                        stageElapsedSeconds: 0,
                    });
                }
            }
            items.sort((a, b) => a.index - b.index);
        }

        // 始终按分项重算；勿盲信后端 stageStats（旧逻辑会把 rembg_fail 踢出生图完成数）
        const stats = {
            generateActive: items.filter((i) => i.stage === 'generate_start').length,
            generateDone: items.filter((i) => [
                'generate_done', 'rembg_start', 'rembg_done', 'item_done', 'rembg_fail',
            ].includes(i.stage)).length,
            // rembg_done 仍在结账到 item_done，摘要「进行中」也要算上，避免日志已抠图而顶栏显示 0
            rembgActive: items.filter((i) => i.stage === 'rembg_start' || i.stage === 'rembg_done').length,
            rembgDone: items.filter((i) => ['rembg_done', 'item_done'].includes(i.stage)).length,
            failed: items.filter((i) => i.stage === 'generate_fail' || i.stage === 'rembg_fail').length,
            pending: items.filter((i) => i.stage === 'pending').length,
            total,
        };

        // 生图硬超时 120s；前端 90s 起标卡住并允许重试 CTA
        const stuckItems = items.filter((item) => {
            if (item.stage === 'generate_start') return item.stageElapsedSeconds >= 90;
            if (item.stage === 'rembg_start') return item.stageElapsedSeconds >= 90;
            return false;
        });

        return {
            total,
            items: items.map((item) => ({
                ...item,
                label: stageLabel(item.stage),
            })),
            stats: {
                generateActive: Number(stats.generateActive) || 0,
                generateDone: Number(stats.generateDone) || 0,
                rembgActive: Number(stats.rembgActive) || 0,
                rembgDone: Number(stats.rembgDone) || 0,
                failed: Number(stats.failed) || 0,
                pending: Number(stats.pending) || 0,
                total,
            },
            stuckItems,
        };
    }, [batchBoardNowMs, batchGenerationLogs, effectiveBatchCharacterCount, npcBatchJobStatus]);

    const batchFailedItems = useMemo(
        () => batchStageBoard.items.filter(
            (item) => item.stage === 'generate_fail' || item.stage === 'rembg_fail',
        ),
        [batchStageBoard.items],
    );
    const batchRetryTargetItems = useMemo(
        () => listBatchNpcRetryTargetItems(batchStageBoard.items),
        [batchStageBoard.items],
    );
    // 全终态有失败，或有卡住项（≥90s）→ 立刻展示重试（不依赖 job.status）
    const showContinueFailedTasks = useMemo(
        () => shouldShowRetryIncompleteBatchTasks(
            batchStageBoard.items,
            batchStageBoard.total || effectiveBatchCharacterCount,
        ),
        [batchStageBoard.items, batchStageBoard.total, effectiveBatchCharacterCount],
    );
    const isBatchNpcJobRunning = (
        isGeneratingNpcImages
        || (
            npcBatchJobStatus != null
            && ['queued', 'running', 'pending'].includes(String(npcBatchJobStatus.status || ''))
        )
    ) && !showContinueFailedTasks;
    const isBatchNpcJobActive = isBatchNpcJobRunning || showContinueFailedTasks;

    useEffect(() => {
        // 卡住重试态也要继续刷新本阶段耗时
        if (!isBatchNpcJobActive) return;
        setBatchBoardNowMs(Date.now());
        const timer = window.setInterval(() => setBatchBoardNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [isBatchNpcJobActive]);

    const batchItemStageClass = (stage: string) => {
        if (stage === 'generate_start' || stage === 'generate_done') return styles.plusLoadingItemGen;
        if (stage === 'rembg_start' || stage === 'rembg_done') return styles.plusLoadingItemCut;
        if (stage === 'item_done') return styles.plusLoadingItemDone;
        if (stage === 'generate_fail' || stage === 'rembg_fail') return styles.plusLoadingItemFail;
        return styles.plusLoadingItemPending;
    };

    const batchLogStageLabel = (stage: string) => {
        if (stage === 'generate_start') return '生图';
        if (stage === 'generate_done') return '生图✓';
        if (stage === 'rembg_start') return '抠图';
        if (stage === 'rembg_done') return '抠图✓';
        if (stage === 'item_done') return '完成';
        if (stage === 'generate_fail' || stage === 'rembg_fail' || stage === 'fail') return '失败';
        if (stage === 'batch_start') return '启动';
        return '进度';
    };
    const batchLogStageClass = (stage: string, isActive: boolean) => {
        const base = isActive ? styles.plusLoadingLogRowActive : styles.plusLoadingLogRow;
        if (stage === 'generate_start' || stage === 'generate_done') {
            return `${base} ${styles.plusLoadingLogRowGen}`;
        }
        if (stage === 'rembg_start' || stage === 'rembg_done') {
            return `${base} ${styles.plusLoadingLogRowCut}`;
        }
        if (stage === 'item_done') {
            return `${base} ${styles.plusLoadingLogRowDone}`;
        }
        if (stage === 'generate_fail' || stage === 'rembg_fail' || stage === 'fail') {
            return `${base} ${styles.plusLoadingLogRowFail}`;
        }
        return base;
    };
    const batchLogListRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!isBatchNpcJobActive || !batchLogListRef.current) return;
        batchLogListRef.current.scrollTop = batchLogListRef.current.scrollHeight;
    }, [isBatchNpcJobActive, batchGenerationLogs.length]);
    const singleCharacterEtaText = useGenerationEta({
        active: isCurrentPortraitGenerating,
        totalSeconds: currentCharacter?.id === 'player' ? SINGLE_PLAYER_ETA_SECONDS : SINGLE_CHARACTER_ETA_SECONDS,
    });
    const batchCharacterEtaText = useGenerationEta({
        active: isBatchNpcJobRunning,
        totalSeconds: Math.max(
            SINGLE_CHARACTER_ETA_SECONDS,
            effectiveBatchCharacterCount * SINGLE_CHARACTER_ETA_SECONDS + BATCH_CHARACTER_BUFFER_SECONDS,
        ),
        totalCount: effectiveBatchCharacterCount,
        completedCount: npcBatchJobStatus?.completedCount,
        status: npcBatchJobStatus?.status,
        estimatedRemainingSeconds: npcBatchJobStatus?.estimatedRemainingSeconds ?? null,
        progressMode: 'pipeline',
        batchLabel: undefined,
        // 分项看板已有进度，隐藏「剩余 xx」倒计时
        showRemaining: false,
    });

    const isPortraitActionBusy = isUploadingPortrait
        || isSavingCharacter
        || isCurrentPortraitGenerating
        || isBatchNpcJobActive
        || isGeneratingVariation;

    const currentCharacterBaseline = useMemo(() => {
        if (!currentCharacter) {
            return null;
        }

        if (isAddingNew) {
            return {
                ...currentCharacter,
                name: '',
                callName: '',
                gender: '',
                identity: '',
                personality: [],
                speech: '',
                appearance: '',
                background: '',
            };
        }

        const savedCharacter = originalCharacterDataRef.current.find((character) => character.id === currentCharacter.id);
        return savedCharacter || null;
    }, [currentCharacter, isAddingNew]);

    const characterFieldDirtyState = useMemo<CharacterFieldDirtyState>(() => {
        if (!currentCharacter || !currentCharacterBaseline) {
            return EMPTY_CHARACTER_FIELD_DIRTY_STATE;
        }

        const normalizedCurrentPersonality = normalizePersonalityTags(personalityInputValue);
        const normalizedSavedPersonality = normalizePersonalityTags(
            stringifyPersonalityTags(currentCharacterBaseline.personality)
        );

        return {
            name: (currentCharacter.name || '') !== (currentCharacterBaseline.name || ''),
            callName: (currentCharacter.callName || '') !== (currentCharacterBaseline.callName || ''),
            gender: (currentCharacter.gender || '') !== (currentCharacterBaseline.gender || ''),
            identity: (currentCharacter.identity || '') !== (currentCharacterBaseline.identity || ''),
            personality: JSON.stringify(normalizedCurrentPersonality) !== JSON.stringify(normalizedSavedPersonality),
            speech: (currentCharacter.speech || '') !== (currentCharacterBaseline.speech || ''),
            appearance: (currentCharacter.appearance || '') !== (currentCharacterBaseline.appearance || ''),
            background: (currentCharacter.background || '') !== (currentCharacterBaseline.background || ''),
            positioningIdentity:
                (currentCharacter.positioningIdentity || '')
                !== (currentCharacterBaseline.positioningIdentity || ''),
            positioningTraits:
                (currentCharacter.positioningTraits || '')
                !== (currentCharacterBaseline.positioningTraits || ''),
            positioningSecret:
                (currentCharacter.positioningSecret || '')
                !== (currentCharacterBaseline.positioningSecret || ''),
        };
    }, [currentCharacter, currentCharacterBaseline, personalityInputValue]);

    // 更新角色字段（统一处理新增和编辑模式）
    const updateField = (field: keyof Character, value: string | string[]) => {
        if (isAddingNew && newCharacterData) {
            // 新增模式
            setNewCharacterData({ ...newCharacterData, [field]: value });
        } else {
            // 正常模式
            setCharacterData(prev =>
                prev.map(char =>
                    char.id === activeCharacterId ? { ...char, [field]: value } : char
                )
            );
        }
    };

    const handleFieldChange = (field: keyof Character, value: string) => {
        updateField(field, value);
        setHasUnsavedChanges(true);

        // 清除该字段的错误状态
        if (fieldErrors[field as string]) {
            setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field as string];
                return newErrors;
            });
        }
    };

    const buildCharacterToSave = useCallback((character: Character | null | undefined): Character | null => {
        if (!character) {
            return null;
        }

        // 如果在预览模式下调整了缩放，保存时应用缩放比例
        const portraitScale = (isPreviewMode && previewScale !== 1) ? previewScale : character.portraitScale;

        return {
            ...character,
            // 用户确认修改后再统一性格标签格式
            personality: normalizePersonalityTags(personalityInputValue),
            // 保存立绘缩放比例
            portraitScale: portraitScale !== 1 ? portraitScale : undefined,
        };
    }, [personalityInputValue, isPreviewMode, previewScale]);

    // 字数统计
    const nameWords = useWordCount(currentCharacter?.name ?? '');
    const genderWords = useWordCount(currentCharacter?.gender ?? '');
    const identityWords = useWordCount(currentCharacter?.identity ?? '');
    const personalityWords = useWordCount(personalityInputValue);
    const speechWords = useWordCount(currentCharacter?.speech ?? '');
    const appearanceWords = useWordCount(currentCharacter?.appearance ?? '');
    const backgroundWords = useWordCount(currentCharacter?.background ?? '');
    const positioningIdentityWords = useWordCount(currentCharacter?.positioningIdentity ?? '');
    const positioningTraitsWords = useWordCount(currentCharacter?.positioningTraits ?? '');
    const positioningSecretWords = useWordCount(currentCharacter?.positioningSecret ?? '');

    // 字数限制处理
    const nameLimit = useWordLimit(CHARACTER_WORD_LIMITS.name, (value) => handleFieldChange('name', value));
    const genderLimit = useWordLimit(CHARACTER_WORD_LIMITS.gender, (value) => handleFieldChange('gender', value));
    const identityLimit = useWordLimit(CHARACTER_WORD_LIMITS.identity, (value) => handleFieldChange('identity', value));
    const speechLimit = useWordLimit(CHARACTER_WORD_LIMITS.speech, (value) => handleFieldChange('speech', value));
    const appearanceLimit = useWordLimit(CHARACTER_WORD_LIMITS.appearance, (value) => handleFieldChange('appearance', value));
    const backgroundLimit = useWordLimit(CHARACTER_WORD_LIMITS.background, (value) => handleFieldChange('background', value));
    const positioningIdentityLimit = useWordLimit(
        CHARACTER_WORD_LIMITS.positioningIdentity,
        (value) => handleFieldChange('positioningIdentity', value),
    );
    const positioningTraitsLimit = useWordLimit(
        CHARACTER_WORD_LIMITS.positioningTraits,
        (value) => handleFieldChange('positioningTraits', value),
    );
    const positioningSecretLimit = useWordLimit(
        CHARACTER_WORD_LIMITS.positioningSecret,
        (value) => handleFieldChange('positioningSecret', value),
    );
    
    // 性格标签特殊处理（需要分割后限制）
    const personalityLimit = useWordLimit(CHARACTER_WORD_LIMITS.personality, (value) => {
        setPersonalityInputValue(value);
        setHasUnsavedChanges(true);
    });

    // 打开新增差分弹窗
    const openAddVariationModal = () => {
        setEditingVariationId(null);
        setNewVariationType('');
        setNewVariationLabel('');
        setNewVariationDescription('');
        setVariationModalOpen(true);
    };

    const openEditVariationModal = (variation: Variation) => {
        setEditingVariationId(variation.id);
        setNewVariationType(variation.type || '');
        setNewVariationLabel(variation.label);
        setNewVariationDescription(variation.description || '');
        setVariationModalOpen(true);
    };

    // 关闭新增差分弹窗
    const closeVariationModal = () => {
        setVariationModalOpen(false);
        setEditingVariationId(null);
        setNewVariationType('');
        setNewVariationLabel('');
        setNewVariationDescription('');
    };

    // 确认添加差分
    const confirmAddVariation = () => {
        if (!newVariationType) {
            toast.error(t('createGame.selectVariationType'));
            return;
        }

        if (!newVariationLabel || !newVariationLabel.trim()) {
            toast.error(t('createGame.enterVariationLabel'));
            return;
        }

        const trimmedLabel = newVariationLabel.trim();

        // 检查差分名称是否重复
        let existingVariations: Variation[] = [];
        if (isAddingNew && newCharacterData) {
            existingVariations = newCharacterData.variations;
        } else if (currentCharacter) {
            existingVariations = currentCharacter.variations;
        }

        const isDuplicate = existingVariations.some(v => v.label === trimmedLabel && v.id !== editingVariationId);
        if (isDuplicate) {
            toast.error(t('createGame.variationExists', { label: trimmedLabel }));
            return;
        }

        if (editingVariationId) {
            const targetVariation = existingVariations.find(v => v.id === editingVariationId);
            if (!targetVariation) {
                toast.error(t('createGame.currentVariationNotFound'));
                return;
            }

            const nextDescription = newVariationDescription || undefined;
            const hasChanged =
                targetVariation.label !== trimmedLabel ||
                (targetVariation.type || '') !== newVariationType ||
                (targetVariation.description || undefined) !== nextDescription;

            if (hasChanged) {
                const updateVariation = (variation: Variation): Variation =>
                    variation.id === editingVariationId
                        ? {
                            ...variation,
                            label: trimmedLabel,
                            type: newVariationType,
                            description: nextDescription,
                        }
                        : variation;

                if (isAddingNew && newCharacterData) {
                    setNewCharacterData({
                        ...newCharacterData,
                        variations: newCharacterData.variations.map(updateVariation),
                    });
                } else if (currentCharacter) {
                    setCharacterData(prev =>
                        prev.map(char =>
                            char.id === currentCharacter.id
                                ? { ...char, variations: char.variations.map(updateVariation) }
                                : char
                        )
                    );
                }
                setHasUnsavedChanges(true);
            }
            closeVariationModal();
            return;
        }

        const newVar: Variation = {
            id: `v-${Date.now()}`,
            label: trimmedLabel,
            img: '',
            type: newVariationType,
            description: newVariationDescription || undefined,
        };

        if (isAddingNew && newCharacterData) {
            // 新增模式
            setNewCharacterData({
                ...newCharacterData,
                variations: [...newCharacterData.variations, newVar],
            });
        } else {
            // 正常模式
            setCharacterData(prev =>
                prev.map(char =>
                    char.id === activeCharacterId
                        ? { ...char, variations: [...char.variations, newVar] }
                        : char
                )
            );
        }
        setHasUnsavedChanges(true);
        closeVariationModal();
    };

    // 差分管理（保留原函数名以兼容）
    const addVariation = () => {
        openAddVariationModal();
    };

    // 打开新增角色面板（使用空角色数据）
    const openAddNewPanel = () => {
        if (!checkBeforeSwitch({ type: 'createCharacter' })) {
            return;
        }
        addDraftReturnCharacterIdRef.current = activeCharacterId || characterData[0]?.id || null;
        setFieldErrors({});
        const emptyCharacter: Character = {
            id: `temp-${Date.now()}`,
            name: '',
            callName: '',
            gender: '',
            role: 'NPC',
            identity: '',
            personality: [],
            speech: '',
            appearance: '',
            portrait: '',
            background: '',
            growth: '',
            goalShort: '',
            goalLong: '',
            secret: '',
            positioningIdentity: '',
            positioningTraits: '',
            positioningSecret: '',
            relationships: [],
            variations: [],
        };
        setNewCharacterData(emptyCharacter);
        setIsAddingNew(true);
        setActiveCharacterId(''); // 清空当前选中
    };

    // {t('common.cancel')}新增
    const cancelAddNew = () => {
        discardNewCharacterDraft();
    };

    // 验证必填字段
    const validateRequiredFields = (character: Character): boolean => {
        const errors: { [key: string]: string } = {};
        
        if (!character.name || !character.name.trim()) {
            errors.name = t('createGame.nameRequired');
        }
        if (!character.gender || !character.gender.trim()) {
            errors.gender = t('createGame.genderRequired');
        }
        if (!character.identity || !character.identity.trim()) {
            errors.identity = t('createGame.identityRequired');
        }
        if (!character.appearance || !character.appearance.trim()) {
            errors.appearance = t('createGame.appearanceRequired');
        }
        if (!character.speech || !character.speech.trim()) {
            errors.speech = t('createGame.speechRequired');
        }
        
        setFieldErrors(errors);
        
        if (Object.keys(errors).length > 0) {
            const firstError = Object.values(errors)[0];
            toast.error(firstError);
            return false;
        }
        
        return true;
    };

    // 确认修改/新增角色（统一处理）
    const confirmEdit = async (options?: { onPrimarySaved?: () => void }): Promise<boolean> => {
        if (!handlers) return false;

        setIsSavingCharacter(true);
        setIsSaveOverlayVisible(true);

        // 用于存储缩放处理后的数据（避免依赖异步的 setState）
        let processedPendingImages: typeof pendingImages = {};

        try {
            console.log('=== confirmEdit 开始 ===');
            console.log('isPreviewMode:', isPreviewMode);
            console.log('previewScale:', previewScale);
            console.log('currentPortraitImage:', currentPortraitImage);
            console.log('activeCharacterId:', activeCharacterId);
            console.log('pendingImages:', pendingImages);

            // 如果预览模式有缩放且不是原尺寸，需要生成缩放后的图片
            if (isPreviewMode && previewScale !== 1 && currentPortraitImage && activeCharacterId) {
                console.log('→ 满足缩放条件，开始处理...');
                console.log('currentPortraitImage (原始):', currentPortraitImage);
                console.log('displayPortraitImage (带cache bust):', displayPortraitImage);
                toast.loading(t('createGame.processingImage'), { id: 'processing-scale' });
                // 使用 fetch 方式加载图片（需要服务器支持 CORS 头）
                const scaledBlob = await scaleImageWithCanvas(displayPortraitImage, previewScale);
                toast.dismiss('processing-scale');
                console.log('scaledBlob:', scaledBlob);

                if (scaledBlob) {
                    console.log('→ scaledBlob 成功，size:', scaledBlob.size, 'type:', scaledBlob.type);
                    const scaledPreviewUrl = URL.createObjectURL(scaledBlob);
                    // 清理旧的预览 URL
                    clearPendingImageUrl(`${activeCharacterId}-base`);
                    pendingImageUrlsRef.current[`${activeCharacterId}-base`] = scaledPreviewUrl;

                    // 创建一个新的 File 对象用于上传
                    const scaledFile = new File(
                        [scaledBlob],
                        `portrait_${Math.round(previewScale * 100)}pct.png`,
                        { type: 'image/png' }
                    );
                    console.log('scaledFile:', scaledFile.name, scaledFile.size);

                    // 直接存储到 processedPendingImages，不依赖异步的 setState
                    processedPendingImages = {
                        ...pendingImages,
                        [activeCharacterId]: {
                            ...(pendingImages[activeCharacterId] || {}),
                            base: {
                                file: scaledFile,
                                previewUrl: scaledPreviewUrl,
                                sourceType: 'upload',
                                variant: 'base',
                                scale: previewScale,
                            },
                        },
                    };
                    console.log('processedPendingImages 已设置:', processedPendingImages);
                    toast.success(t('createGame.imageScaled'));
                } else {
                    console.log('✗ scaledBlob 为空，缩放失败');
                    toast.error(t('createGame.imageScaleFailed'));
                }
            } else {
                console.log('→ 不满足缩放条件，跳过');
                if (!isPreviewMode) console.log('  原因: isPreviewMode = false');
                if (previewScale === 1) console.log('  原因: previewScale === 1');
                if (!currentPortraitImage) console.log('  原因: currentPortraitImage 为空');
                if (!activeCharacterId) console.log('  原因: activeCharacterId 为空');
            }

            const rawCharacterToSave = isAddingNew && newCharacterData
                ? newCharacterData
                : currentCharacter;
            const characterToSave = buildCharacterToSave(rawCharacterToSave);
            if (!characterToSave) {
                return false;
            }

            if (!validateRequiredFields(characterToSave)) {
                return false;
            }

            if (attributePanelRef.current && attributePanelRef.current.hasChanges) {
                const success = await attributePanelRef.current.saveAttributes();
                if (!success) {
                    toast.error(t('createGame.attributeSaveFailed'));
                    return false;
                }
            }

            // 先保存表单
            // 合并已有的 pendingImages 和处理后的数据
            const pendingImagesSnapshot = {
                ...pendingImages,
                ...processedPendingImages,
            };
            const saveResult = await handlers.confirmEdit(characterToSave);
            if (!saveResult.success) {
                console.log('✗ 保存失败');
                return false;
            }

            const characterId = saveResult.savedCharacterId;
            const pendingForSavedCharacter = characterId ? pendingImagesSnapshot[characterId] : undefined;

            commitSavedCharacters(saveResult.characters, saveResult.activeCharacterId, {
                clearAddState: saveResult.clearAddState,
            });
            options?.onPrimarySaved?.();

            // 后{t('common.upload')}
            if (characterId && pendingForSavedCharacter) {
                for (const [variant, pending] of Object.entries(pendingForSavedCharacter)) {
                    if (!pending.file) {
                        continue;
                    }

                    const fileToUpload = pending.file;

                    const uploadSuccess = characterId === 'player'
                        ? await handlers.handleUploadImage(fileToUpload, {
                            type: 'player',
                            variant,
                        })
                        : await handlers.handleUploadImage(fileToUpload, {
                            type: variant === 'base' ? 'npc' : 'variation',
                            characterId,
                            variant,
                        });

                    if (!uploadSuccess) {
                        toast.error(`图片上传失败：${variant}`);
                        return false;
                    }
                }
            }

            if (characterId) {
                clearPendingImagesForCharacter(characterId);
            }

            // 保存成功后退出预览模式并重置缩放
            setIsPreviewMode(false);
            setPreviewScale(1);

            setHasUnsavedChanges(false);
            setFieldErrors({});
            onDataChange?.();

            // 所有操作完成后显示成功提示
            toast.success(isAddingNew ? t('createGame.characterCreated') : t('createGame.characterUpdated'));
            return true;
        } catch (error) {
            console.error('保存时发生错误:', error);
            toast.error(t('createGame.saveError'));
            return false;
        } finally {
            setIsSavingCharacter(false);
            setIsSaveOverlayVisible(false);
        }
    };

    const handleDeleteClick = (characterId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止触发角色选择
        setCharacterToDelete(characterId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!characterToDelete || !handlers) {
            setDeleteModalOpen(false);
            setCharacterToDelete(null);
            return;
        }
        await handlers.handleConfirmDelete(characterToDelete);
        setDeleteModalOpen(false);
        setCharacterToDelete(null);
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setCharacterToDelete(null);
    };

    // 触发文件选择（仅「上传」按钮；有立绘时点击图片走放大预览）
    const handlePortraitUploadClick = () => {
        if (isAddingNew || isPortraitActionBusy) {
            return;
        }
        if (currentCharacter?.id === 'player') {
            playerFileInputRef.current?.click();
        } else {
            npcFileInputRef.current?.click();
        }
    };

    const openPortraitLightbox = useCallback((src: string | null | undefined, title?: string) => {
        if (!src || src === DEFAULT_NPC_PORTRAIT) return;
        const resolved = (src.startsWith('blob:') || src.startsWith('data:'))
            ? src
            : withCacheBust(src);
        setPortraitLightbox({
            src: resolved,
            title: String(title || '').trim(),
        });
    }, []);

    /** 点击大图：有立绘 → 放大预览；无立绘 → 上传 */
    const handlePortraitAreaClick = () => {
        if (isAddingNew || isPortraitActionBusy) return;
        if (currentPortraitImage) {
            openPortraitLightbox(displayPortraitImage, currentCharacter?.name);
            return;
        }
        handlePortraitUploadClick();
    };

    const triggerBlobDownload = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };


    // 统一的{t('common.upload')}方法 - 改为暂存预览模式，不直接上传
    const handleUploadImage = async (
        file: File,
        options: {
            type: 'player' | 'npc' | 'variation';
            characterId?: string | null;
            variant?: string;
            inputRef?: React.RefObject<HTMLInputElement | null> | { current: HTMLInputElement | null };
        }
    ) => {
        if (isAddingNew) {
            toast.error(t('createGame.confirmAddCharacterFirst'));
            return;
        }

        if (isPortraitActionBusy) {
            toast.error(t('createGame.imageTaskProcessing'));
            return;
        }

        setIsUploadingPortrait(true);
        try {
            if (!file.type.startsWith('image/')) {
                toast.error(t('createGame.selectImageFile'));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                toast.error(t('createGame.imageSizeTooLarge'));
                return;
            }

            const { type, characterId, variant = 'base' } = options;
            const targetCharacterId = characterId || activeCharacterId;

            if (!targetCharacterId || (targetCharacterId === 'player' && type !== 'player')) {
                toast.error(t('createGame.missingCharacterId'));
                return;
            }

            const previewUrl = URL.createObjectURL(file);
            const pendingKey = `${targetCharacterId}-${variant}`;
            clearPendingImageUrl(pendingKey);
            pendingImageUrlsRef.current[pendingKey] = previewUrl;

            setCharacterData(prev => prev.map(char => {
                if (char.id !== targetCharacterId) return char;

                if (variant === 'base') {
                    return { ...char, portrait: previewUrl };
                }

                const varIndex = char.variations.findIndex(v => v.label === variant);
                if (varIndex >= 0) {
                    const newVariations = [...char.variations];
                    newVariations[varIndex] = { ...newVariations[varIndex], img: previewUrl };
                    return { ...char, variations: newVariations };
                }

                const newVar: Variation = {
                    id: `v-${Date.now()}`,
                    label: variant,
                    img: previewUrl,
                    type: variant,
                };
                return { ...char, variations: [...char.variations, newVar] };
            }));

            setPendingImages(prev => ({
                ...prev,
                [targetCharacterId]: {
                    ...(prev[targetCharacterId] || {}),
                    [variant]: {
                        file,
                        previewUrl,
                        sourceType: 'upload',
                        variant,
                    },
                },
            }));

            setHasUnsavedChanges(true);
            toast.success(t('createGame.imageStaged'));
        } finally {
            if (options.inputRef && 'current' in options.inputRef && options.inputRef.current) {
                options.inputRef.current.value = '';
            }
            setIsUploadingPortrait(false);
        }
    };

    const handleUploadPlayerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isPortraitActionBusy) return;
        const file = e.target.files?.[0];
        if (!file) return;

        await handleUploadImage(file, {
            type: 'player',
            variant: 'base',
            inputRef: playerFileInputRef,
        });
    };

    const handleUploadNpcImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isPortraitActionBusy) return;
        const file = e.target.files?.[0];
        if (!file) return;

        const characterId = isAddingNew && newCharacterData ? undefined : activeCharacterId;

        await handleUploadImage(file, {
            type: 'npc',
            characterId,
            variant: 'base',
            inputRef: npcFileInputRef,
        });
    };

    // 必填字段列表（除了描述外的所有字段）
    const requiredFields = ['name', 'gender', 'identity', 'appearance', 'speech'];

    const handleUploadVariationImage = async (variation: Variation, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 新增模式下禁止{t('common.upload')}
        if (isAddingNew) {
            toast.error(t('createGame.confirmAddCharacterFirst'));
            return;
        }

        if (!currentCharacter || !handlers) {
            toast.error(t('createGame.missingDataCannotUpload'));
            return;
        }

        const inputRef = { current: variationFileInputRefs.current[variation.id] };

        // 差分图直接上传到服务器，不走暂存流程
        // 构建完整的 variant 键：type_label 格式（如 expression_伤心）
        const variantKey = variation.type && variation.label
            ? `${variation.type}_${variation.label}`
            : variation.label || variation.type || 'base';
        const success = await handlers.handleUploadImage(file, {
            type: 'variation',
            characterId: currentCharacter.id,
            variant: variantKey,
            variationDescription: variation.description || '',
            inputRef,
        });

        // 上传成功后，刷新数据以获取最新的图片路径
        if (success && onDataChange) {
            onDataChange();
        }
    };

    // 点击差分 AI 生成前，先弹出积分确认
    const handleRequestVariationGenerate = (variation: Variation) => {
        if (variantPrice == null) {
            toast.error('生图价格暂不可用，请联系管理员检查业务模型与计费配置');
            return;
        }
        // 新增模式下禁止生成图片
        if (isAddingNew) {
            toast.error(t('createGame.generateImageFirst'));
            return;
        }

        if (!currentCharacter) {
            toast.error(t('createGame.missingDataCannotGenerate'));
            return;
        }
        setPendingVariationForGenerate({ variation, character: currentCharacter });
        setVariationCostModalOpen(true);
    };

    const confirmVariationGenerate = async () => {
        const target = pendingVariationForGenerate;
        setVariationCostModalOpen(false);
        if (!target || !handlers) return;
        setIsGeneratingVariation(true);
        setGeneratingVariationId(target.variation.id);
        try {
            await handlers.regenerateVariationImage(target.variation, target.character);
        } finally {
            setIsGeneratingVariation(false);
            setGeneratingVariationId(null);
        }
        setPendingVariationForGenerate(null);
    };

    const cancelVariationGenerate = () => {
        setVariationCostModalOpen(false);
        setPendingVariationForGenerate(null);
    };

    const generateAllNpcImages = async () => {
        if (!handlers) return;
        await handlers.generateAllNpcImages(npcCostPoints);
    };

    const openNpcCostModal = async () => {
        if (characterPrice == null) {
            toast.error('生图价格暂不可用，请联系管理员检查业务模型与计费配置');
            return;
        }
        if (!handlers) return;
        await handlers.openNpcCostModal();
    };

    const confirmGenerateAllNpcImages = async () => {
        if (npcCostPoints != null && userPoints < npcCostPoints) {
            toast.error(t('createGame.insufficientPoints'));
            return;
        }
        setNpcCostModalOpen(false);
        // 关闭积分弹窗后立刻清进度，避免遮罩打开时闪上一轮数据
        setNpcBatchJobStatus(null);
        // 功能注释：走 handlers 内 pendingBatchSelection（失败重试时仅为未完成 id，不含已完成）
        await generateAllNpcImages();
        onDataChange?.();
    };

    const handleContinueFailedBatchTasks = async () => {
        if (!handlers) return;
        // 功能注释：只解析失败/卡住/排队项 id，已完成（item_done/rembg_done）已被 listBatchNpcRetryTargetItems 排除
        const uniqueIds = resolveRetryCharacterIdsFromBoard(
            batchRetryTargetItems,
            (name) => characterData.find((char) => char.name === name && !char.id.startsWith('temp-'))?.id,
        );
        if (uniqueIds.length === 0) {
            toast.error(t('createGame.selectCharactersToGenerate'));
            return;
        }
        await handlers.continueFailedBatchNpcImages(uniqueIds);
    };

    const showBatchNpcProgressOverlay = shouldShowBatchProgressOverlay({
        batchJobActive: isBatchNpcJobActive,
        costModalOpen: npcCostModalOpen,
        resultModalOpen: npcResultModalOpen,
    });

    const regenerateSingleNpcImage = async (character: Character) => {
        if (!handlers) return;
        if (character.name === gameData?.worldSetting?.player?.name) {
            await handlers.regeneratePlayerImage(character);
        } else {
            await handlers.regenerateNpcImage(character);
        }
    };

    // 点击单个 AI 生成前，先弹出积分确认
    const handleRequestSingleNpcGenerate = (character: Character) => {
        if (characterPrice == null) {
            toast.error('生图价格暂不可用，请联系管理员检查业务模型与计费配置');
            return;
        }
        if (!fileId) {
            toast.error(t('createGame.missingDataCannotGenerate'));
            return;
        }
        setPendingCharacterForGenerate(character);
        setSingleNpcCostModalOpen(true);
    };

    const confirmSingleNpcGenerate = async () => {
        const target = pendingCharacterForGenerate;
        setSingleNpcCostModalOpen(false);
        if (!target) return;
        await regenerateSingleNpcImage(target);
        setPendingCharacterForGenerate(null);
    };

    const cancelSingleNpcGenerate = () => {
        setSingleNpcCostModalOpen(false);
        setPendingCharacterForGenerate(null);
    };

    // 下载图片（跨域 http(s) 必须 fetch→blob，直接 <a download> 常被浏览器忽略）
    const handleDownloadImage = async (
        type: 'npcs' | 'players' | 'scenes' | 'subscenes' | 'worldMap',
        id: string,
        variant?: string,
        imagePath?: string,
    ) => {
        const safeId = String(id || 'portrait').replace(/[\\/:*?"<>|]/g, '_') || 'portrait';
        const buildName = (extension: string) => (
            variant ? `${safeId}_${variant}${extension}` : `${safeId}${extension}`
        );

        try {
            if (imagePath?.startsWith('blob:')) {
                const response = await fetch(imagePath);
                const blob = await response.blob();
                const extension = `.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
                triggerBlobDownload(blob, buildName(extension));
                toast.success(t('createGame.imageDownloadSuccess'));
                return;
            }

            if (imagePath?.startsWith('data:')) {
                const extension = `.${(imagePath.split(';')[0].split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
                const link = document.createElement('a');
                link.href = imagePath;
                link.setAttribute('download', buildName(extension));
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(t('createGame.imageDownloadSuccess'));
                return;
            }

            let remoteUrl: string | null = null;
            if (imagePath?.startsWith('https://') || imagePath?.startsWith('http://')) {
                remoteUrl = imagePath;
            } else if (
                imagePath?.startsWith('/api/')
                || imagePath?.startsWith('/visual/')
                || imagePath?.startsWith('/world-interaction/')
            ) {
                remoteUrl = `${HOST_ADDRESS}${imagePath}`;
            }

            if (remoteUrl) {
                const response = await authFetch(remoteUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const extension = extractImageExtension(imagePath) || `.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
                triggerBlobDownload(blob, buildName(extension.startsWith('.') ? extension : `.${extension}`));
                toast.success(t('createGame.imageDownloadSuccess'));
                return;
            }

            if (!fileId || !api) {
                toast.error(t('createGame.missingDataCannotDownload'));
                return;
            }

            const response = await api.downloadImage(fileId, type, id, variant, imagePath);
            const extension = extractImageExtension(imagePath) || '.png';
            triggerBlobDownload(new Blob([response.data]), buildName(extension));
            toast.success(t('createGame.imageDownloadSuccess'));
        } catch (error) {
            console.error('下载图片失败:', error);
            toast.error(t('createGame.imageDownloadFailedRetry'));
        }
    };

    return (
        <div className={`${styles.panelContent} ${isSaveOverlayVisible ? styles.panelContentSaving : ''}`}>
            <div className={styles.panelHeader}>
                <div className={styles.headerCopy}>
                    <h2>{t('createGame.characterProfile')}</h2>
                    <p className={styles.subtitle}>
                        {t('createGame.characterProfileTip', { cost: discountedCost })}
                    </p>
                </div>
                <GenerationActionBar layout="hero">
                    <button
                        type="button"
                        className={styles.generateButton}
                        onClick={openNpcCostModal}
                        disabled={isLoading || isGeneratingNpcImages || isLoadingNpcCost || isBlockingSwitch || characterPrice == null}
                    >
                        <span className={styles.generateIconWrap} aria-hidden>
                            <FaMagic className={styles.generateIcon} />
                        </span>
                        <span className={styles.buttonMainText}>
                            {isGeneratingNpcImages ? t('createGame.generating') : t('createGame.generateAllCharacterPortraits')}
                        </span>
                    </button>
                </GenerationActionBar>
            </div>

            <div className={styles.characterLayout}>
                {/* 左栏 - 角色列表 */}
                <CharactersSidebar
                    characters={characterData}
                    activeCharacterId={activeCharacterId}
                    isAddingNew={isAddingNew}
                    selectedCharacterIds={selectedCharacterIds}
                    onToggleCharacterSelected={(characterId) => {
                        setSelectedCharacterIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(characterId)) next.delete(characterId);
                            else next.add(characterId);
                            return next;
                        });
                    }}
                    onSelectCharacter={handleCharacterSelect}
                    onDeleteCharacter={handleDeleteClick}
                    onAddNew={openAddNewPanel}
                    checkBeforeSwitch={checkBeforeSwitch}
                    setIsAddingNew={setIsAddingNew}
                    setNewCharacterData={setNewCharacterData}
                />

                {/* 右栏 - 角色详情（统一表单） */}
                {currentCharacter && (
                    <div ref={detailCardRef} className={`${styles.card} ${styles.detailCard}`}>
                        {/* 隐藏的图片上传 inputs */}
                        <input
                            ref={playerFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadPlayerImage}
                            style={{ display: 'none' }}
                        />
                        <input
                            ref={npcFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadNpcImage}
                            style={{ display: 'none' }}
                        />

                        {/* 右侧面板头部 - 确认/{t('common.cancel')}按钮 */}
                        {isAddingNew ? (
                            <div className={styles.detailActionRow}>
                                <button
                                    className={styles.ghostSmall}
                                    onClick={() => { void confirmEdit(); }}
                                    disabled={isPortraitActionBusy}
                                >
                                    {t('createGame.confirmAdd')}
                                </button>
                                <button className={styles.ghostSmall} onClick={cancelAddNew} disabled={isSavingCharacter}>
                                    {t('common.cancel')}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.detailActionRow}>
                                <button
                                    className={`${styles.ghostSmall} ${isPreviewMode ? styles.ghostSmallActive : ''}`}
                                    onClick={() => {
                                        setIsPreviewMode(!isPreviewMode);
                                        if (!isPreviewMode) {
                                            // 进入预览模式时，用角色的 portraitScale 初始化
                                            setPreviewScale(currentCharacter?.portraitScale ?? 1);
                                        }
                                    }}
                                    disabled={!currentPortraitImage || isPortraitActionBusy}
                                >
                                    {isPreviewMode ? t('createGame.exitPreview') : t('createGame.portraitSizePreview')}
                                </button>
                                <button
                                    className={styles.ghostSmall}
                                    onClick={() => { void confirmEdit(); }}
                                    disabled={isPortraitActionBusy}
                                >
                                    {t('common.confirmEdit')}
                                </button>
                            </div>
                        )}

                        <>
                            {/* 立绘大图区域 */}
                            {isPreviewMode ? (
                                // 预览模式：可调整大小
                                <div className={styles.portraitPreviewMode}>
                                    {/* 预览区域 */}
                                    <div className={styles.portraitPreviewArea}>
                                        <div className={styles.portraitPreviewCanvas}>
                                            {currentPortraitImage && (
                                                <CharacterLayer
                                                    characterImage={displayPortraitImage}
                                                    portraitScale={previewScale}
                                                    portraitOffsetX={currentCharacter?.portraitOffsetX || 0}
                                                    portraitOffsetY={currentCharacter?.portraitOffsetY || 0}
                                                    characterPosition={currentCharacter?.id === 'player' ? 'right' : 'left'}
                                                    containerClassName={styles.portraitPreviewCharacterContainer}
                                                    useImageFallback={true}
                                                    draggable={true}
                                                    onPositionChange={(x, y) => {
                                                        setCharacterData(chars => chars.map(c =>
                                                            c.id === currentCharacter?.id
                                                                ? { ...c, portraitOffsetX: x, portraitOffsetY: y }
                                                                : c
                                                        ));
                                                    }}
                                                />
                                            )}
                                            <div className={styles.portraitPreviewHint}>
                                                {Math.round(previewScale * 100)}%
                                            </div>
                                        </div>
                                    </div>
                                    {/* 控制区域 */}
                                    <div className={styles.portraitPreviewControls}>
                                        <div className={styles.portraitPreviewSection}>
                                            <div className={styles.portraitPreviewSliderRow}>
                                                <span className={styles.portraitPreviewLabel}>{t('createGame.scale')}</span>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="3"
                                                    step="0.05"
                                                    value={previewScale}
                                                    onInput={(e) => setPreviewScale(parseFloat((e.target as HTMLInputElement).value))}
                                                    className={styles.portraitPreviewRange}
                                                />
                                                <span className={styles.portraitPreviewValue}>{Math.round(previewScale * 100)}%</span>
                                            </div>
                                        </div>
                                        <div className={styles.portraitPreviewSection}>
                                            <div className={styles.portraitPreviewSliderRow}>
                                                <span className={styles.portraitPreviewLabel}>{t('createGame.xAxis')}</span>
                                                <input
                                                    type="range"
                                                    min="-200"
                                                    max="200"
                                                    step="5"
                                                    value={currentCharacter?.portraitOffsetX || 0}
                                                    onInput={(e) => {
                                                        setCharacterData(chars => chars.map(c =>
                                                            c.id === currentCharacter?.id
                                                                ? { ...c, portraitOffsetX: parseInt((e.target as HTMLInputElement).value) }
                                                                : c
                                                        ));
                                                    }}
                                                    className={styles.portraitPreviewRange}
                                                />
                                                <span className={styles.portraitPreviewValue}>{currentCharacter?.portraitOffsetX || 0}</span>
                                            </div>
                                            <div className={styles.portraitPreviewSliderRow}>
                                                <span className={styles.portraitPreviewLabel}>{t('createGame.yAxis')}</span>
                                                <input
                                                    type="range"
                                                    min="-200"
                                                    max="200"
                                                    step="5"
                                                    value={currentCharacter?.portraitOffsetY || 0}
                                                    onInput={(e) => {
                                                        setCharacterData(chars => chars.map(c =>
                                                            c.id === currentCharacter?.id
                                                                ? { ...c, portraitOffsetY: parseInt((e.target as HTMLInputElement).value) }
                                                                : c
                                                        ));
                                                    }}
                                                    className={styles.portraitPreviewRange}
                                                />
                                                <span className={styles.portraitPreviewValue}>
                                                    {(() => {
                                                        const val = currentCharacter?.portraitOffsetY || 0;
                                                        const percent = Math.round((val / 200) * 100);
                                                        if (val === 0) return '0';
                                                        return val > 0 ? `↑${percent}` : `↓${Math.abs(percent)}`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className={styles.portraitPreviewActions}>
                                            <button
                                                className={styles.ghostSmall}
                                                onClick={() => {
                                                    setPreviewScale(1);
                                                    setCharacterData(chars => chars.map(c =>
                                                        c.id === currentCharacter?.id
                                                            ? { ...c, portraitOffsetX: 0, portraitOffsetY: 0 }
                                                            : c
                                                    ));
                                                }}
                                            >
                                                {t('createGame.reset')}
                                            </button>
                                            <button
                                                className={styles.ghostSmall}
                                                onClick={() => setIsPreviewMode(false)}
                                            >
                                                {t('createGame.exitPreview')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // 正常模式：上传/生成
                                <div
                                    className={styles.portraitLarge}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={
                                        currentPortraitImage
                                            ? t('createGame.clickZoomPortraitPreview')
                                            : t('createGame.clickReplacePortrait')
                                    }
                                    data-testid="portrait-main"
                                    style={{
                                        backgroundImage: [
                                            `url('${displayPortraitImage}')`,
                                            'linear-gradient(45deg, #e8e8e8 25%, transparent 25%)',
                                            'linear-gradient(-45deg, #e8e8e8 25%, transparent 25%)',
                                            'linear-gradient(45deg, transparent 75%, #e8e8e8 75%)',
                                            'linear-gradient(-45deg, transparent 75%, #e8e8e8 75%)',
                                        ].join(', '),
                                        backgroundSize: 'contain, 16px 16px, 16px 16px, 16px 16px, 16px 16px',
                                        backgroundPosition: 'center, 0 0, 0 8px, 8px -8px, -8px 0',
                                        backgroundRepeat: 'no-repeat, repeat, repeat, repeat, repeat',
                                        cursor: (isAddingNew || isPortraitActionBusy) ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={handlePortraitAreaClick}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handlePortraitAreaClick();
                                        }
                                    }}
                                >
                                    {currentPortraitImage && (
                                        <button
                                            type="button"
                                            className={styles.downloadButton}
                                            data-testid="portrait-download"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const downloadId = currentCharacter.id === 'player'
                                                    ? (currentCharacter.name || 'player')
                                                    : currentCharacter.id;
                                                const downloadType = currentCharacter.id === 'player' ? 'players' : 'npcs';
                                                void handleDownloadImage(
                                                    downloadType,
                                                    downloadId,
                                                    'base',
                                                    currentPortraitImage,
                                                );
                                            }}
                                            title={t('createGame.downloadImage')}
                                            disabled={isPortraitActionBusy}
                                        >
                                            <MdDownload size={18} />
                                        </button>
                                    )}
                                    <span className={styles.portraitHint}>
                                        {isAddingNew
                                            ? t('createGame.confirmAddCharacterFirst')
                                            : currentPortraitImage
                                                ? t('createGame.clickZoomPortraitPreview')
                                                : t('createGame.clickReplacePortrait')}
                                    </span>
                                    {isCurrentPortraitGenerating && (
                                        <div className={styles.loadingOverlay}>
                                            <div className={styles.loadingSpinner}></div>
                                            <div className={styles.loadingText}>{t('createGame.generatingCharacterPortrait')}</div>
                                            {singleCharacterEtaText && (
                                                <div className={styles.loadingHint}>{singleCharacterEtaText}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className={styles.portraitImageActions}>
                                <button
                                    type="button"
                                    className={styles.ghostSmall}
                                    onClick={handlePortraitUploadClick}
                                    disabled={isAddingNew || isPortraitActionBusy}
                                >
                                    {t('common.upload')}
                                </button>
                                {currentCharacter && (
                                    <button
                                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                                        onClick={() => handleRequestSingleNpcGenerate(currentCharacter)}
                                        disabled={isAddingNew || isPortraitActionBusy || characterPrice == null}
                                    >
                                        <CurrencyIcon
                                            currency="points"
                                            className={styles.priceIcon}
                                        />
                                        {/* TODO: 恢复会员折扣UI时，取消下方注释
                                        {showDiscount ? (
                                            <>
                                                <span className={styles.discountPrice}>{discountedCost}</span>
                                                <span className={styles.originalPrice}>{characterPrice ?? '—'}</span>
                                                <span>{t('createGame.aiGenerate')}</span>
                                            </>
                                        ) : ( */}
                                            <span>{characterPrice ?? '—'} {t('createGame.aiGenerate')}</span>
                                        {/* )} */}
                                    </button>
                                )}
                            </div>

                            {/* 基础信息表单 */}
                            <div className={styles.formGrid}>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.name')}{requiredFields.includes('name') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {nameWords}/{CHARACTER_WORD_LIMITS.name}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.name}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                        <input
                                            type="text"
                                            value={currentCharacter.name}
                                            {...nameLimit}
                                            className={fieldErrors.name ? styles.errorInput : ''}
                                        />
                                    </InlineFieldSave>
                                    {fieldErrors.name && (
                                        <div className={styles.errorMessage}>{fieldErrors.name}</div>
                                    )}
                                </label>
                                <label>
                                    <span>{t('createGame.nickname')}</span>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.callName}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                        <input
                                            type="text"
                                            value={currentCharacter.callName}
                                            onChange={(e) => handleFieldChange('callName', e.target.value)}
                                        />
                                    </InlineFieldSave>
                                </label>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.gender')}{requiredFields.includes('gender') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {genderWords}/{CHARACTER_WORD_LIMITS.gender}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.gender}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                        <input
                                            type="text"
                                            value={currentCharacter.gender}
                                            {...genderLimit}
                                            className={fieldErrors.gender ? styles.errorInput : ''}
                                        />
                                    </InlineFieldSave>
                                    {fieldErrors.gender && (
                                        <div className={styles.errorMessage}>{fieldErrors.gender}</div>
                                    )}
                                </label>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.identity')}{requiredFields.includes('identity') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {identityWords}/{CHARACTER_WORD_LIMITS.identity}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.identity}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                        <input
                                            type="text"
                                            value={currentCharacter.identity}
                                            {...identityLimit}
                                            className={fieldErrors.identity ? styles.errorInput : ''}
                                        />
                                    </InlineFieldSave>
                                    {fieldErrors.identity && (
                                        <div className={styles.errorMessage}>{fieldErrors.identity}</div>
                                    )}
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.personalityTags')}</span>
                                        <span className={styles.wordCounter}>
                                            {personalityWords}/{CHARACTER_WORD_LIMITS.personality}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.personality}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                    <textarea
                                        rows={2}
                                        value={personalityInputValue}
                                        {...personalityLimit}
                                        onBlur={() => {
                                            updateField('personality', normalizePersonalityTags(personalityInputValue));
                                        }}
                                        placeholder={t('createGame.personalityTagsPlaceholder')}
                                    />
                                    </InlineFieldSave>
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.speech')}{requiredFields.includes('speech') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {speechWords}/{CHARACTER_WORD_LIMITS.speech}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.speech}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.speech}
                                        {...speechLimit}
                                        className={fieldErrors.speech ? styles.errorInput : ''}
                                    />
                                    </InlineFieldSave>
                                    {fieldErrors.speech && (
                                        <div className={styles.errorMessage}>{fieldErrors.speech}</div>
                                    )}
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>{t('createGame.appearance')}{requiredFields.includes('appearance') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {appearanceWords}/{CHARACTER_WORD_LIMITS.appearance}
                                        </span>
                                    </div>
                                    <InlineFieldSave
                                        showSave={characterFieldDirtyState.appearance}
                                        onSave={() => { void confirmEdit(); }}
                                        disabled={isPortraitActionBusy}
                                    >
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.appearance}
                                        {...appearanceLimit}
                                        className={fieldErrors.appearance ? styles.errorInput : ''}
                                    />
                                    </InlineFieldSave>
                                    {fieldErrors.appearance && (
                                        <div className={styles.errorMessage}>{fieldErrors.appearance}</div>
                                    )}
                                </label>
                            </div>

                            {/* 立绘差分（可折叠） */}
                            <div className={styles.detailBlock}>
                                <div
                                    className={styles.collapsibleHeader}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setIsVariationExpanded(!isVariationExpanded)}
                                >
                                    <strong>{t('createGame.characterVariations')}</strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span className={styles.mutedSmall}>
                                            {t('createGame.variationsCount', { count: currentCharacter.variations.filter(v => v.label !== 'base').length })}
                                        </span>
                                        <MdArrowDropDown size={30} style={{ transform: isVariationExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </div>
                                </div>
                                {isVariationExpanded && (
                                    <div className={styles.variationGrid}>
                                        {currentCharacter.variations.filter(v => v.label !== 'base').map((variation) => {
                                            const effectiveImage = getEffectiveImage(currentCharacter, variation.label);
                                            return (
                                            <div key={variation.id} className={styles.variationCard}>
                                                <div
                                                    className={`${styles.variationThumb} ${!effectiveImage ? styles.empty : ''}`}
                                                    style={effectiveImage ? { 
                                                        backgroundImage: (effectiveImage.startsWith('blob:') || effectiveImage.startsWith('data:'))
                                                            ? `url('${effectiveImage}')` 
                                                            : `url('${withCacheBust(effectiveImage)}')` 
                                                    } : {}}
                                                    role={effectiveImage ? 'button' : undefined}
                                                    tabIndex={effectiveImage ? 0 : undefined}
                                                    onClick={() => {
                                                        if (!effectiveImage) return;
                                                        openPortraitLightbox(
                                                            effectiveImage,
                                                            `${currentCharacter.name || ''} · ${variation.label}`,
                                                        );
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (!effectiveImage) return;
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            openPortraitLightbox(
                                                                effectiveImage,
                                                                `${currentCharacter.name || ''} · ${variation.label}`,
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {/* 加载效果 */}
                                                    {isGeneratingVariation && generatingVariationId === variation.id && (
                                                        <div className={styles.loadingOverlay}>
                                                            <div className={styles.loadingSpinner}></div>
                                                            <div className={styles.loadingText}>{t('createGame.generating')}</div>
                                                        </div>
                                                    )}
                                                    {/* 下载和删除按钮 */}
                                                    <>
                                                        <button
                                                            className={styles.variationEditButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openEditVariationModal(variation);
                                                            }}
                                                            title={t('createGame.editVariation')}
                                                            disabled={isGeneratingVariation && generatingVariationId === variation.id}
                                                        >
                                                            <MdEdit size={14} />
                                                        </button>
                                                        <button
                                                            className={styles.variationDeleteButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (!handlers) return;
                                                                setPendingVariationToDelete({ variation, character: currentCharacter });
                                                                setDeleteVariationModalOpen(true);
                                                            }}
                                                            title={t('createGame.deleteVariation')}
                                                            disabled={isGeneratingVariation && generatingVariationId === variation.id}
                                                        >
                                                            <RiDeleteBin5Line size={14} />
                                                        </button>
                                                        <button
                                                            className={styles.variationDownloadButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const variantType = variation.type && variation.label
                                                                    ? `${variation.type}_${variation.label}`
                                                                    : variation.label || variation.type || '';
                                                                const downloadType = currentCharacter.id === 'player' ? 'players' : 'npcs';
                                                                handleDownloadImage(downloadType, currentCharacter.id, variantType, variation.img);
                                                            }}
                                                            title={t('createGame.downloadImage')}
                                                        >
                                                            <MdDownload size={14} />
                                                        </button>
                                                    </>
                                                        {!effectiveImage && !isGeneratingVariation && <span className={styles.mutedSmall}>{t('createGame.waitingForImage')}</span>}
                                                    </div>
                                                    <p>{variation.label}</p>
                                                    {variation.description && (
                                                        <p className={styles.mutedSmall} style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                                            {variation.description}
                                                        </p>
                                                    )}
                                                    <div className={styles.variationActions}>
                                                        <input
                                                            ref={(el) => {
                                                                if (el) {
                                                                    variationFileInputRefs.current[variation.id] = el;
                                                                }
                                                            }}
                                                            type="file"
                                                            accept="image/*"
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => handleUploadVariationImage(variation, e)}
                                                        />
                                                        <button
                                                            className={styles.ghostTiny}
                                                            onClick={() => variationFileInputRefs.current[variation.id]?.click()}
                                                            disabled={isAddingNew || (isGeneratingVariation && generatingVariationId === variation.id)}
                                                        >
                                                            {t('common.upload')}
                                                        </button>
                                                        <button
                                                            className={`${styles.ghostTiny} ${styles.generateButton}`}
                                                            onClick={() => handleRequestVariationGenerate(variation)}
                                                            disabled={isAddingNew || (isGeneratingVariation && generatingVariationId === variation.id) || variantPrice == null}
                                                        >
                                                            <CurrencyIcon
                                                                currency="points"
                                                                className={styles.priceIcon}
                                                            />
                                                            {isGeneratingVariation && generatingVariationId === variation.id ? (
                                                                <span>{t('createGame.generating')}</span>
                                                            /* TODO: 恢复会员折扣UI时，取消下方注释
                                                            ) : showDiscount ? (
                                                                <>
                                                                    <span className={styles.discountPrice}>{variantDiscountedCost}</span>
                                                                    <span className={styles.originalPrice}>{variantPrice ?? '—'}</span>
                                                                    <span>{t('createGame.aiGenerate')}</span>
                                                                </>
                                                            ) : ( */
                                                            ) : (
                                                                <span>{variantPrice ?? '—'} {t('createGame.aiGenerate')}</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                                );
                                            })}
                                            <button className={styles.addCard} onClick={addVariation}>+ {t('createGame.newVariation')}</button>
                                        </div>
                                    )}
                                </div>
                            {/* 角色属性（worldInteraction 模式） */}
                            {isWorldInteractionMode && attributeSetting && currentCharacter && fileId && (
                                <CharacterAttributesPanel
                                    ref={attributePanelRef}
                                    attributeSetting={attributeSetting}
                                    npcAttributes={currentCharacter.id === 'player' ? undefined : currentNpcAttributes}
                                    characterId={currentCharacter.id}
                                    isPlayer={currentCharacter.id === 'player'}
                                    fileId={fileId}
                                />
                            )}


                            {/* 玩家目前定位：对应局内系统面板同名板块；秘密不对玩家展示 */}
                            {currentCharacter.id === 'player' && (
                                <div className={styles.detailBlock}>
                                    <div
                                        className={styles.collapsibleHeader}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setIsPositioningExpanded(!isPositioningExpanded)}
                                    >
                                        <strong>玩家目前定位</strong>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span className={styles.mutedSmall}>当前身份、立场与秘密</span>
                                            <MdArrowDropDown size={30} style={{ transform: isPositioningExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                        </div>
                                    </div>
                                    {isPositioningExpanded && (
                                        <div className={styles.formGrid}>
                                            <p className={styles.mutedSmall} style={{ gridColumn: '1 / -1', margin: '0 0 8px' }}>
                                                对应游玩页系统面板「玩家目前定位」。秘密仅创作者可见与填写，开局注入叙事 AI，玩家界面不展示。
                                            </p>
                                            <label className={styles.wide}>
                                                <div className={styles.labelRowWithCounter}>
                                                    <span>当前身份</span>
                                                    <span className={styles.wordCounter}>
                                                        {positioningIdentityWords}/{CHARACTER_WORD_LIMITS.positioningIdentity}
                                                    </span>
                                                </div>
                                                <InlineFieldSave
                                                    showSave={characterFieldDirtyState.positioningIdentity}
                                                    onSave={() => { void confirmEdit(); }}
                                                    disabled={isPortraitActionBusy}
                                                >
                                                    <textarea
                                                        rows={3}
                                                        value={currentCharacter.positioningIdentity || ''}
                                                        placeholder="如：假扮双胞胎哥哥混入男校的江知夏"
                                                        {...positioningIdentityLimit}
                                                    />
                                                </InlineFieldSave>
                                            </label>
                                            <label className={styles.wide}>
                                                <div className={styles.labelRowWithCounter}>
                                                    <span>当前立场</span>
                                                    <span className={styles.wordCounter}>
                                                        {positioningTraitsWords}/{CHARACTER_WORD_LIMITS.positioningTraits}
                                                    </span>
                                                </div>
                                                <InlineFieldSave
                                                    showSave={characterFieldDirtyState.positioningTraits}
                                                    onSave={() => { void confirmEdit(); }}
                                                    disabled={isPortraitActionBusy}
                                                >
                                                    <textarea
                                                        rows={3}
                                                        value={currentCharacter.positioningTraits || ''}
                                                        placeholder="对外可被察觉的立场，如：表面随和、站队某派"
                                                        {...positioningTraitsLimit}
                                                    />
                                                </InlineFieldSave>
                                            </label>
                                            <label className={styles.wide}>
                                                <div className={styles.labelRowWithCounter}>
                                                    <span>秘密</span>
                                                    <span className={styles.wordCounter}>
                                                        {positioningSecretWords}/{CHARACTER_WORD_LIMITS.positioningSecret}
                                                    </span>
                                                </div>
                                                <InlineFieldSave
                                                    showSave={characterFieldDirtyState.positioningSecret}
                                                    onSave={() => { void confirmEdit(); }}
                                                    disabled={isPortraitActionBusy}
                                                >
                                                    <textarea
                                                        rows={4}
                                                        value={currentCharacter.positioningSecret || ''}
                                                        placeholder="不被他人所知道的事；玩家局内看不到这段，仅影响叙事 AI"
                                                        {...positioningSecretLimit}
                                                    />
                                                </InlineFieldSave>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 仅保留可持久化且可被剧情使用的“人物背景故事”字段 */}
                            <div className={styles.detailBlock}>
                                <div
                                    className={styles.collapsibleHeader}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setIsBackgroundExpanded(!isBackgroundExpanded)}
                                >
                                    <strong>{t('createGame.characterBackground')}</strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span className={styles.mutedSmall}>{t('createGame.formatFreeOptional')}</span>
                                        <MdArrowDropDown size={30} style={{ transform: isBackgroundExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </div>
                                </div>
                                {isBackgroundExpanded && (
                                    <div className={styles.formGrid}>
                                        <label className={styles.wide}>
                                            <div className={styles.labelRowWithCounter}>
                                                <span>{t('createGame.characterBackground')}</span>
                                                <span className={styles.wordCounter}>
                                                    {backgroundWords}/{CHARACTER_WORD_LIMITS.background}
                                                </span>
                                            </div>
                                            <InlineFieldSave
                                                showSave={characterFieldDirtyState.background}
                                                onSave={() => { void confirmEdit(); }}
                                                disabled={isPortraitActionBusy}
                                            >
                                            <textarea
                                                rows={4}
                                                value={currentCharacter.background}
                                                placeholder={t('createGame.backgroundPlaceholder')}
                                                {...backgroundLimit}
                                            />
                                            </InlineFieldSave>
                                        </label>
                                    </div>
                                )}
                            </div>
                        </>
                    </div>
                )}
            </div>

            {/* 新增差分弹窗 */}
            {variationModalOpen && (
                <div className={styles.modalOverlay} onClick={closeVariationModal}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>{editingVariationId ? t('createGame.editVariation') : t('createGame.addVariation')}</h3>
                            <button className={styles.modalClose} onClick={closeVariationModal}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <label>
                                <span>{t('createGame.variationType')}<span className={styles.required}>*</span></span>
                                <div className={styles.variationTypeGroup} role="radiogroup" aria-label={t('createGame.variationType')}>
                                    {VARIATION_TYPES.map((type) => {
                                        const isSelected = newVariationType === type.value;
                                        return (
                                            <button
                                                key={type.value}
                                                type="button"
                                                className={`${styles.variationTypeButton} ${isSelected ? styles.variationTypeButtonActive : ''}`}
                                                onClick={() => setNewVariationType(type.value)}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <span className={styles.variationTypeLabel}>{t(`createGame.variationType${type.value.charAt(0).toUpperCase() + type.value.slice(1)}`)}</span>
                                                <span
                                                    className={`${styles.variationTypeIndicator} ${isSelected ? styles.variationTypeIndicatorActive : ''}`}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </label>
                            <label>
                                <span>{t('createGame.variationLabel')}<span className={styles.required}>*</span></span>
                                <input type="text" value={newVariationLabel} onChange={(e) => setNewVariationLabel(e.target.value)} />
                            </label>
                            <label>
                                <span>{t('createGame.descriptionOptional')}</span>
                                <textarea
                                    rows={3}
                                    value={newVariationDescription}
                                    onChange={(e) => setNewVariationDescription(e.target.value)}
                                    placeholder={t('createGame.variationLabelPlaceholder')}
                                />
                            </label>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.ghostSmall} onClick={closeVariationModal}>{t('common.cancel')}</button>
                            <button className={styles.ghostSmall} onClick={confirmAddVariation}>
                                {editingVariationId ? t('common.save') : t('common.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 删除确认弹窗 */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title={t('createGame.deleteCharacter')}
                message={t('createGame.deleteCharacterWarning')}
                confirmButtonText={t('common.confirm')}
                cancelButtonText={t('common.thinkLater')}
            />

            {/* 一键生成角色立绘积分提示 */}
            <ConfirmModal
                isOpen={npcCostModalOpen}
                onConfirm={confirmGenerateAllNpcImages}
                onCancel={() => {
                    handlers?.clearPendingBatchSelection?.();
                    setNpcCostModalOpen(false);
                }}
                title={t('common.pointsDeductionConfirm')}
                message={
                    npcCostPoints != null
                        ? t('createGame.batchCharacterGenerationConfirm', { points: npcCostPoints, currentPoints: userPoints, insufficient: npcCostPoints > userPoints ? t('common.insufficient') : '' })
                        : t('common.deductSomePoints', { currentPoints: userPoints })
                }
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            {/* 单个角色立绘生成积分提示 */}
            <ConfirmModal
                isOpen={singleNpcCostModalOpen}
                onConfirm={confirmSingleNpcGenerate}
                onCancel={cancelSingleNpcGenerate}
                title={t('createGame.characterPortraitGenerationConfirm')}
                message={t('createGame.singleCharacterGenerationConfirm', { cost: discountedCost })}
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            {/* 一键生成角色立绘结果弹窗 */}
            <GenerateResultModal
                isOpen={npcResultModalOpen}
                onClose={() => setNpcResultModalOpen(false)}
                title={t('createGame.characterPortraitGenerationResult')}
                generatedCount={npcGenerationResult?.generatedCount}
                totalCount={npcGenerationResult?.totalCount}
                pointsDeducted={npcGenerationResult?.pointsDeducted}
                remainingPoints={npcGenerationResult?.remainingPoints}
            />

            {/* 差分图片生成积分提示 */}
            <ConfirmModal
                isOpen={variationCostModalOpen}
                onConfirm={confirmVariationGenerate}
                onCancel={cancelVariationGenerate}
                title={t('common.pointsDeductionConfirm')}
                message={t('createGame.variationGenerationConfirm', { cost: variantDiscountedCost })}
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            {/* 差分删除确认弹窗 */}
            <ConfirmModal
                isOpen={deleteVariationModalOpen}
                onConfirm={async () => {
                    if (pendingVariationToDelete && handlers) {
                        await handlers.deleteVariationImage(
                            pendingVariationToDelete.variation,
                            pendingVariationToDelete.character
                        );
                    }
                    setDeleteVariationModalOpen(false);
                    setPendingVariationToDelete(null);
                }}
                onCancel={() => {
                    setDeleteVariationModalOpen(false);
                    setPendingVariationToDelete(null);
                }}
                title={t('createGame.deleteVariation')}
                message={t('createGame.deleteVariationWarning')}
                confirmButtonText={t('common.confirm')}
                cancelButtonText={t('common.thinkLater')}
            />

            {showBatchNpcProgressOverlay && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingDialog} role="dialog" aria-modal="true" aria-labelledby="batch-npc-gen-title">
                        <div className={styles.plusLoadingHeroCopy} style={{ width: '100%' }}>
                            <div id="batch-npc-gen-title" className={styles.plusLoadingText}>
                                {showContinueFailedTasks
                                    ? (batchStageBoard.stuckItems.length > 0
                                        ? '部分角色立绘卡住'
                                        : '角色立绘生成结束')
                                    : t('createGame.generatingCharacterPortrait')}
                            </div>
                            {!showContinueFailedTasks && batchCharacterEtaText && (
                                <div className={styles.plusLoadingHint}>{batchCharacterEtaText}</div>
                            )}
                            {showContinueFailedTasks && (
                                <div className={styles.plusLoadingHint}>
                                    {batchStageBoard.stuckItems.length > 0
                                        ? `有 ${batchStageBoard.stuckItems.length} 项疑似卡住（≥90s）· 失败 ${batchFailedItems.length} 项`
                                        : `生图/抠图均已结束 · 失败 ${batchFailedItems.length} 项`}
                                </div>
                            )}
                        </div>

                        <div className={styles.plusLoadingSplitStats}>
                            <div className={`${styles.plusLoadingStatCard} ${styles.plusLoadingStatGen}`}>
                                <div className={styles.plusLoadingStatTitle}>生图</div>
                                <div className={styles.plusLoadingStatValue}>
                                    {batchStageBoard.stats.generateDone}/{batchStageBoard.stats.total}
                                </div>
                                <div className={styles.plusLoadingStatMeta}>
                                    进行中 {batchStageBoard.stats.generateActive}
                                    · 排队 {batchStageBoard.stats.pending}
                                </div>
                                <div className={styles.plusLoadingStatTrack}>
                                    <div
                                        className={styles.plusLoadingStatTrackFill}
                                        style={{
                                            width: `${batchStageBoard.stats.total > 0
                                                ? Math.round((batchStageBoard.stats.generateDone / batchStageBoard.stats.total) * 100)
                                                : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                            <div className={`${styles.plusLoadingStatCard} ${styles.plusLoadingStatCut}`}>
                                <div className={styles.plusLoadingStatTitle}>抠图</div>
                                <div className={styles.plusLoadingStatValue}>
                                    {batchStageBoard.stats.rembgDone}/{batchStageBoard.stats.total}
                                </div>
                                <div className={styles.plusLoadingStatMeta}>
                                    进行中 {batchStageBoard.stats.rembgActive}
                                    · 待抠图 {Math.max(0, batchStageBoard.stats.generateDone - batchStageBoard.stats.rembgDone - batchStageBoard.stats.rembgActive - batchStageBoard.stats.failed)}
                                </div>
                                <div className={styles.plusLoadingStatTrack}>
                                    <div
                                        className={styles.plusLoadingStatTrackFillCut}
                                        style={{
                                            width: `${batchStageBoard.stats.total > 0
                                                ? Math.round((batchStageBoard.stats.rembgDone / batchStageBoard.stats.total) * 100)
                                                : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {batchStageBoard.stuckItems.length > 0 && (
                            <div className={styles.plusLoadingStuck}>
                                可能卡住：
                                {batchStageBoard.stuckItems.map((item) => (
                                    `${item.name || `第 ${item.index + 1} 张`}（${item.stage === 'generate_start' ? '生图' : '抠图'} ${item.stageElapsedSeconds}s）`
                                )).join('；')}
                            </div>
                        )}

                        <div className={styles.plusLoadingBoardShell}>
                            <div className={styles.plusLoadingLogHeader}>
                                <span className={styles.plusLoadingLogEyebrow}>分项进度</span>
                                <span className={styles.plusLoadingLogLive}>LIVE</span>
                            </div>
                            <div className={styles.plusLoadingBoard}>
                                {batchStageBoard.items.map((item) => (
                                    <div
                                        key={`board-${item.index}-${item.name}`}
                                        className={`${styles.plusLoadingBoardItem} ${batchItemStageClass(item.stage)}`}
                                    >
                                        <div className={styles.plusLoadingBoardTop}>
                                            <span className={styles.plusLoadingBoardName}>
                                                #{item.index + 1} {item.name}
                                            </span>
                                            <span className={styles.plusLoadingBoardStage}>{item.label}</span>
                                        </div>
                                        {(item.stage === 'generate_start' || item.stage === 'rembg_start') && (
                                            <div className={styles.plusLoadingBoardElapsed}>
                                                本阶段已 {item.stageElapsedSeconds}s
                                                {(item.stage === 'generate_start'
                                                    ? item.stageElapsedSeconds >= 90
                                                    : item.stageElapsedSeconds >= 90)
                                                    ? ' · 疑似卡住'
                                                    : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {batchGenerationLogs.length > 0 && (
                            <div className={styles.plusLoadingLogShell}>
                                <div className={styles.plusLoadingLogHeader}>
                                    <span className={styles.plusLoadingLogEyebrow}>事件日志</span>
                                </div>
                                <div className={styles.plusLoadingLog} ref={batchLogListRef} aria-live="polite">
                                    {batchGenerationLogs.map((entry, index) => {
                                        const isActive = index === batchGenerationLogs.length - 1;
                                        return (
                                            <div
                                                key={`${index}-${entry.message}`}
                                                className={batchLogStageClass(entry.stage, isActive)}
                                            >
                                                <span className={styles.plusLoadingLogBadge}>
                                                    {batchLogStageLabel(entry.stage)}
                                                </span>
                                                <span className={styles.plusLoadingLogMessage}>{entry.message}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className={styles.plusLoadingFoot}>
                            <div className={styles.plusLoadingWarn}>
                                {showContinueFailedTasks
                                    ? `未完成 ${batchRetryTargetItems.length} 项，可点「重新生成未完成任务」`
                                    : t('createGame.generatingDoNotLeave')}
                            </div>
                            <div className={styles.plusLoadingFootActions}>
                                {showContinueFailedTasks ? (
                                    <button
                                        type="button"
                                        className={styles.plusLoadingContinueBtn}
                                        onClick={() => { void handleContinueFailedBatchTasks(); }}
                                    >
                                        重新生成未完成任务
                                    </button>
                                ) : (
                                    <span className={styles.plusLoadingFootSpacer} aria-hidden="true" />
                                )}
                                <button
                                    type="button"
                                    className={styles.plusLoadingCancelBtn}
                                    onClick={() => {
                                        if (showContinueFailedTasks) {
                                            handlers?.dismissBatchNpcProgress?.();
                                            return;
                                        }
                                        handlers?.cancelGenerateAllNpcImages();
                                    }}
                                >
                                    {showContinueFailedTasks ? '关闭' : t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 保存确认弹窗 */}
            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    try {
                        let primarySaveHandled = false;
                        const closeOnPrimarySave = pendingAction?.type === 'switchCharacter';
                        const saved = await confirmEdit(closeOnPrimarySave ? {
                            onPrimarySaved: () => {
                                primarySaveHandled = true;
                                hasUnsavedChangesRef.current = false;
                                isBlockingSwitchRef.current = false;
                                setSaveConfirmModalOpen(false);
                                setIsBlockingSwitch(false);
                                setHasUnsavedChanges(false);
                                executePendingAction();
                            },
                        } : undefined);
                        if (!saved) {
                            return;
                        }
                        if (!primarySaveHandled) {
                            hasUnsavedChangesRef.current = false;
                            isBlockingSwitchRef.current = false;
                            setSaveConfirmModalOpen(false);
                            setIsBlockingSwitch(false);
                            setHasUnsavedChanges(false);
                            executePendingAction();
                        }
                    } catch (error) {
                        toast.error(t('createGame.saveFailedRetry'));
                    }
                }}
                onDiscard={() => {
                    discardCurrentCharacterPendingImages();
                    if (isAddingNew) {
                        discardNewCharacterDraft({
                            nextCharacterId: pendingAction?.type === 'switchCharacter' ? pendingAction.targetCharacterId || null : null,
                        });
                    } else if (pendingAction?.type === 'switchCharacter') {
                        setFieldErrors({});
                    }
                    hasUnsavedChangesRef.current = false;
                    isBlockingSwitchRef.current = false;
                    setSaveConfirmModalOpen(false);
                    setHasUnsavedChanges(false);
                    setIsBlockingSwitch(false);
                    executePendingAction();
                }}
                onCancel={() => {
                    setSaveConfirmModalOpen(false);
                    setPendingAction(null);
                    setIsBlockingSwitch(false);
                    isBlockingSwitchRef.current = false;
                    pendingPanelActionRef.current = null;
                }}
                title={t('createGame.unsavedChanges')}
                message={t('createGame.unsavedChangesMessage')}
                saveButtonText={t('common.save')}
                discardButtonText={t('common.discard')}
            />

            {/* 保存遮罩层 */}
            {isSaveOverlayVisible && (
                <div className={styles.saveOverlay}>
                    <div className={styles.saveOverlayContent}>
                        <div className={styles.saveOverlaySpinner}></div>
                        <div className={styles.saveOverlayText}>{t('createGame.savingPleaseWait')}</div>
                    </div>
                </div>
            )}

            <PortraitLightbox
                open={Boolean(portraitLightbox?.src)}
                src={portraitLightbox?.src || null}
                title={portraitLightbox?.title}
                onClose={() => setPortraitLightbox(null)}
            />

        </div>
    );
});

CharactersPanel.displayName = 'CharactersPanel';

export default CharactersPanel;
