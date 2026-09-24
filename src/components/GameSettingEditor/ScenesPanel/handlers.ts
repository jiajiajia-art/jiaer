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
import {
    BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS,
    resolveBatchImageJobPollStep,
} from '../../../utils/batchImageJobPoll';
import {
    countBatchNpcBoardFailures,
    isBatchNpcBoardSettled,
    isBatchSceneBoardAllSuccess,
} from '../../../utils/batchNpcBoardSettlement';

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
    t?: (key: string) => string;

    // 必要的 state getters
    activeSceneId: string;
    activeSceneDraft: LocalScene | null;
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
    /** 用户点击取消时置为 true，轮询循环据此提前退出 */
    sceneBatchGenerationCancelRef: React.MutableRefObject<boolean>;
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
        activeSceneDraft,
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
        sceneBatchGenerationCancelRef,
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
        variant: string = 'base',
        overrideFile?: File
    ): Promise<string | undefined> => {
        const targetId = subsceneId || sceneId;
        const pendingImage = pendingImages[targetId]?.[variant];
        const file = overrideFile || pendingImage?.file;
        if (!file) {
            console.warn(`未找到 ${targetId}-${variant} 的暂存图片文件`);
            return undefined;
        }

        toast.loading(ctx.t?.('createGame.storingImage') || '正在存储图片...', { id: 'uploading-image' });

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
            toast.error(ctx.t?.('createGame.imageStoreFailed') || '图片存储失败');
            return undefined;
        } catch (error) {
            console.error('存储图片失败:', error);
            toast.dismiss('uploading-image');
            toast.error(ctx.t?.('createGame.imageStoreFailedRetry') || '图片存储失败，请重试');
            return undefined;
        }
    };

    // 更新场景字段（本地）
    const persistSceneEdit = async (
        sceneToSave: LocalScene,
        imagePath: string | undefined,
        options: SaveOptions = {},
    ): Promise<SceneSaveResult> => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingDataCannotSave') || '缺少必要数据，无法保存修改');
            return { success: false };
        }

        const shouldShowSuccessToast = !options.suppressSuccessToast;
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
                toast.error(ctx.t?.('createGame.updateSceneFailed') || '更新场景失败');
                return { success: false };
            }

            const updatedScene = { ...sceneToSave, image: imagePath || sceneToSave.image };
            if (shouldShowSuccessToast) {
                toast.success(ctx.t?.('createGame.sceneUpdateSuccess') || '场景更新成功');
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
            toast.error(ctx.t?.('createGame.updateSceneFailedRetry') || '更新场景失败，请重试');
            return { success: false };
        }
    };

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
            toast.error(ctx.t?.('createGame.missingDataCannotAddScene') || '缺少必要数据，无法新增场景');
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
                toast.error(ctx.t?.('createGame.createSceneFailed') || '创建场景失败');
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
                toast.success(ctx.t?.('createGame.sceneCreateSuccess') || '场景创建成功');
            }

            return {
                success: true,
                kind: 'sceneAdd',
                savedScene: createdScene,
            };
        } catch (error) {
            console.error('创建场景时出错:', error);
            toast.error(ctx.t?.('createGame.createSceneFailedRetry') || '创建场景失败，请重试');
            return { success: false };
        }
    };

    const confirmEdit = async (
        activeScene: LocalScene | undefined,
        options: SaveOptions = {},
    ): Promise<SceneSaveResult> => {
        if (!fileId || !activeScene) {
            toast.error(ctx.t?.('createGame.missingDataCannotSave') || '缺少必要数据，无法保存修改');
            return { success: false };
        }

        const sceneToSave = activeScene;

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

        return persistSceneEdit(sceneToSave, imagePath, options);
    };

    const clearPendingSceneImageState = (sceneId: string) => {
        const pendingKey = `${sceneId}-base`;
        const pendingUrl = pendingImageUrlsRef.current[pendingKey];
        if (pendingUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(pendingUrl);
        }
        delete pendingImageUrlsRef.current[pendingKey];

        setPendingImages((prev) => {
            if (!prev[sceneId]) {
                return prev;
            }
            const next = { ...prev };
            delete next[sceneId];
            return next;
        });
    };

    const clearSceneImageImmediately = async (sceneId: string): Promise<LocalScene | null> => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingDataCannotClear') || '缺少必要数据，无法清空场景图');
            return null;
        }
        if (mode !== 'visual') {
            toast.error(ctx.t?.('createGame.currentModeNotSupport') || '当前模式不支持清空场景图');
            return null;
        }

        const persistedScene = sceneData.find((scene) => scene.id === sceneId);
        if (!persistedScene) {
            toast.error(ctx.t?.('createGame.currentSceneNotFound') || '未找到当前场景');
            return null;
        }

        if (!persistedScene.image) {
            clearPendingSceneImageState(sceneId);
            const clearedScene = { ...persistedScene, image: '' };
            setSceneData((prev) => prev.map((scene) => (
                scene.id === sceneId ? clearedScene : scene
            )));
            setActiveSceneDraft((prev) => (
                prev && prev.id === sceneId ? { ...prev, image: '' } : prev
            ));
            toast.success(ctx.t?.('createGame.sceneImageCleared') || '场景图已清空');
            return clearedScene;
        }

        const sceneDataForApi: ApiScene = {
            id: persistedScene.id,
            name: persistedScene.name || '未命名场景',
            type: persistedScene.type || '',
            description: persistedScene.desc || '暂无描述',
            image: '',
            soundtrack: persistedScene.bgmId || undefined,
            npcs: [],
            events: [],
        };

        try {
            const response = await api.updateScene(fileId, sceneDataForApi);
            if (!response.data?.success) {
                toast.error(ctx.t?.('createGame.clearSceneImageFailed') || '清空场景图失败');
                return null;
            }

            clearPendingSceneImageState(sceneId);

            const clearedScene = { ...persistedScene, image: '' };
            setSceneData((prev) => prev.map((scene) => (
                scene.id === sceneId ? clearedScene : scene
            )));
            setActiveSceneDraft((prev) => (
                prev && prev.id === sceneId ? { ...prev, image: '' } : prev
            ));
            onDataChange?.();
            toast.success(ctx.t?.('createGame.sceneImageCleared') || '场景图已清空');
            return clearedScene;
        } catch (error) {
            console.error('清空场景图时出错:', error);
            toast.error(ctx.t?.('createGame.clearSceneImageFailedRetry') || '清空场景图失败，请稍后重试');
            return null;
        }
    };

    const openAddNewSubscene = () => {
        if (!activeSceneId) {
            toast.error(ctx.t?.('createGame.selectParentScene') || '请先选择一个父场景');
            return;
        }
        if (mode !== 'worldInteraction') {
            toast.error(ctx.t?.('createGame.subSceneOnlyWorldInteraction') || '子场景功能仅在世界交互模式下可用');
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
            toast.error(ctx.t?.('createGame.missingDataCannotSave') || '缺少必要数据，无法保存修改');
            return { success: false };
        }
        if (mode !== 'worldInteraction') {
            toast.error(ctx.t?.('createGame.subSceneOnlyWorldInteraction') || '子场景功能仅在世界交互模式下可用');
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
                toast.error(ctx.t?.('createGame.sceneDeleteSuccess') ? `${ctx.t('createGame.sceneDeleteSuccess')} (${isAddingNewSubscene ? ctx.t('createGame.createSubSceneFailed') : ctx.t('createGame.updateSubSceneFailed')})` : (isAddingNewSubscene ? '创建子场景失败' : '更新子场景失败'));
                return { success: false };
            }

            if (shouldShowSuccessToast) {
                toast.success(isAddingNewSubscene ? (ctx.t?.('createGame.subSceneCreateSuccess') || '子场景创建成功') : (ctx.t?.('createGame.subSceneUpdateSuccess') || '子场景更新成功'));
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
            toast.error(isAddingNewSubscene ? (ctx.t?.('createGame.createSubSceneFailedRetry') || '创建子场景失败，请重试') : (ctx.t?.('createGame.updateSubSceneFailedRetry') || '更新子场景失败，请重试'));
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
                toast.success(ctx.t?.('createGame.sceneDeleteSuccess') || '场景删除成功');
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
            } else {
                toast.error(ctx.t?.('createGame.deleteSceneFailed') || '删除场景失败');
            }
        } catch (error) {
            console.error('删除场景时出错:', error);
            toast.error(ctx.t?.('createGame.deleteSceneFailedRetry') || '删除场景失败，请重试');
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
            toast.error(ctx.t?.('createGame.subSceneOnlyWorldInteraction') || '子场景功能仅在世界交互模式下可用');
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
                toast.success(ctx.t?.('createGame.subSceneDeleteSuccess') || '子场景删除成功');
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
                if (setSubsceneDataBySceneId) {
                    setSubsceneDataBySceneId(prev => {
                        const current = ((prev || {})[ids.sceneId] || []) as any[];
                        const next = current.filter(s => (s.id || s.name) !== ids.subsceneId);
                        return { ...(prev || {}), [ids.sceneId]: next };
                    });
                }
            } else {
                toast.error(ctx.t?.('createGame.deleteSubSceneFailed') || '删除子场景失败');
            }
        } catch (error) {
            console.error('删除子场景时出错:', error);
            toast.error(ctx.t?.('createGame.deleteSubSceneFailedRetry') || '删除子场景失败，请重试');
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
            toast.error(ctx.t?.('createGame.confirmAddSceneFirst') || '请先确认新增场景，然后再上传图片');
            return;
        }
        if (isAddingNewSubscene && activeSubsceneId && activeSubsceneId.startsWith('temp-')) {
            toast.error(ctx.t?.('createGame.confirmAddSubSceneFirst') || '请先确认新增子场景，然后再上传图片');
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
            toast.error(ctx.t?.('createGame.selectImageFile') || '请选择图片文件');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(ctx.t?.('createGame.imageSizeTooLarge') || '图片大小不能超过 5MB');
            return;
        }

        let targetSceneId = '';
        let targetSubsceneId: string | undefined;

        if (isAddingNew && newSceneData) {
            toast.error(ctx.t?.('createGame.confirmAddSceneFirst') || '请先确认新增场景，然后再上传图片');
            if (newSceneFileInputRef.current) newSceneFileInputRef.current.value = '';
            if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
            return;
        } else if (activeSubsceneId && activeSubsceneDraft) {
            if (mode !== 'worldInteraction') {
                toast.error(ctx.t?.('createGame.subSceneOnlyWorldInteraction') || '子场景功能仅在世界交互模式下可用');
                return;
            }
            if (!activeSubsceneId) {
                toast.error(ctx.t?.('createGame.missingSubSceneIdCannotUpload') || '缺少子场景ID，无法上传');
                return;
            }
            if (isAddingNewSubscene && activeSubsceneId.startsWith('temp-')) {
                toast.error(ctx.t?.('createGame.confirmAddSubSceneFirst') || '请先确认新增子场景，然后再上传图片');
                if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
                return;
            }
            targetSceneId = activeSceneId;
            targetSubsceneId = activeSubsceneId;
        } else {
            targetSceneId = activeSceneId;
        }

        if (!targetSceneId) {
            toast.error(ctx.t?.('createGame.selectSceneFirst') || '请先选择场景');
            return;
        }

        // 暂存模式：直接设置预览
        const targetId = targetSubsceneId || targetSceneId;
        await setPendingImage(targetId, file);
        toast.success(ctx.t?.('createGame.imageStagedSaveLater') || '图片已暂存，请在确认修改后保存');
        setHasUnsavedChanges(true);

        if (sceneFileInputRef.current) sceneFileInputRef.current.value = '';
        if (newSceneFileInputRef.current) newSceneFileInputRef.current.value = '';
    };

    // 重新生成单个场景/子场景图片（暂存模式）
    const doRegenerateSceneImage = async (scene: LocalScene): Promise<SceneSaveResult | null> => {
        if (!fileId || !scene) return null;

        const isSubscene = !!(activeSubsceneId && activeSubsceneDraft && scene.id === activeSubsceneDraft.id);
        const shouldAutoSaveVisualScene = mode === 'visual' && !isSubscene;

        if (isAddingNew && newSceneData && scene.id === newSceneData.id) {
            toast.error(ctx.t?.('createGame.generateImageFirstScene') || '请先确认新增场景，然后再生成图片');
            return null;
        }
        if (isAddingNewSubscene && scene.id.startsWith('temp-')) {
            toast.error(ctx.t?.('createGame.confirmAddSubSceneFirst') || '请先确认新增子场景，然后再生成图片');
            return null;
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
                    if (shouldAutoSaveVisualScene) {
                        const generatedBlob = response.data.blob as Blob;
                        const generatedFile = new File([generatedBlob], `generated_${targetId}.webp`, {
                            type: generatedBlob.type || 'image/webp',
                        });
                        const sceneDraftToSave = activeSceneDraft && activeSceneDraft.id === scene.id
                            ? activeSceneDraft
                            : scene;

                        await setPendingImage(targetId, generatedBlob);
                        const serverPath = await uploadImage(scene.id, undefined, 'base', generatedFile);
                        if (!serverPath) {
                            await refreshUserPoints();
                            return { success: false };
                        }

                        bumpCacheBust(serverPath);
                        await setPendingImage(targetId, serverPath);

                        const saveResult = await persistSceneEdit(sceneDraftToSave, serverPath);
                        await refreshUserPoints();

                        if (saveResult.success) {
                            clearPendingSceneImageState(targetId);
                            return saveResult;
                        }

                        return { success: false };
                    }
                    toast.success(ctx.t?.('createGame.sceneImageGeneratedSaveLater') || '场景图片生成成功，请在确认修改后保存');
                    await setPendingImage(targetId, response.data.blob);
                    await refreshUserPoints();
                } else if (response.data.imagePath) {
                    if (shouldAutoSaveVisualScene) {
                        const imagePath = response.data.imagePath as string;
                        const sceneDraftToSave = activeSceneDraft && activeSceneDraft.id === scene.id
                            ? activeSceneDraft
                            : scene;

                        bumpCacheBust(imagePath);
                        await setPendingImage(targetId, imagePath);

                        const saveResult = await persistSceneEdit(sceneDraftToSave, imagePath);
                        await refreshUserPoints();

                        if (saveResult.success) {
                            clearPendingSceneImageState(targetId);
                            return saveResult;
                        }

                        return { success: false };
                    }
                    // 兼容：直接返回路径的情况
                    toast.success(ctx.t?.('createGame.sceneImageGeneratedSaveLater') || '场景图片生成成功，请在确认修改后保存');
                    await setPendingImage(targetId, response.data.imagePath);
                    await refreshUserPoints();
                }
            } else {
                toast.error(response.data?.message || '当前使用人数过多，请稍后再试');
            }
            return null;
        } catch (error) {
            console.error('重新生成场景图片时出错:', error);
            toast.error(ctx.t?.('createGame.regenerateSceneImageFailed') || '重新生成场景图片失败，请重试');
            return { success: false };
        } finally {
            setIsGeneratingSingleSceneImage(false);
            setGeneratingSceneId(null);
        }
    };

    const handleRequestRegenerateSceneImage = (scene: LocalScene) => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingDataCannotGenerate') || '缺少必要数据，无法生成');
            return;
        }
        pendingSceneForGenerate = scene;
        onSingleSceneCostModalOpen();
    };

    const confirmSingleSceneGenerate = async (): Promise<SceneSaveResult | null> => {
        if (!pendingSceneForGenerate) return null;
        const target = pendingSceneForGenerate;
        pendingSceneForGenerate = null;
        return doRegenerateSceneImage(target);
    };

    const cancelSingleSceneGenerate = () => {
        pendingSceneForGenerate = null;
    };

    // 大地图生成 & 上传
    const doGenerateWorldMap = async () => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingFileIdCannotGenerate') || '缺少文件 ID，无法生成大地图');
            return;
        }
        try {
            setIsGeneratingWorldMap(true);
            const response = await api.generateWorldMapImage(fileId);
            if (response.data.success) {
                toast.success(ctx.t?.('createGame.mapGenerateSuccess') || '大地图生成成功');
                if (response.data.imagePath) {
                    const processedImagePath = getImageUrl(response.data.imagePath);
                    setWorldMapImageOverride(withCacheBust(processedImagePath));
                    // 手动刷新缓存，强制浏览器重新加载图片
                    bumpCacheBust(response.data.imagePath);
                }
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
            } else {
                toast.error(ctx.t?.('createGame.serverBusy') || '当前使用人数过多，请稍后再试');
            }
        } catch (error: any) {
            console.error('生成大地图失败:', error);
            toast.error(ctx.t?.('createGame.generateMapFailed') || '生成大地图失败：请检查网络连接');
        } finally {
            setIsGeneratingWorldMap(false);
        }
    };

    const handleRequestGenerateWorldMap = () => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingFileIdCannotGenerate') || '缺少文件 ID，无法生成大地图');
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
            toast.error(ctx.t?.('createGame.missingFileIdCannotUpload') || '缺少文件 ID，无法上传大地图');
            return;
        }
        try {
            const response = await api.setWorldMapImage(fileId, file);
            if (response.data?.success) {
                toast.success(ctx.t?.('createGame.mapUploadSuccess') || '大地图上传成功');
                if (response.data.imagePath) {
                    const processedImagePath = getImageUrl(response.data.imagePath);
                    setWorldMapImageOverride(processedImagePath);
                }
                // 不在此处触发全量刷新（避免确认后立刻刷新 document）
            } else {
                toast.error(ctx.t?.('createGame.mapUploadFailed') || '大地图上传失败，请稍后重试');
            }
        } catch (error: any) {
            console.error('上传大地图失败:', error);
            toast.error(ctx.t?.('createGame.mapUploadFailedError') || '上传大地图失败：' + (error.message || '请检查网络连接'));
        } finally {
            if (worldMapFileInputRef.current) {
                worldMapFileInputRef.current.value = '';
            }
        }
    };

    // 批量生成场景立绘 + 积分试算
    const applySceneBatchResult = async (payload: any, _sceneCostPointsValue: number | null) => {
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
            0
        );
        // 一张都没成功：强制 0；禁止用确认弹窗预估冒充已扣费
        const pointsDeducted = generatedCount > 0 && Number.isFinite(pointsDeductedRaw)
            ? Math.max(0, pointsDeductedRaw)
            : 0;

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

    const generateAllSceneImages = async (
        sceneCostPoints: number | null,
        sceneIds?: string[],
    ) => {
        let lastJobStatus: BatchImageJobStatus | null = null;
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingDataCannotGenerate') || '缺少必要数据，无法生成');
            return;
        }
        const bootstrapTotal = Array.isArray(sceneIds) && sceneIds.length > 0
            ? sceneIds.length
            : Math.max(0, Number(ctx.sceneData?.length || 0));
        try {
            sceneBatchGenerationCancelRef.current = false;
            setIsGeneratingAllSceneImages(true);
            setSceneBatchJobStatus({
                success: true,
                jobId: '',
                fileId,
                status: 'queued',
                totalCount: bootstrapTotal,
                completedCount: 0,
                failedCount: 0,
                estimatedRemainingSeconds: null,
                items: (Array.isArray(sceneIds) && sceneIds.length > 0
                    ? sceneIds.map((id, index) => {
                        const found = ctx.sceneData.find((s) => String(s.id) === String(id));
                        return {
                            index,
                            id,
                            name: found?.name || id,
                            stage: 'pending',
                            stageElapsedSeconds: 0,
                        };
                    })
                    : ctx.sceneData.map((s, index) => ({
                        index,
                        id: s.id,
                        name: s.name,
                        stage: 'pending',
                        stageElapsedSeconds: 0,
                    }))) as any,
                logs: [],
                stageStats: {
                    generateActive: 0,
                    generateDone: 0,
                    rembgActive: 0,
                    rembgDone: 0,
                    failed: 0,
                    pending: bootstrapTotal,
                    total: bootstrapTotal,
                },
            } as BatchImageJobStatus);

            const startResponse: any = await api.startGenerateAllSceneImages(fileId, sceneIds);
            const startPayload: any = startResponse?.data || startResponse;
            const jobId = startPayload?.jobId;
            if (!startPayload?.success || !jobId) {
                toast.error(startPayload?.error || startPayload?.message || '当前使用人数过多，请稍后再试');
                setSceneBatchJobStatus(null);
                return;
            }
            if (startPayload?.slicedScenes !== true && ctx.mode === 'visual') {
                console.warn('[SceneBatch] start missing slicedScenes=true', startPayload);
            }
            setSceneBatchJobStatus((prev) => ({
                ...(prev || {}),
                success: true,
                jobId,
                fileId: startPayload?.fileId ?? fileId,
                status: startPayload?.status ?? 'running',
                totalCount: Number(startPayload?.totalCount ?? bootstrapTotal) || bootstrapTotal,
                completedCount: 0,
                failedCount: 0,
                estimatedRemainingSeconds: null,
            } as BatchImageJobStatus));

            for (let attempt = 0; attempt < BATCH_IMAGE_JOB_MAX_POLL_ATTEMPTS; attempt += 1) {
                const pollStep = resolveBatchImageJobPollStep({
                    cancelRequested: sceneBatchGenerationCancelRef.current,
                    status: '',
                    attempt,
                });
                if (pollStep === 'cancelled') {
                    return;
                }
                if (pollStep === 'timeout') {
                    break;
                }

                const statusResponse: any = await api.getSceneBatchJobStatus(jobId);
                const statusPayload = statusResponse?.data || statusResponse;
                lastJobStatus = statusPayload as BatchImageJobStatus;
                setSceneBatchJobStatus(lastJobStatus);
                if (!statusPayload?.success) {
                    throw new Error(statusPayload?.error || statusPayload?.message || 'Failed to fetch scene batch job status');
                }

                const totalForSettle = Number(statusPayload?.totalCount) || 0;
                const boardSettledWithFailures = isBatchNpcBoardSettled(
                    statusPayload?.items,
                    totalForSettle,
                ) && countBatchNpcBoardFailures(statusPayload?.items) > 0;
                const statusStep = resolveBatchImageJobPollStep({
                    cancelRequested: sceneBatchGenerationCancelRef.current,
                    status: String(statusPayload.status || ''),
                    attempt,
                    boardSettledWithFailures,
                });
                if (statusStep === 'cancelled') {
                    return;
                }
                if (statusStep === 'board_settled_retry') {
                    setSceneBatchJobStatus((prev) => {
                        if (!prev) return lastJobStatus;
                        return { ...prev, ...lastJobStatus, status: 'failed' };
                    });
                    return;
                }
                if (statusStep === 'failed') {
                    throw new Error(statusPayload?.error || statusPayload?.message || 'Scene batch job failed');
                }
                if (statusStep === 'timeout') {
                    break;
                }
                const boardAllSuccess = isBatchSceneBoardAllSuccess(
                    statusPayload?.items,
                    totalForSettle,
                );
                // 分项已全成功：先软拉 result（running 时接口会 400，禁止当整批失败 toast）
                if (statusPayload.status === 'completed' || boardAllSuccess) {
                    let resultPayload: any = null;
                    try {
                        const resultResponse: any = await api.getSceneBatchJobResult(jobId);
                        resultPayload = resultResponse?.data || resultResponse;
                    } catch (resultError: any) {
                        const httpStatus = Number(resultError?.response?.status) || 0;
                        const body = resultError?.response?.data;
                        // A/B：400 Job not completed yet → 继续轮询，绝不 toast「网络失败」
                        if (httpStatus === 400 || body?.status === 'running' || /not completed/i.test(String(body?.error || ''))) {
                            resultPayload = { success: false, status: body?.status || 'running', pending: true };
                        } else if (statusPayload.status === 'completed') {
                            throw resultError;
                        } else {
                            resultPayload = { success: false, pending: true };
                        }
                    }
                    if (resultPayload?.success && resultPayload?.result) {
                        await applySceneBatchResult(resultPayload.result, sceneCostPoints);
                        setSceneBatchJobStatus(null);
                        return;
                    }
                    // result 未就绪：用 status.savedResults 先落地图片，再等 completed 补积分弹窗
                    if (boardAllSuccess) {
                        const saved = Array.isArray(statusPayload?.savedResults)
                            ? statusPayload.savedResults
                            : [];
                        if (saved.length > 0) {
                            const sceneDetails = saved
                                .filter((row: any) => row?.imagePath)
                                .map((row: any) => ({
                                    id: row.id,
                                    name: row.name,
                                    imagePath: row.imagePath,
                                    success: true,
                                }));
                            if (sceneDetails.length > 0) {
                                applyGeneratedSceneImages(sceneDetails);
                            }
                        }
                        if (statusPayload.status === 'completed') {
                            throw new Error(resultPayload?.error || resultPayload?.message || 'Failed to fetch scene batch job result');
                        }
                        // 继续短轮询等 finalize 写入 result
                    }
                }
                await new Promise((resolve) => window.setTimeout(resolve, 1500));
            }
            // 超时前若分项已全成功：用最后一次 status 收尾，禁止误报网络失败
            if (lastJobStatus && isBatchSceneBoardAllSuccess(
                lastJobStatus.items,
                Number(lastJobStatus.totalCount) || 0,
            )) {
                const saved = Array.isArray(lastJobStatus.savedResults) ? lastJobStatus.savedResults : [];
                const sceneDetails = saved
                    .filter((row: any) => row?.imagePath)
                    .map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        imagePath: row.imagePath,
                        success: true,
                    }));
                if (sceneDetails.length > 0) {
                    await applySceneBatchResult({
                        success: true,
                        message: 'Scene images ready (result pending finalize)',
                        scenes: { total: sceneDetails.length, effective: sceneDetails.length },
                        details: { scenes: sceneDetails },
                        points: { deducted: 0, remaining: null },
                        results: {
                            scenes: sceneDetails.length,
                            scenesTotal: sceneDetails.length,
                            pointsDeducted: 0,
                        },
                    }, sceneCostPoints);
                    setSceneBatchJobStatus(null);
                    return;
                }
            }
            throw new Error('Scene batch job polling timed out');
        } catch (error) {
            if (sceneBatchGenerationCancelRef.current) {
                return;
            }
            // 分项已全成功时的 /result 400 不应再弹「请检查网络连接」
            if (lastJobStatus && isBatchSceneBoardAllSuccess(
                lastJobStatus.items,
                Number(lastJobStatus.totalCount) || 0,
            )) {
                console.warn('[SceneBatch] board all success; suppress network-fail toast', error);
                try {
                    const saved = Array.isArray(lastJobStatus.savedResults) ? lastJobStatus.savedResults : [];
                    const sceneDetails = saved
                        .filter((row: any) => row?.imagePath)
                        .map((row: any) => ({
                            id: row.id,
                            name: row.name,
                            imagePath: row.imagePath,
                            success: true,
                        }));
                    if (sceneDetails.length > 0) {
                        await applySceneBatchResult({
                            success: true,
                            scenes: { total: sceneDetails.length, effective: sceneDetails.length },
                            details: { scenes: sceneDetails },
                            points: { deducted: 0, remaining: null },
                            results: {
                                scenes: sceneDetails.length,
                                scenesTotal: sceneDetails.length,
                                pointsDeducted: 0,
                            },
                        }, sceneCostPoints);
                    }
                    setSceneBatchJobStatus(null);
                    return;
                } catch {
                    /* fall through */
                }
            }
            console.error('生成所有场景立绘时出错:', error);
            toast.error(ctx.t?.('createGame.generateAllSceneImageFailed') || '生成所有场景立绘失败，请检查网络连接');
        } finally {
            setIsGeneratingAllSceneImages(false);
            if (sceneBatchGenerationCancelRef.current) {
                setSceneBatchJobStatus(null);
            } else {
                // 失败/未终态保留看板；全成功必须关弹窗。
                // 注意：success 路径已 set null 时，禁止再用 lastJobStatus 写回去。
                setSceneBatchJobStatus((prev) => {
                    const snap = prev || lastJobStatus;
                    if (!snap) return null;
                    const items = Array.isArray(snap.items) ? snap.items : [];
                    const total = Math.max(0, Number(snap.totalCount) || items.length || 0);
                    if (isBatchSceneBoardAllSuccess(items, total)) {
                        return null;
                    }
                    if (!prev) {
                        // 已被显式清空且非全成功：保持关闭
                        return null;
                    }
                    const status = String(prev.status || '');
                    if (status === 'queued' || status === 'running' || status === 'pending') {
                        return { ...prev, status: 'failed' };
                    }
                    return prev;
                });
            }
            sceneBatchGenerationCancelRef.current = false;
        }
    };

    /** 停止前端轮询并关闭进度遮罩；服务端任务可能仍在后台执行 */
    const cancelGenerateAllSceneImages = () => {
        if (!sceneBatchGenerationCancelRef.current) {
            sceneBatchGenerationCancelRef.current = true;
            setIsGeneratingAllSceneImages(false);
            setSceneBatchJobStatus(null);
            toast(ctx.t?.('createGame.batchSceneGenerationCancelled') || '已取消场景立绘生成');
        } else {
            setSceneBatchJobStatus(null);
        }
    };

    const dismissSceneBatchProgress = () => {
        setIsGeneratingAllSceneImages(false);
        setSceneBatchJobStatus(null);
    };

    const continueFailedBatchSceneImages = async (sceneIds: string[]) => {
        const ids = [...new Set((sceneIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
        if (ids.length === 0) {
            toast.error(ctx.t?.('createGame.selectScenesToGenerate') || '请先选择要重试的场景');
            return;
        }
        await generateAllSceneImages(null, ids);
        await refreshUserPoints();
    };

    const openSceneCostModal = async () => {
        if (!fileId) {
            toast.error(ctx.t?.('createGame.missingDataCannotGenerate') || '缺少必要数据，无法生成');
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
            toast.error(ctx.t?.('createGame.getPointsCostFailed') || '获取织梦豆消耗失败，请稍后重试');
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
        clearSceneImageImmediately,
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
        cancelGenerateAllSceneImages,
        dismissSceneBatchProgress,
        continueFailedBatchSceneImages,
    };
};
