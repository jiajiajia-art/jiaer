import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './CharactersPanel.module.css';
import type { AllGameData, NPCSetting, NPC, Player } from '../../api/galgame/EditorData.type';
import { MdArrowDropDown } from 'react-icons/md';
import DeletModal from '../goodsModal/DeletModal';
import EditorApi from '../../api/galgame/EditorData';
import { toast } from 'react-hot-toast';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { useEditorStore } from '../../store/editorStore';

interface Relationship {
    id: string;
    name: string;
    description: string;
}

interface Variation {
    id: string;
    label: string;
    img: string;
    type?: string; // 差分类型值，如 'happy', 'sad' 等
    description?: string; // 差分描述（可选）
}

interface Character {
    id: string;
    name: string;
    callName: string;
    gender: string;
    role: string;
    identity: string;
    personality: string[];
    speech: string;
    appearance: string;
    portrait: string;
    background: string;
    growth: string;
    goalShort: string;
    goalLong: string;
    secret: string;
    relationships: Relationship[];
    variations: Variation[];
}

interface CharactersPanelProps {
    gameData?: AllGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
}

const CharactersPanel: React.FC<CharactersPanelProps> = ({ gameData, isLoading = false, onGetData, onDataChange }) => {
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
    const { fileId } = useEditorStore();

    // 为图片 URL 添加时间戳，避免缓存导致的旧图显示
    const withCacheBust = (url?: string) => {
        if (!url) return '';
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}cb=${Date.now()}`;
    };

    // 当 gameData 变化时，填充角色数据
    useEffect(() => {
        if (gameData?.npcSetting?.npcs) {
            const npcs = gameData.npcSetting.npcs;
            const convertedCharacters: Character[] = npcs.map((npc, index) => {
                // 转换 images 对象为 variations 数组
                const variations: Variation[] = npc.images
                    ? Object.entries(npc.images).map(([label, img], idx) => ({
                        id: `v${idx}`,
                        label,
                        img: withCacheBust(img),
                        type: label, // 使用 label 作为 type
                    }))
                    : [];

                return {
                    id: npc.id || `npc-${index}`,
                    name: npc.name || '',
                    callName: npc.name || '',
                    gender: npc.gender || '',
                    role: npc.job || 'NPC',
                    identity: npc.race ? `${npc.race} · ${npc.job || ''}` : (npc.job || ''),
                    personality: npc.personality ? [npc.personality] : [],
                    speech: npc.tone || '',
                    appearance: npc.appearance || '',
                    portrait: npc.images?.base ? withCacheBust(npc.images.base) : (npc.images ? withCacheBust(Object.values(npc.images)[0]) : ''),
                    background: npc.description || '',
                    growth: '',
                    goalShort: '',
                    goalLong: '',
                    secret: '',
                    relationships: npc.relationship ? [{
                        id: 'r1',
                        name: '玩家',
                        description: npc.relationship,
                    }] : [],
                    variations,
                };
            });

            // 添加玩家角色
            if (gameData.worldSetting?.player) {
                const player = gameData.worldSetting.player;
                // 玩家仅当有 images 对象时才转换为 variations
                const playerVariations: Variation[] = player.images
                    ? Object.entries(player.images).map(([label, img], idx) => ({
                        id: `v${idx}`,
                        label,
                        img: withCacheBust(img),
                        type: label,
                    }))
                    : [];

                convertedCharacters.unshift({
                    id: 'player',
                    name: player.name || '玩家',
                    callName: player.name || '玩家',
                    gender: player.gender || '',
                    role: '主角',
                    identity: player.race || '',
                    personality: player.personality ? [player.personality] : [],
                    speech: player.tone || '',
                    appearance: player.appearance || '',
                    portrait: withCacheBust(player.image || player.images?.base || ''), // 使用 image 字段作为主要上传的肚像
                    background: '',
                    growth: '',
                    goalShort: '',
                    goalLong: '',
                    secret: '',
                    relationships: [],
                    variations: playerVariations, // 仅有 images 对象时才有差分
                });
            }

            setCharacterData(convertedCharacters);
            if (convertedCharacters.length > 0 && !isAddingNew) {
                setActiveCharacterId(convertedCharacters[0].id);
            }
        }
    }, [gameData, isAddingNew]);

    // 将 characterData 转换为 npcSetting 格式
    const getNpcSettingData = useCallback((): NPCSetting | null => {
        if (!gameData?.npcSetting) return null;

        // 过滤掉玩家角色，只处理 NPC
        const npcs = characterData
            .filter(char => char.id !== 'player')
            .map(char => {
                // 从 identity 中解析 race 和 job
                const identityParts = char.identity.split(' · ');
                const race = identityParts.length > 1 ? identityParts[0] : undefined;
                const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || char.role);

                // 将 variations 转换回 images 对象
                const images: { [key: string]: string } = {};
                char.variations.forEach(variation => {
                    if (variation.type && variation.img) {
                        images[variation.type] = variation.img;
                    } else if (variation.label && variation.img) {
                        images[variation.label] = variation.img;
                    }
                });

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
                    images: Object.keys(images).length > 0 ? images : undefined,
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

    // 差分类型选项
    const VARIATION_TYPES = [
        {
            value: 'expression',
            label: '表情',
        },
        {
            value: 'clothing',
            label: '服装',
        },
        {
            value: 'pose',
            label: '姿势',
        },
    ];

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
        const characterToSave = isAddingNew && newCharacterData
            ? newCharacterData
            : currentCharacter;

        if (!fileId || !characterToSave) {
            toast.error('缺少必要数据，无法保存修改');
            return;
        }

        // 如果是主角，使用 updatePlayer API
        if (characterToSave.id === 'player') {
            // 更新主角信息
            // 将 variations 转换回 images 对象
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
                image: characterToSave.portrait || '', // 主要上传的肚像
                images: Object.keys(images).length > 0 ? images : undefined, // 差分对象
            };

            try {
                const response = await EditorApi.updatePlayer(fileId, playerData as Player);
                if (response.data?.success) {
                    toast.success('主角信息更新成功');
                    // 刷新数据
                    if (onDataChange) {
                        onDataChange();
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
            // 从 identity 中解析 race 和 job
            const identityParts = characterToSave.identity.split(' · ');
            const race = identityParts.length > 1 ? identityParts[0] : undefined;
            const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || characterToSave.role);

            // 将 variations 转换回 images 对象
            const images: { [key: string]: string } = {};
            characterToSave.variations.forEach(variation => {
                if (variation.type && variation.img) {
                    images[variation.type] = variation.img;
                } else if (variation.label && variation.img) {
                    images[variation.label] = variation.img;
                }
            });

            // 获取与玩家的关系
            const playerRelationship = characterToSave.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

            const npcData: NPC = {
                id: characterToSave.id.startsWith('temp-') ? `npc_${Date.now()}` : characterToSave.id,
                name: characterToSave.name || '',
                gender: characterToSave.gender || '',
                job: job || undefined,
                race: race || undefined,
                description: characterToSave.background || '',
                appearance: characterToSave.appearance || '',
                personality: characterToSave.personality && characterToSave.personality.length > 0 ? characterToSave.personality.join(', ') : undefined,
                tone: characterToSave.speech || '',
                relationship: playerRelationship?.description || undefined,
                images: Object.keys(images).length > 0 ? images : undefined,
            };

            try {
                let response;
                if (isAddingNew) {
                    // 新增模式
                    response = await EditorApi.addNpc(fileId, npcData);
                } else {
                    // 更新模式
                    response = await EditorApi.updateNpc(fileId, npcData);
                }

                if (response.data?.success) {
                    toast.success(isAddingNew ? '角色创建成功' : '角色更新成功');
                    // 刷新数据
                    if (onDataChange) {
                        onDataChange();
                    }
                    // 如果是新增模式，关闭新增面板
                    if (isAddingNew) {
                        setIsAddingNew(false);
                        setNewCharacterData(null);
                        if (characterData.length > 0) {
                            setActiveCharacterId(characterData[0].id);
                        }
                    }
                } else {
                    toast.error(isAddingNew ? '创建角色失败' : '更新角色失败');
                }
            } catch (error) {
                console.error(isAddingNew ? '创建角色时出错:' : '更新角色时出错:', error);
                toast.error(isAddingNew ? '创建角色失败，请重试' : '更新角色失败，请重试');
            }
        }
    };

    // 删除角色
    const handleDeleteClick = (characterId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止触发角色选择
        setCharacterToDelete(characterId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!characterToDelete || !fileId) {
            setDeleteModalOpen(false);
            setCharacterToDelete(null);
            return;
        }

        // 玩家角色不能删除
        if (characterToDelete === 'player') {
            toast.error('不能删除玩家角色');
            setDeleteModalOpen(false);
            setCharacterToDelete(null);
            return;
        }

        try {
            const response = await EditorApi.deleteNpc(fileId, characterToDelete);
            if (response.data?.success) {
                setCharacterData(prev => {
                    const filtered = prev.filter(char => char.id !== characterToDelete);
                    // 如果删除的是当前选中的角色，切换到第一个角色
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
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('删除角色失败');
            }
        } catch (error) {
            console.error('删除角色时出错:', error);
            toast.error('删除角色失败，请重试');
        } finally {
            setDeleteModalOpen(false);
            setCharacterToDelete(null);
        }
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

    // 验证文件
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
            images: Object.keys(images).length > 0 ? images : undefined,
        };

        try {
            const createResponse = await EditorApi.addNpc(fileId, newNpc);
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
        // 验证文件
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
                response = await EditorApi.uploadPlayerImage(fileId, {
                    file,
                    variant,
                });
            } else if (type === 'npc' || type === 'variation') {
                if (!targetCharacterId) {
                    toast.error('缺少角色ID，无法上传');
                    return;
                }
                response = await EditorApi.uploadNpcImage(fileId, targetCharacterId, {
                    file,
                    variat: variant,
                });
            } else {
                toast.error('未知的上传类型');
                return;
            }

            if (response.data?.success) {
                toast.success(successMessage || '图片上传成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }

                // 如果是玩家图片，更新 portrait 或 variations
                if (type === 'player' && !isAddingNew) {
                    setCharacterData(prev =>
                        prev.map(char => {
                            if (char.id === 'player') {
                                // 如果是 base 变体，更新 portrait
                                if (variant === 'base') {
                                    const newPortrait = withCacheBust(
                                        response.data?.worldSetting?.player?.images?.base ||
                                        response.data?.worldSetting?.player?.image ||
                                        char.portrait
                                    );
                                    return { ...char, portrait: newPortrait };
                                }
                                // 否则检查是否已存在该variant的variation
                                const existingVarIndex = char.variations.findIndex(v => v.label === variant);
                                if (existingVarIndex >= 0) {
                                    // 更新现有的
                                    const newVariations = [...char.variations];
                                    newVariations[existingVarIndex] = {
                                        ...newVariations[existingVarIndex],
                                        img: withCacheBust(response.data?.worldSetting?.player?.images?.[variant] || response.data?.worldSetting?.player?.image || ''),
                                    };
                                    return { ...char, variations: newVariations };
                                } else {
                                    // 添加新的
                                    const newVar: Variation = {
                                        id: `v-${Date.now()}`,
                                        label: variant,
                                        img: withCacheBust(response.data?.worldSetting?.player?.images?.[variant] || response.data?.worldSetting?.player?.image || ''),
                                        type: variant,
                                    };
                                    return { ...char, variations: [...char.variations, newVar] };
                                }
                            }
                            return char;
                        })
                    );
                }

                // 如果是NPC基础立绘，更新本地portrait
                if (type === 'npc' && variant === 'base' && targetCharacterId && !isAddingNew) {
                    const firstImageUrl = response.data?.npcSetting?.npcs.find(npc => npc.id === targetCharacterId)?.images?.base || '';
                    if (firstImageUrl) {
                        updateField('portrait', withCacheBust(firstImageUrl));
                    }
                }
            } else {
                toast.error('上传失败，请重试');
            }
        } catch (error) {
            console.error('上传图片时出错:', error);
            toast.error('上传图片失败，请重试');
        } finally {
            // 清空 input 值
            if (inputRef && 'current' in inputRef && inputRef.current) {
                inputRef.current.value = '';
            }
        }
    };

    // 上传玩家图片
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

    // 上传NPC基础立绘
    const handleUploadNpcImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const characterId = isAddingNew && newCharacterData ? undefined : activeCharacterId;

        await handleUploadImage(file, {
            type: 'npc',
            characterId,
            variant: currentCharacter?.id == 'player' ? 'base' : currentCharacter?.variations.find(v => v.label === 'base')?.label || 'base',
            inputRef: npcFileInputRef,
            successMessage: '角色图片上传成功',
        });
    };

    const regenerateNpcImage = async (npc: Character) => {
        if (!fileId || !npc) {
            return;
        }
        try {
            const { id, name, age, gender, job, race, description, appearance } = npc as any;
            const response = await EditorApi.generateNpcImage({
                fileId,
                npc: { id, name, age, gender, job, race, description, appearance },
                removeBg: false
            });
            if (response.data?.success) {
                toast.success('NPC图片重新生成成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('重新生成NPC图片失败');
            }
        } catch (error) {
            console.error('重新生成NPC图片时出错:', error);
            toast.error('重新生成NPC图片失败，请重试');
        }
    };

    // 必填字段列表（除了描述外的所有字段）
    const requiredFields = ['name', 'gender', 'identity', 'appearance', 'speech'];

    // 上传差分图片
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

    // AI 生成差分图片
    const regenerateVariationImage = async (variation: Variation) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error('缺少必要数据，无法生成');
            return;
        }

        // 需要基础图片URL，如果没有则提示
        if (!currentCharacter.portrait) {
            toast.error('请先上传角色基础立绘');
            return;
        }

        try {
            const response = await EditorApi.generateVariantImage({
                fileId,
                npcId: currentCharacter.id === 'player' ? 'player' : currentCharacter.id, // 玩家使用 "player" 作为 ID
                baseImagePath: currentCharacter.portrait,
                variant: {
                    type: (variation.type || 'expression') as 'expression' | 'clothing' | 'pose',
                    value: variation.label,
                    description: variation.description,
                },
                removeBg: false,
            });
            if (response.data?.success) {
                toast.success('差分图片生成成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('生成差分图片失败');
            }
        } catch (error) {
            console.error('生成差分图片时出错:', error);
            toast.error('生成差分图片失败，请重试');
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
                <button className={styles.ghost}>导出角色 JSON</button>
            </div>

            <div className={styles.characterLayout}>
                {/* 左栏 - 角色列表 */}
                <div className={styles.card}>
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
                                    if (!isAddingNew) {
                                        setActiveCharacterId(character.id);
                                    }
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

                        {/* 统一表单 */}
                        <>
                            {/* 立绘 */}
                            <div
                                className={styles.portraitLarge}
                                style={{ 
                                    backgroundImage: currentCharacter.portrait ? `url('${currentCharacter.portrait}')` : 'none', 
                                    backgroundSize: 'contain',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                }}
                                onClick={handlePortraitClick}
                            >
                                <span className={styles.portraitHint}>
                                    {isAddingNew ? '点击上传角色基础立绘' : '点击替换角色基础立绘'}
                                </span>
                            </div>

                            <div className={styles.portraitImageActions}>
                                <button className={styles.ghostSmall} onClick={handlePortraitClick}>
                                    {isAddingNew ? '上传立绘' : '重新上传'}
                                </button>
                                {currentCharacter && currentCharacter.id !== 'player' && (
                                    <button
                                        className={styles.ghostSmall}
                                        onClick={() => regenerateNpcImage(currentCharacter)}
                                    >AI 重新生成</button>
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
                                        <span className={styles.mutedSmall}>默认 + {currentCharacter.variations.length} 个差分</span>
                                    </div>
                                    <div className={styles.variationGrid}>
                                        {currentCharacter.variations.map((variation) => (
                                            <div key={variation.id} className={styles.variationCard}>
                                                <div
                                                    className={`${styles.variationThumb} ${!variation.img ? styles.empty : ''}`}
                                                    style={variation.img ? { backgroundImage: `url('${variation.img}')` } : {}}
                                                >
                                                    {!variation.img && <span className={styles.mutedSmall}>等待图片</span>}
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
                                                    >
                                                        上传图片
                                                    </button>
                                                    <button
                                                        className={styles.ghostTiny}
                                                        onClick={() => regenerateVariationImage(variation)}
                                                    >
                                                        AI 生成
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
        </div>
    );
};

export default CharactersPanel;
