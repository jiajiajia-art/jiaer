/**
 * 功能注释：全站语言码与持久化。默认简体 zh；支持英文 en、繁体 zh-TW、日语 ja。
 */
export const APP_LANGUAGE_STORAGE_KEY = 'funloom.language';
/** 功能注释：用户在语言弹窗里亲手选过；有此标记时进站不再用 IP 覆盖 */
export const APP_LANGUAGE_USER_CHOICE_KEY = 'funloom.language.userChoice';

export type AppLanguageCode = 'zh' | 'zh-TW' | 'en' | 'ja';

export type AppLanguageOption = {
  code: AppLanguageCode;
  /**
   * 功能注释：平台化英文名（Steam / Discord / Apple 同款），不随界面语言变，避免「母语名」混排难扫。
   */
  label: string;
  /** 功能注释：母语副标题，列表第二行辅助辨认，仍不随界面语言变 */
  nativeLabel: string;
};

export const APP_LANGUAGE_OPTIONS: readonly AppLanguageOption[] = [
  { code: 'zh', label: 'Chinese (Simplified)', nativeLabel: '简体中文' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', nativeLabel: '繁體中文' },
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
] as const;

export const DEFAULT_APP_LANGUAGE: AppLanguageCode = 'zh';

export function getAppLanguageLabel(code: AppLanguageCode): string {
  return APP_LANGUAGE_OPTIONS.find((item) => item.code === code)?.label
    ?? APP_LANGUAGE_OPTIONS[0].label;
}

/**
 * 功能注释：顶栏语言入口用 ISO 风格英文简称，未登录也可见。
 */
export function getNavbarLanguageTriggerLabel(code: AppLanguageCode): string {
  if (code === 'en') return 'EN';
  if (code === 'zh-TW') return 'ZH-TW';
  if (code === 'ja') return 'JA';
  return 'ZH';
}

/** 功能注释：把浏览器/历史写法归一到支持的语言码 */
export function normalizeAppLanguage(raw: string | null | undefined): AppLanguageCode | null {
  const value = String(raw || '').trim().replace(/_/g, '-');
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'zh' || lower === 'zh-cn' || lower === 'zh-hans' || lower.startsWith('zh-hans')) {
    return 'zh';
  }
  if (
    lower === 'zh-tw'
    || lower === 'zh-hk'
    || lower === 'zh-mo'
    || lower === 'zh-hant'
    || lower.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (lower === 'en' || lower.startsWith('en-')) {
    return 'en';
  }
  if (lower === 'ja' || lower === 'jp' || lower.startsWith('ja-')) {
    return 'ja';
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

/** 功能注释：是否由用户主动选定语言。未选过时才允许 IP 区域写入默认语言。 */
export function hasUserLanguageChoice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(APP_LANGUAGE_USER_CHOICE_KEY) === '1';
  } catch {
    return false;
  }
}

function persistUserLanguageChoice(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APP_LANGUAGE_USER_CHOICE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
}

/** 功能注释：切换语言并写入本地。userChoice 为真时刷新后不再被 IP 覆盖。 */
export async function applyAppLanguage(
  code: AppLanguageCode,
  changeLanguage: (lng: string) => Promise<unknown>,
  options?: { userChoice?: boolean },
): Promise<AppLanguageCode> {
  const next = normalizeAppLanguage(code) ?? DEFAULT_APP_LANGUAGE;
  persistAppLanguage(next);
  if (options?.userChoice) persistUserLanguageChoice();
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
