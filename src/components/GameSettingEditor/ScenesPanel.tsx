import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './ScenesPanel.module.css';
import type { UnifiedGameData, SceneSetting } from '../../api/common/gameData.type';
import type { Scene as ApiScene } from '../../api/galgame/getGalgamePreset.type';
import EditorApi from '../../api/galgame/EditorData';
import { toast } from 'react-hot-toast';
import DeletModal from '../goodsModal/DeletModal';
import { RiDeleteBin5Line, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import worldEditor from '../../api/worldInteraction/worldEditor';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

interface LocalScene {
    id: string;
    name: string;
    type: string;
    desc: string;
    image: string;
    bgmId: string;
}

interface ScenesPanelProps {
    gameData?: UnifiedGameData | null;
    isLoading?: boolean;
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<UnifiedGameData> | null) => void;
    onDataChange?: () => void; // 数据变化回调，用于刷新数据
    mode?: string;
}

const ScenesPanel: React.FC<ScenesPanelProps> = ({ 
    gameData, 
    isLoading = false, 
    fileId, 
    onGetData, 
    onDataChange, 
    mode = 'visual' 
}) => {
    const [activeSceneId, setActiveSceneId] = useState<string>('');
    const [activeSubsceneId, setActiveSubsceneId] = useState<string | null>(null);
    const [activeSubsceneDraft, setActiveSubsceneDraft] = useState<LocalScene | null>(null);
    const [sceneData, setSceneData] = useState<LocalScene[]>([]);
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newSceneData, setNewSceneData] = useState<LocalScene | null>(null);
    const [isAddingNewSubscene, setIsAddingNewSubscene] = useState<boolean>(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [sceneToDelete, setSceneToDelete] = useState<string | null>(null);
    const [subsceneDeleteModalOpen, setSubsceneDeleteModalOpen] = useState<boolean>(false);
    const [subsceneToDelete, setSubsceneToDelete] = useState<{ sceneId: string; subsceneId: string } | null>(null);
    const [subsceneCollapsed, setSubsceneCollapsed] = useState<Record<string, boolean>>({});
    const sceneFileInputRef = useRef<HTMLInputElement>(null);
    const newSceneFileInputRef = useRef<HTMLInputElement>(null);
    const [isGeneratingAllSceneImages, setIsGeneratingAllSceneImages] = useState<boolean>(false);
    const [isGeneratingSingleSceneImage, setIsGeneratingSingleSceneImage] = useState<boolean>(false);

    const [bgmLibrary, _setBgmLibrary] = useState<BgmItem[]>([
        { id: 'bgm-morning', name: '晨光序曲', description: '校园 / 日常' },
        { id: 'bgm-battle', name: '量子引擎警报', description: '紧张 / 战斗准备' },
        { id: 'bgm-dream', name: '星潮呢喃', description: '浪漫 / 深夜' },
    ]);

    // 当 gameData 变化时，填充场景数据
    useEffect(() => {
        if (gameData?.sceneSetting?.scenes) {
            const scenes = gameData.sceneSetting.scenes;
            const convertedScenes: LocalScene[] = scenes.map((scene) => ({
                id: scene.id || '',
                name: scene.name || '',
                type: scene.type || '',
                desc: scene.description || '',
                image: scene.image || '',
                bgmId: scene.soundtrack || '',
            }));

            setSceneData(convertedScenes);
            if (convertedScenes.length > 0) {
                setActiveSceneId(prev => prev || convertedScenes[0].id);
            }
        }
    }, [gameData]);

    // 将 sceneData 转换为 sceneSetting 格式
    const getSceneSettingData = useCallback((): SceneSetting | null => {
        if (!gameData?.sceneSetting) return null;

        const scenes = sceneData
            .filter(scene => !scene.id.startsWith('temp-')) // 过滤掉临时场景
            .map(scene => {
                // 从原始数据中获取 subscenes，如果不存在则使用空数组
                const originalScene = gameData?.sceneSetting?.scenes?.find(s => s.id === scene.id);
                return {
                    id: scene.id,
                    name: scene.name,
                    type: scene.type || '',
                    description: scene.desc || '',
                    atmosphere: undefined,
                    dangerLevel: undefined,
                    image: scene.image || undefined,
                    items: undefined,
                    events: [],
                    soundtrack: scene.bgmId || undefined,
                    subscenes: originalScene?.subscenes || [], // 添加 subscenes 字段
                };
            });

        return {
            scenes,
        };
    }, [sceneData, gameData]);

    // 提供给父组件的数据获取函数
    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const sceneSetting = getSceneSettingData();
                if (!sceneSetting) return null;
                return { sceneSetting };
            });
        }
    }, [onGetData, getSceneSettingData]);

    const activeScene = sceneData.find(s => s.id === activeSceneId) || sceneData[0];

    // 如果没有场景数据，显示空状态
    if (sceneData.length === 0 || !activeScene) {
        return (
            <div className={styles.panelContent}>
                <div className={styles.panelHeader}>
                    <div>
                        <p className={styles.eyebrow}>Step 4</p>
                        <h2>场景绑定 BGM</h2>
                        <p className={styles.subtitle}>
                            {isLoading ? '正在加载场景数据...' : '暂无场景数据，请先上传文档并等待解析完成'}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 更新场景字段
    const updateSceneField = (field: keyof LocalScene, value: string) => {
        setSceneData(prev =>
            prev.map(scene =>
                scene.id === activeSceneId ? { ...scene, [field]: value } : scene
            )
        );
    };

    // 更新子场景字段
    const updateSubsceneField = (field: keyof LocalScene, value: string) => {
        if (activeSubsceneDraft) {
            setActiveSubsceneDraft({ ...activeSubsceneDraft, [field]: value });
        }
    };

    // 打开新增场景面板
    const openAddNewPanel = () => {
        const newScene: LocalScene = {
            id: `temp-${Date.now()}`,
            name: '',
            type: '',
            desc: '',
            image: '',
            bgmId: '',
        };
        setNewSceneData(newScene);
        setIsAddingNew(true);
        setActiveSceneId(''); // 清空当前选中
        setActiveSubsceneId(null);
        setActiveSubsceneDraft(null);
    };

    // 取消新增
    const cancelAddNew = () => {
        setIsAddingNew(false);
        setNewSceneData(null);
        if (sceneData.length > 0) {
            setActiveSceneId(sceneData[0].id);
            setActiveSubsceneId(null);
            setActiveSubsceneDraft(null);
        }
    };

    // 确认新增场景
    const confirmAddNew = async () => {
        if (!fileId || !newSceneData) {
            console.log('缺少必要数据，无法新增场景', { fileId, newSceneData });

            toast.error('缺少必要数据，无法新增场景');
            return;
        }

        // 生成新的场景 ID（小写英文，下划线连接）
        const newSceneId = `scene_${Date.now()}`;

        const sceneDataForApi: ApiScene = {
            id: newSceneId,
            name: newSceneData.name || '未命名场景',
            type: newSceneData.type || '',
            description: newSceneData.desc || '暂无描述',
            image: newSceneData.image || undefined,
            soundtrack: newSceneData.bgmId || undefined,
            npcs: [],
            events: [],
        };

        try {
            const response = mode === 'worldInteraction'
                ? await worldEditor.addScene(fileId, sceneDataForApi as any)
                : await EditorApi.addScene(fileId, sceneDataForApi);
            if (response.data?.success) {
                // 创建本地 LocalScene 对象
                const createdScene: LocalScene = {
                    ...newSceneData,
                    id: newSceneId,
                };
                // 新增场景放在最上面
                setSceneData(prev => [createdScene, ...prev]);
                setActiveSceneId(createdScene.id);
                setIsAddingNew(false);
                setNewSceneData(null);
                toast.success('场景创建成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('创建场景失败');
            }
        } catch (error) {
            console.error('创建场景时出错:', error);
            toast.error('创建场景失败，请重试');
        }
    };

    // 确认修改场景（直接使用当前选中的场景数据）
    const confirmEdit = async () => {
        if (!fileId || !activeScene) {
            toast.error('缺少必要数据，无法保存修改');
            return;
        }
        
        const sceneToSave = activeScene;

        const sceneDataForApi: ApiScene = {
            id: sceneToSave.id,
            name: sceneToSave.name || '未命名场景',
            type: sceneToSave.type || '',
            description: sceneToSave.desc || '暂无描述',
            image: sceneToSave.image || undefined,
            soundtrack: sceneToSave.bgmId || undefined,
            npcs: [],
            events: [],
        };

        try {
            const response = mode === 'worldInteraction'
                ? await worldEditor.updateScene(fileId, sceneDataForApi as any)
                : await EditorApi.updateScene(fileId, sceneDataForApi);
            if (response.data?.success) {
                toast.success('场景更新成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('更新场景失败');
            }
        } catch (error) {
            console.error('更新场景时出错:', error);
            toast.error('更新场景失败，请重试');
        }
    };

    // 打开新增子场景面板
    const openAddNewSubscene = () => {
        if (!activeSceneId) {
            toast.error('请先选择一个父场景');
            return;
        }
        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            return;
        }
        const newSubscene: LocalScene = {
            id: `temp-subscene-${Date.now()}`,
            name: '',
            type: '',
            desc: '',
            image: '',
            bgmId: '',
        };
        setActiveSubsceneDraft(newSubscene);
        setActiveSubsceneId(newSubscene.id);
        setIsAddingNewSubscene(true);
    };

    // 取消新增子场景
    const cancelAddNewSubscene = () => {
        setIsAddingNewSubscene(false);
        setActiveSubsceneId(null);
        setActiveSubsceneDraft(null);
    };

    // 确认修改/新增子场景
    const confirmSubsceneEdit = async () => {
        if (!fileId || !activeSubsceneDraft || !activeSceneId) {
            toast.error('缺少必要数据，无法保存修改');
            return;
        }

        // 只在 worldInteraction 模式下才能操作子场景
        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            return;
        }

        // 构建子场景数据
        const subsceneData: any = {
            id: isAddingNewSubscene ? `subscene_${Date.now()}` : activeSubsceneDraft.id,
            name: activeSubsceneDraft.name || '未命名子场景',
            description: activeSubsceneDraft.desc || '',
            image: activeSubsceneDraft.image || '',
            npcs: [],
            position: [0, 0],
            npcs_slots: [],
        };

        // 如果是编辑模式，从原始数据中获取完整信息（保留 position, npcs 等字段）
        if (!isAddingNewSubscene) {
            const originalScene = gameData?.sceneSetting?.scenes?.find(s => s.id === activeSceneId);
            const originalSubscene = originalScene?.subscenes?.find(sub => sub.id === activeSubsceneDraft.id);
            if (originalSubscene) {
                subsceneData.npcs = originalSubscene.npcs || [];
                subsceneData.position = originalSubscene.position || [0, 0];
                subsceneData.npcs_slots = originalSubscene.npcs_slots || [];
            }
        }

        try {
            let response;
            if (isAddingNewSubscene) {
                // 新增模式
                response = await worldEditor.addSubScene(fileId, activeSceneId, subsceneData);
            } else {
                // 更新模式
                response = await worldEditor.updateSubScene(fileId, activeSceneId, subsceneData);
            }
            
            if (response.data?.success) {
                toast.success(isAddingNewSubscene ? '子场景创建成功' : '子场景更新成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
                // 如果是新增模式，关闭新增面板
                if (isAddingNewSubscene) {
                    setIsAddingNewSubscene(false);
                    setActiveSubsceneId(null);
                    setActiveSubsceneDraft(null);
                }
            } else {
                toast.error(isAddingNewSubscene ? '创建子场景失败' : '更新子场景失败');
            }
        } catch (error) {
            console.error(isAddingNewSubscene ? '创建子场景时出错:' : '更新子场景时出错:', error);
            toast.error(isAddingNewSubscene ? '创建子场景失败，请重试' : '更新子场景失败，请重试');
        }
    };

    const toggleSubsceneCollapse = (sceneId: string) => {
        setSubsceneCollapsed((prev) => ({
            ...prev,
            [sceneId]: !prev[sceneId],
        }));
    };

    // 统一退出新增模式（父场景或子场景）
    const exitCreateModes = () => {
        if (isAddingNew) {
            setIsAddingNew(false);
            setNewSceneData(null);
        }
        if (isAddingNewSubscene) {
            setIsAddingNewSubscene(false);
        }
        setActiveSubsceneDraft(null);
    };

    // 更新新增场景的字段
    const updateNewSceneField = (field: keyof LocalScene, value: string) => {
        if (!newSceneData) return;
        setNewSceneData({ ...newSceneData, [field]: value });
    };

    // 删除场景
    const handleDeleteClick = (sceneId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // 阻止触发场景选择
        setSceneToDelete(sceneId);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!sceneToDelete || !fileId) {
            setDeleteModalOpen(false);
            setSceneToDelete(null);
            return;
        }

        try {
            const response = mode === 'worldInteraction'
                ? await worldEditor.deleteScene(fileId, sceneToDelete)
                : await EditorApi.deleteScene(fileId, sceneToDelete);
            if (response.data?.success) {
                setSceneData(prev => {
                    const filtered = prev.filter(scene => scene.id !== sceneToDelete);
                    // 如果删除的是当前选中的场景，切换到第一个场景
                    if (sceneToDelete === activeSceneId) {
                        if (filtered.length > 0) {
                            setActiveSceneId(filtered[0].id);
                        } else {
                            setActiveSceneId('');
                        }
                    }
                    return filtered;
                });
                toast.success('场景删除成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('删除场景失败');
            }
        } catch (error) {
            console.error('删除场景时出错:', error);
            toast.error('删除场景失败，请重试');
        } finally {
            setDeleteModalOpen(false);
            setSceneToDelete(null);
        }
    };

    const handleCancelDelete = () => {
        setDeleteModalOpen(false);
        setSceneToDelete(null);
    };

    // 删除子场景
    const handleConfirmSubsceneDelete = async () => {
        if (!subsceneToDelete || !fileId) {
            setSubsceneDeleteModalOpen(false);
            setSubsceneToDelete(null);
            return;
        }

        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            setSubsceneDeleteModalOpen(false);
            setSubsceneToDelete(null);
            return;
        }

        try {
            const response = await worldEditor.deleteSubScene(fileId, subsceneToDelete.sceneId, subsceneToDelete.subsceneId);
            if (response.data?.success) {
                // 如果删除的是当前选中的子场景，清空选中状态
                if (subsceneToDelete.subsceneId === activeSubsceneId) {
                    setActiveSubsceneId(null);
                    setActiveSubsceneDraft(null);
                }
                toast.success('子场景删除成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('删除子场景失败');
            }
        } catch (error) {
            console.error('删除子场景时出错:', error);
            toast.error('删除子场景失败，请重试');
        } finally {
            setSubsceneDeleteModalOpen(false);
            setSubsceneToDelete(null);
        }
    };

    const handleCancelSubsceneDelete = () => {
        setSubsceneDeleteModalOpen(false);
        setSubsceneToDelete(null);
    };

    // 处理场景图片点击（触发文件选择）
    const handleSceneImageClick = () => {
        if (isAddingNew && newSceneFileInputRef.current) {
            newSceneFileInputRef.current.click();
        } else if (sceneFileInputRef.current) {
            sceneFileInputRef.current.click();
        }
    };

    // 上传场景图片
    const handleUploadSceneImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

        // 确定目标场景ID
        let targetSceneId = '';

        if (isAddingNew && newSceneData) {
            // 新增模式：需要先创建场景
            const newSceneId = `scene_${Date.now()}`;
            
            const sceneDataForApi: ApiScene = {
                id: newSceneId,
                name: newSceneData.name || '未命名场景',
                type: newSceneData.type || '',
                description: newSceneData.desc || '暂无描述',
                image: undefined, // 先不上传图片，等创建成功后再上传
                soundtrack: newSceneData.bgmId || undefined,
                npcs: [],
                events: [],
            };

            try {
                const createResponse = mode === 'worldInteraction'
                    ? await worldEditor.addScene(fileId, sceneDataForApi as any)
                    : await EditorApi.addScene(fileId, sceneDataForApi);
                if (!createResponse.data?.success) {
                    toast.error('创建场景失败，无法上传图片');
                    return;
                }
                
                // 创建成功后，更新本地数据
                const createdScene: LocalScene = {
                    ...newSceneData,
                    id: newSceneId,
                };
                setSceneData(prev => [createdScene, ...prev]);
                setActiveSceneId(newSceneId);
                setIsAddingNew(false);
                setNewSceneData(null);
                targetSceneId = newSceneId;
            } catch (error) {
                console.error('创建场景时出错:', error);
                toast.error('创建场景失败，请重试');
                return;
            }
        } else if (activeSubsceneId && activeSubsceneDraft) {
            // 子场景模式：上传子场景图片
            if (mode !== 'worldInteraction') {
                toast.error('子场景功能仅在世界交互模式下可用');
                return;
            }
            if (!activeSubsceneId) {
                toast.error('缺少子场景ID，无法上传');
                return;
            }
            try {
                const response = await worldEditor.uploadSubSceneImage(fileId, activeSceneId, activeSubsceneId, file);
                if (response.data?.success) {
                    toast.success('子场景图片上传成功');
                    // 刷新数据以获取最新的图片URL
                    if (onDataChange) {
                        onDataChange();
                    }
                } else {
                    toast.error('上传子场景图片失败');
                }
            } catch (error) {
                console.error('上传子场景图片时出错:', error);
                toast.error('上传子场景图片失败，请重试');
            } finally {
                // 清空文件输入
                if (sceneFileInputRef.current) {
                    sceneFileInputRef.current.value = '';
                }
            }
            return;
        } else {
            // 正常模式（主场景）
            targetSceneId = activeSceneId;
        }

        // 如果目标场景ID为空，说明当前没有选中有效的场景
        if (!targetSceneId) {
            toast.error('请先选择场景');
            return;
        }

        try {
            const response = mode === 'worldInteraction'
                ? await worldEditor.uploadSceneImage(fileId, targetSceneId, file)
                : await EditorApi.uploadSceneImage(fileId, targetSceneId, file);
            if (response.data?.success) {
                toast.success('场景图片上传成功');
                // 刷新数据以获取最新的图片URL
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('上传场景图片失败');
            }
        } catch (error) {
            console.error('上传场景图片时出错:', error);
            toast.error('上传场景图片失败，请重试');
        } finally {
            // 清空文件输入，以便可以再次选择同一文件
            if (sceneFileInputRef.current) {
                sceneFileInputRef.current.value = '';
            }
            if (newSceneFileInputRef.current) {
                newSceneFileInputRef.current.value = '';
            }
        }
    };

    const regenerateSceneImage = async (scene: LocalScene) => {
        if (!fileId || !scene) {
            return;
        }
        try {
            setIsGeneratingSingleSceneImage(true);
            const response = await EditorApi.generateSceneImage({ 
                fileId, 
                scene: { 
                    id: scene.id, 
                    name: scene.name, 
                    description: scene.desc 
                },
                mode: mode
            });
            if (response.data?.success) {
                console.log(response.data);
                toast.success('场景图片重新生成成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('重新生成场景图片失败');
            }
        }catch(error){
            console.error('重新生成场景图片时出错:', error);
            toast.error('重新生成场景图片失败，请重试');
        } finally {
            setIsGeneratingSingleSceneImage(false);
        }
    };
    

    const generateAllSceneImages = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsGeneratingAllSceneImages(true);
            const response = await worldEditor.generateAllSceneImages(fileId);
            if (response.data?.success) {
                toast.success('所有场景立绘生成成功');
                // 刷新数据
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('生成所有场景立绘失败');
            }
        } catch (error) {
            console.error('生成所有场景立绘时出错:', error);
            toast.error('生成所有场景立绘失败，请重试');
        } finally {
            setIsGeneratingAllSceneImages(false);
        }
    };

    return (
        <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 4</p>
                    <h2>场景背景 & BGM 绑定</h2>
                    <p className={styles.subtitle}>AI 生成场景描述，可直接选择上一步上传的 BGM</p>
                </div>
                <button className={styles.ghost} onClick={generateAllSceneImages} disabled={isGeneratingAllSceneImages}>
                    {isGeneratingAllSceneImages ? '生成中...' : '一键生成所有场景立绘'}
                </button>
            </div>

            <div className={styles.sceneLayout}>
                {/* 左栏 */}
                <div className={styles.stack}>
                    {/* 场景列表 */}
                    <div className={styles.card}>
                        <div className={styles.boardHead}>
                            <div>
                                <h3>解析出的场景</h3>
                            </div>
                            <button className={styles.ghostSmall} onClick={openAddNewPanel}>+ 新增场景</button>
                        </div>
                        <div className={styles.sceneList}>
                            {sceneData.map((scene) => {
                                const originalScene = mode === 'worldInteraction'
                                    ? gameData?.sceneSetting?.scenes?.find((s: any) => s.id === scene.id)
                                    : null;
                                const subscenes: any[] = (originalScene?.subscenes || []) as any[];

                                return (
                                    <React.Fragment key={scene.id}>
                                        {/* 父场景卡片 */}
                                        <article
                                            className={`${styles.sceneRow} ${scene.id === activeSceneId && !activeSubsceneId ? styles.active : ''}`}
                                            onClick={() => {
                                                exitCreateModes();
                                                setActiveSceneId(scene.id);
                                                setActiveSubsceneId(null);
                                                setActiveSubsceneDraft(null);
                                            }}
                                        >
                                            <div
                                                className={`${styles.sceneThumb} ${!scene.image ? styles.empty : ''}`}
                                                style={scene.image ? { backgroundImage: `url('${scene.image}')` } : {}}
                                            >
                                                {!scene.image && <span>待上传</span>}
                                            </div>
                                            <div className={styles.sceneMeta}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                    <strong>{scene.name}</strong>
                                                    <button
                                                        className={styles.deleteButton}
                                                        onClick={(e) => handleDeleteClick(scene.id, e)}
                                                        title="删除场景"
                                                    >
                                                        <RiDeleteBin5Line />
                                                    </button>
                                                </div>
                                                <p className={styles.mutedSmall}>{scene.desc}</p>
                                            </div>
                                        </article>

                                        {/* 子场景卡片（独立盒子，轻微缩进） */}
                                        {mode === 'worldInteraction' && (
                                            <div className={styles.subsceneList}>
                                                <div className={styles.subsceneHeader}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleSubsceneCollapse(scene.id);
                                                            }}
                                                            style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                                                            aria-label={subsceneCollapsed[scene.id] ? '展开子场景' : '折叠子场景'}
                                                            title={subsceneCollapsed[scene.id] ? '展开子场景' : '折叠子场景'}
                                                        >
                                                            {subsceneCollapsed[scene.id] ? <RiArrowRightSLine size={16} /> : <RiArrowDownSLine size={16} />}
                                                        </button>
                                                        <span className={styles.subsceneHeaderText}>
                                                            子场景（{subscenes.length}）
                                                        </span>
                                                    </div>
                                                    <button 
                                                        className={styles.ghostSmall} 
                                                        onClick={openAddNewSubscene}
                                                        style={{ fontSize: '12px', padding: '4px 8px' }}
                                                    >
                                                        + 新增子场景
                                                    </button>
                                                </div>
                                                {!subsceneCollapsed[scene.id] && subscenes.map((sub) => {
                                                    const subId = sub.id || sub.name;
                                                    const isActiveSub = activeSubsceneId === subId;
                                                    return (
                                                        <article
                                                            key={subId}
                                                            className={`${styles.sceneRow} ${styles.subsceneRowCard} ${isActiveSub ? styles.active : ''}`}
                                                            onClick={() => {
                                                                exitCreateModes();
                                                                setActiveSceneId(scene.id);
                                                                setActiveSubsceneId(subId);
                                                                setActiveSubsceneDraft({
                                                                    id: subId,
                                                                    name: sub.name || '未命名子场景',
                                                                    type: sub.type || '',
                                                                    desc: sub.description || '',
                                                                    image: sub.image || '',
                                                                    bgmId: sub.soundtrack || scene.bgmId || '',
                                                                });
                                                            }}
                                                        >
                                                            <div
                                                                className={`${styles.sceneThumb} ${!sub.image ? styles.empty : ''}`}
                                                                style={sub.image ? { backgroundImage: `url('${sub.image}')` } : {}}
                                                            >
                                                                {!sub.image && <span>待生成或上传</span>}
                                                            </div>
                                                            <div className={styles.sceneMeta}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                        <strong>{sub.name || '未命名子场景'}</strong>
                                                                        <span className={styles.subsceneTag}>子场景</span>
                                                                    </div>
                                                                    <button
                                                                        className={styles.deleteButton}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSubsceneToDelete({ sceneId: scene.id, subsceneId: subId });
                                                                            setSubsceneDeleteModalOpen(true);
                                                                        }}
                                                                        title="删除子场景"
                                                                    >
                                                                        <RiDeleteBin5Line />
                                                                    </button>
                                                                </div>
                                                                <p className={styles.mutedSmall}>{sub.description}</p>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 右栏 - 场景详情 */}
                <div className={styles.card}>
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
                    {!isAddingNew && activeScene && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                            {activeSubsceneId ? (
                                <>
                                    <button className={styles.ghostSmall} onClick={confirmSubsceneEdit}>
                                        {isAddingNewSubscene ? '确认增加' : '确认修改'}
                                    </button>
                                    {isAddingNewSubscene && (
                                        <button className={styles.ghostSmall} onClick={cancelAddNewSubscene}>
                                            取消
                                        </button>
                                    )}
                                </>
                            ) : (
                                <button className={styles.ghostSmall} onClick={confirmEdit}>
                                    确认修改
                                </button>
                            )}
                        </div>
                    )}

                    {isAddingNew && newSceneData ? (
                        /* 新增场景表单 */
                        <>
                            {/* 场景背景大图 */}
                            <div
                                className={`${styles.sceneHero} ${!newSceneData.image ? styles.empty : ''}`}
                                onClick={handleSceneImageClick}
                                style={{ cursor: 'pointer', ...(newSceneData.image ? { backgroundImage: `url('${newSceneData.image}')` } : {}) }}
                            >
                                {newSceneData.image ? (
                                    <span className={styles.heroHint}>点击替换背景</span>
                                ) : (
                                    <span>点击上传背景图</span>
                                )}
                                {isGeneratingSingleSceneImage && (
                                    <div className="loadingOverlay">
                                        <div className="loadingSpinner"></div>
                                        <div className="loadingText">正在生成场景图片...</div>
                                    </div>
                                )}
                            </div>

                            <div className={styles.sceneImageActions}>
                                <button className={styles.ghostSmall} onClick={handleSceneImageClick}>上传背景</button>
                                {newSceneData && (
                                    <button 
                                        className={styles.ghostSmall} 
                                        onClick={() => regenerateSceneImage(newSceneData)}
                                        disabled={isGeneratingSingleSceneImage}
                                        style={{ opacity: isGeneratingSingleSceneImage ? 0.5 : 1 }}
                                    >AI 重新生成</button>
                                )}
                            </div>
                            
                            {/* 隐藏的文件输入（新增场景） */}
                            <input
                                type="file"
                                ref={newSceneFileInputRef}
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleUploadSceneImage}
                            />

                            <div className={styles.formGrid}>
                                <label>
                                    <span>场景名称</span>
                                    <input
                                        type="text"
                                        value={newSceneData.name}
                                        onChange={(e) => updateNewSceneField('name', e.target.value)}
                                    />
                                </label>
                                <label className={styles.wide}>
                                    <span>场景描述</span>
                                    <textarea
                                        rows={3}
                                        value={newSceneData.desc}
                                        onChange={(e) => updateNewSceneField('desc', e.target.value)}
                                    />
                                </label>
                                <label>
                                    <span>特殊 BGM</span>
                                    <select
                                        value={newSceneData.bgmId}
                                        onChange={(e) => updateNewSceneField('bgmId', e.target.value)}
                                    >
                                        <option value="">不绑定特殊 BGM</option>
                                        {bgmLibrary.map((bgm) => (
                                            <option key={bgm.id} value={bgm.id}>
                                                {bgm.name}{bgm.description ? ` · ${bgm.description}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </>
                    ) : (
                        /* 正常显示选中的详情：主场景或子场景 */
                        <>
                            {mode === 'worldInteraction' && activeSubsceneId && activeSubsceneDraft ? (
                                /* 子场景编辑盒子：复用父场景的完整布局 */
                                <>
                                    {/* 场景背景大图 */}
                                    <div
                                        className={`${styles.sceneHero} ${!activeSubsceneDraft.image ? styles.empty : ''}`}
                                        onClick={handleSceneImageClick}
                                        style={{ cursor: 'pointer', ...(activeSubsceneDraft.image ? { backgroundImage: `url('${activeSubsceneDraft.image}')` } : {}) }}
                                    >
                                        {activeSubsceneDraft.image ? (
                                            <span className={styles.heroHint}>点击替换背景</span>
                                        ) : (
                                            <span>点击上传背景图</span>
                                        )}
                                        {isGeneratingSingleSceneImage && (
                                            <div className="loadingOverlay">
                                                <div className="loadingSpinner"></div>
                                                <div className="loadingText">正在生成场景图片...</div>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.sceneImageActions}>
                                        <button className={styles.ghostSmall} onClick={handleSceneImageClick}>上传背景</button>
                                        {activeSubsceneDraft && (
                                            <button 
                                                className={styles.ghostSmall} 
                                                onClick={() => regenerateSceneImage(activeSubsceneDraft)}
                                                disabled={isGeneratingSingleSceneImage}
                                                style={{ opacity: isGeneratingSingleSceneImage ? 0.5 : 1 }}
                                            >AI 重新生成</button>
                                        )}
                                    </div>
                                    
                                    {/* 隐藏的文件输入（子场景模式） */}
                                    <input
                                        type="file"
                                        ref={sceneFileInputRef}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleUploadSceneImage}
                                    />

                                    <div className={styles.formGrid}>
                                        <label>
                                            <span>场景名称</span>
                                            <input
                                                type="text"
                                                value={activeSubsceneDraft.name}
                                                onChange={(e) => updateSubsceneField('name', e.target.value)}
                                            />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>场景描述</span>
                                            <textarea
                                                rows={3}
                                                value={activeSubsceneDraft.desc}
                                                onChange={(e) => updateSubsceneField('desc', e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>特殊 BGM</span>
                                            <select
                                                value={activeSubsceneDraft.bgmId}
                                                onChange={(e) => updateSubsceneField('bgmId', e.target.value)}
                                            >
                                                <option value="">不绑定特殊 BGM</option>
                                                {bgmLibrary.map((bgm) => (
                                                    <option key={bgm.id} value={bgm.id}>
                                                        {bgm.name}{bgm.description ? ` · ${bgm.description}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </>
                            ) : (
                                /* 主场景编辑盒子（原逻辑） */
                                <>
                                    {/* 场景背景大图 */}
                                    <div
                                        className={`${styles.sceneHero} ${!activeScene.image ? styles.empty : ''}`}
                                        onClick={handleSceneImageClick}
                                        style={{ cursor: 'pointer', ...(activeScene.image ? { backgroundImage: `url('${activeScene.image}')` } : {}) }}
                                    >
                                        {activeScene.image ? (
                                            <span className={styles.heroHint}>点击替换背景</span>
                                        ) : (
                                            <span>点击上传背景图</span>
                                        )}
                                    </div>

                                    <div className={styles.sceneImageActions}>
                                        <button className={styles.ghostSmall} onClick={handleSceneImageClick}>重新上传</button>
                                        {activeScene && (
                                            <button className={styles.ghostSmall} onClick={() => regenerateSceneImage(activeScene)}>AI 重新生成</button>
                                        )}
                                    </div>
                                    
                                    {/* 隐藏的文件输入（正常模式） */}
                                    <input
                                        type="file"
                                        ref={sceneFileInputRef}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleUploadSceneImage}
                                    />

                                    <div className={styles.formGrid}>
                                        <label>
                                            <span>场景名称</span>
                                            <input
                                                type="text"
                                                value={activeScene.name}
                                                onChange={(e) => updateSceneField('name', e.target.value)}
                                            />
                                        </label>
                                        <label className={styles.wide}>
                                            <span>场景描述</span>
                                            <textarea
                                                rows={3}
                                                value={activeScene.desc}
                                                onChange={(e) => updateSceneField('desc', e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>特殊 BGM</span>
                                            <select
                                                value={activeScene.bgmId}
                                                onChange={(e) => updateSceneField('bgmId', e.target.value)}
                                            >
                                                <option value="">不绑定特殊 BGM</option>
                                                {bgmLibrary.map((bgm) => (
                                                    <option key={bgm.id} value={bgm.id}>
                                                        {bgm.name}{bgm.description ? ` · ${bgm.description}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 删除场景确认弹窗 */}
            <DeletModal
                isOpen={deleteModalOpen}
                onDelete={handleConfirmDelete}
                onCancel={handleCancelDelete}
                title="删除场景"
                message="删除后场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {/* 删除子场景确认弹窗 */}
            <DeletModal
                isOpen={subsceneDeleteModalOpen}
                onDelete={handleConfirmSubsceneDelete}
                onCancel={handleCancelSubsceneDelete}
                title="删除子场景"
                message="删除后子场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {isGeneratingAllSceneImages && (
                <div className="loadingOverlay">
                    <div className="loadingSpinner"></div>
                    <div className="loadingText">正在生成场景立绘...</div>
                </div>
            )}
        </div>
    );
};

export default ScenesPanel;
