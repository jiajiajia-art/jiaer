import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { SubScene, PlacedNPC, Scene } from '../types';
import type { AbilityNodeSetting, AbilityNode } from '../../../../api/worldInteraction/worldInteractionApi.type';
import {
    DEFAULT_SCALE,
    DEFAULT_Z_INDEX,
    MIN_SCALE,
    MAX_SCALE,
    MAX_NPCS,
    MIN_Z_INDEX,
    MAX_Z_INDEX,
    BASE_NPC_WIDTH,
    BASE_NPC_HEIGHT,
} from '../constants';
import { getImageDisplayBounds } from '../utils';
import type { NPCPosition } from '../types';

interface UseSubSceneTabProps {
    subScenes: SubScene[];
    sceneSetting?: { scenes?: Scene[] };
    isActive?: boolean;
    abilityNodeSetting?: AbilityNodeSetting;
}

export const useSubSceneTab = ({ subScenes, sceneSetting, isActive, abilityNodeSetting }: UseSubSceneTabProps) => {
    const [selectedSubSceneId, setSelectedSubSceneId] = useState<string | null>(null);
    const [placedNormalNPCs, setPlacedNormalNPCs] = useState<PlacedNPC[]>([]);
    const [placedFunctionalNPCs, setPlacedFunctionalNPCs] = useState<PlacedNPC[]>([]);
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
        scale: number;
    } | null>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [containerReady, setContainerReady] = useState(false);
    const [isSubSceneContentReady, setIsSubSceneContentReady] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0);
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const previewRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const currentSceneIdRef = useRef<string | null>(null);
    const currentSubSceneIdRef = useRef<string | null>(null);

    const currentSubScene = useMemo(
        () => subScenes.find(s => s.id === selectedSubSceneId) || null,
        [subScenes, selectedSubSceneId]
    );

    // 初始化子场景tab
    useEffect(() => {
        if (subScenes.length === 0) {
            setSelectedSubSceneId(null);
            setPlacedNormalNPCs([]);
            setPlacedFunctionalNPCs([]);
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

        // 从后端加载的NPC都是普通NPC（通过npcs_slots）
        if (targetSubScene.npcs_slots && targetSubScene.npcs_slots.length > 0) {
            const loadedNPCs: PlacedNPC[] = targetSubScene.npcs_slots.map((slot, index) => ({
                id: `slot_${targetSubScene.id}_${index}`,
                x: slot.position?.[0] ?? 0.5,
                y: slot.position?.[1] ?? 0.5,
                scale: slot.zoom ?? DEFAULT_SCALE, // zoom是缩放
                zIndex: slot.layer ?? DEFAULT_Z_INDEX, // layer是层级
                nodeId: '', // 普通NPC没有nodeId
                type: 'illustration', // 默认为立绘型
                authorNote: '', // 默认为空
            }));
            setPlacedNormalNPCs(loadedNPCs);
        } else {
            setPlacedNormalNPCs([]);
        }
        // 功能性NPC的位置信息需要从AbilityNode中加载（如果有的话）
        // 根据子场景的 abilityNodes ID 数组，从 abilityNodeSetting 中找到对应的 AbilityNode
        if (abilityNodeSetting?.abilityNodes && targetSubScene?.abilityNodes?.length) {
            const functionalNPCs: PlacedNPC[] = targetSubScene.abilityNodes
                .map((nodeId: string): PlacedNPC | null => {
                    const abilityNode = abilityNodeSetting.abilityNodes.find(
                        (node: AbilityNode) => node.node_id === nodeId
                    );
                    
                    if (!abilityNode || !abilityNode.position || abilityNode.position.length !== 2) {
                        return null;
                    }
                    
                    return {
                        id: `functional_npc_${abilityNode.node_id}`,
                        x: abilityNode.position[0],
                        y: abilityNode.position[1],
                        scale: abilityNode.scale ?? DEFAULT_SCALE,
                        zIndex: abilityNode.layer ?? DEFAULT_Z_INDEX,
                        nodeId: abilityNode.node_id,
                        imagePath: abilityNode.imagePath,
                        type: abilityNode.type || 'illustration',
                        name: abilityNode.name,
                        authorNote: abilityNode.authorNote || '',
                        backgroundColor: abilityNode.color || (abilityNode.type === 'button' ? '#E03D4B' : undefined),
                    };
                })
                .filter((npc): npc is PlacedNPC => npc !== null);
            
            setPlacedFunctionalNPCs(functionalNPCs);
        } else {
            setPlacedFunctionalNPCs([]);
        }
    }, [subScenes, selectedSubSceneId, currentSubScene, sceneSetting, abilityNodeSetting]);

    // 内容就绪检测
    useEffect(() => {
        if (imageLoaded && containerReady) {
            const timer = setTimeout(() => {
                setIsSubSceneContentReady(true);
                setForceUpdate(prev => prev + 1);
            }, 50);
            return () => clearTimeout(timer);
        } else {
            setIsSubSceneContentReady(false);
            const fallbackTimer = setTimeout(() => {
                setIsSubSceneContentReady(true);
                setImageLoaded(true);
                setContainerReady(true);
            }, 3000);
            return () => clearTimeout(fallbackTimer);
        }
    }, [imageLoaded, containerReady]);

    // 监听窗口大小变化
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // 监听容器尺寸变化
    useEffect(() => {
        if (!isActive) {
            setContainerReady(false);
            return;
        }

        const container = previewRef.current;
        if (!container) {
            setContainerReady(false);
            return;
        }

        const checkContainer = () => {
            const rect = container.getBoundingClientRect();
            const isVisible =
                rect.width > 0 &&
                rect.height > 0 &&
                window.getComputedStyle(container).display !== 'none' &&
                window.getComputedStyle(container).visibility !== 'hidden';

            setContainerReady(isVisible);
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

        const image = imageRef.current;
        if (image && image.complete) {
            setImageLoaded(true);
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [isActive]);

    // NPC拖拽处理（普通NPC）
    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (placedNormalNPCs.length >= MAX_NPCS) {
            e.preventDefault();
            return;
        }
        setDraggingNPCId('new');
    }, [placedNormalNPCs.length]);

    // 实时鼠标移动处理
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

                const mouseXInImage = mouseX - offsetX;
                const mouseYInImage = mouseY - offsetY;

                const currentDistance = Math.sqrt(
                    Math.pow(mouseXInImage - resizeStart.npcCenterX, 2) +
                    Math.pow(mouseYInImage - resizeStart.npcCenterY, 2)
                );

                const newScale = (currentDistance / resizeStart.initialDistance) * resizeStart.scale;
                const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

                // 判断是功能性NPC还是普通NPC
                const isFunctional = placedFunctionalNPCs.some(npc => npc.id === resizingNPCId);
                if (isFunctional) {
                    setPlacedFunctionalNPCs(prev =>
                        prev.map(n => (n.id === resizingNPCId ? { ...n, scale: clampedScale } : n))
                    );
                } else {
                    setPlacedNormalNPCs(prev =>
                        prev.map(n => (n.id === resizingNPCId ? { ...n, scale: clampedScale } : n))
                    );
                }
                return;
            }

            // 处理拖拽NPC
            if (!draggingNPCId || !dragOffset) return;

            const image = imageRef.current;
            const preview = previewRef.current;
            if (!image || !preview) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;
            if (displayWidth <= 0 || displayHeight <= 0) return;

            const currentNpc = [...placedNormalNPCs, ...placedFunctionalNPCs].find(npc => npc.id === draggingNPCId);
            if (!currentNpc) return;
            const npcWidth = BASE_NPC_WIDTH * currentNpc.scale;
            const npcHeight = BASE_NPC_HEIGHT * currentNpc.scale;
            const halfW = npcWidth / 2;
            const halfH = npcHeight / 2;

            const previewRect = preview.getBoundingClientRect();
            const mouseX = e.clientX - previewRect.left;
            const mouseY = e.clientY - previewRect.top;

            const mouseXInImage = mouseX - offsetX;
            const mouseYInImage = mouseY - offsetY;

            const adjustedX = mouseXInImage - dragOffset.x;
            const adjustedY = mouseYInImage - dragOffset.y;

            const minCenterX = halfW;
            const maxCenterX = displayWidth - halfW;
            const minCenterY = halfH;
            const maxCenterY = displayHeight - halfH;

            const clampedX = Math.max(minCenterX, Math.min(maxCenterX, adjustedX));
            const clampedY = Math.max(minCenterY, Math.min(maxCenterY, adjustedY));

            const relativeX = clampedX / displayWidth;
            const relativeY = clampedY / displayHeight;

            // 判断是功能性NPC还是普通NPC
            const isFunctional = placedFunctionalNPCs.some(npc => npc.id === draggingNPCId);
            if (isFunctional) {
                setPlacedFunctionalNPCs(prev =>
                    prev.map(npc => (npc.id === draggingNPCId ? { ...npc, x: relativeX, y: relativeY } : npc))
                );
            } else {
                setPlacedNormalNPCs(prev =>
                    prev.map(npc => (npc.id === draggingNPCId ? { ...npc, x: relativeX, y: relativeY } : npc))
                );
            }
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
    }, [draggingNPCId, dragOffset, resizingNPCId, resizeHandle, resizeStart, placedNormalNPCs, placedFunctionalNPCs]);

    // 处理从侧边栏拖拽新NPC
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const preview = previewRef.current;
            const image = imageRef.current;
            if (!preview || !image) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            const previewRect = preview.getBoundingClientRect();
            const mouseX = e.clientX - previewRect.left;
            const mouseY = e.clientY - previewRect.top;

            const mouseXInImage = mouseX - offsetX;
            const mouseYInImage = mouseY - offsetY;

            const clampedX = Math.max(0, Math.min(displayWidth, mouseXInImage));
            const clampedY = Math.max(0, Math.min(displayHeight, mouseYInImage));

            const relativeX = clampedX / displayWidth;
            const relativeY = clampedY / displayHeight;

            // 尝试获取功能性NPC数据
            let functionalNPCData: any = null;
            try {
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    functionalNPCData = JSON.parse(data);
                }
            } catch (error) {
                console.warn('解析拖拽数据失败:', error);
            }

            if (functionalNPCData) {
                // 功能性NPC：无数量限制
                const newNPC: PlacedNPC = {
                id: `functional_npc_${Date.now()}`,
                x: relativeX,
                y: relativeY,
                scale: DEFAULT_SCALE,
                zIndex: DEFAULT_Z_INDEX,
                nodeId: functionalNPCData.nodeId || '',
                imagePath: functionalNPCData.imagePath,
                type: functionalNPCData.type || 'illustration',
                name: functionalNPCData.name,
                authorNote: functionalNPCData.authorNote || '',
                backgroundColor: functionalNPCData.type === 'button' ? '#E03D4B' : undefined, // 按钮型NPC默认背景色
            };
                setPlacedFunctionalNPCs(prev => [...prev, newNPC]);
            } else {
                // 普通NPC：限制3个
                if (placedNormalNPCs.length >= MAX_NPCS) {
                    return;
                }
                const newNPC: PlacedNPC = {
                    id: `normal_npc_${Date.now()}`,
                    x: relativeX,
                    y: relativeY,
                    scale: DEFAULT_SCALE,
                    zIndex: DEFAULT_Z_INDEX,
                    nodeId: '', // 普通NPC没有nodeId
                    type: 'illustration',
                    authorNote: '',
                };
                setPlacedNormalNPCs(prev => [...prev, newNPC]);
            }
            // 重置拖拽状态
            setDraggingNPCId(null);
        },
        [placedNormalNPCs.length, placedFunctionalNPCs.length]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    // 处理拖拽结束，清理状态
    const handleDragEnd = useCallback(() => {
        setDraggingNPCId(null);
    }, []);

    const handleNPCMouseDown = useCallback(
        (e: React.MouseEvent, npcId: string) => {
            e.preventDefault();
            e.stopPropagation();

            const image = imageRef.current;
            const preview = previewRef.current;
            const allNPCs = [...placedNormalNPCs, ...placedFunctionalNPCs];
            const npc = allNPCs.find(n => n.id === npcId);
            if (!image || !preview || !npc) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            const previewRect = preview.getBoundingClientRect();
            const centerXInImage = npc.x * displayWidth;
            const centerYInImage = npc.y * displayHeight;
            const npcCenterX = previewRect.left + offsetX + centerXInImage;
            const npcCenterY = previewRect.top + offsetY + centerYInImage;
            const offsetX_drag = e.clientX - npcCenterX;
            const offsetY_drag = e.clientY - npcCenterY;

            setDragOffset({ x: offsetX_drag, y: offsetY_drag });
            setDraggingNPCId(npcId);
            setSelectedNPCId(npcId);
        },
        [placedNormalNPCs, placedFunctionalNPCs]
    );

    // 处理调整大小开始
    const handleResizeStart = useCallback(
        (e: React.MouseEvent, npcId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
            e.preventDefault();
            e.stopPropagation();

            const allNPCs = [...placedNormalNPCs, ...placedFunctionalNPCs];
            const npc = allNPCs.find(n => n.id === npcId);
            if (!npc) return;

            const image = imageRef.current;
            const preview = previewRef.current;
            if (!image || !preview) return;

            const bounds = getImageDisplayBounds(image, preview);
            const { displayWidth, displayHeight, offsetX, offsetY } = bounds;

            if (displayWidth <= 0 || displayHeight <= 0) return;

            const npcCenterX = npc.x * displayWidth;
            const npcCenterY = npc.y * displayHeight;

            let handleX = 0;
            let handleY = 0;
            
            // 按钮型NPC的尺寸计算方式不同
            let halfWidth: number;
            let halfHeight: number;
            if (npc.type === 'button' && npc.name) {
                const textWidth = npc.name.length * 10 + 24;
                const textHeight = 32;
                halfWidth = (Math.max(textWidth, 60) * npc.scale) / 2;
                halfHeight = (textHeight * npc.scale) / 2;
            } else {
                halfWidth = (BASE_NPC_WIDTH * npc.scale) / 2;
                halfHeight = (BASE_NPC_HEIGHT * npc.scale) / 2;
            }

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

            const initialDistance = Math.sqrt(
                Math.pow(handleX - npcCenterX, 2) + Math.pow(handleY - npcCenterY, 2)
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
                scale: npc.scale,
            });
        },
        [placedNormalNPCs, placedFunctionalNPCs]
    );

    const handleRemoveNPC = useCallback((npcId: string) => {
        // 判断是功能性NPC还是普通NPC
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.filter(npc => npc.id !== npcId));
        } else {
            setPlacedNormalNPCs(prev => prev.filter(npc => npc.id !== npcId));
        }
        setSelectedNPCId(null);
    }, [placedFunctionalNPCs]);

    const handleChangeZIndex = useCallback((npcId: string, delta: number) => {
        // 判断是功能性NPC还是普通NPC
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev =>
                prev.map(npc => {
                    if (npc.id === npcId) {
                        const currentZIndex = npc.zIndex ?? DEFAULT_Z_INDEX;
                        const newZIndex = Math.max(MIN_Z_INDEX, Math.min(MAX_Z_INDEX, currentZIndex + delta));
                        return { ...npc, zIndex: newZIndex };
                    }
                    return npc;
                })
            );
        } else {
            setPlacedNormalNPCs(prev =>
                prev.map(npc => {
                    if (npc.id === npcId) {
                        const currentZIndex = npc.zIndex ?? DEFAULT_Z_INDEX;
                        const newZIndex = Math.max(MIN_Z_INDEX, Math.min(MAX_Z_INDEX, currentZIndex + delta));
                        return { ...npc, zIndex: newZIndex };
                    }
                    return npc;
                })
            );
        }
    }, [placedFunctionalNPCs]);

    const handleSetZIndex = useCallback((npcId: string, zIndex: number) => {
        const clampedZIndex = Math.max(MIN_Z_INDEX, Math.min(MAX_Z_INDEX, zIndex));
        // 判断是功能性NPC还是普通NPC
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, zIndex: clampedZIndex } : npc)));
        } else {
            setPlacedNormalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, zIndex: clampedZIndex } : npc)));
        }
    }, [placedFunctionalNPCs]);

    const handleChangeBackgroundColor = useCallback((npcId: string, backgroundColor: string) => {
        // 判断是功能性NPC还是普通NPC
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, backgroundColor } : npc)));
        } else {
            setPlacedNormalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, backgroundColor } : npc)));
        }
    }, [placedFunctionalNPCs]);

    const getNPCPosition = useCallback(
        (npc: PlacedNPC): NPCPosition => {
            const image = imageRef.current;
            const preview = previewRef.current;

            if (!image || !preview || !imageLoaded || !containerReady) {
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

            // 按钮型NPC根据文字内容计算尺寸
            let width: number;
            let height: number;
            
            if (npc.type === 'button' && npc.name) {
                // 估算文字宽度：每个字符约8-10px，加上padding
                const textWidth = npc.name.length * 10 + 24; // 24px是padding (8px * 2 + 8px额外空间)
                const textHeight = 32; // 14px字体 + 16px padding
                width = Math.max(textWidth, 60) * npc.scale; // 最小宽度60px
                height = textHeight * npc.scale;
            } else {
                width = BASE_NPC_WIDTH * npc.scale;
                height = BASE_NPC_HEIGHT * npc.scale;
            }

            const centerXInImage = npc.x * displayWidth;
            const centerYInImage = npc.y * displayHeight;

            const centerX = offsetX + centerXInImage;
            const centerY = offsetY + centerYInImage;

            const left = centerX - width / 2;
            const top = centerY - height / 2;

            return { left, top, width, height, visible: true };
        },
        [windowSize, imageLoaded, containerReady, forceUpdate]
    );

    // 合并所有NPC用于渲染
    const allPlacedNPCs = useMemo(() => {
        return [...placedNormalNPCs, ...placedFunctionalNPCs];
    }, [placedNormalNPCs, placedFunctionalNPCs]);

    return {
        selectedSubSceneId,
        setSelectedSubSceneId,
        placedNormalNPCs,
        setPlacedNormalNPCs,
        placedFunctionalNPCs,
        setPlacedFunctionalNPCs,
        allPlacedNPCs, // 用于渲染
        draggingNPCId,
        selectedNPCId,
        setSelectedNPCId,
        previewRef,
        imageRef,
        currentSceneIdRef,
        currentSubSceneIdRef,
        currentSubScene,
        imageLoaded,
        setImageLoaded,
        isSubSceneContentReady,
        setForceUpdate,
        handleDragStart,
        handleDrop,
        handleDragOver,
        handleDragEnd,
        handleNPCMouseDown,
        handleResizeStart,
        handleRemoveNPC,
        handleChangeZIndex,
        handleSetZIndex,
        handleChangeBackgroundColor,
        getNPCPosition,
    };
};

