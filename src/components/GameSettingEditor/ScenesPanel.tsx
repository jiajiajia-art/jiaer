import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from './ScenesPanel.module.css';
import { IMAGE_GENERATION_COST } from '../../utils/constants';
import type { AllGameData } from '../../api/galgame/EditorData.type';
import type { WorldInteractionGameData } from '../../api/worldInteraction/worldInteractionApi.type';
import type { SceneSetting as VisualSceneSetting } from '../../api/galgame/EditorData.type';
import type { SceneSetting as WorldSceneSetting } from '../../api/worldInteraction/worldInteractionApi.type';
import { 
    getScenes, 
    getSceneById, 
    isWorldInteractionMode, 
    isWorldScene,
    type WorldSubScene
} from './editorCompat';

import { toast } from 'react-hot-toast';
import DeletModal from '../goodsModal/DeletModal';
import { RiDeleteBin5Line, RiArrowDownSLine, RiArrowRightSLine } from 'react-icons/ri';
import { createSceneApiHelpers } from './ScenesPanel/apiHelpers';
import { createSceneHandlers, type LocalScene as HandlerLocalScene } from './ScenesPanel/handlers';
import SceneDetailForm from './ScenesPanel/SceneDetailForm';

interface BgmItem {
    id: string;
    name: string;
    description: string;
}

type LocalScene = HandlerLocalScene;

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
const DEFAULT_WORLD_MAP_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;

// 给图片URL添加时间戳，防止浏览器缓存
const addImageTimestamp = (url: string | undefined): string => {
    if (!url) return '';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
};

