/**
 * 功能注释：外置隐私政策页路径与注册勾选校验。
 * 静态页落在 public/privacyPolicy，经 Vite base（/funloom/）对外提供，供注册弹窗链接与应用商店填写。
 */

/** 相对站点根的隐私政策路径（不含 base） */
export const PRIVACY_POLICY_PATH = 'privacyPolicy/index.html';

/**
 * 功能注释：拼出可在新标签打开的隐私政策绝对/站内 URL；
 * 开发态走当前 origin + Vite base，生产同理。
 */
export function resolvePrivacyPolicyUrl(options?: {
  origin?: string;
  base?: string;
  darkMode?: boolean;
}): string {
  const origin = (options?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const rawBase = options?.base
    ?? (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/');
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
  const path = `${base}${PRIVACY_POLICY_PATH}`.replace(/\/{2,}/g, '/');
  const url = origin ? `${origin}${path}` : path;
  if (options?.darkMode) {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}darkmode=1&darkStyle=1`;
  }
  return url;
}

/** 功能注释：注册提交前必须勾选同意隐私政策 */
export function isPrivacyAgreementAccepted(agreed: boolean | null | undefined): boolean {
  return agreed === true;
}
