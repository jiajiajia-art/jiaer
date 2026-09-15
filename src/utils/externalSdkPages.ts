export interface ExternalAuthorizeParams {
  appId: string;
  redirectUri: string;
  externalUserId: string;
  state: string;
  valid: boolean;
  error: string;
}

export interface ExternalRechargeParams {
  sessionId: string;
  valid: boolean;
  error: string;
}

export interface DeveloperCliAuthorizeParams {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  valid: boolean;
  error: string;
}

export type ExternalRechargeDisplayState = 'missing' | 'ready' | 'paying' | 'paid' | 'expired' | 'failed';

export interface ExternalRechargeSessionLike {
  status?: string | null;
  expiresAt?: string | null;
  payment?: {
    status?: string | null;
  } | null;
}

const trimParam = (params: URLSearchParams, key: string): string => (params.get(key) || '').trim();

export function parseExternalAuthorizeParams(params: URLSearchParams): ExternalAuthorizeParams {
  const appId = trimParam(params, 'appId');
  const redirectUri = trimParam(params, 'redirectUri');
  const externalUserId = trimParam(params, 'externalUserId');
  const state = trimParam(params, 'state');
  if (!appId) {
    return { appId, redirectUri, externalUserId, state, valid: false, error: 'missing_app_id' };
  }
  if (!redirectUri) {
    return { appId, redirectUri, externalUserId, state, valid: false, error: 'missing_redirect_uri' };
  }
  return { appId, redirectUri, externalUserId, state, valid: true, error: '' };
}

export function parseExternalRechargeParams(params: URLSearchParams): ExternalRechargeParams {
  const sessionId = trimParam(params, 'sessionId');
  if (!sessionId) {
    return { sessionId, valid: false, error: 'missing_session_id' };
  }
  return { sessionId, valid: true, error: '' };
}

export function parseDeveloperCliAuthorizeParams(params: URLSearchParams): DeveloperCliAuthorizeParams {
  const redirectUri = trimParam(params, 'redirectUri');
  const state = trimParam(params, 'state');
  const codeChallenge = trimParam(params, 'codeChallenge');
  if (!redirectUri) {
    return { redirectUri, state, codeChallenge, valid: false, error: 'missing_redirect_uri' };
  }
  if (!state) {
    return { redirectUri, state, codeChallenge, valid: false, error: 'missing_state' };
  }
  if (!codeChallenge) {
    return { redirectUri, state, codeChallenge, valid: false, error: 'missing_code_challenge' };
  }
  return { redirectUri, state, codeChallenge, valid: true, error: '' };
}

export function getRechargeDisplayState(
  session: ExternalRechargeSessionLike | null | undefined,
  now: Date = new Date(),
): ExternalRechargeDisplayState {
  if (!session) return 'missing';
  const status = String(session.status || '').toLowerCase();
  const paymentStatus = String(session.payment?.status || '').toLowerCase();
  if (status === 'paid' || paymentStatus === 'paid') return 'paid';
  if (status === 'expired') return 'expired';
  if (status === 'failed' || paymentStatus === 'failed' || paymentStatus === 'cancelled') return 'failed';
  if (session.expiresAt && Date.parse(session.expiresAt) <= now.getTime()) return 'expired';
  if (status === 'pending' || paymentStatus === 'pending') return 'paying';
  return 'ready';
}

export function buildExternalReturnUrl(
  returnUrl: string | null | undefined,
  result: { sessionId: string; status: string; outTradeNo?: string | null },
): string {
  const raw = String(returnUrl || '').trim();
  if (!raw) return '';
  try {
    const next = new URL(raw);
    next.searchParams.set('funloomSessionId', result.sessionId);
    next.searchParams.set('funloomStatus', result.status);
    if (result.outTradeNo) {
      next.searchParams.set('funloomOutTradeNo', result.outTradeNo);
    }
    return next.toString();
  } catch {
    return '';
  }
}
