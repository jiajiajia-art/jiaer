import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './CharactersPanel.module.css';
import type { AllGameData, NPCSetting, NPC } from '../../api/galgame/EditorData.type';
import { MdArrowDropDown } from 'react-icons/md';
import DeletModal from '../goodsModal/DeletModal';
import EditorApi from '../../api/galgame/EditorData';
import { toast } from 'react-hot-toast';
import { RiDeleteBin5Line } from 'react-icons/ri';

interface Relationship {
    id: string;
    name: string;
    description: string;
}

interface Variation {
    id: string;
    label: string;
    img: string;
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
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<AllGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
}

const CharactersPanel: React.FC<CharactersPanelProps> = ({ gameData, isLoading = false, fileId, onGetData, onDataChange }) => {
    const [activeCharacterId, setActiveCharacterId] = useState<string>('');
    const [characterData, setCharacterData] = useState<Character[]>([]);
    const [isBackgroundExpanded, setIsBackgroundExpanded] = useState<boolean>(false);
    const [isRelationshipExpanded, setIsRelationshipExpanded] = useState<boolean>(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [characterToDelete, setCharacterToDelete] = useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newCharacterData, setNewCharacterData] = useState<Character | null>(null);
    const playerFileInputRef = useRef<HTMLInputElement>(null);
    const npcFileInputRef = useRef<HTMLInputElement>(null);
    const editingFileInputRef = useRef<HTMLInputElement>(null);

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
                        img,
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
                    portrait: npc.images ? Object.values(npc.images)[0] || '' : '',
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
                    portrait: '',
                    background: '',
                    growth: '',
                    goalShort: '',
                    goalLong: '',
                    secret: '',
                    relationships: [],
                    variations: [],
                });
            }

            setCharacterData(convertedCharacters);
            if (convertedCharacters.length > 0) {
                setActiveCharacterId(convertedCharacters[0].id);
            }
        }
    }, [gameData]);

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
                    if (variation.label && variation.img) {
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

    // 更新角色字段
    const updateField = (field: keyof Character, value: string | string[]) => {
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId ? { ...char, [field]: value } : char
            )
        );
    };

    const activeCharacter = characterData.find(c => c.id === activeCharacterId) || characterData[0];

    // 如果没有角色数据，显示空状态
    if (characterData.length === 0 || !activeCharacter) {
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

    // 关系管理
    const addRelationship = () => {
        const newRel: Relationship = { id: `r-${Date.now()}`, name: '', description: '' };
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, relationships: [...char.relationships, newRel] }
                    : char
            )
        );
    };

    const updateRelationship = (relId: string, key: 'name' | 'description', value: string) => {
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
    };

    const removeRelationship = (relId: string) => {
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, relationships: char.relationships.filter(r => r.id !== relId) }
                    : char
            )
        );
    };

    // 差分管理
    const addVariation = () => {
        const label = prompt('输入差分标签', '新差分');
        if (!label) return;
        const newVar: Variation = { id: `v-${Date.now()}`, label, img: '' };
        setCharacterData(prev =>
            prev.map(char =>
                char.id === activeCharacterId
                    ? { ...char, variations: [...char.variations, newVar] }
                    : char
            )
        );
    };

    // 打开新增角色面板
    const openAddNewPanel = () => {
        const newCharacter: Character = {
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
        setNewCharacterData(newCharacter);
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

    // 确认修改角色（直接使用当前选中的角色数据）
    const confirmEdit = async () => {
        if (!fileId || !activeCharacter) {
            toast.error('缺少必要数据，无法保存修改');
            return;
        }
        
        const characterToSave = activeCharacter;

        // 如果是主角，使用 updatePlayer API
        if (characterToSave.id === 'player') {
            // 更新主角信息
            const playerData = {
                name: characterToSave.name || '',
                gender: characterToSave.gender || '',
                race: characterToSave.identity || undefined,
                appearance: characterToSave.appearance || '',
                personality: characterToSave.personality && characterToSave.personality.length > 0 ? characterToSave.personality.join(', ') : undefined,
                tone: characterToSave.speech || undefined,
            };
            
            try {
                const response = await EditorApi.updatePlayer(fileId, playerData);
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
            // 更新 NPC 信息
            // 从 identity 中解析 race 和 job
            const identityParts = characterToSave.identity.split(' · ');
            const race = identityParts.length > 1 ? identityParts[0] : undefined;
            const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || characterToSave.role);

            // 将 variations 转换回 images 对象
            const images: { [key: string]: string } = {};
            characterToSave.variations.forEach(variation => {
                if (variation.label && variation.img) {
                    images[variation.label] = variation.img;
                }
            });

            // 获取与玩家的关系
            const playerRelationship = characterToSave.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

            const npcData: NPC = {
                id: characterToSave.id,
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
                const response = await EditorApi.updateNpc(fileId, npcData);
                if (response.data?.success) {
                    toast.success('角色更新成功');
                    // 刷新数据
                    if (onDataChange) {
                        onDataChange();
                    }
                } else {
                    toast.error('更新角色失败');
                }
            } catch (error) {
                console.error('更新角色时出错:', error);
                toast.error('更新角色失败，请重试');
            }
        }
    };

    // 确认新增角色
    const confirmAddNew = async () => {
        if (!fileId || !newCharacterData) {
            toast.error('缺少必要数据，无法新增角色');
            return;
        }

        // 生成新的 NPC ID（小写英文，下划线连接）
        const newNpcId = `npc_${Date.now()}`;
        
        // 从 identity 中解析 race 和 job
        const identityParts = newCharacterData.identity.split(' · ');
        const race = identityParts.length > 1 ? identityParts[0] : undefined;
        const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || newCharacterData.role);

        // 将 variations 转换回 images 对象
        const images: { [key: string]: string } = {};
        newCharacterData.variations.forEach(variation => {
            if (variation.label && variation.img) {
                images[variation.label] = variation.img;
            }
        });

        // 获取与玩家的关系
        const playerRelationship = newCharacterData.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

        const newNpc: NPC = {
            id: newNpcId,
            name: newCharacterData.name || '未命名角色',
            gender: newCharacterData.gender || '',
            description: newCharacterData.background || '暂无描述',
            appearance: newCharacterData.appearance || '',
            tone: newCharacterData.speech || '',
            job: job || undefined,
            race: race || undefined,
            personality: newCharacterData.personality && newCharacterData.personality.length > 0 ? newCharacterData.personality.join(', ') : undefined,
            relationship: playerRelationship?.description || undefined,
            images: Object.keys(images).length > 0 ? images : undefined,
        };

        try {
            const response = await EditorApi.addNpc(fileId || '893d61c0-5fbe-4251-b83c-4e9bcfb4bda3', newNpc);
            if (response.data?.success) {
                // 创建本地 Character 对象
                const createdCharacter: Character = {
                    ...newCharacterData,
                    id: newNpcId,
                };
                // 新增角色放在最上面
                setCharacterData(prev => [createdCharacter, ...prev]);
                setActiveCharacterId(createdCharacter.id);
                setIsAddingNew(false);
                setNewCharacterData(null);
                toast.success('角色创建成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('创建角色失败');
            }
        } catch (error) {
            console.error('创建角色时出错:', error);
            toast.error('创建角色失败，请重试');
        }
    };

    // 更新新增角色的字段
    const updateNewCharacterField = (field: keyof Character, value: string | string[]) => {
        if (!newCharacterData) return;
        setNewCharacterData({ ...newCharacterData, [field]: value });
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

    // 触发文件选择 - 根据角色类型使用不同的 input
    const handlePortraitClick = () => {
        if (isAddingNew && newCharacterData) {
            // 新增模式
            editingFileInputRef.current?.click();
        } else {
            // 正常模式 - 区分玩家和NPC
            if (activeCharacter?.id === 'player') {
                playerFileInputRef.current?.click();
            } else {
                npcFileInputRef.current?.click();
            }
        }
    };

    // 上传玩家图片
    const handleUploadPlayerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }

        // 验证文件大小（例如限制为 5MB）
        if (file.size > 5 * 1024 * 1024) {
            toast.error('图片大小不能超过 5MB');
            return;
        }

        if (!fileId) {
            toast.error('缺少文件ID，无法上传');
            return;
        }


        try {
            const response = await EditorApi.uploadPlayerImage(fileId, {
                file,
                variat: 'base',
            });
            if (response.data?.success) {
                toast.success('玩家图片上传成功');
                // 刷新数据以获取最新的图片URL
                if (onDataChange) {
                    onDataChange();
                }
                // 更新本地数据中的图片URL
                // updateField('portrait', response.data.player.images.base || '');
            } else {
                toast.error('上传失败，请重试');
            }
        } catch (error) {
            console.error('上传玩家图片时出错:', error);
            toast.error('上传图片失败，请重试');
        } finally {
            // 清空 input 值，以便可以重复选择同一文件
            if (playerFileInputRef.current) {
                playerFileInputRef.current.value = '';
            }
        }
    };

    // 上传NPC图片（包括编辑模式和新增模式）
    const handleUploadNpcImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            return;
        }

        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }

        // 验证文件大小（例如限制为 5MB）
        if (file.size > 5 * 1024 * 1024) {
            toast.error('图片大小不能超过 5MB');
            return;
        }

        if (!fileId) {
            toast.error('缺少文件ID，无法上传');
            return;
        }

        // 确定目标角色ID
        let targetCharacterId = '';
        let isNewCharacter = false;

        if (isAddingNew && newCharacterData) {
            // 新增模式：需要先创建角色
            isNewCharacter = true;
            
            // 生成新的 NPC ID
            targetCharacterId = `npc_${Date.now()}`;
            
            // 创建新角色
            const identityParts = newCharacterData.identity.split(' · ');
            const race = identityParts.length > 1 ? identityParts[0] : undefined;
            const job = identityParts.length > 1 ? identityParts[1] : (identityParts[0] || newCharacterData.role);

            const images: { [key: string]: string } = {};
            newCharacterData.variations.forEach(variation => {
                if (variation.label && variation.img) {
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
                    return;
                }
                
                // 创建成功后，更新本地数据
                const createdCharacter: Character = {
                    ...newCharacterData,
                    id: targetCharacterId,
                };
                setCharacterData(prev => [createdCharacter, ...prev]);
                setActiveCharacterId(targetCharacterId);
                setIsAddingNew(false);
                setNewCharacterData(null);
            } catch (error) {
                console.error('创建角色时出错:', error);
                toast.error('创建角色失败，请重试');
                return;
            }
        } else {
            // 正常模式
            targetCharacterId = activeCharacterId;
        }

        // 如果目标角色ID为空，说明当前没有选中有效的角色
        if (!targetCharacterId) {
            toast.error('请先选择角色');
            return;
        }

        try {
            const response = await EditorApi.uploadNpcImage(fileId, targetCharacterId, {
                file,
                variat: 'base',
            });
            if (response.data?.success) {
                toast.success('角色图片上传成功');
                // 刷新数据以获取最新的图片URL
                if (onDataChange) {
                    onDataChange();
                }
                
                // 根据当前模式更新图片URL
                if (isNewCharacter) {
                    // 新增模式已处理，不需要额外操作
                } else {
                    // 正常模式
                    const firstImageUrl = response.data?.npcSetting?.npcs.find(npc => npc.id === targetCharacterId)?.images?.base || '';
                    if (firstImageUrl) {
                        updateField('portrait', firstImageUrl);
                    }
                }
            } else {
                toast.error('上传失败，请重试');
            }
        } catch (error) {
            console.error('上传图片时出错:', error);
            toast.error('上传图片失败，请重试');
        } finally {
            // 清空 input 值，以便可以重复选择同一文件
            if (npcFileInputRef.current) {
                npcFileInputRef.current.value = '';
            }
            if (editingFileInputRef.current) {
                editingFileInputRef.current.value = '';
            }
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
                                onClick={() => setActiveCharacterId(character.id)}
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

                {/* 右栏 - 角色详情 */}
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
                    <input 
                        ref={editingFileInputRef}
                        type="file" 
                        accept="image/*" 
                        onChange={handleUploadNpcImage} 
                        style={{ display: 'none' }}
                    />
                    
                    {/* 右侧面板头部 - 确认/取消按钮 */}
                    {isAddingNew && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                            <button className={styles.ghostSmall} onClick={confirmAddNew}>
                                确认增加
                            </button>
                            <button className={styles.ghostSmall} onClick={cancelAddNew}>
                                取消
                            </button>
                        </div>
                    )}
                    
                    {/* 正常模式下显示确认修改按钮 */}
                    {!isAddingNew && activeCharacter && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                            <button className={styles.ghostSmall} onClick={confirmEdit}>
                                确认修改
                            </button>
                        </div>
                    )}
                    
                    {isAddingNew && newCharacterData ? (
                        /* 新增角色表单 */
                        <>
                            {/* 立绘 */}
                            <div
                                className={styles.portraitLarge}
                                style={{ backgroundImage: newCharacterData.portrait ? `url('${newCharacterData.portrait}')` : 'none', cursor: 'pointer' }}
                                onClick={handlePortraitClick}
                            >
                                <span className={styles.portraitHint}>点击上传角色基础立绘</span>
                            </div>

                            {/* 基础信息表单 */}
                            <div className={styles.formGrid}>
                                <label>
                                    <span>姓名</span>
                                    <input type="text" value={newCharacterData.name} onChange={(e) => updateNewCharacterField('name', e.target.value)} />
                                </label>
                                <label>
                                    <span>称呼 / 昵称</span>
                                    <input type="text" value={newCharacterData.callName} onChange={(e) => updateNewCharacterField('callName', e.target.value)} />
                                </label>
                                <label>
                                    <span>性别 / 形体</span>
                                    <input type="text" value={newCharacterData.gender} onChange={(e) => updateNewCharacterField('gender', e.target.value)} />
                                </label>
                                <label>
                                    <span>身份 / 当前身份</span>
                                    <input type="text" value={newCharacterData.identity} onChange={(e) => updateNewCharacterField('identity', e.target.value)} />
                                </label>
                                <label className={styles.wide}>
                                    <span>性格标签</span>
                                    <textarea 
                                        rows={2} 
                                        value={newCharacterData.personality.join(' / ')} 
                                        onChange={(e) => {
                                            const tags = e.target.value.split(/[，,\/、\s]+/).map(tag => tag.trim()).filter(Boolean);
                                            updateNewCharacterField('personality', tags);
                                        }}
                                        placeholder="输入性格标签，用 / 或 ，分隔"
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>口癖 / 语气</span>
                                    <textarea rows={3} value={newCharacterData.speech} onChange={(e) => updateNewCharacterField('speech', e.target.value)} />
                                </label>
                                <label className={styles.wide}>
                                    <span>外貌描述 / Prompt</span>
                                    <textarea rows={3} value={newCharacterData.appearance} onChange={(e) => updateNewCharacterField('appearance', e.target.value)} />
                                </label>
                            </div>
                        </>
                    ) : (
                        /* 正常显示选中的角色详情 */
                        <>
                            {/* 立绘 */}
                            <div
                                className={styles.portraitLarge}
                                style={{ backgroundImage: activeCharacter.portrait ? `url('${activeCharacter.portrait}')` : 'none', cursor: 'pointer' }}
                                onClick={handlePortraitClick}
                            >
                                <span className={styles.portraitHint}>点击替换角色基础立绘</span>
                            </div>

                            {/* 基础信息表单 */}
                            <div className={styles.formGrid}>
                                <label>
                                    <span>姓名</span>
                                    <input type="text" value={activeCharacter.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                                </label>
                                <label>
                                    <span>称呼 / 昵称</span>
                                    <input type="text" value={activeCharacter.callName} onChange={(e) => handleFieldChange('callName', e.target.value)} />
                                </label>
                                <label>
                                    <span>性别 / 形体</span>
                                    <input type="text" value={activeCharacter.gender} onChange={(e) => handleFieldChange('gender', e.target.value)} />
                                </label>
                                <label>
                                    <span>身份 / 当前身份</span>
                                    <input type="text" value={activeCharacter.identity} onChange={(e) => handleFieldChange('identity', e.target.value)} />
                                </label>
                                <label className={styles.wide}>
                                    <span>性格标签</span>
                                    <textarea 
                                        rows={2} 
                                        value={activeCharacter.personality.join(' / ')} 
                                        onChange={(e) => handleFieldChange('personality', e.target.value)}
                                        placeholder="输入性格标签，用 / 或 ，分隔"
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>口癖 / 语气</span>
                                    <textarea rows={3} value={activeCharacter.speech} onChange={(e) => handleFieldChange('speech', e.target.value)} />
                                </label>
                                <label className={styles.wide}>
                                    <span>外貌描述 / Prompt</span>
                                    <textarea rows={3} value={activeCharacter.appearance} onChange={(e) => handleFieldChange('appearance', e.target.value)} />
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
                                            <textarea rows={4} value={activeCharacter.background} onChange={(e) => handleFieldChange('background', e.target.value)} />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>成长经历 / 转折</span>
                                            <textarea rows={4} value={activeCharacter.growth} onChange={(e) => handleFieldChange('growth', e.target.value)} />
                                        </label>
                                        <label>
                                            <span>短期目标</span>
                                            <input type="text" value={activeCharacter.goalShort} onChange={(e) => handleFieldChange('goalShort', e.target.value)} />
                                        </label>
                                        <label>
                                            <span>长期愿景</span>
                                            <input type="text" value={activeCharacter.goalLong} onChange={(e) => handleFieldChange('goalLong', e.target.value)} />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>隐藏秘密 / 禁忌</span>
                                            <textarea rows={3} value={activeCharacter.secret} onChange={(e) => handleFieldChange('secret', e.target.value)} />
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
                                        {activeCharacter.relationships.length === 0 ? (
                                            <p className={styles.mutedSmall}>暂无关系。可添加与其他 NPC 的亲疏、不同身份下的角色差异等信息。</p>
                                        ) : (
                                            activeCharacter.relationships.map((rel) => (
                                                <div key={rel.id} className={styles.relationshipRow}>
                                                    <label>
                                                        <span>对象 / 称呼</span>
                                                        <input type="text" value={rel.name} onChange={(e) => updateRelationship(rel.id, 'name', e.target.value)} />
                                                    </label>
                                                    <label className={styles.wide}>
                                                        <span>关系描述</span>
                                                        <textarea rows={3} value={rel.description} onChange={(e) => updateRelationship(rel.id, 'description', e.target.value)} />
                                                    </label>
                                                    <button className={styles.ghostTiny} onClick={() => removeRelationship(rel.id)}>删除</button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* 立绘差分 */}
                            <div className={styles.detailBlock}>
                                <div className={styles.cardHead}>
                                    <strong>立绘差分</strong>
                                    <span className={styles.mutedSmall}>默认 + {activeCharacter.variations.length} 个差分</span>
                                </div>
                                <div className={styles.variationGrid}>
                                    {activeCharacter.variations.map((variation) => (
                                        <div key={variation.id} className={styles.variationCard}>
                                            <div
                                                className={`${styles.variationThumb} ${!variation.img ? styles.empty : ''}`}
                                                style={variation.img ? { backgroundImage: `url('${variation.img}')` } : {}}
                                            >
                                                {!variation.img && <span className={styles.mutedSmall}>等待图片</span>}
                                            </div>
                                            <p>{variation.label}</p>
                                            <div className={styles.variationActions}>
                                                <button className={styles.ghostTiny}>上传图片</button>
                                                <button className={styles.ghostTiny}>AI 生成</button>
                                            </div>
                                        </div>
                                    ))}
                                    <button className={styles.addCard} onClick={addVariation}>+ 新差分</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

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