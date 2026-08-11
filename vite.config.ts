import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
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

// https://vite.dev/config/
export default defineConfig({
  base: '/funloom/',
  plugins: [react(), removeOversizedLocalDownloads()],
  server: {
    host: true,
    port: 5173,
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
