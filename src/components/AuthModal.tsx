import React, { useState } from 'react';
import styles from './AuthModal.module.css';
import { auth } from '../api/account/authApi';
import { useAuthStore } from '../store/useAuthStore';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin?: (phone: string, password: string) => void;
    onRegister?: (phone: string, password: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onLogin, onRegister }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmailInput] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [phoneShake, setPhoneShake] = useState(false);
    const [passwordShake, setPasswordShake] = useState(false);
    const [confirmPasswordShake, setConfirmPasswordShake] = useState(false);
    const [emailShake, setEmailShake] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const { login, setEmail } = useAuthStore();

    if (!isOpen) return null;

    // 验证手机号：11位，1开头
    const validatePhone = (phoneNumber: string): boolean => {
        const phoneRegex = /^1\d{10}$/;
        return phoneRegex.test(phoneNumber);
    };

    // 验证密码：至少6位
    const validatePassword = (pwd: string): boolean => {
        return pwd.length >= 6;
    };

    // 验证邮箱格式
    const validateEmail = (emailAddress: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailAddress);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPhone(value);
        // 清除错误状态
        if (phoneError) {
            setPhoneError('');
            setPhoneShake(false);
        }
    };

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPassword(value);
        // 清除错误状态
        if (passwordError) {
            setPasswordError('');
            setPasswordShake(false);
        }
        // 如果确认密码已填写，重新验证
        if (confirmPassword && mode === 'register') {
            if (value !== confirmPassword) {
                setConfirmPasswordError('两次输入的密码不一致');
            } else {
                setConfirmPasswordError('');
                setConfirmPasswordShake(false);
            }
        }
    };

    const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setConfirmPassword(value);
        // 清除错误状态
        if (confirmPasswordError) {
            setConfirmPasswordError('');
            setConfirmPasswordShake(false);
        }
        // 验证密码是否一致
        if (value && password) {
            if (value !== password) {
                setConfirmPasswordError('两次输入的密码不一致');
                setConfirmPasswordShake(true);
                setTimeout(() => setConfirmPasswordShake(false), 500);
            } else {
                setConfirmPasswordError('');
            }
        }
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setEmailInput(value);
        // 清除错误状态
        if (emailError) {
            setEmailError('');
            setEmailShake(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();        
        let hasError = false;
        setSubmitError('');

        if (!validatePhone(phone)) {
            setPhoneError('请输入正确的手机号');
            setPhoneShake(true);
            hasError = true;
            setTimeout(() => setPhoneShake(false), 500);
        }

        if (!validatePassword(password)) {
            setPasswordError('密码至少需要6位');
            setPasswordShake(true);
            hasError = true;
            setTimeout(() => setPasswordShake(false), 500);
        }

        if (mode === 'register') {
            if (!confirmPassword) {
                setConfirmPasswordError('请再次输入密码');
                setConfirmPasswordShake(true);
                hasError = true;
                setTimeout(() => setConfirmPasswordShake(false), 500);
            } else if (password !== confirmPassword) {
                setConfirmPasswordError('两次输入的密码不一致');
                setConfirmPasswordShake(true);
                hasError = true;
                setTimeout(() => setConfirmPasswordShake(false), 500);
            }
        }

        if (mode === 'register') {
            if (!email) {
                setEmailError('请输入邮箱');
                setEmailShake(true);
                hasError = true;
                setTimeout(() => setEmailShake(false), 500);
            } else if (!validateEmail(email)) {
                setEmailError('请输入正确的邮箱格式');
                setEmailShake(true);
                hasError = true;
                setTimeout(() => setEmailShake(false), 500);
            }
        }

        if (hasError) {
            console.log('[Auth] 表单验证失败，停止提交');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'login') {
                const response = await auth.login({
                    username: phone,
                    password: password,
                });
                
                
                if (response.data?.data) {
                    const authData = response.data.data;
                    // 登录成功后保存状态（会自动持久化到 localStorage）
                    login(authData);                    
                    // 调用回调
                    if (onLogin) {
                        onLogin(phone, password);
                    }
                    
                    // 成功：清空表单并关闭弹窗
                    setPhone('');
                    setPassword('');
                    setPhoneError('');
                    setPasswordError('');
                    setSubmitError('');
                    onClose();
                } else {
                    throw new Error('服务器返回数据格式错误');
                }
            } else {
                // 注册请求
                const response = await auth.signup({
                    username: phone,
                    password: password,
                    email: email,
                });
                                
                if (response.data?.data) {
                    // 注册成功，保存邮箱到zustand
                    setEmail(email);
                    
                    setMode('login');
                    setPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                    setConfirmPasswordError('');
                    setSubmitError('');
                    setPhoneError('');
                    setEmailError('');
                    
                    setSubmitError('注册成功！请登录');
                    
                    if (onRegister) {
                        onRegister(phone, password);
                    }
                    
                } else {
                    throw new Error('服务器返回数据格式错误');
                }
            }
        } catch (error: any) {
            console.error('登录/注册失败:', error);
            const errorMessage = error.response?.data?.message || error.message || '登录/注册失败，请稍后重试';
            setSubmitError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModeSwitch = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setEmailError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setEmailShake(false);
        setSubmitError('');
        // 切换到登录模式时清空确认密码和邮箱
        if (mode === 'register') {
            setConfirmPassword('');
            setEmailInput('');
        }
    };

    const handleClose = () => {
        setPhone('');
        setPassword('');
        setConfirmPassword('');
        setEmailInput('');
        setPhoneError('');
        setPasswordError('');
        setConfirmPasswordError('');
        setEmailError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setConfirmPasswordShake(false);
        setEmailShake(false);
        onClose();
    };

    return (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.closeBtn} onClick={handleClose}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/关闭按钮.png`} alt="关闭" />
                </div>
                
                <h2 className={styles.title}>
                    {mode === 'login' ? '登录' : '注册'}
                </h2>

                <form className={styles.form} onSubmit={handleSubmit}>
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

                    {mode === 'register' && (
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
                    </div>

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
                    <button 
                        type="submit" 
                        className={styles.submitBtn}
                        disabled={isLoading}
                    >
                        {isLoading ? '处理中...' : (mode === 'login' ? '登录' : '注册')}
                    </button>
                </form>

                <div className={styles.modeSwitch}>
                    <span>
                        {mode === 'login' ? '还没有账号？' : '已有账号？'}
                    </span>
                    <button type="button" onClick={handleModeSwitch} className={styles.switchBtn}>
                        {mode === 'login' ? '立即注册' : '立即登录'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;





