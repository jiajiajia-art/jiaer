import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './AuthModal.module.css';
import { auth } from '../api/account/authApi';
import gamePromotionApi from '../api/promotion/gamePromotionApi';
import { getOrCreatePromoAnonId } from '../utils/promoAnonId';
import { authModalStore, useAuthStore } from '../store/useAuthStore';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { isPrivacyAgreementAccepted } from '../lib/privacyPolicy';
import {
    REGISTRATION_AGREEMENT_VERSION,
    REGISTRATION_PRIVACY_POLICY_VERSION,
    clearPendingGoogleLoginAgreementAccepted,
    markLoginAgreementAccepted,
    markPendingGoogleLoginAgreementAccepted,
    resolveRegistrationAgreementUrl,
} from '../lib/registrationAgreement';
import { isRegistrationRequestTimeout } from '../lib/registrationRequest';
import {
    clearRegistrationSessionId,
    getOrCreateRegistrationSessionId,
    trackRegistrationEvent,
} from '../lib/registrationAnalytics';
import {
    isValidPhoneNumber,
    normalizeInviteCode,
    normalizePhoneInput,
    normalizeVerificationCode,
    validateRegistrationFields,
} from '../lib/registrationForm';
import { getApiErrorMessage } from '../utils/error';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin?: (phone: string, password: string) => void;
    onRegister?: (phone: string, password: string) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

