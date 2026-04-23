export const DESKTOP_MEDIA_QUERY = '(hover: hover) and (pointer: fine)';
export const DESKTOP_DRAG_THRESHOLD = 8;

export type HorizontalDragState = {
    pointerId: number | null;
    isDragging: boolean;
    hasCaptured: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
};

export const createInitialHorizontalDragState = (): HorizontalDragState => ({
    pointerId: null,
    isDragging: false,
    hasCaptured: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
});

export const beginHorizontalDrag = (
    pointerId: number,
    clientX: number,
    scrollLeft: number,
): HorizontalDragState => ({
    pointerId,
    isDragging: true,
    hasCaptured: false,
    startX: clientX,
    startScrollLeft: scrollLeft,
    moved: false,
});

export const getHorizontalDragDelta = (
    state: Pick<HorizontalDragState, 'startX'>,
    clientX: number,
): number => clientX - state.startX;

export const hasExceededHorizontalDragThreshold = (
    state: Pick<HorizontalDragState, 'startX'>,
    clientX: number,
    threshold = DESKTOP_DRAG_THRESHOLD,
): boolean => Math.abs(getHorizontalDragDelta(state, clientX)) >= threshold;

export const getNextHorizontalScrollLeft = (
    state: Pick<HorizontalDragState, 'startX' | 'startScrollLeft'>,
    clientX: number,
): number => state.startScrollLeft - getHorizontalDragDelta(state, clientX);

export const getNextHorizontalWheelScrollLeft = (
    currentScrollLeft: number,
    deltaY: number,
    maxScrollLeft: number,
): number => Math.max(0, Math.min(currentScrollLeft + deltaY, maxScrollLeft));
