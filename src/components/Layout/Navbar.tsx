import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IoMailOutline, IoSearch } from 'react-icons/io5';
import styles from './Navbar.module.css';
import AuthModal from '../AuthModal';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { useMessageStore } from '../../store/useMessageStore';
import getGameDataApi from '../../api/home/getGameData';
import type { UserGameData } from '../../api/home/getGameData.type';
import { getImageUrl } from '../../utils/constants';

const isWebViewEnv = (): boolean => {
    const win = window as { __wxjs_environment?: string };
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_SIZE = 8;

const getSearchResultId = (game: UserGameData): string => String(game.file_id || game.id || '').trim();

const getSearchResultMeta = (game: UserGameData): string => {
    const subtitle = String(game.subtitle || '').trim();
    if (subtitle) return subtitle;
    return String(game.file_id || '').trim();
};

type NavKey = 'home' | 'categories' | 'create' | 'warehouse' | '';
type NavbarProps = {
    mobileVariant?: 'default' | 'home-overlay';
    mobileOverlayScrolled?: boolean;
};

const Navbar: React.FC<NavbarProps> = ({
    mobileVariant = 'default',
    mobileOverlayScrolled = false,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDesktopLayout, setIsDesktopLayout] = useState(window.innerWidth > 768);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState<UserGameData[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [searchError, setSearchError] = useState('');
    const { isAuthenticated, initialize, logout, user } = useAuthStore();
    const { isAuthModalOpen, setIsAuthModalOpen } = authModalStore();
    const { unreadCount, refreshUnreadCount, clearUnreadCount } = useMessageStore();
    const avatarContainerRef = useRef<HTMLDivElement | null>(null);
    const searchBoxRef = useRef<HTMLFormElement | null>(null);
    const searchRequestIdRef = useRef(0);

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
            const target = event.target as Node;

            if (showUserMenu && avatarContainerRef.current && !avatarContainerRef.current.contains(target)) {
                setShowUserMenu(false);
            }

            if (isSearchOpen && searchBoxRef.current && !searchBoxRef.current.contains(target)) {
                setIsSearchOpen(false);
            }
        };

        if (!showUserMenu && !isSearchOpen) return;
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSearchOpen, showUserMenu]);

    useEffect(() => {
        setShowUserMenu(false);
        setIsSearchOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const trimmedKeyword = searchKeyword.trim();
        const requestId = searchRequestIdRef.current + 1;
        searchRequestIdRef.current = requestId;

        if (!trimmedKeyword) {
            setSearchResults([]);
            setSearchError('');
            setHasSearched(false);
            setIsSearching(false);
            setIsSearchOpen(false);
            return;
        }

        setSearchResults([]);
        setSearchError('');
        setHasSearched(false);

        const timer = window.setTimeout(async () => {
            try {
                // Load published game suggestions for the current keyword.
                setIsSearching(true);
                const response = await getGameDataApi.searchPublicGames({
                    q: trimmedKeyword,
                    page: 1,
                    pageSize: SEARCH_PAGE_SIZE,
                    sort: 'relevance',
                });

                if (requestId !== searchRequestIdRef.current) return;

                setSearchResults(Array.isArray(response.data?.data) ? response.data.data : []);
                setSearchError('');
                setHasSearched(true);
                setIsSearchOpen(true);
            } catch {
                if (requestId !== searchRequestIdRef.current) return;

                setSearchResults([]);
                setSearchError('Search failed.');
                setHasSearched(true);
                setIsSearchOpen(true);
            } finally {
                if (requestId === searchRequestIdRef.current) {
                    setIsSearching(false);
                }
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [searchKeyword]);

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
    const logoSrc = `${import.meta.env.BASE_URL}data/assets/${isDesktopLayout ? 'LOGO2.png' : 'LOGO2-mobile.png'}`;
    const navbarContainerClassName = [
        styles.navbarContainer,
        mobileVariant === 'home-overlay' ? styles.navbarContainerMobileHome : '',
        mobileVariant === 'home-overlay' && !mobileOverlayScrolled
            ? styles.navbarContainerMobileHomeOverlayActive
            : '',
    ].filter(Boolean).join(' ');
    const shouldShowSearchPanel = Boolean(searchKeyword.trim()) && isSearchOpen && (isSearching || hasSearched);

    const requireAuth = (): boolean => {
        if (isAuthenticated) return true;
        if (!isWebViewEnv()) {
            setIsAuthModalOpen(true);
        }
        return false;
    };

    const resetSearchState = () => {
        // Reset transient search state after navigation or manual close.
        searchRequestIdRef.current += 1;
        setSearchKeyword('');
        setSearchResults([]);
        setSearchError('');
        setHasSearched(false);
        setIsSearching(false);
        setIsSearchOpen(false);
    };

    const handleSearchSelect = (game: UserGameData) => {
        const gameId = getSearchResultId(game);
        if (!gameId) return;

        resetSearchState();
        navigate(`/game/${gameId}`, { state: { source: 'search' } });
    };

    const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!searchKeyword.trim()) {
            setIsSearchOpen(false);
            return;
        }

        const firstResult = searchResults[0];
        if (firstResult) {
            handleSearchSelect(firstResult);
            return;
        }

        if (isSearching || hasSearched) {
            setIsSearchOpen(true);
        }
    };

    return (
        <div className={navbarContainerClassName}>
            <div className={styles.navbar}>
                <div className={styles.logo}>
                    <img src={logoSrc} alt="logo" />
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
                    <form
                        ref={searchBoxRef}
                        className={styles.searchBox}
                        onSubmit={handleSearchSubmit}
                        role="search"
                    >
                        <input
                            className={styles.searchInput}
                            placeholder="Search games"
                            value={searchKeyword}
                            onChange={(event) => setSearchKeyword(event.target.value)}
                            onFocus={() => {
                                if (searchKeyword.trim() && (isSearching || hasSearched)) {
                                    setIsSearchOpen(true);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Escape') {
                                    setIsSearchOpen(false);
                                }
                            }}
                            autoComplete="off"
                            aria-label="Search published games"
                        />
                        <button type="submit" className={styles.searchIcon} aria-label="Submit game search">
                            <IoSearch />
                        </button>

                        {shouldShowSearchPanel ? (
                            <div className={styles.searchPanel}>
                                {isSearching ? <div className={styles.searchEmpty}>Searching...</div> : null}
                                {!isSearching && searchError ? <div className={styles.searchEmpty}>{searchError}</div> : null}
                                {!isSearching && !searchError && searchResults.length === 0 ? (
                                    <div className={styles.searchEmpty}>没有找到游戏</div>
                                ) : null}
                                {!isSearching && !searchError && searchResults.map((game) => {
                                    const gameId = getSearchResultId(game);
                                    if (!gameId) return null;

                                    return (
                                        <button
                                            key={gameId}
                                            type="button"
                                            className={styles.searchItem}
                                            onClick={() => handleSearchSelect(game)}
                                        >
                                            <span className={styles.searchItemTitle}>{game.title || gameId}</span>
                                            <span className={styles.searchItemMeta}>{getSearchResultMeta(game)}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : null}
                    </form>

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

                            <div ref={avatarContainerRef} className={styles.avatarContainer}>
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
