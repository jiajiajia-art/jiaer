import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth'
import type { User as FirebaseUser } from 'firebase/auth'
import { auth as firebaseAuth } from './config/firebase'
import { auth as authApi } from './api/account/authApi'
import { authModalStore, useAuthStore } from './store/useAuthStore'
import { appPath } from './lib/appBasePath'
import {
    consumePendingGoogleLoginAgreementAccepted,
    hasCurrentLoginAgreementAccepted,
    REGISTRATION_AGREEMENT_VERSION,
    REGISTRATION_PRIVACY_POLICY_VERSION,
} from './lib/registrationAgreement'

const isDev = import.meta.env.DEV;
const currentLoginAgreementPayload = () => ({
    agreementAccepted: true as const,
    userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
    privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
});
const logAuth = (...args: unknown[]) => {
    if (isDev) {
        console.log(...args);
    }
};
const logAuthError = (...args: unknown[]) => {
    console.error(...args);
};

type LoginAgreementErrorCode = 'AGREEMENT_REQUIRED' | 'AGREEMENT_VERSION_MISMATCH';

const isLoginAgreementErrorCode = (code?: string): code is LoginAgreementErrorCode => (
    code === 'AGREEMENT_REQUIRED' || code === 'AGREEMENT_VERSION_MISMATCH'
);

const openLoginAgreementModal = (errorCode: LoginAgreementErrorCode) => {
    const modal = authModalStore.getState();
    modal.setPendingAuthErrorCode(errorCode);
    modal.setAuthModalMode('login');
    modal.setIsAuthModalOpen(true);
};

let pendingGoogleExchange: Promise<void> | null = null;
const platformAuthInitialization = useAuthStore.getState().initialize();

const navigateToHome = () => {
    // 兼容 Capacitor 与 Web（/funloom 或 /funloom-test）
    const targetUrl = window.location.origin + appPath('home');
    // window.top is cross-origin when embedded (e.g. a preview iframe);
    // reading its location throws, so fall back to navigating this frame.
    let topWindow: Window | null = null;
    try {
        if (window.top && window.top !== window) {
            void window.top.location.href;
            topWindow = window.top;
        }
    } catch {
        topWindow = null;
    }
    if (topWindow && topWindow.location.href !== targetUrl) {
        topWindow.location.href = targetUrl;
    } else if (window.location.href !== targetUrl) {
        window.location.href = targetUrl;
    }
};

const exchangeGoogleUser = async (
    firebaseUser: FirebaseUser,
    forceExchange = false,
): Promise<void> => {
    if (!forceExchange && useAuthStore.getState().user) return;
    if (!hasCurrentLoginAgreementAccepted(firebaseUser.uid)) {
        openLoginAgreementModal('AGREEMENT_REQUIRED');
        return;
    }
    if (pendingGoogleExchange) return pendingGoogleExchange;

    pendingGoogleExchange = (async () => {
        try {
            const idToken = await firebaseUser.getIdToken();
            const response = await authApi.googleLogin({ idToken, ...currentLoginAgreementPayload() });
            if (response.data?.success && response.data?.data) {
                useAuthStore.getState().login(response.data.data);
                logAuth('[GoogleAuth] login success');
                navigateToHome();
                return;
            }
            if (isLoginAgreementErrorCode(response.data?.code)) {
                openLoginAgreementModal(response.data.code);
                return;
            }
            logAuthError('[GoogleAuth] backend response failed:', response.data);
        } catch (error: unknown) {
            const authError = error as {
                code?: string;
                message?: string;
                response?: { data?: { code?: string; message?: string } };
            };
            const errorCode = authError.response?.data?.code;
            if (isLoginAgreementErrorCode(errorCode)) {
                openLoginAgreementModal(errorCode);
                return;
            }
            logAuthError('[GoogleAuth] login failed:', authError.code, authError.message);
        }
    })();

    try {
        await pendingGoogleExchange;
    } finally {
        pendingGoogleExchange = null;
    }
};

// ========== 处理 Redirect 结果（仅生产环境） ==========
const redirectResultPromise = isDev
    ? Promise.resolve()
    : getRedirectResult(firebaseAuth)
        .then(async (result) => {
            const firebaseUser = result?.user;
            if (firebaseUser) {
                await platformAuthInitialization;
                consumePendingGoogleLoginAgreementAccepted(firebaseUser.uid);
                await exchangeGoogleUser(firebaseUser, true);
            }
        })
        .catch((error: unknown) => {
            const authError = error as { code?: string; message?: string };
            logAuthError('[Redirect] getRedirectResult error:', authError?.code, authError?.message);
        });

// ========== 监听认证状态变化 ==========
onAuthStateChanged(firebaseAuth, async (user) => {
    if (!user || isDev) return;
    await platformAuthInitialization;
    await redirectResultPromise;
    await exchangeGoogleUser(user);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

