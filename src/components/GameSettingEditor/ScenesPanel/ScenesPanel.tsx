import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import { toast } from 'react-hot-toast';
import styles from './ScenesPanel.module.css';
import { getImageUrl, getMusicUrlWithHost, IMAGE_GENERATION_COST } from '../../../utils/constants';
import type { AllGameData } from '../../../api/galgame/EditorData.type';
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
import { createSceneHandlers, type LocalScene as HandlerLocalScene } from './handlers';
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

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

/**
 * 暂存图片类型 - 用于图片选择/生成后、确认修改前的预览
 */
interface PendingImage {
    file?: File;                    // 待上传的文件
    previewUrl: string;            // 本地预览 URL
    sourceType: 'upload' | 'generate' | 'url'; // 来源类型
    variant: string;                // 图片类型：'base'
}

type LocalScene = HandlerLocalScene;

interface ScenesPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void;
    mode?: string;
}

export interface ScenesPanelRef {
    checkBeforeLeave: () => boolean;
}

const ScenesPanel = React.forwardRef<ScenesPanelRef, ScenesPanelProps>(({ 
    gameData, 
    fileId, 
    onGetData, 
    onDataChange, 
    mode = 'visual',
}, ref) => {
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
    
    const [isGeneratingAllSceneImages, setIsGeneratingAllSceneImages] = useState<boolean>(false);
    const [isGeneratingSingleSceneImage, setIsGeneratingSingleSceneImage] = useState<boolean>(false);
    const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
    const [isGeneratingWorldMap, setIsGeneratingWorldMap] = useState<boolean>(false);
    const [isLoadingSceneCost, setIsLoadingSceneCost] = useState<boolean>(false);
    
    const [worldMapImageOverride, setWorldMapImageOverride] = useState<string | null>(null);
    const [sceneCostPoints, setSceneCostPoints] = useState<number | null>(null);
    
    const [musicList, setMusicList] = useState<MusicItem[]>([]);
    const [uploadMusicModalOpen, setUploadMusicModalOpen] = useState<boolean>(false);
    
    const sceneFileInputRef = useRef<HTMLInputElement>(null);
    const newSceneFileInputRef = useRef<HTMLInputElement>(null);
    const worldMapFileInputRef = useRef<HTMLInputElement>(null);
    const originalSceneDataRef = useRef<LocalScene[]>([]);

    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene';
        targetSceneId?: string | null;
        targetSubsceneId?: string | null;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);

    // 暂存图片相关状态
    const [pendingImages, setPendingImages] = useState<{ [sceneId: string]: { [variant: string]: PendingImage } }>({});
    const pendingImageUrlsRef = useRef<{ [key: string]: string }>({});

    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

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

    // 丢弃当前场景的暂存数据并恢复到原始数据
    const discardCurrentScenePendingChanges = useCallback(() => {
        if (!activeSceneId) return;
        
        const originalScene = originalSceneDataRef.current.find(s => s.id === activeSceneId);
        if (originalScene) {
            setSceneData(prev => prev.map(scene => (
                scene.id === activeSceneId ? originalScene : scene
            )));
            setActiveSceneDraft(originalScene);
        }
        clearPendingImagesForScene(activeSceneId);
    }, [activeSceneId, clearPendingImagesForScene]);

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

    useEffect(() => {
        if (isAddingNew) return;
        if (activeSubsceneId) return;
        if (activeScene) {
            setActiveSceneDraft(activeScene);
        } else {
            setActiveSceneDraft(null);
        }
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
                activeSceneId,
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
            onDataChange,
        ]
    );

    const handlersRef = useRef(handlers);
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

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

    useEffect(() => {
        if (!gameData) return;
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
                        nextMap[s.id] = (s.subscenes || []) as WorldSubScene[];
                    }
                });
                setSubsceneDataBySceneId(nextMap);
            }
            originalSceneDataRef.current = JSON.parse(JSON.stringify(convertedScenes));
            setHasUnsavedChanges(false);
            if (convertedScenes.length > 0) {
                setActiveSceneId(prev => prev || convertedScenes[0].id);
            }
        }
    }, [gameData]);

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
        if (!pendingAction) return;

        if (pendingAction.type === 'switchScene') {
            setIsAddingNew(false);
            setNewSceneData(null);
            if (isAddingNewSubscene) {
                setIsAddingNewSubscene(false);
            }
            setActiveSubsceneDraft(null);
            setActiveSceneId(pendingAction.targetSceneId || '');
            setActiveSubsceneId(null);
        }

        setPendingAction(null);
    }, [pendingAction, isAddingNewSubscene]);

    const checkBeforeSwitch = useCallback((action: { type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene'; targetSceneId?: string | null; targetSubsceneId?: string | null }) => {
        if (hasUnsavedChanges) {
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        return true;
    }, [hasUnsavedChanges]);

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
        const processedSubsceneImage = subscene?.image ? getImageUrl(subscene.image as any) : '';
        
        setActiveSubsceneDraft({
            id: subsceneId,
            name: subscene?.name || '未命名子场景',
            type: '',
            desc: (subscene as any)?.description || '',
            image: processedSubsceneImage || '',
            bgmId: sceneData.find(s => s.id === sceneId)?.bgmId || '',
        });
    }, [isAddingNewSubscene, sceneData, checkBeforeSwitch, subsceneDataBySceneId]);

    const handleConfirmGenerateAllSceneImages = useCallback(async () => {
        setSceneCostModalOpen(false);
        await handlers.confirmGenerateAllSceneImages(sceneCostPoints);
        onDataChange?.();
    }, [handlers, sceneCostPoints, onDataChange, userPoints]);

    const handleCancelGenerateAllSceneImages = useCallback(() => {
        setSceneCostModalOpen(false);
    }, []);

    const handleConfirmSingleSceneGenerate = useCallback(async () => {
        setSingleSceneCostModalOpen(false);
        await handlers.confirmSingleSceneGenerate();
    }, [handlers]);

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
            toast.error('缺少必要数据，无法下载');
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
            toast.error('缺少图片路径，无法下载');
            return;
        }

        try {
            let blob: Blob;

            // /api/ 路径：fetch + blob 方式下载
            if (finalImagePath.startsWith('/api/')) {
                const fullUrl = `${HOST_ADDRESS}${finalImagePath}`;
                const response = await fetch(fullUrl);
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
            toast.success('图片下载成功');
        } catch (error) {
            console.error('下载图片失败:', error);
            toast.error('下载图片失败，请稍后重试');
        }
    }, [fileId, sceneApi]);

    const handleUploadMusic = useCallback(async (file: File, name: string, description: string) => {
        if (!fileId || !sceneApi) {
            toast.error('缺少必要数据，无法上传');
            return;
        }

        try {
            const response = await sceneApi.uploadMusic(fileId, file, name, description);
            if (response.data.success) {
                toast.success('音乐上传成功');
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
                toast.error('音乐上传失败');
            }
        } catch (error) {
            console.error('上传音乐失败:', error);
            toast.error('上传音乐失败，请稍后重试');
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
                    <h2>场景背景 & BGM 绑定</h2>
                    <p className={styles.subtitle}>AI 生成场景描述，可直接选择上一步上传的 BGM</p>
                </div>
                <button
                    className={`${styles.ghost} ${styles.generateButton}`}
                    onClick={() => handlers.openSceneCostModal()}
                    disabled={isGeneratingAllSceneImages || isLoadingSceneCost || isBlockingSwitch}
                >
                    <img
                        src={`${import.meta.env.BASE_URL}data/assets/金币1.png`}
                        alt=""
                        className={styles.priceIcon}
                    />
                    <div className={styles.buttonTextContainer}>
                        <span className={styles.buttonMainText}>
                            {isGeneratingAllSceneImages ? '生成中...' : '一键生成所有场景立绘'}
                        </span>
                        <span className={styles.buttonSubText}>{IMAGE_GENERATION_COST}积分/张</span>
                    </div>
                </button>
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
                        onConfirmAddNew={async () => {
                            await handlers.confirmAddNew();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                        }}
                        onCancelAddNew={handlers.cancelAddNew}
                        onConfirmSubsceneEdit={async () => {
                            await handlers.confirmSubsceneEdit();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                        }}
                        onCancelAddNewSubscene={handlers.cancelAddNewSubscene}
                        onConfirmEdit={async () => {
                            if (activeSceneDraft || activeScene) {
                                await handlers.confirmEdit((activeSceneDraft || activeScene)!);
                                setActiveSceneDraft((prev) => prev || (activeSceneDraft || activeScene));
                                originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                                setHasUnsavedChanges(false);
                            }
                        }}
                    />

                    {isAddingNew && newSceneData ? (
                        <SceneDetailForm
                            scene={newSceneData}
                            bgmLibrary={bgmLibrary}
                            fileInputRef={newSceneFileInputRef}
                            onFieldChange={(field, value) => {
                                handlers.updateNewSceneField(field, value);
                                setHasUnsavedChanges(true);
                            }}
                            isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === newSceneData.id}
                            onImageClick={() => toast.error('请先确认新增场景，然后再上传图片')}
                            onUploadChange={handlers.handleUploadSceneImage}
                            onRequestRegenerate={() => toast.error('请先确认新增场景，然后再生成图片')}
                            sceneType="scenes"
                        />
                    ) : (
                        <>
                            {mode === 'worldInteraction' && activeSubsceneId && activeSubsceneDraft ? (
                                <SceneDetailForm
                                    scene={activeSubsceneDraft}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeSubsceneDraft.id}
                                    isAddingNewSubscene={isAddingNewSubscene}
                                    getEffectiveImage={getEffectiveImage}
                                    onImageClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={(field, value) => {
                                        handlers.updateSubsceneField(field, value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    onDownloadImage={handleDownloadImage}
                                    sceneType="subscenes"
                                />
                            ) : (activeSceneDraft || activeScene) ? (
                                <SceneDetailForm
                                    scene={(activeSceneDraft || activeScene)!}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === (activeSceneDraft || activeScene)!.id}
                                    getEffectiveImage={getEffectiveImage}
                                    onImageClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={(field, value) => {
                                        setActiveSceneDraft(prev => (prev ? { ...prev, [field]: value } : prev));
                                        setHasUnsavedChanges(true);
                                    }}
                                    onDownloadImage={handleDownloadImage}
                                    sceneType="scenes"
                                />
                            ) : (
                                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                                    <p>暂无场景数据，请点击左侧"新增场景"按钮添加场景</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={deleteModalOpen}
                onConfirm={handlers.handleConfirmDelete}
                onCancel={handlers.handleCancelDelete}
                title="删除场景"
                message="删除后场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            <ConfirmModal
                isOpen={subsceneDeleteModalOpen}
                onConfirm={handlers.handleConfirmSubsceneDelete}
                onCancel={handlers.handleCancelSubsceneDelete}
                title="删除子场景"
                message="删除后子场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            <ConfirmModal
                isOpen={sceneCostModalOpen}
                onConfirm={handleConfirmGenerateAllSceneImages}
                onCancel={handleCancelGenerateAllSceneImages}
                title="积分扣除确认"
                message={
                    sceneCostPoints != null
                        ? `本次一键生成场景立绘将扣除 ${sceneCostPoints} 积分（当前积分 ${userPoints}${sceneCostPoints > userPoints ? '，积分不足' : ''}），是否继续？`
                        : `将扣除一定积分（当前积分 ${userPoints}），是否继续？`
                }
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            <ConfirmModal
                isOpen={singleSceneCostModalOpen}
                onConfirm={handleConfirmSingleSceneGenerate}
                onCancel={handleCancelSingleSceneGenerate}
                title="积分扣除确认"
                message={`本次生成场景立绘将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            <ConfirmModal
                isOpen={worldMapCostModalOpen}
                onConfirm={handleConfirmGenerateWorldMap}
                onCancel={handleCancelGenerateWorldMap}
                title="积分扣除确认"
                message={`本次生成大地图将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            <UploadMusicModal
                isOpen={uploadMusicModalOpen}
                onClose={() => setUploadMusicModalOpen(false)}
                onConfirm={handleUploadMusic}
            />

            {isGeneratingAllSceneImages && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成场景立绘...</div>
                </div>
            )}

            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    try {
                        if (isAddingNew && newSceneData) {
                            await handlers.confirmAddNew();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                        } else if (isAddingNewSubscene && activeSubsceneDraft) {
                            await handlers.confirmSubsceneEdit();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                        } else if (activeSceneDraft || activeScene) {
                            await handlers.confirmEdit((activeSceneDraft || activeScene)!);
                            setActiveSceneDraft((prev) => prev || (activeSceneDraft || activeScene));
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                        } else {
                            setHasUnsavedChanges(false);
                        }
                        setSaveConfirmModalOpen(false);
                        setIsBlockingSwitch(false);
                        executePendingAction();
                    } catch (error) {
                        toast.error('保存失败，请重试');
                    }
                }}
                onDiscard={() => {
                    discardCurrentScenePendingChanges();
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

ScenesPanel.displayName = 'ScenesPanel';

export default ScenesPanel;
