/**
 * 海报封面标题叠字：用浏览器真实中文字体画标题，避免模型乱码。
 */

import {
  resolveEffectivePosterTitleStyle,
  type PosterTitleStyleId,
} from './posterTitleStyle.ts';
import { wrapPosterTitleLines } from './wrapPosterTitleLines.ts';

export type CoverPosterOrientation = 'landscape' | 'portrait';

export type PosterTitleMetrics = {
  isPortrait: boolean;
  fontSize: number;
  maxTextWidth: number;
  bandH: number;
  topPad: number;
  lineGap: number;
  /** 首行垂直中心（textBaseline middle） */
  startY: number;
};

/**
 * 功能注释：按画布比例算标题字号与顶距。竖图按宽度定字号，且两行只往下排、不把首行往上顶，避免贴顶被裁。
 */
export function resolvePosterTitleMetrics(
  width: number,
  height: number,
  orientation?: CoverPosterOrientation,
): PosterTitleMetrics {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const ratio = h / w;
  const isPortrait = orientation === 'portrait' || (orientation !== 'landscape' && ratio >= 1.15);
  // 功能注释：略收字号、加宽行宽，长标题更像海报两行而非挤成「…外 / 卖」
  const fontSize = isPortrait
    ? Math.max(20, Math.round(w * 0.078))
    : Math.max(26, Math.round(h * 0.068));
  const topPad = Math.max(
    Math.round(h * (isPortrait ? 0.085 : 0.045)),
    Math.round(fontSize * (isPortrait ? 1.0 : 0.85)),
    isPortrait ? 28 : 16,
  );
  return {
    isPortrait,
    fontSize,
    maxTextWidth: w * (isPortrait ? 0.9 : 0.88),
    bandH: Math.round(h * (isPortrait ? 0.24 : 0.3)),
    topPad,
    lineGap: fontSize * 1.18,
    startY: topPad + fontSize / 2,
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('封面图加载失败'));
    img.src = src;
  });
}

function canvasToWebpFile(canvas: HTMLCanvasElement, fileName = 'cover.webp'): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('封面导出失败'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/webp' }));
      },
      'image/webp',
      0.92,
    );
  });
}

/**
 * 在封面图上部叠正确中文标题，返回可上传的 webp File。
 * 字内容必须是作品标题原文；外观由 styleId / 提示词控制。
 */
export async function compositePosterTitleOntoCover(
  imageSrc: string,
  title: string,
  options?: {
    orientation?: CoverPosterOrientation;
    styleId?: PosterTitleStyleId | string | null;
    /** 提示词：有标题字体/颜色要求时覆盖示例预设 */
    prompt?: string | null;
  },
): Promise<File> {
  const posterTitle = String(title || '').trim();
  if (!posterTitle) {
    throw new Error('缺少海报标题');
  }

  const style = resolveEffectivePosterTitleStyle({
    presetId: options?.styleId,
    prompt: options?.prompt,
  });
  try {
    const primaryFamily = style.fontFamily.split(',')[0].replace(/"/g, '').trim();
    await document.fonts.load(`${style.fontWeight} 64px "${primaryFamily}"`, posterTitle.slice(0, 4) || '标题');
    await document.fonts.load(`700 64px "Noto Serif SC"`);
    await document.fonts.ready;
  } catch {
    /* 字体失败时回退系统中文字体 */
  }

  // 先拉成 blob，避免跨域 canvas 污染导致 toBlob 失败
  const resp = await fetch(imageSrc, { mode: 'cors', credentials: 'omit' });
  if (!resp.ok) {
    throw new Error(`封面图拉取失败 (${resp.status})`);
  }
  const blob = await resp.blob();
  const objectUrl = URL.createObjectURL(blob);
  let img: HTMLImageElement;
  try {
    img = await loadImageElement(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error('封面尺寸无效');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('画布不可用');
  }

  ctx.drawImage(img, 0, 0, width, height);

  const metrics = resolvePosterTitleMetrics(width, height, options?.orientation);
  let { bandH, fontSize, maxTextWidth, lineGap, startY } = metrics;
  const gradient = ctx.createLinearGradient(0, 0, 0, bandH);
  gradient.addColorStop(0, 'rgba(8, 6, 8, 0.72)');
  gradient.addColorStop(0.55, 'rgba(8, 6, 8, 0.36)');
  gradient.addColorStop(1, 'rgba(8, 6, 8, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, bandH);

  // 功能注释：主路径已改模型画字；叠字兜底仅用样式字体栈（系统中文回退）
  const applyFont = (size: number) => {
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
  };
  applyFont(fontSize);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  // 功能注释：过长标题先略缩字号，再折行，更接近海报排版
  const measure = (t: string) => ctx.measureText(t).width;
  let lines = wrapPosterTitleLines(posterTitle, maxTextWidth, measure, 2);
  let guard = 0;
  while (
    guard < 8
    && fontSize > 18
    && lines.some((line) => measure(line) > maxTextWidth * 1.02)
  ) {
    fontSize -= 2;
    applyFont(fontSize);
    lineGap = fontSize * 1.18;
    startY = metrics.topPad + fontSize / 2;
    lines = wrapPosterTitleLines(posterTitle, maxTextWidth, measure, 2);
    guard += 1;
  }

  // 功能注释：海报字效收敛外发光，避免「WordArt 霓虹」
  const shadowBlur = Math.min(
    Math.round(fontSize * style.shadowBlurRatio),
    Math.round(fontSize * 0.32),
  );

  lines.forEach((line, index) => {
    const x = width / 2;
    const y = startY + index * lineGap;
    ctx.shadowColor = style.shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetY = Math.round(fontSize * style.shadowOffsetYRatio);
    if (style.stroke) {
      ctx.lineWidth = Math.max(2, Math.round(fontSize * style.strokeRatio));
      ctx.strokeStyle = style.stroke;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = style.fill;
    ctx.fillText(line, x, y);
  });

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  return canvasToWebpFile(canvas);
}
