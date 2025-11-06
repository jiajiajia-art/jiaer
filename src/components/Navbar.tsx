import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import AuthModal from './AuthModal';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    // 根据当前路径确定激活的导航项（支持嵌套路由）
    const getActiveNav = () => {
        const path = location.pathname;
        // 使用 startsWith 匹配路径前缀，支持嵌套路由
        if (path.startsWith('/home')) {
            return '商城';
        } else if (path.startsWith('/create')) {
            return '创作';
        } else if (path.startsWith('/warehouse')) {
            return '仓库';
        }
        return '商城';
    };

    const activeNav = getActiveNav();

    const handleNavClick = (navName: string) => {
        switch (navName) {
            case '商城':
                navigate('/home');
                break;
            case '创作':
                navigate('/create');
                break;
            case '仓库':
                navigate('/warehouse');
                break;
            default:
                break;
        }
    };

    return (
        <>
            <div className={styles.navbar}>
                <div className={styles.navLinks}>
                    <div
                        className={`${styles.navLink} ${activeNav === '商城' ? styles.navLinkActive : ''}`}
                        onClick={() => handleNavClick('商城')}
                    >
                        商城
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === '创作' ? styles.navLinkActive : ''}`}
                        onClick={() => handleNavClick('创作')}
                    >
                        创作
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === '仓库' ? styles.navLinkActive : ''}`}
                    >
                        仓库
                    </div>
                </div>
                <div className={styles.navRight}>
                    <div className={styles.searchBox}>
                        <input className={styles.searchInput} placeholder="搜索商品、素材、事件..." />
                        <span className={styles.searchIcon}></span>
                    </div>
                    {isLoggedIn ? (
                        <div className={styles.avatar}>
                            <img src={`${import.meta.env.BASE_URL}data/avatars/hunter.png`} alt="" />
                        </div>
                    ) : (
                        <button 
                            className={styles.loginBtn} 
                            onClick={() => setShowAuthModal(true)}
                        >
                            登录/注册
                        </button>
                    )}
                    <img src={`${import.meta.env.BASE_URL}data/asset/设置.png`} alt="" className={styles.settingIcon} />
                </div>
            </div>
            <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                onLogin={(phone, password) => {
                    // 处理登录逻辑
                    console.log('登录:', phone, password);
                    // TODO: 调用登录 API
                    setIsLoggedIn(true);
                    setShowAuthModal(false);
                }}
                onRegister={(phone, password) => {
                    // 处理注册逻辑
                    console.log('注册:', phone, password);
                    // TODO: 调用注册 API
                    setIsLoggedIn(true);
                    setShowAuthModal(false);
                }}
            />
        </>
    );
};

export default Navbar;
