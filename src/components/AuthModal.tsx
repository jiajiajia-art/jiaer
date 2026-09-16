import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useTranslation } from 'react-i18next';
import styles from './AuthModal.module.css';
import { auth } from '../api/account/authApi';
import gamePromotionApi from '../api/promotion/gamePromotionApi';
import { getOrCreatePromoAnonId } from '../utils/promoAnonId';
import { useAuthStore } from '../store/useAuthStore';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { isPrivacyAgreementAccepted, resolvePrivacyPolicyUrl } from '../lib/privacyPolicy';

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

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, onRegister }) => {
    const { t, i18n } = useTranslation();
    // 功能注释：按运行时语言决定 Google-only（IP 英文区），不用编译期 LANGUAGE
    const isGoogleOnly = String(i18n.language || '').toLowerCase().startsWith('en');
    // 在微信小程序环境中不渲染
    if (isWebViewEnv()) {
        return null;
    }
    const [mode, setMode] = useState<AuthMode>('login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetPhone, setResetPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    // 错误状态
    const [phoneError, setPhoneError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [resetPhoneError, setResetPhoneError] = useState('');
    const [verificationCodeError, setVerificationCodeError] = useState('');

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
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    /** 功能注释：注册须勾选同意外置隐私政策后才能提交 */
    const [privacyAgreed, setPrivacyAgreed] = useState(false);
    const [privacyError, setPrivacyError] = useState('');
    const { login } = useAuthStore();
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const { loginWithGoogle } = useGoogleAuth();
    const privacyPolicyUrl = resolvePrivacyPolicyUrl({ darkMode: true });

    // 清理倒计时定时器
    useEffect(() => {
        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    // ========== 验证函数 ==========
    const validatePhone = (phoneNumber: string): boolean => {
        const phoneRegex = /^1\d{10}$/;
        return phoneRegex.test(phoneNumber);
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

    // ========== 重置状态函数 ==========
    const resetAllStates = () => {
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setResetPhone('');
        setVerificationCode('');
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setResetPhoneError('');
        setVerificationCodeError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setResetPhoneShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
        setPrivacyAgreed(false);
        setPrivacyError('');
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        setCountdown(0);
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
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setResetPhoneShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
        setPrivacyError('');
    };

    // ========== 输入处理函数 ==========
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(e.target.value);
        if (phoneError) clearFieldError(setPhoneError, setPhoneShake);
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPassword(value);
        if (passwordError) clearFieldError(setPasswordError, setPasswordShake);

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
        setResetPhone(e.target.value);
        if (resetPhoneError) clearFieldError(setResetPhoneError, setResetPhoneShake);
    };

    const handleVerificationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        setVerificationCode(value);
        if (verificationCodeError) clearFieldError(setVerificationCodeError, setVerificationCodeShake);
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
        if (!resetPhone) {
            setFieldError(setResetPhoneError, setResetPhoneShake, t('validation.phoneRequired'));
            return;
        }

        if (!validatePhone(resetPhone)) {
            setFieldError(setResetPhoneError, setResetPhoneShake, t('validation.phoneInvalid'));
            return;
        }

        setIsSendingCode(true);
        try {
            await auth.sendResetCode({ phoneNumber: resetPhone });
            setSubmitError(t('auth.codeSent'));
            startCountdown();
        } catch (error: any) {
            console.error('Failed to send code:', error);
            const errorMessage = error.response?.data?.message || error.message || t('common.error');
            setSubmitError(errorMessage);
        } finally {
            setIsSendingCode(false);
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
        }

        // 注册模式验证
        if (mode === 'register') {
            if (!validatePhone(phone)) {
                setFieldError(setPhoneError, setPhoneShake, t('validation.phoneInvalid'));
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
            if (!isPrivacyAgreementAccepted(privacyAgreed)) {
                setPrivacyError(t('validation.privacyRequired'));
                hasError = true;
            }
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
        // 功能注释：海外 Google 一键登录同样须先同意外置隐私政策
        if (!isPrivacyAgreementAccepted(privacyAgreed)) {
            setPrivacyError(t('validation.privacyRequired'));
            return;
        }
        setPrivacyError('');
        setIsGoogleLoading(true);
        setSubmitError('');
        try {
            const result = await loginWithGoogle();
            if (result.success) {
                resetAllStates();
                onClose();
            } else {
                setSubmitError(result.message || t('auth.googleLoginFailed'));
            }
        } catch (error: any) {
            console.error('Google login error:', error);
            setSubmitError(error.message || t('auth.googleLoginFailed'));
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // ========== 表单提交 ==========
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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
                });

                if (response.data?.data) {
                    login(response.data.data);
                    // 登录前若点过推广链，session 里可能有 pending click，交给后端一次性归因
                    void gamePromotionApi.consumePending(getOrCreatePromoAnonId()).catch(() => {});
                    if (onLogin) {
                        onLogin(phone, password);
                    }
                    resetAllStates();
                    onClose();
                } else {
                    throw new Error(t('common.error'));
                }
            } else if (mode === 'register') {
                const response = await auth.signup({
                    phoneNumber: phone,
                    password: password,
                    avatarUrl: '',
                    nickname: '',
                    // 注册时携带 anonId，后端将匿名点击与新建账号关联（game_promotion invitee）
                    promoAnonId: getOrCreatePromoAnonId(),
                });

                if (response.data?.data) {
                    login(response.data.data);
                    void gamePromotionApi.consumePending(getOrCreatePromoAnonId()).catch(() => {});

                    if (onRegister) {
                        onRegister(phone, password);
                    }
                    resetAllStates();
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
                        setSubmitError('');
                    }, 2000);
                } else {
                    throw new Error(t('common.error'));
                }
            }
        } catch (error: any) {
            console.error('Operation failed:', error);
            const errorMessage = error.response?.data?.message || error.message || t('common.error');
            setSubmitError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // ========== 模式切换 ==========
    const handleModeSwitch = () => {
        if (mode === 'login') {
            setMode('register');
        } else if (mode === 'register') {
            setMode('login');
        }
        resetErrors();
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        if (mode === 'register' || mode === 'reset') {
            setConfirmPassword('');
            setResetPhone('');
            setVerificationCode('');
        }
    };

    const handleForgetPassword = () => {
        setMode('reset');
        resetErrors();
        setPasswordVisible(false);
        setConfirmPasswordVisible(false);
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setResetPhone('');
        setVerificationCode('');
    };

    const handleClose = () => {
        resetAllStates();
        setMode('login');
        onClose();
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
            onClick={handleClose}
        >
            <div
                className={`${styles.modalContent} ${isGoogleOnly ? styles.googleOnlyContent : ''}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={`${styles.closeBtn} ${isGoogleOnly ? styles.googleOnlyCloseBtn : ''}`}
                    onClick={handleClose}
                >
                    ×
                </button>

                <h2 className={`${styles.title} ${isGoogleOnly ? styles.googleOnlyTitle : ''}`}>
                    {t('auth.login')}
                </h2>

                {/* Google-only login when runtime language is English */}
                {isGoogleOnly ? (
                    <>
                        <div className={styles.googleOnlyDivider} />
                        {/* 功能注释：海外 Google 登录前须勾选同意外置隐私政策 */}
                        <div className={styles.privacyRow}>
                            <label className={styles.privacyLabel}>
                                <input
                                    type="checkbox"
                                    className={styles.privacyCheckbox}
                                    checked={privacyAgreed}
                                    onChange={(e) => {
                                        setPrivacyAgreed(e.target.checked);
                                        if (e.target.checked) setPrivacyError('');
                                    }}
                                />
                                <span>
                                    {t('auth.privacyAgreePrefix')}
                                    <a
                                        href={privacyPolicyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.privacyLink}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {t('auth.privacyPolicy')}
                                    </a>
                                </span>
                            </label>
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
                                />
                                {resetPhoneError && (
                                    <div className={styles.errorMessage}>{resetPhoneError}</div>
                                )}
                            </div>
                        )}

                        {/* 验证码输入 */}
                        {mode === 'reset' && (
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
                                    />
                                    <button
                                        type="button"
                                        className={styles.sendCodeBtn}
                                        onClick={handleSendCode}
                                        disabled={isSendingCode || countdown > 0 || !resetPhone || !validatePhone(resetPhone)}
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

                        {/* 功能注释：注册态展示隐私政策勾选，链接打开外置静态页 */}
                        {mode === 'register' && (
                            <div className={styles.privacyRow}>
                                <label className={styles.privacyLabel}>
                                    <input
                                        type="checkbox"
                                        className={styles.privacyCheckbox}
                                        checked={privacyAgreed}
                                        onChange={(e) => {
                                            setPrivacyAgreed(e.target.checked);
                                            if (e.target.checked) setPrivacyError('');
                                        }}
                                    />
                                    <span>
                                        {t('auth.privacyAgreePrefix')}
                                        <a
                                            href={privacyPolicyUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.privacyLink}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {t('auth.privacyPolicy')}
                                        </a>
                                    </span>
                                </label>
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

                        {/* 提交错误信息 */}
                        {submitError && (
                            <div
                                className={styles.errorMessage}
                                style={{
                                    textAlign: 'center',
                                    marginTop: '0px',
                                    color: submitError.includes('成功') ? '#28a745' : '#DC3545'
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
                        <button type="button" onClick={handleModeSwitch} className={styles.switchBtn}>
                            {mode === 'login' ? t('auth.registerNow') : t('auth.loginNow')}
                        </button>
                    </div>
                )}

                {!isGoogleOnly && mode === 'reset' && (
                    <div className={styles.modeSwitch}>
                        <span>{t('auth.rememberPassword')}</span>
                        <button type="button" onClick={() => setMode('login')} className={styles.switchBtn}>
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
