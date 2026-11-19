import { isAliyunFrontendRuntime } from './aliyunFrontendRuntime';

/**
 * 功能注释：国内 Aliyun 站（cn-prod / cn-test / gogo 等）关闭 Google 登录，
 * 避免启动时拉取 apis.google.com（国内常超时污染控制台且无法完成登录）。
 * 海外 / Cloudflare 构建仍开启。
 */
export function isGoogleAuthEnabled(
  apiBaseUrl: string = String(import.meta.env.VITE_API_BASE_URL || ''),
  runtimeFlag: string = String(import.meta.env.VITE_RUNTIME || ''),
  pageHostname: string = typeof window !== 'undefined'
    ? String(window.location?.hostname || '')
    : '',
): boolean {
  return !isAliyunFrontendRuntime(apiBaseUrl, runtimeFlag, pageHostname);
}
