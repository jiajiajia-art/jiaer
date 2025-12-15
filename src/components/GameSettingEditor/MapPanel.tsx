import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import styles from './MapPanel.module.css';
import worldEditor from '../../api/worldInteraction/worldEditor';
import type { NpcSlot } from '../../api/worldInteraction/worldEditor.type';
import toast from 'react-hot-toast';
import { IoMdArrowDropdown, IoMdArrowDropright } from 'react-icons/io';
import gameDataApi from '../../api/game/gameData';

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
    fileId: string;
    onDataChange?: () => void; // 数据变更回调，用于刷新数据
}

interface PlacedNPC {
    id: string;
    x: number;
    y: number;
    scale: number;
}

interface PlacedSubScene {
    id: string;
    name: string;
    x: number;
    y: number;
    parentSceneId: string;
}

const DEFAULT_SCENE_IMAGE = 'http://localhost:3000/api/visual/presets/c1c0450b-b086-440d-a477-f31fb71adbde/images/scenes/shire.png';
const DEFAULT_MAP_IMAGE = DEFAULT_SCENE_IMAGE; // 大地图默认图片
const DEFAULT_NPC_IMAGE = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;
const DEFAULT_SUBSCENE_ICON = `${import.meta.env.BASE_URL}data/assets/创作界面切图/defaultNpc.png`;
const BASE_NPC_WIDTH = 100;
const BASE_NPC_HEIGHT = 150;
const SUBSCENE_ICON_SIZE = 40;
const SCENE_ICON_SIZE = 50; // 场景图标大小
const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.5;
const MAX_SCALE = 2.0;
const SCALE_STEP = 0.1;
const MAX_NPCS = 3;

