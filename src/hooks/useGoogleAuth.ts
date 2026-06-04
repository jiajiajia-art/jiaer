import { signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '../config/firebase';
import { useTranslation } from 'react-i18next';

export function useGoogleAuth() {
    const { t } = useTranslation();
    const isDev = import.meta.env.DEV;

    const loginWithGoogle = async () => {
        try {
            if (isDev) {
                const result = await signInWithPopup(firebaseAuth, googleProvider);
                return { success: true, user: result.user };
            } else {
                await signInWithRedirect(firebaseAuth, googleProvider);
                return { success: true, message: 'Redirecting...' };
            }
        } catch (error: unknown) {
            const authError = error as { code?: string; message?: string };

            if (authError.code === 'auth/network-request-failed') {
                return { success: false, message: t('auth.networkError') };
            }

            if (authError.code === 'auth/popup-closed-by-user') {
                return { success: false, message: t('auth.popupClosed') };
            }

            if (authError.code === 'auth/cancelled-popup-request') {
                return { success: false, message: t('auth.popupClosed') };
            }

            return { success: false, message: authError.message || t('auth.googleLoginFailed') };
        }
    };

    return { loginWithGoogle };
}
