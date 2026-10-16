import { api } from '../api/base';

export type RegistrationAnalyticsEvent =
  | 'registration_enter'
  | 'registration_exit'
  | 'registration_mode_switch'
  | 'registration_code_send'
  | 'registration_submit'
  | 'registration_success'
  | 'registration_failure';

const REGISTRATION_SESSION_KEY = 'funloom_registration_session_id';

function createRegistrationSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `registration-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateRegistrationSessionId(): string {
  if (typeof sessionStorage === 'undefined') return createRegistrationSessionId();
  try {
    const existing = sessionStorage.getItem(REGISTRATION_SESSION_KEY);
    if (existing) return existing;
    const created = createRegistrationSessionId();
    sessionStorage.setItem(REGISTRATION_SESSION_KEY, created);
    return created;
  } catch {
    return createRegistrationSessionId();
  }
}

export function clearRegistrationSessionId(): void {
  try {
    sessionStorage.removeItem(REGISTRATION_SESSION_KEY);
  } catch {}
}

export function trackRegistrationEvent(
  eventType: RegistrationAnalyticsEvent,
  sessionId = getOrCreateRegistrationSessionId(),
): void {
  void api.post('/analytics/registration-event', { eventType, sessionId }, { timeout: 3_000 }).catch(() => {});
}
