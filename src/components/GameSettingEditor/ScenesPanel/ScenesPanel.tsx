import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import styles from './ScenesPanel.module.css';
import { IMAGE_GENERATION_COST } from '../../../utils/constants';
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
import { addImageTimestamp, DEFAULT_SCENE_IMAGE, DEFAULT_WORLD_MAP_IMAGE } from './utils';
import DeletModal from '../../goodsModal/DeletModal';
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
    isLoading?: boolean;
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
    onDataChange?: () => void;
    mode?: string;
}

// ==================== 组件主体 ====================
const ScenesPanel: React.FC<ScenesPanelProps> = ({ 
    gameData, 
    isLoading = false, 
    fileId, 
    onGetData, 
    onDataChange, 
    mode = 'visual' 
}) => {
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

    // 大地图预览地址
    const worldMapPreviewSrc = (() => {
        if (!worldMapImage) return DEFAULT_WORLD_MAP_IMAGE;
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        return isLocalStatic ? worldMapImage : `${worldMapImage}/dummy`;
    })();

    // 当前激活的场景
    const activeScene = sceneData.find(s => s.id === activeSceneId) || sceneData[0];

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
                addImageTimestamp,
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
                
                return {
                    id: scene.id || '',
                    name: scene.name,
                    type: sceneType,
                    desc: scene.description || '',
                    image: addImageTimestamp(sceneImage) || DEFAULT_SCENE_IMAGE,
                    bgmId: soundtrackFilename, // 保存文件名，用于匹配音乐列表
                };
            });

            setSceneData(convertedScenes);
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
                    // 将文件列表转换为 MusicItem 格式
                    const musicItems: MusicItem[] = response.data.files.map((music, index) => {
                        return {
                            id: `music-${index}`,
                            name: music.name || music.originalFilename?.replace(/\.[^/.]+$/, '') || music.filename,
                            description: music.description || music.originalFilename || music.filename,
                            filename: music.filename,
                            musicPath: music.url,
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

    // ==================== 事件处理函数 ====================
    // 场景点击处理
    const handleSceneClick = useCallback((sceneId: string) => {
        setIsAddingNew(false);
        setNewSceneData(null);
        if (isAddingNewSubscene) {
            setIsAddingNewSubscene(false);
        }
        setActiveSubsceneDraft(null);
        setActiveSceneId(sceneId);
        setActiveSubsceneId(null);
        setActiveSubsceneDraft(null);
    }, [isAddingNewSubscene]);

    // 子场景点击处理
    const handleSubsceneClick = useCallback((sceneId: string, subsceneId: string, subscene: WorldSubScene) => {
        setIsAddingNew(false);
        setNewSceneData(null);
        if (isAddingNewSubscene) {
            setIsAddingNewSubscene(false);
        }
        setActiveSceneId(sceneId);
        setActiveSubsceneId(subsceneId);
        setActiveSubsceneDraft({
            id: subsceneId,
            name: subscene.name || '未命名子场景',
            type: '',
            desc: subscene.description || '',
            image: addImageTimestamp(subscene.image) || '',
            bgmId: sceneData.find(s => s.id === sceneId)?.bgmId || '',
        });
    }, [isAddingNewSubscene, sceneData]);

    // 一键生成所有场景立绘 - 确认/取消
    const handleConfirmGenerateAllSceneImages = useCallback(async () => {
        setSceneCostModalOpen(false);
        await handlers.confirmGenerateAllSceneImages(sceneCostPoints);
        onDataChange?.();
    }, [handlers, sceneCostPoints, onDataChange]);

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
                    // 后端返回的数据结构：{ filename, originalFilename, name, description, uploadedAt, path, url }
                    const uploadedFilename = response.data.filename || file.name;
                    const musicItems: MusicItem[] = listResponse.data.files.map((music, index) => {
                        // 检查是否是刚上传的文件（通过 filename 匹配）
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
                            filename: music.filename, // 使用 filename 用于 API 调用
                            musicPath: music.url, // 如果有 URL，可以用于直接播放
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
                    disabled={isGeneratingAllSceneImages || isLoadingSceneCost}
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
                                            musicPath: music.url,
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
                            onDataChange?.();
                        }}
                        onCancelAddNew={handlers.cancelAddNew}
                        onConfirmSubsceneEdit={async () => {
                            await handlers.confirmSubsceneEdit();
                            onDataChange?.();
                        }}
                        onCancelAddNewSubscene={handlers.cancelAddNewSubscene}
                        onConfirmEdit={async () => {
                            if (activeScene) {
                                await handlers.confirmEdit(activeScene);
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
                            isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === newSceneData.id}
                            onImageClick={() => toast.error('请先确认新增场景，然后再上传图片')}
                            onUploadChange={handlers.handleUploadSceneImage}
                            onRequestRegenerate={() => toast.error('请先确认新增场景，然后再生成图片')}
                            onFieldChange={handlers.updateNewSceneField}
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
                                    onFieldChange={handlers.updateSubsceneField}
                                    onDownloadImage={handleDownloadImage}
                                    sceneType="subscenes"
                                />
                            ) : (
                                <SceneDetailForm
                                    scene={activeScene}
                                    bgmLibrary={bgmLibrary}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeScene.id}
                                    onImageClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={handlers.updateSceneField}
                                    onDownloadImage={handleDownloadImage}
                                    sceneType="scenes"
                                />
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* 模态框 */}
            <DeletModal
                isOpen={deleteModalOpen}
                onDelete={handlers.handleConfirmDelete}
                onCancel={handlers.handleCancelDelete}
                title="删除场景"
                message="删除后场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            <DeletModal
                isOpen={subsceneDeleteModalOpen}
                onDelete={handlers.handleConfirmSubsceneDelete}
                onCancel={handlers.handleCancelSubsceneDelete}
                title="删除子场景"
                message="删除后子场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            <DeletModal
                isOpen={sceneCostModalOpen}
                onDelete={handleConfirmGenerateAllSceneImages}
                onCancel={handleCancelGenerateAllSceneImages}
                title="积分扣除确认"
                message={
                    sceneCostPoints != null
                        ? `本次一键生成场景立绘将扣除 ${sceneCostPoints} 积分，是否继续？`
                        : '将扣除一定积分，是否继续？'
                }
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            <DeletModal
                isOpen={singleSceneCostModalOpen}
                onDelete={handleConfirmSingleSceneGenerate}
                onCancel={handleCancelSingleSceneGenerate}
                title="积分扣除确认"
                message={`本次生成场景立绘将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            <DeletModal
                isOpen={worldMapCostModalOpen}
                onDelete={handleConfirmGenerateWorldMap}
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
        </div>
    );
};

export default ScenesPanel;
