/**
 * 头像库上传前：校验格式/尺寸；非 1:1 须裁剪；静图垫 #1c1c1e；GIF 保留动画（传 crop 给服务端）。
 */

export const SQUARE_AVATAR_MIN_SIDE = 256;
export const SQUARE_AVATAR_TARGET_SIDE = 512;
export const SQUARE_AVATAR_FILL = '#1c1c1e';
export const SQUARE_AVATAR_TOLERANCE = 0.02;
export const SQUARE_AVATAR_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';

export type SquareCropRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function isAnimatedGifFile(file: File | null | undefined): boolean {
  if (!file) return false;
  return String(file.type || '').toLowerCase() === 'image/gif'
    || /\.gif$/i.test(file.name || '');
}

export function isAllowedAvatarUploadFile(file: File): boolean {
  const t = String(file.type || '').toLowerCase();
  if (t === 'image/png' || t === 'image/jpeg' || t === 'image/jpg' || t === 'image/webp' || t === 'image/gif') {
    return true;
  }
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
}

export function isApproxSquare(width: number, height: number, tolerance = SQUARE_AVATAR_TOLERANCE): boolean {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return false;
  return Math.abs(w - h) / Math.max(w, h) <= tolerance;
}

export function assertMinSide(width: number, height: number, minSide = SQUARE_AVATAR_MIN_SIDE): string | null {
  if (width < minSide || height < minSide) {
    return `边长不得低于 ${minSide}px（当前 ${width}×${height}）`;
  }
  return null;
}

export function readImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error('无法读取图片尺寸'));
    img.src = src;
  });
}

/**
 * 功能注释：把裁剪框规范为正方形，取交集内居中，避免 min(w,h)+左上角导致与选区偏移。
 */
export function normalizeSquareCropRect(
  crop: SquareCropRect,
  imageWidth: number,
  imageHeight: number,
): SquareCropRect {
  const imgW = Math.max(1, Math.round(Number(imageWidth) || 0));
  const imgH = Math.max(1, Math.round(Number(imageHeight) || 0));
  let left = Math.round(Number(crop.left) || 0);
  let top = Math.round(Number(crop.top) || 0);
  let width = Math.max(1, Math.round(Number(crop.width) || 0));
  let height = Math.max(1, Math.round(Number(crop.height) || 0));

  // 先钳到原图
  left = Math.min(Math.max(0, left), imgW - 1);
  top = Math.min(Math.max(0, top), imgH - 1);
  width = Math.min(width, imgW - left);
  height = Math.min(height, imgH - top);

  const side = Math.max(1, Math.min(width, height));
  // 功能注释：在原裁剪框内居中取方，保证导出内容与预览框中心一致
  left += Math.floor((width - side) / 2);
  top += Math.floor((height - side) / 2);
  left = Math.min(Math.max(0, left), imgW - side);
  top = Math.min(Math.max(0, top), imgH - side);

  return { left, top, width: side, height: side };
}

/**
 * 功能注释：显示 URL 必须用 1:1 成片，禁止立绘「头顶 thumb」（会二次裁切导致与选区不一致）。
 */
export function resolveLibraryAvatarDisplayUrl(item: {
  imageUrl?: string | null;
  originalUrl?: string | null;
  thumbUrl?: string | null;
} | null | undefined): string {
  const image = String(item?.imageUrl || '').trim();
  const original = String(item?.originalUrl || '').trim();
  return image || original || '';
}

/** 功能注释：裁切画布输出正方形静图，透明区域垫平台底色；严格按选区居中方框取样 */
export async function exportSquareStaticBlob(
  image: HTMLImageElement,
  crop: SquareCropRect,
  {
    targetSide = SQUARE_AVATAR_TARGET_SIDE,
    fill = SQUARE_AVATAR_FILL,
    mimeType = 'image/webp',
    quality = 0.92,
  }: {
    targetSide?: number;
    fill?: string;
    mimeType?: string;
    quality?: number;
  } = {},
): Promise<Blob> {
  const naturalW = image.naturalWidth || image.width;
  const naturalH = image.naturalHeight || image.height;
  const square = normalizeSquareCropRect(crop, naturalW, naturalH);
  const canvas = document.createElement('canvas');
  canvas.width = targetSide;
  canvas.height = targetSide;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画布不可用');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, targetSide, targetSide);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    square.left,
    square.top,
    square.width,
    square.height,
    0,
    0,
    targetSide,
    targetSide,
  );
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });
  if (!blob) throw new Error('导出头像失败');
  return blob;
}

export function describeSquareAvatarUploadHints(): string {
  return `推荐 ${SQUARE_AVATAR_TARGET_SIDE}×${SQUARE_AVATAR_TARGET_SIDE}px，最低 ${SQUARE_AVATAR_MIN_SIDE}×${SQUARE_AVATAR_MIN_SIDE}px；PNG/JPG/WebP/GIF；非 1:1 须先裁剪（不可拉伸变形）。`;
}

/** 批量看板：合格 / 需裁切 / 不合格 */
export type AvatarBatchInspectStatus = 'pass' | 'need_crop' | 'invalid';

export type AvatarBatchInspectResult = {
  status: AvatarBatchInspectStatus;
  width: number;
  height: number;
  isGif: boolean;
  /** 展示用短文案 */
  label: string;
  reason?: string;
};

/**
 * 功能注释：批量选图后看板分类——1:1 且边长够 → 合格；非 1:1 但最短边够裁 → 需裁切；否则不合格。
 */
export function classifyAvatarBatchImage(
  width: number,
  height: number,
  file: File | { name?: string; type?: string },
): AvatarBatchInspectResult {
  const w = Math.max(0, Math.round(Number(width) || 0));
  const h = Math.max(0, Math.round(Number(height) || 0));
  const isGif = isAnimatedGifFile(file as File);
  const square = isApproxSquare(w, h);
  const minSide = Math.min(w, h);

  if (w <= 0 || h <= 0) {
    return {
      status: 'invalid',
      width: w,
      height: h,
      isGif,
      label: '不合格',
      reason: '无法读取尺寸',
    };
  }

  if (square) {
    const minErr = assertMinSide(w, h);
    if (minErr) {
      return {
        status: 'invalid',
        width: w,
        height: h,
        isGif,
        label: '不合格',
        reason: minErr,
      };
    }
    return {
      status: 'pass',
      width: w,
      height: h,
      isGif,
      label: '合格',
    };
  }

  if (minSide < SQUARE_AVATAR_MIN_SIDE) {
    return {
      status: 'invalid',
      width: w,
      height: h,
      isGif,
      label: '不合格',
      reason: `非 1:1 且最短边 ${minSide}px < ${SQUARE_AVATAR_MIN_SIDE}px，裁切后仍不够`,
    };
  }

  return {
    status: 'need_crop',
    width: w,
    height: h,
    isGif,
    label: '需裁切',
    reason: `当前 ${w}×${h}，非 1:1`,
  };
}
