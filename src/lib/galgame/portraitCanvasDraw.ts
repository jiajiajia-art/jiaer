/**
 * 立绘 Canvas 绘制：object-fit contain + 底对齐；可选裁掉透明边后按主体铺满。
 * 纯几何函数，无 DOM / 无跨文件依赖（便于 node --experimental-strip-types 单测）。
 */

export type OpaqueBounds = { x: number; y: number; w: number; h: number };

export type ContainBottomRect = {
  dx: number;
  dy: number;
  drawWidth: number;
  drawHeight: number;
};

export type SourceCropRect = {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
};

/** 文档竖图 NPC 头顶留白约占主体高度的比例（陆沉舟 topGap/opaqueH ≈ 0.05） */
export const PLAY_PORTRAIT_HEADROOM_RATIO = 0.05;

/**
 * 局内导入/重生成立绘裁切后的最大占屏高（相对容器）。
 * 对照文档 NPC「陆沉舟」截图像素测量约 0.94，禁止紧裁后 100% 顶满。
 */
export const PLAY_TRIMMED_PORTRAIT_MAX_FILL = 0.94;

/** contain + 底部对齐；可选限制最大占屏高（对齐文档 NPC） */
export function computeContainBottomRect(
  containerWidth: number,
  containerHeight: number,
  srcWidth: number,
  srcHeight: number,
  maxFillRatio?: number,
): ContainBottomRect {
  const cw = Math.max(1, Number(containerWidth) || 1);
  const ch = Math.max(1, Number(containerHeight) || 1);
  const iw = Math.max(1, Number(srcWidth) || 1);
  const ih = Math.max(1, Number(srcHeight) || 1);
  const imgAspect = iw / ih;
  const containerAspect = cw / ch;
  let drawWidth: number;
  let drawHeight: number;
  if (imgAspect > containerAspect) {
    drawWidth = cw;
    drawHeight = cw / imgAspect;
  } else {
    drawHeight = ch;
    drawWidth = ch * imgAspect;
  }
  const fillCap = Number(maxFillRatio);
  if (Number.isFinite(fillCap) && fillCap > 0 && fillCap < 1 && drawHeight > ch * fillCap) {
    const s = (ch * fillCap) / drawHeight;
    drawWidth *= s;
    drawHeight *= s;
  }
  return {
    dx: (cw - drawWidth) / 2,
    dy: ch - drawHeight,
    drawWidth,
    drawHeight,
  };
}

export type OpaqueSourceCropOptions = {
  /** 四周像素 pad */
  padding?: number;
  /**
   * 相对主体高度的头顶留白（对齐文档 NPC 构图）。
   * 紧贴发丝裁切会让重生成立绘顶满屏，比陆沉舟等文档图更「顶」。
   */
  headroomRatio?: number;
};

/** 不透明外接矩形 → drawImage 源裁窗；无主体时退回整图 */
export function resolveOpaqueSourceCrop(
  imgWidth: number,
  imgHeight: number,
  bounds: OpaqueBounds | null | undefined,
  options?: OpaqueSourceCropOptions | number,
): SourceCropRect {
  const iw = Math.max(1, Math.floor(imgWidth));
  const ih = Math.max(1, Math.floor(imgHeight));
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) {
    return { sx: 0, sy: 0, sw: iw, sh: ih };
  }
  const opts: OpaqueSourceCropOptions = typeof options === 'number'
    ? { padding: options }
    : (options || {});
  const pad = Math.max(0, Math.floor(opts.padding ?? 2));
  const headroomRatio = Math.max(0, Math.min(0.25, Number(opts.headroomRatio) || 0));
  const headroom = Math.round(bounds.h * headroomRatio);
  const sx = Math.max(0, bounds.x - pad);
  const sy = Math.max(0, bounds.y - pad - headroom);
  const ex = Math.min(iw, bounds.x + bounds.w + pad);
  const ey = Math.min(ih, bounds.y + bounds.h + pad);
  return {
    sx,
    sy,
    sw: Math.max(1, ex - sx),
    sh: Math.max(1, ey - sy),
  };
}
