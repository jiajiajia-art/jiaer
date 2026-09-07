import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
    applyWheelDeltaToHorizontalScroll,
    computeDragScrollLeft,
    createHorizontalDragState,
    HORIZONTAL_DRAG_THRESHOLD_PX,
    shouldConvertWheelToHorizontal,
    shouldHandlePointerAsMouseDrag,
    type HorizontalDragState,
} from '../utils/horizontalChipScroll';

type UseHorizontalChipScrollResult = {
    isDragging: boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (event: React.PointerEvent<HTMLDivElement>) => void;
    onClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
};

/**
 * 功能注释：标签横滑行的鼠标拖拽 + 滚轮转横滑；触控仍走原生 overflow。
 * 不区分桌面/窄屏：窄屏下用鼠标拖也能滑（DevTools / 外接鼠标）。
 */
export const useHorizontalChipScroll = (
    scrollRef: RefObject<HTMLDivElement | null>,
): UseHorizontalChipScrollResult => {
    const [isDragging, setIsDragging] = useState(false);
    const dragStateRef = useRef<HorizontalDragState>(createHorizontalDragState());

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return undefined;

        const onWheel = (event: WheelEvent) => {
            if (!shouldConvertWheelToHorizontal(event.deltaX, event.deltaY)) return;
            const result = applyWheelDeltaToHorizontalScroll(
                el.scrollLeft,
                el.scrollWidth,
                el.clientWidth,
                event.deltaY,
            );
            if (!result.changed) return;
            el.scrollLeft = result.nextScrollLeft;
            event.preventDefault();
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
        };
    }, [scrollRef]);

    const finishDragging = useCallback((currentTarget?: HTMLDivElement, pointerId?: number) => {
        const activePointerId = pointerId ?? dragStateRef.current.pointerId;
        const hadCaptured = dragStateRef.current.hasCaptured;
        const didMove = dragStateRef.current.moved;

        if (!dragStateRef.current.isDragging && dragStateRef.current.pointerId === null) {
            return;
        }

        // 功能注释：先保留 moved，让随后的 click 捕获阶段能拦截误点
        dragStateRef.current = {
            ...createHorizontalDragState(),
            moved: didMove,
        };
        window.setTimeout(() => {
            dragStateRef.current.moved = false;
        }, 0);
        setIsDragging(false);

        if (
            hadCaptured
            && activePointerId !== null
            && currentTarget?.hasPointerCapture(activePointerId)
        ) {
            currentTarget.releasePointerCapture(activePointerId);
        }
    }, []);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!shouldHandlePointerAsMouseDrag(event.pointerType, event.button) || !scrollRef.current) {
            return;
        }

        dragStateRef.current = {
            pointerId: event.pointerId,
            isDragging: true,
            hasCaptured: false,
            startX: event.clientX,
            startScrollLeft: scrollRef.current.scrollLeft,
            moved: false,
        };
    }, [scrollRef]);

    const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (
            dragStateRef.current.pointerId !== event.pointerId
            || !dragStateRef.current.isDragging
            || !scrollRef.current
        ) {
            return;
        }

        const deltaX = event.clientX - dragStateRef.current.startX;
        if (Math.abs(deltaX) >= HORIZONTAL_DRAG_THRESHOLD_PX) {
            dragStateRef.current.moved = true;
            setIsDragging(true);
            if (!dragStateRef.current.hasCaptured) {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStateRef.current.hasCaptured = true;
            }
        }

        if (!dragStateRef.current.moved) return;

        scrollRef.current.scrollLeft = computeDragScrollLeft(
            dragStateRef.current.startScrollLeft,
            dragStateRef.current.startX,
            event.clientX,
        );
    }, [scrollRef]);

    const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current.pointerId !== event.pointerId) return;
        finishDragging(event.currentTarget, event.pointerId);
    }, [finishDragging]);

    const onPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current.pointerId !== event.pointerId) return;
        finishDragging(event.currentTarget, event.pointerId);
    }, [finishDragging]);

    const onLostPointerCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (dragStateRef.current.pointerId !== event.pointerId) return;
        finishDragging();
    }, [finishDragging]);

    const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!dragStateRef.current.moved) return;
        event.preventDefault();
        event.stopPropagation();
    }, []);

    return {
        isDragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onLostPointerCapture,
        onClickCapture,
    };
};
