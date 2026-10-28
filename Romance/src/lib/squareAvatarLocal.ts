/** 游玩端本地头像：1:1 判定与导出（与平台头像库约定对齐） */

export const LOCAL_AVATAR_MIN_SIDE = 256;
export const LOCAL_AVATAR_TARGET_SIDE = 512;
export const LOCAL_AVATAR_FILL = "#1c1c1e";
export const LOCAL_AVATAR_TOLERANCE = 0.02;

export function isApproxSquare(width: number, height: number, tolerance = LOCAL_AVATAR_TOLERANCE): boolean {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w <= 0 || h <= 0) return false;
  return Math.abs(w - h) / Math.max(w, h) <= tolerance;
}

export function assertMinSide(width: number, height: number, minSide = LOCAL_AVATAR_MIN_SIDE): string | null {
  if (width < minSide || height < minSide) {
    return `边长不得低于 ${minSide}px（当前 ${width}×${height}）`;
  }
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

export function readImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error("无法读取图片尺寸"));
    img.src = src;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("预览生成失败"));
    reader.readAsDataURL(blob);
  });
}

/** 功能注释：按显示裁切框导出正方形静图，透明区垫底色 */
export async function exportSquareDataUrl(
  image: HTMLImageElement,
  crop: { x: number; y: number; width: number; height: number },
  displayW: number,
  displayH: number,
  targetSide = LOCAL_AVATAR_TARGET_SIDE,
  fill = LOCAL_AVATAR_FILL,
): Promise<string> {
  const scaleX = image.naturalWidth / Math.max(1, displayW);
  const scaleY = image.naturalHeight / Math.max(1, displayH);
  let sx = Math.round(crop.x * scaleX);
  let sy = Math.round(crop.y * scaleY);
  let sw = Math.max(1, Math.round(crop.width * scaleX));
  let sh = Math.max(1, Math.round(crop.height * scaleY));
  const side = Math.max(1, Math.min(sw, sh));
  sx += Math.floor((sw - side) / 2);
  sy += Math.floor((sh - side) / 2);
  const maxX = Math.max(0, image.naturalWidth - side);
  const maxY = Math.max(0, image.naturalHeight - side);
  sx = Math.min(Math.max(0, sx), maxX);
  sy = Math.min(Math.max(0, sy), maxY);

  const canvas = document.createElement("canvas");
  canvas.width = targetSide;
  canvas.height = targetSide;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画布不可用");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, targetSide, targetSide);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, sx, sy, side, side, 0, 0, targetSide, targetSide);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/webp", 0.92);
  });
  if (!blob) throw new Error("导出头像失败");
  return blobToDataUrl(blob);
}
