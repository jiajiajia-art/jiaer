import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './CharactersPanel.module.css';
import { IMAGE_GENERATION_COST } from '../../utils/constants';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { NPCSetting, NPC } from '../../api/galgame/EditorData.type';
import type { NPCSetting as WorldNPCSetting, NPC as WorldNPC } from '../../api/worldInteraction/worldInteractionApi.type';
import { MdArrowDropDown } from 'react-icons/md';
import { MdDownload } from 'react-icons/md';
import DeletModal from '../goodsModal/DeletModal';
import { toast } from 'react-hot-toast';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { useGameStore } from '../../store/gameStore';
import type { Character, Variation, Relationship } from './CharactersPanel/types';
import { VARIATION_TYPES } from './CharactersPanel/types';
import { getPlayer, getNpcs, npcToCharacter, playerToCharacter } from './CharactersPanel/utils';
import { createApiHelpers } from './CharactersPanel/apiHelpers';
import { createHandlers } from './CharactersPanel/handlers';

interface CharactersPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
    mode: string;
}

const CharactersPanel: React.FC<CharactersPanelProps> = ({
    gameData,
    isLoading = false,
    onGetData,
    onDataChange,
    mode = 'visual'
}) => {
    const { fileId } = useGameStore();
    const api = createApiHelpers(mode);
    
    const [activeCharacterId, setActiveCharacterId] = useState<string>('');
    const [characterData, setCharacterData] = useState<Character[]>([]);
    const [isBackgroundExpanded, setIsBackgroundExpanded] = useState<boolean>(false);
    const [isRelationshipExpanded, setIsRelationshipExpanded] = useState<boolean>(false);
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

    // 当 gameData 变化时，填充角色数据
    useEffect(() => {
        if (!gameData) return;

        const npcs = getNpcs(gameData);
        if (npcs && npcs.length > 0) {
            const convertedCharacters: Character[] = npcs.map((npc: NPC | WorldNPC, index: number) => npcToCharacter(npc, index));

            // 添加玩家角色（使用辅助函数兼容两种模式）
            const player = getPlayer(gameData);
            if (player) {
                convertedCharacters.unshift(playerToCharacter(player));
            }

            setCharacterData(convertedCharacters);
            if (convertedCharacters.length > 0 && !isAddingNew) {
                setActiveCharacterId(convertedCharacters[0].id);
            }
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
                const images: { base: string; [key: string]: string } = {
                    base: char.portrait || '', // base 图片来自 portrait
                };
                char.variations
                    .filter(v => v.label !== 'base') // 确保不包含 base
                    .forEach(variation => {
                        if (variation.type && variation.img) {
                            images[variation.type] = variation.img;
                        } else if (variation.label && variation.img) {
                            images[variation.label] = variation.img;
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
    }, [fileId, mode, api, activeCharacterId, isAddingNew, newCharacterData, onDataChange]);

    // 获取当前显示的角色（统一处理新增和编辑模式）
    const currentCharacter = isAddingNew && newCharacterData
        ? newCharacterData
        : (characterData.find(c => c.id === activeCharacterId) || characterData[0]);

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

    // 如果没有角色数据且不在新增模式，显示空状态
    if (!isAddingNew && (characterData.length === 0 || !currentCharacter)) {
        return (
            <div className={styles.panelContent}>
                <div className={styles.panelHeader}>
                    <div>
                        <p className={styles.eyebrow}>Step 3</p>
                        <h2>角色差分</h2>
                        <p className={styles.subtitle}>
                            {isLoading ? '正在加载角色数据...' : '暂无角色数据，请先上传文档并等待解析完成'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const handleFieldChange = (field: keyof Character, value: string) => {
        if (field === 'personality') {
            const tags = value.split(/[，,\/、\s]+/).map(tag => tag.trim()).filter(Boolean);
            updateField(field, tags);
        } else {
            updateField(field, value);
        }
    };

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

        closeVariationModal();
    };

    // 差分管理（保留原函数名以兼容）
    const addVariation = () => {
        openAddVariationModal();
    };

    // 打开新增角色面板（使用空角色数据）
    const openAddNewPanel = () => {
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
        await handlers.confirmEdit(characterToSave);
        onDataChange?.();
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
        if (isAddingNew && newCharacterData) {
            // 新增模式
            npcFileInputRef.current?.click();
        } else {
            // 正常模式 - 区分玩家和NPC
            if (currentCharacter?.id === 'player') {
                playerFileInputRef.current?.click();
            } else {
                npcFileInputRef.current?.click();
            }
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
    const handleDownloadImage = async (type: 'npcs' | 'players' | 'scenes' | 'subscenes' | 'worldMap', id: string, variant?: string) => {
        if (!fileId || !api) {
            toast.error('缺少必要数据，无法下载');
            return;
        }

        try {
            const response = await api.downloadImage(fileId, type, id, variant);
            // 创建下载链接
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const fileName = variant ? `${id}_${variant}.png` : `${id}.png`;
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
                    disabled={isGeneratingNpcImages || isLoadingNpcCost}
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
                <div 
                    className={styles.card}
                    style={{ maxHeight: '72vh', overflowY: 'auto' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3>解析出的角色</h3>
                        <button className={styles.ghostSmall} onClick={openAddNewPanel}>
                            + 新增角色
                        </button>
                    </div>
                    <div className={styles.characterRoster}>
                        {characterData.map((character) => (
                            <article
                                key={character.id}
                                className={`${styles.characterRow} ${character.id === activeCharacterId ? styles.active : ''}`}
                                onClick={() => {
                                    // 如果正在新增模式，点击侧边栏时取消新增并切换到所选角色
                                    if (isAddingNew) {
                                        setIsAddingNew(false);
                                        setNewCharacterData(null);
                                    }
                                    setActiveCharacterId(character.id);
                                }}
                            >
                                <div
                                    className={styles.characterThumb}
                                    style={{ backgroundImage: character.portrait ? `url('${character.portrait}')` : 'none' }}
                                />
                                <div className={styles.characterMeta}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                        <strong>{character.name || '未命名'}</strong>
                                        {character.id !== 'player' && (
                                            <button
                                                className={styles.deleteButton}
                                                onClick={(e) => handleDeleteClick(character.id, e)}
                                                title="删除角色"
                                            >
                                                <RiDeleteBin5Line />
                                            </button>
                                        )}
                                    </div>
                                    <p className={styles.mutedSmall}>{character.role || ''} · {character.identity || ''}</p>
                                    <div className={styles.tagRow}>
                                        {character.personality && character.personality.length > 0 ? (
                                            character.personality.map((tag) => (
                                                <span key={tag} className={styles.tag}>{tag}</span>
                                            ))
                                        ) : (
                                            <span className={styles.mutedSmall}>暂无性格标签</span>
                                        )}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

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
                                    backgroundImage: currentCharacter.portrait ? `url('${currentCharacter.portrait}')` : 'none',
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                    cursor: isGeneratingSingleNpcImage ? 'not-allowed' : 'pointer'
                                }}
                                onClick={handlePortraitClick}
                            >
                                {/* 下载按钮 */}
                                {currentCharacter.portrait && (
                                    <button
                                        className={styles.downloadButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (currentCharacter.id === 'player') {
                                                // player 的 URL 格式：/players/base.png，不需要 id
                                                handleDownloadImage('players', '', 'base');
                                            } else {
                                                handleDownloadImage('npcs', currentCharacter.id, 'base');
                                            }
                                        }}
                                        title="下载图片"
                                    >
                                        <MdDownload size={18} />
                                    </button>
                                )}
                                <span className={styles.portraitHint}>
                                    {isAddingNew ? '点击上传角色基础立绘' : '点击替换角色基础立绘'}
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
                                    disabled={isGeneratingSingleNpcImage}
                                >
                                    上传图片
                                </button>
                                {currentCharacter && (
                                    <button
                                        className={`${styles.ghostSmall} ${styles.generateButton}`}
                                        onClick={() => handleRequestSingleNpcGenerate(currentCharacter)}
                                        disabled={isGeneratingSingleNpcImage}
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
                                    <span>姓名{requiredFields.includes('name') && <span className={styles.required}>*</span>}</span>
                                    <input
                                        type="text"
                                        value={currentCharacter.name}
                                        onChange={(e) => handleFieldChange('name', e.target.value)}
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
                                    <span>性别 / 形体{requiredFields.includes('gender') && <span className={styles.required}>*</span>}</span>
                                    <input
                                        type="text"
                                        value={currentCharacter.gender}
                                        onChange={(e) => handleFieldChange('gender', e.target.value)}
                                    />
                                </label>
                                <label>
                                    <span>身份 / 当前身份{requiredFields.includes('identity') && <span className={styles.required}>*</span>}</span>
                                    <input
                                        type="text"
                                        value={currentCharacter.identity}
                                        onChange={(e) => handleFieldChange('identity', e.target.value)}
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>性格标签</span>
                                    <textarea
                                        rows={2}
                                        value={currentCharacter.personality.join(' / ')}
                                        onChange={(e) => handleFieldChange('personality', e.target.value)}
                                        placeholder="输入性格标签，用 / 或 ，分隔"
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>口癖 / 语气{requiredFields.includes('speech') && <span className={styles.required}>*</span>}</span>
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.speech}
                                        onChange={(e) => handleFieldChange('speech', e.target.value)}
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>外貌描述 / Prompt{requiredFields.includes('appearance') && <span className={styles.required}>*</span>}</span>
                                    <textarea
                                        rows={3}
                                        value={currentCharacter.appearance}
                                        onChange={(e) => handleFieldChange('appearance', e.target.value)}
                                    />
                                </label>
                            </div>

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
                                            <span>人物背景故事</span>
                                            <textarea
                                                rows={4}
                                                value={currentCharacter.background}
                                                onChange={(e) => handleFieldChange('background', e.target.value)}
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

                            {/* 立绘差分 */}
                            {
                                currentCharacter.id !== 'player' &&
                                <div className={styles.detailBlock}>
                                    <div className={styles.cardHead}>
                                        <strong>立绘差分</strong>
                                        <span className={styles.mutedSmall}>
                                            {currentCharacter.variations.filter(v => v.label !== 'base').length} 个差分
                                        </span>
                                    </div>
                                    <div className={styles.variationGrid}>
                                        {currentCharacter.variations.filter(v => v.label !== 'base').map((variation) => (
                                            <div key={variation.id} className={styles.variationCard}>
                                                <div
                                                    className={`${styles.variationThumb} ${!variation.img ? styles.empty : ''}`}
                                                    style={variation.img ? { backgroundImage: `url('${variation.img}')` } : {}}
                                                >
                                                    {/* 加载效果 */}
                                                    {isGeneratingVariation && generatingVariationId === variation.id && (
                                                        <div className={styles.loadingOverlay}>
                                                            <div className={styles.loadingSpinner}></div>
                                                            <div className={styles.loadingText}>正在生成...</div>
                                                        </div>
                                                    )}
                                                    {/* 下载按钮 */}
                                                    {variation.img && currentCharacter.id !== 'player' && (
                                                        <button
                                                            className={styles.downloadButton}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const variantType = variation.label;
                                                                handleDownloadImage('npcs', currentCharacter.id, variantType);
                                                            }}
                                                            title="下载图片"
                                                        >
                                                            <MdDownload size={16} />
                                                        </button>
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
                                                        disabled={isGeneratingVariation && generatingVariationId === variation.id}
                                                    >
                                                        上传图片
                                                    </button>
                                                    <button
                                                        className={`${styles.ghostTiny} ${styles.generateButton}`}
                                                        onClick={() => handleRequestVariationGenerate(variation)}
                                                        disabled={isGeneratingVariation && generatingVariationId === variation.id}
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
                                </div>
                            }

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
            <DeletModal
                isOpen={deleteModalOpen}
                onDelete={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除角色"
                message="删除后角色数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {/* 一键生成角色立绘积分提示 */}
            <DeletModal
                isOpen={npcCostModalOpen}
                onDelete={confirmGenerateAllNpcImages}
                onCancel={() => setNpcCostModalOpen(false)}
                title="积分扣除确认"
                message={
                    npcCostPoints != null
                        ? `本次一键生成角色立绘将扣除 ${npcCostPoints} 积分，是否继续？`
                        : '将扣除一定积分，是否继续？'
                }
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 单个角色立绘生成积分提示 */}
            <DeletModal
                isOpen={singleNpcCostModalOpen}
                onDelete={confirmSingleNpcGenerate}
                onCancel={cancelSingleNpcGenerate}
                title="积分扣除确认"
                message={`本次生成角色立绘将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 差分图片生成积分提示 */}
            <DeletModal
                isOpen={variationCostModalOpen}
                onDelete={confirmVariationGenerate}
                onCancel={cancelVariationGenerate}
                title="积分扣除确认"
                message={`本次生成差分图片将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {isGeneratingNpcImages && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成角色立绘...</div>
                </div>
            )}
        </div>
    );
};

export default CharactersPanel;
