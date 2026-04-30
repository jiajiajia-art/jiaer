/**
 * 场景业务逻辑处理函数
 * 抽离主要业务逻辑，降低 ScenesPanel 主文件复杂度
 */
import React from 'react';
import { toast } from 'react-hot-toast';
import type { Scene as ApiScene } from '../../../api/galgame/getGalgamePreset.type';
import { getSceneById, getSubSceneById, isWorldSubScene, type SceneLike, type WorldSubScene } from '../editorCompat';
import type { SceneApiHelpers } from './apiHelpers';
import type { AllGameData, BatchImageJobStatus } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { User } from '../../../api/account/auth.type';
import { auth } from '../../../api/account/authApi';
import { getImageUrl } from '../../../utils/constants';
import { withCacheBust, bumpCacheBust } from '../../../utils/imageCache';

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
    updateUser?: (user: Partial<User>) => void;

    // 必要的 state getters
    activeSceneId: string;
    activeSubsceneId: string | null;
    activeSubsceneDraft: LocalScene | null;
    sceneData: LocalScene[];
    subsceneDataBySceneId?: Record<string, any[]>;
    isAddingNew: boolean;
    newSceneData: LocalScene | null;
    isAddingNewSubscene: boolean;
    pendingImages: { [sceneId: string]: { [variant: string]: PendingImage } };

    // 必要的 setters（只传真正需要的）
    setSceneData: React.Dispatch<React.SetStateAction<LocalScene[]>>;
    setSubsceneDataBySceneId?: React.Dispatch<React.SetStateAction<Record<string, any[]>>>;
    setActiveSceneId: React.Dispatch<React.SetStateAction<string>>;
    setActiveSceneDraft: React.Dispatch<React.SetStateAction<LocalScene | null>>;
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
    setSceneBatchJobStatus: React.Dispatch<React.SetStateAction<BatchImageJobStatus | null>>;
    setSceneCostPoints: React.Dispatch<React.SetStateAction<number | null>>;
    setIsLoadingSceneCost: React.Dispatch<React.SetStateAction<boolean>>;
    // 一键生成结果弹窗
    setSceneResultModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setSceneGenerationResult: React.Dispatch<React.SetStateAction<{
        generatedCount: number;
        totalCount: number;
        pointsDeducted: number;
        remainingPoints?: number;
    } | null>>;
    setPendingImages: React.Dispatch<React.SetStateAction<{ [sceneId: string]: { [variant: string]: PendingImage } }>>;
    setHasUnsavedChanges: (value: boolean) => void;

    // refs（需要操作 DOM）
    sceneFileInputRef: React.RefObject<HTMLInputElement | null>;
    newSceneFileInputRef: React.RefObject<HTMLInputElement | null>;
    worldMapFileInputRef: React.RefObject<HTMLInputElement | null>;
    pendingImageUrlsRef: React.MutableRefObject<{ [key: string]: string }>;

    // 弹窗控制回调（简化：只传开关函数，内部状态用闭包管理）
    onDeleteModalOpen: () => void;
    onDeleteModalClose: () => void;
    onSubsceneDeleteModalOpen: () => void;
    onSubsceneDeleteModalClose: () => void;
    onSceneCostModalOpen: (points: number | null) => void;
    onSingleSceneCostModalOpen: () => void;
    onWorldMapCostModalOpen: () => void;

    onDataChange?: () => void | Promise<void>;
    markBatchImageRefreshPending?: (payload: BatchImageReconciliationPayload) => void;
    hasPendingBatchImageRefresh?: () => boolean;
}

/**
 * 暂存图片类型 - 用于图片选择/生成后、确认修改前的预览
 */
export interface PendingImage {
    file?: File;
    previewUrl: string;
    sourceType: 'upload' | 'generate' | 'url';
    variant: string;
    persistedPath?: string;
}

export interface BatchImageReconciliationPayload {
    scenes: Record<string, string>;
    subscenes: Record<string, string>;
}

interface SaveOptions {
    suppressSuccessToast?: boolean;
}

export type SceneSaveResult =
    | { success: false }
    | { success: true; kind: 'sceneAdd' | 'sceneEdit'; savedScene: LocalScene }
    | {
        success: true;
        kind: 'subsceneAdd' | 'subsceneEdit';
        sceneId: string;
        previousSubsceneId: string;
        savedSubscene: WorldSubScene;
    };

