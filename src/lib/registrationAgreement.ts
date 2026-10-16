export const REGISTRATION_AGREEMENT_VERSION = '2026-10-20';
export const REGISTRATION_PRIVACY_POLICY_VERSION = '2026-10-20';

export type RegistrationLegalDocument = 'user-agreement' | 'privacy-policy';

export function resolveRegistrationAgreementUrl(
  document: RegistrationLegalDocument,
  options?: { origin?: string; base?: string },
): string {
  const origin = (options?.origin ?? (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  const rawBase = options?.base
    ?? (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
      ? String(import.meta.env.BASE_URL)
      : '/');
  const base = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const path = `${normalizedBase}legal/${document}`.replace(/\/{2,}/g, '/');
  return origin ? `${origin}${path}` : path;
}

export const USER_AGREEMENT_URL = resolveRegistrationAgreementUrl('user-agreement');

export function isRegistrationAgreementAccepted(accepted: boolean | null | undefined): boolean {
  return accepted === true;
}

