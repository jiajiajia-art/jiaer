import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import AuthModal from '../AuthModal';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { IoSearch } from 'react-icons/io5';
import { getImageUrl } from '../../utils/constants';

const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

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

    // 根据当前路径确定激活的导航项
    const getActiveNav = () => {
        const path = location.pathname;
        // 精确匹配路径
        if (path === '/home' || path === '/') {
            return '首页';
        } else if (path.startsWith('/create')) {
            return '创作';
        } else if (path.startsWith('/warehouse')) {
            return '仓库';
        }
        return '';
    };

    const activeNav = getActiveNav();

    const handleNavClick = (navName: string) => {
        switch (navName) {
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
        <div className={styles.navbarContainer}>
            <div className={styles.navbar}>
                <div className={styles.logo}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/LOGO2.png`} alt="logo" />
                </div>
                <div className={styles.navLinks}>
                    <div
                        className={`${styles.navLink} ${activeNav === '首页' ? styles.navLinkActive : ''}`}
                        onClick={() => navigate('/home')}
                    >
                        首页
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
                        onClick={() => {
                            if (!isAuthenticated) {
                                setIsAuthModalOpen(true);
                                return;
                            }
                            handleNavClick('仓库')
                        }}
                    >
                        仓库
                    </div>
                </div>
                <div className={styles.navRight}>
                    <div className={styles.searchBox}>
                        <input className={styles.searchInput} placeholder="" />
                        <span className={styles.searchIcon}>
                            <IoSearch />
                        </span>
                    </div>
                    {isAuthenticated ? (
                        <div className={styles.avatarContainer}>
                            <div
                                className={styles.avatar}
                                onClick={() => {
                                    if (isWebViewEnv()) return;
                                    setShowUserMenu(!showUserMenu);
                                }}                            >
                                <img src={getImageUrl(user?.user.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/default_avatar.png`} alt="" />
                            </div>
                            {showUserMenu && !isWebViewEnv() && (
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
                            登录
                        </button>
                    )}
                </div>
            </div>
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
            />
        </div>
    );
};

export default Navbar;
