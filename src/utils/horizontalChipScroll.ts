/**
 * 分类页等标签横滑：拖拽/滚轮换算纯函数，供 hook 与单测复用。
 */

export type HorizontalDragState = {
    isDragging: boolean;
    pointerId: number | null;
    hasCaptured: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
};

export const HORIZONTAL_DRAG_THRESHOLD_PX = 6;

/** 功能注释：创建空闲拖拽状态，避免多行共用时互相污染 */
export const createHorizontalDragState = (): HorizontalDragState => ({
    isDragging: false,
    pointerId: null,
    hasCaptured: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
});

/** 功能注释：根据指针位移计算下一 scrollLeft（向左拖 → 内容右移） */
export const computeDragScrollLeft = (
    startScrollLeft: number,
    startX: number,
    clientX: number,
): number => startScrollLeft - (clientX - startX);

/** 功能注释：仅当纵向滚轮占优时，把 deltaY 转成横向滚动 */
export const shouldConvertWheelToHorizontal = (deltaX: number, deltaY: number): boolean => (
    Math.abs(deltaY) > Math.abs(deltaX)
);

/**
 * 功能注释：把纵向滚轮落到横向标签行；有实际位移时返回 true（调用方应 preventDefault）
 */
export const applyWheelDeltaToHorizontalScroll = (
    scrollLeft: number,
    scrollWidth: number,
    clientWidth: number,
    deltaY: number,
): { nextScrollLeft: number; changed: boolean } => {
    const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
    if (maxScrollLeft <= 0) {
        return { nextScrollLeft: scrollLeft, changed: false };
    }
    const nextScrollLeft = Math.max(0, Math.min(scrollLeft + deltaY, maxScrollLeft));
    return {
        nextScrollLeft,
        changed: nextScrollLeft !== scrollLeft,
    };
};

/** 功能注释：桌面鼠标才接管拖拽；触控交给原生 overflow 滑动 */
export const shouldHandlePointerAsMouseDrag = (
    pointerType: string,
    button: number,
): boolean => pointerType === 'mouse' && button === 0;
