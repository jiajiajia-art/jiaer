import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import styles from './MapPanel.module.css';
import worldEditor from '../../api/worldInteraction/worldEditor';
import type { NpcSlot } from '../../api/worldInteraction/worldEditor.type';
import toast from 'react-hot-toast';
import { IoMdArrowDropdown, IoMdArrowDropright } from 'react-icons/io';

interface SubScene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    npcs?: string[];
    position?: number[];
    npcs_slots?: Array<{ position?: number[]; zoom?: number }>;
    parentId?: string;
    parentName?: string;
}

interface Scene {
    id: string;
    name: string;
    description?: string;
    image?: string;
    subscenes?: SubScene[];
    position?: [number, number];
}

interface MapPanelProps {
    sceneSetting?: {
        scenes?: Scene[];
    };
    worldMapImage?: string | null;
    fileId: string;
    onDataChange?: () => void; // 数据变更回调，用于刷新数据
    isActive?: boolean; // 当前面板是否可见，用于刷新布局
}

interface PlacedNPC {
    id: string;
    x: number;
    y: number;
    scale: number;
    zIndex?: number; // 层级设置，用于控制显示顺序
}

interface PlacedSubScene {
    id: string;
    name: string;
    x: number;
    y: number;
    parentSceneId: string;
}

const DEFAULT_SCENE_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultScene.png`;
// 大地图 & 场景图标默认图片：使用 defaultMap.png
const DEFAULT_MAP_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultMap.png`;
const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;
// 地图 tab 场景点 & 场景 tab 子场景点，共用同一张默认图
const DEFAULT_SUBSCENE_ICON = DEFAULT_MAP_IMAGE;
const BASE_NPC_WIDTH = 100;
const BASE_NPC_HEIGHT = 150;
const SUBSCENE_ICON_SIZE = 40;
const SCENE_ICON_SIZE = 40; // 场景图标大小
const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const MAX_NPCS = 3;
const DEFAULT_Z_INDEX = 1; // 默认层级
const MIN_Z_INDEX = 0;
const MAX_Z_INDEX = 999;

