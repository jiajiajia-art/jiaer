import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './CharactersPanel.module.css';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { NPCSetting, NPC, Player } from '../../api/galgame/EditorData.type';
import type { NPCSetting as WorldNPCSetting, NPC as WorldNPC } from '../../api/worldInteraction/worldInteractionApi.type';

// 辅助函数：获取 player（兼容两种模式）
function getPlayer(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.worldSetting) return undefined;
    const ws = data.worldSetting;
    
    // worldInteraction 模式使用 Player（大写）
    if ('Player' in ws && ws.Player) {
        return ws.Player;
    }
    
    // visual 模式使用 player（小写）
    if ('player' in ws && ws.player) {
        return ws.player;
    }
    
    return undefined;
}

// 辅助函数：获取 npcs（兼容两种模式）
function getNpcs(data: AllGameData | WorldInteractionGameData | null | undefined) {
    if (!data?.npcSetting) return [];
    return data.npcSetting.npcs || [];
}
import { MdArrowDropDown } from 'react-icons/md';
import DeletModal from '../goodsModal/DeletModal';
import EditorApi from '../../api/galgame/EditorData';
import { toast } from 'react-hot-toast';
import { RiDeleteBin5Line } from 'react-icons/ri';
import { useEditorStore } from '../../store/editorStore';
import worldEditor from '../../api/worldInteraction/worldEditor';

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
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
    mode: string;
}

const DEFAULT_NPC_PORTRAIT = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;

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

