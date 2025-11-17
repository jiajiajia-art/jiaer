import React, { useState, useEffect, useRef } from 'react';
import styles from './AuthModal.module.css';
import { auth } from '../api/account/authApi';
import { useAuthStore } from '../store/useAuthStore';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin?: (phone: string, password: string) => void;
    onRegister?: (phone: string, password: string) => void;
}

type AuthMode = 'login' | 'register' | 'reset';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, onRegister }) => {
    const [mode, setMode] = useState<AuthMode>('login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmailInput] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    
    // 错误状态
    const [phoneError, setPhoneError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [verificationCodeError, setVerificationCodeError] = useState('');
    
    // 震动状态
    const [phoneShake, setPhoneShake] = useState(false);
    const [passwordShake, setPasswordShake] = useState(false);
    const [confirmPasswordShake, setConfirmPasswordShake] = useState(false);
    const [emailShake, setEmailShake] = useState(false);
    const [verificationCodeShake, setVerificationCodeShake] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingCode, setIsSendingCode] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [submitError, setSubmitError] = useState('');
    const { login, setEmail } = useAuthStore();
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // 清理倒计时定时器
    useEffect(() => {
        return () => {
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
            }
        };
    }, []);

    if (!isOpen) return null;

    // ========== 验证函数 ==========
    const validatePhone = (phoneNumber: string): boolean => {
        const phoneRegex = /^1\d{10}$/;
        return phoneRegex.test(phoneNumber);
    };

    const validatePassword = (pwd: string): boolean => {
        return pwd.length >= 6;
    };

    const validateEmail = (emailAddress: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailAddress);
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
        setEmailInput('');
        setVerificationCode('');
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setEmailError('');
        setVerificationCodeError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setEmailShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
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
        setEmailError('');
        setVerificationCodeError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setEmailShake(false);
        setVerificationCodeShake(false);
        setSubmitError('');
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
                setConfirmPasswordError('两次输入的密码不一致');
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
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, '两次输入的密码不一致');
            } else {
                clearFieldError(setConfirmPasswordError, setConfirmPasswordShake);
            }
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEmailInput(e.target.value);
        if (emailError) clearFieldError(setEmailError, setEmailShake);
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
        if (!email) {
            setFieldError(setEmailError, setEmailShake, '请输入邮箱');
            return;
        }

        if (!validateEmail(email)) {
            setFieldError(setEmailError, setEmailShake, '请输入正确的邮箱格式');
            return;
        }

        setIsSendingCode(true);
        try {
            await auth.sendResetCode({ email });
            setSubmitError('验证码已发送，请查收邮箱');
            startCountdown();
        } catch (error: any) {
            console.error('发送验证码失败:', error);
            const errorMessage = error.response?.data?.message || error.message || '发送验证码失败，请稍后重试';
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
                setFieldError(setPhoneError, setPhoneShake, '请输入正确的手机号');
                hasError = true;
            }
            if (!validatePassword(password)) {
                setFieldError(setPasswordError, setPasswordShake, '密码至少需要6位');
                hasError = true;
            }
        }

        // 注册模式验证
        if (mode === 'register') {
            if (!validatePhone(phone)) {
                setFieldError(setPhoneError, setPhoneShake, '请输入正确的手机号');
                hasError = true;
            }
            if (!validatePassword(password)) {
                setFieldError(setPasswordError, setPasswordShake, '密码至少需要6位');
                hasError = true;
            }
            if (!confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, '请再次输入密码');
                hasError = true;
            } else if (password !== confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, '两次输入的密码不一致');
                hasError = true;
            }
            if (!email) {
                setFieldError(setEmailError, setEmailShake, '请输入邮箱');
                hasError = true;
            } else if (!validateEmail(email)) {
                setFieldError(setEmailError, setEmailShake, '请输入正确的邮箱格式');
                hasError = true;
            }
            if (!verificationCode) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, '请输入验证码');
                hasError = true;
            } else if (verificationCode.length !== 6) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, '验证码为6位数字');
                hasError = true;
            }
        }

        // 重置密码模式验证
        if (mode === 'reset') {
            if (!email) {
                setFieldError(setEmailError, setEmailShake, '请输入邮箱');
                hasError = true;
            } else if (!validateEmail(email)) {
                setFieldError(setEmailError, setEmailShake, '请输入正确的邮箱格式');
                hasError = true;
            }
            if (!verificationCode) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, '请输入验证码');
                hasError = true;
            } else if (verificationCode.length !== 6) {
                setFieldError(setVerificationCodeError, setVerificationCodeShake, '验证码为6位数字');
                hasError = true;
            }
            if (!validatePassword(password)) {
                setFieldError(setPasswordError, setPasswordShake, '密码至少需要6位');
                hasError = true;
            }
            if (!confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, '请再次输入密码');
                hasError = true;
            } else if (password !== confirmPassword) {
                setFieldError(setConfirmPasswordError, setConfirmPasswordShake, '两次输入的密码不一致');
                hasError = true;
            }
        }

        return !hasError;
    };

    // ========== 表单提交 ==========
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            console.log('[Auth] 表单验证失败，停止提交');
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
                    if (onLogin) {
                        onLogin(phone, password);
                    }
                    resetAllStates();
                    onClose();
                } else {
                    throw new Error('服务器返回数据格式错误');
                }
            } else if (mode === 'register') {
                const response = await auth.signup({
                    phoneNumber: phone,
                    password: password,
                    email: email,
                    avatarUrl: '',
                    nickname: '',
                    verificationCode: verificationCode,
                });
                
                if (response.data?.data) {
                    setEmail(email);
                    setMode('login');
                    setPassword('');
                    setConfirmPassword('');
                    resetErrors();
                    setSubmitError('注册成功！请登录');
                    
                    if (onRegister) {
                        onRegister(phone, password);
                    }
                } else {
                    throw new Error('服务器返回数据格式错误');
                }
            } else if (mode === 'reset') {
                const response = await auth.resetPassword({
                    email: email,
                    code: verificationCode,
                    newPassword: password,
                    confirmNewPassword: password,
                });
                
                if (response.data?.data || response.data?.success) {
                    setSubmitError('密码重置成功！请登录');
                    resetAllStates();
                    setTimeout(() => {
                        setMode('login');
                        setSubmitError('');
                    }, 2000);
                } else {
                    throw new Error('服务器返回数据格式错误');
                }
            }
        } catch (error: any) {
            console.error('操作失败:', error);
            const errorMessage = error.response?.data?.message || error.message || '操作失败，请稍后重试';
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
        if (mode === 'register' || mode === 'reset') {
            setConfirmPassword('');
            setEmailInput('');
            setVerificationCode('');
            setCountdown(0);
            if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
            }
        }
    };

    const handleForgetPassword = () => {
        setMode('reset');
        resetErrors();
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setVerificationCode('');
        setCountdown(0);
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    };

    const handleClose = () => {
        resetAllStates();
        setMode('login');
        onClose();
    };

    // ========== 渲染辅助函数 ==========
    const getTitle = () => {
        switch (mode) {
            case 'login': return '登录';
            case 'register': return '注册';
            case 'reset': return '重置密码';
        }
    };

    const getSubmitButtonText = () => {
        if (isLoading) return '处理中...';
        switch (mode) {
            case 'login': return '登录';
            case 'register': return '注册';
            case 'reset': return '重置密码';
        }
    };

    return (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.closeBtn} onClick={handleClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                
                <h2 className={styles.title}>{getTitle()}</h2>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {/* 手机号输入 */}
                    {mode !== 'reset' && (
                        <div className={styles.inputGroup}>
                            <input
                                type="tel"
                                className={`${styles.input} ${phoneError ? styles.inputError : ''} ${phoneShake ? styles.shake : ''}`}
                                placeholder="请输入手机号"
                                value={phone}
                                onChange={handlePhoneChange}
                                maxLength={11}
                            />
                            {phoneError && (
                                <div className={styles.errorMessage}>{phoneError}</div>
                            )}
                        </div>
                    )}

                    {/* 邮箱输入 */}
                    {(mode === 'register' || mode === 'reset') && (
                        <div className={styles.inputGroup}>
                            <input
                                type="email"
                                className={`${styles.input} ${emailError ? styles.inputError : ''} ${emailShake ? styles.shake : ''}`}
                                placeholder="请输入邮箱"
                                value={email}
                                onChange={handleEmailChange}
                            />
                            {emailError && (
                                <div className={styles.errorMessage}>{emailError}</div>
                            )}
                        </div>
                    )}

                    {/* 验证码输入（注册/重置） */}
                    {(mode === 'register' || mode === 'reset') && (
                        <div className={styles.inputGroup}>
                            <div className={styles.codeInputWrapper}>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className={`${styles.input} ${styles.codeInput} ${verificationCodeError ? styles.inputError : ''} ${verificationCodeShake ? styles.shake : ''}`}
                                    placeholder="请输入验证码"
                                    value={verificationCode}
                                    onChange={handleVerificationCodeChange}
                                    maxLength={6}
                                />
                                <button
                                    type="button"
                                    className={styles.sendCodeBtn}
                                    onClick={handleSendCode}
                                    disabled={isSendingCode || countdown > 0 || !email || !validateEmail(email)}
                                >
                                    {isSendingCode
                                        ? '发送中...'
                                        : countdown > 0
                                            ? `${countdown}秒`
                                            : '获取验证码'
                                    }
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
                            <input
                                type="password"
                                className={`${styles.input} ${passwordError ? styles.inputError : ''} ${passwordShake ? styles.shake : ''}`}
                                placeholder="请输入密码"
                                value={password}
                                onChange={handlePasswordChange}
                            />
                            {passwordError && (
                                <div className={styles.errorMessage}>{passwordError}</div>
                            )}
                            {mode === 'login' && (
                                <div className={styles.forgetPassword} onClick={handleForgetPassword}>
                                    忘记密码
                                </div>
                            )}
                        </div>
                    )}

                    {/* 确认密码输入（注册） */}
                    {mode === 'register' && (
                        <div className={styles.inputGroup}>
                            <input
                                type="password"
                                className={`${styles.input} ${confirmPasswordError ? styles.inputError : ''} ${confirmPasswordShake ? styles.shake : ''}`}
                                placeholder="请再次输入密码"
                                value={confirmPassword}
                                onChange={handleConfirmPasswordChange}
                            />
                            {confirmPasswordError && (
                                <div className={styles.errorMessage}>{confirmPasswordError}</div>
                            )}
                        </div>
                    )}

                    {/* 新密码输入（重置） */}
                    {mode === 'reset' && (
                        <>
                            <div className={styles.inputGroup}>
                                <input
                                    type="password"
                                    className={`${styles.input} ${passwordError ? styles.inputError : ''} ${passwordShake ? styles.shake : ''}`}
                                    placeholder="请输入新密码"
                                    value={password}
                                    onChange={handlePasswordChange}
                                />
                                {passwordError && (
                                    <div className={styles.errorMessage}>{passwordError}</div>
                                )}
                            </div>
                            <div className={styles.inputGroup}>
                                <input
                                    type="password"
                                    className={`${styles.input} ${confirmPasswordError ? styles.inputError : ''} ${confirmPasswordShake ? styles.shake : ''}`}
                                    placeholder="请再次输入新密码"
                                    value={confirmPassword}
                                    onChange={handleConfirmPasswordChange}
                                />
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

                {/* 模式切换 */}
                {mode !== 'reset' && (
                    <div className={styles.modeSwitch}>
                        <span>
                            {mode === 'login' ? '还没有账号？' : '已有账号？'}
                        </span>
                        <button type="button" onClick={handleModeSwitch} className={styles.switchBtn}>
                            {mode === 'login' ? '立即注册' : '立即登录'}
                        </button>
                    </div>
                )}

                {mode === 'reset' && (
                    <div className={styles.modeSwitch}>
                        <span>想起密码了？</span>
                        <button type="button" onClick={() => setMode('login')} className={styles.switchBtn}>
                            返回登录
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuthModal;