const MapPanel: React.FC<MapPanelProps> = ({ sceneSetting, fileId, onDataChange }) => {
    // 子场景tab状态
    const [mapTab, setMapTab] = useState<'subScene' | 'scene' | 'map'>('subScene');
    const [selectedSubSceneId, setSelectedSubSceneId] = useState<string | null>(null);
    const [placedNPCs, setPlacedNPCs] = useState<PlacedNPC[]>([]);
    const [draggingNPCId, setDraggingNPCId] = useState<string | null>(null);
    const [selectedNPCId, setSelectedNPCId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
    
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
    const [worldMapImageUrl, setWorldMapImageUrl] = useState<string | null>(null);
    
    // 地图tab状态
    const [placedScenes, setPlacedScenes] = useState<Array<{ id: string; name: string; x: number; y: number }>>([]);
    const [draggingSceneId, setDraggingSceneId] = useState<string | null>(null);
    const [selectedSceneIdInMap, setSelectedSceneIdInMap] = useState<string | null>(null);
    const [sceneDragOffset, setSceneDragOffset] = useState<{ x: number; y: number } | null>(null);
    const [generatingMap, setGeneratingMap] = useState(false);
    
    const previewRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const scenePreviewRef = useRef<HTMLDivElement>(null);
    const sceneImageRef = useRef<HTMLImageElement>(null);
    const mapPreviewRef = useRef<HTMLDivElement>(null);
    const mapImageRef = useRef<HTMLImageElement>(null);
    const mapImageInputRef = useRef<HTMLInputElement>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const currentSubSceneIdRef = useRef<string | null>(null);

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

    const sceneImageUrl = mapTab === 'scene' && currentScene?.image 
        ? currentScene.image 
        : DEFAULT_SCENE_IMAGE;

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

    // 初始化子场景tab
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
                scale: slot.zoom ?? DEFAULT_SCALE
            }));
            setPlacedNPCs(loadedNPCs);
        } else {
            setPlacedNPCs([]);
        }
    }, [subScenes, selectedSubSceneId, currentSubScene]);

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
                // 确保position存在且是有效的数组
                if (subScene.position && Array.isArray(subScene.position) && subScene.position.length >= 2) {
                    const x = subScene.position[0];
                    const y = subScene.position[1];
                    // 确保位置值在有效范围内（0-1）
                    if (typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
                        loadedSubScenes.push({
                            id: subScene.id,
                            name: subScene.name,
                            x: x,
                            y: y,
                            parentSceneId: currentScene.id
                        });
                    }
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

        const loadedScenes: Array<{ id: string; name: string; x: number; y: number }> = [];
        sceneSetting.scenes.forEach(scene => {
            if (scene.position && Array.isArray(scene.position) && scene.position.length >= 2) {
                const x = scene.position[0];
                const y = scene.position[1];
                if (typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
                    loadedScenes.push({
                        id: scene.id,
                        name: scene.name,
                        x: x,
                        y: y
                    });
                }
            }
        });
        setPlacedScenes(loadedScenes);
        setSelectedSceneIdInMap(null);
    }, [mapTab, sceneSetting?.scenes]);

    // 获取世界地图URL（在数据刷新后或组件初始化时）
    useEffect(() => {
        if (mapTab === 'map' && fileId) {
            const fetchWorldMap = async () => {
                try {
                    const response = await gameDataApi.getWorldMap(fileId);
                    // 将blob转换为URL
                    const imageUrl = URL.createObjectURL(response.data);
                    setWorldMapImageUrl(imageUrl);
                    setMapImageLoaded(false); // 重置加载状态
                } catch (error) {
                    // 如果获取失败，使用默认图片
                    setWorldMapImageUrl(null);
                }
            };
            fetchWorldMap();
        }
    }, [mapTab, fileId, sceneSetting]); // 当数据刷新时，sceneSetting会更新，触发重新获取

    // 监听窗口大小变化，确保NPC和子场景跟随图片移动
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 监听容器尺寸变化，确保容器准备好后再计算位置
    useEffect(() => {
        if (mapTab !== 'subScene') {
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

        // 使用 ResizeObserver 监听容器尺寸变化
        const resizeObserver = new ResizeObserver(() => {
            checkContainer();
        });

        resizeObserver.observe(container);

        // 也监听窗口大小变化
        const handleResize = () => {
            checkContainer();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [mapTab]);

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

    // 实时鼠标移动处理（用于拖拽NPC）
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!draggingNPCId || !dragOffset) return;
            
            const image = imageRef.current;
            const preview = previewRef.current;
            if (!image || !preview) return;

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
            
            // 考虑拖拽偏移量
            const adjustedX = mouseXInImage - dragOffset.x;
            const adjustedY = mouseYInImage - dragOffset.y;
            
            // 限制在图片实际显示范围内
            const clampedX = Math.max(0, Math.min(displayWidth, adjustedX));
            const clampedY = Math.max(0, Math.min(displayHeight, adjustedY));
            
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
        };

        if (draggingNPCId) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggingNPCId, dragOffset, getImageDisplayBounds]);

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
            scale: DEFAULT_SCALE
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

    const handleWheel = useCallback((e: React.WheelEvent, npcId: string) => {
        e.preventDefault();
        e.stopPropagation();
        
        const delta = e.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
        setPlacedNPCs(prev => prev.map(npc => {
            if (npc.id === npcId) {
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, npc.scale + delta));
                return { ...npc, scale: newScale };
            }
            return npc;
        }));
    }, []);

    const handleScaleChange = useCallback((npcId: string, delta: number) => {
        setPlacedNPCs(prev => prev.map(npc => {
            if (npc.id === npcId) {
                const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, npc.scale + delta));
                return { ...npc, scale: newScale };
            }
            return npc;
        }));
    }, []);

    const handleRemoveNPC = useCallback((npcId: string) => {
        setPlacedNPCs(prev => prev.filter(npc => npc.id !== npcId));
        setSelectedNPCId(null);
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
            zoom: npc.scale
        }));

        try {
            const response = await worldEditor.setZoomNpc(
                fileId,
                currentSceneIdRef.current,
                currentSubSceneIdRef.current,
                npcSlots
            );
            
            if (response.data.success) {
                toast.success('NPC位置已保存');
            }
        } catch (error: any) {
            console.error('保存失败:', error);
            toast.error('保存失败：' + (error.message || '请检查网络连接'));
        }
    }, [placedNPCs, fileId, onDataChange]);

    const getNPCPosition = useCallback((npc: PlacedNPC) => {
        const image = imageRef.current;
        const preview = previewRef.current;
        if (!image || !preview || !imageLoaded || !containerReady) {
            return { left: 0, top: 0, width: 0, height: 0 };
        }
        
        // 获取图片实际显示区域
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        // 验证显示尺寸是否有效
        if (displayWidth <= 0 || displayHeight <= 0) {
            return { left: 0, top: 0, width: 0, height: 0 };
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
        
        return { left, top, width, height };
    }, [getImageDisplayBounds, windowSize, imageLoaded, containerReady]);

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
        
        // 限制在图片实际显示范围内
        const clampedX = Math.max(0, Math.min(displayWidth, mouseXInImage));
        const clampedY = Math.max(0, Math.min(displayHeight, mouseYInImage));
        
        // 转换为0-1的比例（相对于图片内容）
        let relativeX = clampedX / displayWidth;
        let relativeY = clampedY / displayHeight;
        
        if (draggingSubSceneId && subSceneDragOffset) {
            // 考虑拖拽偏移量
            const adjustedX = clampedX - subSceneDragOffset.x;
            const adjustedY = clampedY - subSceneDragOffset.y;
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
        if (!image || !preview || !sceneImageLoaded) return { left: 0, top: 0, width: 0, height: 0 };
        
        // 获取图片实际显示区域（考虑 object-fit: contain）
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        const size = SUBSCENE_ICON_SIZE;
        
        // 使用存储的0-1比例 × 图片实际显示尺寸 = 中心点位置（相对于图片内容）
        const centerXInImage = subScene.x * displayWidth;
        const centerYInImage = subScene.y * displayHeight;
        
        // 转换为相对于容器的位置
        const centerX = offsetX + centerXInImage;
        const centerY = offsetY + centerYInImage;
        
        const left = centerX - size / 2;
        const top = centerY - size / 2;
        
        return { left, top, width: size, height: size };
    }, [getImageDisplayBounds, windowSize, sceneImageLoaded]);

    // 地图tab场景位置计算
    const getScenePosition = useCallback((scene: { id: string; name: string; x: number; y: number }) => {
        const image = mapImageRef.current;
        const preview = mapPreviewRef.current;
        if (!image || !preview || !mapImageLoaded) return { left: 0, top: 0, width: 0, height: 0 };
        
        const bounds = getImageDisplayBounds(image, preview);
        const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
        
        const size = SCENE_ICON_SIZE;
        
        const centerXInImage = scene.x * displayWidth;
        const centerYInImage = scene.y * displayHeight;
        
        const centerX = offsetX + centerXInImage;
        const centerY = offsetY + centerYInImage;
        
        const left = centerX - size / 2;
        const top = centerY - size / 2;
        
        return { left, top, width: size, height: size };
    }, [getImageDisplayBounds, windowSize, mapImageLoaded]);

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

    // 生成大地图
    const handleGenerateMap = useCallback(async () => {
        if (!fileId) {
            toast.error('文件ID不存在，请先上传文件');
            return;
        }

        setGeneratingMap(true);
        try {
            const response = await worldEditor.generateWorldMapImage(fileId);
            if (response.data.success) {
                toast.success('大地图生成成功');
                if (response.data.imagePath) {
                    setWorldMapImageUrl(response.data.imagePath);
                    setMapImageLoaded(false); // 重置加载状态，触发图片重新加载
                }
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('生成失败');
            }
        } catch (error: any) {
            console.error('生成失败:', error);
            toast.error('生成失败：' + (error.message || '请检查网络连接'));
        } finally {
            setGeneratingMap(false);
        }
    }, [fileId, onDataChange]);

    // 上传大地图
    const handleUploadMap = useCallback(async (file: File) => {
        if (!fileId) {
            toast.error('文件ID不存在，请先上传文件');
            return;
        }

        try {
            const response = await worldEditor.setWorldMapImage(fileId, file);
            if (response.data.success) {
                toast.success('大地图上传成功');
                // 更新地图图片URL
                if (response.data.imagePath) {
                    setWorldMapImageUrl(response.data.imagePath);
                    setMapImageLoaded(false); // 重置加载状态，触发图片重新加载
                }
                // 刷新数据以获取最新的地图信息
                if (onDataChange) {
                    onDataChange();
                }
            } else {
                toast.error('上传失败');
            }
        } catch (error: any) {
            console.error('上传失败:', error);
            toast.error('上传失败：' + (error.message || '请检查网络连接'));
        }
    }, [fileId, onDataChange]);

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
                                                } else {
                                                    // 延迟再试一次
                                                    setTimeout(() => {
                                                        const rect2 = container.getBoundingClientRect();
                                                        if (rect2.width > 0 && rect2.height > 0) {
                                                            setImageLoaded(true);
                                                        }
                                                    }, 100);
                                                }
                                            }
                                        });
                                    });
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== DEFAULT_SCENE_IMAGE) {
                                        target.src = DEFAULT_SCENE_IMAGE;
                                    } else {
                                        setImageLoaded(true);
                                    }
                                }}
                            />
                            
                            {(imageLoaded && containerReady) && placedNPCs.map(npc => {
                                const pos = getNPCPosition(npc);
                                const isSelected = selectedNPCId === npc.id;
                                const isDragging = draggingNPCId === npc.id;
                                
                                return (
                                    <div
                                        key={npc.id}
                                        className={`${styles.placedNPC} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
                                        style={{
                                            left: `${pos.left}px`,
                                            top: `${pos.top}px`,
                                            width: `${pos.width}px`,
                                            height: `${pos.height}px`,
                                        }}
                                        onMouseDown={(e) => handleNPCMouseDown(e, npc.id)}
                                        onWheel={(e) => handleWheel(e, npc.id)}
                                        onClick={() => setSelectedNPCId(npc.id)}
                                    >
                                        <img 
                                            src={DEFAULT_NPC_IMAGE} 
                                            alt="NPC 立绘"
                                            draggable={false}
                                            className={styles.npcImage}
                                        />
                                        {isSelected && (
                                            <div className={styles.npcControls}>
                                                <button 
                                                    className={styles.scaleBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleScaleChange(npc.id, -SCALE_STEP);
                                                    }}
                                                >
                                                    −
                                                </button>
                                                <span className={styles.scaleText}>
                                                    {(npc.scale * 100).toFixed(0)}%
                                                </span>
                                                <button 
                                                    className={styles.scaleBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleScaleChange(npc.id, SCALE_STEP);
                                                    }}
                                                >
                                                    +
                                                </button>
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
                                        )}
                                    </div>
                                );
                            })}
                            
                            <div className={styles.mapOverlayHint}>
                                拖拽 NPC 到场景，支持缩放（已放置: {placedNPCs.length}/{MAX_NPCS}）
                                {selectedNPCId && (
                                    <span className={styles.hintSelected}>
                                        {' '}• 滚轮调整大小
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
                                            <div className={styles.subSceneThumb} />
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
                                        : `将保存 ${placedNPCs.length} 个NPC的位置和缩放信息`
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
                            
                            {sceneImageLoaded && placedSubScenes.map(subScene => {
                                const pos = getSubScenePosition(subScene);
                                const isSelected = selectedSubSceneIdInScene === subScene.id;
                                const isDragging = draggingSubSceneId === subScene.id;
                                
                                return (
                                    <div
                                        key={subScene.id}
                                        className={`${styles.placedSubScene} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
                                        style={{
                                            left: `${pos.left}px`,
                                            top: `${pos.top}px`,
                                            width: `${pos.width}px`,
                                            minHeight: `${pos.height}px`,
                                        }}
                                        draggable
                                        onDragStart={(e) => handleSubSceneDragStart(e, subScene.id)}
                                        onDragEnd={handleSubSceneDragEnd}
                                        onClick={() => handleSubSceneClick(subScene)}
                                    >
                                        <img 
                                            src={DEFAULT_SUBSCENE_ICON} 
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
                                                                    <div className={styles.subSceneThumb} />
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
                            
                            {/* <div className={styles.confirmSection}> */}
                                <button 
                                    className={styles.confirmBtn}
                                    onClick={handleSaveSubScenePositions}
                                    disabled={placedSubScenes.length === 0 || !fileId}
                                >
                                    确认保存子场景位置
                                </button>
                                {/* <div className={styles.confirmHint}>
                                    {placedSubScenes.length === 0 
                                        ? '暂无子场景位置需要保存'
                                        : `将保存 ${placedSubScenes.length} 个子场景的位置信息`
                                    }
                                </div>
                            </div> */}
                        </div>
                    </React.Fragment>
                )}

                {mapTab === 'map' && (
                    <React.Fragment>
                        <div 
                            ref={mapPreviewRef}
                            className={styles.mapPreview}
                        >
                            <div className={styles.mapPreviewActions}>
                                <input
                                    ref={mapImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            handleUploadMap(file);
                                        }
                                        // 重置input，允许重复选择同一文件
                                        if (mapImageInputRef.current) {
                                            mapImageInputRef.current.value = '';
                                        }
                                    }}
                                />
                                <button 
                                    className={styles.mapActionBtn}
                                    onClick={handleGenerateMap}
                                    disabled={!fileId || generatingMap}
                                    title="生成大地图"
                                >
                                    生成
                                </button>
                                <button 
                                    className={styles.mapActionBtn}
                                    onClick={() => mapImageInputRef.current?.click()}
                                    disabled={!fileId}
                                    title="上传大地图"
                                >
                                    上传
                                </button>
                            </div>
                            <img 
                                ref={mapImageRef}
                                src={worldMapImageUrl || DEFAULT_MAP_IMAGE} 
                                alt="世界地图" 
                                className={styles.sceneImage}
                                draggable={false}
                                key={worldMapImageUrl || 'default'} // 添加key以强制重新加载
                                onLoad={() => {
                                    setMapImageLoaded(true);
                                }}
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src !== DEFAULT_MAP_IMAGE) {
                                        target.src = DEFAULT_MAP_IMAGE;
                                        setWorldMapImageUrl(null); // 清除无效的URL
                                    } else {
                                        setMapImageLoaded(true);
                                    }
                                }}
                            />
                            
                            {mapImageLoaded && placedScenes.map(scene => {
                                const pos = getScenePosition(scene);
                                const isSelected = selectedSceneIdInMap === scene.id;
                                const isDragging = draggingSceneId === scene.id;
                                
                                return (
                                    <div
                                        key={scene.id}
                                        className={`${styles.placedSubScene} ${isSelected ? styles.placedNPCSelected : ''} ${isDragging ? styles.placedNPCDragging : ''}`}
                                        style={{
                                            left: `${pos.left}px`,
                                            top: `${pos.top}px`,
                                            width: `${pos.width}px`,
                                            minHeight: `${pos.height}px`,
                                        }}
                                        onMouseDown={(e) => handleSceneMouseDown(e, scene.id)}
                                        onClick={() => setSelectedSceneIdInMap(scene.id)}
                                    >
                                        <img 
                                            src={DEFAULT_SUBSCENE_ICON} 
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
                            
                            {generatingMap && (
                                <div className={styles.mapLoadingOverlay}>
                                    <div className={styles.mapLoadingSpinner}>
                                        <div className={styles.spinnerRing}></div>
                                        <div className={styles.spinnerRing}></div>
                                        <div className={styles.spinnerRing}></div>
                                    </div>
                                    <div className={styles.mapLoadingText}>正在生成大地图...</div>
                                </div>
                            )}
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
                                                        style={{ display: scene.image ? 'none' : 'block' }}
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
