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

    const previewRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLDivElement>(null); // 现在指向的是 .imageCanvas
    const currentSceneIdRef = useRef<string | null>(null);
    const currentSubSceneIdRef = useRef<string | null>(null);
    const initialNormalNPCsRef = useRef<PlacedNPC[]>([]);
    const initialFunctionalNPCsRef = useRef<PlacedNPC[]>([]);

    const currentSubScene = useMemo(
        () => subScenes.find(s => s.id === selectedSubSceneId) || null,
        [subScenes, selectedSubSceneId]
    );

    // 获取 NPC 逻辑尺寸的辅助函数
    const getNPCLogicSize = (npc: PlacedNPC) => {
        let width = BASE_NPC_WIDTH;
        let height = BASE_NPC_HEIGHT;
        if (npc.type === 'button' && npc.name) {
            width = Math.max(npc.name.length * 10 + 24, 60);
            height = 32;
        }
        return { 
            halfW: (width * (npc.scale || 1)) / 2,
            halfH: (height * (npc.scale || 1)) / 2
        };
    };

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

        if (targetSubScene.npcs_slots && targetSubScene.npcs_slots.length > 0) {
            const loadedNPCs: PlacedNPC[] = targetSubScene.npcs_slots.map((slot, index) => ({
                id: `slot_${targetSubScene.id}_${index}`,
                x: slot.position?.[0] ?? 0.5,
                y: slot.position?.[1] ?? 0.5,
                scale: slot.zoom ?? DEFAULT_SCALE,
                zIndex: slot.layer ?? DEFAULT_Z_INDEX,
                nodeId: '',
                type: 'illustration',
                authorNote: '',
            }));
            setPlacedNormalNPCs(loadedNPCs);
            initialNormalNPCsRef.current = JSON.parse(JSON.stringify(loadedNPCs));
        } else {
            setPlacedNormalNPCs([]);
            initialNormalNPCsRef.current = [];
        }
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
                        backgroundColor: abilityNode.color || (abilityNode.type === 'button' ? 'color-mix(in srgb, var(--color-shadow) 50.2%, transparent)' : undefined),
                    };
                })
                .filter((npc): npc is PlacedNPC => npc !== null);
            
            setPlacedFunctionalNPCs(functionalNPCs);
            initialFunctionalNPCsRef.current = JSON.parse(JSON.stringify(functionalNPCs));
        } else {
            setPlacedFunctionalNPCs([]);
            initialFunctionalNPCsRef.current = [];
        }
    }, [subScenes, selectedSubSceneId, currentSubScene, sceneSetting, abilityNodeSetting]);

    useEffect(() => {
        if (imageLoaded && containerReady) {
            const timer = setTimeout(() => {
                setIsSubSceneContentReady(true);
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

        const canvas = imageRef.current;
        if (canvas) {
            setImageLoaded(true);
        }

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
        };
    }, [isActive]);

    const handleDragStart = useCallback((e: React.DragEvent) => {
        if (placedNormalNPCs.length >= MAX_NPCS) {
            e.preventDefault();
            return;
        }
        setDraggingNPCId('new');
    }, [placedNormalNPCs.length]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const canvas = imageRef.current;
            if (!canvas) return;

            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width > 0 ? 414 / canvasRect.width : 1;
            const scaleY = canvasRect.height > 0 ? 740 / canvasRect.height : 1;

            const mouseX = (e.clientX - canvasRect.left) * scaleX;
            const mouseY = (e.clientY - canvasRect.top) * scaleY;

            if (resizingNPCId && resizeHandle && resizeStart) {
                const currentDistance = Math.sqrt(
                    Math.pow(mouseX - resizeStart.npcCenterX, 2) +
                    Math.pow(mouseY - resizeStart.npcCenterY, 2)
                );

                const newScale = (currentDistance / resizeStart.initialDistance) * resizeStart.scale;
                const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

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

            if (!draggingNPCId || !dragOffset) return;

            const currentNpc = [...placedNormalNPCs, ...placedFunctionalNPCs].find(npc => npc.id === draggingNPCId);
            if (!currentNpc) return;

            const adjustedX = mouseX - dragOffset.x;
            const adjustedY = mouseY - dragOffset.y;

            // 严格边界检查：不允许 NPC 身体任何部分超出 414x740
            const { halfW, halfH } = getNPCLogicSize(currentNpc);
            const clampedX = Math.max(halfW, Math.min(414 - halfW, adjustedX));
            const clampedY = Math.max(halfH, Math.min(740 - halfH, adjustedY));

            const relativeX = clampedX / 414;
            const relativeY = clampedY / 740;

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

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const canvas = imageRef.current;
            if (!canvas) return;

            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width > 0 ? 414 / canvasRect.width : 1;
            const scaleY = canvasRect.height > 0 ? 740 / canvasRect.height : 1;

            const mouseX = (e.clientX - canvasRect.left) * scaleX;
            const mouseY = (e.clientY - canvasRect.top) * scaleY;

            // 检查鼠标是否在逻辑图片范围内
            const isWithinImageBounds = 
                mouseX >= 0 && mouseX <= 414 &&
                mouseY >= 0 && mouseY <= 740;

            if (!isWithinImageBounds) return;

            const relativeX = mouseX / 414;
            const relativeY = mouseY / 740;

            let functionalNPCData: any = null;
            try {
                const data = e.dataTransfer.getData('application/json');
                if (data) {
                    functionalNPCData = JSON.parse(data);
                }
            } catch (error) {
                console.warn('解析拖拽数据失败:', error);
            }

            const newZIndex = placedNormalNPCs.length + placedFunctionalNPCs.length + 1;

            if (functionalNPCData) {
                const newNPC: PlacedNPC = {
                    id: `functional_npc_${Date.now()}`,
                    x: relativeX,
                    y: relativeY,
                    scale: DEFAULT_SCALE,
                    zIndex: newZIndex,
                    nodeId: functionalNPCData.nodeId || '',
                    imagePath: functionalNPCData.imagePath,
                    type: functionalNPCData.type || 'illustration',
                    name: functionalNPCData.name,
                    authorNote: functionalNPCData.authorNote || '',
                    backgroundColor: functionalNPCData.type === 'button' ? 'color-mix(in srgb, var(--color-shadow) 50.2%, transparent)' : undefined,
                };
                setPlacedFunctionalNPCs(prev => [...prev, newNPC]);
            } else {
                if (placedNormalNPCs.length >= MAX_NPCS) {
                    return;
                }
                const newNPC: PlacedNPC = {
                    id: `normal_npc_${Date.now()}`,
                    x: relativeX,
                    y: relativeY,
                    scale: DEFAULT_SCALE,
                    zIndex: newZIndex,
                    nodeId: '',
                    type: 'illustration',
                    authorNote: '',
                };
                setPlacedNormalNPCs(prev => [...prev, newNPC]);
            }
            setDraggingNPCId(null);
        },
        [placedNormalNPCs, placedFunctionalNPCs]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        const canvas = imageRef.current;
        if (!canvas) {
            e.preventDefault();
            return;
        }

        const canvasRect = canvas.getBoundingClientRect();
        const scaleX = canvasRect.width > 0 ? 414 / canvasRect.width : 1;
        const scaleY = canvasRect.height > 0 ? 740 / canvasRect.height : 1;

        const mouseX = (e.clientX - canvasRect.left) * scaleX;
        const mouseY = (e.clientY - canvasRect.top) * scaleY;

        const isWithinImageBounds = 
            mouseX >= 0 && mouseX <= 414 &&
            mouseY >= 0 && mouseY <= 740;

        if (isWithinImageBounds) {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        } else {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'none';
            }
        }
    }, []);

    const handleDragEnd = useCallback(() => {
        setDraggingNPCId(null);
    }, []);

    const handleNPCMouseDown = useCallback(
        (e: React.MouseEvent, npcId: string) => {
            e.preventDefault();
            e.stopPropagation();

            const canvas = imageRef.current;
            const allNPCs = [...placedNormalNPCs, ...placedFunctionalNPCs];
            const npc = allNPCs.find(n => n.id === npcId);
            if (!canvas || !npc) return;

            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width > 0 ? 414 / canvasRect.width : 1;
            const scaleY = canvasRect.height > 0 ? 740 / canvasRect.height : 1;

            const mouseX = (e.clientX - canvasRect.left) * scaleX;
            const mouseY = (e.clientY - canvasRect.top) * scaleY;

            const npcCenterX = npc.x * 414;
            const npcCenterY = npc.y * 740;

            const offsetX_drag = mouseX - npcCenterX;
            const offsetY_drag = mouseY - npcCenterY;

            setDragOffset({ x: offsetX_drag, y: offsetY_drag });
            setDraggingNPCId(npcId);
            setSelectedNPCId(npcId);
        },
        [placedNormalNPCs, placedFunctionalNPCs]
    );

    const handleResizeStart = useCallback(
        (e: React.MouseEvent, npcId: string, handle: 'nw' | 'ne' | 'sw' | 'se') => {
            e.preventDefault();
            e.stopPropagation();

            const allNPCs = [...placedNormalNPCs, ...placedFunctionalNPCs];
            const npc = allNPCs.find(n => n.id === npcId);
            if (!npc) return;

            const canvas = imageRef.current;
            if (!canvas) return;

            const canvasRect = canvas.getBoundingClientRect();
            const scaleX = canvasRect.width > 0 ? 414 / canvasRect.width : 1;
            const scaleY = canvasRect.height > 0 ? 740 / canvasRect.height : 1;

            const mouseX = (e.clientX - canvasRect.left) * scaleX;
            const mouseY = (e.clientY - canvasRect.top) * scaleY;

            const npcCenterX = npc.x * 414;
            const npcCenterY = npc.y * 740;

            const { halfW, halfH } = getNPCLogicSize(npc);

            let handleX = 0;
            let handleY = 0;
            switch (handle) {
                case 'nw': handleX = npcCenterX - halfW; handleY = npcCenterY - halfH; break;
                case 'ne': handleX = npcCenterX + halfW; handleY = npcCenterY - halfH; break;
                case 'sw': handleX = npcCenterX - halfW; handleY = npcCenterY + halfH; break;
                case 'se': handleX = npcCenterX + halfW; handleY = npcCenterY + halfH; break;
            }

            const initialDistance = Math.sqrt(
                Math.pow(handleX - npcCenterX, 2) + Math.pow(handleY - npcCenterY, 2)
            );

            setResizingNPCId(npcId);
            setResizeHandle(handle);
            setResizeStart({
                mouseX,
                mouseY,
                npcCenterX,
                npcCenterY,
                initialDistance,
                scale: npc.scale,
            });
        },
        [placedNormalNPCs, placedFunctionalNPCs]
    );

    const handleRemoveNPC = useCallback((npcId: string) => {
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.filter(npc => npc.id !== npcId));
        } else {
            setPlacedNormalNPCs(prev => prev.filter(npc => npc.id !== npcId));
        }
        setSelectedNPCId(null);
    }, [placedFunctionalNPCs]);

    const handleChangeZIndex = useCallback((npcId: string, delta: number) => {
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
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, zIndex: clampedZIndex } : npc)));
        } else {
            setPlacedNormalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, zIndex: clampedZIndex } : npc)));
        }
    }, [placedFunctionalNPCs]);

    const handleChangeBackgroundColor = useCallback((npcId: string, backgroundColor: string) => {
        const isFunctional = placedFunctionalNPCs.some(npc => npc.id === npcId);
        if (isFunctional) {
            setPlacedFunctionalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, backgroundColor } : npc)));
        } else {
            setPlacedNormalNPCs(prev => prev.map(npc => (npc.id === npcId ? { ...npc, backgroundColor } : npc)));
        }
    }, [placedFunctionalNPCs]);

    const allPlacedNPCs = useMemo(() => {
        return [...placedNormalNPCs, ...placedFunctionalNPCs];
    }, [placedNormalNPCs, placedFunctionalNPCs]);

    const checkUnsavedChanges = useCallback((): boolean => {
        const normalNPCsChanged = JSON.stringify(placedNormalNPCs) !== JSON.stringify(initialNormalNPCsRef.current);
        const functionalNPCsChanged = JSON.stringify(placedFunctionalNPCs) !== JSON.stringify(initialFunctionalNPCsRef.current);
        return normalNPCsChanged || functionalNPCsChanged;
    }, [placedNormalNPCs, placedFunctionalNPCs]);

    const resetInitialState = useCallback(() => {
        initialNormalNPCsRef.current = JSON.parse(JSON.stringify(placedNormalNPCs));
        initialFunctionalNPCsRef.current = JSON.parse(JSON.stringify(placedFunctionalNPCs));
    }, [placedNormalNPCs, placedFunctionalNPCs]);

    return {
        selectedSubSceneId,
        setSelectedSubSceneId,
        placedNormalNPCs,
        setPlacedNormalNPCs,
        placedFunctionalNPCs,
        setPlacedFunctionalNPCs,
        allPlacedNPCs,
        draggingNPCId,
        selectedNPCId,
        setSelectedNPCId,
        previewRef,
        imageRef,
        currentSceneIdRef,
        currentSubSceneIdRef,
        imageLoaded,
        setImageLoaded,
        isSubSceneContentReady,
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
        currentSubScene,
        checkUnsavedChanges,
        resetInitialState,
    };
};
