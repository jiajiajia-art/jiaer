import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth as firebaseAuth } from '../config/firebase';
import { auth } from '../api/account/authApi';
import { useAuthStore } from '../store/useAuthStore';
import { useTranslation } from 'react-i18next';

export function useGoogleAuth() {
    const { t } = useTranslation();
    const { login } = useAuthStore();

    const loginWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(firebaseAuth, provider);
            const idToken = await result.user.getIdToken();

            const response = await auth.googleLogin({ idToken });

            if (response.data?.success && response.data?.data) {
                login(response.data.data);
                return { success: true };
            }

            return { success: false, message: response.data?.message || t('auth.googleLoginFailed') };
        } catch (error: any) {
            console.error('Google login error:', error);

            if (error.code === 'auth/popup-closed-by-user') {
                return { success: false, message: t('auth.loginCancelled') };
            }

            if (error.code === 'auth/network-request-failed') {
                return { success: false, message: t('auth.networkError') };
            }

            return { success: false, message: error.message || t('auth.googleLoginFailed') };
        }
    };

    return { loginWithGoogle };
}
