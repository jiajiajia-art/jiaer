import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  buildViteDevProxy,
  getDevApiPreset,
  resolveDevApiPresetKey,
} from './devApiPresets'

const oversizedLocalDownloads = [
  ['pdf', 'Funloom互动影游工具.zip'],
  ['pdf', 'FunloomTool'],
]

const removeOversizedLocalDownloads = () => ({
  name: 'remove-oversized-local-downloads',
  closeBundle: async () => {
    await Promise.all(
      oversizedLocalDownloads.map((segments) =>
        rm(resolve(process.cwd(), 'dist', ...segments), { recursive: true, force: true }),
      ),
    )
  },
})

/** 功能注释：开发态 / 与无尾斜杠的 base（如 /funloom）302 到 base，避免预览打开根路径时只看到 Vite 404 */
const rootToBaseRedirect = (base: string) => ({
  name: 'root-to-base-redirect',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => void) => void } }) {
    const bare = base.replace(/\/+$/, '')
    server.middlewares.use((req, res, next) => {
      const raw = req.url || ''
      const [pathOnly, query] = raw.split('?')
      if (pathOnly !== '/' && pathOnly !== bare) {
        next()
        return
      }
      res.statusCode = 302
      res.setHeader('Location', `${base}${query ? `?${query}` : ''}`)
      res.end()
    })
  },
})

/** 功能注释：开发态短链 /romance → /funloom/romance/（生产由 Worker 同逻辑处理） */
const romanceShortLinkRedirect = () => ({
  name: 'romance-short-link-redirect',
  configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => void) => void } }) {
    server.middlewares.use((req, res, next) => {
      const raw = req.url || ''
      const pathOnly = raw.split('?')[0] || ''
      if (pathOnly !== '/romance' && !pathOnly.startsWith('/romance/')) {
        next()
        return
      }
      const u = new URL(raw, 'http://127.0.0.1')
      const rest = u.pathname === '/romance' ? '/' : u.pathname.slice('/romance'.length)
      res.statusCode = 302
      res.setHeader('Location', `/funloom/romance${rest === '/' ? '/' : rest}${u.search}`)
      res.end()
    })
  },
})

/**
 * 功能注释：以 virtual 模块挂 Romance，避免 funloom 严格 tsc 跟进检查 Romance 源码（unused / verbatim 等）。
 * Vite 打包仍真实解析到 Romance/src。
 */
const romanceVirtualModules = () => {
  const appPath = resolve(__dirname, 'Romance/src/App.tsx').replace(/\\/g, '/')
  const cssPath = resolve(__dirname, 'Romance/src/index.css').replace(/\\/g, '/')
  return {
    name: 'romance-virtual-modules',
    resolveId(id: string) {
      if (id === 'virtual:romance-app') return '\0virtual:romance-app'
      if (id === 'virtual:romance-css') return '\0virtual:romance-css'
      return null
    },
    load(id: string) {
      if (id === '\0virtual:romance-app') {
        return `export { default } from ${JSON.stringify(appPath)}`
      }
      if (id === '\0virtual:romance-css') {
        return `import ${JSON.stringify(cssPath)}`
      }
      return null
    },
  }
}

/** 功能注释：启动时打印联调后端，避免同事搞不清当前打哪套环境 */
const logDevApiPreset = (preset: ReturnType<typeof getDevApiPreset>) => ({
  name: 'log-dev-api-preset',
  configureServer() {
    const dest = `${preset.apiOrigin}${preset.apiPathPrefix || ''}`
    console.log(`[vite] ACTIVE_DEV_API=${preset.key} (${preset.label}) → ${dest}`)
    console.log('[vite] 切换：只改 Interactive-fiction-frontend/devApiPresets.ts 里的 ACTIVE_DEV_API')
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 功能注释：默认 /funloom/；cn-test 同机并存可设 VITE_BASE=/funloom-test/
  const viteBase = String(env.VITE_BASE || process.env.VITE_BASE || '/funloom/').replace(/\/?$/, '/')
  // 功能注释：Figma 预览环境没有本机 wrangler，固定连阿里云测试；本地开发仍以 devApiPresets.ts 为准
  const presetKey = process.env.FIGMA ? 'cn-test' : resolveDevApiPresetKey()
  const preset = getDevApiPreset(presetKey)

  return {
    base: viteBase,
    plugins: [
      react(),
      tailwindcss(),
      romanceVirtualModules(),
      ...(viteBase !== '/' ? [rootToBaseRedirect(viteBase)] : []),
      romanceShortLinkRedirect(),
      removeOversizedLocalDownloads(),
      ...(mode === 'development' ? [logDevApiPreset(preset)] : []),
    ],
    resolve: {
      // 功能注释：Romance 自带 node_modules/react（与主站版本/realpath 不同）时会打出双实例，
      // 运行时报 Cannot read properties of null (reading 'useState')。强制共用主站 React。
      dedupe: ['react', 'react-dom'],
      alias: {
        react: resolve(__dirname, 'node_modules/react'),
        'react-dom': resolve(__dirname, 'node_modules/react-dom'),
        // 功能注释：Romance 源码用 `@/`；主站 src 不用该别名，故安全指向 Romance/src
        '@': resolve(__dirname, 'Romance/src'),
        '@romance': resolve(__dirname, 'Romance/src'),
      },
    },
    server: {
      host: true,
      port: process.env.FIGMA ? Number(process.env.PORT) : 5173,
      // 功能注释：5173 被占时禁止静默改到 5174，避免 HMR WebSocket 端口错乱
      strictPort: true,
      // 功能注释：Figma 预览环境走代理域名，使用 Vite 默认 HMR 并放行预览域名；本地开发不受影响
      ...(process.env.FIGMA
        ? {
            allowedHosts: process.env.FIGMA_PUBLIC_URL
              ? [new URL(process.env.FIGMA_PUBLIC_URL).hostname]
              : [],
          }
        : {
            hmr: {
              protocol: 'ws',
              host: 'localhost',
              port: 5173,
              clientPort: 5173,
            },
          }),
      proxy: buildViteDevProxy(preset),
    },
    preview: {
      host: true,
      port: 5173,
    },
  }
})
