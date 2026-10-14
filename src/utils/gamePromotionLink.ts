import { appPath } from '../lib/appBasePath';

/**
 * 推广链接：origin + {base}/game/{fileId}?promo={code}
 * 与 Vite base、BrowserRouter basename 保持一致。
 */
export function buildGamePromotionLink(gameFileId: string, promotionCode: string): string {
    const origin = typeof window !== 'undefined'
        ? window.location.origin.replace(/\/+$/, '')
        : '';
    const fileId = encodeURIComponent(String(gameFileId || '').trim());
    const code = encodeURIComponent(String(promotionCode || '').trim());
    return `${origin}${appPath(`game/${fileId}`)}?promo=${code}`;
}