const MapPanel: React.FC<MapPanelProps> = ({ sceneSetting, worldMapImage, fileId, onDataChange, isActive }) => {
    // 子场景tab状态
    const [mapTab, setMapTab] = useState<'subScene' | 'scene' | 'map'>('subScene');
    const [selectedSubSceneId, setSelectedSubSceneId] = useState<string | null>(null);
    const [placedNPCs, setPlacedNPCs] = useState<PlacedNPC[]>([]);
    const [draggingNPCId, setDraggingNPCId] = useState<string | null>(null);
    const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [resizingNPCId, setResizingNPCId] = useState<string | null>(null);
    const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'sw' | 'se' | null>(null);
    const [resizeStart, setResizeStart] = useState<{ 
        mouseX: number; 
        mouseY: number; 
        npcCenterX: number; 
        npcCenterY: number; 
        initialDistance: number;
        scale: number 
    } | null>(null);
    
    // 场景tab状态
    const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
    const [placedSubScenes, setPlacedSubScenes] = useState<PlacedSubScene[]>([]);
    const [draggingSubSceneId, setDraggingSubSceneId] = useState<string | null>(null);
    const [selectedSubSceneIdInScene, setSelectedSubSceneIdInScene] = useState<string | null>(null);
    const [subSceneDragOffset, setSubSceneDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
    const [editingSubScene, setEditingSubScene] = useState<PlacedSubScene | null>(null);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [sceneImageLoaded, setSceneImageLoaded] = useState(false);
    const [mapImageLoaded, setMapImageLoaded] = useState(false);
    const [containerReady, setContainerReady] = useState(false);
    const [mapContainerReady, setMapContainerReady] = useState(false);
    const [worldMapImageUrl, setWorldMapImageUrl] = useState<string | null>(null);
    
    // 内容就绪状态（用于延迟显示，确保位置计算正确）
    const [isSubSceneContentReady, setIsSubSceneContentReady] = useState(false);
    const [isSceneContentReady, setIsSceneContentReady] = useState(false);
    const [isMapContentReady, setIsMapContentReady] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0); // 强制重新计算位置的触发器
    
    // 地图tab状态（增加 image 字段，用于使用真实场景图标）
    const [placedScenes, setPlacedScenes] = useState<Array<{ id: string; name: string; x: number; y: number; image?: string }>>([]);
    const [draggingSceneId, setDraggingSceneId] = useState<string | null>(null);
    const [selectedSceneIdInMap, setSelectedSceneIdInMap] = useState<string | null>(null);
    const [sceneDragOffset, setSceneDragOffset] = useState<{ x: number; y: number } | null>(null);
    
    const previewRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const scenePreviewRef = useRef<HTMLDivElement>(null);
    const sceneImageRef = useRef<HTMLImageElement>(null);
    const mapPreviewRef = useRef<HTMLDivElement>(null);
    const mapImageRef = useRef<HTMLImageElement>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const currentSubSceneIdRef = useRef<string | null>(null);
    // 为缺失 position 的子场景/场景提供一次性随机初始位置，保证可见且可拖拽
    const subSceneDefaultPosRef = useRef<Record<string, { x: number; y: number }>>({});
    const sceneDefaultPosRef = useRef<Record<string, { x: number; y: number }>>({});

    useEffect(() => {
        if (isActive) {
            setMapTab('subScene');
        }
    }, [isActive]);

    // 每次tab切换时重置内容就绪状态
    useEffect(() => {
        setIsSubSceneContentReady(false);
        setIsSceneContentReady(false);
        setIsMapContentReady(false);
        setForceUpdate(prev => prev + 1);
    }, [mapTab]);

    // 子场景tab内容就绪检测（增加超时保底机制）
    useEffect(() => {
        if (mapTab === 'subScene') {
            if (imageLoaded && containerReady) {
                const timer = setTimeout(() => {
                    setIsSubSceneContentReady(true);
                    setForceUpdate(prev => prev + 1);
                }, 50);
                return () => clearTimeout(timer);
            } else {
                setIsSubSceneContentReady(false);
                // 超时保底：3秒后强制显示内容，避免永远卡在loading
                const fallbackTimer = setTimeout(() => {
                    setIsSubSceneContentReady(true);
                    setImageLoaded(true);
                    setContainerReady(true);
                }, 3000);
                return () => clearTimeout(fallbackTimer);
            }
        }
    }, [mapTab, imageLoaded, containerReady]);

    // 场景tab内容就绪检测（增加超时保底机制）
    useEffect(() => {
        if (mapTab === 'scene') {
            if (sceneImageLoaded) {
                const timer = setTimeout(() => {
                    setIsSceneContentReady(true);
                    setForceUpdate(prev => prev + 1);
                }, 50);
                return () => clearTimeout(timer);
            } else {
                setIsSceneContentReady(false);
                // 超时保底：3秒后强制显示内容
                const fallbackTimer = setTimeout(() => {
                    setIsSceneContentReady(true);
                    setSceneImageLoaded(true);
                }, 3000);
                return () => clearTimeout(fallbackTimer);
            }
        }
    }, [mapTab, sceneImageLoaded]);

    // 地图tab内容就绪检测（增加超时保底机制）
    useEffect(() => {
        if (mapTab === 'map') {
            if (mapImageLoaded && mapContainerReady) {
                const timer = setTimeout(() => {
                    setIsMapContentReady(true);
                    setForceUpdate(prev => prev + 1);
                }, 50);
                return () => clearTimeout(timer);
            } else {
                setIsMapContentReady(false);
                // 超时保底：3秒后强制显示内容
                const fallbackTimer = setTimeout(() => {
                    setIsMapContentReady(true);
                    setMapImageLoaded(true);
                    setMapContainerReady(true);
                }, 3000);
                return () => clearTimeout(fallbackTimer);
            }
        }
    }, [mapTab, mapImageLoaded, mapContainerReady]);

    // 计算属性，提取subscenes
    const subScenes = useMemo<SubScene[]>(() => {
        if (!sceneSetting?.scenes) return [];
        return sceneSetting.scenes.flatMap(scene =>
            (scene.subscenes || []).map(sub => ({
                ...sub,
                parentId: scene.id,
                parentName: scene.name,
            }))
        );
    }, [sceneSetting?.scenes]);

    const currentSubScene = useMemo(
        () => subScenes.find(s => s.id === selectedSubSceneId) || null,
        [subScenes, selectedSubSceneId]
    );

    const currentScene = useMemo(() => {
        if (!sceneSetting?.scenes || sceneSetting.scenes.length === 0) return null;
        if (selectedSceneId) {
            const scene = sceneSetting.scenes.find(s => s.id === selectedSceneId);
            if (scene) return scene;
        }
        return sceneSetting.scenes[0];
    }, [sceneSetting?.scenes, selectedSceneId]);

    // 根据当前 tab 选择显示的底图：子场景只使用自己的图片或默认图，不使用父场景图；场景 tab 用场景图
    const sceneImageUrl = useMemo(() => {
        if (mapTab === 'subScene') {
            // 只使用子场景自己的图片，如果没有则使用默认图，不使用父场景的图片
            if (currentSubScene?.image && currentSubScene.image.trim() !== '') {
                return currentSubScene.image;
            }
            // 子场景没有图片时直接使用默认图
            return DEFAULT_MAP_IMAGE;
        }
        if (mapTab === 'scene') {
            return currentScene?.image || DEFAULT_SCENE_IMAGE;
        }
        return DEFAULT_SCENE_IMAGE;
    }, [mapTab, currentSubScene?.image, currentScene?.image]);

    // 地图 tab 使用的图片地址（优先上传/生成后的 url，其次后端返回的 worldMapImage + '/dummy'，最后默认图）
    const mapImageSources = useMemo(() => {
        const base = worldMapImageUrl || worldMapImage || null;
        const dummy = base ? `${base}/dummy` : null;
        return { dummy, base };
    }, [worldMapImageUrl, worldMapImage]);

    const currentMapSrc = mapImageSources.dummy || mapImageSources.base || DEFAULT_MAP_IMAGE;

    // 同步后端返回的 worldMapImage 到本地状态（用于刷新后直接使用 /dummy 路径）
    useEffect(() => {
        if (worldMapImage) {
            setWorldMapImageUrl(worldMapImage);
        } else {
            setWorldMapImageUrl(null);
        }
    }, [worldMapImage]);

    // 当图片URL改变时，重置加载状态
    useEffect(() => {
        if (mapTab === 'subScene') {
            setImageLoaded(false);
        }
    }, [sceneImageUrl, mapTab]);

    useEffect(() => {
        if (mapTab === 'scene') {
            setSceneImageLoaded(false);
        }
    }, [sceneImageUrl, mapTab, currentScene?.id]);

    // 初始化子场景tab（添加sceneSetting依赖，确保数据刷新后重新加载NPC）
    useEffect(() => {
        if (subScenes.length === 0) {
            setSelectedSubSceneId(null);
            setPlacedNPCs([]);
            return;
        }
        
        let targetSubScene: SubScene | null = null;
        if (!selectedSubSceneId || !subScenes.find(s => s.id === selectedSubSceneId)) {
            targetSubScene = subScenes[0];
            setSelectedSubSceneId(targetSubScene.id);
        } else {
            targetSubScene = currentSubScene;
        }
        
        if (!targetSubScene) return;
        
        currentSceneIdRef.current = targetSubScene.parentId || null;
        currentSubSceneIdRef.current = targetSubScene.id;
        
        if (targetSubScene.npcs_slots && targetSubScene.npcs_slots.length > 0) {
            const loadedNPCs: PlacedNPC[] = targetSubScene.npcs_slots.map((slot, index) => ({
                id: `slot_${targetSubScene.id}_${index}`,
                x: slot.position?.[0] ?? 0.5,
                y: slot.position?.[1] ?? 0.5,
                scale: DEFAULT_SCALE, // 缩放比例使用默认值，因为zoom字段现在存储层级
                zIndex: slot.zoom ?? DEFAULT_Z_INDEX // zoom字段存储层级（zIndex）
            }));
            setPlacedNPCs(loadedNPCs);
        } else {
            setPlacedNPCs([]);
        }
    }, [subScenes, selectedSubSceneId, currentSubScene, sceneSetting]);

    // 初始化场景tab
    useEffect(() => {
        if (mapTab === 'scene' && sceneSetting?.scenes && sceneSetting.scenes.length > 0) {
            if (!selectedSceneId || !sceneSetting.scenes.find(s => s.id === selectedSceneId)) {
                setSelectedSceneId(sceneSetting.scenes[0].id);
            }
        }
    }, [mapTab, sceneSetting?.scenes]);

    useEffect(() => {
        if (mapTab !== 'scene' || !currentScene) {
            setPlacedSubScenes([]);
            return;
        }

        const loadedSubScenes: PlacedSubScene[] = [];
        if (currentScene.subscenes) {
            currentScene.subscenes.forEach(subScene => {
                let x: number | undefined;
                let y: number | undefined;

                // 后端可能缺少 position，这里兜底为稳定随机值（仅第一次生成）
                if (subScene.position && Array.isArray(subScene.position) && subScene.position.length >= 2) {
                    x = subScene.position[0];
                    y = subScene.position[1];
                } else {
                    const cached = subSceneDefaultPosRef.current[subScene.id];
                    if (cached) {
                        x = cached.x;
                        y = cached.y;
                    } else {
                        // 生成 0.2~0.8 的随机位置，避免贴边
                        const rand = () => 0.2 + Math.random() * 0.6;
                        x = rand();
                        y = rand();
                        subSceneDefaultPosRef.current[subScene.id] = { x, y };
                    }
                }

                // 确保在 0-1 区间
                if (typeof x === 'number' && typeof y === 'number') {
                    const clampedX = Math.max(0, Math.min(1, x));
                    const clampedY = Math.max(0, Math.min(1, y));
                    loadedSubScenes.push({
                        id: subScene.id,
                        name: subScene.name,
                        x: clampedX,
                        y: clampedY,
                        parentSceneId: currentScene.id
                    });
                }
            });
        }
        setPlacedSubScenes(loadedSubScenes);
        setSelectedSubSceneIdInScene(null);
        setEditingSubScene(null);
    }, [mapTab, currentScene]);

    // 初始化地图tab
    useEffect(() => {
        if (mapTab !== 'map' || !sceneSetting?.scenes) {
            setPlacedScenes([]);
            return;
        }

        const loadedScenes: Array<{ id: string; name: string; x: number; y: number; image?: string }> = [];
        sceneSetting.scenes.forEach(scene => {
            let x: number | undefined;
            let y: number | undefined;

            if (scene.position && Array.isArray(scene.position) && scene.position.length >= 2) {
                x = scene.position[0];
                y = scene.position[1];

                // 如果后端给的是 [0,0]（左上角默认），视为「未布置」，改用前端稳定随机
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
                    image: scene.image, // 保留场景图片用于图标展示
                });
            }
        });
        setPlacedScenes(loadedScenes);
        setSelectedSceneIdInMap(null);
    }, [mapTab, sceneSetting?.scenes]);

    // 监听窗口大小变化，确保NPC和子场景跟随图片移动
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 监听容器尺寸变化（子场景 tab），确保容器准备好后再计算位置
    useEffect(() => {
        // 仅在当前面板可见且是子场景 tab 时检查容器
        if (!isActive || mapTab !== 'subScene') {
            setContainerReady(false);
            return;
        }

        const container = previewRef.current;
        if (!container) {
            setContainerReady(false);
            return;
        }

        // 检查容器是否可见且有尺寸
        const checkContainer = () => {
            const rect = container.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 && 
                             window.getComputedStyle(container).display !== 'none' &&
                             window.getComputedStyle(container).visibility !== 'hidden';
            
            setContainerReady(isVisible);
        };

        // 立即检查一次
        checkContainer();

        // 使用防抖优化ResizeObserver，避免频繁更新
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

        // 也监听窗口大小变化（防抖）
        const handleResize = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(updatePositions, 100);
        };
        window.addEventListener('resize', handleResize);

        // 如果图片已加载且容器可见，立即标记为 ready（处理刷新后首次进入的情况）
        const image = imageRef.current;
        if (image && image.complete) {
            setImageLoaded(true);
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [mapTab, isActive]);

    // 监听地图容器尺寸变化（地图 tab），避免在隐藏状态下计算为 0 尺寸
    useEffect(() => {
        if (!isActive || mapTab !== 'map') {
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

        // 使用防抖优化ResizeObserver
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
    }, [mapTab, isActive]);

    // 计算图片在 object-fit: contain 模式下的实际显示尺寸和偏移
    const getImageDisplayBounds = useCallback((image: HTMLImageElement, container: HTMLDivElement) => {
        // 必须确保图片完全加载
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
            return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0 };
        }

        const containerRect = container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // 如果容器尺寸无效，返回0
        if (containerWidth <= 0 || containerHeight <= 0) {
            return { displayWidth: 0, displayHeight: 0, offsetX: 0, offsetY: 0 };
        }
        
        const naturalWidth = image.naturalWidth;
        const naturalHeight = image.naturalHeight;
        
        // 计算 object-fit: contain 的实际显示尺寸
        const containerAspect = containerWidth / containerHeight;
        const imageAspect = naturalWidth / naturalHeight;
        
        let displayWidth: number;
        let displayHeight: number;
        let offsetX = 0;
        let offsetY = 0;
        
        if (imageAspect > containerAspect) {
            // 图片更宽，宽度填满容器，高度按比例缩放
            displayWidth = containerWidth;
            displayHeight = containerWidth / imageAspect;
            offsetY = (containerHeight - displayHeight) / 2;
        } else {
            // 图片更高，高度填满容器，宽度按比例缩放
            displayHeight = containerHeight;
            displayWidth = containerHeight * imageAspect;
            offsetX = (containerWidth - displayWidth) / 2;
        }
        
        return { displayWidth, displayHeight, offsetX, offsetY };
    }, []);

    // NPC拖拽处理
    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (placedNPCs.length >= MAX_NPCS) {
            e.preventDefault();
            return;
        }
        setDraggingNPCId('new');
    }, [placedNPCs.length]);

    // 实时鼠标移动处理（用于拖拽NPC和调整大小）
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // 处理调整大小
            if (resizingNPCId && resizeHandle && resizeStart) {
                const image = imageRef.current;
                const preview = previewRef.current;
                if (!image || !preview) return;
                
                const bounds = getImageDisplayBounds(image, preview);
                const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
                
                if (displayWidth <= 0 || displayHeight <= 0) return;
                
                const previewRect = preview.getBoundingClientRect();
                const mouseX = e.clientX - previewRect.left;
                const mouseY = e.clientY - previewRect.top;
                
                // 转换为相对于图片内容的坐标
                const mouseXInImage = mouseX - offsetX;
                const mouseYInImage = mouseY - offsetY;
                
                // 计算鼠标到NPC中心的当前距离
                const currentDistance = Math.sqrt(
                    Math.pow(mouseXInImage - resizeStart.npcCenterX, 2) + 
                    Math.pow(mouseYInImage - resizeStart.npcCenterY, 2)
                );
                
                // 计算新的缩放比例（基于距离比例）
                const newScale = (currentDistance / resizeStart.initialDistance) * resizeStart.scale;
                const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
                
                setPlacedNPCs(prev => prev.map(n => 
                    n.id === resizingNPCId 
                        ? { ...n, scale: clampedScale }
                        : n
                ));
                return;
            }
            
            // 处理拖拽NPC
            if (!draggingNPCId || !dragOffset) return;
            
            const image = imageRef.current;
            const preview = previewRef.current;
            if (!image || !preview) return;

            // 获取图片实际显示区域
            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
            if (displayWidth <= 0 || displayHeight <= 0) return;

            // 找到当前正在拖拽的 NPC，计算实际宽高，用于限制中心点不超出边界
            const currentNpc = placedNPCs.find(npc => npc.id === draggingNPCId);
            if (!currentNpc) return;
            const npcWidth = BASE_NPC_WIDTH * currentNpc.scale;
            const npcHeight = BASE_NPC_HEIGHT * currentNpc.scale;
            const halfW = npcWidth / 2;
            const halfH = npcHeight / 2;
            
            const previewRect = preview.getBoundingClientRect();
            // 计算鼠标位置相对于容器的坐标
            const mouseX = e.clientX - previewRect.left;
            const mouseY = e.clientY - previewRect.top;
            
            // 转换为相对于图片内容的坐标
            const mouseXInImage = mouseX - offsetX;
            const mouseYInImage = mouseY - offsetY;
            
            // 考虑拖拽偏移量
            const adjustedX = mouseXInImage - dragOffset.x;
            const adjustedY = mouseYInImage - dragOffset.y;
            
            // 限制在图片实际显示范围内，并保证整张 NPC 立绘不会超出图片边界
            const minCenterX = halfW;
            const maxCenterX = displayWidth - halfW;
            const minCenterY = halfH;
            const maxCenterY = displayHeight - halfH;

            const clampedX = Math.max(minCenterX, Math.min(maxCenterX, adjustedX));
            const clampedY = Math.max(minCenterY, Math.min(maxCenterY, adjustedY));
            
            // 转换为0-1的比例（相对于图片内容）
            const relativeX = clampedX / displayWidth;
            const relativeY = clampedY / displayHeight;
            
            setPlacedNPCs(prev => prev.map(npc => 
                npc.id === draggingNPCId 
                    ? { ...npc, x: relativeX, y: relativeY }
                    : npc
            ));
        };

        const handleMouseUp = () => {
            setDraggingNPCId(null);
            setDragOffset(null);
            setResizingNPCId(null);
            setResizeHandle(null);
            setResizeStart(null);
        };

        if (draggingNPCId || resizingNPCId) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNPCId, dragOffset, resizingNPCId, resizeHandle, resizeStart, getImageDisplayBounds, placedNPCs]);

    // 处理从侧边栏拖拽新NPC
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const preview = previewRef.current;
        const image = imageRef.current;
        if (!preview || !image) return;

        if (placedNPCs.length >= MAX_NPCS) {
            return;
        }

        // 获取图片实际显示区域
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        const previewRect = preview.getBoundingClientRect();
        // 计算鼠标位置相对于容器的坐标
        const mouseX = e.clientX - previewRect.left;
        const mouseY = e.clientY - previewRect.top;
        
        // 转换为相对于图片内容的坐标
        const mouseXInImage = mouseX - offsetX;
        const mouseYInImage = mouseY - offsetY;
        
        // 限制在图片实际显示范围内
        const clampedX = Math.max(0, Math.min(displayWidth, mouseXInImage));
        const clampedY = Math.max(0, Math.min(displayHeight, mouseYInImage));
        
        // 转换为0-1的比例（相对于图片内容，存储给后端）
        const relativeX = clampedX / displayWidth;
        const relativeY = clampedY / displayHeight;
        
        const newNPC: PlacedNPC = {
            id: `npc_${Date.now()}`,
            x: relativeX,
            y: relativeY,
            scale: DEFAULT_SCALE,
            zIndex: DEFAULT_Z_INDEX
        };
        
        setPlacedNPCs(prev => [...prev, newNPC]);
    }, [placedNPCs.length, getImageDisplayBounds]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleNPCMouseDown = useCallback((e: React.MouseEvent, npcId: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const image = imageRef.current;
        const preview = previewRef.current;
        const npc = placedNPCs.find(n => n.id === npcId);
        if (!image || !preview || !npc) return;
        
        // 获取图片实际显示区域
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        const previewRect = preview.getBoundingClientRect();
        // 计算NPC中心点在图片内容中的位置
        const centerXInImage = npc.x * displayWidth;
        const centerYInImage = npc.y * displayHeight;
        // 转换为屏幕坐标
        const npcCenterX = previewRect.left + offsetX + centerXInImage;
        const npcCenterY = previewRect.top + offsetY + centerYInImage;
        // 计算鼠标相对于NPC中心的偏移
        const offsetX_drag = e.clientX - npcCenterX;
        const offsetY_drag = e.clientY - npcCenterY;
        
        setDragOffset({ x: offsetX_drag, y: offsetY_drag });
        setDraggingNPCId(npcId);
        setSelectedNPCId(npcId);
    }, [placedNPCs, getImageDisplayBounds]);

    // 处理调整大小开始
    const handleResizeStart = useCallback((e: React.MouseEvent, npcId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
        e.preventDefault();
        e.stopPropagation();
        
        const npc = placedNPCs.find(n => n.id === npcId);
        if (!npc) return;
        
        const image = imageRef.current;
        const preview = previewRef.current;
        if (!image || !preview) return;
        
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        if (displayWidth <= 0 || displayHeight <= 0) return;
        
        // 计算NPC中心点在图片中的位置
        const npcCenterX = npc.x * displayWidth;
        const npcCenterY = npc.y * displayHeight;
        
        // 计算手柄位置（相对于图片内容）
        let handleX = 0;
        let handleY = 0;
        const halfWidth = (BASE_NPC_WIDTH * npc.scale) / 2;
        const halfHeight = (BASE_NPC_HEIGHT * npc.scale) / 2;
        
        switch (handle) {
            case 'nw':
                handleX = npcCenterX - halfWidth;
                handleY = npcCenterY - halfHeight;
                break;
            case 'ne':
                handleX = npcCenterX + halfWidth;
                handleY = npcCenterY - halfHeight;
                break;
            case 'sw':
                handleX = npcCenterX - halfWidth;
                handleY = npcCenterY + halfHeight;
                break;
            case 'se':
                handleX = npcCenterX + halfWidth;
                handleY = npcCenterY + halfHeight;
                break;
        }
        
        // 计算初始距离（从NPC中心到手柄）
        const initialDistance = Math.sqrt(
            Math.pow(handleX - npcCenterX, 2) + 
            Math.pow(handleY - npcCenterY, 2)
        );
        
        const previewRect = preview.getBoundingClientRect();
        const mouseX = e.clientX - previewRect.left;
        const mouseY = e.clientY - previewRect.top;
        const mouseXInImage = mouseX - offsetX;
        const mouseYInImage = mouseY - offsetY;
        
        setResizingNPCId(npcId);
        setResizeHandle(handle);
        setResizeStart({
            mouseX: mouseXInImage,
            mouseY: mouseYInImage,
            npcCenterX,
            npcCenterY,
            initialDistance,
            scale: npc.scale
        });
    }, [placedNPCs, getImageDisplayBounds]);


    const handleRemoveNPC = useCallback((npcId: string) => {
        setPlacedNPCs(prev => prev.filter(npc => npc.id !== npcId));
        setSelectedNPCId(null);
    }, []);

    // 修改NPC层级
    const handleChangeZIndex = useCallback((npcId: string, delta: number) => {
        setPlacedNPCs(prev => prev.map(npc => {
            if (npc.id === npcId) {
                const currentZIndex = npc.zIndex ?? DEFAULT_Z_INDEX;
                const newZIndex = Math.max(MIN_Z_INDEX, Math.min(MAX_Z_INDEX, currentZIndex + delta));
                return { ...npc, zIndex: newZIndex };
            }
            return npc;
        }));
    }, []);

    // 直接设置NPC层级
    const handleSetZIndex = useCallback((npcId: string, zIndex: number) => {
        const clampedZIndex = Math.max(MIN_Z_INDEX, Math.min(MAX_Z_INDEX, zIndex));
        setPlacedNPCs(prev => prev.map(npc => 
            npc.id === npcId ? { ...npc, zIndex: clampedZIndex } : npc
        ));
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!currentSceneIdRef.current || !currentSubSceneIdRef.current) {
            alert('请先选择子场景');
            return;
        }

        if (!fileId) {
            alert('文件ID不存在，请先上传文件');
            return;
        }

        const npcSlots: NpcSlot[] = placedNPCs.map(npc => ({
            position: [npc.x, npc.y] as [number, number],
            zoom: npc.zIndex ?? DEFAULT_Z_INDEX, // zoom字段存储层级（zIndex）
        }));

        try {
            const response = await worldEditor.setZoomNpc(
                fileId,
                currentSceneIdRef.current,
                currentSubSceneIdRef.current,
                npcSlots
            );
            
            if (response.data.success) {
                toast.success('NPC位置和层级已保存');
                // 保存成功后刷新数据，确保切换场景后能正确显示
                if (onDataChange) {
                    onDataChange();
                }
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedNPCs, fileId, onDataChange]);

    const getNPCPosition = useCallback((npc: PlacedNPC) => {
        const image = imageRef.current;
        const preview = previewRef.current;
        
        // 如果条件不满足，返回不可见标记
        if (!image || !preview || !imageLoaded || !containerReady) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查图片是否真正加载完成
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查容器尺寸是否有效
        const previewRect = preview.getBoundingClientRect();
        if (previewRect.width <= 0 || previewRect.height <= 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 获取图片实际显示区域
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        // 验证显示尺寸是否有效
        if (displayWidth <= 0 || displayHeight <= 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        const width = BASE_NPC_WIDTH * npc.scale;
        const height = BASE_NPC_HEIGHT * npc.scale;
        
        // 使用存储的0-1比例 × 图片实际显示尺寸 = 中心点位置（相对于图片内容）
        const centerXInImage = npc.x * displayWidth;
        const centerYInImage = npc.y * displayHeight;
        
        // 转换为相对于容器的位置
        const centerX = offsetX + centerXInImage;
        const centerY = offsetY + centerYInImage;
        
        const left = centerX - width / 2;
        const top = centerY - height / 2;
        
        return { left, top, width, height, visible: true };
    }, [getImageDisplayBounds, windowSize, imageLoaded, containerReady, forceUpdate]);

    // 子场景拖拽处理
    const handleSubSceneDragStart = useCallback((e: React.DragEvent, subSceneId: string) => {
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
    }, [placedSubScenes]);

    const handleSubSceneDragEnd = useCallback(() => {
        setDraggingSubSceneId(null);
        setSubSceneDragOffset(null);
    }, []);

    const handleSubSceneDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const preview = scenePreviewRef.current;
        const image = sceneImageRef.current;
        if (!preview || !image) return;

        // 获取图片实际显示区域
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        const previewRect = preview.getBoundingClientRect();
        // 计算鼠标位置相对于容器的坐标
        const mouseX = e.clientX - previewRect.left;
        const mouseY = e.clientY - previewRect.top;
        
        // 转换为相对于图片内容的坐标
        const mouseXInImage = mouseX - offsetX;
        const mouseYInImage = mouseY - offsetY;
        
        // 限制在图片实际显示范围内（以图标尺寸为边距，避免子场景图标超出图片边缘）
        const halfSize = SUBSCENE_ICON_SIZE / 2;
        const minCenterX = halfSize;
        const maxCenterX = displayWidth - halfSize;
        const minCenterY = halfSize;
        const maxCenterY = displayHeight - halfSize;

        const boundedX = Math.max(minCenterX, Math.min(maxCenterX, mouseXInImage));
        const boundedY = Math.max(minCenterY, Math.min(maxCenterY, mouseYInImage));
        
        // 转换为0-1的比例（相对于图片内容）
        let relativeX = boundedX / displayWidth;
        let relativeY = boundedY / displayHeight;
        
        if (draggingSubSceneId && subSceneDragOffset) {
            // 考虑拖拽偏移量
            const adjustedX = boundedX - subSceneDragOffset.x;
            const adjustedY = boundedY - subSceneDragOffset.y;
            relativeX = Math.max(0, Math.min(1, adjustedX / displayWidth));
            relativeY = Math.max(0, Math.min(1, adjustedY / displayHeight));
            
            setPlacedSubScenes(prev => prev.map(sub => 
                sub.id === draggingSubSceneId 
                    ? { ...sub, x: relativeX, y: relativeY }
                    : sub
            ));
            setDraggingSubSceneId(null);
            setSubSceneDragOffset(null);
        }
    }, [draggingSubSceneId, subSceneDragOffset, getImageDisplayBounds]);

    const handleSubSceneDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const getSubScenePosition = useCallback((subScene: PlacedSubScene) => {
        const image = sceneImageRef.current;
        const preview = scenePreviewRef.current;
        
        if (!image || !preview || !sceneImageLoaded) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查图片是否真正加载完成
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查容器尺寸是否有效
        const previewRect = preview.getBoundingClientRect();
        if (previewRect.width <= 0 || previewRect.height <= 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 获取图片实际显示区域（考虑 object-fit: contain）
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        // 验证显示尺寸是否有效
        if (displayWidth <= 0 || displayHeight <= 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        const size = SUBSCENE_ICON_SIZE;
        
        // 使用存储的0-1比例 × 图片实际显示尺寸 = 中心点位置（相对于图片内容）
        const centerXInImage = subScene.x * displayWidth;
        const centerYInImage = subScene.y * displayHeight;
        
        // 转换为相对于容器的位置
        const centerX = offsetX + centerXInImage;
        const centerY = offsetY + centerYInImage;
        
        const left = centerX - size / 2;
        const top = centerY - size / 2;
        
        return { left, top, width: size, height: size, visible: true };
    }, [getImageDisplayBounds, windowSize, sceneImageLoaded, forceUpdate]);

    // 地图tab场景位置计算
    const getScenePosition = useCallback((scene: { id: string; name: string; x: number; y: number }) => {
        const image = mapImageRef.current;
        const preview = mapPreviewRef.current;
        
        if (!image || !preview || !mapImageLoaded || !mapContainerReady) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查图片是否真正加载完成
        if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        // 检查容器尺寸是否有效
        const previewRect = preview.getBoundingClientRect();
        if (previewRect.width <= 0 || previewRect.height <= 0) {
            return { left: -9999, top: -9999, width: 0, height: 0, visible: false };
        }
        
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        // 验证显示尺寸是否有效
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
    }, [getImageDisplayBounds, windowSize, mapImageLoaded, mapContainerReady, forceUpdate]);

    // 场景拖拽处理（地图tab）
    const handleSceneMouseDown = useCallback((e: React.MouseEvent, sceneId: string) => {
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
    }, [placedScenes, getImageDisplayBounds]);

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
            
            setPlacedScenes(prev => prev.map(s => 
                s.id === draggingSceneId 
                    ? { ...s, x: relativeX, y: relativeY }
                    : s
            ));
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
    }, [draggingSceneId, sceneDragOffset, getImageDisplayBounds]);

    // 保存场景位置（地图tab）
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
            // 构建所有场景的位置对象
            const positions: { [key: string]: [number, number] } = {};
            placedScenes.forEach(scene => {
                positions[scene.id] = [scene.x, scene.y];
            });

            // 一次性保存所有场景位置
            const response = await worldEditor.setScenePosition(
                fileId,
                positions
            );
            
            if (response.data.success) {
                toast.success(`成功保存 ${placedScenes.length} 个场景的位置`);
            } else {
                toast.error('保存失败，请检查网络连接');
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedScenes, fileId, onDataChange]);

    // 场景tab交互
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

    const handleSaveSubSceneParent = useCallback(async (subSceneId: string, newParentSceneId: string) => {
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
                // 通知父组件刷新数据
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
    }, [fileId, sceneSetting?.scenes, currentScene, onDataChange]);

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
            // 按场景分组，构建位置对象
            const positions: { [key: string]: [number, number] } = {};
            placedSubScenes.forEach(subScene => {
                positions[subScene.id] = [subScene.x, subScene.y];
            });

            // 使用 setScenePosition 批量保存当前场景下所有子场景的位置
            const response = await worldEditor.setSubScenePosition(
                fileId,
                currentScene.id,
                positions
            );
            
            if (response.data.success) {
                toast.success(`成功保存 ${placedSubScenes.length} 个子场景的位置`);
            } else {
                toast.error('保存失败，请检查网络连接');
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedSubScenes, fileId, currentScene, onDataChange]);

    return (
        <div className={styles.mapSection}>
            <div className={styles.mapHeader}>
                <div>
                    <p className={styles.eyebrow}>Step 5</p>
                    <h2>地图编辑</h2>
                    <p className={styles.subtitle}>构建三级地图结构：子场景 -{'>'} 场景 -{'>'} 地图</p>
                </div>
            </div>
            <div className={styles.mapTabs}>
                {[
                    { id: 'subScene', label: '子场景' },
                    { id: 'scene', label: '场景' },
                    { id: 'map', label: '地图' },
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.mapTab} ${mapTab === tab.id ? styles.mapTabActive : ''}`}
                        onClick={() => setMapTab(tab.id as 'subScene' | 'scene' | 'map')}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className={styles.mapEditor}>
                {mapTab === 'subScene' && (
                    <React.Fragment>
                        <div 
                            ref={previewRef}
                            className={styles.mapPreview}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            <img 
                                ref={imageRef}
                                src={sceneImageUrl} 
                                alt="子场景预览" 
                                className={styles.sceneImage}
                                draggable={false}
                                onLoad={() => {
                                    // 使用双重 requestAnimationFrame 确保容器尺寸已稳定
                                    requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                            const container = previewRef.current;
                                            if (container) {
                                                const rect = container.getBoundingClientRect();
                                                if (rect.width > 0 && rect.height > 0) {
                                                    setImageLoaded(true);
                                                    setForceUpdate(prev => prev + 1);
                                                } else {
                                                    // 延迟再试一次
                                                    setTimeout(() => {
                                                        const rect2 = container.getBoundingClientRect();
                                                        if (rect2.width > 0 && rect2.height > 0) {
                                                            setImageLoaded(true);
                                                            setForceUpdate(prev => prev + 1);
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        });
                                    });
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // 子场景使用 DEFAULT_MAP_IMAGE
                                    if (target.src !== DEFAULT_MAP_IMAGE) {
                                        target.src = DEFAULT_MAP_IMAGE;
                                    } else {
                                        setImageLoaded(true);
                                    }
                                }}
                            />
                            
                            {/* 加载遮罩 */}
                            {!isSubSceneContentReady && (
                                <div className={styles.loadingOverlay}>
                                    <div className={styles.loadingSpinner}></div>
                                    <div className={styles.loadingText}>正在加载场景...</div>
                                </div>
                            )}
                            
                            {/* 只在内容准备好时才渲染NPC（按层级排序） */}
                            {isSubSceneContentReady && [...placedNPCs]
                                .sort((a, b) => (a.zIndex ?? DEFAULT_Z_INDEX) - (b.zIndex ?? DEFAULT_Z_INDEX))
                                .map(npc => {
                                const pos = getNPCPosition(npc);
                                const isSelected = selectedNPCId === npc.id;
                                const isDragging = draggingNPCId === npc.id;
                                
                                // 如果位置不可见，不渲染
                                if (!pos.visible) return null;
                                
                                return (
                                    <div
                                        key={npc.id}
                                        className={`${styles.placedNPC} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
                                        style={{
                                            left: `${pos.left}px`,
                                            top: `${pos.top}px`,
                                            width: `${pos.width}px`,
                                            height: `${pos.height}px`,
                                            opacity: pos.visible ? 1 : 0,
                                            transition: 'opacity 0.3s ease',
                                            zIndex: npc.zIndex ?? DEFAULT_Z_INDEX, // 使用层级控制显示顺序
                                        }}
                                        onMouseDown={(e) => handleNPCMouseDown(e, npc.id)}
                                        onClick={() => setSelectedNPCId(npc.id)}
                                    >
                                        <img 
                                            src={DEFAULT_NPC_IMAGE} 
                                            alt="NPC 立绘"
                                            draggable={false}
                                            className={styles.npcImage}
                                        />
                                        {isSelected && (
                                            <>
                                                {/* 四个角的调整手柄 */}
                                                <div 
                                                    className={`${styles.resizeHandle} ${styles.resizeHandleNW}`}
                                                    onMouseDown={(e) => handleResizeStart(e, npc.id, 'nw')}
                                                />
                                                <div 
                                                    className={`${styles.resizeHandle} ${styles.resizeHandleNE}`}
                                                    onMouseDown={(e) => handleResizeStart(e, npc.id, 'ne')}
                                                />
                                                <div 
                                                    className={`${styles.resizeHandle} ${styles.resizeHandleSW}`}
                                                    onMouseDown={(e) => handleResizeStart(e, npc.id, 'sw')}
                                                />
                                                <div 
                                                    className={`${styles.resizeHandle} ${styles.resizeHandleSE}`}
                                                    onMouseDown={(e) => handleResizeStart(e, npc.id, 'se')}
                                                />
                                                {/* 控制按钮 */}
                                                <div className={styles.npcControls}>
                                                    {/* 层级控制 */}
                                                    <div className={styles.zIndexControl}>
                                                        <span className={styles.zIndexLabel}>层级:</span>
                                                        <button
                                                            className={styles.zIndexBtnSmall}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleChangeZIndex(npc.id, -1);
                                                            }}
                                                            disabled={(npc.zIndex ?? DEFAULT_Z_INDEX) <= MIN_Z_INDEX}
                                                            title="降低层级"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            className={styles.zIndexInputSmall}
                                                            value={npc.zIndex ?? DEFAULT_Z_INDEX}
                                                            min={MIN_Z_INDEX}
                                                            max={MAX_Z_INDEX}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => {
                                                                const value = parseInt(e.target.value, 10);
                                                                if (!isNaN(value)) {
                                                                    handleSetZIndex(npc.id, value);
                                                                }
                                                            }}
                                                        />
                                                        <button
                                                            className={styles.zIndexBtnSmall}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleChangeZIndex(npc.id, 1);
                                                            }}
                                                            disabled={(npc.zIndex ?? DEFAULT_Z_INDEX) >= MAX_Z_INDEX}
                                                            title="提高层级"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    {/* 移除按钮 */}
                                                    <button 
                                                        className={styles.removeBtn}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveNPC(npc.id);
                                                        }}
                                                    >
                                                        移除
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                            
                            <div className={styles.mapOverlayHint}>
                                拖拽 NPC 到场景，支持缩放（已放置: {placedNPCs.length}/{MAX_NPCS}）
                                {selectedNPCId && (
                                    <span className={styles.hintSelected}>
                                        {' '}• 拖拽四个角调整大小
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className={styles.mapSidebar}>
                            <div className={styles.subSceneList}>
                                <h4>子场景列表</h4>
                                <div className={styles.subSceneItems}>
                                    {subScenes.length === 0 && (
                                        <div className={styles.subSceneDesc}>暂无子场景，请先上传并解析数据</div>
                                    )}
                                    {subScenes.map((sub) => (
                                        <div
                                            key={sub.id}
                                            className={`${styles.subSceneItem} ${selectedSubSceneId === sub.id ? styles.subSceneItemActive : ''}`}
                                            onClick={() => setSelectedSubSceneId(sub.id)}
                                        >
                                            <div className={styles.subSceneThumbWrapper}>
                                                {/* 只使用子场景自己的图片，不使用父场景的图片 */}
                                                {sub.image && sub.image.trim() !== '' ? (
                                                    <img
                                                        src={sub.image}
                                                        alt={sub.name}
                                                        className={styles.subSceneThumbImage}
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
                                                    className={styles.subSceneThumb}
                                                    style={{
                                                        display: (sub.image && sub.image.trim() !== '') ? 'none' : 'block',
                                                        backgroundImage: (!sub.image || sub.image.trim() === '') ? `url('${DEFAULT_MAP_IMAGE}')` : undefined,
                                                        backgroundSize: 'cover',
                                                        backgroundPosition: 'center',
                                                    }}
                                                />
                                            </div>
                                            <div className={styles.subSceneMeta}>
                                                <div className={styles.subSceneName}>{sub.name}</div>
                                                {sub.parentName && <div className={styles.subSceneParent}>父场景：{sub.parentName}</div>}
                                                {sub.description && (
                                                    <div className={styles.subSceneDesc} title={sub.description}>
                                                        {sub.description}
                                                    </div>
                                                )}
                                                {sub.npcs_slots && sub.npcs_slots.length > 0 && (
                                                    <div className={styles.npcCount}>
                                                        已有NPC: {sub.npcs_slots.length}个
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className={styles.npcPalette}>
                                <h4>NPC 立绘（拖拽）</h4>
                                <div className={styles.npcItems}>
                                    <div 
                                        className={`${styles.npcItem} ${placedNPCs.length >= MAX_NPCS ? styles.npcItemDisabled : ''}`}
                                        draggable={placedNPCs.length < MAX_NPCS}
                                        onDragStart={handleDragStart}
                                    >
                                        <img 
                                            src={DEFAULT_NPC_IMAGE} 
                                            alt="NPC 立绘"
                                            className={styles.defaultNpcImage}
                                            draggable={false}
                                        />
                                        <div className={styles.npcName}>NPC 立绘</div>
                                    </div>
                                </div>
                                <div className={styles.npcHint}>
                                    可拖拽一张立绘至场景，单场景最多放置 {MAX_NPCS} 个
                                    <br />
                                    基础尺寸: {BASE_NPC_WIDTH}×{BASE_NPC_HEIGHT}px
                                </div>
                            </div>
                            
                            <div className={styles.confirmSection}>
                                <button 
                                    className={styles.confirmBtn}
                                    onClick={handleConfirm}
                                    disabled={placedNPCs.length === 0 || !fileId}
                                >
                                    确认保存 NPC 位置
                                </button>
                                <div className={styles.confirmHint}>
                                    {placedNPCs.length === 0 
                                        ? '请先放置NPC到场景中'
                                        : `将保存 ${placedNPCs.length} 个NPC的位置和层级信息`
                                    }
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                )}

                {mapTab === 'scene' && (
                    <React.Fragment>
                        <div 
                            ref={scenePreviewRef}
                            className={styles.mapPreview}
                            onDrop={handleSubSceneDrop}
                            onDragOver={handleSubSceneDragOver}
                        >
                            <img 
                                ref={sceneImageRef}
                                src={sceneImageUrl} 
                                alt={currentScene?.name || "场景地图"} 
                                className={styles.sceneImage}
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
                                <div className={styles.loadingOverlay}>
                                    <div className={styles.loadingSpinner}></div>
                                    <div className={styles.loadingText}>正在加载场景...</div>
                                </div>
                            )}
                            
                            {/* 只在内容准备好时才渲染子场景 */}
                            {isSceneContentReady && placedSubScenes.map(subScene => {
                                const pos = getSubScenePosition(subScene);
                                const isSelected = selectedSubSceneIdInScene === subScene.id;
                                const isDragging = draggingSubSceneId === subScene.id;
                                
                                // 如果位置不可见，不渲染
                                if (!pos.visible) return null;
                                
                                return (
                                    <div
                                        key={subScene.id}
                                        className={`${styles.placedSubScene} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
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
                                                // 优先使用子场景自己的图片，小图标跟实际预览一致
                                                sceneSetting?.scenes
                                                    ?.find(s => s.id === subScene.parentSceneId)
                                                    ?.subscenes
                                                    ?.find(ss => ss.id === subScene.id)
                                                    ?.image
                                                || DEFAULT_SUBSCENE_ICON
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
                            
                            <div className={styles.mapOverlayHint}>
                                {currentScene && (
                                    <>
                                        场景：{currentScene.name} | 拖拽子场景到地图上的位置（已放置: {placedSubScenes.length} 个）
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className={styles.mapSidebar}>
                            <div className={styles.subSceneList}>
                                <h4>场景列表</h4>
                                <div className={styles.subSceneItems}>
                                    {!sceneSetting?.scenes || sceneSetting.scenes.length === 0 ? (
                                        <div className={styles.subSceneDesc}>暂无场景，请先上传并解析数据</div>
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
                                                        {expandedScenes.has(scene.id) ? <IoMdArrowDropdown size={20}/> : <IoMdArrowDropright size={20}/>}
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
                                                                parentSceneId: scene.id
                                                            };
                                                            return (
                                                                <div
                                                                    key={subScene.id}
                                                                    className={`${styles.subSceneItem} ${selectedSubSceneIdInScene === subScene.id ? styles.subSceneItemActive : ''}`}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleSubSceneClick(placedSubScene);
                                                                    }}
                                                                >
                                                                    <div className={styles.subSceneThumbWrapper}>
                                                                        {subScene.image ? (
                                                                            <img
                                                                                src={subScene.image}
                                                                                alt={subScene.name}
                                                                                className={styles.subSceneThumbImage}
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
                                                                            className={styles.subSceneThumb}
                                                                            style={{ display: subScene.image ? 'none' : 'block' }}
                                                                        />
                                                                    </div>
                                                                    <div className={styles.subSceneMeta}>
                                                                        <div className={styles.subSceneName}>{subScene.name}</div>
                                                                        {subScene.description && (
                                                                            <div className={styles.subSceneDesc} title={subScene.description}>
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
                                                setEditingSubScene(prev => prev ? { ...prev, parentSceneId: newParentId } : null);
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
                                    className={styles.confirmBtn}
                                    onClick={handleSaveSubScenePositions}
                                    disabled={placedSubScenes.length === 0 || !fileId}
                                >
                                    确认保存子场景位置
                                </button>
                        </div>
                    </React.Fragment>
                )}

                {mapTab === 'map' && (
                    <React.Fragment>
                        <div 
                            ref={mapPreviewRef}
                            className={styles.mapPreview}
                        >
                            <img 
                                ref={mapImageRef}
                                src={`${currentMapSrc}`} 
                                alt="世界地图" 
                                className={styles.sceneImage}
                                draggable={false}
                                key={currentMapSrc} // 添加key以强制重新加载
                                onLoad={() => {
                                    setMapImageLoaded(true);
                                    setForceUpdate(prev => prev + 1);
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    // 如果当前是 dummy 路径失败，尝试回退 base 原图
                                    if (mapImageSources.dummy && target.src === mapImageSources.dummy && mapImageSources.base) {
                                        target.src = mapImageSources.base;
                                        return;
                                    }
                                    // 再次失败则回退默认
                                    if (target.src !== DEFAULT_MAP_IMAGE) {
                                        target.src = DEFAULT_MAP_IMAGE;
                                        setWorldMapImageUrl(null); // 清除无效的URL
                                    } else {
                                        setMapImageLoaded(true);
                                    }
                                }}
                            />
                            
                            {/* 加载遮罩 */}
                            {!isMapContentReady && (
                                <div className={styles.loadingOverlay}>
                                    <div className={styles.loadingSpinner}></div>
                                    <div className={styles.loadingText}>正在加载地图...</div>
                                </div>
                            )}
                            
                            {/* 只在内容准备好时才渲染场景 */}
                            {isMapContentReady && placedScenes.map(scene => {
                                const pos = getScenePosition(scene);
                                const isSelected = selectedSceneIdInMap === scene.id;
                                const isDragging = draggingSceneId === scene.id;
                                
                                // 如果位置不可见，不渲染
                                if (!pos.visible) return null;
                                
                                return (
                                    <div
                                        key={scene.id}
                                        className={`${styles.placedSubScene} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
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
                                            src={
                                                // 优先使用场景自己的图片，只有缺失时才使用默认场景图标
                                                scene.image || DEFAULT_SCENE_IMAGE
                                            } 
                                            alt="场景"
                                            draggable={false}
                                            className={styles.subSceneIcon}
                                            style={{
                                                width: `${pos.width}px`,
                                                height: `${pos.width}px`,
                                            }}
                                        />
                                        <div className={styles.subSceneLabel}>{scene.name}</div>
                                    </div>
                                );
                            })}
                            
                            <div className={styles.mapOverlayHint}>
                                拖拽场景到地图上的位置（已放置: {placedScenes.length} 个）
                            </div>
                        </div>
                        
                        <div className={styles.mapSidebar}>
                            <div className={styles.subSceneList}>
                                <h4>场景列表</h4>
                                <div className={styles.subSceneItems}>
                                    {!sceneSetting?.scenes || sceneSetting.scenes.length === 0 ? (
                                        <div className={styles.subSceneDesc}>暂无场景，请先上传并解析数据</div>
                                    ) : (
                                        sceneSetting.scenes.map((scene) => (
                                            <div
                                                key={scene.id}
                                                className={`${styles.subSceneItem} ${selectedSceneIdInMap === scene.id ? styles.subSceneItemActive : ''}`}
                                                onClick={() => setSelectedSceneIdInMap(scene.id)}
                                            >
                                                <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
                                                    {scene.image && (
                                                        <img 
                                                            src={scene.image} 
                                                            alt={scene.name}
                                                            className={styles.subSceneThumbImage}
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.onerror = null; // 防止无限循环
                                                                target.style.display = 'none';
                                                                const placeholder = target.nextElementSibling as HTMLElement;
                                                                if (placeholder) {
                                                                    placeholder.style.display = 'block';
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    <div 
                                                        className={styles.subSceneThumb} 
                                                        style={{
                                                            display: scene.image ? 'none' : 'block',
                                                            // 场景使用场景默认图
                                                            backgroundImage: !scene.image ? `url('${DEFAULT_SCENE_IMAGE}')` : undefined,
                                                            backgroundSize: 'cover',
                                                            backgroundPosition: 'center',
                                                        }}
                                                    />
                                                </div>
                                                <div className={styles.subSceneMeta}>
                                                    <div className={styles.subSceneName}>{scene.name}</div>
                                                    {scene.description && (
                                                        <div className={styles.subSceneDesc} title={scene.description}>
                                                            {scene.description}
                                                        </div>
                                                    )}
                                                    {scene.subscenes && (
                                                        <div className={styles.npcCount}>
                                                            {scene.subscenes.length} 个子场景
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            <div className={styles.confirmSection}>
                                <button 
                                    className={styles.confirmBtn}
                                    onClick={handleSaveScenePositions}
                                    disabled={placedScenes.length === 0 || !fileId}
                                >
                                    确认保存场景位置
                                </button>
                                <div className={styles.confirmHint}>
                                    {placedScenes.length === 0 
                                        ? '暂无场景位置需要保存'
                                        : `将保存 ${placedScenes.length} 个场景的位置信息`
                                    }
                                </div>
                            </div>
                        </div>
                    </React.Fragment>
                )}
            </div>
        </div>
    );
};

export default MapPanel;
