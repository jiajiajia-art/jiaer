import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth'
import { auth as firebaseAuth } from './config/firebase'
import { auth as authApi } from './api/account/authApi'
import { useAuthStore } from './store/useAuthStore'
import { appPath } from './lib/appBasePath'

const isDev = import.meta.env.DEV;
const logAuth = (...args: unknown[]) => {
    if (isDev) {
        console.log(...args);
    }
};
const logAuthError = (...args: unknown[]) => {
    console.error(...args);
};

const navigateToHome = () => {
    // 兼容 Capacitor 与 Web（/funloom 或 /funloom-test）
    const targetUrl = window.location.origin + appPath('home');
    if (window.top && window.top.location.href !== targetUrl) {
        window.top.location.href = targetUrl;
    } else if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
};

// ========== 处理 Redirect 结果（仅生产环境） ==========
if (!isDev) {
    getRedirectResult(firebaseAuth)
        .then(async (result) => {
            if (result?.user) {
                try {
                    const idToken = await result.user.getIdToken();
                    const response = await authApi.googleLogin({ idToken });

                    if (response.data?.success && response.data?.data) {
                        useAuthStore.getState().login(response.data.data);
                        logAuth('[Redirect] login success');
                        navigateToHome();
                    } else {
                        logAuthError('[Redirect] login failed:', response.data);
                    }
                } catch (error: unknown) {
                    const authError = error as { code?: string; message?: string };
                    logAuthError('[Redirect] login failed:', authError?.code, authError?.message);
                }
            }
        })
        .catch((error: unknown) => {
            const authError = error as { code?: string; message?: string };
            logAuthError('[Redirect] getRedirectResult error:', authError?.code, authError?.message);
        });
}

// ========== 监听认证状态变化 ==========
onAuthStateChanged(firebaseAuth, async (user) => {
    if (user) {
        try {
            const idToken = await user.getIdToken();
            const response = await authApi.googleLogin({ idToken });

            if (response.data?.success && response.data?.data) {
                useAuthStore.getState().login(response.data.data);
                navigateToHome();
            } else {
                logAuthError('[Auth] backend response failed:', response.data);
            }
        } catch (error: unknown) {
            const authError = error as { code?: string; message?: string };
            logAuthError('[Auth] login failed:', authError?.code, authError?.message);
        }
    }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


