/**
 * 功能注释：消息 WS 地址与 HTTP API 对齐。
 * - HOST 为绝对 URL → 直连该主机
 * - HOST 为空 → 浏览器同源 /api（本机 Vite 代理、Aliyun Nginx 反代）
 * 禁止 Aliyun 空 HOST 时回落到 api-test2（生产/gogo 曾因此连错环境）。
 */

export function buildMessageRealtimeWebSocketUrl(options: {
  token: string;
  hostAddress: string;
  pageProtocol?: string;
  pageHost?: string;
}): string {
  const token = String(options.token || '').trim();
  const host = String(options.hostAddress || '').trim();
  const pageProtocol = String(options.pageProtocol || '').trim();
  const pageHost = String(options.pageHost || '').trim();

  if (/^https?:\/\//i.test(host)) {
    const base = host.replace(/^http/i, 'ws');
    const url = new URL('/api/auth/messages/ws', base.endsWith('/') ? base : `${base}/`);
    if (token) url.searchParams.set('token', token);
    return url.toString();
  }

  if (pageHost) {
    const protocol =
      pageProtocol === 'https:' || pageProtocol === 'https'
        ? 'wss:'
        : pageProtocol === 'wss:' || pageProtocol === 'ws:'
          ? pageProtocol
          : 'ws:';
    const url = new URL(`${protocol}//${pageHost}/api/auth/messages/ws`);
    if (token) url.searchParams.set('token', token);
    return url.toString();
  }

  // 无 window 的极端兜底（单测/SSR）；正常浏览器不会走到
  const url = new URL('wss://api.kurangames.com/api/auth/messages/ws');
  if (token) url.searchParams.set('token', token);
  return url.toString();
}
