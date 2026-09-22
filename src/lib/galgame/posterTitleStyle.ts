/**
 * 封面叠字标题样式：
 * - 示例预设可供点选
 * - 提示词里写了字体/颜色/描边等 → 以提示词为准覆盖预设
 * 字内容始终用作品标题原文。
 */

export type PosterTitleStyleId = 'classic' | 'cheeseNeon' | 'custom';

export type PosterTitleStyle = {
  id: PosterTitleStyleId;
  /** canvas font-family 串 */
  fontFamily: string;
  fontWeight: number;
  fill: string;
  stroke: string | null;
  strokeRatio: number;
  shadowColor: string;
  shadowBlurRatio: number;
  shadowOffsetYRatio: number;
  /** 是否来自提示词解析（覆盖了示例） */
  fromPrompt?: boolean;
};

export const POSTER_TITLE_STYLE_ORDER: Array<'classic' | 'cheeseNeon'> = ['classic', 'cheeseNeon'];

const STYLE_MAP: Record<'classic' | 'cheeseNeon', PosterTitleStyle> = {
  classic: {
    id: 'classic',
    fontFamily: '"Noto Serif SC", "Songti SC", "PingFang SC", "Microsoft YaHei", serif',
    fontWeight: 700,
    fill: '#ffffff',
    stroke: null,
    strokeRatio: 0,
    shadowColor: 'rgba(0,0,0,0.55)',
    shadowBlurRatio: 0.25,
    shadowOffsetYRatio: 0.08,
  },
  /** 功能注释：示例「黄油体字效」——主路径由模型画字；叠字兜底用圆角无衬线 */
  cheeseNeon: {
    id: 'cheeseNeon',
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
    fontWeight: 400,
    fill: '#FFE566',
    stroke: '#2B6CFF',
    strokeRatio: 0.1,
    shadowColor: 'rgba(255, 214, 70, 0.55)',
    shadowBlurRatio: 0.28,
    shadowOffsetYRatio: 0,
  },
};

const DISPLAY_FONT =
  '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const SANS_FONT = '"PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif';
const SERIF_FONT = '"Noto Serif SC", "Songti SC", "PingFang SC", "Microsoft YaHei", serif';

