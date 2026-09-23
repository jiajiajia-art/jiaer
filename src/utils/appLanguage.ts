/**
 * 功能注释：全站语言码与持久化。默认简体 zh；支持英文 en、繁体 zh-TW。
 */
export const APP_LANGUAGE_STORAGE_KEY = 'funloom.language';

export type AppLanguageCode = 'zh' | 'zh-TW' | 'en';

export type AppLanguageOption = {
  code: AppLanguageCode;
  /** 功能注释：固定母语标签，切到任一语言时都能辨认 */
  label: string;
};

export const APP_LANGUAGE_OPTIONS: readonly AppLanguageOption[] = [
  { code: 'zh', label: '简体中文' },
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
] as const;

export const DEFAULT_APP_LANGUAGE: AppLanguageCode = 'zh';

export function getAppLanguageLabel(code: AppLanguageCode): string {
  return APP_LANGUAGE_OPTIONS.find((item) => item.code === code)?.label
    ?? APP_LANGUAGE_OPTIONS[0].label;
}

/**
 * 功能注释：顶栏语言入口简称——简体/繁体/EN，未登录也可见。
 */
export function getNavbarLanguageTriggerLabel(code: AppLanguageCode): string {
  if (code === 'en') return 'EN';
  if (code === 'zh-TW') return '繁体';
  return '简体';
}

/** 功能注释：把浏览器/历史写法归一到三档语言码 */
export function normalizeAppLanguage(raw: string | null | undefined): AppLanguageCode | null {
  const value = String(raw || '').trim().replace(/_/g, '-');
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-hans')) {
    return 'zh';
  }
  if (
    lower === 'zh-tw' ||
    lower === 'zh-hk' ||
    lower === 'zh-mo' ||
    lower === 'zh-hant' ||
    lower.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en';
  }
  return null;
}

export function readStoredAppLanguage(): AppLanguageCode {
  if (typeof window === 'undefined') return DEFAULT_APP_LANGUAGE;
  try {
    return normalizeAppLanguage(window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY))
      ?? DEFAULT_APP_LANGUAGE;
  } catch {
    return DEFAULT_APP_LANGUAGE;
  }
}

export function persistAppLanguage(code: AppLanguageCode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, code);
  } catch {
    // ignore quota / private mode
  }
}

/** 功能注释：切换语言并写入本地，供 Navbar 与其它入口复用 */
export async function applyAppLanguage(
  code: AppLanguageCode,
  changeLanguage: (lng: string) => Promise<unknown>,
): Promise<AppLanguageCode> {
  const next = normalizeAppLanguage(code) ?? DEFAULT_APP_LANGUAGE;
  persistAppLanguage(next);
  await changeLanguage(next);
  return next;
}

/** 功能注释：递归把简体文案树转成繁体，供 zh-TW 资源生成 */
export function mapTranslationTree(
  source: unknown,
  convert: (text: string) => string,
): unknown {
  if (typeof source === 'string') return convert(source);
  if (Array.isArray(source)) {
    return source.map((item) => mapTranslationTree(item, convert));
  }
  if (source && typeof source === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      next[key] = mapTranslationTree(value, convert);
    }
    return next;
  }
  return source;
}
