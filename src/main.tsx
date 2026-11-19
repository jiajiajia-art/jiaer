import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/themes/index.css'
import './index.css'
import { initTheme } from './lib/theme'
import './i18n'
import App from './App.tsx'
import { isGoogleAuthEnabled } from './lib/googleAuthPolicy'
import { useAuthStore } from './store/useAuthStore'

// 功能注释：渲染前写入 data-theme / data-mode（首屏已由 index.html 预置，这里接管切换与系统跟随）
initTheme()

// 功能注释：平台会话水合与 Google 无关，国内海外都要尽早跑
void useAuthStore.getState().initialize()

// 功能注释：国内站不挂载 Firebase，避免请求 apis.google.com；海外才动态加载
if (isGoogleAuthEnabled()) {
  void import('./bootstrapGoogleAuth').then((mod) => {
    void mod.bootstrapGoogleAuth()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
