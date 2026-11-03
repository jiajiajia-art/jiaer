/**
 * 地点场景图规格：编辑器与局内统一为 9:16 竖图，固定 1080×1920。
 * 上传 / 素材库 / 生图结果一律 cover 裁成该尺寸后再写入，避免「点了上传没反应」。
 */

export const SCENE_PORTRAIT_WIDTH = 1080;
export const SCENE_PORTRAIT_HEIGHT = 1920;
export const SCENE_PORTRAIT_RATIO = SCENE_PORTRAIT_WIDTH / SCENE_PORTRAIT_HEIGHT; // 9:16
export const SCENE_PORTRAIT_HINT = "场景图会裁成 9:16 竖图（1080×1920）";
export const SCENE_PORTRAIT_GEN_SIZE = `${SCENE_PORTRAIT_WIDTH}x${SCENE_PORTRAIT_HEIGHT}`;

/** 功能注释：严格校验像素尺寸（生图目标 / 回归用）。 */
export function isScenePortraitSize(width: number, height: number): boolean {
  return width === SCENE_PORTRAIT_WIDTH && height === SCENE_PORTRAIT_HEIGHT;
}

/** 功能注释：尺寸不合规时返回提示；合规则返回 null。 */
export function scenePortraitSizeError(width: number, height: number): string | null {
  return isScenePortraitSize(width, height) ? null : SCENE_PORTRAIT_HINT;
}

export function readImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    img.onerror = () => reject(new Error("无法读取图片尺寸"));
    img.src = src;
  });
}

/** 功能注释：从本地 File 读自然尺寸（不缩放）。 */
export function readFileImageSize(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  return readImageNaturalSize(url).finally(() => URL.revokeObjectURL(url));
}

/** 功能注释：把任意图片 cover 裁进 1080×1920 画布，返回 jpeg dataURL 供预览与局内使用。 */
export function drawScenePortraitDataUrl(img: CanvasImageSource, srcW: number, srcH: number): string {
  const tw = SCENE_PORTRAIT_WIDTH;
  const th = SCENE_PORTRAIT_HEIGHT;
  const scale = Math.max(tw / Math.max(1, srcW), th / Math.max(1, srcH));
  const dw = srcW * scale;
  const dh = srcH * scale;
  const dx = (tw - dw) / 2;
  const dy = (th - dh) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, tw, th);
  ctx.drawImage(img, dx, dy, dw, dh);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法读取图片"));
    img.src = src;
  });
}

/** 功能注释：URL / dataURL → 标准场景竖图 dataURL。 */
export async function rasterToScenePortraitDataUrl(src: string): Promise<string> {
  const img = await loadImageElement(src);
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (isScenePortraitSize(w, h)) {
    // 已是目标尺寸：若本身是 dataURL 可直接用，否则仍过画布统一成 jpeg
    if (src.startsWith("data:image/")) return src;
  }
  return drawScenePortraitDataUrl(img, w, h);
}

/** 功能注释：本地文件 → 标准场景竖图 dataURL（上传入口用，保证点选后预览一定有图）。 */
export async function fileToScenePortraitDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    return await rasterToScenePortraitDataUrl(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** @deprecated 保留给旧调用；现改为自动裁切，恒返回 null。 */
export async function assertScenePortraitFile(_file: File): Promise<string | null> {
  return null;
}

/** @deprecated 保留给旧调用；现改为自动裁切，恒返回 null。 */
export async function assertScenePortraitUrl(_src: string): Promise<string | null> {
  return null;
}
