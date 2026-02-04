export type CropAspect = { w: number; h: number };

const cropCache = new Map<string, string>();

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read blob as dataURL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 把图片居中裁剪为目标比例，并输出 dataURL（默认 jpeg）
 * 注意：如果图片源不允许跨域读取，使用 fetch+blob 可以绕开 Canvas taint（前提是服务器允许获取该资源）。
 */
export async function cropImageUrlToAspectDataUrl(
  imageUrl: string,
  aspect: CropAspect = { w: 5, h: 4 },
  options?: { mimeType?: string; quality?: number; maxWidth?: number }
): Promise<string> {
  const mimeType = options?.mimeType ?? 'image/jpeg';
  const quality = options?.quality ?? 0.86;
  const maxWidth = options?.maxWidth ?? 640;

  const cacheKey = `${imageUrl}|${aspect.w}:${aspect.h}|${mimeType}|${quality}|${maxWidth}`;
  const cached = cropCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Failed to fetch image for crop: ${res.status}`);
  const blob = await res.blob();

  const bitmap = await createImageBitmap(blob);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW <= 0 || srcH <= 0) throw new Error('Invalid bitmap size');

    const targetRatio = aspect.w / aspect.h;
    const srcRatio = srcW / srcH;

    let cropW = srcW;
    let cropH = srcH;
    if (srcRatio > targetRatio) {
      cropW = Math.round(srcH * targetRatio);
      cropH = srcH;
    } else {
      cropW = srcW;
      cropH = Math.round(srcW / targetRatio);
    }

    const sx = Math.round((srcW - cropW) / 2);
    const sy = Math.round((srcH - cropH) / 2);

    const outW = clamp(cropW, 1, maxWidth);
    const outH = Math.round(outW / targetRatio);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2d context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, cropW, cropH, 0, 0, outW, outH);

    const outBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Failed to export canvas blob'))),
        mimeType,
        quality
      );
    });

    const dataUrl = await blobToDataUrl(outBlob);
    cropCache.set(cacheKey, dataUrl);
    return dataUrl;
  } finally {
    bitmap.close();
  }
}


