/** localStorage 键：未登录访客在点击推广链、注册前的稳定匿名 ID，用于跨会话归因 */
const PROMO_ANON_STORAGE_KEY = 'game_promotion_anon_id';

/** 获取或创建推广归因用 anonId（与 SignupRequest.promoAnonId、consume-pending 一致） */
export function getOrCreatePromoAnonId(): string {
    try {
        const existing = localStorage.getItem(PROMO_ANON_STORAGE_KEY);
        if (existing && existing.trim().length >= 8) {
            return existing.trim();
        }
    } catch {
        // ignore storage errors
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const anonId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    try {
        localStorage.setItem(PROMO_ANON_STORAGE_KEY, anonId);
    } catch {
        // ignore storage errors
    }
    return anonId;
}
