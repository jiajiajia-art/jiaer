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
    isWorldInteractionMode, 
    type WorldSubScene
} from '../editorCompat';
import { createSceneApiHelpers } from './apiHelpers';
import { createSceneHandlers, type LocalScene as HandlerLocalScene } from './handlers';
import SceneDetailForm from './SceneDetailForm';
import SceneList from './SceneList';
import WorldMapCard from './WorldMapCard';
import SceneDetailActions from './SceneDetailActions';
import { addImageTimestamp, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from '../../../utils/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import ConfirmModal from '../../GoodsModal/ConfirmModal';
import SaveConfirmModal from '../../GoodsModal/SaveConfirmModal';
import MusicList, { type MusicItem } from '../UploadMusic/MusicList';
import UploadMusicModal from '../UploadMusic/UploadMusicModal';

// ==================== 类型定义 ====================
interface BgmItem {
    id: string;
    name: string;
    description: string;
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

// ==================== 组件主体 ====================
const ScenesPanel = React.forwardRef<ScenesPanelRef, ScenesPanelProps>(({ 
    gameData, 
    fileId, 
    onGetData, 
    onDataChange, 
    mode = 'visual',
}, ref) => {
    // ==================== 状态定义 ====================
    // 场景相关状态
    const [activeSceneId, setActiveSceneId] = useState<string>('');
    const [activeSubsceneId, setActiveSubsceneId] = useState<string | null>(null);
    const [activeSubsceneDraft, setActiveSubsceneDraft] = useState<LocalScene | null>(null);
    const [sceneData, setSceneData] = useState<LocalScene[]>([]);
    
    // 新增/编辑模式状态
    const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
    const [newSceneData, setNewSceneData] = useState<LocalScene | null>(null);
    const [isAddingNewSubscene, setIsAddingNewSubscene] = useState<boolean>(false);
    
    // 模态框状态
    const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
    const [subsceneDeleteModalOpen, setSubsceneDeleteModalOpen] = useState<boolean>(false);
    const [sceneCostModalOpen, setSceneCostModalOpen] = useState<boolean>(false);
    const [singleSceneCostModalOpen, setSingleSceneCostModalOpen] = useState<boolean>(false);
    const [worldMapCostModalOpen, setWorldMapCostModalOpen] = useState<boolean>(false);
    
    // 加载和生成状态
    const [isGeneratingAllSceneImages, setIsGeneratingAllSceneImages] = useState<boolean>(false);
    const [isGeneratingSingleSceneImage, setIsGeneratingSingleSceneImage] = useState<boolean>(false);
    const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
    const [isGeneratingWorldMap, setIsGeneratingWorldMap] = useState<boolean>(false);
    const [isLoadingSceneCost, setIsLoadingSceneCost] = useState<boolean>(false);
    
    // 其他状态
    const [worldMapImageOverride, setWorldMapImageOverride] = useState<string | null>(null);
    const [sceneCostPoints, setSceneCostPoints] = useState<number | null>(null);
    
    // 音乐相关状态
    const [musicList, setMusicList] = useState<MusicItem[]>([]);
    const [uploadMusicModalOpen, setUploadMusicModalOpen] = useState<boolean>(false);
    
    // Refs
    const sceneFileInputRef = useRef<HTMLInputElement>(null);
    const newSceneFileInputRef = useRef<HTMLInputElement>(null);
    const worldMapFileInputRef = useRef<HTMLInputElement>(null);
    const originalSceneDataRef = useRef<LocalScene[]>([]);

    // 未保存修改相关状态
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveConfirmModalOpen, setSaveConfirmModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<{
        type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene';
        targetSceneId?: string | null;
        targetSubsceneId?: string | null;
    } | null>(null);
    const [isBlockingSwitch, setIsBlockingSwitch] = useState(false);

    // 使用 ref 来存储最新的状态值，避免闭包问题
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    const isBlockingSwitchRef = useRef(isBlockingSwitch);
    
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [hasUnsavedChanges]);
    
    useEffect(() => {
        isBlockingSwitchRef.current = isBlockingSwitch;
    }, [isBlockingSwitch]);

    // 检测是否有未保存的修改（通过比较当前数据和原始数据）
    // 这里有意忽略场景 / 子场景图片字段，避免「已上传并保存的图片」导致误判为未保存
    useEffect(() => {
        if (originalSceneDataRef.current.length === 0 && sceneData.length === 0) {
            return;
        }

        // 归一化场景数据：排除临时场景，并忽略图片相关字段（scene.image）
        const normalizeScenes = (list: LocalScene[]) =>
            list
                .filter(s => !s.id.startsWith('temp-'))
                .map((s) => ({
                    ...s,
                    image: '', // 忽略场景大图
                }));

        const currentDataStr = JSON.stringify(normalizeScenes(sceneData));
        const originalDataStr = JSON.stringify(normalizeScenes(originalSceneDataRef.current));
        const hasChanges = currentDataStr !== originalDataStr;
        
        // 如果数据确实有变化，则设置
        if (hasChanges) {
            setHasUnsavedChanges(true);
        } else {
            // 如果数据没有变化，清除标记
            setHasUnsavedChanges(false);
        }
    }, [sceneData]);
    
    // 将音乐列表转换为 BGM 库格式
    const bgmLibrary = useMemo<BgmItem[]>(() => {
        return musicList.map(music => ({
            id: music.filename,
            name: music.name,
            description: music.description,
        }));
    }, [musicList]);

    // 大地图图片
    const worldMapImage = worldMapImageOverride
        ? worldMapImageOverride
        : (gameData && isWorldInteractionMode(gameData) && gameData.worldSetting?.worldMapImage 
            ? gameData.worldSetting.worldMapImage 
            : null);

    // 用户积分
    const { user, updateUser } = useAuthStore();
    const userPoints = user?.user?.points ?? 0;

    // 大地图预览地址
    const worldMapPreviewSrc = (() => {
        if (!worldMapImage) return DEFAULT_WORLD_MAP_IMAGE;
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        return isLocalStatic ? worldMapImage : `${worldMapImage}/dummy`;
    })();

    // 当前激活的场景（如果 sceneData 为空，activeScene 为 null）
    const activeScene = sceneData.length > 0 
        ? (sceneData.find(s => s.id === activeSceneId) || sceneData[0])
        : null;

    // ==================== API 和 Handlers ====================
    const sceneApi = useMemo(() => createSceneApiHelpers(mode), [mode]);

    // 模态框回调函数
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

    // 创建业务 handlers
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
                isAddingNew,
                newSceneData,
                isAddingNewSubscene,
                // setters 和 refs 是稳定的，不需要在依赖数组中
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
                sceneFileInputRef,
                newSceneFileInputRef,
                worldMapFileInputRef,
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
            isAddingNew,
            newSceneData,
            isAddingNewSubscene,
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


    // ==================== 副作用 ====================
    // 当 gameData 变化时，填充场景数据
    useEffect(() => {
        if (!gameData) return;
        const scenes = getScenes(gameData);
        if (scenes && scenes.length > 0) {
            const convertedScenes: LocalScene[] = scenes.map((scene) => {
                const sceneType = 'type' in scene ? (scene.type || '') : '';
                const sceneImage = scene.image || '';
                // 从 soundtrack 中提取文件名（可能包含路径）
                const sceneSoundtrack = scene.soundtrack || '';
                const soundtrackFilename = sceneSoundtrack ? (sceneSoundtrack) : '';
                
                // 先处理图片路径，再添加时间戳
                const processedImagePath = sceneImage ? getImageUrl(sceneImage) : '';
                const imageWithTimestamp = processedImagePath ? addImageTimestamp(processedImagePath) : '';
                
                return {
                    id: scene.id || '',
                    name: scene.name,
                    type: sceneType,
                    desc: scene.description || '',
                    image: imageWithTimestamp || DEFAULT_SCENE_IMAGE,
                    bgmId: soundtrackFilename, // 保存文件名，用于匹配音乐列表
                };
            });

            setSceneData(convertedScenes);
            // 保存原始数据用于比较
            originalSceneDataRef.current = JSON.parse(JSON.stringify(convertedScenes));
            setHasUnsavedChanges(false);
            if (convertedScenes.length > 0) {
                setActiveSceneId(prev => prev || convertedScenes[0].id);
            }
        }
    }, [gameData]);

    // 当数据保存成功后，更新原始数据
    useEffect(() => {
        if (onDataChange) {
            // 当 onDataChange 被调用时，说明数据已保存，更新原始数据
            const currentDataStr = JSON.stringify(sceneData);
            const originalDataStr = JSON.stringify(originalSceneDataRef.current);
            if (currentDataStr !== originalDataStr) {
                // 数据已变化但还未保存，保持 hasUnsavedChanges 为 true
                // 如果数据已保存，会在 gameData 变化时重置
            }
        }
    }, [sceneData, onDataChange]);

    useEffect(() => {
        const loadMusicList = async () => {
            if (!fileId || (mode !== 'worldInteraction' && mode !== 'visual') || !sceneApi) return;
            
            try {
                const response = await sceneApi.getMusicList(fileId);
                if (response.data?.success && response.data.files) {
                    // 将文件列表转换为 MusicItem 格式
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

    // 将 sceneData 转换为 sceneSetting 格式
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
                    subscenes: originalSubscenes,
                };
            });

        return { scenes };
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

    // 执行待处理的操作
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
        } else if (pendingAction.type === 'switchSubscene') {
            // 这个操作会在 handleSubsceneClick 中执行，这里不需要重复
        } else if (pendingAction.type === 'createScene') {
            // 这个操作会在创建场景的函数中执行，这里不需要重复
        }

        setPendingAction(null);
    }, [pendingAction, isAddingNewSubscene]);

    // 检查是否可以切换（如果有未保存修改，显示确认弹窗）
    const checkBeforeSwitch = useCallback((action: { type: 'switchScene' | 'switchSubscene' | 'switchPanel' | 'createScene'; targetSceneId?: string | null; targetSubsceneId?: string | null }) => {
        if (hasUnsavedChanges) {
            setPendingAction(action);
            setSaveConfirmModalOpen(true);
            setIsBlockingSwitch(true);
            return false;
        }
        return true;
    }, [hasUnsavedChanges]);

    // 暴露给父组件的方法，用于在切换面板前检查
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

    // ==================== 事件处理函数 ====================
    // 场景点击处理
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

    // 子场景点击处理
    const handleSubsceneClick = useCallback((sceneId: string, subsceneId: string, subscene: WorldSubScene) => {
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
        
        // 先处理图片路径，再添加时间戳
        const processedSubsceneImage = subscene.image ? getImageUrl(subscene.image) : '';
        const subsceneImageWithTimestamp = processedSubsceneImage ? addImageTimestamp(processedSubsceneImage) : '';
        
        setActiveSubsceneDraft({
            id: subsceneId,
            name: subscene.name || '未命名子场景',
            type: '',
            desc: subscene.description || '',
            image: subsceneImageWithTimestamp || '',
            bgmId: sceneData.find(s => s.id === sceneId)?.bgmId || '',
        });
    }, [isAddingNewSubscene, sceneData, checkBeforeSwitch]);

    // 一键生成所有场景立绘 - 确认/取消
    const handleConfirmGenerateAllSceneImages = useCallback(async () => {
        setSceneCostModalOpen(false);
        await handlers.confirmGenerateAllSceneImages(sceneCostPoints);
        onDataChange?.();
    }, [handlers, sceneCostPoints, onDataChange, userPoints]);

    const handleCancelGenerateAllSceneImages = useCallback(() => {
        setSceneCostModalOpen(false);
    }, []);

    // 单个场景立绘生成 - 确认/取消
    const handleConfirmSingleSceneGenerate = useCallback(async () => {
        setSingleSceneCostModalOpen(false);
        await handlers.confirmSingleSceneGenerate();
    }, [handlers]);

    const handleCancelSingleSceneGenerate = useCallback(() => {
        setSingleSceneCostModalOpen(false);
        handlers.cancelSingleSceneGenerate();
    }, [handlers]);

    // 大地图生成 - 确认/取消
    const handleConfirmGenerateWorldMap = useCallback(async () => {
        setWorldMapCostModalOpen(false);
        await handlers.confirmGenerateWorldMap();
        onDataChange?.();
    }, [handlers, onDataChange]);

    const handleCancelGenerateWorldMap = useCallback(() => {
        setWorldMapCostModalOpen(false);
        handlers.cancelGenerateWorldMap();
    }, [handlers]);

    // 下载图片
    const handleDownloadImage = useCallback(async (
        type: 'npcs' | 'scenes' | 'subscenes' | 'worldMap', 
        id: string, 
        variant?: string
    ) => {
        if (!fileId || !sceneApi) {
            toast.error('缺少必要数据，无法下载');
            return;
        }

        try {
            const response = await sceneApi.downloadImage(fileId, type, id, variant);
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
    }, [fileId, sceneApi]);

    // 上传音乐
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
            {/* 世界大地图：仅世界交互模式下显示 */}
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

            {/* 面板头部 */}
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

            {/* 音乐列表模块 */}
            {(mode === 'worldInteraction' || mode === 'visual') && (
                <MusicList
                    musicList={musicList}
                    onUploadClick={() => setUploadMusicModalOpen(true)}
                    fileId={fileId}
                    mode={mode}
                    sceneApi={sceneApi}
                    onMusicDeleted={async () => {
                        // 删除成功后刷新音乐列表
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

            {/* 主要内容区域 */}
            <div className={styles.sceneLayout}>
                {/* 左栏：场景列表 */}
                <div className={styles.stack}>
                    <SceneList
                        sceneData={sceneData}
                        activeSceneId={activeSceneId}
                        activeSubsceneId={activeSubsceneId}
                        mode={mode}
                        gameData={gameData}
                        onSceneClick={handleSceneClick}
                        onSubsceneClick={handleSubsceneClick}
                        onDeleteClick={handlers.handleDeleteClick}
                        onSubsceneDeleteClick={handlers.handleSubsceneDeleteClick}
                        onAddNewScene={handlers.openAddNewPanel}
                        onAddNewSubscene={handlers.openAddNewSubscene}
                    />
                </div>

                {/* 右栏：场景详情 */}
                <div className={styles.card}>
                    <SceneDetailActions
                        isAddingNew={isAddingNew}
                        activeSubsceneId={activeSubsceneId}
                        isAddingNewSubscene={isAddingNewSubscene}
                        onConfirmAddNew={async () => {
                            await handlers.confirmAddNew();
                            // 保存成功后，更新原始数据并清除未保存状态
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                            onDataChange?.();
                        }}
                        onCancelAddNew={handlers.cancelAddNew}
                        onConfirmSubsceneEdit={async () => {
                            await handlers.confirmSubsceneEdit();
                            // 保存成功后，更新原始数据并清除未保存状态
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                            onDataChange?.();
                        }}
                        onCancelAddNewSubscene={handlers.cancelAddNewSubscene}
                        onConfirmEdit={async () => {
                            if (activeScene) {
                                await handlers.confirmEdit(activeScene);
                                // 保存成功后，更新原始数据并清除未保存状态
                                originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                                setHasUnsavedChanges(false);
                                onDataChange?.();
                            }
                        }}
                    />

                    {/* 场景详情表单 */}
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
                            ) : activeScene ? (
                                <SceneDetailForm
                                    scene={activeScene}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeScene.id}
                                    onImageClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={(field, value) => {
                                        handlers.updateSceneField(field, value);
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

            {/* 模态框 */}
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

            {/* 上传音乐弹窗 */}
            <UploadMusicModal
                isOpen={uploadMusicModalOpen}
                onClose={() => setUploadMusicModalOpen(false)}
                onConfirm={handleUploadMusic}
            />

            {/* 加载遮罩 */}
            {isGeneratingAllSceneImages && (
                <div className={styles.plusLoadingOverlay}>
                    <div className={styles.plusLoadingSpinner}></div>
                    <div className={styles.plusLoadingText}>正在生成场景立绘...</div>
                </div>
            )}

            {/* 保存确认弹窗 */}
            <SaveConfirmModal
                isOpen={saveConfirmModalOpen}
                onSave={async () => {
                    // 保存当前正在编辑的场景/子场景，而不是所有场景
                    try {
                        if (isAddingNew && newSceneData) {
                            // 正在新增场景
                            await handlers.confirmAddNew();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                            onDataChange?.();
                        } else if (isAddingNewSubscene && activeSubsceneDraft) {
                            // 正在新增子场景
                            await handlers.confirmSubsceneEdit();
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                            onDataChange?.();
                        } else if (activeScene) {
                            // 正在编辑场景
                            await handlers.confirmEdit(activeScene);
                            originalSceneDataRef.current = JSON.parse(JSON.stringify(sceneData));
                            setHasUnsavedChanges(false);
                            onDataChange?.();
                        } else {
                            // 没有正在编辑的内容，直接清除状态
                            setHasUnsavedChanges(false);
                        }
                        setSaveConfirmModalOpen(false);
                        setIsBlockingSwitch(false);
                        executePendingAction();
                    } catch (error) {
                        toast.error('保存失败，请重试');
                        // 保存失败时不关闭弹窗，不执行待处理操作
                    }
                }}
                onDiscard={() => {
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
