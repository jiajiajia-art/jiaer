import type { User as FirebaseUser } from 'firebase/auth'
import { auth as authApi } from './api/account/authApi'
import { authModalStore, useAuthStore } from './store/useAuthStore'
import { appPath } from './lib/appBasePath'
import {
    consumePendingGoogleLoginAgreementAccepted,
    hasCurrentLoginAgreementAccepted,
    REGISTRATION_AGREEMENT_VERSION,
    REGISTRATION_PRIVACY_POLICY_VERSION,
} from './lib/registrationAgreement'
import { isGoogleAuthEnabled } from './lib/googleAuthPolicy'

/**
 * 功能注释：海外站才挂载 Firebase Google 登录监听；
 * 动态 import firebase，保证国内包启动路径不执行 getAuth / getRedirectResult。
 */
export async function bootstrapGoogleAuth(): Promise<void> {
    if (!isGoogleAuthEnabled()) return

    const [{ onAuthStateChanged, getRedirectResult }, { ensureFirebaseAuth }] = await Promise.all([
        import('firebase/auth'),
        import('./config/firebase'),
    ])

    const firebaseAuth = ensureFirebaseAuth()
    const isDev = import.meta.env.DEV
    const currentLoginAgreementPayload = () => ({
        agreementAccepted: true as const,
        userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
        privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
    })
    const logAuth = (...args: unknown[]) => {
        if (isDev) console.log(...args)
    }
    const logAuthError = (...args: unknown[]) => {
        console.error(...args)
    }

    type LoginAgreementErrorCode = 'AGREEMENT_REQUIRED' | 'AGREEMENT_VERSION_MISMATCH'
    const isLoginAgreementErrorCode = (code?: string): code is LoginAgreementErrorCode => (
        code === 'AGREEMENT_REQUIRED' || code === 'AGREEMENT_VERSION_MISMATCH'
    )
    const openLoginAgreementModal = (errorCode: LoginAgreementErrorCode) => {
        const modal = authModalStore.getState()
        modal.setPendingAuthErrorCode(errorCode)
        modal.setAuthModalMode('login')
        modal.setIsAuthModalOpen(true)
    }

    let pendingGoogleExchange: Promise<void> | null = null
    const platformAuthInitialization = useAuthStore.getState().initialize()

    const navigateToHome = () => {
        const targetUrl = window.location.origin + appPath('home')
        let topWindow: Window | null = null
        try {
            if (window.top && window.top !== window) {
                void window.top.location.href
                topWindow = window.top
            }
        } catch {
            topWindow = null
        }
        if (topWindow && topWindow.location.href !== targetUrl) {
            topWindow.location.href = targetUrl
        } else if (window.location.href !== targetUrl) {
            window.location.href = targetUrl
        }
    }

    const exchangeGoogleUser = async (
        firebaseUser: FirebaseUser,
        forceExchange = false,
    ): Promise<void> => {
        if (!forceExchange && useAuthStore.getState().user) return
        if (!hasCurrentLoginAgreementAccepted(firebaseUser.uid)) {
            openLoginAgreementModal('AGREEMENT_REQUIRED')
            return
        }
        if (pendingGoogleExchange) return pendingGoogleExchange

        pendingGoogleExchange = (async () => {
            try {
                const idToken = await firebaseUser.getIdToken()
                const response = await authApi.googleLogin({ idToken, ...currentLoginAgreementPayload() })
                if (response.data?.success && response.data?.data) {
                    useAuthStore.getState().login(response.data.data)
                    logAuth('[GoogleAuth] login success')
                    navigateToHome()
                    return
                }
                if (isLoginAgreementErrorCode(response.data?.code)) {
                    openLoginAgreementModal(response.data.code)
                    return
                }
                logAuthError('[GoogleAuth] backend response failed:', response.data)
            } catch (error: unknown) {
                const authError = error as {
                    code?: string
                    message?: string
                    response?: { data?: { code?: string; message?: string } }
                }
                const errorCode = authError.response?.data?.code
                if (isLoginAgreementErrorCode(errorCode)) {
                    openLoginAgreementModal(errorCode)
                    return
                }
                logAuthError('[GoogleAuth] login failed:', authError.code, authError.message)
            }
        })()

        try {
            await pendingGoogleExchange
        } finally {
            pendingGoogleExchange = null
        }
    }

    const redirectResultPromise = isDev
        ? Promise.resolve()
        : getRedirectResult(firebaseAuth)
            .then(async (result) => {
                const firebaseUser = result?.user
                if (firebaseUser) {
                    await platformAuthInitialization
                    consumePendingGoogleLoginAgreementAccepted(firebaseUser.uid)
                    await exchangeGoogleUser(firebaseUser, true)
                }
            })
            .catch((error: unknown) => {
                const authError = error as { code?: string; message?: string }
                logAuthError('[Redirect] getRedirectResult error:', authError?.code, authError?.message)
            })

    onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user || isDev) return
        await platformAuthInitialization
        await redirectResultPromise
        await exchangeGoogleUser(user)
    })
}
