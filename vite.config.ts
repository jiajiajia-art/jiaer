import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  base: '/funloom/',
  plugins: [
    react(),
    tailwindcss(),
    romanceVirtualModules(),
    romanceShortLinkRedirect(),
    removeOversizedLocalDownloads(),
  ],
  resolve: {
    alias: {
      // 功能注释：Romance 子应用源码仍放在仓库 Romance/，经别名嵌入 funloom 打包
      '@romance': resolve(__dirname, 'Romance/src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    // 功能注释：5173 被占时禁止静默改到 5174，避免 HMR WebSocket 端口错乱
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173,
    },
    proxy: {
      // 后端 API 代理（局域网同事访问时，请求经本机 Vite 转发到 localhost:3000）
      // 含 WebSocket 升级
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // 注意：开发环境使用 signInWithPopup，不需要 Firebase Auth 代理
      // 生产环境部署到 Firebase Hosting，也不需代理
    },
  },
  preview: {
    host: true,
    port: 5173,
  },
})
