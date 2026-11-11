/**
 * 局内「我的档案」用户上传头像：仅转 WebP + 压到体积上限，不做抠图/背景处理。
 * 优先质量 100（canvas toBlob quality=1）；超 1MB 时先缩边再降质。
 */

export const PLAYER_UPLOAD_AVATAR_MAX_BYTES = 1024 * 1024;
/** 尽量保留原图像素；仅在超 1MB 时再缩边 */
export const PLAYER_UPLOAD_AVATAR_MAX_EDGE = 4096;
/** canvas WebP quality：1 = 100% */
export const PLAYER_UPLOAD_AVATAR_QUALITY = 1;
export const PLAYER_UPLOAD_AVATAR_FORMAT = 'webp' as const;
export const PLAYER_UPLOAD_AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp';

/** 仅当 quality=100 仍超限时才降质 */
const QUALITY_FALLBACK = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28];
const EDGE_FALLBACK = [2560, 2048, 1600, 1280, 1024, 768, 640];

export function isAllowedPlayerAvatarUploadMime(mime: string | null | undefined): boolean {
  const m = String(mime || '').trim().toLowerCase();
  if (!m) return true; // 部分浏览器 File.type 为空，交给解码阶段校验
  return m.startsWith('image/') && !m.includes('svg');
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function scaleToMaxEdge(width: number, height: number, maxEdge: number) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const edge = Math.max(w, h);
  if (edge <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

function drawToCanvas(
  bitmap: ImageBitmap,
  maxEdge: number,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const sized = scaleToMaxEdge(bitmap.width, bitmap.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = sized.width;
  canvas.height = sized.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法处理图片');
  // 保留透明通道；不做背景填充/抠图
  ctx.clearRect(0, 0, sized.width, sized.height);
  ctx.drawImage(bitmap, 0, 0, sized.width, sized.height);
  return { canvas, width: sized.width, height: sized.height };
}

export type CompressImageToWebpResult = {
  file: File;
  bytes: number;
  width: number;
  height: number;
  quality: number;
};

/**
 * 功能注释：浏览器端把任意图片压成 WebP，且 byteLength ≤ maxBytes。
 * 默认优先质量 100；禁止调用任何抠图/去背景 API。
 */
export async function compressImageFileToWebpUnderMaxBytes(
  input: Blob,
  options?: {
    maxBytes?: number;
    maxEdge?: number;
    /** 0~1，默认 1（质量 100） */
    quality?: number;
    fileName?: string;
  },
): Promise<CompressImageToWebpResult> {
  const maxBytes = Math.max(1024, Number(options?.maxBytes) || PLAYER_UPLOAD_AVATAR_MAX_BYTES);
  const maxEdge = Math.max(64, Number(options?.maxEdge) || PLAYER_UPLOAD_AVATAR_MAX_EDGE);
  const preferredQuality = Math.min(
    1,
    Math.max(
      0.01,
      Number(options?.quality) > 0 ? Number(options?.quality) : PLAYER_UPLOAD_AVATAR_QUALITY,
    ),
  );
  if (!input || input.size < 8) {
    throw new Error('请选择有效图片');
  }
  if (!isAllowedPlayerAvatarUploadMime((input as File).type)) {
    throw new Error('仅支持常见图片格式（JPEG/PNG/WebP/GIF）');
  }

  const bitmap = await createImageBitmap(input);
  try {
    const edgeSteps = [maxEdge, ...EDGE_FALLBACK.filter((e) => e < maxEdge)];
    let lastBlob: Blob | null = null;
    let usedQuality = preferredQuality;
    let usedWidth = 0;
    let usedHeight = 0;

    // 1) 优先质量 100：必要时只缩边
    for (const edge of edgeSteps) {
      const { canvas, width, height } = drawToCanvas(bitmap, edge);
      // eslint-disable-next-line no-await-in-loop
      const blob = await canvasToBlob(canvas, 'image/webp', preferredQuality);
      if (!blob) continue;
      lastBlob = blob;
      usedQuality = preferredQuality;
      usedWidth = width;
      usedHeight = height;
      if (blob.size <= maxBytes) break;
    }

    // 2) 仍超限再降质（保持当前最小边）
    if (lastBlob && lastBlob.size > maxBytes) {
      const { canvas, width, height } = drawToCanvas(
        bitmap,
        edgeSteps[edgeSteps.length - 1] || maxEdge,
      );
      for (const quality of QUALITY_FALLBACK) {
        // eslint-disable-next-line no-await-in-loop
        const blob = await canvasToBlob(canvas, 'image/webp', quality);
        if (!blob) continue;
        lastBlob = blob;
        usedQuality = quality;
        usedWidth = width;
        usedHeight = height;
        if (blob.size <= maxBytes) break;
      }
    }

    if (!lastBlob) {
      throw new Error('浏览器无法导出 WebP，请换一张图或换浏览器重试');
    }
    if (lastBlob.size > maxBytes) {
      throw new Error(`图片压缩后仍超过 ${Math.round(maxBytes / 1024)}KB，请换更小的图`);
    }

    const baseName = String(options?.fileName || (input as File).name || 'avatar')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
      .slice(0, 40) || 'avatar';
    const file = new File([lastBlob], `${baseName}.webp`, { type: 'image/webp' });
    return {
      file,
      bytes: file.size,
      width: usedWidth,
      height: usedHeight,
      quality: usedQuality,
    };
  } finally {
    bitmap.close();
  }
}
