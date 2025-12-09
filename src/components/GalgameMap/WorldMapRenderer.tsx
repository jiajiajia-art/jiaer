// WorldMapRenderer.tsx
import React, { useMemo, useRef, useState, useEffect } from 'react';
import styles from './WorldMapRenderer.module.css';
import type { AllGameData, Scene, SubScene } from '../../api/worldInteraction/mapWorldData.type';
import { MdOutlineArrowCircleLeft } from 'react-icons/md';
import SceneModal from './SceneModal';

interface WorldMapRendererProps {
    gameData: AllGameData | null;
    isLoading?: boolean;
    onSceneClick?: (sceneId: string) => void;
    onSubsceneClick?: (subsceneId: string, parentSceneId: string) => void;
}

type ViewMode = 'mainScenes' | 'subScenes';

const WorldMapRenderer: React.FC<WorldMapRendererProps> = ({ 
    gameData, 
    isLoading,
    onSceneClick,
    onSubsceneClick 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selectedScene, setSelectedScene] = useState<Scene | null>(null);
    const [selectedSubscene, setSelectedSubscene] = useState<SubScene | null>(null);
    const [showSceneModal, setShowSceneModal] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('mainScenes');
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [isReady, setIsReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

    // 延迟加载和尺寸重试机制
    useEffect(() => {
        const initContainerSize = () => {
            if (!containerRef.current) {
                // 如果容器不存在，延迟重试
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
            x: scene.x ?? 0.5,
            y: scene.y ?? 0.5,
            subscenes: scene.subscenes?.map(subscene => ({
                ...subscene,
                x: subscene.x ?? 0.5,
                y: subscene.y ?? 0.5
            })) || []
        }));
    }, [gameData]);

    // 更新背景图片
    useEffect(() => {
        if (!isReady) return;

        let isMounted = true;
        
        const updateBackground = () => {
            if (viewMode === 'mainScenes') {
                // 主场景视图：使用第一个场景的图片作为背景
                const firstSceneImage = gameData?.sceneSetting?.scenes[0]?.image;
                if (firstSceneImage && isMounted) {
                    setBackgroundImage(firstSceneImage);
                }
            } else if (viewMode === 'subScenes' && selectedScene?.image && isMounted) {
                // 子场景视图：使用主场景的图片作为背景
                setBackgroundImage(selectedScene.image);
            }
        };

        updateBackground();

        return () => {
            isMounted = false;
        };
    }, [viewMode, selectedScene, gameData, isReady]);

    // 强制刷新背景图片
    const refreshBackground = () => {
        if (viewMode === 'mainScenes') {
            const firstSceneImage = gameData?.sceneSetting?.scenes[0]?.image;
            if (firstSceneImage) {
                setBackgroundImage(firstSceneImage + '?t=' + Date.now());
            }
        } else if (viewMode === 'subScenes' && selectedScene?.image) {
            setBackgroundImage(selectedScene.image + '?t=' + Date.now());
        }
    };

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

    // 处理主场景点击
    const handleMainSceneClick = (scene: Scene) => {
        if (scene.subscenes && scene.subscenes.length > 0) {
            setSelectedScene(scene);
            setViewMode('subScenes');
            // 切换视图时刷新背景
            setTimeout(refreshBackground, 50);
        }
        onSceneClick?.(scene.id);
    };

    // 处理子场景点击
    const handleSubsceneClick = (subscene: SubScene) => {
        if (!selectedScene) return;
        
        // 设置选中的子场景并显示模态框
        setSelectedSubscene(subscene);
        setShowSceneModal(true);
        
        onSubsceneClick?.(subscene.id, selectedScene.id);
    };

    // 处理模态框关闭
    const handleModalClose = () => {
        setShowSceneModal(false);
        setSelectedSubscene(null);
    };

    // 返回主场景视图
    const handleBackToMainScenes = () => {
        setSelectedScene(null);
        setSelectedSubscene(null);
        setViewMode('mainScenes');
        // 切换视图时刷新背景
        setTimeout(refreshBackground, 50);
    };

    if (isLoading) {
        return (
            <div className={styles.mapContainer}>
                <div className={styles.loadingState}>加载地图中...</div>
            </div>
        );
    }

    if (scenes.length === 0) {
        return (
            <div className={styles.mapContainer}>
                <div className={styles.emptyState}>暂无场景数据</div>
            </div>
        );
    }

    // 确保容器有合理的默认尺寸
    const canvasWidth = containerSize.width > 0 ? containerSize.width : 800;
    const canvasHeight = containerSize.height > 0 ? containerSize.height : 600;

    return (
        <>
            {/* SceneModal - 点击子场景时显示 */}
            {showSceneModal && selectedScene && selectedSubscene && (
                <SceneModal
                    subsceneData={{
                        id: selectedSubscene.id,
                        name: selectedSubscene.name,
                        image: selectedSubscene.image,
                        parentSceneName: selectedScene.name,
                    }}
                    onBack={handleModalClose}
                />
            )}

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
                {/* 子场景视图时才显示标题栏 */}
                {viewMode === 'subScenes' && selectedScene && !showSceneModal && (
                    <div className={styles.titleBar}>
                        {/* 返回按钮在最左边 */}
                        <div className={styles.backButton} onClick={handleBackToMainScenes}>
                            <MdOutlineArrowCircleLeft size={24} />
                        </div>
                        
                        {/* 标题居中 */}
                        <div className={styles.titleText}>
                            {selectedScene.name}
                        </div>
                        
                        {/* 右边空div保持平衡 */}
                        <div className={styles.rightPlaceholder} />
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
                        {viewMode === 'mainScenes' && isReady && !showSceneModal && scenes.map(scene => {
                            const position = calculatePixelPosition({ x: scene.x, y: scene.y });
                            
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
                        })}

                        {/* 子场景视图 */}
                        {viewMode === 'subScenes' && selectedScene && isReady && !showSceneModal && selectedScene.subscenes.map(subscene => {
                            const position = calculatePixelPosition({ x: subscene.x, y: subscene.y });
                            
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
        </>
    );
};

export default WorldMapRenderer;