/** 纯文本简介长度上限（用户可见字数） */
export const NOVEL_DESCRIPTION_MAX_LENGTH = 300;

/** 存库 HTML 体积上限（含标签与图片 URL，不新增字段） */
export const NOVEL_DESCRIPTION_HTML_MAX_LENGTH = 12000;

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'DIV',
  'SPAN',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'UL',
  'OL',
  'LI',
  'IMG',
  'A',
]);

function decodeBasicEntities(text: string): string {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
}

export function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

/** 从简介（纯文本或 HTML）提取纯文本，用于字数校验与旧数据展示回退 */
export function descriptionToPlainText(value: string): string {
  const raw = String(value || '');
  if (!raw.trim()) return '';
  if (!looksLikeHtml(raw)) {
    return raw.replace(/\r\n/g, '\n').trim();
  }
  return decodeBasicEntities(
    raw
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function plainTextToHtml(text: string): string {
  const normalized = String(text || '').replace(/\r\n/g, '\n');
  if (!normalized.trim()) return '';
  return normalized
    .split('\n')
    .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('');
}

function isSafeUrl(url: string): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  if (value.startsWith('/public/') || value.startsWith('/uploads/')) return true;
  if (/^https?:\/\//i.test(value)) return true;
  return false;
}

/** 存库时把绝对资源域名还原为 /public/... 相对路径 */
export function normalizeDescriptionImageSrc(src: string, hostAddress = ''): string {
  const raw = String(src || '').trim();
  if (!raw) return '';
  const host = String(hostAddress || '').replace(/\/$/, '');
  if (host && raw.startsWith(host)) {
    const sliced = raw.slice(host.length);
    return sliced.startsWith('/') ? sliced : `/${sliced}`;
  }
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      if (u.pathname.startsWith('/public/') || u.pathname.startsWith('/uploads/')) {
        return `${u.pathname}${u.search || ''}`;
      }
    }
  } catch {
    // ignore
  }
  return raw;
}

/** 展示时把相对 /public 路径交给 resolveUrl（如 getImageUrl） */
export function resolveDescriptionImageSrc(
  src: string,
  resolveUrl: (path: string) => string,
): string {
  const raw = String(src || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('/public/') || raw.startsWith('/uploads/')) {
    return resolveUrl(raw) || raw;
  }
  return raw;
}

export function rewriteDescriptionImageSrcs(
  html: string,
  rewriteSrc: (src: string) => string,
): string {
  const raw = String(html || '');
  if (!raw || !/<img\b/i.test(raw)) return raw;
  if (typeof DOMParser === 'undefined') {
    return raw.replace(/\ssrc\s*=\s*(['"])(.*?)\1/gi, (_m, quote, src) => {
      const next = rewriteSrc(String(src || ''));
      return ` src=${quote}${next}${quote}`;
    });
  }
  try {
    const doc = new DOMParser().parseFromString(`<div id="__desc_root">${raw}</div>`, 'text/html');
    const root = doc.getElementById('__desc_root');
    if (!root) return raw;
    for (const img of Array.from(root.querySelectorAll('img'))) {
      const src = img.getAttribute('src') || '';
      const next = rewriteSrc(src);
      if (next) img.setAttribute('src', next);
      else img.removeAttribute('src');
    }
    return root.innerHTML;
  } catch {
    return raw;
  }
}

export function normalizeDescriptionHtmlForSave(html: string, hostAddress = ''): string {
  const cleaned = sanitizeDescriptionHtml(html);
  return rewriteDescriptionImageSrcs(cleaned, (src) => normalizeDescriptionImageSrc(src, hostAddress));
}

export function hydrateDescriptionHtmlForDisplay(
  html: string,
  resolveUrl: (path: string) => string,
): string {
  const cleaned = sanitizeDescriptionHtml(html);
  return rewriteDescriptionImageSrcs(cleaned, (src) => resolveDescriptionImageSrc(src, resolveUrl));
}

function cleanAttributes(el: Element): void {
  const tag = el.tagName.toUpperCase();
  const allowed = new Set<string>();
  if (tag === 'IMG') {
    allowed.add('src');
    allowed.add('alt');
  } else if (tag === 'A') {
    allowed.add('href');
    allowed.add('target');
    allowed.add('rel');
  }

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || !allowed.has(name)) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name === 'src' || name === 'href') {
      if (!isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    if (name === 'target') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  }

  if (tag === 'IMG' && !el.getAttribute('src')) {
    el.remove();
  }
  if (tag === 'A' && !el.getAttribute('href')) {
    // unwrap link text
    const parent = el.parentNode;
    if (parent) {
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
  }
}

function sanitizeElement(root: Element): void {
  const walker = Array.from(root.querySelectorAll('*'));
  for (const el of walker) {
    const tag = el.tagName.toUpperCase();
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
      continue;
    }
    cleanAttributes(el);
  }
}

