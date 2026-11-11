/**
 * 封面标题：treatment/overlay 才客户端叠字；model/control 由模型画字（海报字效跟提示词）。
 */

export type CoverPosterOverlayDecision = {
  /** 叠上封面的标题原文（仅 shouldOverlay 时使用） */
  overlayTitle: string;
  /** 是否在客户端叠字 */
  shouldOverlay: boolean;
};

/**
 * 功能注释：仅 treatment/overlay 臂叠字；model 臂不叠，避免盖住模型海报字效。
 */
export function resolveCoverPosterOverlay(options: {
  workTitle?: string | null;
  serverPosterTitle?: string | null;
  needsTitleOverlay?: boolean | null;
  titleMode?: string | null;
  abArm?: string | null;
}): CoverPosterOverlayDecision {
  const workTitle = String(options.workTitle || '').trim();
  const serverPosterTitle = String(options.serverPosterTitle || '').trim();
  const overlayTitle = workTitle || serverPosterTitle;
  const titleMode = String(options.titleMode || '').trim();
  const abArm = String(options.abArm || '').trim();
  // 功能注释：model/control 明确不叠字；仅 treatment 或显式 overlay 标记才叠
  if (titleMode === 'model' || abArm === 'control') {
    return { overlayTitle, shouldOverlay: false };
  }
  const flaggedOverlay = options.needsTitleOverlay === true
    || titleMode === 'overlay'
    || abArm === 'treatment';
  const shouldOverlay = Boolean(overlayTitle) && flaggedOverlay;
  return { overlayTitle, shouldOverlay };
}
