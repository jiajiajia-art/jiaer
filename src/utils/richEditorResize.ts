/** 简介编辑器高度拖拽：钳制范围 */

export const RICH_EDITOR_MIN_HEIGHT_PX = 140;
export const RICH_EDITOR_DEFAULT_HEIGHT_PX = 220;
export const RICH_EDITOR_MAX_HEIGHT_VH = 0.8;
export const RICH_EDITOR_MAX_HEIGHT_CAP_PX = 960;

export function resolveRichEditorMaxHeightPx(
  viewportHeight: number,
  capPx: number = RICH_EDITOR_MAX_HEIGHT_CAP_PX,
  vhRatio: number = RICH_EDITOR_MAX_HEIGHT_VH,
): number {
  const vh = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  const fromVh = Math.floor(vh * vhRatio);
  return Math.max(RICH_EDITOR_MIN_HEIGHT_PX, Math.min(capPx, fromVh || capPx));
}

export function clampRichEditorHeight(
  height: number,
  options?: { min?: number; max?: number; viewportHeight?: number },
): number {
  const min = Math.max(1, Number(options?.min) || RICH_EDITOR_MIN_HEIGHT_PX);
  const max = Math.max(
    min,
    Number(options?.max)
      || resolveRichEditorMaxHeightPx(
        Number(options?.viewportHeight) || (typeof window !== 'undefined' ? window.innerHeight : 800),
      ),
  );
  const next = Number(height);
  if (!Number.isFinite(next)) return min;
  return Math.min(max, Math.max(min, Math.round(next)));
}
