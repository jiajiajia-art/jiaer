import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoSearch } from 'react-icons/io5';
import styles from './Navbar.module.css';
import AuthModal from '../AuthModal';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { getImageUrl } from '../../utils/constants';

const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDesktopLayout, setIsDesktopLayout] = useState(window.innerWidth > 768);
    const { isAuthenticated, initialize, logout, user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        const handleResize = () => {
            setIsDesktopLayout(window.innerWidth > 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

    const getActiveNav = () => {
        const path = location.pathname;
        if (path === '/home' || path === '/') {
            return '首页';
        }
        if (path.startsWith('/create')) {
            return '创作';
        }
        if (path.startsWith('/warehouse')) {
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
                                if (!isWebViewEnv()) {
                                    setIsAuthModalOpen(true);
                                }
                                return;
                            }
                            handleNavClick('创作');
                        }}
                    >
                        创作
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === '仓库' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!isAuthenticated) {
                                if (!isWebViewEnv()) {
                                    setIsAuthModalOpen(true);
                                }
                                return;
                            }
                            handleNavClick('仓库');
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
                                }}
                            >
                                <img src={getImageUrl(user?.user.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/default_avatar.png`} alt="" />
                            </div>
                            {showUserMenu && !isWebViewEnv() && (
                                <div className={styles.userMenu}>
                                    <button
                                        className={styles.menuBtn}
                                        onClick={() => {
                                            navigate('/profile');
                                            setShowUserMenu(false);
                                        }}
                                    >
                                        个人中心
                                    </button>
                                    {user?.user?.role === 'admin' && isDesktopLayout && (
                                        <button
                                            className={styles.menuBtn}
                                            onClick={() => {
                                                // 实现管理员 PC 端管理面板入口
                                                navigate('/admin');
                                                setShowUserMenu(false);
                                            }}
                                        >
                                            管理面板
                                        </button>
                                    )}
                                    <button
                                        className={`${styles.menuBtn} ${styles.logoutBtn}`}
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
                        !isWebViewEnv() ? (
                            <button
                                className={styles.loginBtn}
                                onClick={() => {
                                    if (!isWebViewEnv()) {
                                        setIsAuthModalOpen(true);
                                    }
                                }}
                            >
                                登录
                            </button>
                        ) : <></>)}
                </div>
            </div>
            {!isWebViewEnv() && (
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                />
            )}
        </div>
    );
};

export default Navbar;
