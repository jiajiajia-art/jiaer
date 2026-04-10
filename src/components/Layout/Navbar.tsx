import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoMailOutline, IoSearch } from 'react-icons/io5';
import styles from './Navbar.module.css';
import AuthModal from '../AuthModal';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { useMessageStore } from '../../store/useMessageStore';
import { getImageUrl } from '../../utils/constants';

const isWebViewEnv = (): boolean => {
    const win = window as { __wxjs_environment?: string };
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

type NavKey = 'home' | 'categories' | 'create' | 'warehouse' | '';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDesktopLayout, setIsDesktopLayout] = useState(window.innerWidth > 768);
    const { isAuthenticated, initialize, logout, user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { unreadCount, refreshUnreadCount, clearUnreadCount } = useMessageStore();

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (isAuthenticated) {
            // 实现消息未读数刷新
            void refreshUnreadCount();
            return;
        }

        clearUnreadCount();
    }, [clearUnreadCount, isAuthenticated, refreshUnreadCount]);

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

        if (!showUserMenu) return;
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showUserMenu]);

    const getActiveNav = (): NavKey => {
        const path = location.pathname;
        if (path === '/home' || path === '/') return 'home';
        if (path.startsWith('/categories')) return 'categories';
        if (path.startsWith('/create')) return 'create';
        if (path.startsWith('/warehouse')) return 'warehouse';
        return '';
    };

    const activeNav = getActiveNav();
    const unreadBadgeText = unreadCount > 99 ? '99+' : (unreadCount > 0 ? String(unreadCount) : '');

    const requireAuth = (): boolean => {
        if (isAuthenticated) return true;
        if (!isWebViewEnv()) {
            setIsAuthModalOpen(true);
        }
        return false;
    };

    return (
        <div className={styles.navbarContainer}>
            <div className={styles.navbar}>
                <div className={styles.logo}>
                    <img src={`${import.meta.env.BASE_URL}data/assets/LOGO2.png`} alt="logo" />
                </div>

                <div className={styles.navLinks}>
                    <div
                        className={`${styles.navLink} ${activeNav === 'home' ? styles.navLinkActive : ''}`}
                        onClick={() => navigate('/home')}
                    >
                        首页
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'categories' ? styles.navLinkActive : ''}`}
                        onClick={() => navigate('/categories')}
                    >
                        分类
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'create' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!requireAuth()) return;
                            navigate('/create');
                        }}
                    >
                        创作
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'warehouse' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!requireAuth()) return;
                            navigate('/warehouse');
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
                        <div className={styles.userActions}>
                            <button
                                type="button"
                                className={styles.messageButton}
                                onClick={() => navigate('/messages')}
                                aria-label="消息中心"
                            >
                                <IoMailOutline />
                                {unreadBadgeText ? <span className={styles.messageBadge}>{unreadBadgeText}</span> : null}
                            </button>

                            <div className={styles.avatarContainer}>
                                <div
                                    className={styles.avatar}
                                    onClick={() => {
                                        if (isWebViewEnv()) return;
                                        setShowUserMenu((prev) => !prev);
                                    }}
                                >
                                    <img
                                        src={getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/default_avatar.png`}
                                        alt=""
                                    />
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
                        </div>
                    ) : (
                        !isWebViewEnv() && (
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
                        )
                    )}
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
