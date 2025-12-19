// WorldMapRenderer.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import styles from './WorldMapRenderer.module.css';
import type { AllGameData, Scene, SubScene } from '../../api/worldInteraction/mapWorldData.type';
import type { EventData } from '../../page/GalgameMap';
import { useMapGalgameStore } from '../../store/mapGalgameStore';
import { IoMdCloseCircle } from 'react-icons/io';
import { useNavigate } from 'react-router-dom';

interface WorldMapRendererProps {
    gameData: AllGameData | null;
    isLoading?: boolean;
    onSceneClick?: (subscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    }) => void;
    onSubsceneClick?: (subsceneId: string, parentSceneId: string) => void;
    eventData: EventData | null;
}

type ViewMode = 'mainScenes' | 'subScenes';
type ViewStackItem = { mode: ViewMode; scene?: Scene | null };
const buildInitialViewStack = (): ViewStackItem[] => {
    try {
        const cached = sessionStorage.getItem('worldMapViewStack');
        if (cached) {
            const parsed = JSON.parse(cached) as ViewStackItem[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (_) {
    }
    return [{ mode: 'mainScenes', scene: null }];
};

const buildMainBackground = (gameData: AllGameData | null | undefined) => {
    const worldMapImage = gameData?.worldSetting?.worldMapImage;
    const firstSceneImage = gameData?.sceneSetting?.scenes?.[0]?.image;

    if (worldMapImage) {
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        // 本地静态资源：直接用原始路径；后端接口路径：追加 /dummy 走缩略图
        return isLocalStatic ? worldMapImage : `${worldMapImage}/dummy`;
    }
    if (firstSceneImage) return firstSceneImage;
    return '';
};

const WorldMapRenderer: React.FC<WorldMapRendererProps> = ({
    gameData,
    isLoading,
    onSceneClick,
    onSubsceneClick,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const initialStackRef = useRef<ViewStackItem[]>(buildInitialViewStack());
    const [viewStack, setViewStack] = useState<ViewStackItem[]>(initialStackRef.current);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [isReady, setIsReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const { eventData, currentView: mapCurrentView } = useMapGalgameStore();
    const navigator = useNavigate();
    
    // 当 mapCurrentView 变为 WORLD_MAP 时，检查是否需要重置视图栈到最外层
    // 如果 sessionStorage 中的视图栈已被重置为最外层，则同步更新组件状态
    useEffect(() => {
        if (mapCurrentView === 'world_map') {
            const cached = sessionStorage.getItem('worldMapViewStack');
            if (cached) {
                try {
                    const parsed = JSON.parse(cached) as ViewStackItem[];
                    // 如果视图栈只有一个主场景项，说明已被重置，同步更新
                    if (Array.isArray(parsed) && parsed.length === 1 && parsed[0].mode === 'mainScenes') {
                        setViewStack(parsed);
                        initialStackRef.current = parsed;
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    }, [mapCurrentView]);

    // 延迟加载和尺寸重试机制
    useEffect(() => {
        const initContainerSize = () => {
            if (!containerRef.current) {
                if (retryCount < 5) {
                    setTimeout(() => {
                        setRetryCount(prev => prev + 1);
                        initContainerSize();
                    }, 100 * (retryCount + 1));
                }
                return;
            }

            const rect = containerRef.current.getBoundingClientRect();
            const newWidth = Math.max(rect.width, 300);
            const newHeight = Math.max(rect.height, 400);

            // 只有当有实际尺寸时才更新
            if (newWidth > 0 && newHeight > 0) {
                setContainerSize({
                    width: newWidth,
                    height: newHeight
                });
                setIsReady(true);
            }
        };

        // 初始延迟执行，确保DOM已渲染
        const timer = setTimeout(() => {
            initContainerSize();
        }, 50);

        return () => clearTimeout(timer);
    }, [retryCount]);

    // 监听窗口和容器尺寸变化
    useEffect(() => {
        if (!isReady) return;

        const updateContainerSize = () => {
            if (!containerRef.current) return;

            requestAnimationFrame(() => {
                const rect = containerRef.current!.getBoundingClientRect();
                const newWidth = Math.max(rect.width, 300);
                const newHeight = Math.max(rect.height, 400);

                if (containerSize.width !== newWidth || containerSize.height !== newHeight) {
                    setContainerSize({
                        width: newWidth,
                        height: newHeight
                    });
                }
            });
        };

        window.addEventListener('resize', updateContainerSize);

        const resizeObserver = new ResizeObserver(updateContainerSize);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener('resize', updateContainerSize);
            resizeObserver.disconnect();
        };
    }, [isReady, containerSize.width, containerSize.height]);

    // 处理场景数据
    const scenes = useMemo(() => {
        if (!gameData?.sceneSetting?.scenes) return [];

        return gameData.sceneSetting.scenes.map(scene => ({
            ...scene,
            x: scene.position?.[0] ?? 0.5,
            y: scene.position?.[1] ?? 0.5,
            subscenes: scene.subscenes?.map(subscene => ({
                ...subscene,
                x: subscene.position[0] ?? 0.5,
                y: subscene.position[1] ?? 0.5
            })) || []
        }));
    }, [gameData]);

    const currentView = viewStack[viewStack.length - 1] || { mode: 'mainScenes' as ViewMode, scene: null };
    const viewMode = currentView.mode;
    const selectedScene = viewMode === 'subScenes' ? currentView.scene || null : null;

    // 持久化视图栈，避免组件重新挂载时回到主地图
    useEffect(() => {
        try {
            sessionStorage.setItem('worldMapViewStack', JSON.stringify(viewStack));
        } catch (_) {
            /* ignore */
        }
    }, [viewStack]);

    // 更新背景图片（视图变更时）
    useEffect(() => {
        if (!isReady) return;

        let isMounted = true;

        const updateBackground = () => {
            if (viewMode === 'mainScenes') {                
                const img = buildMainBackground(gameData);
                if (img && isMounted) {
                    setBackgroundImage(img);
                }
            } else if (viewMode === 'subScenes' && selectedScene?.image && isMounted) {
                setBackgroundImage(selectedScene.image);
            }
        };

        updateBackground();

        return () => {
            isMounted = false;
        };
    }, [viewMode, selectedScene, gameData, isReady]);

    // 计算像素位置
    const calculatePixelPosition = (normalizedPos: { x: number; y: number }) => {
        const safeWidth = containerSize.width > 0 ? containerSize.width : 800;
        const safeHeight = containerSize.height > 0 ? containerSize.height : 600;

        const x = Math.max(0, Math.min(1, normalizedPos.x || 0.5));
        const y = Math.max(0, Math.min(1, normalizedPos.y || 0.5));

        return {
            x: x * safeWidth,
            y: y * safeHeight
        };
    };

    // 处理主场景点击：推入栈
    const handleMainSceneClick = (scene: Scene) => {
        if (scene.subscenes && scene.subscenes.length > 0) {
            setViewStack(prev => [...prev, { mode: 'subScenes', scene }]);
        }
    };

    // 处理子场景点击
    const handleSubsceneClick = (subscene: SubScene) => {
        if (!selectedScene) return;

        // 通过回调通知父组件打开场景模态框
        if (onSceneClick) {
            onSceneClick({
                id: subscene.id,
                name: subscene.name,
                image: subscene.image || '',
                parentSceneName: selectedScene.name,
            });
        }

        onSubsceneClick?.(subscene.id, selectedScene.id);
    };

    // 返回上一层（栈弹出）；若已在根层则保持
    const handleBackToMainScenes = () => {
        setViewStack(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.slice(0, -1);
            const top = next[next.length - 1];
            if (top?.mode === 'mainScenes') {
                const img = buildMainBackground(gameData);
                if (img) setBackgroundImage(img);
            } else if (top?.mode === 'subScenes' && top.scene?.image) {
                setBackgroundImage(top.scene.image);
            }
            return next;
        });
    };

    if (isLoading) {
        return (
            <div className={styles.mapContainer}>
                <div className={styles.loadingState}>加载地图中...</div>
            </div>
        );
    }

    // 确保容器有合理的默认尺寸
    const canvasWidth = containerSize.width > 0 ? containerSize.width : 800;
    const canvasHeight = containerSize.height > 0 ? containerSize.height : 600;

    {
        return (
            <div
                className={styles.mapContainer}
                style={{
                    backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    position: 'relative',
                }}
                ref={containerRef}
            >
                {
                    viewMode === 'mainScenes' && (
                        <div className={styles.closeTitleBar}>
                            <div className={styles.backButton} onClick={()=>{
                                navigator('/home')
                            }}>
                                <IoMdCloseCircle size={24} />
                            </div>
                        </div>
                    )
                }
                {/* 子场景视图时才显示标题栏 */}
                {viewMode === 'subScenes' && selectedScene && (
                    <div className={styles.titleBar}>
                        <div className={styles.titleText} onClick={handleBackToMainScenes}>
                            {selectedScene.name}
                        </div>
                    </div>
                )}

                {/* 显示加载遮罩直到准备就绪 */}
                {!isReady && (
                    <div className={styles.initOverlay}>
                        <div className={styles.initSpinner}></div>
                        <div>初始化地图...</div>
                    </div>
                )}

                {/* 地图内容区域 */}
                <div
                    className={styles.mapContent}
                    style={{
                        display: isReady ? 'flex' : 'none',
                        height: viewMode === 'subScenes' && selectedScene ? 'calc(100% - 64px)' : '100%'
                    }}
                >
                    <div
                        className={styles.mapCanvas}
                        style={{
                            position: 'relative',
                            width: canvasWidth,
                            height: canvasHeight,
                        }}
                    >
                        {/* 主场景视图 */}
                        {viewMode === 'mainScenes' && isReady && (
                            scenes.length === 0 ? (
                                <div className={styles.emptyState}>暂无场景数据</div>
                            ) : (
                                scenes.map(scene => {
                                    const position = calculatePixelPosition({ x: scene.x, y: scene.y });
                                    const hasEventInSubscene = scene.subscenes.some(subscene =>
                                        subscene.id === eventData?.subscene?.id
                                    );

                                    return (
                                        <div
                                            key={scene.id}
                                            className={styles.sceneNode}
                                            style={{
                                                position: 'absolute',
                                                left: position.x - 30,
                                                top: position.y - 30,
                                                width: 60,
                                                height: 60,
                                            }}
                                            onClick={() => handleMainSceneClick(scene)}
                                        >
                                            {/* 场景图片 */}
                                            <div className={styles.nodeImageContainer}>
                                                {scene.image ? (
                                                    <>
                                                        <img
                                                            src={scene.image}
                                                            alt={scene.name}
                                                            className={styles.nodeImage}
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                const fallback = target.parentElement!.querySelector<HTMLDivElement>(`.${styles.nodeText}`);
                                                                if (fallback) {
                                                                    fallback.style.display = 'flex';
                                                                }
                                                            }}
                                                        />
                                                        {hasEventInSubscene && (
                                                            <div className={styles.eventLocation}>
                                                                <img src={`${import.meta.env.BASE_URL}data/assets/任务.png`} alt="" />
                                                            </div>
                                                        )}
                                                    </>
                                                ) : null}
                                                <div
                                                    className={styles.nodeText}
                                                    style={{
                                                        display: scene.image ? 'none' : 'flex'
                                                    }}
                                                >
                                                    {scene.name.charAt(0)}
                                                </div>
                                            </div>

                                            {/* 场景名称 */}
                                            <div className={styles.nodeName}>
                                                {scene.name}
                                            </div>
                                        </div>
                                    );
                                })
                            )
                        )}

                        {/* 子场景视图 */}
                        {viewMode === 'subScenes' && selectedScene && isReady && selectedScene.subscenes.map(subscene => {
                            const position = calculatePixelPosition({ x: subscene.position[0], y: subscene.position[1] });
                            const isEventLocation = eventData?.subscene?.id === subscene.id;

                            return (
                                <div
                                    key={subscene.id}
                                    className={styles.subsceneNode}
                                    style={{
                                        position: 'absolute',
                                        left: position.x - 25,
                                        top: position.y - 25,
                                        width: 50,
                                        height: 50,
                                    }}
                                    onClick={() => handleSubsceneClick(subscene)}
                                >
                                    {/* 子场景图片 */}
                                    <div className={styles.nodeImageContainer}>
                                        {subscene.image ? (
                                            <>
                                                <img
                                                    src={subscene.image}
                                                    alt={subscene.name}
                                                    className={styles.nodeImage}
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                        const fallback = target.parentElement!.querySelector<HTMLDivElement>(`.${styles.nodeText}`);
                                                        if (fallback) {
                                                            fallback.style.display = 'flex';
                                                        }
                                                    }}
                                                />
                                                {/* 修正判断条件 */}
                                                {isEventLocation && (
                                                    <div className={styles.eventLocation}>
                                                        <img src={`${import.meta.env.BASE_URL}data/assets/任务.png`} alt="" />
                                                    </div>
                                                )}
                                            </>
                                        ) : null}
                                        <div
                                            className={styles.nodeText}
                                            style={{
                                                display: subscene.image ? 'none' : 'flex'
                                            }}
                                        >
                                            {subscene.name.charAt(0)}
                                        </div>
                                    </div>

                                    {/* 子场景名称 */}
                                    <div className={styles.nodeName}>
                                        {subscene.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }
};

export default WorldMapRenderer;