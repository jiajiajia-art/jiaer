/**
 * 功能注释：本地联调后端 —— 只改本文件即可。
 * 同事切换环境：改下面 ACTIVE_DEV_API 这一行，保存后重启 npm run dev / ./start-dev.sh
 */

/** ↓↓↓ 只改这里（合法值见下方注释）↓↓↓ */
export const ACTIVE_DEV_API = 'local'
/** ↑↑↑ 只改这里 ↑↑↑ */

/**
 * 可选值说明：
 * - cn-test   阿里云测试    https://kurangames.cn/cn-test-api
 * - cn-prod   阿里云正式    https://kurangames.cn/api
 * - cn-gogo   同事 gogo     http://gogo.kurangames.cn/api
 * - cn-neo    同事 neo      http://neo.kurangames.cn/api
 * - cn-qqq    同事 qqq      http://qqq.kurangames.cn/api
 * - cf-test2  CF 测试2      https://api-test2.kurangames.com
 * - local     本机 wrangler http://localhost:3000
 */

export type DevApiPreset = {
  label: string
  apiOrigin: string
  apiPathPrefix: string
  publicOrigin: string
  secure: boolean
}

export const DEV_API_PRESETS: Record<string, DevApiPreset> = {
  'cn-test': {
    label: '阿里云测试',
    apiOrigin: 'https://kurangames.cn',
    apiPathPrefix: '/cn-test-api',
    publicOrigin: 'https://kurangames.cn',
    secure: true,
  },
  'cn-prod': {
    label: '阿里云正式',
    apiOrigin: 'https://kurangames.cn',
    apiPathPrefix: '',
    publicOrigin: 'https://kurangames.cn',
    secure: true,
  },
  'cn-gogo': {
    label: '同事 gogo',
    apiOrigin: 'http://gogo.kurangames.cn',
    apiPathPrefix: '',
    publicOrigin: 'http://gogo.kurangames.cn',
    secure: false,
  },
  'cn-neo': {
    label: '同事 neo',
    apiOrigin: 'http://neo.kurangames.cn',
    apiPathPrefix: '',
    publicOrigin: 'http://neo.kurangames.cn',
    secure: false,
  },
  'cn-qqq': {
    label: '同事 qqq',
    apiOrigin: 'http://qqq.kurangames.cn',
    apiPathPrefix: '',
    publicOrigin: 'http://qqq.kurangames.cn',
    secure: false,
  },
  'cf-test2': {
    label: 'Cloudflare test2',
    apiOrigin: 'https://api-test2.kurangames.com',
    apiPathPrefix: '',
    publicOrigin: 'https://api-test2.kurangames.com',
    secure: true,
  },
  local: {
    label: '本机 wrangler',
    apiOrigin: 'http://localhost:3000',
    apiPathPrefix: '',
    publicOrigin: 'http://localhost:3000',
    secure: false,
  },
}

export const DEV_API_PRESET_KEYS = Object.keys(DEV_API_PRESETS)

/** 功能注释：以本文件 ACTIVE_DEV_API 为准（不再依赖多份 .env） */
export function resolveDevApiPresetKey(
  _env: Record<string, string | undefined> = {},
): string {
  if (DEV_API_PRESETS[ACTIVE_DEV_API]) return ACTIVE_DEV_API
  return 'cn-test'
}

export function getDevApiPreset(key: string): DevApiPreset & { key: string } {
  const k = DEV_API_PRESETS[key] ? key : 'cn-test'
  return { key: k, ...DEV_API_PRESETS[k] }
}

type ViteProxyRule = {
  target: string
  changeOrigin: boolean
  secure: boolean
  ws?: boolean
  rewrite?: (path: string) => string
}

/**
 * 功能注释：开发态相对路径资源（封面/头像/上传）会打到 localhost:5173，
 * 须代理到 publicOrigin，否则控制台一堆 404。
 */
export const DEV_ASSET_PROXY_PATHS = [
  '/public',
  '/uploads',
  '/interactive-fiction-game-avatar',
] as const

/** 功能注释：生成 Vite server.proxy（/api + 静态资源路径） */
export function buildViteDevProxy(
  preset: DevApiPreset,
): Record<string, ViteProxyRule> {
  const prefix = String(preset.apiPathPrefix || '')
  const proxy: Record<string, ViteProxyRule> = {
    '/api': {
      target: preset.apiOrigin,
      changeOrigin: true,
      secure: preset.secure,
      ws: true,
    },
  }
  for (const path of DEV_ASSET_PROXY_PATHS) {
    proxy[path] = {
      target: preset.publicOrigin,
      changeOrigin: true,
      secure: preset.secure,
    }
  }
  if (prefix) {
    proxy['/api'].rewrite = (path) => `${prefix}${path}`
  }
  return proxy
}
