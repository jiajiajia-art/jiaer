import i18n from '../i18n';

/**
 * Handles axios error responses, standard Error objects, and unknown errors.
 * 并清洗上游 LLM/生图网关脏文案（JSON、美元额度等），避免直接弹给玩家。
 */
export function sanitizeUpstreamLlmErrorMessage(
  raw: string,
  fallback = '操作失败，请稍后重试',
): string {
  const text = String(raw || '').trim();
  if (!text) return fallback;
  if (
    /insufficient_user_quota|预扣费额度失败|剩余额度\s*[：:＄$]|rix_api_error/i.test(text)
    || (/OpenAI API error:\s*403/i.test(text) && /quota|额度/i.test(text))
  ) {
    return 'AI 服务额度不足，请稍后重试或联系管理员';
  }
  if (/OpenAI API error:\s*40[13]/i.test(text)) {
    return 'AI 服务暂时不可用，请稍后重试';
  }
  // 功能注释：整段 JSON 错误体不适合 Toast
  if (/^\s*\{[\s\S]*"error"\s*:/.test(text) || /"type"\s*:\s*"rix_api_error"/.test(text)) {
    return fallback;
  }
  return text;
}

/**
 * 功能注释：生图接口用 responseType=blob 时，500 的 JSON 错误体会变成 Blob，
 * 直接读 .message 会得到 undefined，最终被误报成「人数过多」。
 */
export async function extractBlobErrorMessage(blob: Blob | undefined): Promise<string | null> {
  if (!blob || typeof blob.text !== 'function') return null;
  try {
    const text = (await blob.text()).trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      // 功能注释：旧 handler 把真实原因放 error、message 写死 Failed…，优先 error
      const msg = String(parsed?.error || parsed?.message || '').trim();
      return msg || null;
    } catch {
      return text.slice(0, 240) || null;
    }
  } catch {
    return null;
  }
}

/**
 * 功能注释：兼容普通 JSON 错误体与 blob 错误体，供角色/场景生图 catch 使用。
 */
export async function getAxiosErrorMessageAsync(
  error: unknown,
  fallback = '生成失败',
): Promise<string> {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: { data?: Blob | { message?: string; error?: string } };
      message?: string;
    };
    const data = axiosError.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const fromBlob = await extractBlobErrorMessage(data);
      if (fromBlob) return sanitizeUpstreamLlmErrorMessage(fromBlob, fallback);
    } else if (data && typeof data === 'object') {
      const raw = (data as { message?: string; error?: string }).error
        || (data as { message?: string; error?: string }).message;
      if (raw) return sanitizeUpstreamLlmErrorMessage(String(raw), fallback);
    }
    if (axiosError.message) {
      return sanitizeUpstreamLlmErrorMessage(axiosError.message, fallback);
    }
  }
  if (error instanceof Error && error.message) {
    return sanitizeUpstreamLlmErrorMessage(error.message, fallback);
  }
  return fallback;
}

/** 功能注释：处罚/风控/申诉业务码；有 message 优先，否则按当前语言取短文案 */
const PUNISHMENT_ERROR_KEYS: Record<string, string> = {
    publish_blocked: 'apiErrors.publishBlocked',
    creator_frozen: 'apiErrors.creatorFrozen',
    publish_need_review: 'apiErrors.publishNeedReview',
    login_banned: 'apiErrors.loginBanned',
    ban_login_forbidden: 'apiErrors.banLoginForbidden',
    appeal_window_expired: 'apiErrors.appealWindowExpired',
    duplicate_appeal: 'apiErrors.duplicateAppeal',
    already_revoked: 'apiErrors.alreadyRevoked',
    invalid_evidence: 'apiErrors.invalidEvidence',
    admin_required: 'apiErrors.adminRequired',
};

/** 功能注释：举报码优先本地文案（对象级 pending 互斥等），覆盖后端旧「仅本人」message */
const REPORT_ERROR_KEYS: Record<string, string> = {
    duplicate_pending: 'apiErrors.duplicatePending',
    already_upheld: 'apiErrors.alreadyUpheld',
    report_cooldown: 'apiErrors.reportCooldown',
    cannot_report_self: 'apiErrors.cannotReportSelf',
    target_not_found: 'apiErrors.targetNotFound',
    invalid_reason: 'apiErrors.invalidReason',
};

const API_ERROR_KEYS: Record<string, string> = {
    ...PUNISHMENT_ERROR_KEYS,
    ...REPORT_ERROR_KEYS,
};

export function messageForApiCode(code?: string | null): string | null {
    const key = code ? API_ERROR_KEYS[code] : '';
    if (!key) return null;
    return i18n.t(key);
}

export const getApiErrorMessage = (
    error: unknown,
    fallback: string
): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as {
            response?: { data?: { message?: string; error?: string; code?: string } };
        };
        const data = axiosError.response?.data;
        // 功能注释：同步路径遇 Blob 无法 await，回落 fallback，避免再读出 [object Blob]
        if (typeof Blob !== 'undefined' && data instanceof Blob) {
            return fallback;
        }
        const code = typeof data?.code === 'string' ? data.code : '';
        // 功能注释：举报业务码用前端文案，不依赖后端是否已改对象互斥文案
        if (code && REPORT_ERROR_KEYS[code]) {
            const coded = messageForApiCode(code);
            if (coded) return coded;
        }
        const raw = data?.message || data?.error || '';
        if (raw) {
            return sanitizeUpstreamLlmErrorMessage(String(raw), fallback);
        }
        const coded = messageForApiCode(code);
        if (coded) return coded;
        return fallback;
    }
    if (error instanceof Error && error.message) {
        return sanitizeUpstreamLlmErrorMessage(error.message, fallback);
    }
    return fallback;
};

export const getApiErrorCode = (error: unknown): string | null => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null;
    const data = (error as { response?: { data?: { code?: string } } }).response?.data;
    return typeof data?.code === 'string' ? data.code : null;
};
