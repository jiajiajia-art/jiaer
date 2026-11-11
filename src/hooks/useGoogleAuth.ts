import { signInWithRedirect, signInWithPopup } from 'firebase/auth';
import { auth as firebaseAuth, googleProvider } from '../config/firebase';
import { useTranslation } from 'react-i18next';
import { auth } from '../api/account/authApi';
import {
    REGISTRATION_AGREEMENT_VERSION,
    REGISTRATION_PRIVACY_POLICY_VERSION,
} from '../lib/registrationAgreement';

export function useGoogleAuth() {
    const { t } = useTranslation();
    const isDev = import.meta.env.DEV;

    const loginWithGoogle = async () => {
        try {
            if (isDev) {
                const result = await signInWithPopup(firebaseAuth, googleProvider);
                const idToken = await result.user.getIdToken();
                const response = await auth.googleLogin({
                    idToken,
                    agreementAccepted: true,
                    userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
                    privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
                });
                if (response.data?.success && response.data?.data) {
                    return {
                        success: true,
                        data: response.data.data,
                        firebaseUid: result.user.uid,
                    };
                }
                return {
                    success: false,
                    code: response.data?.code,
                    message: response.data?.message || t('auth.googleLoginFailed'),
                };
            } else {
                await signInWithRedirect(firebaseAuth, googleProvider);
                return { success: true, redirecting: true, message: 'Redirecting...' };
            }
        } catch (error: unknown) {
            const authError = error as {
                code?: string;
                message?: string;
                response?: { data?: { code?: string } };
            };

            if (authError.code === 'auth/network-request-failed') {
                return { success: false, code: authError.code, message: t('auth.networkError') };
            }

            if (authError.code === 'auth/popup-closed-by-user') {
                return { success: false, code: authError.code, message: t('auth.popupClosed') };
            }

            if (authError.code === 'auth/cancelled-popup-request') {
                return { success: false, code: authError.code, message: t('auth.popupClosed') };
            }

            return {
                success: false,
                code: authError.response?.data?.code || authError.code,
                message: authError.message || t('auth.googleLoginFailed'),
            };
        }
    };

    return { loginWithGoogle };
}