interface ScenesPanelProps {
    gameData?: AllGameData | WorldInteractionGameData | null;
    isLoading?: boolean;
    fileId?: string | null;
    onGetData?: (getDataFn: () => Partial<AllGameData | WorldInteractionGameData> | null) => void;
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
    const [subsceneDeleteModalOpen, setSubsceneDeleteModalOpen] = useState<boolean>(false);
    const [subsceneCollapsed, setSubsceneCollapsed] = useState<Record<string, boolean>>({});
    const sceneFileInputRef = useRef<HTMLInputElement>(null);
    const newSceneFileInputRef = useRef<HTMLInputElement>(null);
    // 大地图上传/生成 input 与状态（世界交互专用）
    const worldMapFileInputRef = useRef<HTMLInputElement>(null);
    const [isGeneratingAllSceneImages, setIsGeneratingAllSceneImages] = useState<boolean>(false);
    const [isGeneratingSingleSceneImage, setIsGeneratingSingleSceneImage] = useState<boolean>(false);
    const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null); // 避免切换场景时全局 loading 误闪
    const [isGeneratingWorldMap, setIsGeneratingWorldMap] = useState<boolean>(false);
    const [worldMapImageOverride, setWorldMapImageOverride] = useState<string | null>(null);
    const [sceneCostModalOpen, setSceneCostModalOpen] = useState<boolean>(false);
    const [sceneCostPoints, setSceneCostPoints] = useState<number | null>(null);
    const [isLoadingSceneCost, setIsLoadingSceneCost] = useState<boolean>(false);
    const [singleSceneCostModalOpen, setSingleSceneCostModalOpen] = useState<boolean>(false);
    const [worldMapCostModalOpen, setWorldMapCostModalOpen] = useState<boolean>(false);

    const [bgmLibrary, _setBgmLibrary] = useState<BgmItem[]>([
        { id: 'bgm-morning', name: '晨光序曲', description: '校园 / 日常' },
        { id: 'bgm-battle', name: '量子引擎警报', description: '紧张 / 战斗准备' },
        { id: 'bgm-dream', name: '星潮呢喃', description: '浪漫 / 深夜' },
    ]);

    // 已有大地图图片（worldInteraction 模式）
    const worldMapImage = worldMapImageOverride
        ? worldMapImageOverride
        : (gameData && isWorldInteractionMode(gameData) && gameData.worldSetting?.worldMapImage 
            ? gameData.worldSetting.worldMapImage 
            : null);

    // 大地图预览：后端地址走 /dummy，本地默认图直接用原始路径
    const worldMapPreviewSrc = (() => {
        if (!worldMapImage) return DEFAULT_WORLD_MAP_IMAGE;
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        return isLocalStatic ? worldMapImage : `${worldMapImage}/dummy`;
    })();

    // 当 gameData 变化时，填充场景数据
    useEffect(() => {
        if (!gameData) return;
        const scenes = getScenes(gameData);
        if (scenes && scenes.length > 0) {
            const convertedScenes: LocalScene[] = scenes.map((scene) => {
                // 处理两种模式的差异
                const sceneType = 'type' in scene ? (scene.type || '') : '';
                const sceneImage = scene.image || '';
                const sceneSoundtrack = scene.soundtrack || '';
                
                return {
                    id: scene.id || '',
                    name: scene.name || '',
                    type: sceneType,
                    desc: scene.description || '',
                    // 加时间戳防止浏览器缓存
                    image: addImageTimestamp(sceneImage) || DEFAULT_SCENE_IMAGE,
                    bgmId: sceneSoundtrack,
                };
            });

            setSceneData(convertedScenes);
            if (convertedScenes.length > 0) {
                setActiveSceneId(prev => prev || convertedScenes[0].id);
            }
        }
    }, [gameData]);

    // 将 sceneData 转换为 sceneSetting 格式
    const getSceneSettingData = useCallback((): VisualSceneSetting | WorldSceneSetting | null => {
        if (!gameData?.sceneSetting) return null;

        const scenes = sceneData
            .filter(scene => !scene.id.startsWith('temp-')) // 过滤掉临时场景
            .map(scene => {
                // 从原始数据中获取 subscenes，如果不存在则使用空数组
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
                    subscenes: originalSubscenes, // 添加 subscenes 字段（visual 可能为空，worldInteraction 有）
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

    // 创建 API 助手与业务 handlers（Hooks 必须在组件顶层调用，不能放在条件返回之后）
    const sceneApi = useMemo(() => createSceneApiHelpers(mode), [mode]);

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
                setSceneData,
                setActiveSceneId,
                setActiveSubsceneId,
                setActiveSubsceneDraft,
                setIsAddingNew,
                setNewSceneData,
                setIsAddingNewSubscene,
                setSubsceneCollapsed,
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
                onDeleteModalOpen: () => setDeleteModalOpen(true),
                onDeleteModalClose: () => setDeleteModalOpen(false),
                onSubsceneDeleteModalOpen: () => setSubsceneDeleteModalOpen(true),
                onSubsceneDeleteModalClose: () => setSubsceneDeleteModalOpen(false),
                onSceneCostModalOpen: (points: number | null) => {
                    setSceneCostPoints(points);
                    setSceneCostModalOpen(true);
                },
                onSingleSceneCostModalOpen: () => setSingleSceneCostModalOpen(true),
                onWorldMapCostModalOpen: () => setWorldMapCostModalOpen(true),
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
            onDataChange,
        ]
    );

    const activeScene = sceneData.find(s => s.id === activeSceneId) || sceneData[0];

    // 一键生成所有场景立绘 - 确认/取消
    const handleConfirmGenerateAllSceneImages = async () => {
        setSceneCostModalOpen(false);
        await handlers.confirmGenerateAllSceneImages(sceneCostPoints);
        onDataChange?.();
    };

    const handleCancelGenerateAllSceneImages = () => {
        setSceneCostModalOpen(false);
    };

    // 单个场景立绘生成 - 确认/取消
    const handleConfirmSingleSceneGenerate = async () => {
        setSingleSceneCostModalOpen(false);
        await handlers.confirmSingleSceneGenerate();
    };

    const handleCancelSingleSceneGenerate = () => {
        setSingleSceneCostModalOpen(false);
        handlers.cancelSingleSceneGenerate();
    };

    // 大地图生成 - 确认/取消
    const handleConfirmGenerateWorldMap = async () => {
        setWorldMapCostModalOpen(false);
        await handlers.confirmGenerateWorldMap();
        onDataChange?.();
    };

    const handleCancelGenerateWorldMap = () => {
        setWorldMapCostModalOpen(false);
        handlers.cancelGenerateWorldMap();
    };

    // 下载图片
    const handleDownloadImage = async (type: 'npcs' | 'scenes' | 'subscenes' | 'worldMap', id: string, variant?: string) => {
        if (!fileId || !sceneApi) {
            toast.error('缺少必要数据，无法下载');
            return;
        }

        try {
            const response = await sceneApi.downloadImage(fileId, type, id, variant);
            // 创建下载链接
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
    };

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

    return (
        <div className={styles.panelContent}>
            {/* 世界大地图：仅世界交互模式下显示 */}
            {mode === 'worldInteraction' && (
                <div className={styles.uploadWorldMapCard}>
                    <div className={styles.cardHead}>
                        <div>
                            <p className={styles.eyebrow}>Step 4</p>
                            <h2>上传或 AI 生成大地图</h2>
                            <p className={styles.subtitle}>
                                用于在世界地图模式中展示场景与子场景的位置关系。
                            </p>
                        </div>
                    </div>
                    {/* 大地图预览 + 右上角操作按钮 */}
                    <div
                        className={styles.sceneHero}
                        style={worldMapPreviewSrc ? { backgroundImage: `url('${worldMapPreviewSrc}')` } : {}}
                    >
                        {worldMapPreviewSrc ? (
                            <span className={styles.heroHint}>当前大地图预览</span>
                        ) : (
                            <span>暂无大地图，请先上传或生成</span>
                        )}
                        <div className={styles.worldMapActions}>
                            <input
                                ref={worldMapFileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handlers.handleUploadWorldMapChange}
                            />
                            <button
                                className={`${styles.ghostSmall} ${styles.generateButton}`}
                                onClick={handlers.handleRequestGenerateWorldMap}
                                disabled={!fileId || isGeneratingWorldMap}
                            >
                                <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" className={styles.priceIcon} />
                                {isGeneratingWorldMap ? '生成中...' : `${IMAGE_GENERATION_COST} AI 生成`}
                            </button>
                            <button
                                className={styles.ghostSmall}
                                onClick={() => worldMapFileInputRef.current?.click()}
                                disabled={!fileId}
                            >
                                上传
                            </button>
                        </div>
                        {isGeneratingWorldMap && (
                                 <div className="loadingOverlay">
                                 <div className="loadingSpinner"></div>
                                 <div className="loadingText">正在生成大地图...</div>
                             </div>
                            )}
                    </div>
                </div>
            )}
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

            <div className={styles.sceneLayout}>
                {/* 左栏 */}
                <div className={styles.stack}>
                    {/* 场景列表 */}
                    <div className={styles.card}>
                        <div className={styles.boardHead}>
                            <div>
                                <h3>解析出的场景</h3>
                            </div>
                            <button className={styles.ghostSmall} onClick={handlers.openAddNewPanel}>+ 新增场景</button>
                        </div>
                        <div className={styles.sceneList}>
                            {sceneData.map((scene) => {
                                const originalScene = mode === 'worldInteraction'
                                    ? getSceneById(gameData, scene.id)
                                    : null;
                                const subscenes: WorldSubScene[] = isWorldScene(originalScene as any) ? (originalScene?.subscenes || []) : [];

                                return (
                                    <React.Fragment key={scene.id}>
                                        {/* 父场景卡片 */}
                                        <article
                                            className={`${styles.sceneRow} ${scene.id === activeSceneId && !activeSubsceneId ? styles.active : ''}`}
                                            onClick={() => {
                                                handlers.exitCreateModes();
                                                setActiveSceneId(scene.id);
                                                setActiveSubsceneId(null);
                                                setActiveSubsceneDraft(null);
                                            }}
                                        >
                                            <div
                                                className={`${styles.sceneThumb} ${!scene.image ? styles.empty : ''}`}
                                                style={{ backgroundImage: `url('${scene.image || DEFAULT_SCENE_IMAGE}')` }}
                                            >
                                                {!scene.image && <span>待上传</span>}
                                            </div>
                                            <div className={styles.sceneMeta}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                    <strong>{scene.name}</strong>
                                                    <button
                                                        className={styles.deleteButton}
                                                        onClick={(e) => handlers.handleDeleteClick(scene.id, e)}
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
                                                                handlers.toggleSubsceneCollapse(scene.id);
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
                                                        onClick={handlers.openAddNewSubscene}
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
                                                                handlers.exitCreateModes();
                                                                setActiveSceneId(scene.id);
                                                                setActiveSubsceneId(subId);
                                                                setActiveSubsceneDraft({
                                                                    id: subId,
                                                                    name: sub.name || '未命名子场景',
                                                                    type: '',
                                                                    desc: sub.description || '',
                                                                    image: addImageTimestamp(sub.image) || '',
                                                                    bgmId: scene.bgmId || '',
                                                                });
                                                            }}
                                                        >
                                                            <div
                                                                className={`${styles.sceneThumb} ${!sub.image ? styles.empty : ''}`}
                                                                style={{ backgroundImage: `url('${sub.image ? addImageTimestamp(sub.image) : DEFAULT_WORLD_MAP_IMAGE}')` }}
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
                                                                        onClick={(e) => handlers.handleSubsceneDeleteClick(scene.id, subId, e)}
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
                            <button
                                className={styles.ghostSmall}
                                onClick={async () => {
                                    await handlers.confirmAddNew();
                                    onDataChange?.();
                                }}
                            >
                                确认增加
                            </button>
                            <button className={styles.ghostSmall} onClick={handlers.cancelAddNew}>
                                取消
                            </button>
                        </div>
                    )}
                    
                    {/* 正常模式下显示确认修改按钮 */}
                    {!isAddingNew && activeScene && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                            {activeSubsceneId ? (
                                <>
                                    <button
                                        className={styles.ghostSmall}
                                        onClick={async () => {
                                            await handlers.confirmSubsceneEdit();
                                            onDataChange?.();
                                        }}
                                    >
                                        {isAddingNewSubscene ? '确认增加' : '确认修改'}
                                    </button>
                                    {isAddingNewSubscene && (
                                        <button className={styles.ghostSmall} onClick={handlers.cancelAddNewSubscene}>
                                            取消
                                        </button>
                                    )}
                                </>
                            ) : (
                                <button
                                    className={styles.ghostSmall}
                                    onClick={async () => {
                                        await handlers.confirmEdit(activeScene);
                                        onDataChange?.();
                                    }}
                                >
                                    确认修改
                                </button>
                            )}
                        </div>
                    )}

                    {isAddingNew && newSceneData ? (
                        /* 新增场景表单 */
                        <SceneDetailForm
                            scene={newSceneData}
                            bgmLibrary={bgmLibrary}
                            defaultImage={DEFAULT_SCENE_IMAGE}
                            fileInputRef={newSceneFileInputRef}
                            isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === newSceneData.id}
                            disabled={true}
                            disabledMessage="请先确认新增场景，然后再上传图片"
                            uploadButtonText="上传背景"
                            onImageClick={() => toast.error('请先确认新增场景，然后再上传图片')}
                            onUploadChange={handlers.handleUploadSceneImage}
                            onRequestRegenerate={() => toast.error('请先确认新增场景，然后再生成图片')}
                            onFieldChange={handlers.updateNewSceneField}
                        />
                    ) : (
                        /* 正常显示选中的详情：主场景或子场景 */
                        <>
                            {mode === 'worldInteraction' && activeSubsceneId && activeSubsceneDraft ? (
                                /* 子场景编辑盒子 */
                                <SceneDetailForm
                                    scene={activeSubsceneDraft}
                                    bgmLibrary={bgmLibrary}
                                    defaultImage={DEFAULT_WORLD_MAP_IMAGE}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeSubsceneDraft.id}
                                    disabled={isAddingNewSubscene && activeSubsceneId.startsWith('temp-')}
                                    disabledMessage={isAddingNewSubscene && activeSubsceneId.startsWith('temp-') ? '请先确认新增子场景，然后再上传图片' : undefined}
                                    uploadButtonText="上传背景"
                                    onImageClick={handlers.handleSceneImageClick}
                                    onUploadChange={handlers.handleUploadSceneImage}
                                    onRequestRegenerate={handlers.handleRequestRegenerateSceneImage}
                                    onFieldChange={handlers.updateSubsceneField}
                                    onDownloadImage={handleDownloadImage}
                                    sceneType="subscenes"
                                />
                            ) : (
                                /* 主场景编辑盒子 */
                                <SceneDetailForm
                                    scene={activeScene}
                                    bgmLibrary={bgmLibrary}
                                    defaultImage={DEFAULT_SCENE_IMAGE}
                                    fileInputRef={sceneFileInputRef}
                                    isGeneratingForThisScene={isGeneratingSingleSceneImage && generatingSceneId === activeScene.id}
                                    uploadButtonText="重新上传"
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

            {/* 删除场景确认弹窗 */}
            <DeletModal
                isOpen={deleteModalOpen}
                onDelete={handlers.handleConfirmDelete}
                onCancel={handlers.handleCancelDelete}
                title="删除场景"
                message="删除后场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {/* 删除子场景确认弹窗 */}
            <DeletModal
                isOpen={subsceneDeleteModalOpen}
                onDelete={handlers.handleConfirmSubsceneDelete}
                onCancel={handlers.handleCancelSubsceneDelete}
                title="删除子场景"
                message="删除后子场景数据不可恢复，请谨慎操作！"
                confirmButtonText="确认删除"
                cancelButtonText="我再想想"
            />

            {/* 一键生成场景立绘积分提示 */}
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

            {/* 单个场景立绘生成积分确认 */}
            <DeletModal
                isOpen={singleSceneCostModalOpen}
                onDelete={handleConfirmSingleSceneGenerate}
                onCancel={handleCancelSingleSceneGenerate}
                title="积分扣除确认"
                message={`本次生成场景立绘将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

            {/* 大地图生成积分确认 */}
            <DeletModal
                isOpen={worldMapCostModalOpen}
                onDelete={handleConfirmGenerateWorldMap}
                onCancel={handleCancelGenerateWorldMap}
                title="积分扣除确认"
                message={`本次生成大地图将扣除 ${IMAGE_GENERATION_COST} 积分，是否继续？`}
                confirmButtonText="确认生成"
                cancelButtonText="取消"
            />

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
