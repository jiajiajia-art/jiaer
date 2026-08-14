/**
 * 海报封面标题叠字：用浏览器真实中文字体画标题，避免模型乱码。
 */

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('封面图加载失败'));
    img.src = src;
  });
}

function wrapTitleLines(
  ctx: CanvasRenderingContext2D,
  title: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const text = String(title || '').trim();
  if (!text) return [];
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const chars = [...text];
  const lines: string[] = [];
  let current = '';
  for (const ch of chars) {
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines) break;
    } else {
      current = next;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }
  // 末行仍过长则加省略
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    if (chars.join('').length > lines.join('').length) {
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
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
 */
export async function compositePosterTitleOntoCover(
  imageSrc: string,
  title: string,
): Promise<File> {
  const posterTitle = String(title || '').trim();
  if (!posterTitle) {
    throw new Error('缺少海报标题');
  }

  try {
    await document.fonts.load(`700 48px "Noto Serif SC"`);
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

  const bandH = Math.round(height * 0.3);
  const gradient = ctx.createLinearGradient(0, 0, 0, bandH);
  gradient.addColorStop(0, 'rgba(8, 6, 8, 0.78)');
  gradient.addColorStop(0.55, 'rgba(8, 6, 8, 0.42)');
  gradient.addColorStop(1, 'rgba(8, 6, 8, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, bandH);

  const fontSize = Math.max(28, Math.round(height * 0.075));
  const fontFamily = '"Noto Serif SC", "Songti SC", "PingFang SC", "Microsoft YaHei", serif';
  ctx.font = `700 ${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(fontSize * 0.25);
  ctx.shadowOffsetY = Math.round(fontSize * 0.08);

  const maxTextWidth = width * 0.86;
  const lines = wrapTitleLines(ctx, posterTitle, maxTextWidth, 2);
  const lineGap = fontSize * 1.2;
  const blockH = lineGap * Math.max(lines.length - 1, 0);
  const startY = height * 0.12 - blockH / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * lineGap);
  });

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  return canvasToWebpFile(canvas);
}
