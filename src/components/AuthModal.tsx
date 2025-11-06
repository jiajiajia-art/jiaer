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
    const [phoneError, setPhoneError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [phoneShake, setPhoneShake] = useState(false);
    const [passwordShake, setPasswordShake] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const { login } = useAuthStore();

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
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log('[Auth] 表单提交:', { mode, phone, passwordLength: password.length });
        
        let hasError = false;
        setSubmitError('');

        // 验证手机号
        if (!validatePhone(phone)) {
            console.log('[Auth] 手机号验证失败:', phone);
            setPhoneError('请输入正确的手机号');
            setPhoneShake(true);
            hasError = true;
            setTimeout(() => setPhoneShake(false), 500);
        }

        // 验证密码
        if (!validatePassword(password)) {
            console.log('[Auth] 密码验证失败:', password.length);
            setPasswordError('密码至少需要6位');
            setPasswordShake(true);
            hasError = true;
            setTimeout(() => setPhoneShake(false), 500);
        }

        if (hasError) {
            console.log('[Auth] 表单验证失败，停止提交');
            return;
        }

        console.log('[Auth] 表单验证通过，开始请求');

        setIsLoading(true);
        try {
            if (mode === 'login') {
                // 登录请求
                console.log('[Auth] 开始登录请求:', { username: phone, passwordLength: password.length });
                const response = await auth.login({
                    username: phone,
                    password: password,
                });
                
                console.log('[Auth] 登录响应:', response);
                
                if (response.data?.data) {
                    const authData = response.data.data;
                    // 登录成功后保存状态（会自动持久化到 localStorage）
                    login(authData);
                    console.log('[Auth] 登录成功，状态已保存到 localStorage');
                    
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
                console.log('[Auth] 开始注册请求:', { username: phone, passwordLength: password.length, mode });
                const response = await auth.signup({
                    username: phone,
                    password: password,
                });
                
                console.log('[Auth] 注册响应:', response);
                
                if (response.data?.data) {
                    // 注册成功，只返回User，不直接登录
                    // 切换到登录模式，保留手机号，清空密码
                    setMode('login');
                    setPassword('');
                    setPasswordError('');
                    setSubmitError('');
                    setPhoneError('');
                    
                    // 显示成功提示
                    setSubmitError('注册成功！请登录');
                    
                    // 调用回调
                    if (onRegister) {
                        onRegister(phone, password);
                    }
                    
                    console.log('[Auth] 注册成功，已切换到登录模式');
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
        // 切换模式时清空错误状态
        setPhoneError('');
        setPasswordError('');
        setPhoneShake(false);
        setPasswordShake(false);
        setSubmitError('');
    };

    const handleClose = () => {
        setPhone('');
        setPassword('');
        setPhoneError('');
        setPasswordError('');
        setPhoneShake(false);
        setPasswordShake(false);
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