const COLOR_TABLE: Array<{ re: RegExp; hex: string }> = [
  { re: /金黄|金色|金/, hex: '#FFD700' },
  { re: /黄/, hex: '#FFE566' },
  { re: /白/, hex: '#FFFFFF' },
  { re: /红|粉/, hex: '#FF6B8A' },
  { re: /橙/, hex: '#FF9F43' },
  { re: /绿|青/, hex: '#5CFF9A' },
  { re: /紫/, hex: '#C084FC' },
  { re: /蓝/, hex: '#2B6CFF' },
  { re: /黑/, hex: '#111111' },
];

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return `rgba(255,214,70,${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function pickColor(segment: string, fallback: string): string {
  for (const row of COLOR_TABLE) {
    if (row.re.test(segment)) return row.hex;
  }
  return fallback;
}

/** 功能注释：提示词是否在约束标题字体/颜色（而非纯画面描述） */
export function promptHasTitleStyleRequest(prompt?: string | null): boolean {
  const text = String(prompt || '');
  if (!text.trim()) return false;
  return /标题|字体|字号|描边|外发光|发光|奶酪|黄油|艺术字|手写|卡通字|宋体|黑体|楷体|黄字|白字|红字|霓虹标题|颜色/.test(text);
}

export function resolvePosterTitleStyle(id?: string | null): PosterTitleStyle {
  const key = String(id || '').trim();
  if (key === 'cheeseNeon') return { ...STYLE_MAP.cheeseNeon };
  return { ...STYLE_MAP.classic };
}

/**
 * 功能注释：从提示词解析标题叠字样式；无标题样式意图时返回 null，交给示例预设。
 */
export function parsePosterTitleStyleFromPrompt(prompt?: string | null): PosterTitleStyle | null {
  const text = String(prompt || '');
  if (!promptHasTitleStyleRequest(text)) return null;

  const base = /奶酪|黄油|艺术字|手写|卡通|霓虹/.test(text)
    ? { ...STYLE_MAP.cheeseNeon }
    : /宋体|衬线|经典白/.test(text)
      ? { ...STYLE_MAP.classic }
      : { ...STYLE_MAP.cheeseNeon };

  let fontFamily = base.fontFamily;
  let fontWeight = base.fontWeight;
  if (/奶酪|黄油|艺术字|手写|卡通/.test(text)) {
    fontFamily = DISPLAY_FONT;
    fontWeight = 400;
  } else if (/黑体|无衬线|粗体/.test(text)) {
    fontFamily = SANS_FONT;
    fontWeight = 700;
  } else if (/宋体|衬线/.test(text)) {
    fontFamily = SERIF_FONT;
    fontWeight = 700;
  }

  let fill = base.fill;
  // 功能注释：兼容「白字 / 字体白色 / 白色字体」等说法，勿把描边色当填色
  const explicitFill = text.match(/(黄字|白字|红字|金字|黑字|粉字|橙字|绿字|青字|紫字|蓝字)/);
  if (explicitFill) {
    fill = pickColor(explicitFill[1], fill);
  } else {
    const fontColorFirst = text.match(
      /(?:字体|字色|标题色|文字颜色|字的颜色|颜色)[^。；、,\n]{0,6}?(黄|金黄|金色|金|白|红|粉|橙|绿|青|紫|蓝|黑)色?/,
    );
    const colorThenFont = text.match(
      /(黄|金黄|金色|金|白|红|粉|橙|绿|青|紫|蓝|黑)色?(?:的)?(?:字体|字)/,
    );
    const colorWord = fontColorFirst?.[1] || colorThenFont?.[1];
    if (colorWord) {
      fill = pickColor(colorWord, fill);
    }
  }

  let stroke: string | null = base.stroke;
  let strokeRatio = base.strokeRatio;
  // 功能注释：否定词优先，避免「不要描边」命中描边分支
  if (/无描边|不要描边|别描边|取消描边/.test(text)) {
    stroke = null;
    strokeRatio = 0;
  } else if (/描边/.test(text)) {
    strokeRatio = Math.max(strokeRatio, 0.1);
    // 功能注释：色词须紧贴「描边」，避免「黄色…蓝色描边」误取黄
    const strokeMatch = text.match(/((?:黄|金|白|红|粉|橙|绿|青|紫|蓝|黑)色?)描边|描边((?:黄|金|白|红|粉|橙|绿|青|紫|蓝|黑)色?)/);
    const strokeColorWord = strokeMatch?.[1] || strokeMatch?.[2] || '蓝';
    stroke = pickColor(strokeColorWord, '#2B6CFF');
  }

  let shadowColor = base.shadowColor;
  let shadowBlurRatio = base.shadowBlurRatio;
  let shadowOffsetYRatio = base.shadowOffsetYRatio;
  if (/外发光|发光|霓虹/.test(text)) {
    shadowColor = hexToRgba(fill, 0.7);
    shadowBlurRatio = 0.32;
    shadowOffsetYRatio = 0;
  } else if (/无发光|不要发光|海报风|海报风格/.test(text)) {
    shadowColor = 'rgba(0,0,0,0.4)';
    shadowBlurRatio = 0.18;
    shadowOffsetYRatio = 0.06;
  } else if (fill !== base.fill) {
    // 功能注释：字色被改写后，同步轻外发光，避免仍黄晕 / WordArt
    shadowColor = hexToRgba(fill, 0.45);
    shadowBlurRatio = Math.min(shadowBlurRatio, 0.28);
  }

  return {
    id: 'custom',
    fontFamily,
    fontWeight,
    fill,
    stroke,
    strokeRatio,
    shadowColor,
    shadowBlurRatio,
    shadowOffsetYRatio,
    fromPrompt: true,
  };
}

/**
 * 功能注释：示例预设 + 提示词覆盖。提示词有标题样式要求时优先提示词。
 */
export function resolveEffectivePosterTitleStyle(options: {
  presetId?: string | null;
  prompt?: string | null;
}): PosterTitleStyle {
  const fromPrompt = parsePosterTitleStyleFromPrompt(options.prompt);
  if (fromPrompt) return fromPrompt;
  return resolvePosterTitleStyle(options.presetId);
}

/** @deprecated 用 resolveEffectivePosterTitleStyle；保留给旧调用 */
export function inferPosterTitleStyleIdFromPrompt(prompt?: string | null): 'classic' | 'cheeseNeon' {
  const parsed = parsePosterTitleStyleFromPrompt(prompt);
  if (!parsed) return 'classic';
  if (parsed.fontFamily.includes('Noto Serif') && parsed.fill === '#ffffff' && !parsed.stroke) {
    return 'classic';
  }
  return 'cheeseNeon';
}