const CharactersPanel: React.FC<CharactersPanelProps> = ({ 
    gameData, 
    isLoading = false, 
    onGetData, 
    onDataChange, 
    mode = 'visual' 
}) => {
    
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
    const [isGeneratingNpcImages, setIsGeneratingNpcImages] = useState<boolean>(false);
    const [isGeneratingSingleNpcImage, setIsGeneratingSingleNpcImage] = useState<boolean>(false);
    const [generatingCharacterId, setGeneratingCharacterId] = useState<string | null>(null); // 避免切换角色时全局 loading 误闪

    // 为图片 URL 添加时间戳，避免缓存导致的旧图显示
    const withCacheBust = (url?: string | null) => {
        // 过滤掉空值、"null"、"undefined" 等无效字符串
        if (!url || url === 'null' || url === 'undefined' || url.trim() === '') return '';
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}cb=${Date.now()}`;
    };

    const baseCharacter = useCallback((): Omit<Character, 'id' | 'name' | 'callName' | 'gender' | 'role' | 'identity' | 'personality' | 'speech' | 'appearance' | 'portrait' | 'background' | 'relationships' | 'variations'> => {
        return {
            growth: '',
            goalShort: '',
            goalLong: '',
            secret: '',
        };
    }, []);

    const imagesToVariations = useCallback((images?: Record<string, string>): Variation[] => {
        if (!images) return [];
        return Object.entries(images).map(([label, img], idx) => ({
            id: `v${idx}`,
            label,
            img: withCacheBust(img),
            type: label,
        }));
    }, []);

    const pickBaseImage = useCallback((images?: Record<string, string>, fallback?: string) => {
        // 辅助函数：检查值是否有效
        const isValidUrl = (url?: string | null): url is string => {
            return !!url && url !== 'null' && url !== 'undefined' && url.trim() !== '';
        };
        
        if (isValidUrl(images?.base)) return images!.base;
        const first = images ? Object.values(images).find(v => isValidUrl(v)) : undefined;
        return first || (isValidUrl(fallback) ? fallback : undefined);
    }, []);

    const npcToCharacter = useCallback((npc: NPC | WorldNPC, indexFallback: number): Character => {
        const npcJob = 'job' in npc ? npc.job : undefined;
        const npcRace = 'race' in npc ? npc.race : undefined;
        const npcRelationship = 'relationship' in npc ? npc.relationship : undefined;

        const images = (npc.images || undefined) as Record<string, string> | undefined;
        const portrait = pickBaseImage(images, DEFAULT_NPC_PORTRAIT);

        return {
            ...baseCharacter(),
            id: npc.id || `npc-${indexFallback}`,
            name: npc.name || '',
            callName: npc.name || '',
            gender: npc.gender || '',
            role: npcJob || 'NPC',
            identity: npcRace ? `${npcRace} · ${npcJob || ''}` : (npcJob || ''),
            personality: npc.personality ? [npc.personality] : [],
            speech: npc.tone || '',
            appearance: npc.appearance || '',
            portrait: portrait ? withCacheBust(portrait) : '',
            background: npc.description || '',
            relationships: npcRelationship ? [{
                id: 'r1',
                name: '玩家',
                description: npcRelationship,
            }] : [],
            variations: imagesToVariations(images),
        };
    }, [baseCharacter, imagesToVariations, pickBaseImage]);

    const playerToCharacter = useCallback((player: any): Character => {
        const playerImages = ('images' in player ? player.images : undefined) as Record<string, string> | undefined;
        // 获取 image 或 imagePath，并过滤无效值
        const rawImage = ('image' in player ? player.image : ('imagePath' in player ? player.imagePath : undefined)) as string | undefined;
        const playerImage = (rawImage && rawImage !== 'null' && rawImage !== 'undefined') ? rawImage : undefined;
        const portrait = pickBaseImage(playerImages, playerImage) || DEFAULT_NPC_PORTRAIT;        
        const playerRace = ('race' in player ? player.race : undefined) as string | undefined;

        return {
            ...baseCharacter(),
            id: 'player',
            name: player?.name || '玩家',
            callName: player?.name || '玩家',
            gender: player?.gender || '',
            role: '主角',
            identity: playerRace || '',
            personality: player?.personality ? [player.personality] : [],
            speech: player?.tone || '',
            appearance: player?.appearance || '',
            portrait: portrait ? withCacheBust(portrait) : '',
            background: '',
            relationships: [],
            variations: imagesToVariations(playerImages),
        };
    }, [baseCharacter, imagesToVariations, pickBaseImage]);

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
    }, [gameData, isAddingNew, npcToCharacter, playerToCharacter]);

    // 将 characterData 转换为 npcSetting 格式
    const getNpcSettingData = useCallback((): NPCSetting | WorldNPCSetting | null => {
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

                // 确保 images 对象包含 base 属性（如果没有，使用 portrait 或第一个 variation）
                let finalImages: { base: string; [key: string]: string } | undefined = undefined;
                if (Object.keys(images).length > 0) {
                    if (!images.base) {
                        // 优先使用 portrait，否则使用第一个 variation 的图片
                        images.base = char.portrait || Object.values(images)[0] || '';
                    }
                    // 类型断言：确保 base 属性存在
                    finalImages = images as { base: string; [key: string]: string };
                }

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
                const response = mode === 'worldInteraction'
                    ? await worldEditor.updatePlayer(fileId, playerData as Player)
                    : await EditorApi.updatePlayer(fileId, playerData as Player);
                if (response.data?.success) {
                    toast.success('主角信息更新成功');
                    // 使用返回的数据更新本地状态
                    if (mode === 'worldInteraction') {
                        const p = (response.data as any)?.data;
                        if (p) setCharacterData(prev => prev.map(char => char.id === 'player' ? playerToCharacter(p) : char));
                    } else {
                        const ws = (response.data as any)?.worldSetting;
                        const p = ws?.player;
                        if (p) setCharacterData(prev => prev.map(char => char.id === 'player' ? playerToCharacter(p) : char));
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

            // 确保 images 对象包含 base 属性（如果没有，使用 portrait 或第一个 variation）
            let finalImages: { base: string; [key: string]: string } | undefined = undefined;
            if (Object.keys(images).length > 0) {
                if (!images.base) {
                    // 优先使用 portrait，否则使用第一个 variation 的图片
                    images.base = characterToSave.portrait || Object.values(images)[0] || '';
                }
                // 类型断言：确保 base 属性存在
                finalImages = images as { base: string; [key: string]: string };
            }

            // 获取与玩家的关系
            const playerRelationship = characterToSave.relationships.find(r => r.name === '玩家' || r.name.toLowerCase().includes('player'));

            const npcData: NPC = {
                id: characterToSave.id.startsWith('temp-') ? `npc_${Date.now()}` : characterToSave.id,
                name: characterToSave.name || '',
                gender: characterToSave.gender || '',
                job: job || undefined,
                race: race || undefined,
                description: characterToSave.background || '', // Character 接口使用 background 字段，映射到 NPC 的 description
                appearance: characterToSave.appearance || '',
                personality: characterToSave.personality && characterToSave.personality.length > 0 ? characterToSave.personality.join(', ') : undefined,
                tone: characterToSave.speech || '',
                relationship: playerRelationship?.description || undefined,
                images: finalImages,
            };

            try {
                let response;
                if (isAddingNew) {
                    // 新增模式
                    response = mode === 'worldInteraction'
                        ? await worldEditor.addNpc(fileId, npcData)
                        : await EditorApi.addNpc(fileId, npcData);
                } else {
                    // 更新模式
                    response = mode === 'worldInteraction'
                        ? await worldEditor.updateNpc(fileId, npcData)
                        : await EditorApi.updateNpc(fileId, npcData);
                }

                if (response.data?.success) {
                    toast.success(isAddingNew ? '角色创建成功' : '角色更新成功');
                    // 使用返回的数据更新本地状态
                    const finalNpcId = npcData.id;
                    if (mode === 'worldInteraction') {
                        const npc = (response.data as any)?.data;
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
                        }
                    } else {
                        updateCharacterFromResponse(response.data, finalNpcId);
                        if (isAddingNew) {
                            const npcSetting = (response.data as any)?.npcSetting;
                            if (npcSetting?.npcs) {
                                const npc = npcSetting.npcs.find((n: any) => n.id === finalNpcId);
                                if (npc) {
                                    const newCharacter = npcToCharacter(npc, 0);
                                    setCharacterData(prev => [newCharacter, ...prev]);
                                    setActiveCharacterId(newCharacter.id);
                                    setIsAddingNew(false);
                                    setNewCharacterData(null);
                                }
                            }
                        }
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
            const response = mode === 'worldInteraction'
                ? await worldEditor.deleteNpc(fileId, characterToDelete)
                : await EditorApi.deleteNpc(fileId, characterToDelete);
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

        // 确保 images 对象包含 base 属性（如果没有，使用 portrait 或第一个 variation）
        let finalImages: { base: string; [key: string]: string } | undefined = undefined;
        if (Object.keys(images).length > 0) {
            if (!images.base) {
                images.base = newCharacterData.portrait || Object.values(images)[0] || '';
            }
            // 类型断言：确保 base 属性存在
            finalImages = images as { base: string; [key: string]: string };
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
            const createResponse = mode === 'worldInteraction'
                ? await worldEditor.addNpc(fileId, newNpc)
                : await EditorApi.addNpc(fileId, newNpc);
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

            // 根据类型和模式调用不同的API
            if (type === 'player') {
                response = mode === 'worldInteraction'
                    ? await worldEditor.uploadPlayerImage(fileId, file)
                    : await EditorApi.uploadPlayerImage(fileId, {
                        file,
                        variant,
                    });
            } else if (type === 'npc' || type === 'variation') {
                if (!targetCharacterId) {
                    toast.error('缺少角色ID，无法上传');
                    return;
                }
                response = mode === 'worldInteraction'
                    ? await worldEditor.uploadNpcImage(fileId, targetCharacterId, {
                        file,
                        variat: variant,
                    })
                    : await EditorApi.uploadNpcImage(fileId, targetCharacterId, {
                        file,
                        variat: variant,
                    });
            } else {
                toast.error('未知的上传类型');
                return;
            }

            if (response.data?.success) {
                toast.success(successMessage || '图片上传成功');
                // 使用返回的数据更新本地状态，不再调用 onDataChange

                // 如果是玩家图片，更新 portrait 或 variations
                if (type === 'player' && !isAddingNew) {
                    setCharacterData(prev =>
                        prev.map(char => {
                            if (char.id === 'player') {
                                // 根据模式获取玩家数据
                                let playerImage = '';
                                let playerImages: { [key: string]: string } | undefined = undefined;
                                const responseAny = response.data as any;
                                
                                if (mode === 'worldInteraction') {
                                    // worldEditor 返回 ApiResponse<Player>，可能在 data 或直接在响应中
                                    const player = responseAny?.data;
                                    playerImage = player?.image || player?.imagePath || responseAny?.imagePath || '';
                                    playerImages = player?.images;
                                } else {
                                    // EditorApi 返回包含 worldSetting 的数据
                                    const worldSetting = responseAny?.worldSetting;
                                    playerImage = worldSetting?.player?.image || worldSetting?.player?.imagePath || '';
                                    playerImages = worldSetting?.player?.images;
                                }

                                // 如果是 base 变体，更新 portrait
                                if (variant === 'base') {
                                    // 优先用返回的图片URL，没有则用现有图片加新时间戳
                                    let newPortrait = playerImages?.base || playerImage;
                                    if (!newPortrait && char.portrait) {
                                        // 去掉旧时间戳，加新时间戳
                                        const baseUrl = char.portrait.split('?')[0];
                                        newPortrait = baseUrl;
                                    }
                                    return { ...char, portrait: newPortrait ? withCacheBust(newPortrait) : char.portrait };
                                }
                                // 否则检查是否已存在该variant的variation
                                const existingVarIndex = char.variations.findIndex(v => v.label === variant);
                                const variantImg = playerImages?.[variant] || playerImage;
                                if (existingVarIndex >= 0) {
                                    // 更新现有的
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
                                    // 添加新的（只有有图片时才添加）
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
                    if (mode === 'worldInteraction') {
                        // worldInteraction 模式返回简单格式：{ success, imagePath, variant, npcId }
                        const responseData = response.data as any;
                        const imagePath = responseData?.imagePath || responseData?.data?.imagePath;
                        const variantName = responseData?.variant || responseData?.data?.variant || variant;
                        const npcId = responseData?.npcId || responseData?.data?.npcId || targetCharacterId;
                        
                        if (imagePath && npcId) {
                            const imageUrl = withCacheBust(imagePath);
                            setCharacterData(prev => prev.map(char => {
                                if (char.id === npcId) {
                                    if (variantName === 'base') {
                                        // 更新基础立绘
                                        return { ...char, portrait: imageUrl };
                                    } else {
                                        // 更新或添加差分
                                        const varIndex = char.variations.findIndex(v => v.label === variantName);
                                        if (varIndex >= 0) {
                                            // 更新现有的差分
                                            const newVariations = [...char.variations];
                                            newVariations[varIndex] = { ...newVariations[varIndex], img: imageUrl };
                                            return { ...char, variations: newVariations };
                                        } else {
                                            // 添加新的差分
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
                        }
                    } else {
                        // EditorApi 模式返回完整的 AllGameData
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
            variant: currentCharacter?.id == 'player' ? 'base' : currentCharacter?.variations.find(v => v.label === 'base')?.label || 'base',
            inputRef: npcFileInputRef,
            successMessage: '角色图片上传成功',
        });
    };

    // 从 API 响应中更新角色数据的辅助函数
    const updateCharacterFromResponse = (responseData: any, characterId: string) => {
        if (mode === 'worldInteraction') {
            // worldEditor 返回 ApiResponse<NPC>
            const npc = responseData?.data;
            if (npc) {
                const updatedCharacter = npcToCharacter(npc, 0);
                setCharacterData(prev => prev.map(char => char.id === characterId ? updatedCharacter : char));
            }
        } else {
            // EditorApi 返回 AllGameData
            const npcSetting = responseData?.npcSetting;
            if (npcSetting?.npcs) {
                const npc = npcSetting.npcs.find((n: any) => n.id === characterId);
                if (npc) {
                    const updatedCharacter = npcToCharacter(npc, 0);
                    setCharacterData(prev => prev.map(char => char.id === characterId ? updatedCharacter : char));
                }
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
            const { id, name, age, gender, job, race, description, appearance } = npc as any;
            const response = await EditorApi.generateNpcImage({
                fileId,
                npc: { id, name, age, gender, job, race, description, appearance },
                removeBg: false,
                pluginType: mode
            });
            if (response.data?.success) {
                toast.success('NPC图片重新生成成功');
                // 直接从响应中获取图片URL，支持多种可能的字段名
                const responseAny = response.data as any;
                const newImageUrl = responseAny?.imagePath || 
                                   responseAny?.data?.images?.base ||
                                   responseAny?.data?.image ||
                                   responseAny?.npcSetting?.npcs?.find((n: any) => n.id === npc.id)?.images?.base;
                
                if (newImageUrl) {
                    setCharacterData(prev => prev.map(char => 
                        char.id === npc.id 
                            ? { ...char, portrait: withCacheBust(newImageUrl) } 
                            : char
                    ));
                } else if (npc.portrait) {
                    // 没有返回图片URL，用现有图片加新时间戳刷新
                    const baseUrl = npc.portrait.split('?')[0];
                    setCharacterData(prev => prev.map(char => 
                        char.id === npc.id 
                            ? { ...char, portrait: withCacheBust(baseUrl) } 
                            : char
                    ));
                }
            } else {
                toast.error('重新生成NPC图片失败');
            }
        } catch (error) {
            toast.error('重新生成NPC图片失败，请重试');
        } finally {
            setIsGeneratingSingleNpcImage(false);
            setGeneratingCharacterId(null);
        }
    };

    const regeneratePlayerImage = async (playerChar: Character) => {
        if (!fileId || !playerChar) return;
        try {
            setIsGeneratingSingleNpcImage(true);
            setGeneratingCharacterId(playerChar.id);
            // 从 identity 解析 race
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
            const response = await EditorApi.generatePlayerImage({
                fileId,
                player: payloadPlayer,
                removeBg: false,
                pluginType: mode,
            });
            if (response.data?.success) {
                toast.success('主角图片重新生成成功');
                // 直接从响应中获取图片URL，支持多种可能的字段名
                const responseAny = response.data as any;
                const newImageUrl = responseAny?.imagePath || 
                                   responseAny?.data?.image || 
                                   responseAny?.data?.imagePath ||
                                   responseAny?.worldSetting?.player?.image ||
                                   responseAny?.worldSetting?.Player?.image;
                
                if (newImageUrl) {
                    setCharacterData(prev => prev.map(char => 
                        char.id === 'player' 
                            ? { ...char, portrait: withCacheBust(newImageUrl) } 
                            : char
                    ));
                } else if (playerChar.portrait) {
                    // 没有返回图片URL，用现有图片加新时间戳刷新
                    const baseUrl = playerChar.portrait.split('?')[0];
                    setCharacterData(prev => prev.map(char => 
                        char.id === 'player' 
                            ? { ...char, portrait: withCacheBust(baseUrl) } 
                            : char
                    ));
                }
            } else {
                toast.error('重新生成主角图片失败');
            }
        } catch (error) {
            toast.error('重新生成主角图片失败，请重试');
        } finally {
            setIsGeneratingSingleNpcImage(false);
            setGeneratingCharacterId(null);
        }
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

    const regenerateVariationImage = async (variation: Variation) => {
        if (!fileId || !variation || !currentCharacter) {
            toast.error('缺少必要数据，无法生成');
            return;
        }

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
            toast.error('生成差分图片失败，请重试');
        }
    };

    const generateAllNpcImages = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsGeneratingNpcImages(true);
            const response = await worldEditor.generateAllNpcImages(fileId);
            if (response.data?.success) {
                toast.success('所有角色立绘生成成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('生成所有角色立绘失败');
            }
        } catch (error) {
            toast.error('生成所有角色立绘失败，请重试');
        } finally {
            setIsGeneratingNpcImages(false);
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
                <button className={styles.ghost} onClick={generateAllNpcImages}>一键生成所有角色立绘</button>
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
                                    cursor: isGeneratingSingleNpcImage ? 'not-allowed' : 'pointer'
                                }}
                                onClick={handlePortraitClick}
                            >
                                <span className={styles.portraitHint}>
                                    {isAddingNew ? '点击上传角色基础立绘' : '点击替换角色基础立绘'}
                                </span>
                                {isGeneratingSingleNpcImage && generatingCharacterId === currentCharacter.id && (
                                    <div className="loadingOverlay">
                                        <div className="loadingSpinner"></div>
                                        <div className="loadingText">正在生成角色立绘...</div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.portraitImageActions}>
                                <button className={styles.ghostSmall} 
                                    onClick={handlePortraitClick} 
                                    disabled={isGeneratingSingleNpcImage}
                                >
                                    {isAddingNew ? '上传立绘' : '重新上传'}
                                </button>
                                {currentCharacter && (
                                    <button
                                        className={styles.ghostSmall}
                                        onClick={() => {
                                            if (currentCharacter.name === (gameData?.worldSetting?.player?.name)) {
                                                regeneratePlayerImage(currentCharacter);
                                                console.log('player生成');
                                                
                                            } else {
                                                regenerateNpcImage(currentCharacter);
                                            }
                                        }}
                                        disabled={isGeneratingSingleNpcImage}
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

            {isGeneratingNpcImages && (
                <div className="loadingOverlay">
                    <div className="loadingSpinner"></div>
                    <div className="loadingText">正在生成场景立绘...</div>
                </div>
            )}
        </div>
    );
};

export default CharactersPanel;
