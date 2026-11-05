export const REGISTRATION_AGREEMENT_VERSION = '2026-10-20';
export const REGISTRATION_PRIVACY_POLICY_VERSION = '2026-10-20';
const LOGIN_AGREEMENT_STORAGE_KEY = 'funloom-login-agreement-consent';
const PENDING_GOOGLE_LOGIN_AGREEMENT_STORAGE_KEY = 'funloom-google-login-agreement-pending';

type LoginAgreementRecord = {
  userAgreementVersion?: string;
  privacyPolicyVersion?: string;
};

export type RegistrationLegalDocument = 'user-agreement' | 'privacy-policy';
export type RegistrationLegalLanguage = 'zh' | 'en';

export function resolveRegistrationAgreementUrl(
  document: RegistrationLegalDocument,
  options?: { origin?: string; base?: string; language?: RegistrationLegalLanguage },
): string {
  const origin = (options?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const rawBase = options?.base
    ?? (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/');
  const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const path = `${normalizedBase}legal/${document}`.replace(/\/{2,}/g, '/');
  const languageQuery = options?.language ? `?lang=${encodeURIComponent(options.language)}` : '';
  return origin ? `${origin}${path}${languageQuery}` : `${path}${languageQuery}`;
}

export const USER_AGREEMENT_URL = resolveRegistrationAgreementUrl('user-agreement');

export function isRegistrationAgreementAccepted(accepted: boolean | null | undefined): boolean {
  return accepted === true;
}

function isCurrentLoginAgreement(record: LoginAgreementRecord): boolean {
  return record.userAgreementVersion === REGISTRATION_AGREEMENT_VERSION
    && record.privacyPolicyVersion === REGISTRATION_PRIVACY_POLICY_VERSION;
}

function getLoginAgreementStorageKey(subject: string): string | null {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject) return null;
  return `${LOGIN_AGREEMENT_STORAGE_KEY}:${encodeURIComponent(normalizedSubject)}`;
}

export function markLoginAgreementAccepted(subject: string): void {
  if (typeof window === 'undefined') return;
  const storageKey = getLoginAgreementStorageKey(subject);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
      privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
    }));
  } catch {
    // 本地存储不可用时，后续自动登录回退到重新确认协议。
  }
}

export function hasCurrentLoginAgreementAccepted(subject: string): boolean {
  if (typeof window === 'undefined') return false;
  const storageKey = getLoginAgreementStorageKey(subject);
  if (!storageKey) return false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return false;
    return isCurrentLoginAgreement(JSON.parse(raw) as LoginAgreementRecord);
  } catch {
    return false;
  }
}

export function markPendingGoogleLoginAgreementAccepted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_GOOGLE_LOGIN_AGREEMENT_STORAGE_KEY, JSON.stringify({
      userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
      privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
    }));
  } catch {
    // The redirect result will require confirmation again if session storage is unavailable.
  }
}

export function clearPendingGoogleLoginAgreementAccepted(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_AGREEMENT_STORAGE_KEY);
  } catch {
    // A failed redirect cannot reuse the intent when session storage is unavailable.
  }
}

export function consumePendingGoogleLoginAgreementAccepted(subject: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(PENDING_GOOGLE_LOGIN_AGREEMENT_STORAGE_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(PENDING_GOOGLE_LOGIN_AGREEMENT_STORAGE_KEY);
    if (!isCurrentLoginAgreement(JSON.parse(raw) as LoginAgreementRecord)) return false;
    markLoginAgreementAccepted(subject);
    return hasCurrentLoginAgreementAccepted(subject);
  } catch {
    return false;
  }
}

export function hasCurrentHostLoginAgreementAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  const hostWindow = window as typeof window & {
    __funloom_agreement_accepted?: boolean;
    __funloom_user_agreement_version?: string;
    __funloom_privacy_policy_version?: string;
  };
  return hostWindow.__funloom_agreement_accepted === true
    && hostWindow.__funloom_user_agreement_version === REGISTRATION_AGREEMENT_VERSION
    && hostWindow.__funloom_privacy_policy_version === REGISTRATION_PRIVACY_POLICY_VERSION;
}

