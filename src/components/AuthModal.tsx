import React, { useState } from 'react';
import styles from './AuthModal.module.css';

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let hasError = false;

        // 验证手机号
        if (!validatePhone(phone)) {
            setPhoneError('请输入正确的手机号');
            setPhoneShake(true);
            hasError = true;
            // 抖动动画结束后移除class
            setTimeout(() => setPhoneShake(false), 500);
        }

        // 验证密码
        if (!validatePassword(password)) {
            setPasswordError('密码至少需要6位');
            setPasswordShake(true);
            hasError = true;
            // 抖动动画结束后移除class
            setTimeout(() => setPasswordShake(false), 500);
        }

        if (!hasError) {
            if (mode === 'login' && onLogin) {
                onLogin(phone, password);
            } else if (mode === 'register' && onRegister) {
                onRegister(phone, password);
            }
            // 清空表单
            setPhone('');
            setPassword('');
            setPhoneError('');
            setPasswordError('');
        }
    };

    const handleModeSwitch = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        // 切换模式时清空错误状态
        setPhoneError('');
        setPasswordError('');
        setPhoneShake(false);
        setPasswordShake(false);
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

                    <button type="submit" className={styles.submitBtn}>
                        {mode === 'login' ? '登录' : '注册'}
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





