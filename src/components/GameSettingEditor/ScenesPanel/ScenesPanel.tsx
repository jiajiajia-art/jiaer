import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import styles from './ScenesPanel.module.css';
import { getImageUrl, getMusicUrlWithHost, LEGACY_WORLD_SCENE_GENERATION_COST } from '../../../utils/constants';
import { useImageBusinessPrice } from '../../../hooks/useImageBusinessPrice';
import type { AllGameData, BatchImageJobStatus } from '../../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../../api/worldInteraction/worldInteractionApi.type';
import type { SceneSetting as VisualSceneSetting } from '../../../api/galgame/EditorData.type';
import type { SceneSetting as WorldSceneSetting } from '../../../api/worldInteraction/worldInteractionApi.type';
import { 
    getScenes, 
    getSceneById, 
    isWorldScene,
    type WorldSubScene
} from '../editorCompat';
import { createSceneApiHelpers } from './apiHelpers';
import {
    createSceneHandlers,
    type BatchImageReconciliationPayload,
    type LocalScene as HandlerLocalScene,
    type SceneSaveResult,
} from './handlers';
import SceneDetailForm from './SceneDetailForm';
import SceneList from './SceneList';
import WorldMapCard from './WorldMapCard';
import SceneDetailActions from './SceneDetailActions';
import { DEFAULT_WORLD_MAP_IMAGE } from '../../../utils/constants';
import { withCacheBust, extractImageExtension } from '../../../utils/imageCache';
import { useAuthStore } from '../../../store/useAuthStore';
import { HOST_ADDRESS } from '../../../config';
import SaveConfirmModal from '../../CommonModal/SaveConfirmModal';
import MusicList, { type MusicItem } from '../UploadMusic/MusicList';
import UploadMusicModal from '../UploadMusic/UploadMusicModal';
import ConfirmModal from '../../CommonModal/ConfirmModal';
import GenerateResultModal from '../../CommonModal/GenerateResultModal';
import { useGenerationEta } from '../../../hooks/editor/useGenerationEta';
import GenerationActionBar from '../GenerationActionBar';
import PortraitLightbox from '../CharactersPanel/PortraitLightbox';
import CurrencyIcon from '../../CurrencyIcon';
import { authFetch } from '../../../api/base';
import {
    isBatchSceneBoardAllSuccess,
    listBatchNpcRetryTargetItems,
    resolveRetryCharacterIdsFromBoard,
    shouldShowBatchProgressOverlay,
    shouldShowRetryIncompleteBatchTasks,
} from '../../../utils/batchNpcBoardSettlement';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

const SINGLE_SCENE_ETA_SECONDS = 100;
const BATCH_SCENE_BUFFER_SECONDS = 60;

/**
 * 暂存图片类型 - 用于图片选择/生成后、确认修改前的预览
 */
interface PendingImage {
    file?: File;                    // 待上传的文件
    previewUrl: string;            // 本地预览 URL
    sourceType: 'upload' | 'generate' | 'url'; // 来源类型
    variant: string;                // 图片类型：'base'
    persistedPath?: string;
}

type LocalScene = HandlerLocalScene;
const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface ScenesPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void | Promise<void>;
    mode?: string;
}

export interface ScenesPanelRef {
    checkBeforeLeave: (action?: () => void) => boolean;
}

interface SceneFieldDirtyState {
    name: boolean;
    desc: boolean;
}

const EMPTY_SCENE_FIELD_DIRTY_STATE: SceneFieldDirtyState = {
    name: false,
    desc: false,
};

