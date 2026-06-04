import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/funloom/',
  plugins: [react()],
  server: {
    proxy: {
      // 后端 API 代理
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // 注意：开发环境使用 signInWithPopup，不需要 Firebase Auth 代理
      // 生产环境部署到 Firebase Hosting，也不需代理
    }
  }
})
