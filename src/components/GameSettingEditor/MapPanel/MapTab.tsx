import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import styles from './MapTab.module.css';
import sharedStyles from './shared.module.css';
import type { Scene, PlacedScene } from './types';
import { DEFAULT_MAP_IMAGE, DEFAULT_SCENE_IMAGE, SCENE_ICON_SIZE } from './constants';
import { getImageUrl } from '../../../utils/constants';
import { getImageDisplayBounds } from './utils';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import toast from 'react-hot-toast';

interface MapTabProps {
    sceneSetting?: { scenes?: Scene[] };
    worldMapImage?: string | null;
    fileId: string;
    onDataChange?: () => void;
    isActive?: boolean;
}

const MapTab: React.FC<MapTabProps> = ({
    sceneSetting,
    worldMapImage,
    fileId,
    isActive,
}) => {
    const [placedScenes, setPlacedScenes] = useState<PlacedScene[]>([]);
    const [draggingSceneId, setDraggingSceneId] = useState<string | null>(null);
    const [selectedSceneIdInMap, setSelectedSceneIdInMap] = useState<string | null>(null);
    const [sceneDragOffset, setSceneDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [mapImageLoaded, setMapImageLoaded] = useState(false);
    const [mapContainerReady, setMapContainerReady] = useState(false);
    const [isMapContentReady, setIsMapContentReady] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [worldMapImageUrl, setWorldMapImageUrl] = useState<string | null>(null);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const mapPreviewRef = useRef<HTMLDivElement>(null);
    const mapImageRef = useRef<HTMLImageElement>(null);
    const sceneDefaultPosRef = useRef<Record<string, { x: number; y: number }>>({});

    // 地图 tab 使用的图片地址
    const mapImageSources = useMemo(() => {
        const base = worldMapImageUrl || worldMapImage || null;
        const dummy = base ? `${base}/dummy` : null;
        return { dummy, base };
    }, [worldMapImageUrl, worldMapImage]);

    const currentMapSrc = mapImageSources.dummy || mapImageSources.base || DEFAULT_MAP_IMAGE;

    // 同步后端返回的 worldMapImage 到本地状态
    useEffect(() => {
        if (worldMapImage) {
            setWorldMapImageUrl(worldMapImage);
        } else {
            setWorldMapImageUrl(null);
        }
    }, [worldMapImage]);

    // 内容就绪检测
    useEffect(() => {
        if (mapImageLoaded && mapContainerReady) {
            const timer = setTimeout(() => {
                setIsMapContentReady(true);
                setForceUpdate(prev => prev + 1);
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setIsMapContentReady(false);
            const fallbackTimer = setTimeout(() => {
                setIsMapContentReady(true);
                setMapImageLoaded(true);
                setMapContainerReady(true);
            }, 3000);
            return () => clearTimeout(fallbackTimer);
        }
    }, [mapImageLoaded, mapContainerReady]);

    // 初始化地图tab
    useEffect(() => {
        if (!sceneSetting?.scenes) {
            setPlacedScenes([]);
            return;
        }

        const loadedScenes: PlacedScene[] = [];
        sceneSetting.scenes.forEach(scene => {
            let x: number | undefined;
            let y: number | undefined;

            if (scene.position && Array.isArray(scene.position) && scene.position.length >= 2) {
                x = scene.position[0];
                y = scene.position[1];

                if (x === 0 && y === 0) {
                    x = undefined;
                    y = undefined;
                }
            }

            if (typeof x !== 'number' || typeof y !== 'number') {
                const cached = sceneDefaultPosRef.current[scene.id];
                if (cached) {
                    x = cached.x;
                    y = cached.y;
                } else {
                    const rand = () => 0.2 + Math.random() * 0.6;
                    x = rand();
                    y = rand();
                    sceneDefaultPosRef.current[scene.id] = { x, y };
                }
            }

            if (typeof x === 'number' && typeof y === 'number') {
                const clampedX = Math.max(0, Math.min(1, x));
                const clampedY = Math.max(0, Math.min(1, y));
                loadedScenes.push({
                    id: scene.id,
                    name: scene.name,
                    x: clampedX,
                    y: clampedY,
                    image: scene.image,
                });
            }
        });
        setPlacedScenes(loadedScenes);
        setSelectedSceneIdInMap(null);
    }, [sceneSetting?.scenes]);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 监听地图容器尺寸变化
    useEffect(() => {
        if (!isActive) {
            setMapContainerReady(false);
            return;
        }

        const container = mapPreviewRef.current;
        if (!container) {
            setMapContainerReady(false);
            return;
        }

        const checkContainer = () => {
            const rect = container.getBoundingClientRect();
            const isVisible =
                rect.width > 0 &&
                rect.height > 0 &&
                window.getComputedStyle(container).display !== 'none' &&
                window.getComputedStyle(container).visibility !== 'hidden';
            setMapContainerReady(isVisible);
        };

        checkContainer();

        let debounceTimer: ReturnType<typeof setTimeout> | null = null;
        const updatePositions = () => {
            checkContainer();
            setForceUpdate(prev => prev + 1);
        };

        const resizeObserver = new ResizeObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updatePositions, 100);
        });
        resizeObserver.observe(container);

        const handleResize = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updatePositions, 100);
        };
        window.addEventListener('resize', handleResize);

        const image = mapImageRef.current;
        if (image && image.complete) {
            setMapImageLoaded(true);
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [isActive]);

    const getScenePosition = useCallback(
        (scene: PlacedScene) => {
            const image = mapImageRef.current;
            const preview = mapPreviewRef.current;

            if (!image || !preview || !mapImageLoaded || !mapContainerReady) {
                return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
            }

            if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
                return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
            }

            const previewRect = preview.getBoundingClientRect();
            if (previewRect.width <= 0 || previewRect.height <= 0) {
                return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
            }

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            if (displayWidth <= 0 || displayHeight <= 0) {
                return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
            }

            const size = SCENE_ICON_SIZE;

            const centerXInImage = scene.x * displayWidth;
            const centerYInImage = scene.y * displayHeight;

            const centerX = offsetX + centerXInImage;
            const centerY = offsetY + centerYInImage;

            const left = centerX - size / 2;
            const top = centerY - size / 2;

            return { left, top, width: size, height: size, visible: true };
        },
        [windowSize, mapImageLoaded, mapContainerReady, forceUpdate]
    );

    // 场景拖拽处理
    const handleSceneMouseDown = useCallback(
        (e: React.MouseEvent, sceneId: string) => {
            e.preventDefault();
            e.stopPropagation();

            const image = mapImageRef.current;
            const preview = mapPreviewRef.current;
            const scene = placedScenes.find(s => s.id === sceneId);
            if (!image || !preview || !scene) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            const previewRect = preview.getBoundingClientRect();
            const centerXInImage = scene.x * displayWidth;
            const centerYInImage = scene.y * displayHeight;
            const sceneCenterX = previewRect.left + offsetX + centerXInImage;
            const sceneCenterY = previewRect.top + offsetY + centerYInImage;
            const offsetX_drag = e.clientX - sceneCenterX;
            const offsetY_drag = e.clientY - sceneCenterY;

            setSceneDragOffset({ x: offsetX_drag, y: offsetY_drag });
            setDraggingSceneId(sceneId);
            setSelectedSceneIdInMap(sceneId);
        },
        [placedScenes]
    );

    // 实时鼠标移动处理（用于拖拽场景）
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingSceneId || !sceneDragOffset) return;

            const image = mapImageRef.current;
            const preview = mapPreviewRef.current;
            if (!image || !preview) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            const previewRect = preview.getBoundingClientRect();
            const mouseX = e.clientX - previewRect.left;
            const mouseY = e.clientY - previewRect.top;

            const mouseXInImage = mouseX - offsetX;
            const mouseYInImage = mouseY - offsetY;

            const adjustedX = mouseXInImage - sceneDragOffset.x;
            const adjustedY = mouseYInImage - sceneDragOffset.y;

            const clampedX = Math.max(0, Math.min(displayWidth, adjustedX));
            const clampedY = Math.max(0, Math.min(displayHeight, adjustedY));

            const relativeX = clampedX / displayWidth;
            const relativeY = clampedY / displayHeight;

            setPlacedScenes(prev =>
                prev.map(s => (s.id === draggingSceneId ? { ...s, x: relativeX, y: relativeY } : s))
            );
        };

        const handleMouseUp = () => {
            setDraggingSceneId(null);
            setSceneDragOffset(null);
        };

        if (draggingSceneId) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingSceneId, sceneDragOffset]);

    // 保存场景位置
    const handleSaveScenePositions = useCallback(async () => {
        if (!fileId) {
            toast.error('文件ID不存在，请先上传文件');
            return;
        }

        if (placedScenes.length === 0) {
            toast.error('没有需要保存的场景位置');
            return;
        }

        try {
            const positions: { [key: string]: [number, number] } = {};
            placedScenes.forEach(scene => {
                positions[scene.id] = [scene.x, scene.y];
            });

            const response = await worldEditor.setScenePosition(fileId, positions);

            if (response.data.success) {
                toast.success(`成功保存 ${placedScenes.length} 个场景的位置`);
            } else {
                toast.error('保存失败，请检查网络连接');
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedScenes, fileId]);

    return (
        <>
            <div ref={mapPreviewRef} className={sharedStyles.mapPreview}>
                <img
                    ref={mapImageRef}
                    src={`${currentMapSrc}`}
                    alt="世界地图"
                    className={sharedStyles.sceneImage}
                    draggable={false}
                    key={currentMapSrc}
                    onLoad={() => {
                        setMapImageLoaded(true);
                        setForceUpdate(prev => prev + 1);
                    }}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (mapImageSources.dummy && target.src === mapImageSources.dummy && mapImageSources.base) {
                            target.src = mapImageSources.base;
                            return;
                        }
                        if (target.src !== DEFAULT_MAP_IMAGE) {
                            target.src = DEFAULT_MAP_IMAGE;
                            setWorldMapImageUrl(null);
                        } else {
                            setMapImageLoaded(true);
                        }
                    }}
                />

                {/* 加载遮罩 */}
                {!isMapContentReady && (
                    <div className={sharedStyles.loadingOverlay}>
                        <div className={sharedStyles.loadingSpinner}></div>
                        <div className={sharedStyles.loadingText}>正在加载地图...</div>
                    </div>
                )}

                {/* 只在内容准备好时才渲染场景 */}
                {isMapContentReady &&
                    placedScenes.map(scene => {
                        const pos = getScenePosition(scene);
                        const isSelected = selectedSceneIdInMap === scene.id;
                        const isDragging = draggingSceneId === scene.id;

                        if (!pos.visible) return null;

                        return (
                            <div
                                key={scene.id}
                                className={`${styles.placedScene} ${isSelected ? sharedStyles.placedNPCSelected : ''} ${isDragging ? sharedStyles.placedNPCDragging : ''}`}
                                style={{
                                    left: `${pos.left}px`,
                                    top: `${pos.top}px`,
                                    width: `${pos.width}px`,
                                    minHeight: `${pos.height}px`,
                                    opacity: pos.visible ? 1 : 0,
                                    transition: 'opacity 0.3s ease',
                                }}
                                onMouseDown={(e) => handleSceneMouseDown(e, scene.id)}
                                onClick={() => setSelectedSceneIdInMap(scene.id)}
                            >
                                <img
                                    src={scene.image ? getImageUrl(scene.image) : DEFAULT_SCENE_IMAGE}
                                    alt="场景"
                                    draggable={false}
                                    className={styles.sceneIcon}
                                    style={{
                                        width: `${pos.width}px`,
                                        height: `${pos.width}px`,
                                    }}
                                />
                                <div className={styles.sceneLabel}>{scene.name}</div>
                            </div>
                        );
                    })}

                <div className={sharedStyles.mapOverlayHint}>
                    拖拽场景到地图上的位置（已放置: {placedScenes.length} 个）
                </div>
            </div>

            <div className={sharedStyles.mapSidebar}>
                <div className={sharedStyles.subSceneList}>
                    <h4>场景列表</h4>
                    <div className={sharedStyles.subSceneItems}>
                        {!sceneSetting?.scenes || sceneSetting.scenes.length === 0 ? (
                            <div className={sharedStyles.subSceneDesc}>暂无场景，请先上传并解析数据</div>
                        ) : (
                            sceneSetting.scenes.map((scene) => (
                                <div
                                    key={scene.id}
                                    className={`${sharedStyles.subSceneItem} ${selectedSceneIdInMap === scene.id ? sharedStyles.subSceneItemActive : ''}`}
                                    onClick={() => setSelectedSceneIdInMap(scene.id)}
                                >
                                    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                                        {scene.image && (
                                            <img
                                                src={getImageUrl(scene.image)}
                                                alt={scene.name}
                                                className={sharedStyles.subSceneThumbImage}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.onerror = null;
                                                    target.style.display = 'none';
                                                    const placeholder = target.nextElementSibling as HTMLElement;
                                                    if (placeholder) {
                                                        placeholder.style.display = 'block';
                                                    }
                                                }}
                                            />
                                        )}
                                        <div
                                            className={sharedStyles.subSceneThumb}
                                            style={{
                                                display: scene.image ? 'none' : 'block',
                                                backgroundImage: !scene.image ? `url('${DEFAULT_SCENE_IMAGE}')` : undefined,
                                                backgroundSize: 'cover',
                                                backgroundPosition: 'center',
                                            }}
                                        />
                                    </div>
                                    <div className={sharedStyles.subSceneMeta}>
                                        <div className={sharedStyles.subSceneName}>{scene.name}</div>
                                        {scene.description && (
                                            <div className={sharedStyles.subSceneDesc} title={scene.description}>
                                                {scene.description}
                                            </div>
                                        )}
                                        {scene.subscenes && (
                                            <div className={sharedStyles.npcCount}>
                                                {scene.subscenes.length} 个子场景
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className={sharedStyles.confirmSection}>
                    <button
                        className={sharedStyles.confirmBtn}
                        onClick={handleSaveScenePositions}
                        disabled={placedScenes.length === 0 || !fileId}
                    >
                        确认保存场景位置
                    </button>
                    <div className={sharedStyles.confirmHint}>
                        {placedScenes.length === 0
                            ? '暂无场景位置需要保存'
                            : `将保存 ${placedScenes.length} 个场景的位置信息`}
                    </div>
                </div>
            </div>
        </>
    );
};

export default MapTab;

