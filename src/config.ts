export const ON_SERVER: boolean = import.meta.env.PROD;

/**
 * 功能注释：API 根地址。
 * - 优先 VITE_API_BASE_URL（一键部署 / CI 注入）
 * - 开发未设置时留空 → Vite 同源代理 /api
 * - 兼容旧本地注释预设时可临时硬编码覆盖
 */
function resolveHostAddress(): string {
  const fromEnv = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (!import.meta.env.PROD) return '';
  // 功能注释：Aliyun 同源 Nginx 反代（含 gogo/neo/qqq 子域）用空基址 → 请求当前域名 /api
  if (String(import.meta.env.VITE_RUNTIME || '').trim().toLowerCase() === 'aliyun') {
    return '';
  }
  // CF 等生产构建若未注入 env，回退 Cloudflare API（避免打到错误环境）
  return 'https://api.kurangames.com';
}

export const HOST_ADDRESS = resolveHostAddress();

/**
 * 功能注释：静态资源（/public、/uploads）主机。
 * Aliyun cn-test 的 VITE_API_BASE_URL 带 /cn-test-api，若原样拼到图片会变成
 * /cn-test-api/public/...（nginx 未反代）导致全站图裂；资源走站点根路径。
 */
export function resolveAssetHostAddress(apiBase: string = HOST_ADDRESS): string {
  return String(apiBase || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/cn-test-api$/i, '');
}

export const ASSET_HOST_ADDRESS = resolveAssetHostAddress();

// 本地联调后端：改 devApiPresets.ts 的 ACTIVE_DEV_API
// 构建部署：用 deploy profile 的 VITE_API_BASE_URL（勿在此硬编码）

export const RECORD_CONVERSION = import.meta.env.PROD
  ? true
  : import.meta.env.VITE_RECORD_CONVERSION === 'true';

// Language default: Simplified Chinese. Runtime switch via Navbar (zh / zh-TW / en).
export const LANGUAGE: 'zh' | 'zh-TW' | 'en' = 'zh';
