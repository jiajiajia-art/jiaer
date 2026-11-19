import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { isGoogleAuthEnabled } from '../lib/googleAuthPolicy'

// ⚠️ 重要：把下面的值替换成你在步骤 1.4 复制的真实值
const firebaseConfig = {
    apiKey: "AIzaSyD95CxX22-h6DRUZb9S8TsSMzPnuad8xoo",
    // 生产环境使用自定义域名，开发环境使用 firebaseapp.com
    authDomain: import.meta.env.PROD
        ? "overseas.kurangames.com"
        : "interactive-fiction-c8ca8.firebaseapp.com",
    projectId: "interactive-fiction-c8ca8",
    storageBucket: "interactive-fiction-c8ca8.firebasestorage.app",
    messagingSenderId: "887946693860",
    appId: "1:887946693860:web:a7e27c026842706c6930f1"
}

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let googleProviderInstance: GoogleAuthProvider | null = null

/**
 * 功能注释：仅在海外 Google 登录开启时懒初始化 Firebase，
 * 国内站从不调用，避免 getAuth 触发 apis.google.com。
 */
function ensureFirebase(): { auth: Auth; googleProvider: GoogleAuthProvider } {
    if (!isGoogleAuthEnabled()) {
        throw new Error('Google auth is disabled in domestic runtime')
    }
    if (!app || !authInstance || !googleProviderInstance) {
        app = initializeApp(firebaseConfig)
        authInstance = getAuth(app)
        googleProviderInstance = new GoogleAuthProvider()
    }
    return {
        auth: authInstance,
        googleProvider: googleProviderInstance,
    }
}

export function ensureFirebaseAuth(): Auth {
    return ensureFirebase().auth
}

export function ensureGoogleProvider(): GoogleAuthProvider {
    return ensureFirebase().googleProvider
}