const ScenesPanel = React.forwardRef<ScenesPanelRef, ScenesPanelProps>(({ 
    gameData, 
    fileId, 
    onGetData, 
    onDataChange, 
    mode = 'visual',
}, ref) => {
    const { t } = useTranslation();
    const { estimatedPoints: dynamicScenePrice } = useImageBusinessPrice(
        mode === 'worldInteraction' ? null : 'visual_scene',
        fileId,
    );
    const scenePrice = mode === 'worldInteraction'
        ? LEGACY_WORLD_SCENE_GENERATION_COST
        : dynamicScenePrice;
    const [activeSceneId, setActiveSceneId] = useState<string>('');
    const [activeSubsceneId, setActiveSubsceneId] = useState<string | null>(null);
    const [activeSubsceneDraft, setActiveSubsceneDraft] = useState<LocalScene | null>(null);
    const [activeSceneDraft, setActiveSceneDraft] = useState<LocalScene | null>(null);
    const [sceneData, setSceneData] = useState<LocalScene[]>([]);
    const [subsceneDataBySceneId, setSubsceneDataBySceneId] = useState<Record<string, WorldSubScene[]>>({});
    
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newSceneData, setNewSceneData] = useState<LocalScene | null>(null);
    const [isAddingNewSubscene, setIsAddingNewSubscene] = useState<boolean>(false);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [subsceneDeleteModalOpen, setSubsceneDeleteModalOpen] = useState<boolean>(false);
    const [sceneCostModalOpen, setSceneCostModalOpen] = useState<boolean>(false);
    const [singleSceneCostModalOpen, setSingleSceneCostModalOpen] = useState<boolean>(false);
    const [worldMapCostModalOpen, setWorldMapCostModalOpen] = useState<boolean>(false);
    const [clearSceneImageModalOpen, setClearSceneImageModalOpen] = useState<boolean>(false);
    // 一键生成结果弹窗
    const [sceneResultModalOpen, setSceneResultModalOpen] = useState<boolean>(false);
    const [sceneGenerationResult, setSceneGenerationResult] = useState<{
        generatedCount: number;
        totalCount: number;
        pointsDeducted: number;
        remainingPoints?: number;
    } | null>(null);


    const [isGeneratingAllSceneImages, setIsGeneratingAllSceneImages] = useState<boolean>(false);
    const [sceneBatchJobStatus, setSceneBatchJobStatus] = useState<BatchImageJobStatus | null>(null);
    const [isGeneratingSingleSceneImage, setIsGeneratingSingleSceneImage] = useState<boolean>(false);
    const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
    const [isGeneratingWorldMap, setIsGeneratingWorldMap] = useState<boolean>(false);
    const [isClearingSceneImage, setIsClearingSceneImage] = useState<boolean>(false);
    const [isLoadingSceneCost, setIsLoadingSceneCost] = useState<boolean>(false);

    const [worldMapImageOverride, setWorldMapImageOverride] = useState<string | null>(null);
    const [sceneCostPoints, setSceneCostPoints] = useState<number | null>(null);

    const [musicList, setMusicList] = useState<MusicItem[]>([]);
    const [uploadMusicModalOpen, setUploadMusicModalOpen] = useState<boolean>(false);

    const sceneFileInputRef = useRef<HTMLInputElement>(null);
    const newSceneFileInputRef = useRef<HTMLInputElement>(null);
    const worldMapFileInputRef = useRef<HTMLInputElement>(null);
    const originalSceneDataRef = useRef<LocalScene[]>([]);
    const originalSubsceneDataBySceneIdRef = useRef<Record<string, WorldSubScene[]>>({});

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene';
        targetSceneId?: string | null;
        targetSubsceneId?: string | null;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);
    const pendingPanelActionRef = useRef<(() => void) | null>(null);

    // 暂存图片相关状态
    const [pendingImages, setPendingImages] = useState<{ [sceneId: string]: { [variant: string]: PendingImage } }>({});
    const pendingImageUrlsRef = useRef<{ [key: string]: string }>({});
    const batchImageRefreshPendingRef = useRef<BatchImageReconciliationPayload>({
        scenes: {},
        subscenes: {},
    });
    const sceneBatchGenerationCancelRef = useRef(false);

    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    const hasPendingBatchImageRefresh = useCallback(() => {
        const pending = batchImageRefreshPendingRef.current;
        return Object.keys(pending.scenes).length > 0 || Object.keys(pending.subscenes).length > 0;
    }, []);

    const hasPendingBatchImageRefreshRef = useRef(hasPendingBatchImageRefresh);
    useEffect(() => {
        hasPendingBatchImageRefreshRef.current = hasPendingBatchImageRefresh;
    }, [hasPendingBatchImageRefresh]);

    const markBatchImageRefreshPending = useCallback((payload: BatchImageReconciliationPayload) => {
        batchImageRefreshPendingRef.current = {
            scenes: { ...payload.scenes },
            subscenes: { ...payload.subscenes },
        };

        if (Object.keys(payload.scenes).length > 0) {
            setSceneData((prev) =>
                prev.map((scene) => {
                    const nextImage = payload.scenes[scene.id];
                    return nextImage ? { ...scene, image: nextImage } : scene;
                })
            );
            setActiveSceneDraft((prev) => {
                if (!prev) return prev;
                const nextImage = payload.scenes[prev.id];
                return nextImage ? { ...prev, image: nextImage } : prev;
            });
            originalSceneDataRef.current = originalSceneDataRef.current.map((scene) => {
                const nextImage = payload.scenes[scene.id];
                return nextImage ? { ...scene, image: nextImage } : scene;
            });
        }

        if (Object.keys(payload.subscenes).length > 0) {
            setSubsceneDataBySceneId((prev) => {
                const nextMap = cloneValue(prev);
                Object.entries(nextMap).forEach(([sceneId, subscenes]) => {
                    nextMap[sceneId] = (subscenes || []).map((subscene) => {
                        const subsceneId = String(subscene.id || subscene.name || '');
                        const nextImage = payload.subscenes[subsceneId];
                        return nextImage ? { ...subscene, image: nextImage } : subscene;
                    });
                });
                return nextMap;
            });
            setActiveSubsceneDraft((prev) => {
                if (!prev) return prev;
                const nextImage = payload.subscenes[prev.id];
                return nextImage ? { ...prev, image: nextImage } : prev;
            });
            const nextMap = cloneValue(originalSubsceneDataBySceneIdRef.current);
            Object.entries(nextMap).forEach(([sceneId, subscenes]) => {
                nextMap[sceneId] = (subscenes || []).map((subscene) => {
                    const subsceneId = String(subscene.id || subscene.name || '');
                    const nextImage = payload.subscenes[subsceneId];
                    return nextImage ? { ...subscene, image: nextImage } : subscene;
                });
            });
            originalSubsceneDataBySceneIdRef.current = nextMap;
        }

        const nextGeneratedImages = {
            ...payload.scenes,
            ...payload.subscenes,
        };
        if (Object.keys(nextGeneratedImages).length > 0) {
            setPendingImages((prev) => {
                const next = { ...prev };
                Object.entries(nextGeneratedImages).forEach(([targetId, imagePath]) => {
                    if (!imagePath) return;
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
        }
    }, []);

    // 清理暂存图片 Object URL
    const clearPendingImageUrl = (key: string) => {
        if (pendingImageUrlsRef.current[key]) {
            URL.revokeObjectURL(pendingImageUrlsRef.current[key]);
            delete pendingImageUrlsRef.current[key];
        }
    };

    // 清理单个场景的暂存图
    const clearPendingImagesForScene = useCallback((sceneId: string) => {
        const pendingForScene = pendingImages[sceneId];
        if (!pendingForScene) return;

        Object.keys(pendingForScene).forEach((variant) => {
            clearPendingImageUrl(`${sceneId}-${variant}`);
        });

        setPendingImages(prev => {
            const next = { ...prev };
            delete next[sceneId];
            return next;
        });
    }, [pendingImages]);

    const buildLocalSubsceneDraft = useCallback((sceneId: string, subscene?: WorldSubScene | null): LocalScene | null => {
        if (!subscene) {
            return null;
        }

        return {
            id: String(subscene.id || subscene.name || ''),
            name: subscene.name || '',
            type: '',
            desc: (subscene as any)?.description || '',
            image: subscene.image ? getImageUrl(subscene.image as any) : '',
            bgmId: sceneData.find((scene) => scene.id === sceneId)?.bgmId || '',
        };
    }, [sceneData]);

    const discardCurrentPendingChanges = useCallback(() => {
        if (isAddingNew && newSceneData) {
            clearPendingImagesForScene(newSceneData.id);
            setIsAddingNew(false);
            setNewSceneData(null);
            setActiveSubsceneId(null);
            setActiveSubsceneDraft(null);
            setActiveSceneId(sceneData[0]?.id || originalSceneDataRef.current[0]?.id || '');
            return;
        }

        if (activeSubsceneId && activeSceneId) {
            clearPendingImagesForScene(activeSubsceneId);

            if (isAddingNewSubscene) {
                setIsAddingNewSubscene(false);
                setActiveSubsceneId(null);
                setActiveSubsceneDraft(null);
                return;
            }

            const originalSubsceneMap = cloneValue(originalSubsceneDataBySceneIdRef.current);
            const originalSubscenes = originalSubsceneMap[activeSceneId] || [];
            const originalSubscene = originalSubscenes.find((subscene) => String(subscene.id || subscene.name || '') === activeSubsceneId);

            setSubsceneDataBySceneId(originalSubsceneMap);
            setActiveSubsceneDraft(buildLocalSubsceneDraft(activeSceneId, originalSubscene || null));
            return;
        }

        if (!activeSceneId) {
            return;
        }

        clearPendingImagesForScene(activeSceneId);
        const originalScenes = cloneValue(originalSceneDataRef.current);
        const originalScene = originalScenes.find((scene) => scene.id === activeSceneId) || null;

        setSceneData(originalScenes);
        setActiveSceneDraft(originalScene);
    }, [
        activeSceneId,
        activeSubsceneId,
        buildLocalSubsceneDraft,
        clearPendingImagesForScene,
        isAddingNew,
        isAddingNewSubscene,
        newSceneData,
        sceneData,
    ]);

    const bgmLibrary = useMemo<BgmItem[]>(() => {
        return musicList.map(music => ({
            id: music.filename,
            name: music.name,
            description: music.description,
        }));
    }, [musicList]);

    const worldMapImage = useMemo(() => {
        if (worldMapImageOverride) return worldMapImageOverride;
        if (gameData && 'worldSetting' in gameData) {
            return (gameData as WorldInteractionGameData).worldSetting?.worldMapImage || null;
        }
        return null;
    }, [worldMapImageOverride, gameData]);

    const { user, updateUser } = useAuthStore();
    const userPoints = user?.user?.points ?? 0;
    // 计算会员折扣后的场景生成价格（暂时不打折）
    const discountedSceneCost = scenePrice ?? 0;
    // const showSceneDiscount = isMember && MEMBER_CREATION_DISCOUNT < 1; // TODO: 恢复折扣UI时取消注释

    const worldMapPreviewSrc = useMemo(() => {
        if (!worldMapImage) return DEFAULT_WORLD_MAP_IMAGE;
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        if (isLocalStatic) return withCacheBust(worldMapImage);
        const processedUrl = getImageUrl(worldMapImage);
        return processedUrl ? withCacheBust(`${processedUrl}`) : DEFAULT_WORLD_MAP_IMAGE;
    }, [worldMapImage]);

    const activeScene = sceneData.length > 0
        ? (sceneData.find(s => s.id === activeSceneId) || sceneData[0])
        : null;
    const batchSceneGenerationCount = useMemo(() => {
        const sceneCount = sceneData.filter((scene) => !scene.id.startsWith('temp-')).length;
        if (mode !== 'worldInteraction') {
            return sceneCount;
        }

        const subsceneCount = Object.values(subsceneDataBySceneId).reduce((count, subscenes) => {
            return count + subscenes.filter((subscene) => !(subscene.id || '').startsWith('temp-')).length;
        }, 0);
        return sceneCount + subsceneCount;
    }, [mode, sceneData, subsceneDataBySceneId]);
    // 与角色看板一致：失败重试态 / 全成功同步态也要挂着弹窗，直到 dismiss 或结果落地
    const [sceneLightbox, setSceneLightbox] = useState<{ src: string; title: string } | null>(null);
    const [batchSceneBoardNowMs, setBatchSceneBoardNowMs] = useState(() => Date.now());
    const batchSceneLogListRef = useRef<HTMLDivElement | null>(null);
    const singleSceneEtaText = useGenerationEta({
        active: isGeneratingSingleSceneImage,
        totalSeconds: SINGLE_SCENE_ETA_SECONDS,
    });

    const getEffectiveImage = (sceneId: string, subsceneId?: string): string | undefined => {
        const targetId = subsceneId || sceneId;
        const pending = pendingImages[targetId]?.['base'];
        if (pending?.previewUrl) {
            return pending.previewUrl;
        }
        if (subsceneId) {
            return subsceneDataBySceneId[sceneId]?.find(s => (s.id || s.name) === subsceneId)?.image;
        }
        return sceneData.find(s => s.id === sceneId)?.image;
    };

    const batchSceneStageBoard = useMemo(() => {
        const items = Array.isArray(sceneBatchJobStatus?.items) ? sceneBatchJobStatus!.items! : [];
        const total = Math.max(0, Number(sceneBatchJobStatus?.totalCount) || items.length || 0);
        const labelOf = (stage: string) => {
            if (stage === 'generate_start') return '生图中';
            if (stage === 'generate_done' || stage === 'item_done') return '已完成';
            if (stage === 'generate_fail' || stage === 'rembg_fail') return '生图失败';
            if (stage === 'pending') return '排队中';
            return stage || '排队中';
        };
        const mapped = items.map((item, index) => {
            const stageUpdatedAtMs = Date.parse(String(item?.stageUpdatedAt || item?.updatedAt || ''));
            let localElapsed = Number.isFinite(stageUpdatedAtMs)
                ? Math.max(0, Math.floor((batchSceneBoardNowMs - stageUpdatedAtMs) / 1000))
                : Math.max(0, Number(item?.stageElapsedSeconds) || 0);
            let stage = String(item?.stage || 'pending');
            if (stage === 'generate_start' && localElapsed >= 190) {
                stage = 'generate_fail';
            }
            return {
                index: Number.isFinite(Number(item?.index)) ? Number(item.index) : index,
                id: item?.id ? String(item.id) : undefined,
                name: item?.name || `第 ${index + 1} 张`,
                stage,
                label: labelOf(stage),
                stageElapsedSeconds: localElapsed,
            };
        });
        const generateDone = mapped.filter((i) => (
            ['generate_done', 'item_done', 'generate_fail', 'rembg_fail'].includes(i.stage)
        )).length;
        const generateActive = mapped.filter((i) => i.stage === 'generate_start').length;
        const pending = mapped.filter((i) => i.stage === 'pending' || !i.stage).length;
        const failed = mapped.filter((i) => i.stage.includes('fail')).length;
        const stuckItems = mapped.filter((i) => i.stage === 'generate_start' && i.stageElapsedSeconds >= 150);
        return {
            items: mapped,
            stuckItems,
            stats: {
                total,
                generateDone: Math.min(total, generateDone),
                generateActive,
                pending,
                failed,
                settled: mapped.filter((i) => i.stage === 'item_done' || i.stage.includes('fail')).length,
            },
        };
    }, [batchSceneBoardNowMs, sceneBatchJobStatus]);

    const batchSceneRetryTargets = useMemo(
        () => listBatchNpcRetryTargetItems(batchSceneStageBoard.items),
        [batchSceneStageBoard.items],
    );
    const showSceneContinueFailed = useMemo(
        () => shouldShowRetryIncompleteBatchTasks(
            batchSceneStageBoard.items,
            Number(sceneBatchJobStatus?.totalCount) || batchSceneStageBoard.stats.total || 0,
        ),
        [batchSceneStageBoard, sceneBatchJobStatus],
    );
    const sceneBoardAllSuccess = useMemo(
        () => isBatchSceneBoardAllSuccess(
            batchSceneStageBoard.items,
            Number(sceneBatchJobStatus?.totalCount) || batchSceneStageBoard.stats.total || 0,
        ),
        [batchSceneStageBoard, sceneBatchJobStatus],
    );
    const isBatchSceneJobRunning = (
        isGeneratingAllSceneImages
        || (
            sceneBatchJobStatus != null
            && ['queued', 'running', 'pending'].includes(String(sceneBatchJobStatus.status || ''))
        )
    ) && !showSceneContinueFailed && !sceneBoardAllSuccess;
    const isBatchSceneJobActive = isBatchSceneJobRunning || showSceneContinueFailed || (
        sceneBatchJobStatus != null && sceneBoardAllSuccess
    );

    useEffect(() => {
        if (!isBatchSceneJobActive) return undefined;
        const timer = window.setInterval(() => setBatchSceneBoardNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [isBatchSceneJobActive]);

    const batchSceneEtaText = useGenerationEta({
        active: isBatchSceneJobRunning,
        totalSeconds: Math.max(
            SINGLE_SCENE_ETA_SECONDS,
            batchSceneGenerationCount * SINGLE_SCENE_ETA_SECONDS + BATCH_SCENE_BUFFER_SECONDS,
        ),
        totalCount: sceneBatchJobStatus?.totalCount ?? batchSceneGenerationCount,
        completedCount: sceneBatchJobStatus?.completedCount,
        status: sceneBatchJobStatus?.status,
        estimatedRemainingSeconds: sceneBatchJobStatus?.estimatedRemainingSeconds ?? null,
        batchLabel: batchSceneGenerationCount > 0 ? `${t('eta.total')} ${batchSceneGenerationCount} ${t('eta.item')}` : undefined,
        // 场景批量看板已有分项进度，去掉「剩余 xx」倒计时
        showRemaining: false,
    });
    const batchSceneLogs = useMemo(() => {
        const logs = Array.isArray(sceneBatchJobStatus?.logs) ? sceneBatchJobStatus!.logs! : [];
        return logs.slice(-40).map((entry: any) => ({
            message: typeof entry === 'string' ? entry : String(entry?.message || ''),
            stage: typeof entry === 'string' ? '' : String(entry?.stage || ''),
        })).filter((e) => e.message);
    }, [sceneBatchJobStatus]);

    useEffect(() => {
        const el = batchSceneLogListRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [batchSceneLogs.length]);

    const batchSceneItemStageClass = (stage: string) => {
        if (stage === 'generate_start' || stage === 'generate_done') return styles.plusLoadingItemGen;
        if (stage === 'item_done') return styles.plusLoadingItemDone;
        if (stage === 'generate_fail' || stage === 'rembg_fail') return styles.plusLoadingItemFail;
        return styles.plusLoadingItemPending;
    };
    const batchSceneLogStageLabel = (stage: string) => {
        if (stage === 'generate_start') return '生图';
        if (stage === 'generate_done' || stage === 'item_done') return '完成';
        if (stage === 'generate_fail' || stage === 'rembg_fail' || stage === 'fail') return '失败';
        if (stage === 'batch_start') return '启动';
        return '进度';
    };
    const batchSceneLogStageClass = (stage: string, isActive: boolean) => {
        const base = isActive ? styles.plusLoadingLogRowActive : styles.plusLoadingLogRow;
        if (stage === 'generate_start' || stage === 'generate_done') {
            return `${base} ${styles.plusLoadingLogRowGen}`;
        }
        if (stage === 'item_done') {
            return `${base} ${styles.plusLoadingLogRowDone}`;
        }
        if (stage === 'generate_fail' || stage === 'rembg_fail' || stage === 'fail') {
            return `${base} ${styles.plusLoadingLogRowFail}`;
        }
        return base;
    };

    const openSceneLightbox = useCallback((src: string | null | undefined, title?: string) => {
        if (!src) return;
        const resolved = (src.startsWith('blob:') || src.startsWith('data:'))
            ? src
            : withCacheBust(getImageUrl(src) || src);
        setSceneLightbox({
            src: resolved,
            title: String(title || '').trim(),
        });
    }, []);

    const currentSceneForDetail = activeSceneDraft || activeScene;
    const canClearActiveSceneImage = Boolean(
        mode === 'visual'
        && !isAddingNew
        && !activeSubsceneId
        && currentSceneForDetail
        && getEffectiveImage(currentSceneForDetail.id)
    );

    useEffect(() => {
        if (isAddingNew) return;
        if (activeSubsceneId) return;
        setActiveSceneDraft((prev) => {
            if (!activeScene) {
                return prev === null ? prev : null;
            }
            if (prev && prev.id === activeScene.id && hasUnsavedChangesRef.current) {
                return prev;
            }
            if (
                prev &&
                prev.id === activeScene.id &&
                prev.name === activeScene.name &&
                prev.type === activeScene.type &&
                prev.desc === activeScene.desc &&
                prev.image === activeScene.image &&
                prev.bgmId === activeScene.bgmId
            ) {
                return prev;
            }
            return activeScene;
        });
    }, [activeSceneId, activeSubsceneId, isAddingNew, activeScene]);

    const sceneApi = useMemo(() => createSceneApiHelpers(mode), [mode]);

    const handleDeleteModalOpen = useCallback(() => setDeleteModalOpen(true), []);
    const handleDeleteModalClose = useCallback(() => setDeleteModalOpen(false), []);
    const handleSubsceneDeleteModalOpen = useCallback(() => setSubsceneDeleteModalOpen(true), []);
    const handleSubsceneDeleteModalClose = useCallback(() => setSubsceneDeleteModalOpen(false), []);
    const handleSceneCostModalOpen = useCallback((points: number | null) => {
        setSceneCostPoints(points);
        setSceneCostModalOpen(true);
    }, []);
    const handleSingleSceneCostModalOpen = useCallback(() => setSingleSceneCostModalOpen(true), []);
    const handleWorldMapCostModalOpen = useCallback(() => setWorldMapCostModalOpen(true), []);

    const handlers = useMemo(
        () =>
            createSceneHandlers({
                fileId,
                mode,
                gameData,
                api: sceneApi,
                updateUser,
                t,
                activeSceneId,
                activeSceneDraft,
                activeSubsceneId,
                activeSubsceneDraft,
                sceneData,
                subsceneDataBySceneId,
                isAddingNew,
                newSceneData,
                isAddingNewSubscene,
                pendingImages,
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
                sceneFileInputRef,
                newSceneFileInputRef,
                worldMapFileInputRef,
                pendingImageUrlsRef,
                onDeleteModalOpen: handleDeleteModalOpen,
                onDeleteModalClose: handleDeleteModalClose,
                onSubsceneDeleteModalOpen: handleSubsceneDeleteModalOpen,
                onSubsceneDeleteModalClose: handleSubsceneDeleteModalClose,
                onSceneCostModalOpen: handleSceneCostModalOpen,
                onSingleSceneCostModalOpen: handleSingleSceneCostModalOpen,
                onWorldMapCostModalOpen: handleWorldMapCostModalOpen,
                onDataChange,
                markBatchImageRefreshPending,
                hasPendingBatchImageRefresh,
                sceneBatchGenerationCancelRef,
            }),
        [
            fileId,
            mode,
            gameData,
            sceneApi,
            userPoints,
            updateUser,
            activeSceneId,
            activeSubsceneId,
            activeSubsceneDraft,
            sceneData,
            subsceneDataBySceneId,
            isAddingNew,
            newSceneData,
            isAddingNewSubscene,
            pendingImages,
            handleDeleteModalOpen,
            handleDeleteModalClose,
            handleSubsceneDeleteModalOpen,
            handleSubsceneDeleteModalClose,
            handleSceneCostModalOpen,
            handleSingleSceneCostModalOpen,
            handleWorldMapCostModalOpen,
            markBatchImageRefreshPending,
            hasPendingBatchImageRefresh,
            onDataChange,
        ]
    );

    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    // 全成功且轮询已结束：自动关闭进度弹窗（不再卡在「关闭」）
    useEffect(() => {
        if (!sceneBoardAllSuccess || showSceneContinueFailed) return undefined;
        if (isGeneratingAllSceneImages) return undefined;
        if (!sceneBatchJobStatus) return undefined;
        const timer = window.setTimeout(() => {
            handlersRef.current?.dismissSceneBatchProgress?.();
        }, 450);
        return () => window.clearTimeout(timer);
    }, [
        sceneBoardAllSuccess,
        showSceneContinueFailed,
        isGeneratingAllSceneImages,
        sceneBatchJobStatus,
    ]);

    const handleSceneHeroClick = useCallback(() => {
        if (isAddingNew) {
            toast.error(t('createGame.confirmAddSceneFirst'));
            return;
        }
        const scene = activeSceneDraft || activeScene;
        if (!scene) return;
        const image = getEffectiveImage(
            mode === 'worldInteraction' && activeSubsceneId
                ? (activeScene?.id || scene.id)
                : scene.id,
            mode === 'worldInteraction' && activeSubsceneId ? activeSubsceneId : undefined,
        ) || scene.image;
        if (image) {
            openSceneLightbox(image, scene.name);
            return;
        }
        handlersRef.current.handleSceneImageClick();
    }, [
        activeScene,
        activeSceneDraft,
        activeSubsceneId,
        isAddingNew,
        mode,
        openSceneLightbox,
        pendingImages,
        sceneData,
        subsceneDataBySceneId,
        t,
    ]);

    const handleContinueFailedBatchSceneTasks = useCallback(async () => {
        const uniqueIds = resolveRetryCharacterIdsFromBoard(
            batchSceneRetryTargets,
            (name) => sceneData.find((s) => s.name === name && !s.id.startsWith('temp-'))?.id,
        );
        if (uniqueIds.length === 0) {
            toast.error(t('createGame.selectScenesToGenerate') || '请先选择要重试的场景');
            return;
        }
        // 积分确认打开时隐藏进度遮罩，避免 ConfirmModal 被压住
        await handlersRef.current.continueFailedBatchSceneImages(uniqueIds);
    }, [batchSceneRetryTargets, sceneData, t]);

    const showBatchSceneProgressOverlay = shouldShowBatchProgressOverlay({
        batchJobActive: isBatchSceneJobActive,
        costModalOpen: sceneCostModalOpen,
        resultModalOpen: sceneResultModalOpen,
    });

    const hasSceneDraftChanges = useCallback((
        draft: LocalScene | null | undefined,
        persisted: LocalScene | null | undefined,
    ) => {
        if (!draft || !persisted) {
            return false;
        }

        return (
            draft.name !== persisted.name
            || draft.type !== persisted.type
            || draft.desc !== persisted.desc
            || draft.image !== persisted.image
            || draft.bgmId !== persisted.bgmId
        );
    }, []);

    const onListDeleteClick = useCallback((sceneId: string, e: React.MouseEvent) => {
        handlersRef.current.handleDeleteClick(sceneId, e);
    }, []);
    const onListSubsceneDeleteClick = useCallback((sceneId: string, subsceneId: string, e: React.MouseEvent) => {
        handlersRef.current.handleSubsceneDeleteClick(sceneId, subsceneId, e);
    }, []);
    const onListAddNewScene = useCallback(() => {
        handlersRef.current.openAddNewPanel();
    }, []);
    const onListAddNewSubscene = useCallback(() => {
        handlersRef.current.openAddNewSubscene();
    }, []);

    const applySuccessfulSaveResult = useCallback((result: SceneSaveResult): boolean => {
        if (!result.success) {
            return false;
        }

        if (result.kind === 'sceneAdd' || result.kind === 'sceneEdit') {
            const nextScenes = cloneValue(originalSceneDataRef.current);
            const existingIndex = nextScenes.findIndex((scene) => scene.id === result.savedScene.id);

            if (existingIndex >= 0) {
                nextScenes[existingIndex] = result.savedScene;
            } else {
                nextScenes.unshift(result.savedScene);
            }

            originalSceneDataRef.current = nextScenes;
            if (mode === 'worldInteraction' && result.kind === 'sceneAdd') {
                originalSubsceneDataBySceneIdRef.current = {
                    ...originalSubsceneDataBySceneIdRef.current,
                    [result.savedScene.id]: originalSubsceneDataBySceneIdRef.current[result.savedScene.id] || [],
                };
            }
            setActiveSceneDraft(result.savedScene);
            return true;
        }

        if (result.kind !== 'subsceneAdd' && result.kind !== 'subsceneEdit') {
            return false;
        }

        const nextSubsceneMap = cloneValue(originalSubsceneDataBySceneIdRef.current);
        const currentSubscenes = nextSubsceneMap[result.sceneId] || [];
        const savedSubscene = cloneValue(result.savedSubscene);
        const savedSubsceneId = String(savedSubscene.id || savedSubscene.name || '');
        const existingIndex = currentSubscenes.findIndex((subscene) => {
            const subsceneId = String(subscene.id || subscene.name || '');
            return subsceneId === result.previousSubsceneId || subsceneId === savedSubsceneId;
        });

        nextSubsceneMap[result.sceneId] =
            existingIndex >= 0
                ? currentSubscenes.map((subscene, index) => (index === existingIndex ? savedSubscene : subscene))
                : [savedSubscene, ...currentSubscenes];

        originalSubsceneDataBySceneIdRef.current = nextSubsceneMap;
        return true;
    }, [mode]);

    const saveCurrentChanges = useCallback(async (
        options?: { suppressSuccessToast?: boolean },
    ): Promise<boolean> => {
        let result: SceneSaveResult;

        if (isAddingNew && newSceneData) {
            result = await handlersRef.current.confirmAddNew(options);
        } else if (activeSubsceneId && activeSubsceneDraft) {
            result = await handlersRef.current.confirmSubsceneEdit(options);
        } else if (activeSceneDraft || activeScene) {
            result = await handlersRef.current.confirmEdit((activeSceneDraft || activeScene)!, options);
        } else {
            setHasUnsavedChanges(false);
            hasUnsavedChangesRef.current = false;
            return true;
        }

        if (!result.success) {
            return false;
        }

        applySuccessfulSaveResult(result);
        setHasUnsavedChanges(false);
        hasUnsavedChangesRef.current = false;
        return true;
    }, [
        activeScene,
        activeSceneDraft,
        activeSubsceneDraft,
        activeSubsceneId,
        applySuccessfulSaveResult,
        isAddingNew,
        newSceneData,
    ]);

    const handleManualSave = useCallback(async () => {
        await saveCurrentChanges();
    }, [saveCurrentChanges]);

    const currentSceneFieldDirtyState = useMemo<SceneFieldDirtyState>(() => {
        if (isAddingNew && newSceneData) {
            return {
                name: Boolean(newSceneData.name),
                desc: Boolean(newSceneData.desc),
            };
        }

        if (activeSubsceneId && activeSubsceneDraft) {
            const originalSubscene = originalSubsceneDataBySceneIdRef.current[activeSceneId || '']?.find(
                (subscene) => String(subscene.id || subscene.name || '') === activeSubsceneId,
            );

            return {
                name: (activeSubsceneDraft.name || '') !== (originalSubscene?.name || ''),
                desc: (activeSubsceneDraft.desc || '') !== ((originalSubscene as { description?: string } | undefined)?.description || ''),
            };
        }

        const currentDraft = activeSceneDraft || activeScene;
        if (!currentDraft) {
            return EMPTY_SCENE_FIELD_DIRTY_STATE;
        }

        const originalScene = originalSceneDataRef.current.find((scene) => scene.id === currentDraft.id);
        if (!originalScene) {
            return EMPTY_SCENE_FIELD_DIRTY_STATE;
        }

        return {
            name: (currentDraft.name || '') !== (originalScene.name || ''),
            desc: (currentDraft.desc || '') !== (originalScene.desc || ''),
        };
    }, [activeScene, activeSceneDraft, activeSceneId, activeSubsceneDraft, activeSubsceneId, isAddingNew, newSceneData]);

    const handleRequestClearSceneImage = useCallback(() => {
        if (mode !== 'visual' || !activeSceneId) {
            return;
        }
        setClearSceneImageModalOpen(true);
    }, [activeSceneId, mode]);

    const handleCancelClearSceneImage = useCallback(() => {
        if (isClearingSceneImage) {
            return;
        }
        setClearSceneImageModalOpen(false);
    }, [isClearingSceneImage]);

    const handleConfirmClearSceneImage = useCallback(async () => {
        if (!activeSceneId) {
            setClearSceneImageModalOpen(false);
            return;
        }

        setIsClearingSceneImage(true);
        const clearedScene = await handlersRef.current.clearSceneImageImmediately(activeSceneId);

        if (clearedScene) {
            originalSceneDataRef.current = originalSceneDataRef.current.map((scene) => (
                scene.id === clearedScene.id ? clearedScene : scene
            ));

            const nextDraft = activeSceneDraft && activeSceneDraft.id === activeSceneId
                ? { ...activeSceneDraft, image: '' }
                : clearedScene;
            const nextHasUnsavedChanges = hasSceneDraftChanges(nextDraft, clearedScene);

            hasUnsavedChangesRef.current = nextHasUnsavedChanges;
            setHasUnsavedChanges(nextHasUnsavedChanges);
        }

        setIsClearingSceneImage(false);
        setClearSceneImageModalOpen(false);
    }, [activeSceneDraft, activeSceneId, hasSceneDraftChanges]);

    const closePendingSaveModal = useCallback(() => {
        setSaveConfirmModalOpen(false);
        setIsBlockingSwitch(false);
        isBlockingSwitchRef.current = false;
    }, []);

    const clearPendingActionState = useCallback(() => {
        closePendingSaveModal();
        setPendingAction(null);
        pendingPanelActionRef.current = null;
    }, [closePendingSaveModal]);

    const mergeImageFieldsFromGameData = useCallback((nextGameData: AllGameData | WorldInteractionGameData) => {
        const scenes = getScenes(nextGameData);
        if (!scenes || scenes.length === 0) return;

        const nextSceneImages = new Map<string, string>();
        scenes.forEach((scene) => {
            if (scene.id) {
                nextSceneImages.set(String(scene.id), scene.image || '');
            }
        });

        const pending = batchImageRefreshPendingRef.current;
        const nextPendingScenes = { ...pending.scenes };
        const nextPendingSubscenes = { ...pending.subscenes };
        const clearedPendingImages: Record<string, string> = {};

        Object.entries(pending.scenes).forEach(([sceneId, pendingImage]) => {
            if (nextSceneImages.get(sceneId) === pendingImage) {
                delete nextPendingScenes[sceneId];
                clearedPendingImages[sceneId] = pendingImage;
            }
        });

        setSceneData((prevScenes) => prevScenes.map((scene) => {
            if (!nextSceneImages.has(scene.id)) return scene;
            const nextImage = nextSceneImages.get(scene.id) || '';
            const pendingImage = pending.scenes[scene.id];
            if (pendingImage && nextImage !== pendingImage) {
                return scene;
            }
            return { ...scene, image: nextImage };
        }));

        setActiveSceneDraft((prev) => {
            if (!prev || !nextSceneImages.has(prev.id)) return prev;
            const nextImage = nextSceneImages.get(prev.id) || '';
            const pendingImage = pending.scenes[prev.id];
            if (pendingImage && nextImage !== pendingImage) {
                return prev;
            }
            return { ...prev, image: nextImage };
        });

        if (mode === 'worldInteraction') {
            const nextSubsceneImages = new Map<string, string>();
            scenes.forEach((scene: any) => {
                if (!isWorldScene(scene)) return;
                (scene.subscenes || []).forEach((subscene: any) => {
                    const subsceneId = String(subscene?.id || subscene?.name || '');
                    if (subsceneId) {
                        nextSubsceneImages.set(subsceneId, subscene?.image || '');
                    }
                });
            });

            Object.entries(pending.subscenes).forEach(([subsceneId, pendingImage]) => {
                if (nextSubsceneImages.get(subsceneId) === pendingImage) {
                    delete nextPendingSubscenes[subsceneId];
                    clearedPendingImages[subsceneId] = pendingImage;
                }
            });

            setSubsceneDataBySceneId((prev) => {
                const nextSubsceneState: Record<string, WorldSubScene[]> = cloneValue(prev);
                Object.entries(nextSubsceneState).forEach(([sceneId, subscenes]) => {
                    nextSubsceneState[sceneId] = (subscenes || []).map((subscene: any) => {
                        const subsceneId = String(subscene?.id || subscene?.name || '');
                        if (!nextSubsceneImages.has(subsceneId)) return subscene;
                        const nextImage = nextSubsceneImages.get(subsceneId) || '';
                        const pendingImage = pending.subscenes[subsceneId];
                        if (pendingImage && nextImage !== pendingImage) {
                            return subscene;
                        }
                        return { ...subscene, image: nextImage };
                    });
                });
                return nextSubsceneState;
            });

            setActiveSubsceneDraft((prev) => {
                if (!prev) return prev;
                const nextImage = nextSubsceneImages.get(prev.id);
                if (nextImage === undefined) return prev;
                const pendingImage = pending.subscenes[prev.id];
                if (pendingImage && nextImage !== pendingImage) {
                    return prev;
                }
                return { ...prev, image: nextImage };
            });
        }

        if (Object.keys(clearedPendingImages).length > 0) {
            setPendingImages((prev) => {
                let changed = false;
                const next = { ...prev };
                Object.entries(clearedPendingImages).forEach(([targetId, imagePath]) => {
                    const basePending = next[targetId]?.base;
                    if (!basePending) return;
                    if (basePending.previewUrl !== imagePath && basePending.persistedPath !== imagePath) return;
                    const pendingKey = `${targetId}-base`;
                    const existingPreviewUrl = pendingImageUrlsRef.current[pendingKey];
                    if (existingPreviewUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(existingPreviewUrl);
                        delete pendingImageUrlsRef.current[pendingKey];
                    }
                    const nextTarget = { ...next[targetId] };
                    delete nextTarget.base;
                    if (Object.keys(nextTarget).length > 0) {
                        next[targetId] = nextTarget;
                    } else {
                        delete next[targetId];
                    }
                    changed = true;
                });
                return changed ? next : prev;
            });
        }

        batchImageRefreshPendingRef.current = {
            scenes: nextPendingScenes,
            subscenes: nextPendingSubscenes,
        };
    }, [mode]);

    const mergeImageFieldsFromGameDataRef = useRef(mergeImageFieldsFromGameData);
    useEffect(() => {
        mergeImageFieldsFromGameDataRef.current = mergeImageFieldsFromGameData;
    }, [mergeImageFieldsFromGameData]);

    useEffect(() => {
        if (!gameData) return;
        if (hasUnsavedChangesRef.current) {
            if (hasPendingBatchImageRefreshRef.current()) {
                mergeImageFieldsFromGameDataRef.current(gameData);
            }
            return;
        }
        if (hasPendingBatchImageRefreshRef.current()) {
            mergeImageFieldsFromGameDataRef.current(gameData);
            if (hasPendingBatchImageRefreshRef.current()) {
                return;
            }
        }
        const scenes = getScenes(gameData);
        if (scenes && scenes.length > 0) {
            const convertedScenes: LocalScene[] = scenes.map((scene) => {
                const sceneType = 'type' in scene ? (scene.type || '') : '';
                const sceneImage = scene.image || '';
                const sceneSoundtrack = scene.soundtrack || '';
                const soundtrackFilename = sceneSoundtrack ? (sceneSoundtrack) : '';
                
                return {
                    id: scene.id || '',
                    name: scene.name,
                    type: sceneType,
                    desc: scene.description || '',
                    image: sceneImage,
                    bgmId: soundtrackFilename,
                };
            });

            setSceneData(convertedScenes);
            if (mode === 'worldInteraction') {
                const nextMap: Record<string, WorldSubScene[]> = {};
                scenes.forEach((s: any) => {
                    if (isWorldScene(s)) {
                        nextMap[s.id] = cloneValue((s.subscenes || []) as WorldSubScene[]);
                    }
                });
                setSubsceneDataBySceneId(nextMap);
                originalSubsceneDataBySceneIdRef.current = cloneValue(nextMap);
            } else {
                originalSubsceneDataBySceneIdRef.current = {};
            }
            originalSceneDataRef.current = cloneValue(convertedScenes);
            setHasUnsavedChanges(false);
            if (convertedScenes.length > 0) {
                setActiveSceneId(prev => prev || convertedScenes[0].id);
            }
        }
        batchImageRefreshPendingRef.current = { scenes: {}, subscenes: {} };
    }, [gameData, mode]);

    useEffect(() => {
        const loadMusicList = async () => {
            if (!fileId || (mode !== 'worldInteraction' && mode !== 'visual') || !sceneApi) return;
            
            try {
                const response = await sceneApi.getMusicList(fileId);
                if (response.data?.success && response.data.files) {
                    const musicItems: MusicItem[] = response.data.files.map((music, index) => {
                        return {
                            id: `music-${index}`,
                            name: music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename,
                            description: music.description || music.originalFilename || music.filename,
                            filename: music.filename,
                            musicPath: getMusicUrlWithHost(music.url),
                        };
                    });
                    setMusicList(musicItems);
                }
            } catch (error) {
                console.error('加载音乐列表失败:', error);
            }
        };

        loadMusicList();
    }, [fileId, mode, sceneApi]);

    const getSceneSettingData = useCallback((): VisualSceneSetting | WorldSceneSetting | null => {
        if (!gameData?.sceneSetting) return null;

        const scenes = sceneData
            .filter(scene => !scene.id.startsWith('temp-'))
            .map(scene => {
                const originalScene = getSceneById(gameData, scene.id);
                const originalSubscenes =
                    originalScene && 'subscenes' in originalScene
                        ? (originalScene.subscenes || [])
                        : [];
                const subscenesForExport =
                    mode === 'worldInteraction'
                        ? (subsceneDataBySceneId[scene.id] || originalSubscenes)
                        : originalSubscenes;
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
                    subscenes: subscenesForExport,
                };
            });

        return { scenes };
    }, [sceneData, gameData, mode, subsceneDataBySceneId]);

    useEffect(() => {
        if (onGetData) {
            onGetData(() => {
                const sceneSetting = getSceneSettingData();
                if (!sceneSetting) return null;
                return { sceneSetting };
            });
        }
    }, [onGetData, getSceneSettingData]);

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

        if (action.type === 'switchScene') {
            setIsAddingNew(false);
            setNewSceneData(null);
            if (isAddingNewSubscene) {
                setIsAddingNewSubscene(false);
            }
            setActiveSubsceneDraft(null);
            setActiveSceneId(action.targetSceneId || '');
            setActiveSubsceneId(null);
        } else if (action.type === 'switchSubscene') {
            const targetSceneId = action.targetSceneId || '';
            const targetSubsceneId = action.targetSubsceneId || null;
            const targetSubscene = subsceneDataBySceneId[targetSceneId]?.find(
                (subscene) => (subscene.id || subscene.name) === targetSubsceneId,
            );

            setIsAddingNew(false);
            setNewSceneData(null);
            if (isAddingNewSubscene) {
                setIsAddingNewSubscene(false);
            }
            setActiveSceneId(targetSceneId);
            setActiveSubsceneId(targetSubsceneId);
            setActiveSubsceneDraft(buildLocalSubsceneDraft(targetSceneId, targetSubscene || null));
        } else if (action.type === 'switchPanel') {
            if (pendingPanelAction) {
                pendingPanelAction();
            }
        }
    }, [buildLocalSubsceneDraft, pendingAction, isAddingNewSubscene, subsceneDataBySceneId]);

    const handlePendingSave = useCallback(async () => {
        closePendingSaveModal();

        const saved = await saveCurrentChanges({ suppressSuccessToast: true });
        if (saved) {
            executePendingAction();
            return;
        }

        setPendingAction(null);
        pendingPanelActionRef.current = null;
    }, [closePendingSaveModal, executePendingAction, saveCurrentChanges]);

    const checkBeforeSwitch = useCallback((action: { type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene'; targetSceneId?: string | null; targetSubsceneId?: string | null }) => {
        if (hasUnsavedChanges) {
            pendingPanelActionRef.current = null;
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            isBlockingSwitchRef.current = true;
            return false;
        }
        return true;
    }, [hasUnsavedChanges]);

    useImperativeHandle(ref, () => ({
        checkBeforeLeave: (action?: () => void) => {
            const hasChanges = hasUnsavedChangesRef.current;
            const isBlocking = isBlockingSwitchRef.current;
            
            if (hasChanges && !isBlocking) {
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

    const handleSceneClick = useCallback((sceneId: string) => {
        if (!checkBeforeSwitch({ type: 'switchScene', targetSceneId: sceneId })) {
            return;
        }
        setIsAddingNew(false);
        setNewSceneData(null);
        if (isAddingNewSubscene) {
            setIsAddingNewSubscene(false);
        }
        setActiveSubsceneDraft(null);
        setActiveSceneId(sceneId);
        setActiveSubsceneId(null);
        setActiveSubsceneDraft(null);
    }, [isAddingNewSubscene, checkBeforeSwitch]);

    const handleSubsceneClick = useCallback((sceneId: string, subsceneId: string) => {
        if (!checkBeforeSwitch({ type: 'switchSubscene', targetSceneId: sceneId, targetSubsceneId: subsceneId })) {
            return;
        }
        setIsAddingNew(false);
        setNewSceneData(null);
        if (isAddingNewSubscene) {
            setIsAddingNewSubscene(false);
        }
        setActiveSceneId(sceneId);
        setActiveSubsceneId(subsceneId);

        const subscene = subsceneDataBySceneId[sceneId]?.find(s => (s.id || s.name) === subsceneId);
        setActiveSubsceneDraft(buildLocalSubsceneDraft(sceneId, subscene || null));
    }, [buildLocalSubsceneDraft, isAddingNewSubscene, checkBeforeSwitch, subsceneDataBySceneId]);

    const handleConfirmGenerateAllSceneImages = useCallback(async () => {
        setSceneCostModalOpen(false);
        await handlers.confirmGenerateAllSceneImages(sceneCostPoints);
    }, [handlers, sceneCostPoints]);

    const handleOpenSceneCostModal = useCallback(() => {
        if (scenePrice == null) {
            toast.error('生图价格暂不可用，请联系管理员检查业务模型与计费配置');
            return;
        }
        handlers.openSceneCostModal();
    }, [handlers, scenePrice]);

    const handleCancelGenerateAllSceneImages = useCallback(() => {
        setSceneCostModalOpen(false);
    }, []);

    const handleConfirmSingleSceneGenerate = useCallback(async () => {
        setSingleSceneCostModalOpen(false);
        const result = await handlers.confirmSingleSceneGenerate();
        if (result?.success && result.kind === 'sceneEdit') {
            applySuccessfulSaveResult(result);
            hasUnsavedChangesRef.current = false;
            setHasUnsavedChanges(false);
        }
    }, [applySuccessfulSaveResult, handlers]);

    const handleCancelSingleSceneGenerate = useCallback(() => {
        setSingleSceneCostModalOpen(false);
        handlers.cancelSingleSceneGenerate();
    }, [handlers]);

    const handleConfirmGenerateWorldMap = useCallback(async () => {
        setWorldMapCostModalOpen(false);
        await handlers.confirmGenerateWorldMap();
        onDataChange?.();
    }, [handlers, onDataChange]);

    const handleCancelGenerateWorldMap = useCallback(() => {
        setWorldMapCostModalOpen(false);
        handlers.cancelGenerateWorldMap();
    }, [handlers]);

    const handleDownloadImage = useCallback(async (
        type: 'npcs' | 'scenes' | 'subscenes' | 'worldMap',
        id: string,
        variantOrImagePath?: string,
        imagePath?: string
    ) => {
        if (!fileId || !sceneApi) {
            toast.error(t('createGame.missingDataCannotDownload'));
            return;
        }

        let variant: string | undefined;
        let finalImagePath: string | undefined;

        if (type === 'scenes' || type === 'subscenes') {
            finalImagePath = variantOrImagePath;
        } else {
            variant = variantOrImagePath;
            finalImagePath = imagePath;
        }

        if (!finalImagePath) {
            toast.error(t('createGame.missingImagePath'));
            return;
        }

        try {
            let blob: Blob;

            // 远程路径统一 authFetch→blob（跨域 <a download> 常失败）
            if (
                finalImagePath.startsWith('/api/')
                || finalImagePath.startsWith('/visual/')
                || finalImagePath.startsWith('/world-interaction/')
                || finalImagePath.startsWith('http://')
                || finalImagePath.startsWith('https://')
            ) {
                const fullUrl = finalImagePath.startsWith('http')
                    ? finalImagePath
                    : `${HOST_ADDRESS}${finalImagePath}`;
                const response = await authFetch(fullUrl);
                if (!response.ok) {
                    throw new Error('获取图片数据失败');
                }
                blob = await response.blob();
            } else if (finalImagePath.startsWith('blob:') || finalImagePath.startsWith('data:')) {
                const response = await fetch(finalImagePath);
                if (!response.ok) {
                    throw new Error('获取图片数据失败');
                }
                blob = await response.blob();
            } else {
                const response = await sceneApi.downloadImage(fileId, type, id, variant, finalImagePath);
                blob = response.data;
            }
            const extension = extractImageExtension(finalImagePath) || '.png';
            const fileName = variant ? `${id}_${variant}${extension}` : `${id}${extension}`;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
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
    }, [fileId, sceneApi]);

    const handleUploadMusic = useCallback(async (file: File, name: string, description: string) => {
        if (!fileId || !sceneApi) {
            toast.error(t('createGame.missingDataCannotUpload'));
            return;
        }

        try {
            const response = await sceneApi.uploadMusic(fileId, file, name, description);
            if (response.data.success) {
                toast.success(t('createGame.musicUploadSuccess'));
                const listResponse = await sceneApi.getMusicList(fileId);
                if (listResponse.data.success && listResponse.data.files) {
                    const uploadedFilename = response.data.filename || file.name;
                    const musicItems: MusicItem[] = listResponse.data.files.map((music, index) => {
                        const isUploadedFile = music.filename === uploadedFilename || 
                                               music.originalFilename === file.name ||
                                               music.filename.includes(file.name);
                        return {
                            id: `music-${index}`,
                            name: isUploadedFile 
                                ? (name || music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename)
                                : (music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename),
                            description: isUploadedFile
                                ? (description || music.description || music.originalFilename || music.filename)
                                : (music.description || music.originalFilename || music.filename),
                            filename: music.filename,
                            musicPath: getMusicUrlWithHost(music.url),
                        };
                    });
                    setMusicList(musicItems);
                }
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error(t('createGame.uploadFailed'));
            }
        } catch (error) {
            console.error('上传音乐失败:', error);
            toast.error(t('createGame.musicUploadFailedRetry'));
            throw error;
        }
    }, [fileId, sceneApi, onDataChange]);

    return (
        <div className={styles.panelContent}>
            {mode === 'worldInteraction' && (
                <WorldMapCard
                    worldMapPreviewSrc={worldMapPreviewSrc}
                    isGeneratingWorldMap={isGeneratingWorldMap}
                    fileId={fileId}
                    onGenerateClick={handlers.handleRequestGenerateWorldMap}
                    onUploadClick={() => worldMapFileInputRef.current?.click()}
                    worldMapFileInputRef={worldMapFileInputRef}
                    onUploadChange={handlers.handleUploadWorldMapChange}
                />
            )}

            <div className={styles.panelHeader}>
                <div>
                    <h2>{t('createGame.sceneAndBgm')}</h2>
                    <p className={styles.subtitle}>{t('createGame.aiSceneDescription')}</p>
                </div>
                <GenerationActionBar>
                    <button
                        className={`${styles.ghost} ${styles.generateButton}`}
                        onClick={handleOpenSceneCostModal}
                        disabled={isBatchSceneJobActive || isLoadingSceneCost || isBlockingSwitch || scenePrice == null}
                    >
                        <CurrencyIcon
                            currency="points"
                            className={styles.priceIcon}
                        />
                        <div className={styles.buttonTextContainer}>
                            <span className={styles.buttonMainText}>
                                {isGeneratingAllSceneImages ? t('createGame.generating') : t('createGame.generateAllScenePortraits')}
                            </span>
                            <span className={styles.buttonSubText}>
                                {/* TODO: 恢复会员折扣UI时，取消下方注释
                                {showSceneDiscount ? (
                                    <>
                                        <span className={styles.originalPrice}>{scenePrice ?? '—'}</span>
                                        <span className={styles.discountPrice}>{discountedSceneCost}</span>
                                        {t('common.points')}/{t('eta.item')}
                                    </>
                                ) : ( */}
                                    <>{scenePrice ?? '—'}{t('common.points')}/{t('eta.item')}</>
                                {/* )} */}
                            </span>
                        </div>
                    </button>
                </GenerationActionBar>
            </div>

            {false && ((mode === 'worldInteraction' || mode === 'visual') && (
                <MusicList
                    musicList={musicList}
                    onUploadClick={() => setUploadMusicModalOpen(true)}
                    fileId={fileId}
                    mode={mode}
                    sceneApi={sceneApi}
                    onMusicDeleted={async () => {
                        if (fileId && sceneApi) {
                            try {
                                const response = await sceneApi.getMusicList(fileId);
                                if (response.data?.success && response.data.files) {
                                    const musicItems: MusicItem[] = response.data.files.map((music, index) => {
                                        return {
                                            id: `music-${index}`,
                                            name: music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename,
                                            description: music.description || music.originalFilename || music.filename,
                                            filename: music.filename,
                                            musicPath: getMusicUrlWithHost(music.url),
                                        };
                                    });
                                    setMusicList(musicItems);
                                }
                            } catch (error) {
                                console.error('刷新音乐列表失败:', error);
                            }
                        }
                    }}
                />
            ))}

            <div className={styles.sceneLayout}>
                <div className={styles.stack}>
                    <SceneList
                        sceneData={sceneData}
                        subsceneDataBySceneId={subsceneDataBySceneId}
                        activeSceneId={activeSceneId}
                        activeSubsceneId={activeSubsceneId}
                        mode={mode}
                        getEffectiveImage={getEffectiveImage}
                        onSceneClick={handleSceneClick}
                        onSubsceneClick={handleSubsceneClick}
                        onDeleteClick={onListDeleteClick}
                        onSubsceneDeleteClick={onListSubsceneDeleteClick}
                        onAddNewScene={onListAddNewScene}
                        onAddNewSubscene={onListAddNewSubscene}
                    />
                </div>

                <div className={styles.card}>
                    <SceneDetailActions
                        isAddingNew={isAddingNew}
                        activeSubsceneId={activeSubsceneId}
                        isAddingNewSubscene={isAddingNewSubscene}
                        onConfirmAddNew={handleManualSave}
                        onCancelAddNew={handlers.cancelAddNew}
                        onConfirmSubsceneEdit={handleManualSave}
                        onCancelAddNewSubscene={handlers.cancelAddNewSubscene}
                        onConfirmEdit={handleManualSave}
                    />

                    {isAddingNew && newSceneData ? (
                        <SceneDetailForm
                            imageGenerationPrice={scenePrice}
                            scene={newSceneData}
                            bgmLibrary={bgmLibrary}
                            fileInputRef={newSceneFileInputRef}
                            onFieldChange={(field, value) => {
                                handlers.updateNewSceneField(field, value);
                                setHasUnsavedChanges(true);
                            }}
                            isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === newSceneData.id}
                            generationEtaText={singleSceneEtaText}
                            onImageClick={() => toast.error(t('createGame.confirmAddSceneFirst'))}
                            onUploadChange={handlers.handleUploadSceneImage}
                            onRequestRegenerate={() => toast.error(t('createGame.generateImageFirstScene'))}
                            nameDirty={currentSceneFieldDirtyState.name}
                            descDirty={currentSceneFieldDirtyState.desc}
                            inlineSaveDisabled={isGeneratingSingleSceneImage || isClearingSceneImage}
                            onNameSave={handleManualSave}
                            onDescSave={handleManualSave}
                            sceneType="scenes"
                        />
                    ) : (
                        <>
                            {mode === 'worldInteraction' && activeSubsceneId && activeSubsceneDraft ? (
                                <SceneDetailForm
                                    imageGenerationPrice={LEGACY_WORLD_SCENE_GENERATION_COST}
                                    scene={activeSubsceneDraft}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeSubsceneDraft.id}
                                    generationEtaText={singleSceneEtaText}
                                    isAddingNewSubscene={isAddingNewSubscene}
                                    getEffectiveImage={getEffectiveImage}
                                    onImageClick={handleSceneHeroClick}
                                    onUploadClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={(field, value) => {
                                        handlers.updateSubsceneField(field, value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    onDownloadImage={handleDownloadImage}
                                    nameDirty={currentSceneFieldDirtyState.name}
                                    descDirty={currentSceneFieldDirtyState.desc}
                                    inlineSaveDisabled={isGeneratingSingleSceneImage || isClearingSceneImage}
                                    onNameSave={handleManualSave}
                                    onDescSave={handleManualSave}
                                    sceneType="subscenes"
                                />
                            ) : (activeSceneDraft || activeScene) ? (
                                <SceneDetailForm
                                    imageGenerationPrice={scenePrice}
                                    scene={(activeSceneDraft || activeScene)!}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === (activeSceneDraft || activeScene)!.id}
                                    isClearingImage={isClearingSceneImage}
                                    generationEtaText={singleSceneEtaText}
                                    getEffectiveImage={getEffectiveImage}
                                    onImageClick={handleSceneHeroClick}
                                    onUploadClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onRequestClearImage={handleRequestClearSceneImage}
                                    canClearImage={canClearActiveSceneImage}
                                    onFieldChange={(field, value) => {
                                        setActiveSceneDraft(prev => (prev ? { ...prev, [field]: value } : prev));
                                        setHasUnsavedChanges(true);
                                    }}
                                    onDownloadImage={handleDownloadImage}
                                    nameDirty={currentSceneFieldDirtyState.name}
                                    descDirty={currentSceneFieldDirtyState.desc}
                                    inlineSaveDisabled={isGeneratingSingleSceneImage || isClearingSceneImage}
                                    onNameSave={handleManualSave}
                                    onDescSave={handleManualSave}
                                    sceneType="scenes"
                                />
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                    <p>{t('createGame.noSceneData')}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {(mode === 'worldInteraction' || mode === 'visual') && (
                <MusicList
                    musicList={musicList}
                    onUploadClick={() => setUploadMusicModalOpen(true)}
                    fileId={fileId}
                    mode={mode}
                    sceneApi={sceneApi}
                    onMusicDeleted={async () => {
                        if (fileId && sceneApi) {
                            try {
                                const response = await sceneApi.getMusicList(fileId);
                                if (response.data?.success && response.data.files) {
                                    const musicItems: MusicItem[] = response.data.files.map((music, index) => {
                                        return {
                                            id: `music-${index}`,
                                            name: music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename,
                                            description: music.description || music.originalFilename || music.filename,
                                            filename: music.filename,
                                            musicPath: getMusicUrlWithHost(music.url),
                                        };
                                    });
                                    setMusicList(musicItems);
                                }
                            } catch (error) {
                                console.error('刷新音乐列表失败:', error);
                            }
                        }
                    }}
                />
            )}

            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handlers.handleConfirmDelete}
                onCancel={handlers.handleCancelDelete}
                title={t('createGame.deleteScene')}
                message={t('common.deleteSceneWarning')}
                confirmButtonText={t('common.confirm')}
                cancelButtonText={t('common.thinkLater')}
            />

            <ConfirmModal
                isOpen={subsceneDeleteModalOpen}
                onConfirm={handlers.handleConfirmSubsceneDelete}
                onCancel={handlers.handleCancelSubsceneDelete}
                title={t('createGame.deleteSubScene')}
                message={t('createGame.deleteSubSceneWarning')}
                confirmButtonText={t('common.confirm')}
                cancelButtonText={t('common.thinkLater')}
            />

            <ConfirmModal
                isOpen={sceneCostModalOpen}
                onConfirm={handleConfirmGenerateAllSceneImages}
                onCancel={handleCancelGenerateAllSceneImages}
                title={t('common.pointsDeductionConfirm')}
                message={
                    sceneCostPoints != null
                        ? t('common.batchSceneGenerationConfirm', { points: sceneCostPoints, currentPoints: userPoints, insufficient: sceneCostPoints > userPoints ? t('common.insufficient') : '' })
                        : t('common.deductSomePoints', { currentPoints: userPoints })
                }
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            <ConfirmModal
                isOpen={singleSceneCostModalOpen}
                onConfirm={handleConfirmSingleSceneGenerate}
                onCancel={handleCancelSingleSceneGenerate}
                title={t('common.pointsDeductionConfirm')}
                message={t('common.singleSceneGenerationConfirm', { cost: discountedSceneCost })}
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            {/* 一键生成场景立绘结果弹窗 */}
            <ConfirmModal
                isOpen={clearSceneImageModalOpen}
                onConfirm={handleConfirmClearSceneImage}
                onCancel={handleCancelClearSceneImage}
                title={t('common.clearSceneImage')}
                message={t('common.clearSceneImageConfirm')}
                confirmButtonText={t('common.confirmClear')}
                cancelButtonText={t('common.cancel')}
            />
            <GenerateResultModal
                isOpen={sceneResultModalOpen}
                onClose={() => setSceneResultModalOpen(false)}
                title={t('common.sceneImageGenerationResult')}
                generatedCount={sceneGenerationResult?.generatedCount}
                totalCount={sceneGenerationResult?.totalCount}
                pointsDeducted={sceneGenerationResult?.pointsDeducted}
                remainingPoints={sceneGenerationResult?.remainingPoints}
            />

            <ConfirmModal
                isOpen={worldMapCostModalOpen}
                onConfirm={handleConfirmGenerateWorldMap}
                onCancel={handleCancelGenerateWorldMap}
                title={t('common.pointsDeductionConfirm')}
                message={t('common.worldMapGenerationConfirm', { cost: discountedSceneCost })}
                confirmButtonText={t('common.confirmGenerate')}
                cancelButtonText={t('common.cancel')}
            />

            <UploadMusicModal
                isOpen={uploadMusicModalOpen}
                onClose={() => setUploadMusicModalOpen(false)}
                onConfirm={handleUploadMusic}
            />

            {showBatchSceneProgressOverlay && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingDialog} role="dialog" aria-modal="true" aria-labelledby="batch-scene-gen-title">
                        <div className={styles.plusLoadingHeroCopy} style={{ width: '100%' }}>
                            <div id="batch-scene-gen-title" className={styles.plusLoadingText}>
                                {showSceneContinueFailed
                                    ? (batchSceneStageBoard.stuckItems.length > 0
                                        ? '部分场景背景卡住'
                                        : '场景背景生成结束')
                                    : sceneBoardAllSuccess
                                        ? '场景背景已全部生成'
                                        : t('createGame.generatingScenePortraits')}
                            </div>
                            {isBatchSceneJobRunning && batchSceneEtaText && (
                                <div className={styles.plusLoadingHint}>{batchSceneEtaText}</div>
                            )}
                            {showSceneContinueFailed && (
                                <div className={styles.plusLoadingHint}>
                                    {batchSceneStageBoard.stuckItems.length > 0
                                        ? `有 ${batchSceneStageBoard.stuckItems.length} 项疑似卡住（≥150s）· 失败 ${batchSceneStageBoard.stats.failed} 项`
                                        : `生图已结束 · 失败 ${batchSceneStageBoard.stats.failed} 项`}
                                </div>
                            )}
                            {sceneBoardAllSuccess && !showSceneContinueFailed && (
                                <div className={styles.plusLoadingHint}>
                                    {isGeneratingAllSceneImages ? '正在同步结果与织梦豆…' : '生成完成'}
                                </div>
                            )}
                        </div>

                        <div className={`${styles.plusLoadingSplitStats} ${styles.plusLoadingSplitStatsSingle}`}>
                            <div className={`${styles.plusLoadingStatCard} ${styles.plusLoadingStatGen}`}>
                                <div className={styles.plusLoadingStatTitle}>生图（场景无需抠图）</div>
                                <div className={styles.plusLoadingStatValue}>
                                    {batchSceneStageBoard.stats.generateDone}/{batchSceneStageBoard.stats.total}
                                </div>
                                <div className={styles.plusLoadingStatMeta}>
                                    进行中 {batchSceneStageBoard.stats.generateActive}
                                    · 排队 {batchSceneStageBoard.stats.pending}
                                    · 失败 {batchSceneStageBoard.stats.failed}
                                </div>
                                <div className={styles.plusLoadingStatTrack}>
                                    <div
                                        className={styles.plusLoadingStatTrackFill}
                                        style={{
                                            width: `${batchSceneStageBoard.stats.total > 0
                                                ? Math.round((batchSceneStageBoard.stats.generateDone / batchSceneStageBoard.stats.total) * 100)
                                                : 0}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {batchSceneStageBoard.stuckItems.length > 0 && (
                            <div className={styles.plusLoadingStuck}>
                                可能卡住：
                                {batchSceneStageBoard.stuckItems.map((item) => (
                                    `${item.name || `第 ${item.index + 1} 张`}（生图 ${item.stageElapsedSeconds}s）`
                                )).join('；')}
                            </div>
                        )}

                        <div className={styles.plusLoadingBoardShell}>
                            <div className={styles.plusLoadingLogHeader}>
                                <span className={styles.plusLoadingLogEyebrow}>分项进度</span>
                                <span className={styles.plusLoadingLogLive}>LIVE</span>
                            </div>
                            <div className={styles.plusLoadingBoard}>
                                {batchSceneStageBoard.items.map((item) => (
                                    <div
                                        key={`scene-board-${item.index}-${item.name}`}
                                        className={`${styles.plusLoadingBoardItem} ${batchSceneItemStageClass(item.stage)}`}
                                    >
                                        <div className={styles.plusLoadingBoardTop}>
                                            <span className={styles.plusLoadingBoardName}>
                                                #{item.index + 1} {item.name}
                                            </span>
                                            <span className={styles.plusLoadingBoardStage}>{item.label}</span>
                                        </div>
                                        {item.stage === 'generate_start' && (
                                            <div className={styles.plusLoadingBoardElapsed}>
                                                本阶段已 {item.stageElapsedSeconds}s
                                                {item.stageElapsedSeconds >= 150 ? ' · 疑似卡住' : ''}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {batchSceneLogs.length > 0 && (
                            <div className={styles.plusLoadingLogShell}>
                                <div className={styles.plusLoadingLogHeader}>
                                    <span className={styles.plusLoadingLogEyebrow}>事件日志</span>
                                </div>
                                <div className={styles.plusLoadingLog} ref={batchSceneLogListRef} aria-live="polite">
                                    {batchSceneLogs.map((entry, index) => {
                                        const isActive = index === batchSceneLogs.length - 1;
                                        return (
                                            <div
                                                key={`${index}-${entry.message}`}
                                                className={batchSceneLogStageClass(entry.stage, isActive)}
                                            >
                                                <span className={styles.plusLoadingLogBadge}>
                                                    {batchSceneLogStageLabel(entry.stage)}
                                                </span>
                                                <span className={styles.plusLoadingLogMessage}>{entry.message}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className={styles.plusLoadingFoot}>
                            {(showSceneContinueFailed || isBatchSceneJobRunning) && (
                                <div className={styles.plusLoadingWarn}>
                                    {showSceneContinueFailed
                                        ? `未完成 ${batchSceneRetryTargets.length} 项，可点「重新生成未完成任务」`
                                        : t('createGame.generatingDoNotLeave')}
                                </div>
                            )}
                            <div
                                className={`${styles.plusLoadingFootActions} ${
                                    showSceneContinueFailed ? '' : styles.plusLoadingFootActionsEnd
                                }`}
                            >
                                {showSceneContinueFailed && (
                                    <button
                                        type="button"
                                        className={styles.plusLoadingContinueBtn}
                                        onClick={() => { void handleContinueFailedBatchSceneTasks(); }}
                                    >
                                        重新生成未完成任务
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={styles.plusLoadingCancelBtn}
                                    onClick={() => {
                                        if (showSceneContinueFailed || sceneBoardAllSuccess) {
                                            handlers.dismissSceneBatchProgress();
                                            return;
                                        }
                                        handlers.cancelGenerateAllSceneImages();
                                    }}
                                >
                                    {(showSceneContinueFailed || sceneBoardAllSuccess)
                                        ? '关闭'
                                        : t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <PortraitLightbox
                open={Boolean(sceneLightbox)}
                src={sceneLightbox?.src || null}
                title={sceneLightbox?.title || ''}
                onClose={() => setSceneLightbox(null)}
            />

            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={handlePendingSave}
                onDiscard={() => {
                    closePendingSaveModal();
                    discardCurrentPendingChanges();
                    hasUnsavedChangesRef.current = false;
                    setHasUnsavedChanges(false);
                    executePendingAction();
                }}
                onCancel={clearPendingActionState}
                title={t('common.unsavedChanges')}
                message={t('common.unsavedChangesMessage')}
                saveButtonText={t('common.save')}
                discardButtonText={t('common.discard')}
            />
        </div>
    );
});

ScenesPanel.displayName = 'ScenesPanel';

export default ScenesPanel;
