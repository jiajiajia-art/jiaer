/**
 * 推广链接使用当前站点 origin + /funloom/game/{fileId}?promo={code}
 * 与 vite base、BrowserRouter basename 保持一致。
 */
export function buildGamePromotionLink(gameFileId: string, promotionCode: string): string {
    const origin = typeof window !== 'undefined'
        ? window.location.origin.replace(/\/+$/, '')
        : '';
    const fileId = encodeURIComponent(String(gameFileId || '').trim());
    const code = encodeURIComponent(String(promotionCode || '').trim());
    return `${origin}/funloom/game/${fileId}?promo=${code}`;
}
