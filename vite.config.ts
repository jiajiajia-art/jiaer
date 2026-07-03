import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/funloom/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 后端 API 代理（局域网同事访问时，请求经本机 Vite 转发到 localhost:3000）
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // 注意：开发环境使用 signInWithPopup，不需要 Firebase Auth 代理
      // 生产环境部署到 Firebase Hosting，也不需代理
    }
  },
  preview: {
    host: true,
    port: 5173,
  },
})