/** 正则回退（无 DOM 环境，如单测） */
export function sanitizeDescriptionHtmlRegex(html: string): string {
  let out = String(html || '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  out = out.replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '');
  out = out.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  out = out.replace(/javascript:/gi, '');
  // drop disallowed tags but keep inner text
  out = out.replace(/<\/?(?!\/?(?:p|br|div|span|b|strong|i|em|u|ul|ol|li|img|a)\b)[a-z][^>]*>/gi, '');
  return out.trim();
}

export function sanitizeDescriptionHtml(html: string): string {
  const raw = String(html || '').trim();
  if (!raw) return '';
  if (typeof DOMParser === 'undefined') {
    return sanitizeDescriptionHtmlRegex(raw);
  }
  try {
    const doc = new DOMParser().parseFromString(`<div id="__desc_root">${raw}</div>`, 'text/html');
    const root = doc.getElementById('__desc_root');
    if (!root) return sanitizeDescriptionHtmlRegex(raw);
    sanitizeElement(root);
    return root.innerHTML.trim();
  } catch {
    return sanitizeDescriptionHtmlRegex(raw);
  }
}

/** 加载进编辑器：旧纯文本 → 段落 HTML；已有 HTML → 消毒 */
export function toEditorHtml(raw: string): string {
  const value = String(raw || '');
  if (!value.trim()) return '';
  if (looksLikeHtml(value)) return sanitizeDescriptionHtml(value);
  return plainTextToHtml(value);
}

/** 保存前归一化：输出可入库的安全 HTML（空则 ''） */
export function normalizeDescriptionForSave(raw: string, hostAddress = ''): string {
  const html = normalizeDescriptionHtmlForSave(toEditorHtml(raw), hostAddress);
  if (!html.trim()) return '';
  // 去掉无内容空壳
  const plain = descriptionToPlainText(html);
  if (!plain && !/<img\b/i.test(html)) return '';
  return html;
}

export function validateDescriptionContent(raw: string, options?: { required?: boolean }): {
  valid: boolean;
  error?: 'DESCRIPTION_REQUIRED' | 'DESCRIPTION_TOO_LONG' | 'DESCRIPTION_HTML_TOO_LONG';
  plainLength: number;
  html: string;
} {
  const html = normalizeDescriptionForSave(raw);
  const plain = descriptionToPlainText(html);
  const plainLength = Array.from(plain).length;
  const required = options?.required !== false;

  if (required && !plain && !/<img\b/i.test(html)) {
    return { valid: false, error: 'DESCRIPTION_REQUIRED', plainLength: 0, html: '' };
  }
  if (plainLength > NOVEL_DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: 'DESCRIPTION_TOO_LONG', plainLength, html };
  }
  if (html.length > NOVEL_DESCRIPTION_HTML_MAX_LENGTH) {
    return { valid: false, error: 'DESCRIPTION_HTML_TOO_LONG', plainLength, html };
  }
  return { valid: true, plainLength, html };
}
