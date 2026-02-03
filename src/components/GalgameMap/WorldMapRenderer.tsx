// WorldMapRenderer.tsx - 世界大地图组件，只显示主场景
import React, { useMemo, useRef, useState, useEffect } from 'react';
import styles from './WorldMapRenderer.module.css';
import type { AllGameData, Scene } from '../../api/worldInteraction/mapWorldData.type';
import type { EventData } from '../../page/GalgameMap';
import GameBackgroundRenderer from '../Galgame/GameBackgroundRenderer';
import GameImageRenderer from '../Galgame/GameImageRenderer';

interface WorldMapRendererProps {
    gameData: AllGameData | null;
    isLoading?: boolean;
    onSceneClick?: (scene: Scene) => void; // 点击场景时回调，传递整个场景对象
    eventData: EventData | null;
}

const buildMainBackground = (gameData: AllGameData | null | undefined) => {
    const worldMapImage = gameData?.worldSetting?.worldMapImage;
    const firstSceneImage = gameData?.sceneSetting?.scenes?.[0]?.image;

    if (worldMapImage) {
        const isLocalStatic = worldMapImage.startsWith(import.meta.env.BASE_URL);
        return isLocalStatic ? worldMapImage : `${worldMapImage}`;
    }
    if (firstSceneImage) return firstSceneImage;
    return '';
};

const WorldMapRenderer: React.FC<WorldMapRendererProps> = ({
    gameData,
    isLoading,
    onSceneClick,
    eventData,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [isReady, setIsReady] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

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

            if (newWidth > 0 && newHeight > 0) {
                setContainerSize({
                    width: newWidth,
                    height: newHeight
                });
                setIsReady(true);
            }
        };

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
        }));
    }, [gameData]);

    // 更新背景图片
    useEffect(() => {
        if (!isReady) return;

        const img = buildMainBackground(gameData);
        if (img) {
            setBackgroundImage(img);
        }
    }, [gameData, isReady]);

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
    const handleSceneClick = (scene: Scene) => {
        if (onSceneClick) {
            onSceneClick(scene);
        }
    };

    if (isLoading) {
        return (
            <div className={styles.mapContainer}>
                <div className={styles.loadingState}>加载地图中...</div>
            </div>
        );
    }

    const canvasWidth = containerSize.width > 0 ? containerSize.width : 800;
    const canvasHeight = containerSize.height > 0 ? containerSize.height : 600;

    return (
        <div
            className={styles.mapContainer}
            style={{
                position: 'relative',
                overflow: 'hidden',
            }}
            ref={containerRef}
        >
            {/* 背景使用游戏级 Canvas 渲染，复用解码后的 ImageBitmap */}
            {backgroundImage && (
                <GameBackgroundRenderer
                    src={backgroundImage}
                    useCanvas={true}
                    transitionDuration={300}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                    }}
                />
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
                    {isReady && (
                        scenes.length === 0 ? (
                            <div className={styles.emptyState}>暂无场景数据</div>
                        ) : (
                            scenes.map(scene => {
                                const position = calculatePixelPosition({ x: scene.x, y: scene.y });
                                // 检查该场景下是否有事件所在的子场景
                                const hasEventInSubscene = scene.subscenes?.some(subscene =>
                                    subscene.id === eventData?.subscene?.id
                                );

                                // 根据容器大小动态计算icon大小，保持合适的比例
                                // 基础尺寸（414px）下icon为60px，约14.5%的容器宽度
                                // 由于容器保持414px固定尺寸，icon大小也保持固定比例
                                const iconSize = (canvasWidth / 16) * 0.145; // 容器宽度的14.5%，转换为rem
                                const iconOffset = iconSize / 2;

                                return (
                                    <div
                                        key={scene.id}
                                        className={styles.sceneNode}
                                        style={{
                                            position: 'absolute',
                                            left: `${position.x - iconOffset * 16}px`, // 转换为px用于精确定位
                                            top: `${position.y - iconOffset * 16}px`,
                                            width: `${iconSize}rem`,
                                            height: `${iconSize}rem`,
                                        }}
                                        onClick={() => handleSceneClick(scene)}
                                    >
                                        {/* 场景图片（使用 Canvas 渲染，复用缓存的 ImageBitmap） */}
                                        <div className={styles.nodeImageContainer}>
                                            {scene.image ? (
                                                <>
                                                    <GameImageRenderer
                                                        src={scene.image}
                                                        className={styles.nodeImage}
                                                        useCanvas={true}
                                                        onError={() => {
                                                            const container = document.querySelector<HTMLDivElement>(
                                                                `.${styles.nodeText}`
                                                            );
                                                            if (container) {
                                                                container.style.display = 'flex';
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
                </div>
            </div>
        </div>
    );
};

export default WorldMapRenderer;
