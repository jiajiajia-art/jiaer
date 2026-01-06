/**
 * 场景业务逻辑处理函数
 * 抽离主要业务逻辑，降低 ScenesPanel 主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Scene as ApiScene } from '../../../api/galgame/getGalgamePreset.type';
import { getSceneById, getSubSceneById, isWorldSubScene, type SceneLike } from '../editorCompat';
import type { SceneApiHelpers } from './apiHelpers';
import { parseSceneResponse } from './apiHelpers';
import type { AllGameData } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import { addImageTimestamp, getImageUrl } from '../../../utils/constants';

export interface LocalScene {
    id: string;
    name: string;
    type: string;
    desc: string;
    image: string;
    bgmId: string;
}

export interface HandlersContext {
    fileId?: string | null;
    mode: string;
    gameData?: AllGameData | WorldInteractionGameData | null;
    api: SceneApiHelpers;

    // 必要的 state getters
    activeSceneId: string;
    activeSubsceneId: string | null;
    activeSubsceneDraft: LocalScene | null;
    sceneData: LocalScene[];
    isAddingNew: boolean;
    newSceneData: LocalScene | null;
    isAddingNewSubscene: boolean;

    // 必要的 setters（只传真正需要的）
    setSceneData: React.Dispatch<React.SetStateAction<LocalScene[]>>;
    setActiveSceneId: React.Dispatch<React.SetStateAction<string>>;
    setActiveSubsceneId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveSubsceneDraft: React.Dispatch<React.SetStateAction<LocalScene | null>>;
    setIsAddingNew: React.Dispatch<React.SetStateAction<boolean>>;
    setNewSceneData: React.Dispatch<React.SetStateAction<LocalScene | null>>;
    setIsAddingNewSubscene: React.Dispatch<React.SetStateAction<boolean>>;
    setIsGeneratingSingleSceneImage: React.Dispatch<React.SetStateAction<boolean>>;
    setGeneratingSceneId: React.Dispatch<React.SetStateAction<string | null>>;
    setIsGeneratingWorldMap: React.Dispatch<React.SetStateAction<boolean>>;
    setWorldMapImageOverride: React.Dispatch<React.SetStateAction<string | null>>;
    setIsGeneratingAllSceneImages: React.Dispatch<React.SetStateAction<boolean>>;
    setSceneCostPoints: React.Dispatch<React.SetStateAction<number | null>>;
    setIsLoadingSceneCost: React.Dispatch<React.SetStateAction<boolean>>;

    // refs（需要操作 DOM）
    sceneFileInputRef: React.RefObject<HTMLInputElement | null>;
    newSceneFileInputRef: React.RefObject<HTMLInputElement | null>;
    worldMapFileInputRef: React.RefObject<HTMLInputElement | null>;

    // 弹窗控制回调（简化：只传开关函数，内部状态用闭包管理）
    onDeleteModalOpen: () => void;
    onDeleteModalClose: () => void;
    onSubsceneDeleteModalOpen: () => void;
    onSubsceneDeleteModalClose: () => void;
    onSceneCostModalOpen: (points: number | null) => void;
    onSingleSceneCostModalOpen: () => void;
    onWorldMapCostModalOpen: () => void;

    onDataChange?: () => void;
}

export const createSceneHandlers = (ctx: HandlersContext) => {
    const {
        fileId,
        mode,
        gameData,
        api,
        // state getters
        activeSceneId,
        activeSubsceneId,
        activeSubsceneDraft,
        sceneData,
        isAddingNew,
        newSceneData,
        isAddingNewSubscene,
        // setters
        setSceneData,
        setActiveSceneId,
        setActiveSubsceneId,
        setActiveSubsceneDraft,
        setIsAddingNew,
        setNewSceneData,
        setIsAddingNewSubscene,
        setIsGeneratingSingleSceneImage,
        setGeneratingSceneId,
        setIsGeneratingWorldMap,
        setWorldMapImageOverride,
        setIsGeneratingAllSceneImages,
        setSceneCostPoints,
        setIsLoadingSceneCost,
        // refs
        sceneFileInputRef,
        newSceneFileInputRef,
        worldMapFileInputRef,
        // 弹窗控制
        onDeleteModalOpen,
        onDeleteModalClose,
        onSubsceneDeleteModalOpen,
        onSubsceneDeleteModalClose,
        onSceneCostModalOpen,
        onSingleSceneCostModalOpen,
        onWorldMapCostModalOpen,
        onDataChange,
    } = ctx;

    // 临时状态用闭包变量管理（不需要传给组件）
    let sceneToDelete: string | null = null;
    let subsceneToDelete: { sceneId: string; subsceneId: string } | null = null;
    let pendingSceneForGenerate: LocalScene | null = null;

    // 更新场景字段（本地）
    const updateSceneField = (field: keyof LocalScene, value: string) => {
        setSceneData(prev =>
            prev.map(scene =>
                scene.id === activeSceneId ? { ...scene, [field]: value } : scene
            )
        );
    };

    // 更新子场景字段（本地）
    const updateSubsceneField = (field: keyof LocalScene, value: string) => {
        if (activeSubsceneDraft) {
            setActiveSubsceneDraft({ ...activeSubsceneDraft, [field]: value });
        }
    };

    // 打开新增场景
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
        setActiveSceneId('');
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

    // 从 API 响应中更新单个场景
    const updateSceneFromResponse = (responseData: any, sceneId: string) => {
        if (mode === 'worldInteraction') {
            const scene = responseData?.data;
            if (scene) {
                const updatedScene: LocalScene = {
                    id: scene.id,
                    name: scene.name || '',
                    type: scene.type || '',
                    desc: scene.description || '',
                    image: addImageTimestamp(scene.image),
                    bgmId: scene.soundtrack || '',
                };
                setSceneData(prev => prev.map(s => s.id === sceneId ? updatedScene : s));
            }
        } else {
            const sceneSetting = responseData?.sceneSetting;
            if (sceneSetting?.scenes) {
                const scene = (sceneSetting.scenes as SceneLike[]).find((s: SceneLike) => s.id === sceneId);
                if (scene) {
                    const updatedScene: LocalScene = {
                        id: scene.id,
                        name: scene.name || '',
                        type: 'type' in scene ? (scene.type || '') : '',
                        desc: scene.description || '',
                        image: addImageTimestamp((scene as any).image),
                        bgmId: (scene as any).soundtrack || '',
                    };
                    setSceneData(prev => prev.map(s => s.id === sceneId ? updatedScene : s));
                }
            }
        }
    };

    // 确认新增场景
    const confirmAddNew = async () => {
        if (!fileId || !newSceneData) {
            toast.error('缺少必要数据，无法新增场景');
            return;
        }

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
            const response = await api.addScene(fileId, sceneDataForApi);
            if (response.data?.success) {
                let createdScene: LocalScene;
                if (mode === 'worldInteraction') {
                    const scene = (response.data as any)?.data;
                    if (scene && scene.id) {
                        createdScene = {
                            id: scene.id,
                            name: scene.name || '',
                            type: scene.type || '',
                            desc: scene.description || '',
                            image: scene.image || '',
                            bgmId: scene.soundtrack || '',
                        };
                    } else {
                        createdScene = {
                            ...newSceneData,
                            id: newSceneId,
                        };
                    }
                } else {
                    const sceneSetting = (response.data as any)?.sceneSetting;
                    const scene = sceneSetting?.scenes?.find((s: any) => s.id === newSceneId);
                    createdScene = scene ? {
                        id: scene.id,
                        name: scene.name || '',
                        type: scene.type || '',
                        desc: scene.description || '',
                        image: scene.image || '',
                        bgmId: scene.soundtrack || '',
                    } : {
                        ...newSceneData,
                        id: newSceneId,
                    };
                }
                setSceneData(prev => [createdScene, ...prev]);
                setActiveSceneId(createdScene.id);
                setIsAddingNew(false);
                setNewSceneData(null);
                toast.success('场景创建成功');
            } else {
                toast.error('创建场景失败');
            }
        } catch (error) {
            console.error('创建场景时出错:', error);
            toast.error('创建场景失败，请重试');
        }
    };

    // 确认修改场景
    const confirmEdit = async (activeScene: LocalScene | undefined) => {
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
            const response = await api.updateScene(fileId, sceneDataForApi);
            if (response.data?.success) {
                toast.success('场景更新成功');
                updateSceneFromResponse(response.data, sceneToSave.id);
            } else {
                toast.error('更新场景失败');
            }
        } catch (error) {
            console.error('更新场景时出错:', error);
            toast.error('更新场景失败，请重试');
        }
    };

    // 打开新增子场景
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
        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            return;
        }

        const subsceneData: any = {
            id: isAddingNewSubscene ? `subscene_${Date.now()}` : activeSubsceneDraft.id,
            name: activeSubsceneDraft.name || '未命名子场景',
            description: activeSubsceneDraft.desc || '',
            image: activeSubsceneDraft.image || '',
            npcs: [],
            position: [0, 0],
            npcs_slots: [],
        };

        if (!isAddingNewSubscene) {
            const originalScene = getSceneById(gameData as any, activeSceneId);
            const originalSubscene = getSubSceneById(originalScene, activeSubsceneDraft.id);
            if (originalSubscene && isWorldSubScene(originalSubscene)) {
                subsceneData.npcs = originalSubscene.npcs || [];
                subsceneData.position = originalSubscene.position || [0, 0];
                subsceneData.npcs_slots = originalSubscene.npcs_slots || [];
            }
        }

        try {
            let response;
            if (isAddingNewSubscene) {
                response = await api.addSubScene(fileId, activeSceneId, subsceneData);
            } else {
                response = await api.updateSubScene(fileId, activeSceneId, subsceneData);
            }

            if (response.data?.success) {
                toast.success(isAddingNewSubscene ? '子场景创建成功' : '子场景更新成功');
                if (onDataChange) onDataChange();
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


    // 统一退出新增模式
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

    const updateNewSceneField = (field: keyof LocalScene, value: string) => {
        if (!newSceneData) return;
        setNewSceneData({ ...newSceneData, [field]: value });
    };

    // 删除场景
    const handleDeleteClick = (sceneId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        sceneToDelete = sceneId;
        onDeleteModalOpen();
    };

    const handleConfirmDelete = async () => {
        if (!fileId || !sceneToDelete) {
            sceneToDelete = null;
            onDeleteModalClose();
            return;
        }

        const targetId = sceneToDelete;
        sceneToDelete = null;

        try {
            const response = await api.deleteScene(fileId, targetId);
            if (response.data?.success) {
                setSceneData(prev => {
                    const filtered = prev.filter(scene => scene.id !== targetId);
                    if (targetId === activeSceneId) {
                        setActiveSceneId(filtered[0]?.id || '');
                    }
                    return filtered;
                });
                toast.success('场景删除成功');
                if (onDataChange) onDataChange();
            } else {
                toast.error('删除场景失败');
            }
        } catch (error) {
            console.error('删除场景时出错:', error);
            toast.error('删除场景失败，请重试');
        } finally {
            onDeleteModalClose();
        }
    };

    const handleCancelDelete = () => {
        sceneToDelete = null;
        onDeleteModalClose();
    };

    // 删除子场景
    const handleSubsceneDeleteClick = (sceneId: string, subsceneId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        subsceneToDelete = { sceneId, subsceneId };
        onSubsceneDeleteModalOpen();
    };

    const handleConfirmSubsceneDelete = async () => {
        if (!fileId || !subsceneToDelete) {
            subsceneToDelete = null;
            onSubsceneDeleteModalClose();
            return;
        }

        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            subsceneToDelete = null;
            onSubsceneDeleteModalClose();
            return;
        }

        const ids = subsceneToDelete;
        subsceneToDelete = null;

        try {
            const response = await api.deleteSubScene(fileId, ids.sceneId, ids.subsceneId);
            if (response.data?.success) {
                if (ids.subsceneId === activeSubsceneId) {
                    setActiveSubsceneId(null);
                    setActiveSubsceneDraft(null);
                }
                toast.success('子场景删除成功');
                if (onDataChange) onDataChange();
            } else {
                toast.error('删除子场景失败');
            }
        } catch (error) {
            console.error('删除子场景时出错:', error);
            toast.error('删除子场景失败，请重试');
        } finally {
            onSubsceneDeleteModalClose();
        }
    };

    const handleCancelSubsceneDelete = () => {
        subsceneToDelete = null;
        onSubsceneDeleteModalClose();
    };

    // 处理场景/子场景图片点击
    const handleSceneImageClick = () => {
        if (isAddingNew) {
            toast.error('请先确认新增场景，然后再上传图片');
            return;
        }
        if (isAddingNewSubscene && activeSubsceneId && activeSubsceneId.startsWith('temp-')) {
            toast.error('请先确认新增子场景，然后再上传图片');
            return;
        }
        if (sceneFileInputRef.current) {
            sceneFileInputRef.current.click();
        }
    };

    // 上传场景/子场景图片
    const handleUploadSceneImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('请选择图片文件');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('图片大小不能超过 5MB');
            return;
        }
        if (!fileId) {
            toast.error('缺少文件ID，无法上传');
            return;
        }

        let targetSceneId = '';

        if (isAddingNew && newSceneData) {
            toast.error('请先确认新增场景，然后再上传图片');
            if (newSceneFileInputRef.current) newSceneFileInputRef.current.value = '';
            if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
            return;
        } else if (activeSubsceneId && activeSubsceneDraft) {
            if (mode !== 'worldInteraction') {
                toast.error('子场景功能仅在世界交互模式下可用');
                return;
            }
            if (!activeSubsceneId) {
                toast.error('缺少子场景ID，无法上传');
                return;
            }
            if (isAddingNewSubscene && activeSubsceneId.startsWith('temp-')) {
                toast.error('请先确认新增子场景，然后再上传图片');
                if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
                return;
            }
            try {
                const response = await api.uploadSubSceneImage(fileId, activeSceneId, activeSubsceneId, file);
                if (response.data?.success) {
                    toast.success('子场景图片上传成功');
                    const responseAny = response.data as any;
                    const newImageUrl = responseAny?.data?.image || responseAny?.imagePath;
                    if (newImageUrl) {
                        setActiveSubsceneDraft(prev => prev ? {
                            ...prev,
                            image: addImageTimestamp(newImageUrl),
                        } : null);
                    } else if (activeSubsceneDraft?.image) {
                        const baseUrl = activeSubsceneDraft.image.split('?')[0];
                        setActiveSubsceneDraft(prev => prev ? {
                            ...prev,
                            image: addImageTimestamp(baseUrl),
                        } : null);
                    }
                    if (onDataChange) onDataChange();
                } else {
                    toast.error('上传子场景图片失败');
                }
            } catch (error) {
                console.error('上传子场景图片时出错:', error);
                toast.error('上传子场景图片失败，请重试');
            } finally {
                if (sceneFileInputRef.current) {
                    sceneFileInputRef.current.value = '';
                }
            }
            return;
        } else {
            targetSceneId = activeSceneId;
        }

        if (!targetSceneId) {
            toast.error('请先选择场景');
            return;
        }

        try {
            const response = await api.uploadSceneImage(fileId, targetSceneId, file);
            if (response.data?.success) {
                toast.success('场景图片上传成功');
                
                // 使用后端返回的数据更新本地状态
                const imageData = parseSceneResponse.extractSceneImage(response.data, mode, targetSceneId);
                if (imageData?.imagePath) {
                    const processedImagePath = getImageUrl(imageData.imagePath);
                    setSceneData(prev => prev.map(s =>
                        s.id === targetSceneId
                            ? { ...s, image: addImageTimestamp(processedImagePath) }
                            : s
                    ));
                } else {
                    // 如果无法提取图片数据，使用原有图片并添加缓存破坏
                    setSceneData(prev => prev.map(s => {
                        if (s.id === targetSceneId && s.image) {
                            const baseUrl = s.image.split('?')[0];
                            return { ...s, image: addImageTimestamp(baseUrl) };
                        }
                        return s;
                    }));
                }
            } else {
                toast.error('上传场景图片失败');
            }
        } catch (error) {
            console.error('上传场景图片时出错:', error);
            toast.error('上传场景图片失败，请重试');
        } finally {
            if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
            if (newSceneFileInputRef.current) newSceneFileInputRef.current.value = '';
        }
    };

    // 重新生成单个场景/子场景图片
    const doRegenerateSceneImage = async (scene: LocalScene) => {
        if (!fileId || !scene) return;

        const isSubscene = !!(activeSubsceneId && activeSubsceneDraft && scene.id === activeSubsceneDraft.id);

        if (isAddingNew && newSceneData && scene.id === newSceneData.id) {
            toast.error('请先确认新增场景，然后再生成图片');
            return;
        }
        if (isAddingNewSubscene && scene.id.startsWith('temp-')) {
            toast.error('请先确认新增子场景，然后再生成图片');
            return;
        }

        try {
            setIsGeneratingSingleSceneImage(true);
            setGeneratingSceneId(scene.id);

            let response: any;
            let imageUrl: string | undefined;

            if (isSubscene && mode === 'worldInteraction' && activeSceneId) {
                response = await api.generateSubSceneImage(fileId, activeSceneId, scene.id);
                if (response.data?.success) {
                    imageUrl = response.data.imagePath ? getImageUrl(response.data.imagePath) : undefined;
                }
            } else {
                response = await api.generateSceneImage({
                    fileId,
                    scene: {
                        id: scene.id,
                        name: scene.name,
                        description: scene.desc,
                    },
                });
                if (response.data?.success) {
                    // 使用后端返回的数据更新本地状态
                    const imageData = parseSceneResponse.extractSceneImage(response.data, mode, scene.id);
                    imageUrl = imageData?.imagePath ? getImageUrl(imageData.imagePath) : undefined;
                }
            }

            if (response.data?.success) {
                toast.success('场景图片重新生成成功');

                if (isSubscene) {
                    if (imageUrl) {
                        setActiveSubsceneDraft(prev => prev ? {
                            ...prev,
                            image: addImageTimestamp(imageUrl),
                        } : null);
                    } else if (activeSubsceneDraft?.image) {
                        const baseUrl = activeSubsceneDraft.image.split('?')[0];
                        setActiveSubsceneDraft(prev => prev ? {
                            ...prev,
                            image: addImageTimestamp(baseUrl),
                        } : null);
                    }
                    if (onDataChange) onDataChange();
                } else {
                    if (imageUrl) {
                        setSceneData(prev => prev.map(s =>
                            s.id === scene.id
                                ? { ...s, image: addImageTimestamp(imageUrl) }
                                : s
                        ));
                    } else {
                        setSceneData(prev => prev.map(s => {
                            if (s.id === scene.id && s.image) {
                                const baseUrl = s.image.split('?')[0];
                                return { ...s, image: addImageTimestamp(baseUrl) };
                            }
                            return s;
                        }));
                    }
                }
            } else {
                toast.error('重新生成场景图片失败');
            }
        } catch (error) {
            console.error('重新生成场景图片时出错:', error);
            toast.error('重新生成场景图片失败，请重试');
        } finally {
            setIsGeneratingSingleSceneImage(false);
            setGeneratingSceneId(null);
        }
    };

    const handleRequestRegenerateSceneImage = (scene: LocalScene) => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        pendingSceneForGenerate = scene;
        onSingleSceneCostModalOpen();
    };

    const confirmSingleSceneGenerate = async () => {
        if (!pendingSceneForGenerate) return;
        const target = pendingSceneForGenerate;
        pendingSceneForGenerate = null;
        await doRegenerateSceneImage(target);
    };

    const cancelSingleSceneGenerate = () => {
        pendingSceneForGenerate = null;
    };

    // 大地图生成 & 上传
    const doGenerateWorldMap = async () => {
        if (!fileId) {
            toast.error('缺少文件 ID，无法生成大地图');
            return;
        }
        try {
            setIsGeneratingWorldMap(true);
            const response = await api.generateWorldMapImage(fileId);
            if (response.data.success) {
                toast.success('大地图生成成功');
                if (response.data.imagePath) {
                    const processedImagePath = getImageUrl(response.data.imagePath);
                    setWorldMapImageOverride(addImageTimestamp(processedImagePath));
                }
                if (onDataChange) onDataChange();
            } else {
                toast.error('当前使用人数过多，请稍后再试');
            }
        } catch (error: any) {
            console.error('生成大地图失败:', error);
            toast.error('生成大地图失败：请检查网络连接');
        } finally {
            setIsGeneratingWorldMap(false);
        }
    };

    const handleRequestGenerateWorldMap = () => {
        if (!fileId) {
            toast.error('缺少文件 ID，无法生成大地图');
            return;
        }
        onWorldMapCostModalOpen();
    };

    const confirmGenerateWorldMap = async () => {
        await doGenerateWorldMap();
    };

    const cancelGenerateWorldMap = () => {
        // 不需要额外操作
    };

    const handleUploadWorldMapChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!fileId) {
            toast.error('缺少文件 ID，无法上传大地图');
            return;
        }
        try {
            const response = await api.setWorldMapImage(fileId, file);
            if (response.data?.success) {
                toast.success('大地图上传成功');
                if (response.data.imagePath) {
                    const processedImagePath = getImageUrl(response.data.imagePath);
                    setWorldMapImageOverride(processedImagePath);
                }
                if (onDataChange) onDataChange();
            } else {
                toast.error('大地图上传失败，请稍后重试');
            }
        } catch (error: any) {
            console.error('上传大地图失败:', error);
            toast.error('上传大地图失败：' + (error.message || '请检查网络连接'));
        } finally {
            if (worldMapFileInputRef.current) {
                worldMapFileInputRef.current.value = '';
            }
        }
    };

    // 批量生成场景立绘 + 积分试算
    const generateAllSceneImages = async (sceneCostPoints: number | null) => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsGeneratingAllSceneImages(true);
            const response = await api.generateAllSceneImages(fileId);
            if (response.data?.success) {
                const respAny: any = response.data;
                const payload = respAny.data || respAny;
                const results = payload?.results;
                const scenesGenerated: number | undefined = results?.scenesGenerated ?? results?.generated;
                const scenesTotal: number | undefined = results?.scenesTotal ?? results?.total;
                const errors: number | undefined = typeof results?.errors === 'number' ? results.errors : undefined;

                const usedPoints =
                    sceneCostPoints ??
                    (typeof scenesGenerated === 'number' ? scenesGenerated * 10 : undefined);

                if (typeof scenesGenerated === 'number' && typeof scenesTotal === 'number') {
                    toast.success(
                        `所有场景立绘生成完成：成功 ${scenesGenerated}/${scenesTotal} 个` +
                        (typeof errors === 'number' ? `，失败 ${errors} 个` : '') +
                        (typeof usedPoints === 'number' ? `，本次预计扣除 ${usedPoints} 积分` : '')
                    );
                } else {
                    toast.success(
                        typeof usedPoints === 'number'
                            ? `所有场景立绘生成成功，本次预计扣除 ${usedPoints} 积分`
                            : '所有场景立绘生成成功'
                    );
                }
                if (onDataChange) onDataChange();
            } else {
                toast.error('当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            console.error('生成所有场景立绘时出错:', error);
            toast.error('生成所有场景立绘失败，请检查网络连接');
        } finally {
            setIsGeneratingAllSceneImages(false);
        }
    };

    const openSceneCostModal = async () => {
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsLoadingSceneCost(true);
            const response: any = await api.calculateScenePoints(fileId);
            const points = response?.data?.points ?? response?.data?.data?.points ?? response?.data?.cost ?? null;
            setSceneCostPoints(points);
            onSceneCostModalOpen(points);
        } catch (error) {
            console.error('获取场景生图积分消耗失败:', error);
            toast.error('获取积分消耗失败，请稍后重试');
        } finally {
            setIsLoadingSceneCost(false);
        }
    };

    const confirmGenerateAllSceneImages = async (sceneCostPoints: number | null) => {
        await generateAllSceneImages(sceneCostPoints);
    };

    return {
        // 本地字段更新
        updateSceneField,
        updateSubsceneField,
        updateNewSceneField,

        // 新增 / 编辑 场景 & 子场景
        openAddNewPanel,
        cancelAddNew,
        confirmAddNew,
        confirmEdit,
        openAddNewSubscene,
        cancelAddNewSubscene,
        confirmSubsceneEdit,

        // 删除
        handleDeleteClick,
        handleConfirmDelete,
        handleCancelDelete,
        handleSubsceneDeleteClick,
        handleConfirmSubsceneDelete,
        handleCancelSubsceneDelete,

        // 模式切换
        exitCreateModes,

        // 图片上传 / 生图
        handleSceneImageClick,
        handleUploadSceneImage,
        handleRequestRegenerateSceneImage,
        confirmSingleSceneGenerate,
        cancelSingleSceneGenerate,

        // 大地图
        handleRequestGenerateWorldMap,
        confirmGenerateWorldMap,
        cancelGenerateWorldMap,
        handleUploadWorldMapChange,

        // 批量 & 积分试算
        openSceneCostModal,
        confirmGenerateAllSceneImages,
    };
};


