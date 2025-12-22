// SceneView.tsx - 场景视图组件，显示某个场景下的子场景列表
import React, { useRef, useState, useEffect } from 'react';
import styles from './SceneView.module.css';
import type { Scene, SubScene } from '../../api/worldInteraction/mapWorldData.type';
import type { EventData } from '../../page/GalgameMap';

interface SceneViewProps {
    selectedScene: Scene | null;
    eventData: EventData | null;
    onSubsceneClick: (subscene: {
        id: string;
        name: string;
        image: string;
        parentSceneName: string;
    }) => void;
    onBack: () => void;
}

const SceneView: React.FC<SceneViewProps> = ({
    selectedScene,
    eventData,
    onSubsceneClick,
    onBack,
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
    }, [retryCount, selectedScene]);

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

    // 更新背景图片
    useEffect(() => {
        if (!isReady || !selectedScene) return;

        if (selectedScene.image) {
            setBackgroundImage(selectedScene.image);
        }
    }, [selectedScene, isReady]);

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

    // 处理子场景点击
    const handleSubsceneClick = (subscene: SubScene) => {
        if (!selectedScene) return;
        onSubsceneClick({
            id: subscene.id,
            name: subscene.name,
            image: subscene.image || '',
            parentSceneName: selectedScene.name,
        });
    };

    if (!selectedScene) {
        return null;
    }

    const canvasWidth = containerSize.width > 0 ? containerSize.width : 800;
    const canvasHeight = containerSize.height > 0 ? containerSize.height : 600;
    const subscenes = selectedScene.subscenes || [];

    return (
        <div
            className={styles.sceneViewContainer}
            style={{
                backgroundImage: backgroundImage ? `url("${backgroundImage}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                position: 'relative',
            }}
            ref={containerRef}
        >
            {/* 标题栏 */}
            <div className={styles.titleBar}>
                <div className={styles.titleText} onClick={onBack}>
                    {selectedScene.name}
                </div>
            </div>

            {/* 显示加载遮罩直到准备就绪 */}
            {!isReady && (
                <div className={styles.initOverlay}>
                    <div className={styles.initSpinner}></div>
                    <div>加载场景中...</div>
                </div>
            )}

            {/* 场景内容区域 */}
            <div
                className={styles.sceneContent}
                style={{
                    display: isReady ? 'flex' : 'none',
                    height: 'calc(100% - 64px)'
                }}
            >
                <div
                    className={styles.sceneCanvas}
                    style={{
                        position: 'relative',
                        width: canvasWidth,
                        height: canvasHeight,
                    }}
                >
                    {isReady && (
                        subscenes.length === 0 ? (
                            <div className={styles.emptyState}>该场景下暂无子场景</div>
                        ) : (
                            subscenes.map(subscene => {
                                const position = calculatePixelPosition({ 
                                    x: subscene.position[0], 
                                    y: subscene.position[1] 
                                });
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
                            })
                        )
                    )}
                </div>
            </div>
        </div>
    );
};

export default SceneView;

