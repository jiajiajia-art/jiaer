import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import styles from './CharactersPanel.module.css';
import { IMAGE_GENERATION_COST } from '../../../utils/constants';
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { NPCSetting, NPC } from '../../../api/galgame/EditorData.type';
import type { NPCSetting as WorldNPCSetting, NPC as WorldNPC } from '../../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { MdDownload } from 'react-icons/md';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { withCacheBust, extractImageExtension } from './utils';
import ConfirmModal from '../../goodsModal/ConfirmModal';
import SaveConfirmModal from '../../goodsModal/SaveConfirmModal';
import { toast } from 'react-hot-toast';
import { useGameStore } from '../../../store/gameStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { Character, Variation, Relationship } from './types';
import { VARIATION_TYPES } from './types';
import { getNpcs, npcToCharacter, playerToCharacter } from './utils';
import { createApiHelpers } from './apiHelpers';
import { createHandlers } from './handlers';
import CharacterAttributesPanel, { type CharacterAttributesPanelRef } from './CharacterAttributesPanel';
import CharactersSidebar from './CharactersSidebar';
import { useWordLimit, useWordCount } from '../../../hooks/editor/useWordLimit';

// 字数限制配置
const CHARACTER_WORD_LIMITS = {
    name: 10,
    gender: 2,
    identity: 10,
    personality: 100,
    speech: 100,
    appearance: 500,
    background: 300,
} as const;

interface CharactersPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
    mode: string;
}

export interface CharactersPanelRef {
    checkBeforeLeave: () => boolean;
}

