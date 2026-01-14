import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import styles from './SceneTab.module.css';
import sharedStyles from './shared.module.css';
import { IoMdArrowDropdown, IoMdArrowDropright } from 'react-icons/io';
import type { Scene, PlacedSubScene } from './types';
import {
    DEFAULT_SCENE_IMAGE,
    DEFAULT_SUBSCENE_ICON,
    SUBSCENE_ICON_SIZE,
} from './constants';
import { getImageUrl } from '../../../utils/constants';
import { getImageDisplayBounds } from './utils';
import worldEditor from '../../../api/worldInteraction/worldEditor';
import toast from 'react-hot-toast';

interface SceneTabProps {
    sceneSetting?: { scenes?: Scene[] };
    fileId: string;
    onDataChange?: () => void;
    onHasUnsavedChanges?: (hasChanges: boolean) => void;
}

export interface SceneTabRef {
    checkUnsavedChanges: () => boolean;
    save: () => Promise<void>;
}

const SceneTab = forwardRef<SceneTabRef, SceneTabProps>(({
    sceneSetting,
    fileId,
    onDataChange,
    onHasUnsavedChanges,
}, ref) => {
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [placedSubScenes, setPlacedSubScenes] = useState<PlacedSubScene[]>([]);
    const [draggingSubSceneId, setDraggingSubSceneId] = useState<string | null>(null);
    const [selectedSubSceneIdInScene, setSelectedSubSceneIdInScene] = useState<string | null>(null);
    const [subSceneDragOffset, setSubSceneDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
    const [editingSubScene, setEditingSubScene] = useState<PlacedSubScene | null>(null);
    const [sceneImageLoaded, setSceneImageLoaded] = useState(false);
    const [isSceneContentReady, setIsSceneContentReady] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const scenePreviewRef = useRef<HTMLDivElement>(null);
    const sceneImageRef = useRef<HTMLImageElement>(null);
    const subSceneDefaultPosRef = useRef<Record<string, { x: number; y: number }>>({});
    const initialPlacedSubScenesRef = useRef<PlacedSubScene[]>([]);

    const currentScene = useMemo(() => {
        if (!sceneSetting?.scenes || sceneSetting.scenes.length === 0) return null;
        if (selectedSceneId) {
            const scene = sceneSetting.scenes.find(s => s.id === selectedSceneId);
            if (scene) return scene;
        }
        return sceneSetting.scenes[0];
    }, [sceneSetting?.scenes, selectedSceneId]);

    // 初始化场景tab
    useEffect(() => {
        if (sceneSetting?.scenes && sceneSetting.scenes.length > 0) {
            if (!selectedSceneId || !sceneSetting.scenes.find(s => s.id === selectedSceneId)) {
                setSelectedSceneId(sceneSetting.scenes[0].id);
            }
        }
    }, [sceneSetting?.scenes]);

    // 内容就绪检测
    useEffect(() => {
        if (sceneImageLoaded) {
            const timer = setTimeout(() => {
                setIsSceneContentReady(true);
                setForceUpdate(prev => prev + 1);
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setIsSceneContentReady(false);
            const fallbackTimer = setTimeout(() => {
                setIsSceneContentReady(true);
                setSceneImageLoaded(true);
            }, 3000);
            return () => clearTimeout(fallbackTimer);
        }
    }, [sceneImageLoaded]);

    // 初始化子场景位置
    useEffect(() => {
        if (!currentScene) {
            setPlacedSubScenes([]);
            return;
        }

        const loadedSubScenes: PlacedSubScene[] = [];
        if (currentScene.subscenes) {
            currentScene.subscenes.forEach(subScene => {
                let x: number | undefined;
                let y: number | undefined;

                if (subScene.position && Array.isArray(subScene.position) && subScene.position.length >= 2) {
                    x = subScene.position[0];
                    y = subScene.position[1];
                } else {
                    const cached = subSceneDefaultPosRef.current[subScene.id];
                    if (cached) {
                        x = cached.x;
                        y = cached.y;
                    } else {
                        const rand = () => 0.2 + Math.random() * 0.6;
                        x = rand();
                        y = rand();
                        subSceneDefaultPosRef.current[subScene.id] = { x, y };
                    }
                }

                if (typeof x === 'number' && typeof y === 'number') {
                    const clampedX = Math.max(0, Math.min(1, x));
                    const clampedY = Math.max(0, Math.min(1, y));
                    loadedSubScenes.push({
                        id: subScene.id,
                        name: subScene.name,
                        x: clampedX,
                        y: clampedY,
                        parentSceneId: currentScene.id,
                    });
                }
            });
        }
        setPlacedSubScenes(loadedSubScenes);
        initialPlacedSubScenesRef.current = JSON.parse(JSON.stringify(loadedSubScenes)); // 保存初始状态
        setSelectedSubSceneIdInScene(null);
        setEditingSubScene(null);
    }, [currentScene]);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getSubScenePosition = useCallback(
        (subScene: PlacedSubScene) => {
            const image = sceneImageRef.current;
            const preview = scenePreviewRef.current;

            if (!image || !preview || !sceneImageLoaded) {
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

            const size = SUBSCENE_ICON_SIZE;

            const centerXInImage = subScene.x * displayWidth;
            const centerYInImage = subScene.y * displayHeight;

            const centerX = offsetX + centerXInImage;
            const centerY = offsetY + centerYInImage;

            const left = centerX - size / 2;
            const top = centerY - size / 2;

            return { left, top, width: size, height: size, visible: true };
        },
        [windowSize, sceneImageLoaded, forceUpdate]
    );

    const handleSubSceneDragStart = useCallback(
        (e: React.DragEvent, subSceneId: string) => {
            e.stopPropagation();

            const image = sceneImageRef.current;
            const subScene = placedSubScenes.find(s => s.id === subSceneId);
            if (!image || !subScene) return;

            const imageRect = image.getBoundingClientRect();
            const centerX = subScene.x * imageRect.width;
            const centerY = subScene.y * imageRect.height;
            const subSceneCenterX = imageRect.left + centerX;
            const subSceneCenterY = imageRect.top + centerY;
            const offsetX = e.clientX - subSceneCenterX;
            const offsetY = e.clientY - subSceneCenterY;

            setSubSceneDragOffset({ x: offsetX, y: offsetY });
            setDraggingSubSceneId(subSceneId);
            setSelectedSubSceneIdInScene(subSceneId);
        },
        [placedSubScenes]
    );

    const handleSubSceneDragEnd = useCallback(() => {
        setDraggingSubSceneId(null);
        setSubSceneDragOffset(null);
    }, []);

    const handleSubSceneDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const preview = scenePreviewRef.current;
            const image = sceneImageRef.current;
            if (!preview || !image) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            const previewRect = preview.getBoundingClientRect();
            const mouseX = e.clientX - previewRect.left;
            const mouseY = e.clientY - previewRect.top;

            const mouseXInImage = mouseX - offsetX;
            const mouseYInImage = mouseY - offsetY;

            const halfSize = SUBSCENE_ICON_SIZE / 2;
            const minCenterX = halfSize;
            const maxCenterX = displayWidth - halfSize;
            const minCenterY = halfSize;
            const maxCenterY = displayHeight - halfSize;

            const boundedX = Math.max(minCenterX, Math.min(maxCenterX, mouseXInImage));
            const boundedY = Math.max(minCenterY, Math.min(maxCenterY, mouseYInImage));

            let relativeX = boundedX / displayWidth;
            let relativeY = boundedY / displayHeight;

            if (draggingSubSceneId && subSceneDragOffset) {
                const adjustedX = boundedX - subSceneDragOffset.x;
                const adjustedY = boundedY - subSceneDragOffset.y;
                relativeX = Math.max(0, Math.min(1, adjustedX / displayWidth));
                relativeY = Math.max(0, Math.min(1, adjustedY / displayHeight));

                setPlacedSubScenes(prev =>
                    prev.map(sub =>
                        sub.id === draggingSubSceneId ? { ...sub, x: relativeX, y: relativeY } : sub
                    )
                );
                setDraggingSubSceneId(null);
                setSubSceneDragOffset(null);
            }
        },
        [draggingSubSceneId, subSceneDragOffset]
    );

    const handleSubSceneDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const toggleSceneExpand = useCallback((sceneId: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExpandedScenes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(sceneId)) {
                newSet.delete(sceneId);
            } else {
                newSet.add(sceneId);
            }
            return newSet;
        });
    }, []);

    const handleSceneSelect = useCallback((sceneId: string) => {
        setSelectedSceneId(sceneId);
        setSelectedSubSceneIdInScene(null);
        setEditingSubScene(null);
    }, []);

    const handleSubSceneClick = useCallback((subScene: PlacedSubScene) => {
        setSelectedSubSceneIdInScene(subScene.id);
        setEditingSubScene(subScene);
    }, []);

    const handleSaveSubSceneParent = useCallback(
        async (subSceneId: string, newParentSceneId: string) => {
            if (!fileId) {
                toast.error('文件ID不存在，请先上传文件');
                return;
            }

            const originalSubScene = sceneSetting?.scenes
                ?.flatMap(s => s.subscenes || [])
                .find(s => s.id === subSceneId);

            if (!originalSubScene) {
                toast.error('找不到子场景');
                return;
            }

            const oldParentSceneId = originalSubScene.parentId || currentScene?.id;
            if (!oldParentSceneId) {
                toast.error('无法确定子场景的当前父场景');
                return;
            }

            if (oldParentSceneId === newParentSceneId) {
                toast.success('父场景未改变');
                setEditingSubScene(null);
                setSelectedSubSceneIdInScene(null);
                return;
            }

            try {
                const response = await worldEditor.changeSubSceneScene(
                    fileId,
                    subSceneId,
                    oldParentSceneId,
                    newParentSceneId
                );

                if (response.data.success) {
                    toast.success('子场景父场景已更新');
                    setEditingSubScene(null);
                    setSelectedSubSceneIdInScene(null);
                    if (onDataChange) {
                        onDataChange();
                    }
                } else {
                    toast.error('更新失败');
                }
            } catch (error: any) {
                console.error('更新失败:', error);
                toast.error('更新失败：' + (error.message || '请检查网络连接'));
            }
        },
        [fileId, sceneSetting?.scenes, currentScene, onDataChange]
    );

    const handleSaveSubScenePositions = useCallback(async () => {
        if (!fileId) {
            toast.error('文件ID不存在，请先上传文件');
            return;
        }

        if (placedSubScenes.length === 0) {
            toast.error('没有需要保存的子场景位置');
            return;
        }

        if (!currentScene) {
            toast.error('当前场景不存在');
            return;
        }

        try {
            const positions: { [key: string]: [number, number] } = {};
            placedSubScenes.forEach(subScene => {
                positions[subScene.id] = [subScene.x, subScene.y];
            });

            const response = await worldEditor.setSubScenePosition(fileId, currentScene.id, positions);

            if (response.data.success) {
                toast.success(`成功保存 ${placedSubScenes.length} 个子场景的位置`);
                initialPlacedSubScenesRef.current = JSON.parse(JSON.stringify(placedSubScenes)); // 重置初始状态
                if (onHasUnsavedChanges) {
                    onHasUnsavedChanges(false);
                }
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('保存失败，请检查网络连接');
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedSubScenes, fileId, currentScene, onHasUnsavedChanges, onDataChange]);

    // 检测是否有未保存的修改
    const checkUnsavedChanges = useCallback((): boolean => {
        return JSON.stringify(placedSubScenes) !== JSON.stringify(initialPlacedSubScenesRef.current);
    }, [placedSubScenes]);

    // 当未保存状态变化时，通知父组件
    useEffect(() => {
        if (onHasUnsavedChanges) {
            const hasChanges = checkUnsavedChanges();
            onHasUnsavedChanges(hasChanges);
        }
    }, [checkUnsavedChanges, onHasUnsavedChanges, placedSubScenes]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
        checkUnsavedChanges,
        save: handleSaveSubScenePositions,
    }), [checkUnsavedChanges, handleSaveSubScenePositions]);

    return (
        <>
            <div
                ref={scenePreviewRef}
                className={sharedStyles.mapPreview}
                onDrop={handleSubSceneDrop}
                onDragOver={handleSubSceneDragOver}
            >
                <img
                    ref={sceneImageRef}
                    src={currentScene?.image ? getImageUrl(currentScene.image) : DEFAULT_SCENE_IMAGE}
                    alt={currentScene?.name || '场景地图'}
                    className={sharedStyles.sceneImage}
                    draggable={false}
                    onLoad={() => {
                        setSceneImageLoaded(true);
                        setForceUpdate(prev => prev + 1);
                    }}
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== DEFAULT_SCENE_IMAGE) {
                            target.src = DEFAULT_SCENE_IMAGE;
                        } else {
                            setSceneImageLoaded(true);
                        }
                    }}
                />

                {/* 加载遮罩 */}
                {!isSceneContentReady && (
                    <div className={sharedStyles.loadingOverlay}>
                        <div className={sharedStyles.loadingSpinner}></div>
                        <div className={sharedStyles.loadingText}>正在加载场景...</div>
                    </div>
                )}

                {/* 只在内容准备好时才渲染子场景 */}
                {isSceneContentReady &&
                    placedSubScenes.map(subScene => {
                        const pos = getSubScenePosition(subScene);
                        const isSelected = selectedSubSceneIdInScene === subScene.id;
                        const isDragging = draggingSubSceneId === subScene.id;

                        if (!pos.visible) return null;

                        return (
                            <div
                                key={subScene.id}
                                className={`${styles.placedSubScene} ${isSelected ? sharedStyles.placedNPCSelected : ''} ${isDragging ? sharedStyles.placedNPCDragging : ''}`}
                                style={{
                                    left: `${pos.left}px`,
                                    top: `${pos.top}px`,
                                    width: `${pos.width}px`,
                                    minHeight: `${pos.height}px`,
                                    opacity: pos.visible ? 1 : 0,
                                    transition: 'opacity 0.3s ease',
                                }}
                                draggable
                                onDragStart={(e) => handleSubSceneDragStart(e, subScene.id)}
                                onDragEnd={handleSubSceneDragEnd}
                                onClick={() => handleSubSceneClick(subScene)}
                            >
                                <img
                                    src={
                                        (() => {
                                            const subSceneImage = sceneSetting?.scenes
                                                ?.find(s => s.id === subScene.parentSceneId)
                                                ?.subscenes
                                                ?.find(ss => ss.id === subScene.id)
                                                ?.image;
                                            return subSceneImage ? getImageUrl(subSceneImage) : DEFAULT_SUBSCENE_ICON;
                                        })()
                                    }
                                    alt="子场景"
                                    draggable={false}
                                    className={styles.subSceneIcon}
                                    style={{
                                        width: `${pos.width}px`,
                                        height: `${pos.width}px`,
                                    }}
                                />
                                <div className={styles.subSceneLabel}>{subScene.name}</div>
                            </div>
                        );
                    })}

                <div className={sharedStyles.mapOverlayHint}>
                    {currentScene && (
                        <>
                            场景：{currentScene.name} | 拖拽子场景到地图上的位置（已放置: {placedSubScenes.length} 个）
                        </>
                    )}
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
                                <div key={scene.id}>
                                    <div
                                        className={`${styles.sceneItem} ${selectedSceneId === scene.id ? styles.sceneItemActive : ''}`}
                                    >
                                        <span
                                            className={styles.expandIcon}
                                            onClick={(e) => toggleSceneExpand(scene.id, e)}
                                        >
                                            {expandedScenes.has(scene.id) ? (
                                                <IoMdArrowDropdown size={20} />
                                            ) : (
                                                <IoMdArrowDropright size={20} />
                                            )}
                                        </span>
                                        <div
                                            className={styles.sceneName}
                                            onClick={() => handleSceneSelect(scene.id)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {scene.name}
                                        </div>
                                        {scene.subscenes && (
                                            <div className={styles.subSceneCount}>
                                                {scene.subscenes.length} 个子场景
                                            </div>
                                        )}
                                    </div>
                                    {expandedScenes.has(scene.id) && scene.subscenes && (
                                        <div className={styles.subScenesList}>
                                            {scene.subscenes.map((subScene) => {
                                                const placedSubScene: PlacedSubScene = {
                                                    id: subScene.id,
                                                    name: subScene.name,
                                                    x: subScene.position?.[0] ?? 0.5,
                                                    y: subScene.position?.[1] ?? 0.5,
                                                    parentSceneId: scene.id,
                                                };
                                                return (
                                                    <div
                                                        key={subScene.id}
                                                        className={`${sharedStyles.subSceneItem} ${selectedSubSceneIdInScene === subScene.id ? sharedStyles.subSceneItemActive : ''}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSubSceneClick(placedSubScene);
                                                        }}
                                                    >
                                                        <div className={sharedStyles.subSceneThumbWrapper}>
                                                            {subScene.image ? (
                                                                <img
                                                                    src={getImageUrl(subScene.image)}
                                                                    alt={subScene.name}
                                                                    className={sharedStyles.subSceneThumbImage}
                                                                    onError={(e) => {
                                                                        const target = e.target as HTMLImageElement;
                                                                        target.onerror = null;
                                                                        target.style.display = 'none';
                                                                        const placeholder = target.nextElementSibling as HTMLElement;
                                                                        if (placeholder) placeholder.style.display = 'block';
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <div
                                                                className={sharedStyles.subSceneThumb}
                                                                style={{ display: subScene.image ? 'none' : 'block' }}
                                                            />
                                                        </div>
                                                        <div className={sharedStyles.subSceneMeta}>
                                                            <div className={sharedStyles.subSceneName}>{subScene.name}</div>
                                                            {subScene.description && (
                                                                <div className={sharedStyles.subSceneDesc} title={subScene.description}>
                                                                    {subScene.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {editingSubScene && (
                    <div className={styles.subSceneEditForm}>
                        <h4>编辑子场景</h4>
                        <div className={styles.formField}>
                            <label>子场景名称</label>
                            <div className={styles.formValue}>{editingSubScene.name}</div>
                        </div>
                        <div className={styles.formField}>
                            <label>父场景</label>
                            <select
                                value={editingSubScene.parentSceneId}
                                onChange={(e) => {
                                    const newParentId = e.target.value;
                                    setEditingSubScene(prev =>
                                        prev ? { ...prev, parentSceneId: newParentId } : null
                                    );
                                }}
                                className={styles.formSelect}
                            >
                                {sceneSetting?.scenes?.map(scene => (
                                    <option key={scene.id} value={scene.id}>
                                        {scene.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formActions}>
                            <button
                                className={styles.formBtn}
                                onClick={() => {
                                    if (editingSubScene) {
                                        handleSaveSubSceneParent(editingSubScene.id, editingSubScene.parentSceneId);
                                    }
                                }}
                            >
                                保存
                            </button>
                            <button
                                className={styles.formBtnCancel}
                                onClick={() => {
                                    setEditingSubScene(null);
                                    setSelectedSubSceneIdInScene(null);
                                }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                )}

                <button
                    className={sharedStyles.confirmBtn}
                    onClick={handleSaveSubScenePositions}
                    disabled={placedSubScenes.length === 0 || !fileId}
                >
                    确认保存子场景位置
                </button>
            </div>
        </>
    );
});

SceneTab.displayName = 'SceneTab';

export default SceneTab;

