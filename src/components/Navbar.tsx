import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import AuthModal from './AuthModal';
import { authModalStore, useAuthStore } from '../store/useAuthStore';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const { isAuthenticated, initialize, logout, user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();

    // 初始化时检查登录状态
    useEffect(() => {
        initialize();
    }, [initialize]);

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest(`.${styles.avatarContainer}`)) {
                setShowUserMenu(false);
            }
        };

        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showUserMenu]);

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
                <div className={styles.logo}>
                    <img src={`${import.meta.env.BASE_URL}data/asset/网站图标.png`} alt="logo" />
                </div>
                <div className={styles.navLinks}>
                    <div
                        className={`${styles.navLink} ${activeNav === '商城' ? styles.navLinkActive : ''}`}
                        onClick={() => handleNavClick('商城')}
                    >
                        商城
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === '创作' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!isAuthenticated) {
                                setIsAuthModalOpen(true);
                                return;
                            }
                            handleNavClick('创作')
                        }}
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
                    {isAuthenticated ? (
                        <div className={styles.avatarContainer}>
                            <div 
                                className={styles.avatar}
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                <img src={user?.user.avatarUrl || `${import.meta.env.BASE_URL}data/avatars/hunter.png`} alt="" />
                            </div>
                            {showUserMenu && (
                                <div className={styles.userMenu}>
                                    <button 
                                        className={styles.logoutBtn}
                                        onClick={() => {
                                            logout();
                                            setShowUserMenu(false);
                                        }}
                                    >
                                        退出登录
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button 
                            className={styles.loginBtn} 
                            onClick={() => setIsAuthModalOpen(true)}
                        >
                            登录/注册
                        </button>
                    )}
                    <img src={`${import.meta.env.BASE_URL}data/asset/设置.png`} alt="" className={styles.settingIcon} />
                </div>
            </div>
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </>
    );
};

export default Navbar;