export const createSceneHandlers = (ctx: HandlersContext) => {
    const {
        fileId,
        mode,
        gameData,
        api,
        updateUser,
        // state getters
        activeSceneId,
        activeSubsceneId,
        activeSubsceneDraft,
        sceneData,
        isAddingNew,
        newSceneData,
        isAddingNewSubscene,
        pendingImages,
        // setters
        setSceneData,
        setSubsceneDataBySceneId,
        setActiveSceneId,
        setActiveSceneDraft,
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
        setSceneBatchJobStatus,
        setSceneCostPoints,
        setIsLoadingSceneCost,
        setSceneResultModalOpen,
        setSceneGenerationResult,
        setPendingImages,
        setHasUnsavedChanges,
        // refs
        sceneFileInputRef,
        newSceneFileInputRef,
        worldMapFileInputRef,
        pendingImageUrlsRef,
        // 弹窗控制
        onDeleteModalOpen,
        onDeleteModalClose,
        onSubsceneDeleteModalOpen,
        onSubsceneDeleteModalClose,
        onSceneCostModalOpen,
        onSingleSceneCostModalOpen,
        onWorldMapCostModalOpen,
        onDataChange,
        markBatchImageRefreshPending,
        hasPendingBatchImageRefresh,
    } = ctx;

    const BATCH_IMAGE_REFRESH_RETRY_COUNT = 3;
    const BATCH_IMAGE_REFRESH_RETRY_DELAY_MS = 1200;

    // 临时状态用闭包变量管理（不需要传给组件）
    let sceneToDelete: string | null = null;
    let subsceneToDelete: { sceneId: string; subsceneId: string } | null = null;
    let pendingSceneForGenerate: LocalScene | null = null;

    // 刷新用户积分，避免弹窗/扣除后显示不一致
    const refreshUserPoints = async () => {
        if (!updateUser) return;
        try {
            const resp = await auth.getUserInfo();
            const latestUser = resp.data?.data;
            if (latestUser && typeof latestUser.points === 'number') {
                updateUser({ points: latestUser.points });
            }
        } catch (error) {
            console.error('刷新用户积分失败:', error);
        }
    };

    // 设置暂存图片（支持 File、Blob、URL）
    const setPendingImage = async (
        sceneId: string,
        imageData: string | File | Blob | ArrayBuffer,
        variant: string = 'base'
    ) => {
        let previewUrl: string;
        let file: File | undefined;

        if (typeof imageData === 'string') {
            previewUrl = imageData;
        } else if (imageData instanceof File) {
            previewUrl = URL.createObjectURL(imageData);
            file = imageData;
            const key = `${sceneId}-${variant}`;
            if (pendingImageUrlsRef.current[key]) {
                URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            }
            pendingImageUrlsRef.current[key] = previewUrl;
        } else if (imageData instanceof Blob) {
            const key = `${sceneId}-${variant}`;
            if (pendingImageUrlsRef.current[key]) {
                URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            }
            file = new File([imageData], `generated_${variant}.webp`, { type: imageData.type || 'image/webp' });
            previewUrl = URL.createObjectURL(file);
            pendingImageUrlsRef.current[key] = previewUrl;
        } else if (imageData instanceof ArrayBuffer) {
            const blob = new Blob([imageData], { type: 'image/webp' });
            file = new File([blob], `generated_${variant}.webp`, { type: 'image/webp' });
            previewUrl = URL.createObjectURL(file);
            const key = `${sceneId}-${variant}`;
            if (pendingImageUrlsRef.current[key]) {
                URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            }
            pendingImageUrlsRef.current[key] = previewUrl;
        } else {
            console.error('无效的图片数据类型');
            return;
        }

        const persistedPath = typeof imageData === 'string' && !imageData.startsWith('blob:') && !imageData.startsWith('data:')
            ? imageData
            : undefined;

        // 更新暂存图片
        setPendingImages(prev => ({
            ...prev,
            [sceneId]: {
                ...(prev[sceneId] || {}),
                [variant]: {
                    previewUrl,
                    file,
                    sourceType: file ? 'upload' : 'url',
                    variant,
                    persistedPath,
                }
            }
        }));
        setHasUnsavedChanges(true);
    };

    // 上传图片到服务器
    const uploadImage = async (
        sceneId: string,
        subsceneId?: string,
        variant: string = 'base'
    ): Promise<string | undefined> => {
        const targetId = subsceneId || sceneId;
        const pendingImage = pendingImages[targetId]?.[variant];
        if (!pendingImage?.file) {
            console.warn(`未找到 ${targetId}-${variant} 的暂存图片文件`);
            return undefined;
        }

        const file = pendingImage.file;
        toast.loading('正在存储图片...', { id: 'uploading-image' });

        try {
            let response;
            if (subsceneId && mode === 'worldInteraction') {
                response = await api.uploadSubSceneImage(fileId!, sceneId, subsceneId, file);
            } else {
                response = await api.uploadSceneImage(fileId!, sceneId, file);
            }

            toast.dismiss('uploading-image');

            if (response.data?.success) {
                const serverPath = response.data.imagePath;
                if (serverPath) {
                    return serverPath;
                }
            }
            toast.error('图片存储失败');
            return undefined;
        } catch (error) {
            console.error('存储图片失败:', error);
            toast.dismiss('uploading-image');
            toast.error('图片存储失败，请重试');
            return undefined;
        }
    };

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
    const updateSceneFromResponse = (responseData: any, sceneId: string, preferredImage?: string) => {
        if (mode === 'worldInteraction') {
            const scene = responseData?.data;
            if (scene) {
                const updatedScene: LocalScene = {
                    id: scene.id,
                    name: scene.name || '',
                    type: scene.type || '',
                    desc: scene.description || '',
                    // 保持使用后端给的原始 image（不在本地注入时间戳），展示时再通过 getImageUrl 处理
                    image: preferredImage || scene.image || '',
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
                        image: preferredImage || (scene as any).image || '',
                        bgmId: (scene as any).soundtrack || '',
                    };
                    setSceneData(prev => prev.map(s => s.id === sceneId ? updatedScene : s));
                }
            }
        }
    };

    const bumpExistingSceneImageCache = () => {
        sceneData.forEach((scene) => {
            if (!scene.id.startsWith('temp-') && scene.image) {
                bumpCacheBust(scene.image);
            }
        });
    };

    const setBatchGeneratedPendingImages = (items: Map<string, string>) => {
        if (items.size === 0) return;
        setPendingImages((prev) => {
            const next = { ...prev };
            items.forEach((imagePath, targetId) => {
                const pendingKey = `${targetId}-base`;
                const existingPreviewUrl = pendingImageUrlsRef.current[pendingKey];
                if (existingPreviewUrl?.startsWith('blob:')) {
                    URL.revokeObjectURL(existingPreviewUrl);
                    delete pendingImageUrlsRef.current[pendingKey];
                }
                next[targetId] = {
                    ...(next[targetId] || {}),
                    base: {
                        previewUrl: imagePath,
                        sourceType: 'url',
                        variant: 'base',
                        persistedPath: imagePath,
                    },
                };
            });
            return next;
        });
    };

    const getGeneratedSceneItemId = (item: any): string | undefined => {
        const rawId = item?.id ?? item?.sceneId;
        if (rawId === undefined || rawId === null || rawId === '') return undefined;
        return String(rawId);
    };

    const getGeneratedSubsceneItemId = (item: any): string | undefined => {
        const rawId = item?.id ?? item?.subsceneId;
        if (rawId === undefined || rawId === null || rawId === '') return undefined;
        return String(rawId);
    };

    const applyGeneratedSceneImages = (items: any[]) => {
        if (!Array.isArray(items) || items.length === 0) {
            return {
                count: 0,
                images: {} as Record<string, string>,
            };
        }

        const nextImages = new Map<string, string>();
        items.forEach((item) => {
            const itemId = getGeneratedSceneItemId(item);
            if (item?.success && itemId && item?.imagePath) {
                nextImages.set(itemId, String(item.imagePath));
                bumpCacheBust(String(item.imagePath));
            }
        });

        if (nextImages.size === 0) {
            return {
                count: 0,
                images: {} as Record<string, string>,
            };
        }

        setSceneData(prev =>
            prev.map(scene => {
                const nextImage = nextImages.get(scene.id);
                return nextImage ? { ...scene, image: nextImage } : scene;
            })
        );

        if (activeSceneId) {
            const activeImage = nextImages.get(activeSceneId);
            if (activeImage) {
                setActiveSceneDraft(prev => (
                    prev && prev.id === activeSceneId ? { ...prev, image: activeImage } : prev
                ));
            }
        }

        setBatchGeneratedPendingImages(nextImages);
        return {
            count: nextImages.size,
            images: Object.fromEntries(nextImages),
        };
    };

    const applyGeneratedSubsceneImages = (items: any[]) => {
        if (mode !== 'worldInteraction' || !setSubsceneDataBySceneId || !Array.isArray(items) || items.length === 0) {
            return {
                count: 0,
                images: {} as Record<string, string>,
            };
        }

        const nextImages = new Map<string, string>();
        items.forEach((item) => {
            const itemId = getGeneratedSubsceneItemId(item);
            if (item?.success && itemId && item?.imagePath) {
                nextImages.set(itemId, String(item.imagePath));
                bumpCacheBust(String(item.imagePath));
            }
        });

        if (nextImages.size === 0) {
            return {
                count: 0,
                images: {} as Record<string, string>,
            };
        }

        setSubsceneDataBySceneId(prev => {
            const next: Record<string, any[]> = { ...(prev || {}) };
            Object.entries(next).forEach(([sceneId, subscenes]) => {
                next[sceneId] = (subscenes || []).map((subscene: any) => {
                    const subsceneId = String(subscene?.id || subscene?.name || '');
                    const nextImage = nextImages.get(subsceneId);
                    return nextImage ? { ...subscene, image: nextImage } : subscene;
                });
            });
            return next;
        });

        if (activeSubsceneDraft) {
            const activeImage = nextImages.get(activeSubsceneDraft.id);
            if (activeImage) {
                setActiveSubsceneDraft({ ...activeSubsceneDraft, image: activeImage });
            }
        }

        setBatchGeneratedPendingImages(nextImages);
        return {
            count: nextImages.size,
            images: Object.fromEntries(nextImages),
        };
    };

    // 确认新增场景
    const confirmAddNew = async (options: SaveOptions = {}): Promise<SceneSaveResult> => {
        if (!fileId || !newSceneData) {
            toast.error('缺少必要数据，无法新增场景');
            return { success: false };
        }

        const newSceneId = `scene_${Date.now()}`;
        const shouldShowSuccessToast = !options.suppressSuccessToast;

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
            if (!response.data?.success) {
                toast.error('创建场景失败');
                return { success: false };
            }

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

            if (shouldShowSuccessToast) {
                toast.success('场景创建成功');
            }

            return {
                success: true,
                kind: 'sceneAdd',
                savedScene: createdScene,
            };
        } catch (error) {
            console.error('创建场景时出错:', error);
            toast.error('创建场景失败，请重试');
            return { success: false };
        }
    };

    const confirmEdit = async (
        activeScene: LocalScene | undefined,
        options: SaveOptions = {},
    ): Promise<SceneSaveResult> => {
        if (!fileId || !activeScene) {
            toast.error('缺少必要数据，无法保存修改');
            return { success: false };
        }

        const sceneToSave = activeScene;
        const shouldShowSuccessToast = !options.suppressSuccessToast;

        let imagePath = sceneToSave.image;
        const pendingImage = pendingImages[sceneToSave.id]?.['base'];
        if (pendingImage) {
            if (pendingImage.file) {
                const serverPath = await uploadImage(sceneToSave.id);
                if (serverPath) {
                    imagePath = serverPath;
                } else {
                    return { success: false };
                }
            } else if (pendingImage.persistedPath) {
                imagePath = pendingImage.persistedPath;
            }
            if (imagePath) {
                bumpCacheBust(imagePath);
            }
            setPendingImages(prev => {
                const next = { ...prev };
                delete next[sceneToSave.id];
                return next;
            });
        }

        const sceneDataForApi: ApiScene = {
            id: sceneToSave.id,
            name: sceneToSave.name || '未命名场景',
            type: sceneToSave.type || '',
            description: sceneToSave.desc || '暂无描述',
            image: imagePath || undefined,
            soundtrack: sceneToSave.bgmId || undefined,
            npcs: [],
            events: [],
        };

        try {
            const response = await api.updateScene(fileId, sceneDataForApi);
            if (!response.data?.success) {
                toast.error('更新场景失败');
                return { success: false };
            }

            const updatedScene = { ...sceneToSave, image: imagePath || sceneToSave.image };
            if (shouldShowSuccessToast) {
                toast.success('场景更新成功');
            }
            setSceneData(prev =>
                prev.map(s => (s.id === sceneToSave.id ? { ...s, ...updatedScene } : s))
            );
            setActiveSceneDraft(updatedScene);
            updateSceneFromResponse(response.data, sceneToSave.id, imagePath || sceneToSave.image);
            onDataChange?.();

            return {
                success: true,
                kind: 'sceneEdit',
                savedScene: updatedScene,
            };
        } catch (error) {
            console.error('更新场景时出错:', error);
            toast.error('更新场景失败，请重试');
            return { success: false };
        }
    };

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
    const confirmSubsceneEdit = async (options: SaveOptions = {}): Promise<SceneSaveResult> => {
        if (!fileId || !activeSubsceneDraft || !activeSceneId) {
            toast.error('缺少必要数据，无法保存修改');
            return { success: false };
        }
        if (mode !== 'worldInteraction') {
            toast.error('子场景功能仅在世界交互模式下可用');
            return { success: false };
        }

        const draftToSave = activeSubsceneDraft;
        const previousSubsceneId = draftToSave.id;
        const shouldShowSuccessToast = !options.suppressSuccessToast;

        let imagePath = draftToSave.image;
        const pendingImage = pendingImages[draftToSave.id]?.['base'];
        if (pendingImage) {
            if (pendingImage.file) {
                const serverPath = await uploadImage(activeSceneId, draftToSave.id);
                if (serverPath) {
                    imagePath = serverPath;
                } else {
                    return { success: false };
                }
            } else if (pendingImage.persistedPath) {
                imagePath = pendingImage.persistedPath;
            }
            if (imagePath) {
                bumpCacheBust(imagePath);
            }
            setPendingImages(prev => {
                const next = { ...prev };
                delete next[draftToSave.id];
                return next;
            });
        }

        const subsceneData: any = {
            id: isAddingNewSubscene ? `subscene_${Date.now()}` : draftToSave.id,
            name: draftToSave.name || '未命名子场景',
            description: draftToSave.desc || '',
            image: imagePath || '',
            npcs: [],
            position: [0, 0],
            npcs_slots: [],
        };

        if (!isAddingNewSubscene) {
            const originalScene = getSceneById(gameData as any, activeSceneId);
            const originalSubscene = getSubSceneById(originalScene, draftToSave.id);
            if (originalSubscene && isWorldSubScene(originalSubscene)) {
                subsceneData.npcs = originalSubscene.npcs || [];
                subsceneData.position = originalSubscene.position || [0, 0];
                subsceneData.npcs_slots = originalSubscene.npcs_slots || [];
            }
        }

        try {
            const response = isAddingNewSubscene
                ? await api.addSubScene(fileId, activeSceneId, subsceneData)
                : await api.updateSubScene(fileId, activeSceneId, subsceneData);

            if (!response.data?.success) {
                toast.error(isAddingNewSubscene ? '创建子场景失败' : '更新子场景失败');
                return { success: false };
            }

            if (shouldShowSuccessToast) {
                toast.success(isAddingNewSubscene ? '子场景创建成功' : '子场景更新成功');
            }
            if (setSubsceneDataBySceneId) {
                const savedId = subsceneData.id;
                setSubsceneDataBySceneId(prev => {
                    const current = ((prev || {})[activeSceneId] || []) as any[];
                    const idx = current.findIndex(s => (s.id || s.name) === savedId || (s.id || s.name) === draftToSave.id);
                    const savedSub = idx >= 0 ? { ...current[idx], ...subsceneData } : { ...subsceneData };
                    const next =
                        idx >= 0
                            ? current.map((s, i) => (i === idx ? savedSub : s))
                            : [savedSub, ...current];
                    return { ...(prev || {}), [activeSceneId]: next };
                });
            }
            if (isAddingNewSubscene) {
                setIsAddingNewSubscene(false);
                setActiveSubsceneId(null);
                setActiveSubsceneDraft(null);
            } else {
                setActiveSubsceneDraft({
                    ...draftToSave,
                    image: imagePath || draftToSave.image,
                });
            }
            onDataChange?.();

            return {
                success: true,
                kind: isAddingNewSubscene ? 'subsceneAdd' : 'subsceneEdit',
                sceneId: activeSceneId,
                previousSubsceneId,
                savedSubscene: { ...subsceneData } as WorldSubScene,
            };
        } catch (error) {
            console.error(isAddingNewSubscene ? '创建子场景时出错:' : '更新子场景时出错:', error);
            toast.error(isAddingNewSubscene ? '创建子场景失败，请重试' : '更新子场景失败，请重试');
            return { success: false };
        }
    };

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
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
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
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
                if (setSubsceneDataBySceneId) {
                    setSubsceneDataBySceneId(prev => {
                        const current = ((prev || {})[ids.sceneId] || []) as any[];
                        const next = current.filter(s => (s.id || s.name) !== ids.subsceneId);
                        return { ...(prev || {}), [ids.sceneId]: next };
                    });
                }
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

    // 上传场景/子场景图片（暂存模式）
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

        let targetSceneId = '';
        let targetSubsceneId: string | undefined;

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
            targetSceneId = activeSceneId;
            targetSubsceneId = activeSubsceneId;
        } else {
            targetSceneId = activeSceneId;
        }

        if (!targetSceneId) {
            toast.error('请先选择场景');
            return;
        }

        // 暂存模式：直接设置预览
        const targetId = targetSubsceneId || targetSceneId;
        await setPendingImage(targetId, file);
        toast.success('图片已暂存，请在确认修改后保存');
        setHasUnsavedChanges(true);

        if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
        if (newSceneFileInputRef.current) newSceneFileInputRef.current.value = '';
    };

    // 重新生成单个场景/子场景图片（暂存模式）
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
            const targetId = isSubscene ? scene.id : scene.id;

            if (isSubscene && mode === 'worldInteraction' && activeSceneId) {
                response = await api.generateSubSceneImage(fileId, activeSceneId, scene.id);
            } else {
                response = await api.generateSceneImage({
                    fileId,
                    scene: {
                        id: scene.id,
                        name: scene.name,
                        description: scene.desc,
                    },
                });
            }

            if (response.data?.success) {
                // 优先尝试获取 blob 数据（AI 生成）
                if (response.data.blob) {
                    toast.success('场景图片生成成功，请在确认修改后保存');
                    await setPendingImage(targetId, response.data.blob);
                    await refreshUserPoints();
                } else if (response.data.imagePath) {
                    // 兼容：直接返回路径的情况
                    toast.success('场景图片生成成功，请在确认修改后保存');
                    await setPendingImage(targetId, response.data.imagePath);
                    await refreshUserPoints();
                }
            } else {
                toast.error(response.data?.message || '当前使用人数过多，请稍后再试');
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
        await refreshUserPoints();
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
                    setWorldMapImageOverride(withCacheBust(processedImagePath));
                    // 手动刷新缓存，强制浏览器重新加载图片
                    bumpCacheBust(response.data.imagePath);
                }
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
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
        await refreshUserPoints();
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
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
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
    const applySceneBatchResult = async (payload: any, sceneCostPointsValue: number | null) => {
        const details = payload?.details || null;
        const generatedSceneResult = applyGeneratedSceneImages(details?.scenes || []);
        const generatedSubsceneResult = applyGeneratedSubsceneImages(details?.subscenes || []);
        const generatedSceneCount = generatedSceneResult.count;
        const generatedSubsceneCount = generatedSubsceneResult.count;

        const rawSceneGenerated = Number(
            payload?.scenes?.effective ??
            payload?.results?.scenesSuccess ??
            payload?.results?.scenesGenerated ??
            payload?.results?.scenes ??
            payload?.summary?.totalEffective ??
            payload?.scenesGenerated ??
            generatedSceneCount
        );
        const sceneGenerated = Number.isFinite(rawSceneGenerated) ? Math.max(0, rawSceneGenerated) : generatedSceneCount;

        const rawSceneTotal = Number(
            payload?.scenes?.total ??
            payload?.results?.scenesTotal ??
            payload?.results?.scenes ??
            payload?.summary?.totalRequested ??
            details?.scenes?.length ??
            generatedSceneCount
        );
        const sceneTotal = Number.isFinite(rawSceneTotal) ? Math.max(0, rawSceneTotal) : generatedSceneCount;

        const rawSubsceneGenerated = Number(
            payload?.subscenes?.effective ??
            payload?.results?.subscenesSuccess ??
            payload?.results?.subscenesGenerated ??
            payload?.subscenesGenerated ??
            generatedSubsceneCount
        );
        const subsceneGenerated = Number.isFinite(rawSubsceneGenerated) ? Math.max(0, rawSubsceneGenerated) : generatedSubsceneCount;

        const rawSubsceneTotal = Number(
            payload?.subscenes?.total ??
            payload?.results?.subscenes ??
            details?.subscenes?.length ??
            generatedSubsceneCount
        );
        const subsceneTotal = Number.isFinite(rawSubsceneTotal) ? Math.max(0, rawSubsceneTotal) : generatedSubsceneCount;

        const generatedCount = sceneGenerated + subsceneGenerated;
        const totalCount = sceneTotal + subsceneTotal;

        const pointsDeductedRaw = Number(
            payload?.points?.deducted ??
            payload?.points?.pointsDeducted ??
            payload?.results?.pointsDeducted ??
            sceneCostPointsValue ??
            0
        );
        const pointsDeducted = Number.isFinite(pointsDeductedRaw) ? Math.max(0, pointsDeductedRaw) : 0;

        const remainingPointsRaw =
            payload?.points?.remaining ??
            payload?.points?.remainingPoints ??
            payload?.results?.remainingPoints;
        const remainingPointsValue = Number(remainingPointsRaw);
        const remainingPoints = Number.isFinite(remainingPointsValue)
            ? Math.max(0, remainingPointsValue)
            : undefined;

        setSceneGenerationResult({
            generatedCount,
            totalCount,
            pointsDeducted,
            remainingPoints,
        });
        if (mode !== 'worldInteraction') {
            bumpExistingSceneImageCache();
        }
        markBatchImageRefreshPending?.({
            scenes: generatedSceneResult.images,
            subscenes: generatedSubsceneResult.images,
        });
        try {
            await onDataChange?.();
            if (onDataChange && hasPendingBatchImageRefresh?.()) {
                for (let attempt = 0; attempt < BATCH_IMAGE_REFRESH_RETRY_COUNT; attempt += 1) {
                    await new Promise((resolve) => window.setTimeout(resolve, BATCH_IMAGE_REFRESH_RETRY_DELAY_MS));
                    if (!hasPendingBatchImageRefresh()) {
                        break;
                    }
                    await onDataChange();
                    if (!hasPendingBatchImageRefresh()) {
                        break;
                    }
                }
            }
        } catch (refreshError) {
            console.error('Failed to refresh scene data after batch generation:', refreshError);
        }
        await refreshUserPoints();
        setSceneResultModalOpen(true);
    };

    const generateAllSceneImages = async (sceneCostPoints: number | null) => {
        let lastJobStatus: BatchImageJobStatus | null = null;
        if (!fileId) {
            toast.error('缺少必要数据，无法生成');
            return;
        }
        try {
            setIsGeneratingAllSceneImages(true);
            setSceneBatchJobStatus(null);
            const startResponse: any = await api.startGenerateAllSceneImages(fileId);
            const startPayload: any = startResponse?.data || startResponse;
            const jobId = startPayload?.jobId;
            if (!startPayload?.success || !jobId) {
                toast.error(startPayload?.error || startPayload?.message || 'å½“å‰ä½¿ç”¨äººæ•°è¿‡å¤šï¼Œè¯·ç¨åŽå†è¯•');
                return;
            }
            setSceneBatchJobStatus({
                success: true,
                jobId,
                fileId: startPayload?.fileId ?? fileId,
                status: startPayload?.status ?? 'queued',
                totalCount: Number(startPayload?.totalCount ?? 0),
                completedCount: 0,
                failedCount: 0,
                estimatedRemainingSeconds: null,
            });
            for (let attempt = 0; attempt < 600; attempt += 1) {
                const statusResponse: any = await api.getSceneBatchJobStatus(jobId);
                const statusPayload = statusResponse?.data || statusResponse;
                lastJobStatus = statusPayload as BatchImageJobStatus;
                setSceneBatchJobStatus(lastJobStatus);
                if (!statusPayload?.success) {
                    throw new Error(statusPayload?.error || statusPayload?.message || 'Failed to fetch scene batch job status');
                }
                if (statusPayload.status === 'completed') {
                    const resultResponse: any = await api.getSceneBatchJobResult(jobId);
                    const resultPayload = resultResponse?.data || resultResponse;
                    if (!resultPayload?.success || !resultPayload?.result) {
                        throw new Error(resultPayload?.error || resultPayload?.message || 'Failed to fetch scene batch job result');
                    }
                    await applySceneBatchResult(resultPayload.result, sceneCostPoints);
                    setSceneBatchJobStatus(null);
                    return;
                }
                if (statusPayload.status === 'failed' || statusPayload.status === 'unknown') {
                    throw new Error(statusPayload?.error || statusPayload?.message || 'Scene batch job failed');
                }
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }
            /* legacy synchronous fallback removed in favor of batch job polling
            if (Date.now() < 0) {
            const response = await api.generateAllSceneImages(fileId);
            if (response.data?.success) {
                const respAny: any = response.data;
                const payload = respAny.data || respAny;
                const details = respAny.details || payload?.details || null;
                const generatedSceneCount = applyGeneratedSceneImages(details?.scenes || []);
                const generatedSubsceneCount = applyGeneratedSubsceneImages(details?.subscenes || []);

                const rawSceneGenerated = Number(
                    payload?.scenes?.effective ??
                    payload?.results?.scenesSuccess ??
                    payload?.results?.scenesGenerated ??
                    payload?.results?.scenes ??
                    payload?.summary?.totalEffective ??
                    payload?.scenesGenerated ??
                    generatedSceneCount
                );
                const sceneGenerated = Number.isFinite(rawSceneGenerated) ? Math.max(0, rawSceneGenerated) : generatedSceneCount;

                const rawSceneTotal = Number(
                    payload?.scenes?.total ??
                    payload?.results?.scenesTotal ??
                    payload?.results?.scenes ??
                    payload?.summary?.totalRequested ??
                    details?.scenes?.length ??
                    generatedSceneCount
                );
                const sceneTotal = Number.isFinite(rawSceneTotal) ? Math.max(0, rawSceneTotal) : generatedSceneCount;

                const rawSubsceneGenerated = Number(
                    payload?.subscenes?.effective ??
                    payload?.results?.subscenesSuccess ??
                    payload?.results?.subscenesGenerated ??
                    payload?.subscenesGenerated ??
                    generatedSubsceneCount
                );
                const subsceneGenerated = Number.isFinite(rawSubsceneGenerated) ? Math.max(0, rawSubsceneGenerated) : generatedSubsceneCount;

                const rawSubsceneTotal = Number(
                    payload?.subscenes?.total ??
                    payload?.results?.subscenes ??
                    payload?.results?.subscenesTotal ??
                    payload?.subscenesTotal ??
                    details?.subscenes?.length ??
                    generatedSubsceneCount
                );
                const subsceneTotal = Number.isFinite(rawSubsceneTotal) ? Math.max(0, rawSubsceneTotal) : generatedSubsceneCount;

                const generatedCount = mode === 'worldInteraction'
                    ? sceneGenerated + subsceneGenerated
                    : sceneGenerated;
                const totalCount = mode === 'worldInteraction'
                    ? sceneTotal + subsceneTotal
                    : sceneTotal;

                const pointsDeductedRaw = Number(
                    payload?.points?.deducted ??
                    payload?.results?.pointsDeducted ??
                    sceneCostPoints ??
                    0
                );
                const pointsDeducted = Number.isFinite(pointsDeductedRaw) ? Math.max(0, pointsDeductedRaw) : 0;

                const remainingPointsRaw =
                    payload?.points?.remaining ??
                    payload?.points?.remainingPoints ??
                    payload?.results?.remainingPoints;
                const remainingPointsValue = Number(remainingPointsRaw);
                const remainingPoints = Number.isFinite(remainingPointsValue)
                    ? Math.max(0, remainingPointsValue)
                    : undefined;

                // 弹出结果弹窗
                setSceneGenerationResult({
                    generatedCount,
                    totalCount,
                    pointsDeducted,
                    remainingPoints,
                });
                if (mode !== 'worldInteraction') {
                    bumpExistingSceneImageCache();
                }
                markBatchImageRefreshPending?.();
                try {
                    await onDataChange?.();
                } catch (refreshError) {
                    console.error('Failed to refresh scene data after batch generation:', refreshError);
                }
                await refreshUserPoints();
                setSceneResultModalOpen(true);
            } else {
                toast.error('当前使用人数过多，请稍后再试');
            }
        } catch (error) {
            console.error('生成所有场景立绘时出错:', error);
            toast.error('生成所有场景立绘失败，请检查网络连接');
            }
            }
            throw new Error('Scene batch job polling timed out');
            */
            throw new Error('Scene batch job polling timed out');
        } finally {
            setIsGeneratingAllSceneImages(false);
            if (!lastJobStatus || ['queued', 'running', 'pending'].includes(String(lastJobStatus.status || ''))) {
                setSceneBatchJobStatus(null);
            }
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
        await refreshUserPoints();
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

        // 图片上传 / 生图（暂存模式）
        setPendingImage,
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