// 检测是否在微信小程序环境
const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const createRegistrationRequestId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `register-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, onRegister }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const pendingAuthErrorCode = authModalStore(
        (state) => state.pendingAuthErrorCode,
    );
    const requestedAuthMode = authModalStore.getState().authModalMode;
    // 功能注释：按运行时语言决定 Google-only（IP 英文区），不用编译期 LANGUAGE
    const isGoogleOnly = String(i18n.language || '').toLowerCase().startsWith('en');
    // 在微信小程序环境中不渲染
    if (isWebViewEnv()) {
        return null;
    }
    const [mode, setMode] = useState<AuthMode>(requestedAuthMode);
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetPhone, setResetPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [hasSentCode, setHasSentCode] = useState(false);

    // 错误状态
    const [phoneError, setPhoneError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [resetPhoneError, setResetPhoneError] = useState('');
    const [verificationCodeError, setVerificationCodeError] = useState('');
    const [inviteCodeError, setInviteCodeError] = useState('');

    // 震动状态
    const [phoneShake, setPhoneShake] = useState(false);
    const [passwordShake, setPasswordShake] = useState(false);
    const [confirmPasswordShake, setConfirmPasswordShake] = useState(false);
    const [resetPhoneShake, setResetPhoneShake] = useState(false);
    const [verificationCodeShake, setVerificationCodeShake] = useState(false);

    // 密码是否可见状态
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [submitError, setSubmitError] = useState('');
    const [codeNotice, setCodeNotice] = useState('');
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    /** Login and registration require the shared user-agreement and privacy-policy checkbox. */
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [privacyError, setPrivacyError] = useState('');
    const { login } = useAuthStore();
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const registrationRequestIdRef = useRef<string | null>(null);
    const sendCodeRequestVersionRef = useRef(0);
    const sendCodeInFlightRef = useRef(false);
    const overlayPointerRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
    const { loginWithGoogle } = useGoogleAuth();
    const legalLanguage = isGoogleOnly ? 'en' : 'zh';
    const privacyPolicyUrl = resolveRegistrationAgreementUrl('privacy-policy', { language: legalLanguage });
    const userAgreementUrl = resolveRegistrationAgreementUrl('user-agreement', { language: legalLanguage });

    const handleLegalDocumentClick = (
        event: React.MouseEvent<HTMLAnchorElement>,
        document: 'user-agreement' | 'privacy-policy',
    ) => {
        event.stopPropagation();
        if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches) {
            event.preventDefault();
            authModalStore.getState().setAuthModalMode(mode);
            navigate(`/legal/${document}?lang=${legalLanguage}`);
        }
    };

    // 清理倒计时定时器
    useEffect(() => {
        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (isOpen) {
            setPrivacyAgreed(false);
            setPrivacyError('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            overlayPointerRef.current = {
                x: event.clientX,
                y: event.clientY,
                moved: false,
            };
        };
        const handlePointerMove = (event: PointerEvent) => {
            const gesture = overlayPointerRef.current;
            if (!gesture || gesture.moved) return;

            if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4) {
                gesture.moved = true;
            }
        };

        window.addEventListener('pointerdown', handlePointerDown, true);
        window.addEventListener('pointermove', handlePointerMove, true);
        return () => {
            window.removeEventListener('pointerdown', handlePointerDown, true);
            window.removeEventListener('pointermove', handlePointerMove, true);
            overlayPointerRef.current = null;
        };
    }, [isOpen]);

    // ========== 验证函数 ==========
    const validatePhone = (phoneNumber: string): boolean => {
        return isValidPhoneNumber(phoneNumber);
    };

    const validatePassword = (pwd: string): boolean => {
        return pwd.length >= 6;
    };

    // ========== 错误处理辅助函数 ==========
    const setFieldError = (setError: (msg: string) => void, setShake: (val: boolean) => void, message: string) => {
        setError(message);
        setShake(true);
        setTimeout(() => setShake(false), 500);
    };

    const clearFieldError = (setError: (msg: string) => void, setShake: (val: boolean) => void) => {
        setError('');
        setShake(false);
    };

    const handleAgreementRequestError = (errorCode?: string): boolean => {
        if (errorCode === 'AGREEMENT_REQUIRED') {
            setPrivacyAgreed(false);
            setPrivacyError(t('validation.agreementRequired'));
            return true;
        }
        if (errorCode === 'AGREEMENT_VERSION_MISMATCH') {
            setPrivacyAgreed(false);
            setPrivacyError(t('auth.agreementUpdatedPleaseConfirm'));
            return true;
        }
        return false;
    };

    useEffect(() => {
        if (!isOpen || !pendingAuthErrorCode) return;
        const pendingErrorCode = authModalStore.getState().consumePendingAuthErrorCode();
        if (pendingErrorCode) handleAgreementRequestError(pendingErrorCode);
    }, [isOpen, pendingAuthErrorCode]);

    const invalidateRegistrationRequest = () => {
        registrationRequestIdRef.current = null;
    };

    const resetVerificationState = () => {
        sendCodeRequestVersionRef.current += 1;
        sendCodeInFlightRef.current = false;
        setIsSendingCode(false);
        setVerificationCode('');
        setVerificationCodeError('');
        setVerificationCodeShake(false);
        setHasSentCode(false);
        setCodeNotice('');
        setCountdown(0);
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    };

    // ========== 重置状态函数 ==========
    const resetAllStates = () => {
        sendCodeRequestVersionRef.current += 1;
        sendCodeInFlightRef.current = false;
        setIsSendingCode(false);
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setResetPhone('');
        setVerificationCode('');
        setInviteCode('');
        setHasSentCode(false);
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setResetPhoneError('');
        setVerificationCodeError('');
        setInviteCodeError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setResetPhoneShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
        setCodeNotice('');
        setPrivacyAgreed(false);
        setPrivacyError('');
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        setCountdown(0);
        registrationRequestIdRef.current = null;
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    };

    const resetErrors = () => {
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setResetPhoneError('');
        setVerificationCodeError('');
        setInviteCodeError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setResetPhoneShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
        setCodeNotice('');
        setPrivacyError('');
    };

    // ========== 输入处理函数 ==========
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = normalizePhoneInput(e.target.value);
        if (mode === 'register' && value !== phone) {
            resetVerificationState();
            invalidateRegistrationRequest();
        }
        setPhone(value);
        if (phoneError) clearFieldError(setPhoneError, setPhoneShake);
        if (mode === 'login' && submitError) setSubmitError('');
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPassword(value);
        if (mode === 'register') invalidateRegistrationRequest();
        if (passwordError) clearFieldError(setPasswordError, setPasswordShake);
        if (mode === 'login' && submitError) setSubmitError('');

        // 如果确认密码已填写，重新验证
        if (confirmPassword && (mode === 'register' || mode === 'reset')) {
            if (value !== confirmPassword) {
                setConfirmPasswordError(t('validation.passwordMismatch'));
                } else {
                clearFieldError(setConfirmPasswordError, setConfirmPasswordShake);
            }
        }
    };

    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setConfirmPassword(value);
        if (mode === 'register') invalidateRegistrationRequest();
        if (confirmPasswordError) clearFieldError(setConfirmPasswordError, setConfirmPasswordShake);

        if (value && password) {
            if (value !== password) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, t('validation.passwordMismatch'));
            } else {
                clearFieldError(setConfirmPasswordError, setConfirmPasswordShake);
            }
        }
    };

    const handleResetPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = normalizePhoneInput(e.target.value);
        if (value !== resetPhone) resetVerificationState();
        setResetPhone(value);
        if (resetPhoneError) clearFieldError(setResetPhoneError, setResetPhoneShake);
    };

    const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = normalizeVerificationCode(e.target.value);
        setVerificationCode(value);
        if (mode === 'register') invalidateRegistrationRequest();
        if (verificationCodeError) clearFieldError(setVerificationCodeError, setVerificationCodeShake);
    };

    const handleInviteCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInviteCode(normalizeInviteCode(e.target.value));
        invalidateRegistrationRequest();
        if (inviteCodeError) setInviteCodeError('');
    };

    // ========== 倒计时管理 ==========
    const startCountdown = () => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
        }
        setCountdown(60);
        countdownTimerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    if (countdownTimerRef.current) {
                        clearInterval(countdownTimerRef.current);
                        countdownTimerRef.current = null;
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // ========== 发送验证码 ==========
    const handleSendCode = async () => {
        if (sendCodeInFlightRef.current) return;
        const targetPhone = mode === 'register' ? phone : resetPhone;
        const setTargetPhoneError = mode === 'register' ? setPhoneError : setResetPhoneError;
        const setTargetPhoneShake = mode === 'register' ? setPhoneShake : setResetPhoneShake;
        if (!targetPhone) {
            setFieldError(setTargetPhoneError, setTargetPhoneShake, t('validation.phoneRequired'));
            return;
        }

        if (!validatePhone(targetPhone)) {
            setFieldError(setTargetPhoneError, setTargetPhoneShake, t('validation.phoneInvalid'));
            return;
        }

        sendCodeInFlightRef.current = true;
        setIsSendingCode(true);
        const requestVersion = sendCodeRequestVersionRef.current + 1;
        sendCodeRequestVersionRef.current = requestVersion;
        setSubmitError('');
        setCodeNotice('');
        if (mode === 'register') {
            trackRegistrationEvent('registration_code_send');
        }
        try {
            if (mode === 'register') {
                await auth.sendCode({ phoneNumber: targetPhone, purpose: 'register' });
            } else {
                await auth.sendCode({ phoneNumber: targetPhone, purpose: 'password_reset' });
            }
            if (requestVersion !== sendCodeRequestVersionRef.current) return;
            setVerificationCode('');
            setHasSentCode(true);
            setCodeNotice(t('auth.codeSent'));
            startCountdown();
        } catch (error: any) {
            if (requestVersion !== sendCodeRequestVersionRef.current) return;
            console.error('Failed to send verification code');
            if (mode === 'register' && isRegistrationRequestTimeout(error)) {
                setVerificationCode('');
                setHasSentCode(true);
                setCodeNotice(t('auth.codeSendTimeout'));
                startCountdown();
                return;
            }
            const errorMessage = error.response?.data?.message || error.message || t('common.error');
            setSubmitError(errorMessage);
        } finally {
            if (requestVersion === sendCodeRequestVersionRef.current) {
                sendCodeInFlightRef.current = false;
                setIsSendingCode(false);
            }
        }
    };

    // ========== 表单验证 ==========
    const validateForm = (): boolean => {
        resetErrors();
        let hasError = false;

        // 登录模式验证
        if (mode === 'login') {
            if (!validatePhone(phone)) {
                setFieldError(setPhoneError, setPhoneShake, t('validation.phoneInvalid'));
                hasError = true;
            }
            if (!validatePassword(password)) {
                setFieldError(setPasswordError, setPasswordShake, t('validation.passwordMinLength'));
                hasError = true;
            }
            if (!isPrivacyAgreementAccepted(privacyAgreed)) {
                setPrivacyError(t('validation.agreementRequired'));
                hasError = true;
            }
        }

        // 注册模式验证
        if (mode === 'register') {
            const errors = validateRegistrationFields({
                phoneNumber: phone,
                code: verificationCode,
                password,
                confirmPassword,
                inviteCode,
                agreementAccepted: privacyAgreed,
                codeSent: hasSentCode,
            });
            if (errors.phoneNumber) {
                setFieldError(setPhoneError, setPhoneShake, t(`validation.${errors.phoneNumber}`));
            }
            if (errors.code) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t(`validation.${errors.code}`));
            }
            if (errors.password) {
                setFieldError(setPasswordError, setPasswordShake, t(`validation.${errors.password}`));
            }
            if (errors.confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, t(`validation.${errors.confirmPassword}`));
            }
            if (errors.inviteCode) {
                setInviteCodeError(t(`validation.${errors.inviteCode}`));
            }
            if (errors.agreement) {
                setPrivacyError(t(`validation.${errors.agreement}`));
            }
            hasError = Object.keys(errors).length > 0;
        }

        // 重置密码模式验证
        if (mode === 'reset') {
            if (!resetPhone) {
                setFieldError(setResetPhoneError, setResetPhoneShake, t('validation.phoneRequired'));
                hasError = true;
            } else if (!validatePhone(resetPhone)) {
                setFieldError(setResetPhoneError, setResetPhoneShake, t('validation.phoneInvalid'));
                hasError = true;
            }
            if (!verificationCode) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t('validation.codeRequired'));
                hasError = true;
            } else if (verificationCode.length !== 6) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t('validation.codeLength'));
                hasError = true;
            }
            if (!validatePassword(password)) {
                setFieldError(setPasswordError, setPasswordShake, t('validation.passwordMinLength'));
                hasError = true;
            }
            if (!confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, t('validation.confirmPasswordRequired'));
                hasError = true;
            } else if (password !== confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, t('validation.passwordMismatch'));
                hasError = true;
            }
        }

        return !hasError;
    };

    // ========== Google 登录 ==========
    const handleGoogleLogin = async () => {
        // 海外 Google 登录须先同意用户协议和隐私政策
        if (!isPrivacyAgreementAccepted(privacyAgreed)) {
            setPrivacyError(t('validation.agreementRequired'));
            return;
        }
        setPrivacyError('');
        setIsGoogleLoading(true);
        setSubmitError('');
        const isRedirectLogin = !import.meta.env.DEV;
        try {
            if (isRedirectLogin) {
                markPendingGoogleLoginAgreementAccepted();
            }
            const result = await loginWithGoogle();
            if (isRedirectLogin && !(result.success && result.redirecting)) {
                clearPendingGoogleLoginAgreementAccepted();
            }
            if (result.success && result.data) {
                login(result.data);
                markLoginAgreementAccepted(result.firebaseUid);
                resetAllStates();
                onClose();
            } else if (result.success && result.redirecting) {
                return;
            } else if (handleAgreementRequestError(result.code)) {
                return;
            } else {
                setSubmitError(result.message || t('auth.googleLoginFailed'));
            }
        } catch (error: any) {
            console.error('Google login error:', error);
            if (isRedirectLogin) {
                clearPendingGoogleLoginAgreementAccepted();
            }
            const errorCode = error.response?.data?.code || error.code;
            if (!handleAgreementRequestError(errorCode)) {
                setSubmitError(error.message || t('auth.googleLoginFailed'));
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // ========== 表单提交 ==========
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        if (!validateForm()) {
            console.log('[Auth] Form validation failed, stopping submission');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'login') {
                const response = await auth.login({
                    phoneNumber: phone,
                    password: password,
                    agreementAccepted: true,
                    userAgreementVersion: REGISTRATION_AGREEMENT_VERSION,
                    privacyPolicyVersion: REGISTRATION_PRIVACY_POLICY_VERSION,
                });

                if (response.data?.data) {
                    login(response.data.data);
                    markLoginAgreementAccepted(response.data.data.user.userId);
                    // 登录前若点过推广链，session 里可能有 pending click，交给后端一次性归因
                    void gamePromotionApi.consumePending(getOrCreatePromoAnonId()).catch(() => {});
                    if (onLogin) {
                        onLogin(phone, password);
                    }
                    resetAllStates();
                    authModalStore.getState().setAuthModalMode('login');
                    onClose();
                } else {
                    throw new Error(t('common.error'));
                }
            } else if (mode === 'register') {
                const requestId = registrationRequestIdRef.current || createRegistrationRequestId();
                registrationRequestIdRef.current = requestId;
                const registrationSessionId = getOrCreateRegistrationSessionId();
                trackRegistrationEvent('registration_submit', registrationSessionId);
                const response = await auth.signup({
                    phoneNumber: phone,
                    password: password,
                    code: verificationCode,
                    inviteCode: inviteCode || undefined,
                    agreementAccepted: privacyAgreed,
                    requestId,
                    avatarUrl: '',
                    nickname: '',
                    // 注册时携带 anonId，后端将匿名点击与新建账号关联（game_promotion invitee）
                    promoAnonId: getOrCreatePromoAnonId(),
                });

                if (response.data?.data) {
                    trackRegistrationEvent('registration_success', registrationSessionId);
                    login(response.data.data);
                    markLoginAgreementAccepted(response.data.data.user.userId);
                    void gamePromotionApi.consumePending(getOrCreatePromoAnonId()).catch(() => {});

                    if (onRegister) {
                        onRegister(phone, password);
                    }
                    clearRegistrationSessionId();
                    resetAllStates();
                    authModalStore.getState().setAuthModalMode('login');
                    onClose();
                } else {
                    throw new Error(t('common.error'));
                }
            } else if (mode === 'reset') {
                const response = await auth.resetPassword({
                    phoneNumber: resetPhone,
                    code: verificationCode,
                    newPassword: password,
                    confirmNewPassword: password,
                });

                if (response.data?.data || response.data?.success) {
                    setSubmitError(t('auth.resetSuccess'));
                    resetAllStates();
                    setTimeout(() => {
                        setMode('login');
                        authModalStore.getState().setAuthModalMode('login');
                        setSubmitError('');
                    }, 2000);
                } else {
                    throw new Error(t('common.error'));
                }
            }
        } catch (error: any) {
            console.error('Authentication request failed');
            if (mode === 'register') {
                trackRegistrationEvent('registration_failure');
            }
            if (mode === 'register' && isRegistrationRequestTimeout(error)) {
                setSubmitError(t('auth.registrationTimeout'));
                return;
            }
            const errorMessage = getApiErrorMessage(error, t('common.error'));
            const errorCode = error?.response?.data?.code;
            if (mode === 'login' && handleAgreementRequestError(errorCode)) {
                return;
            } else if (mode === 'login' && errorCode === 'INVALID_LOGIN_CREDENTIALS') {
                setSubmitError(t('auth.invalidLoginCredentials'));
            } else if (mode === 'reset' && errorCode === 'PHONE_NOT_REGISTERED') {
                setFieldError(setResetPhoneError, setResetPhoneShake, t('auth.phoneNotRegistered'));
            } else if (mode === 'reset' && errorCode === 'INVALID_CODE') {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t('auth.invalidVerificationCode'));
            } else if (mode === 'reset' && errorCode === 'CODE_EXPIRED') {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t('auth.verificationCodeExpired'));
            } else if (mode === 'reset' && errorCode === 'TOO_MANY_ATTEMPTS') {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, t('auth.tooManyVerificationAttempts'));
            } else if (mode === 'register' && errorCode === 'INVALID_INVITE_CODE') {
                setInviteCodeError(errorMessage);
            } else if (mode === 'register' && ['INVALID_CODE', 'CODE_EXPIRED', 'TOO_MANY_ATTEMPTS'].includes(errorCode)) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, errorMessage);
            } else {
                setSubmitError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ========== 模式切换 ==========
    const handleModeSwitch = () => {
        if (isLoading) return;
        if (mode === 'login') {
            const registrationSessionId = getOrCreateRegistrationSessionId();
            trackRegistrationEvent('registration_mode_switch', registrationSessionId);
            trackRegistrationEvent('registration_enter', registrationSessionId);
            setMode('register');
            authModalStore.getState().setAuthModalMode('register');
        } else if (mode === 'register') {
            const registrationSessionId = getOrCreateRegistrationSessionId();
            trackRegistrationEvent('registration_mode_switch', registrationSessionId);
            trackRegistrationEvent('registration_exit', registrationSessionId);
            clearRegistrationSessionId();
            setMode('login');
            authModalStore.getState().setAuthModalMode('login');
        }
        resetErrors();
        resetVerificationState();
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        setConfirmPassword('');
        setInviteCode('');
        setPrivacyAgreed(false);
        registrationRequestIdRef.current = null;
    };

    const handleForgetPassword = () => {
        if (isLoading) return;
        setMode('reset');
        authModalStore.getState().setAuthModalMode('reset');
        resetErrors();
        resetVerificationState();
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setResetPhone('');
        setVerificationCode('');
    };

    const handleClose = () => {
        if (isLoading) return;
        if (mode === 'register') {
            const registrationSessionId = getOrCreateRegistrationSessionId();
            trackRegistrationEvent('registration_exit', registrationSessionId);
            clearRegistrationSessionId();
        }
        resetAllStates();
        setMode('login');
        authModalStore.getState().setAuthModalMode('login');
        onClose();
    };

    const handleBackToLogin = () => {
        if (isLoading) return;
        resetAllStates();
        setMode('login');
        authModalStore.getState().setAuthModalMode('login');
    };

    const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
        const pointerGesture = overlayPointerRef.current;
        overlayPointerRef.current = null;
        if (pointerGesture?.moved) return;
        if (event.target !== event.currentTarget) return;

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString()) return;

        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
            const { selectionStart, selectionEnd } = activeElement;
            if (selectionStart !== null && selectionEnd !== null && selectionStart !== selectionEnd) return;
        }

        handleClose();
    };

    // ========== 渲染辅助函数 ==========
    const getSubmitButtonText = () => {
        if (isLoading) return t('auth.submitting');
        switch (mode) {
            case 'login': return t('auth.login');
            case 'register': return t('auth.register');
            case 'reset': return t('auth.reset');
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <div
            className={`${styles.modalOverlay} ${isGoogleOnly ? styles.googleOnlyOverlay : ''}`}
            onClick={handleOverlayClick}
        >
            <div
                className={`${styles.modalContent} ${isGoogleOnly ? styles.googleOnlyContent : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={`${styles.closeBtn} ${isGoogleOnly ? styles.googleOnlyCloseBtn : ''}`}
                    onClick={handleClose}
                    disabled={isLoading}
                    aria-disabled={isLoading}
                >
                    ×
                </button>

                <h2 className={`${styles.title} ${isGoogleOnly ? styles.googleOnlyTitle : ''}`}>
                    {isGoogleOnly
                        ? t('auth.login')
                        : mode === 'register' ? t('auth.register')
                            : mode === 'reset' ? t('auth.reset') : t('auth.login')}
                </h2>

                {/* Google-only login when runtime language is English */}
                {isGoogleOnly ? (
                    <>
                        <div className={styles.googleOnlyDivider} />
                        {/* 海外 Google 登录前须勾选同意用户协议和隐私政策 */}
                        <div className={styles.privacyRow}>
                            <div className={styles.privacyLabel}>
                                <input
                                    id="google-login-agreement"
                                    type="checkbox"
                                    className={styles.privacyCheckbox}
                                    checked={privacyAgreed}
                                    onChange={(e) => {
                                        setPrivacyAgreed(e.target.checked);
                                        if (e.target.checked) setPrivacyError('');
                                    }}
                                />
                                <span>
                                    <label htmlFor="google-login-agreement">
                                        {t('auth.agreementPrefix')}
                                    </label>
                                    <a
                                        href={userAgreementUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.privacyLink}
                                        onClick={(event) => handleLegalDocumentClick(event, 'user-agreement')}
                                    >
                                        {t('auth.userAgreement')}
                                    </a>
                                    {t('auth.agreementJoiner')}
                                    <a
                                        href={privacyPolicyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.privacyLink}
                                        onClick={(event) => handleLegalDocumentClick(event, 'privacy-policy')}
                                    >
                                        {t('auth.privacyPolicy')}
                                    </a>
                                </span>
                            </div>
                            {privacyError ? (
                                <div className={styles.errorMessage}>{privacyError}</div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            className={`${styles.googleBtn} ${styles.googleOnlyBtn}`}
                            onClick={handleGoogleLogin}
                            disabled={isGoogleLoading}
                        >
                            <FcGoogle size={22} />
                            <span>{isGoogleLoading ? t('auth.submitting') : t('auth.googleLogin')}</span>
                        </button>
                        {submitError && (
                            <div className={styles.errorMessage} style={{ textAlign: 'center', marginTop: '12px' }}>
                                {submitError}
                            </div>
                        )}
                    </>
                ) : (
                    <form className={styles.form} onSubmit={handleSubmit}>
                        {/* 手机号输入 */}
                        {mode !== 'reset' && (
                            <div className={styles.inputGroup}>
                                <input
                                    type="tel"
                                    className={`${styles.input} ${phoneError ? styles.inputError : ''} ${phoneShake ? styles.shake : ''}`}
                                    placeholder={t('auth.phone')}
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    maxLength={11}
                                    inputMode="numeric"
                                    disabled={isLoading || (mode === 'register' && isSendingCode)}
                                />
                                {phoneError && (
                                    <div className={styles.errorMessage}>{phoneError}</div>
                                )}
                            </div>
                        )}

                        {/* 手机号输入（重置） */}
                        {mode === 'reset' && (
                            <div className={styles.inputGroup}>
                                <input
                                    type="tel"
                                    className={`${styles.input} ${resetPhoneError ? styles.inputError : ''} ${resetPhoneShake ? styles.shake : ''}`}
                                    placeholder={t('auth.phone')}
                                    value={resetPhone}
                                    onChange={handleResetPhoneChange}
                                    maxLength={11}
                                    inputMode="numeric"
                                    disabled={isLoading || isSendingCode}
                                />
                                {resetPhoneError && (
                                    <div className={styles.errorMessage}>{resetPhoneError}</div>
                                )}
                            </div>
                        )}

                        {/* 验证码输入 */}
                        {(mode === 'register' || mode === 'reset') && (
                            <div className={styles.inputGroup}>
                                <div className={styles.codeInputWrapper}>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        className={`${styles.input} ${styles.codeInput} ${verificationCodeError ? styles.inputError : ''} ${verificationCodeShake ? styles.shake : ''}`}
                                        placeholder={t('auth.verificationCode')}
                                        value={verificationCode}
                                        onChange={handleVerificationCodeChange}
                                        maxLength={6}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.sendCodeBtn}
                                        onClick={handleSendCode}
                                        disabled={
                                            isLoading
                                            || isSendingCode
                                            || countdown > 0
                                            || !validatePhone(mode === 'register' ? phone : resetPhone)
                                        }
                                    >
                                        {isSendingCode ? t('auth.sending') : countdown > 0 ? `${countdown}s` : t('auth.sendCode')}
                                    </button>
                                </div>
                                {verificationCodeError && (
                                    <div className={styles.errorMessage}>{verificationCodeError}</div>
                                )}
                            </div>
                        )}

                        {/* 密码输入（登录/注册） */}
                        {mode !== 'reset' && (
                            <div className={styles.inputGroup}>
                                <div className={styles.passwordInputWrapper}>
                                    <input
                                        type={passwordVisible ? 'text' : 'password'}
                                        className={`${styles.input} ${styles.inputWithToggle} ${passwordError ? styles.inputError : ''} ${passwordShake ? styles.shake : ''}`}
                                        placeholder={t('auth.password')}
                                        value={password}
                                        onChange={handlePasswordChange}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.togglePasswordBtn}
                                        onClick={() => setPasswordVisible((v) => !v)}
                                        aria-label={passwordVisible ? t('password.hide') : t('password.show')}
                                    >
                                        {passwordVisible ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                                    </button>
                                </div>
                                {passwordError && (
                                    <div className={styles.errorMessage}>{passwordError}</div>
                                )}
                                {mode === 'login' && (
                                    <div className={styles.forgetPassword} onClick={handleForgetPassword}>
                                        {t('auth.forgetPassword')}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 确认密码输入（注册） */}
                        {mode === 'register' && (
                            <div className={styles.inputGroup}>
                                <div className={styles.passwordInputWrapper}>
                                    <input
                                        type={confirmPasswordVisible ? 'text' : 'password'}
                                        className={`${styles.input} ${styles.inputWithToggle} ${confirmPasswordError ? styles.inputError : ''} ${confirmPasswordShake ? styles.shake : ''}`}
                                        placeholder={t('auth.confirmPassword')}
                                        value={confirmPassword}
                                        onChange={handleConfirmPasswordChange}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        className={styles.togglePasswordBtn}
                                        onClick={() => setConfirmPasswordVisible((v) => !v)}
                                        aria-label={confirmPasswordVisible ? t('password.hide') : t('password.show')}
                                    >
                                        {confirmPasswordVisible ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                                    </button>
                                </div>
                                {confirmPasswordError && (
                                    <div className={styles.errorMessage}>{confirmPasswordError}</div>
                                )}
                            </div>
                        )}

                        {mode === 'register' && (
                            <div className={styles.inputGroup}>
                                <input
                                    type="text"
                                    className={`${styles.input} ${inviteCodeError ? styles.inputError : ''}`}
                                    placeholder={t('auth.inviteCode')}
                                    value={inviteCode}
                                    onChange={handleInviteCodeChange}
                                    maxLength={7}
                                    autoComplete="off"
                                    disabled={isLoading}
                                />
                                {inviteCodeError && (
                                    <div className={styles.errorMessage}>{inviteCodeError}</div>
                                )}
                            </div>
                        )}

                        {/* 登录和注册共用双协议勾选；重置密码不要求勾选。 */}
                        {mode !== 'reset' && (
                            <div className={styles.privacyRow}>
                                <div className={styles.privacyLabel}>
                                    <input
                                        id="phone-auth-agreement"
                                        type="checkbox"
                                        className={styles.privacyCheckbox}
                                        checked={privacyAgreed}
                                        disabled={isLoading}
                                        onChange={(e) => {
                                            setPrivacyAgreed(e.target.checked);
                                            if (mode === 'register') invalidateRegistrationRequest();
                                            if (e.target.checked) setPrivacyError('');
                                        }}
                                    />
                                    <span>
                                        <label htmlFor="phone-auth-agreement">
                                            {t('auth.agreementPrefix')}
                                        </label>
                                        <a
                                            href={userAgreementUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.privacyLink}
                                            onClick={(event) => handleLegalDocumentClick(event, 'user-agreement')}
                                        >
                                            {t('auth.userAgreement')}
                                        </a>
                                        {t('auth.agreementJoiner')}
                                        <a
                                            href={privacyPolicyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.privacyLink}
                                            onClick={(event) => handleLegalDocumentClick(event, 'privacy-policy')}
                                        >
                                            {t('auth.privacyPolicy')}
                                        </a>
                                    </span>
                                </div>
                                {privacyError ? (
                                    <div className={styles.errorMessage}>{privacyError}</div>
                                ) : null}
                            </div>
                        )}

                        {/* 新密码输入（重置） */}
                        {mode === 'reset' && (
                            <>
                                <div className={styles.inputGroup}>
                                    <div className={styles.passwordInputWrapper}>
                                        <input
                                            type={passwordVisible ? 'text' : 'password'}
                                            className={`${styles.input} ${styles.inputWithToggle} ${passwordError ? styles.inputError : ''} ${passwordShake ? styles.shake : ''}`}
                                            placeholder={t('auth.newPassword')}
                                            value={password}
                                            onChange={handlePasswordChange}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            className={styles.togglePasswordBtn}
                                            onClick={() => setPasswordVisible((v) => !v)}
                                            aria-label={passwordVisible ? t('password.hide') : t('password.show')}
                                        >
                                            {passwordVisible ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                                        </button>
                                    </div>
                                    {passwordError && (
                                        <div className={styles.errorMessage}>{passwordError}</div>
                                    )}
                                </div>
                                <div className={styles.inputGroup}>
                                    <div className={styles.passwordInputWrapper}>
                                        <input
                                            type={confirmPasswordVisible ? 'text' : 'password'}
                                            className={`${styles.input} ${styles.inputWithToggle} ${confirmPasswordError ? styles.inputError : ''} ${confirmPasswordShake ? styles.shake : ''}`}
                                            placeholder={t('auth.confirmNewPassword')}
                                            value={confirmPassword}
                                            onChange={handleConfirmPasswordChange}
                                            disabled={isLoading}
                                        />
                                        <button
                                            type="button"
                                            className={styles.togglePasswordBtn}
                                            onClick={() => setConfirmPasswordVisible((v) => !v)}
                                            aria-label={confirmPasswordVisible ? t('password.hide') : t('password.show')}
                                        >
                                            {confirmPasswordVisible ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                                        </button>
                                    </div>
                                    {confirmPasswordError && (
                                        <div className={styles.errorMessage}>{confirmPasswordError}</div>
                                    )}
                                </div>
                            </>
                        )}

                        {codeNotice && (
                            <div className={styles.successMessage}>{codeNotice}</div>
                        )}

                        {/* 提交错误信息 */}
                        {submitError && (
                            <div
                                className={styles.errorMessage}
                                style={{
                                    textAlign: 'center',
                                    marginTop: '0px',
                                    color: submitError.includes('成功') ? 'var(--color-success)' : 'var(--color-primary)'
                                }}
                            >
                                {submitError}
                            </div>
                        )}

                        {/* 提交按钮 */}
                        <button
                            type="submit"
                            className={styles.submitBtn}
                            disabled={isLoading}
                        >
                            {getSubmitButtonText()}
                        </button>
                    </form>
                )}

                {/* 模式切换（仅非 Google-only 模式） */}
                {!isGoogleOnly && mode !== 'reset' && (
                    <div className={styles.modeSwitch}>
                        <span>
                            {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}
                        </span>
                        <button type="button" onClick={handleModeSwitch} className={styles.switchBtn} disabled={isLoading}>
                            {mode === 'login' ? t('auth.registerNow') : t('auth.loginNow')}
                        </button>
                    </div>
                )}

                {!isGoogleOnly && mode === 'reset' && (
                    <div className={styles.modeSwitch}>
                        <span>{t('auth.rememberPassword')}</span>
                        <button type="button" onClick={handleBackToLogin} className={styles.switchBtn} disabled={isLoading}>
                            {t('auth.backToLogin')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default AuthModal;