const CharactersPanel = React.forwardRef<CharactersPanelRef, CharactersPanelProps>(({
    gameData,
    isLoading = false,
    onGetData,
    onDataChange,
    mode = 'visual',
}, ref) => {
    const { fileId } = useGameStore();
    const { user, updateUser } = useAuthStore();
    const api = createApiHelpers(mode);
    const userPoints = user?.user?.points ?? 0;
    
    const [activeCharacterId, setActiveCharacterId] = useState<string>('');
    const [characterData, setCharacterData] = useState<Character[]>([]);
    const [isBackgroundExpanded, setIsBackgroundExpanded] = useState<boolean>(false);
    const [isRelationshipExpanded, setIsRelationshipExpanded] = useState<boolean>(false);
    const [isVariationExpanded, setIsVariationExpanded] = useState<boolean>(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newCharacterData, setNewCharacterData] = useState<Character | null>(null);
    const [variationModalOpen, setVariationModalOpen] = useState<boolean>(false);
    const [newVariationType, setNewVariationType] = useState<string>('');
    const [newVariationLabel, setNewVariationLabel] = useState<string>('');
    const [newVariationDescription, setNewVariationDescription] = useState<string>('');
    const playerFileInputRef = useRef<HTMLInputElement>(null);
    const npcFileInputRef = useRef<HTMLInputElement>(null);
    const variationFileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
    const [isGeneratingNpcImages, setIsGeneratingNpcImages] = useState<boolean>(false);
    const [isGeneratingSingleNpcImage, setIsGeneratingSingleNpcImage] = useState<boolean>(false);
    const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null);
    // 差分生成加载状态
    const [isGeneratingVariation, setIsGeneratingVariation] = useState<boolean>(false);
    const [generatingVariationId, setGeneratingVariationId] = useState<string | null>(null);
    // 一键生成积分提示
    const [npcCostModalOpen, setNpcCostModalOpen] = useState<boolean>(false);
    const [npcCostPoints, setNpcCostPoints] = useState<number | null>(null);
    const [isLoadingNpcCost, setIsLoadingNpcCost] = useState<boolean>(false);
    // 单个角色立绘生成积分确认
    const [singleNpcCostModalOpen, setSingleNpcCostModalOpen] = useState<boolean>(false);
    const [pendingCharacterForGenerate, setPendingCharacterForGenerate] = useState<Character | null>(null);
    // 差分图片生成积分确认
    const [variationCostModalOpen, setVariationCostModalOpen] = useState<boolean>(false);
    const [pendingVariationForGenerate, setPendingVariationForGenerate] = useState<{ variation: Variation; character: Character } | null>(null);
    const attributePanelRef = useRef<CharacterAttributesPanelRef>(null);
    const originalCharacterDataRef = useRef<Character[]>([]);
    const [deleteVariationModalOpen, setDeleteVariationModalOpen] = useState(false);
    const [pendingVariationToDelete, setPendingVariationToDelete] = useState<{ variation: Variation; character: Character } | null>(null);

    // 未保存修改相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchCharacter' | 'switchPanel' | 'createCharacter';
        targetCharacterId?: string | null;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

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

    // 当 gameData 变化时，填充角色数据
    useEffect(() => {
        if (!gameData) return;

        const npcs = getNpcs(gameData);
        const convertedCharacters: Character[] = [];
        
        // 如果有玩家数据，先添加玩家
        if (gameData.worldSetting.player) {
            convertedCharacters.push(playerToCharacter(gameData.worldSetting.player));
        }
        
        // 如果有 NPC 数据，添加 NPC
        if (npcs && npcs.length > 0) {
            const npcCharacters = npcs.map((npc: NPC | WorldNPC, index: number) => npcToCharacter(npc, index));
            convertedCharacters.push(...npcCharacters);
        }

        setCharacterData(convertedCharacters);
        // 保存原始数据用于比较
        originalCharacterDataRef.current = JSON.parse(JSON.stringify(convertedCharacters));
        setHasUnsavedChanges(false);
        
        if (convertedCharacters.length > 0 && !isAddingNew) {
            setActiveCharacterId(convertedCharacters[0].id);
        }
    }, [gameData, isAddingNew]);

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
                char.variations
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
                    char.portrait || Object.keys(images).length > 1 ? images : undefined;

                // 获取与玩家的关系（从 relationships 中查找）
                const playerRelationship = char.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

                return {
                    id: char.id,
                    name: char.name,
                    gender: char.gender,
                    job: job || undefined,
                    race: race || undefined,
                    description: char.background || '',
                    appearance: char.appearance || '',
                    personality: char.personality && char.personality.length > 0 ? char.personality.join(', ') : undefined,
                    tone: char.speech || '',
                    relationship: playerRelationship?.description || undefined,
                    images: finalImages,
                };
            });

        return {
            npcs,
        };
    }, [characterData, gameData]);

    // 执行待处理的操作
    const executePendingAction = useCallback(() => {
        if (!pendingAction) return;

        if (pendingAction.type === 'switchCharacter') {
            setActiveCharacterId(pendingAction.targetCharacterId || '');
        } else if (pendingAction.type === 'createCharacter') {
            // 这个操作会在 openAddNewPanel 中执行，这里不需要重复
        }

        setPendingAction(null);
    }, [pendingAction]);

    // 检查是否可以切换（如果有未保存修改，显示确认弹窗）
    const checkBeforeSwitch = useCallback((action: { type: 'switchCharacter' | 'switchPanel' | 'createCharacter'; targetCharacterId?: string | null }) => {
        if (hasUnsavedChanges) {
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        return true;
    }, [hasUnsavedChanges]);

    // 暴露给父组件的方法，用于在切换面板前检查
    useImperativeHandle(ref, () => ({
        checkBeforeLeave: () => {
            const hasChanges = hasUnsavedChangesRef.current;
            const isBlocking = isBlockingSwitchRef.current;
            
            if (hasChanges && !isBlocking) {
                setPendingAction({ type: 'switchPanel' });
                setSaveConfirmModalOpen(true);
                setIsBlockingSwitch(true);
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
        });
    }, [fileId, mode, api, userPoints, activeCharacterId, isAddingNew, newCharacterData, onDataChange]);

    // 获取当前显示的角色（统一处理新增和编辑模式）
    const currentCharacter = isAddingNew && newCharacterData
        ? newCharacterData
        : (characterData.find(c => c.id === activeCharacterId) || characterData[0]);

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

    if (!isAddingNew && characterData.length === 0 && !isLoading) {

    }

    const handleFieldChange = (field: keyof Character, value: string) => {
        if (field === 'personality') {
            const tags = value.split(/[，,\/、\s]+/).map(tag => tag.trim()).filter(Boolean);
            updateField(field, tags);
        } else {
            updateField(field, value);
        }
        setHasUnsavedChanges(true);
    };

    // 字数统计
    const nameWords = useWordCount(currentCharacter?.name ?? '');
    const genderWords = useWordCount(currentCharacter?.gender ?? '');
    const identityWords = useWordCount(currentCharacter?.identity ?? '');
    const personalityWords = useWordCount(currentCharacter?.personality.join(' / ') ?? '');
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
        const tags = value.split(/[，,\/、\s]+/).map(tag => tag.trim()).filter(Boolean);
        updateField('personality', tags);
        setHasUnsavedChanges(true);
    });

    // 关系管理（统一处理新增和编辑模式）
    const addRelationship = () => {
        const newRel: Relationship = { id: `r-${Date.now()}`, name: '', description: '' };
        if (isAddingNew && newCharacterData) {
            setNewCharacterData({
                ...newCharacterData,
                relationships: [...newCharacterData.relationships, newRel],
            });
        } else {
            setCharacterData(prev =>
                prev.map(char =>
                    char.id === activeCharacterId
                        ? { ...char, relationships: [...char.relationships, newRel] }
                        : char
                )
            );
        }
        setHasUnsavedChanges(true);
    };

    const updateRelationship = (relId: string, key: 'name' | 'description', value: string) => {
        if (isAddingNew && newCharacterData) {
            setNewCharacterData({
                ...newCharacterData,
                relationships: newCharacterData.relationships.map(r =>
                    r.id === relId ? { ...r, [key]: value } : r
                ),
            });
        } else {
            setCharacterData(prev =>
                prev.map(char =>
                    char.id === activeCharacterId
                        ? {
                            ...char,
                            relationships: char.relationships.map(r =>
                                r.id === relId ? { ...r, [key]: value } : r
                            ),
                        }
                        : char
                )
            );
        }
        setHasUnsavedChanges(true);
    };

    const removeRelationship = (relId: string) => {
        if (isAddingNew && newCharacterData) {
            setNewCharacterData({
                ...newCharacterData,
                relationships: newCharacterData.relationships.filter(r => r.id !== relId),
            });
        } else {
            setCharacterData(prev =>
                prev.map(char =>
                    char.id === activeCharacterId
                        ? { ...char, relationships: char.relationships.filter(r => r.id !== relId) }
                        : char
                )
            );
        }
        setHasUnsavedChanges(true);
    };


    // 打开新增差分弹窗
    const openAddVariationModal = () => {
        setNewVariationType('');
        setNewVariationLabel('');
        setNewVariationDescription('');
        setVariationModalOpen(true);
    };

    // 关闭新增差分弹窗
    const closeVariationModal = () => {
        setVariationModalOpen(false);
        setNewVariationType('');
        setNewVariationLabel('');
        setNewVariationDescription('');
    };

    // 确认添加差分
    const confirmAddVariation = () => {
        if (!newVariationType) {
            toast.error('请选择差分类型');
            return;
        }

        if (!newVariationLabel || !newVariationLabel.trim()) {
            toast.error('请输入差分标签');
            return;
        }

        const newVar: Variation = {
            id: `v-${Date.now()}`,
            label: newVariationLabel.trim(),
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

    // 取消新增
    const cancelAddNew = () => {
        setIsAddingNew(false);
        setNewCharacterData(null);
        if (characterData.length > 0) {
            setActiveCharacterId(characterData[0].id);
        }
    };

    // 确认修改/新增角色（统一处理）
    const confirmEdit = async () => {
        if (!handlers) return;
        const characterToSave = isAddingNew && newCharacterData
            ? newCharacterData
            : currentCharacter;
        
        // 先保存属性修改（如果有）
        if (attributePanelRef.current && attributePanelRef.current.hasChanges) {
            const success = await attributePanelRef.current.saveAttributes();
            if (!success) {
                toast.error('属性保存失败，请重试');
                return;
            }
        }
        
        await handlers.confirmEdit(characterToSave);
        // 保存成功后，更新原始数据并清除未保存状态
        if (gameData) {
            const npcs = getNpcs(gameData);
            const convertedCharacters: Character[] = [];
            if (gameData.worldSetting.player) {
                convertedCharacters.push(playerToCharacter(gameData.worldSetting.player));
            }
            if (npcs && npcs.length > 0) {
                const npcCharacters = npcs.map((npc: NPC | WorldNPC, index: number) => npcToCharacter(npc, index));
                convertedCharacters.push(...npcCharacters);
            }
            originalCharacterDataRef.current = JSON.parse(JSON.stringify(convertedCharacters));
        }
        setHasUnsavedChanges(false);
        // onDataChange?.();
    };

    // 删除角色
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
        // 新增模式下禁止上传图片
        if (isAddingNew) {
            return;
        }
        
        // 正常模式 - 区分玩家和NPC
        if (currentCharacter?.id === 'player') {
            playerFileInputRef.current?.click();
        } else {
            npcFileInputRef.current?.click();
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
        if (!handlers) return;
        await handlers.handleUploadImage(file, options);
    };

    const handleUploadPlayerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await handleUploadImage(file, {
            type: 'player',
            variant: 'base',
            inputRef: playerFileInputRef,
            successMessage: '玩家图片上传成功',
        });
    };

    const handleUploadNpcImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const characterId = isAddingNew && newCharacterData ? undefined : activeCharacterId;

        await handleUploadImage(file, {
            type: 'npc',
            characterId,
            variant: 'base',
            inputRef: npcFileInputRef,
            successMessage: '角色图片上传成功',
        });
    };

    // 必填字段列表（除了描述外的所有字段）
    const requiredFields = ['name', 'gender', 'identity', 'appearance', 'speech'];

    const handleUploadVariationImage = async (variation: Variation, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 新增模式下禁止上传图片
        if (isAddingNew) {
            toast.error('请先确认增加角色后再上传图片');
            return;
        }

        if (!currentCharacter) {
            toast.error('缺少必要数据，无法上传');
            return;
        }

        const inputRef = { current: variationFileInputRefs.current[variation.id] };

        // NPC 使用 uploadNpcImage
        await handleUploadImage(file, {
            type: 'variation',
            characterId: currentCharacter.id,
            variant: variation.label,
            inputRef,
            successMessage: '差分图片上传成功',
        });

    };

    // 点击差分 AI 生成前，先弹出积分确认
    const handleRequestVariationGenerate = (variation: Variation) => {
        // 新增模式下禁止生成图片
        if (isAddingNew) {
            toast.error('请先确认增加角色后再生成图片');
            return;
        }

        if (!currentCharacter) {
            toast.error('缺少必要数据，无法生成');
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
            toast.error('积分不足');
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
            toast.error('缺少必要数据，无法生成');
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
        if (!fileId || !api) {
            toast.error('缺少必要数据，无法下载');
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
            toast.success('图片下载成功');
        } catch (error) {
            console.error('下载图片失败:', error);
            toast.error('下载图片失败，请稍后重试');
        }
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 3</p>
                    <h2>角色档案 & 立绘差分</h2>
                    <p className={styles.subtitle}>解析出的角色自动列出，可逐项确认姓名、称呼、口癖与立绘</p>
                </div>
                <button
                    className={`${styles.ghost} ${styles.generateButton}`}
                    onClick={openNpcCostModal}
                    disabled={isGeneratingNpcImages || isLoadingNpcCost || isBlockingSwitch}
                >
                    <img
                        src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                        alt=""
                        className={styles.priceIcon}
                    />
                    <div className={styles.buttonTextContainer}>
                        <span className={styles.buttonMainText}>
                            {isGeneratingNpcImages ? '生成中...' : '一键生成所有角色立绘'}
                        </span>
                        <span className={styles.buttonSubText}>{IMAGE_GENERATION_COST}积分/张</span>
                    </div>
                </button>
            </div>

            <div className={styles.characterLayout}>
                {/* 左栏 - 角色列表 */}
                <CharactersSidebar
                    characters={characterData}
                    activeCharacterId={activeCharacterId}
                    isAddingNew={isAddingNew}
                    onSelectCharacter={setActiveCharacterId}
                    onDeleteCharacter={handleDeleteClick}
                    onAddNew={openAddNewPanel}
                    checkBeforeSwitch={checkBeforeSwitch}
                    setIsAddingNew={setIsAddingNew}
                    setNewCharacterData={setNewCharacterData}
                />

                {/* 右栏 - 角色详情（统一表单） */}
                {currentCharacter && (
                    <div className={styles.card}>
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

                        {/* 右侧面板头部 - 确认/取消按钮 */}
                        {isAddingNew ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                                <button className={styles.ghostSmall} onClick={confirmEdit}>
                                    确认增加
                                </button>
                                <button className={styles.ghostSmall} onClick={cancelAddNew}>
                                    取消
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                                <button className={styles.ghostSmall} onClick={confirmEdit}>
                                    确认修改
                                </button>
                            </div>
                        )}

                        <>
                            {/* 立绘 */}
                            <div
                                className={styles.portraitLarge}
                                style={{
                                    backgroundImage: currentCharacter.portrait ? `url('${withCacheBust(currentCharacter.portrait)}')` : 'none',
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                    cursor: (isAddingNew || (isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id)) ? 'not-allowed' : 'pointer'
                                }}
                                onClick={handlePortraitClick}
                            >
                                {currentCharacter.portrait && (
                                    <button
                                        className={styles.downloadButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (currentCharacter.id === 'player') {
                                                handleDownloadImage('players', '', 'base', currentCharacter.portrait);
                                            } else {
                                                handleDownloadImage('npcs', currentCharacter.id, 'base', currentCharacter.portrait);
                                            }
                                        }}
                                        title="下载图片"
                                    >
                                        <MdDownload size={18} />
                                    </button>
                                )}
                                <span className={styles.portraitHint}>
                                    {isAddingNew ? '请先确认增加角色后再上传图片' : '点击替换角色基础立绘'}
                                </span>
                                {isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id && (
                                    <div className={styles.loadingOverlay}>
                                        <div className={styles.loadingSpinner}></div>
                                        <div className={styles.loadingText}>正在生成角色立绘...</div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.portraitImageActions}>
                                <button className={styles.ghostSmall}
                                    onClick={handlePortraitClick}
                                    disabled={isAddingNew || (isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id)}
                                >
                                    上传图片
                                </button>
                                {currentCharacter && (
                                    <button
                                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                                        onClick={() => handleRequestSingleNpcGenerate(currentCharacter)}
                                        disabled={isAddingNew || (isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id)}
                                    >
                                        <img
                                            src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                                            alt=""
                                            className={styles.priceIcon}
                                        />
                                        <span>{IMAGE_GENERATION_COST} AI生成</span>
                                    </button>
                                )}
                            </div>

                            {/* 基础信息表单 */}
                            <div className={styles.formGrid}>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>姓名{requiredFields.includes('name') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {nameWords}/{CHARACTER_WORD_LIMITS.name}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={currentCharacter.name}
                                        {...nameLimit}
                                    />
                                </label>
                                <label>
                                    <span>称呼 / 昵称</span>
                                    <input
                                        type="text"
                                        value={currentCharacter.callName}
                                        onChange={(e) => handleFieldChange('callName', e.target.value)}
                                    />
                                </label>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>性别 / 形体{requiredFields.includes('gender') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {genderWords}/{CHARACTER_WORD_LIMITS.gender}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={currentCharacter.gender}
                                        {...genderLimit}
                                    />
                                </label>
                                <label>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>身份 / 当前身份{requiredFields.includes('identity') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {identityWords}/{CHARACTER_WORD_LIMITS.identity}
                                        </span>
                                    </div>
                                    <input
                                        type="text"
                                        value={currentCharacter.identity}
                                        {...identityLimit}
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>性格标签</span>
                                        <span className={styles.wordCounter}>
                                            {personalityWords}/{CHARACTER_WORD_LIMITS.personality}
                                        </span>
                                    </div>
                                    <textarea
                                        rows={2}
                                        value={currentCharacter.personality.join(' / ')}
                                        {...personalityLimit}
                                        placeholder="输入性格标签，用 / 或 ，分隔"
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>口癖 / 语气{requiredFields.includes('speech') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {speechWords}/{CHARACTER_WORD_LIMITS.speech}
                                        </span>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.speech}
                                        {...speechLimit}
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <div className={styles.labelRowWithCounter}>
                                        <span>外貌描述 / Prompt{requiredFields.includes('appearance') && <span className={styles.required}>*</span>}</span>
                                        <span className={styles.wordCounter}>
                                            {appearanceWords}/{CHARACTER_WORD_LIMITS.appearance}
                                        </span>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.appearance}
                                        {...appearanceLimit}
                                    />
                                </label>
                            </div>

                            {/* 立绘差分（可折叠） */}
                            {
                                currentCharacter.id !== 'player' &&
                                <div className={styles.detailBlock}>
                                    <div
                                        className={styles.collapsibleHeader}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => setIsVariationExpanded(!isVariationExpanded)}
                                    >
                                        <strong>立绘差分</strong>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span className={styles.mutedSmall}>
                                                {currentCharacter.variations.filter(v => v.label !== 'base').length} 个差分
                                            </span>
                                            <MdArrowDropDown size={30} style={{ transform: isVariationExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                        </div>
                                    </div>
                                    {isVariationExpanded && (
                                        <div className={styles.variationGrid}>
                                            {currentCharacter.variations.filter(v => v.label !== 'base').map((variation) => (
                                                <div key={variation.id} className={styles.variationCard}>
                                                    <div
                                                        className={`${styles.variationThumb} ${!variation.img ? styles.empty : ''}`}
                                                        style={variation.img ? { backgroundImage: `url('${withCacheBust(variation.img)}')` } : {}}
                                                    >
                                                        {/* 加载效果 */}
                                                        {isGeneratingVariation && generatingVariationId === variation.id && (
                                                            <div className={styles.loadingOverlay}>
                                                                <div className={styles.loadingSpinner}></div>
                                                                <div className={styles.loadingText}>正在生成...</div>
                                                            </div>
                                                        )}
                                                        {/* 下载按钮 */}
                                                        { currentCharacter.id !== 'player' && (
                                                            <>
                                                                <button
                                                                    className={styles.variationDeleteButton}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!handlers) return;
                                                                        setPendingVariationToDelete({ variation, character: currentCharacter });
                                                                        setDeleteVariationModalOpen(true);
                                                                    }}
                                                                    title="删除差分"
                                                                    disabled={isGeneratingVariation && generatingVariationId === variation.id}
                                                                >
                                                                    <RiDeleteBin5Line size={14} />
                                                                </button>
                                                                <button
                                                                    className={styles.variationDownloadButton}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const variantType = variation.label;
                                                                        handleDownloadImage('npcs', currentCharacter.id, variantType, variation.img);
                                                                    }}
                                                                    title="下载图片"
                                                                >
                                                                    <MdDownload size={14} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {!variation.img && !isGeneratingVariation && <span className={styles.mutedSmall}>等待图片</span>}
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
                                                            上传图片
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
                                                            <span>{isGeneratingVariation && generatingVariationId === variation.id ? '生成中...' : `${IMAGE_GENERATION_COST} AI生成`}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button className={styles.addCard} onClick={addVariation}>+ 新差分</button>
                                        </div>
                                    )}
                                </div>
                            }
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


                            {/* 人物背景 & 动机（可折叠） */}
                            <div className={styles.detailBlock}>
                                <div
                                    className={styles.collapsibleHeader}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setIsBackgroundExpanded(!isBackgroundExpanded)}
                                >
                                    <strong>人物背景 & 动机（可选）</strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span className={styles.mutedSmall}>不限格式，所有内容均是选填</span>
                                        <MdArrowDropDown size={30} style={{ transform: isBackgroundExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </div>
                                </div>
                                {isBackgroundExpanded && (
                                    <div className={styles.formGrid}>
                                        <label className={styles.wide}>
                                            <div className={styles.labelRowWithCounter}>
                                                <span>人物背景故事</span>
                                                <span className={styles.wordCounter}>
                                                    {backgroundWords}/{CHARACTER_WORD_LIMITS.background}
                                                </span>
                                            </div>
                                            <textarea
                                                rows={4}
                                                value={currentCharacter.background}
                                                {...backgroundLimit}
                                            />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>成长经历 / 转折</span>
                                            <textarea
                                                rows={4}
                                                value={currentCharacter.growth}
                                                onChange={(e) => handleFieldChange('growth', e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>短期目标</span>
                                            <input
                                                type="text"
                                                value={currentCharacter.goalShort}
                                                onChange={(e) => handleFieldChange('goalShort', e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>长期愿景</span>
                                            <input
                                                type="text"
                                                value={currentCharacter.goalLong}
                                                onChange={(e) => handleFieldChange('goalLong', e.target.value)}
                                            />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>隐藏秘密 / 禁忌</span>
                                            <textarea
                                                rows={3}
                                                value={currentCharacter.secret}
                                                onChange={(e) => handleFieldChange('secret', e.target.value)}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* 人物关系（可折叠） */}
                            <div className={styles.detailBlock}>
                                <div
                                    className={styles.collapsibleHeader}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setIsRelationshipExpanded(!isRelationshipExpanded)}
                                >
                                    <strong>人物关系（可选）</strong>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {isRelationshipExpanded && (
                                            <button
                                                className={styles.ghostSmall}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    addRelationship();
                                                }}
                                            >
                                                + 添加关系
                                            </button>
                                        )}
                                        <MdArrowDropDown size={30} style={{ transform: isRelationshipExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                    </div>
                                </div>
                                {isRelationshipExpanded && (
                                    <div className={styles.relationshipList}>
                                        {currentCharacter.relationships.length === 0 ? (
                                            <p className={styles.mutedSmall}>暂无关系。可添加与其他 NPC 的亲疏、不同身份下的角色差异等信息。</p>
                                        ) : (
                                            currentCharacter.relationships.map((rel) => (
                                                <div key={rel.id} className={styles.relationshipRow}>
                                                    <label>
                                                        <span>对象 / 称呼</span>
                                                        <input
                                                            type="text"
                                                            value={rel.name}
                                                            onChange={(e) => updateRelationship(rel.id, 'name', e.target.value)}
                                                        />
                                                    </label>
                                                    <label className={styles.wide}>
                                                        <span>关系描述</span>
                                                        <textarea
                                                            rows={3}
                                                            value={rel.description}
                                                            onChange={(e) => updateRelationship(rel.id, 'description', e.target.value)}
                                                        />
                                                    </label>
                                                    <button
                                                        className={styles.ghostTiny}
                                                        onClick={() => removeRelationship(rel.id)}
                                                    >删除</button>
                                                </div>
                                            ))
                                        )}
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
                            <h3>新增差分</h3>
                            <button className={styles.modalClose} onClick={closeVariationModal}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <label>
                                <span>差分类型<span className={styles.required}>*</span></span>
                                <select
                                    value={newVariationType}
                                    onChange={(e) => setNewVariationType(e.target.value)}
                                >
                                    <option value="">请选择类型</option>
                                    {VARIATION_TYPES.map(type => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>差分标签<span className={styles.required}>*</span></span>
                                <input type="text" value={newVariationLabel} onChange={(e) => setNewVariationLabel(e.target.value)} />
                            </label>
                            <label>
                                <span>描述（可选）</span>
                                <textarea
                                    rows={3}
                                    value={newVariationDescription}
                                    onChange={(e) => setNewVariationDescription(e.target.value)}
                                    placeholder="输入差分描述..."
                                />
                            </label>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.ghostSmall} onClick={closeVariationModal}>取消</button>
                            <button className={styles.ghostSmall} onClick={confirmAddVariation}>确认</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 删除确认弹窗 */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除角色"
                message="删除后角色数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {/* 一键生成角色立绘积分提示 */}
            <ConfirmModal
                isOpen={npcCostModalOpen}
                onConfirm={confirmGenerateAllNpcImages}
                onCancel={() => setNpcCostModalOpen(false)}
                title="积分扣除确认"
                message={
                    npcCostPoints != null
                        ? `本次一键生成角色立绘将扣除 ${npcCostPoints} 积分（当前账户积分 ${userPoints}${npcCostPoints > userPoints ? '，积分不足' : ''}），是否继续？`
                        : `将扣除一定积分（当前积分 ${userPoints}），是否继续？`
                }
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 单个角色立绘生成积分提示 */}
            <ConfirmModal
                isOpen={singleNpcCostModalOpen}
                onConfirm={confirmSingleNpcGenerate}
                onCancel={cancelSingleNpcGenerate}
                title="积分扣除确认"
                message={`本次生成角色立绘将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 差分图片生成积分提示 */}
            <ConfirmModal
                isOpen={variationCostModalOpen}
                onConfirm={confirmVariationGenerate}
                onCancel={cancelVariationGenerate}
                title="积分扣除确认"
                message={`本次生成差分图片将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
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
                title="删除差分"
                message="删除后差分图片不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {isGeneratingNpcImages && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成角色立绘...</div>
                </div>
            )}

            {/* 保存确认弹窗 */}
            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    // 保存当前正在编辑的角色，而不是所有角色
                    try {
                        await confirmEdit();
                        setSaveConfirmModalOpen(false);
                        setIsBlockingSwitch(false);
                        setHasUnsavedChanges(false);
                        executePendingAction();
                    } catch (error) {
                        toast.error('保存失败，请重试');
                        // 保存失败时不关闭弹窗，不执行待处理操作
                    }
                }}
                onDiscard={() => {
                    setSaveConfirmModalOpen(false);
                    setHasUnsavedChanges(false);
                    setIsBlockingSwitch(false);
                    executePendingAction();
                }}
                onCancel={() => {
                    setSaveConfirmModalOpen(false);
                    setPendingAction(null);
                    setIsBlockingSwitch(false);
                }}
                title="未保存的修改"
                message="您有未保存的修改，是否要保存？"
                saveButtonText="保存"
                discardButtonText="不保存"
            />
        </div>
    );
});

CharactersPanel.displayName = 'CharactersPanel';

export default CharactersPanel;
