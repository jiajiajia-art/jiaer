/**
 * 功能注释：判断当前前端构建是否面向阿里云国内站。
 * Cloudflare 构建（api.kurangames.com / *.kurangames.com 页）必须返回 false，避免改动 CF 游玩逻辑。
 */

function resolveDefaultPageHostname(): string {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.location?.hostname || '');
  } catch {
    return '';
  }
}

export function isAliyunFrontendRuntime(
  apiBaseUrl: string = String(import.meta.env.VITE_API_BASE_URL || ''),
  runtimeFlag: string = String(import.meta.env.VITE_RUNTIME || ''),
  pageHostname: string = resolveDefaultPageHostname(),
): boolean {
  if (String(runtimeFlag || '').trim().toLowerCase() === 'aliyun') return true;

  // 功能注释：页面挂在国内域名时直接开兼容（防构建漏注 VITE_* 导致 Aliyun 画布空白）
  const host = String(pageHostname || '').trim().toLowerCase();
  if (
    host === 'kurangames.cn'
    || host.endsWith('.kurangames.cn')
    || host === '47.93.42.104'
  ) {
    return true;
  }

  const base = String(apiBaseUrl || '').trim().toLowerCase();
  if (!base) return false;
  // CF / 海外正式 API
  if (
    base.includes('api.kurangames.com')
    || base.includes('api-test2.kurangames.com')
    || base.includes('api-overseas.kurangames.com')
  ) {
    return false;
  }
  // 国内 ECS：kurangames.cn、cn-test-api、内网 IP
  return (
    base.includes('kurangames.cn')
    || base.includes('cn-test-api')
    || /(?:^|\/\/)47\.93\.42\.104\b/.test(base)
  );
}
