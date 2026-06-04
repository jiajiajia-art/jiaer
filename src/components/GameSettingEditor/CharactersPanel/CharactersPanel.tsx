import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CharactersPanel.module.css';
import CharacterLayer from '../../Galgame/CharacterLayer';
import { CHARACTER_GENERATION_COST } from '../../../utils/constants';
import type { AllGameData, BatchImageJobStatus } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPCSetting, NPC } from '../../../api/galgame/EditorData.type';
import type { NPCSetting as WorldNPCSetting, NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { MdDownload } from 'react-icons/md';
import { MdEdit } from 'react-icons/md';
import { RiDeleteBin5Line } from 'react-icons/ri';
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
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';
import { HOST_ADDRESS } from '../../../config';
import { useGenerationEta } from '../../../hooks/editor/useGenerationEta';
import GenerationActionBar from '../GenerationActionBar';
import InlineFieldSave from '../InlineFieldSave';

// 字数限制配置
const CHARACTER_WORD_LIMITS = {
    name: 10,
    gender: 2,
    identity: 10,
    personality: 100,
    speech: 100,
    appearance: 500,
    background: 800, 
} as const;

const SINGLE_CHARACTER_ETA_SECONDS = 85;
const SINGLE_PLAYER_ETA_SECONDS = 75;
const BATCH_CHARACTER_BUFFER_SECONDS = 45;

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
    
    const [activeCharacterId, setActiveCharacterId] = useState<string>('');
    const [characterData, setCharacterData] = useState<Character[]>([]);
    const [isBackgroundExpanded, setIsBackgroundExpanded] = useState<boolean>(false);
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
    // 立绘预览模式状态
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [previewScale, setPreviewScale] = useState(1);
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
    const isBatchNpcJobActive = isGeneratingNpcImages || (
        npcBatchJobStatus != null
        && ['queued', 'running', 'pending'].includes(String(npcBatchJobStatus.status || ''))
    );
    const singleCharacterEtaText = useGenerationEta({
        active: isCurrentPortraitGenerating,
        totalSeconds: currentCharacter?.id === 'player' ? SINGLE_PLAYER_ETA_SECONDS : SINGLE_CHARACTER_ETA_SECONDS,
    });
    const batchCharacterEtaText = useGenerationEta({
        active: isBatchNpcJobActive,
        totalSeconds: Math.max(
            SINGLE_CHARACTER_ETA_SECONDS,
            batchCharacterCount * SINGLE_CHARACTER_ETA_SECONDS + BATCH_CHARACTER_BUFFER_SECONDS,
        ),
        totalCount: npcBatchJobStatus?.totalCount ?? batchCharacterCount,
        completedCount: npcBatchJobStatus?.completedCount,
        status: npcBatchJobStatus?.status,
        estimatedRemainingSeconds: npcBatchJobStatus?.estimatedRemainingSeconds ?? null,
        // 实现批量角色生图的数量提示
        batchLabel: batchCharacterCount > 0 ? `${t('eta.total')} ${batchCharacterCount} ${t('eta.item')}` : undefined,
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

    // 字数限制处理
    const nameLimit = useWordLimit(CHARACTER_WORD_LIMITS.name, (value) => handleFieldChange('name', value));
    const genderLimit = useWordLimit(CHARACTER_WORD_LIMITS.gender, (value) => handleFieldChange('gender', value));
    const identityLimit = useWordLimit(CHARACTER_WORD_LIMITS.identity, (value) => handleFieldChange('identity', value));
    const speechLimit = useWordLimit(CHARACTER_WORD_LIMITS.speech, (value) => handleFieldChange('speech', value));
    const appearanceLimit = useWordLimit(CHARACTER_WORD_LIMITS.appearance, (value) => handleFieldChange('appearance', value));
    const backgroundLimit = useWordLimit(CHARACTER_WORD_LIMITS.background, (value) => handleFieldChange('background', value));
    
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

    // 触发文件选择
    const handlePortraitClick = () => {
        // 新增模式下禁止{t('common.upload')}
        if (isAddingNew || isPortraitActionBusy) {
            return;
        }
        
        // 正常模式 - 区分玩家和NPC
        if (currentCharacter?.id === 'player') {
            playerFileInputRef.current?.click();
        } else {
            npcFileInputRef.current?.click();
        }
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
        if (!handlers) return;
        await handlers.openNpcCostModal();
    };

    const confirmGenerateAllNpcImages = async () => {
        if (npcCostPoints != null && userPoints < npcCostPoints) {
            toast.error(t('createGame.insufficientPoints'));
            return;
        }
        setNpcCostModalOpen(false);
        await generateAllNpcImages();
        onDataChange?.();
    };

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

    // 下载图片
    const handleDownloadImage = async (type: 'npcs' | 'players' | 'scenes' | 'subscenes' | 'worldMap', id: string, variant?: string, imagePath?: string) => {
        // blob URL 下载
        if (imagePath?.startsWith('blob:')) {
            try {
                const response = await fetch(imagePath);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                
                // 从 blob URL 提取扩展名
                const extension = '.' + (blob.type.split('/')[1] || 'png');
                const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success(t('createGame.imageDownloadSuccess'));
            } catch (error) {
                console.error('下载 blob 图片失败:', error);
                toast.error(t('createGame.imageDownloadFailed'));
            }
            return;
        }

        // data URL 下载
        if (imagePath?.startsWith('data:')) {
            const link = document.createElement('a');
            link.href = imagePath;
            const extension = '.' + (imagePath.split(';')[0].split('/')[1] || 'png');
            const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success(t('createGame.imageDownloadSuccess'));
            return;
        }

        // 完整 URL (https/http) 下载
        if (imagePath?.startsWith('https://') || imagePath?.startsWith('http://')) {
            try {
                const link = document.createElement('a');
                link.href = imagePath;
                const extension = extractImageExtension(imagePath);
                const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
                link.setAttribute('download', fileName);
                link.setAttribute('target', '_self');
                document.body.appendChild(link);
                link.click();
                link.remove();
                toast.success(t('createGame.nativeImageDownloadSuccess'));
                return;
            } catch (error) {
                console.error('下载图片失败:', error);
                toast.error(t('createGame.imageDownloadFailedRetry'));
                return;
            }
        }

        // /api/ 路径：fetch + blob 方式下载
        if (imagePath?.startsWith('/api/')) {
            const fullUrl = `${HOST_ADDRESS}${imagePath}`;
            try {
                const response = await fetch(fullUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const extension = extractImageExtension(imagePath);
                const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
                link.setAttribute('download', fileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success(t('createGame.imageDownloadSuccess'));
                return;
            } catch (error) {
                console.error('下载图片失败:', error);
                toast.error(t('createGame.imageDownloadFailedRetry'));
                return;
            }
        }

        // 兜底：使用 api.downloadImage
        if (!fileId || !api) {
            toast.error(t('createGame.missingDataCannotDownload'));
            return;
        }

        try {
            const response = await api.downloadImage(fileId, type, id, variant, imagePath);
            // 创建下载链接
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            
            let extension = extractImageExtension(imagePath);
            
            const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success(t('createGame.imageDownloadSuccess'));
        } catch (error) {
            console.error('下载图片失败:', error);
            toast.error(t('createGame.imageDownloadFailedRetry'));
        }
    };

    return (
        <div className={`${styles.panelContent} ${isSaveOverlayVisible ? styles.panelContentSaving : ''}`}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>{t('gameEditor.step3')}</p>
                    <h2>{t('createGame.characterProfile')}</h2>
                    <p className={styles.subtitle}>{t('createGame.characterProfileTip')}</p>
                </div>
                <GenerationActionBar>
                    <button
                        className={`${styles.ghost} ${styles.generateButton}`}
                        onClick={openNpcCostModal}
                        disabled={isLoading || isGeneratingNpcImages || isLoadingNpcCost || isBlockingSwitch}
                    >
                        <img
                            src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                            alt=""
                            className={styles.priceIcon}
                        />
                        <div className={styles.buttonTextContainer}>
                            <span className={styles.buttonMainText}>
                                {isGeneratingNpcImages ? t('createGame.generating') : t('createGame.generateAllCharacterPortraits')}
                            </span>
                            <span className={styles.buttonSubText}>{CHARACTER_GENERATION_COST}{t('createGame.pointsPerImage')}</span>
                        </div>
                    </button>
                </GenerationActionBar>
            </div>

            <div className={styles.characterLayout}>
                {/* 左栏 - 角色列表 */}
                <CharactersSidebar
                    characters={characterData}
                    activeCharacterId={activeCharacterId}
                    isAddingNew={isAddingNew}
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
                                    style={{
                                        backgroundImage: `url('${displayPortraitImage}')`,
                                        backgroundSize: 'contain',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        cursor: (isAddingNew || isPortraitActionBusy) ? 'not-allowed' : 'pointer',
                                    }}
                                    onClick={handlePortraitClick}
                                >
                                    {currentPortraitImage && (
                                        <button
                                            className={styles.downloadButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (currentCharacter.id === 'player') {
                                                    handleDownloadImage('players', '', 'base', currentPortraitImage);
                                                } else {
                                                    handleDownloadImage('npcs', currentCharacter.id, 'base', currentPortraitImage);
                                                }
                                            }}
                                            title={t('createGame.downloadImage')}
                                            disabled={isPortraitActionBusy}
                                        >
                                            <MdDownload size={18} />
                                        </button>
                                    )}
                                    <span className={styles.portraitHint}>
                                        {isAddingNew ? t('createGame.confirmAddCharacterFirst') : t('createGame.clickReplacePortrait')}
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
                                    className={styles.ghostSmall}
                                    onClick={handlePortraitClick}
                                    disabled={isAddingNew || isPortraitActionBusy}
                                >
                                    {t('common.upload')}
                                </button>
                                {currentCharacter && (
                                    <button
                                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                                        onClick={() => handleRequestSingleNpcGenerate(currentCharacter)}
                                        disabled={isAddingNew || isPortraitActionBusy}
                                    >
                                        <img
                                            src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                                            alt=""
                                            className={styles.priceIcon}
                                        />
                                        <span>{CHARACTER_GENERATION_COST} {t('createGame.aiGenerate')}</span>
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
                                                            disabled={isAddingNew || (isGeneratingVariation && generatingVariationId === variation.id)}
                                                        >
                                                            <img
                                                                src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                                                                alt=""
                                                                className={styles.priceIcon}
                                                            />
                                                            <span>{isGeneratingVariation && generatingVariationId === variation.id ? t('createGame.generating') : `${CHARACTER_GENERATION_COST} ${t('createGame.aiGenerate')}`}</span>
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
                onCancel={() => setNpcCostModalOpen(false)}
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
                message={t('createGame.singleCharacterGenerationConfirm', { cost: CHARACTER_GENERATION_COST })}
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
                message={t('createGame.variationGenerationConfirm', { cost: CHARACTER_GENERATION_COST })}
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

            {isBatchNpcJobActive && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingDialog}>
                        <div className={styles.plusLoadingSpinner}></div>
                        <div className={styles.plusLoadingText}>{t('createGame.generatingCharacterPortrait')}</div>
                        {batchCharacterEtaText && (
                            <div className={styles.plusLoadingHint}>{batchCharacterEtaText}</div>
                        )}
                        <div className={styles.plusLoadingHint}>{t('createGame.generatingDoNotLeave')}</div>
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

        </div>
    );
});

CharactersPanel.displayName = 'CharactersPanel';

export default CharactersPanel;
