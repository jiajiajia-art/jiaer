/**
 * 去掉透明立绘四周空白；可选只取主体上半身（卡面头像），全图留给游戏立绘。
 */

const trimCache = new Map<string, string>();

/** 缓存版本：bust 算法变更时递增，避免旧裁切结果残留 */
const TRIM_CACHE_BUST_VERSION = 'b4';

export type OpaqueBounds = { x: number; y: number; w: number; h: number };

export type ContentCropRect = { x: number; y: number; w: number; h: number };

/** 扫描 RGBA，返回不透明像素外接矩形；全透明时返回 null。 */
export function findOpaqueBounds(
  data: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold = 8,
): OpaqueBounds | null {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  if (w <= 0 || h <= 0) return null;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  const thr = Math.max(0, Math.min(255, Number(alphaThreshold) || 0));
  for (let y = 0; y < h; y += 1) {
    const row = y * w * 4;
    for (let x = 0; x < w; x += 1) {
      if (data[row + x * 4 + 3] > thr) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * 主体上半带不透明像素重心。
 * 卡面头像须用窄带（约头顶～肩），否则宽裙/大面积躯干会把重心拉到胸口，裁掉头。
 */
export function findUpperOpaqueFocus(
  data: ArrayLike<number>,
  srcW: number,
  bounds: OpaqueBounds,
  alphaThreshold = 8,
  bandRatio = 0.28,
): { cx: number; cy: number } {
  const thr = Math.max(0, Math.min(255, Number(alphaThreshold) || 0));
  const y0 = bounds.y;
  const y1 = Math.min(
    bounds.y + bounds.h,
    bounds.y + Math.max(1, Math.round(bounds.h * Math.min(0.45, Math.max(0.18, bandRatio)))),
  );
  const x0 = bounds.x;
  const x1 = bounds.x + bounds.w;
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    const row = y * srcW * 4;
    for (let x = x0; x < x1; x += 1) {
      if (data[row + x * 4 + 3] > thr) {
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
  }
  if (count <= 0) {
    return {
      cx: bounds.x + bounds.w / 2,
      cy: bounds.y + bounds.h * 0.18,
    };
  }
  return { cx: sumX / count, cy: sumY / count };
}

function clamp(n: number, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * 几何回退：无像素数据时用外接矩形估算胸像窗（水平居中、自顶向下）。
 * 有像素时请用 resolveBustCropRect（按上半身重心，兼容高发饰/宽裙）。
 */
export function resolveContentCropRect(
  bounds: OpaqueBounds,
  options?: {
    upperRatio?: number;
    bustAspect?: number;
    padding?: number;
    srcW?: number;
    srcH?: number;
  },
): ContentCropRect {
  const padding = Math.max(0, Math.floor(options?.padding ?? 2));
  const srcW = Math.max(bounds.x + bounds.w, Number(options?.srcW) || bounds.x + bounds.w);
  const srcH = Math.max(bounds.y + bounds.h, Number(options?.srcH) || bounds.y + bounds.h);
  const ratioRaw = Number(options?.upperRatio);
  const upperRatio = Number.isFinite(ratioRaw) && ratioRaw > 0 && ratioRaw < 1
    ? ratioRaw
    : 1;
  const aspectRaw = Number(options?.bustAspect ?? WAREHOUSE_CARD_AVATAR_BUST_ASPECT);
  const bustAspect = Number.isFinite(aspectRaw) && aspectRaw > 0.5 && aspectRaw < 3
    ? aspectRaw
    : WAREHOUSE_CARD_AVATAR_BUST_ASPECT;

  let contentX = bounds.x;
  let contentW = bounds.w;
  let contentH = bounds.h;
  if (upperRatio < 1) {
    const sizeRatio = Math.min(0.42, Math.max(0.28, upperRatio));
    contentH = Math.min(bounds.h, Math.max(1, Math.round(bounds.h * sizeRatio)));
    contentW = Math.min(bounds.w, Math.max(1, Math.round(contentH / bustAspect)));
    if (bustAspect === 1) {
      const side = Math.min(bounds.w, bounds.h, contentH);
      contentW = side;
      contentH = side;
    }
    contentX = bounds.x + Math.round((bounds.w - contentW) / 2);
  }

  const x0 = Math.max(0, contentX - padding);
  const y0 = Math.max(0, bounds.y - padding);
  const x1 = Math.min(srcW, contentX + contentW + padding);
  const y1 = Math.min(srcH, bounds.y + contentH + padding);
  return {
    x: x0,
    y: y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
  };
}

/**
 * 卡面头像裁窗：顶对齐优先保住脸，水平按头顶～肩重心居中。
 * - 禁止用全身上半 55% 像素重心：宽裙会把窗拖到胸口、切掉头
 * - 高发饰：焦点仍在脸，窗顶贴近主体顶
 */
export function resolveBustCropRect(
  data: ArrayLike<number>,
  srcW: number,
  srcH: number,
  bounds: OpaqueBounds,
  options?: {
    upperRatio?: number;
    bustAspect?: number;
    padding?: number;
    alphaThreshold?: number;
  },
): ContentCropRect {
  const padding = Math.max(0, Math.floor(options?.padding ?? 2));
  const ratioRaw = Number(options?.upperRatio ?? WAREHOUSE_CARD_AVATAR_UPPER_RATIO);
  const upperRatio = Number.isFinite(ratioRaw) && ratioRaw > 0 && ratioRaw < 1
    ? ratioRaw
    : WAREHOUSE_CARD_AVATAR_UPPER_RATIO;
  const aspectRaw = Number(options?.bustAspect ?? WAREHOUSE_CARD_AVATAR_BUST_ASPECT);
  const bustAspect = Number.isFinite(aspectRaw) && aspectRaw > 0.5 && aspectRaw < 3
    ? aspectRaw
    : WAREHOUSE_CARD_AVATAR_BUST_ASPECT;
  const alphaThreshold = options?.alphaThreshold ?? 8;

  // 功能注释：窗约占主体 32%～45%，默认 0.38，兼顾矮发与高冠
  const sizeRatio = Math.min(0.45, Math.max(0.32, upperRatio));
  let sideH = Math.min(bounds.h, Math.max(1, Math.round(bounds.h * sizeRatio)));
  let sideW = Math.min(bounds.w, Math.max(1, Math.round(sideH / bustAspect)));
  if (Math.abs(bustAspect - 1) < 0.05) {
    const side = Math.min(bounds.w, bounds.h, sideH);
    sideW = side;
    sideH = side;
  }

  // 功能注释：只在头顶～肩窄带取重心，避免裙摆把焦点拉到胸口
  const focus = findUpperOpaqueFocus(data, srcW, bounds, alphaThreshold, 0.28);
  let x = Math.round(focus.cx - sideW / 2);
  // 功能注释：脸约在窗高 42% 处；再强制窗顶不得低于主体顶往下 12%（防切头）
  let y = Math.round(focus.cy - sideH * 0.42);
  const maxTopBias = bounds.y + Math.round(bounds.h * 0.12);
  y = Math.min(y, maxTopBias);

  const maxX = bounds.x + bounds.w - sideW;
  const maxY = bounds.y + bounds.h - sideH;
  x = clamp(x, bounds.x, Math.max(bounds.x, maxX));
  y = clamp(y, bounds.y, Math.max(bounds.y, maxY));

  const x0 = Math.max(0, x - padding);
  const y0 = Math.max(0, y - padding);
  const x1 = Math.min(srcW, x + sideW + padding);
  const y1 = Math.min(srcH, y + sideH + padding);
  return {
    x: x0,
    y: y0,
    w: Math.max(1, x1 - x0),
    h: Math.max(1, y1 - y0),
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read trimmed blob'));
    reader.readAsDataURL(blob);
  });
}

export type TrimTransparentOptions = {
  alphaThreshold?: number;
  padding?: number;
  /** 0~1：卡面胸像窗相对主体高（约 0.28～0.42） */
  upperRatio?: number;
  /** 胸像窗高/宽，用于由高度反推宽度（1 = 方形） */
  bustAspect?: number;
};

function buildTrimCacheKey(
  imageUrl: string,
  options?: TrimTransparentOptions,
): string {
  const alphaThreshold = options?.alphaThreshold ?? 8;
  const padding = Math.max(0, Math.floor(options?.padding ?? 2));
  const upperRatio = options?.upperRatio;
  const bustAspect = options?.bustAspect;
  return `${imageUrl}|${TRIM_CACHE_BUST_VERSION}|a${alphaThreshold}|p${padding}|u${upperRatio ?? 1}|b${bustAspect ?? WAREHOUSE_CARD_AVATAR_BUST_ASPECT}`;
}

/** 同步读缓存：有则立刻用裁切结果，避免先闪原图再跳胸像 */
export function peekTrimTransparentImageCache(
  imageUrl: string,
  options?: TrimTransparentOptions,
): string | null {
  const src = String(imageUrl || '').trim();
  if (!src) return null;
  return trimCache.get(buildTrimCacheKey(src, options)) || null;
}

/**
 * 拉取图片并裁掉透明边距（可选上半身），返回 PNG dataURL；失败则抛错。
 */
export async function trimTransparentImageUrl(
  imageUrl: string,
  options?: TrimTransparentOptions,
): Promise<string> {
  const src = String(imageUrl || '').trim();
  if (!src) throw new Error('empty image url');

  const cacheKey = buildTrimCacheKey(src, options);
  const cached = trimCache.get(cacheKey);
  if (cached) return cached;

  const alphaThreshold = options?.alphaThreshold ?? 8;
  const padding = Math.max(0, Math.floor(options?.padding ?? 2));
  const upperRatio = options?.upperRatio;
  const bustAspect = options?.bustAspect;

  const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`trim fetch failed: ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW <= 0 || srcH <= 0) throw new Error('invalid bitmap');

    const canvas = document.createElement('canvas');
    canvas.width = srcW;
    canvas.height = srcH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no 2d context');
    ctx.clearRect(0, 0, srcW, srcH);
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, srcW, srcH);
    const bounds = findOpaqueBounds(imageData.data, srcW, srcH, alphaThreshold);
    if (!bounds) {
      trimCache.set(cacheKey, src);
      return src;
    }

    const useBust = Number.isFinite(Number(upperRatio)) && Number(upperRatio) > 0 && Number(upperRatio) < 1;
    const rect = useBust
      ? resolveBustCropRect(imageData.data, srcW, srcH, bounds, {
          upperRatio,
          bustAspect,
          padding,
          alphaThreshold,
        })
      : resolveContentCropRect(bounds, {
          upperRatio,
          bustAspect,
          padding,
          srcW,
          srcH,
        });

    const almostFull =
      !useBust
      && rect.w >= srcW * 0.98
      && rect.h >= srcH * 0.98
      && rect.x <= 1
      && rect.y <= 1;
    if (almostFull) {
      trimCache.set(cacheKey, src);
      return src;
    }

    const out = document.createElement('canvas');
    out.width = rect.w;
    out.height = rect.h;
    const outCtx = out.getContext('2d');
    if (!outCtx) throw new Error('no out 2d context');
    outCtx.clearRect(0, 0, rect.w, rect.h);
    outCtx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);

    const outBlob: Blob = await new Promise((resolve, reject) => {
      out.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        'image/png',
      );
    });
    const dataUrl = await blobToDataUrl(outBlob);
    trimCache.set(cacheKey, dataUrl);
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

/**
 * 仓库卡面头像窗相对主体高度（约头肩）。
 * 实际裁窗还会按上半身像素重心平移，兼容高发饰与宽裙。
 */
export const WAREHOUSE_CARD_AVATAR_UPPER_RATIO = 0.38;
/** 胸像框高/宽：用于由高度反推居中裁窗宽度（1 = 方形头肩） */
export const WAREHOUSE_CARD_AVATAR_BUST_ASPECT = 1;
