export const REGISTRATION_CODE_REQUEST_TIMEOUT_MS = 15_000;
export const REGISTRATION_SUBMIT_TIMEOUT_MS = 20_000;

export function isRegistrationRequestTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate.code || '').toUpperCase();
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
  return /timeout/i.test(String(candidate.message || ''));
}
