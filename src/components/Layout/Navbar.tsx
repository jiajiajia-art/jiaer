import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './Navbar.module.css';
import AuthModal from '../AuthModal';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { useMessageStore } from '../../store/useMessageStore';
import { useMessageRealtime } from '../../hooks/useMessageRealtime';
import getGameDataApi from '../../api/home/getGameData';
import type { UserGameData } from '../../api/home/getGameData.type';
import { getImageUrl } from '../../utils/constants';
import { buildGameDetailNavigateState } from '../../utils/gameDetailNavigation';
import { isAdminRole, isOperatorRole, isVerifiedCreatorRole } from '../../utils/userRoles';
import { resolveSearchResultSecondaryLine } from '../../lib/gameCardBody';
import { isCreatorRoutePath } from '../../utils/miniProgram';
import {
    applyAppLanguage,
    getNavbarLanguageTriggerLabel,
    normalizeAppLanguage,
    type AppLanguageCode,
} from '../../utils/appLanguage';
import UserAvatar from '../UserAvatar';
import LanguageSelectModal from './LanguageSelectModal';

/** 功能注释：暗色 funloom 导航图标基路径（assetsv2/home） */
const HOME_ICON_BASE = `${import.meta.env.BASE_URL}data/assetsv2/home`;
const NAV_SEARCH_ICON = `${HOME_ICON_BASE}/nav_search.webp`;
const NAV_MESSAGE_ICON = `${HOME_ICON_BASE}/nav_message.webp`;
/** 功能注释：顶栏圆形按钮半透明底（效果图切图） */
const NAV_BTN_BG = `${HOME_ICON_BASE}/nav_btn_bg.webp`;
const NAVBAR_BTN_BG_STYLE = {
    ['--navbar-btn-circle-bg' as string]: `url("${NAV_BTN_BG}")`,
};

const isWebViewEnv = (): boolean => {
    const win = window as { __wxjs_environment?: string };
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_PAGE_SIZE = 8;

const getSearchResultId = (game: UserGameData): string => String(game.file_id || game.id || '').trim();

type NavKey = 'home' | 'categories' | 'create' | 'warehouse' | 'rank' | '';
type NavbarProps = {
    mobileVariant?: 'default' | 'home-overlay';
    mobileOverlayScrolled?: boolean;
    beforeLeaveAction?: (action: () => void) => void;
};

const Navbar: React.FC<NavbarProps> = ({
    mobileVariant = 'default',
    mobileOverlayScrolled = false,
    beforeLeaveAction,
}) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showLanguageModal, setShowLanguageModal] = useState(false);
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
    useMessageRealtime();
    const avatarContainerRef = useRef<HTMLDivElement | null>(null);
    const searchBoxRef = useRef<HTMLFormElement | null>(null);
    const searchRequestIdRef = useRef(0);
    const activeLanguage: AppLanguageCode =
        normalizeAppLanguage(i18n.resolvedLanguage || i18n.language) ?? 'zh';

    const handleLanguageChange = (code: AppLanguageCode) => {
        void applyAppLanguage(code, (lng) => i18n.changeLanguage(lng));
    };

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
        const handleClickOutside = (event: Event) => {
            const target = event.target as Node | null;
            if (!target) return;

            if (showUserMenu && avatarContainerRef.current && !avatarContainerRef.current.contains(target)) {
                setShowUserMenu(false);
            }

            if (isSearchOpen && searchBoxRef.current && !searchBoxRef.current.contains(target)) {
                setIsSearchOpen(false);
            }
        };

        if (!showUserMenu && !isSearchOpen) return;
        // 功能注释：微信 web-view 常用 touch，仅 mousedown 会关不掉或点开即关
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
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
        // /create 已合并为「我的」统一页，顶栏创作仅在编辑器相关路由高亮
        if (path === '/create' || path.startsWith('/create/withdraw-records')) return '';
        if (path.startsWith('/create') || isCreatorRoutePath(path)) return 'create';
        if (path.startsWith('/warehouse')) return 'warehouse';
        if (path.startsWith('/rank')) return 'rank';
        return '';
    };

    const activeNav = getActiveNav();
    const unreadBadgeText = unreadCount > 99 ? '99+' : (unreadCount > 0 ? String(unreadCount) : '');
    const logoSrc = `${import.meta.env.BASE_URL}data/assets/LOGO2.png`;
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

    const runLeaveAction = (action: () => void) => {
        if (beforeLeaveAction) {
            beforeLeaveAction(action);
            return;
        }
        action();
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

        runLeaveAction(() => {
            resetSearchState();
            navigate(`/game/${gameId}`, {
                state: buildGameDetailNavigateState('search', game),
            });
        });
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
        <div className={navbarContainerClassName} style={NAVBAR_BTN_BG_STYLE}>
            <div className={styles.navbar}>
                {/* 功能注释：点击品牌 Logo 回首页，与「首页」导航一致 */}
                <button
                    type="button"
                    className={styles.logo}
                    onClick={() => runLeaveAction(() => navigate('/home'))}
                    aria-label="回到首页"
                >
                    <img src={logoSrc} alt="funloom" />
                </button>

                <div className={styles.navLinks}>
                    <div
                        className={`${styles.navLink} ${activeNav === 'home' ? styles.navLinkActive : ''}`}
                        onClick={() => runLeaveAction(() => navigate('/home'))}
                    >
                        {t('nav.home')}
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'categories' ? styles.navLinkActive : ''}`}
                        onClick={() => runLeaveAction(() => navigate('/categories'))}
                    >
                        {t('nav.categories')}
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'create' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!requireAuth()) return;
                            runLeaveAction(() => navigate('/create/new'));
                        }}
                    >
                        {t('nav.create')}
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'warehouse' ? styles.navLinkActive : ''}`}
                        onClick={() => {
                            if (!requireAuth()) return;
                            runLeaveAction(() => navigate('/warehouse'));
                        }}
                    >
                        {t('nav.warehouse')}
                    </div>
                    <div
                        className={`${styles.navLink} ${activeNav === 'rank' ? styles.navLinkActive : ''}`}
                        onClick={() => runLeaveAction(() => navigate('/rank'))}
                    >
                        {t('nav.rank')}
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
                            placeholder={t('search.placeholder')}
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
                            aria-label={t('nav.searchAriaLabel')}
                        />
                        <button type="submit" className={styles.searchIcon} aria-label={t('nav.submitSearch')}>
                            <img src={NAV_SEARCH_ICON} alt="" className={styles.navAssetIcon} width={14} height={14} />
                        </button>

                        {shouldShowSearchPanel ? (
                            <div className={styles.searchPanel}>
                                {isSearching ? <div className={styles.searchEmpty}>{t('search.searching')}</div> : null}
                                {!isSearching && searchError ? <div className={styles.searchEmpty}>{searchError}</div> : null}
                                {!isSearching && !searchError && searchResults.length === 0 ? (
                                    <div className={styles.searchEmpty}>{t('search.notFound')}</div>
                                ) : null}
                                {!isSearching && !searchError && searchResults.map((game) => {
                                    const gameId = getSearchResultId(game);
                                    if (!gameId) return null;
                                    const title = String(game.title || '').trim() || gameId;
                                    const secondary = resolveSearchResultSecondaryLine(game);

                                    return (
                                        <button
                                            key={gameId}
                                            type="button"
                                            className={styles.searchItem}
                                            onClick={() => handleSearchSelect(game)}
                                        >
                                            <span className={styles.searchItemTitle}>{title}</span>
                                            {secondary ? (
                                                <span className={styles.searchItemMeta}>{secondary}</span>
                                            ) : null}
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
                                onClick={() => runLeaveAction(() => navigate('/messages'))}
                                aria-label={t('nav.messages')}
                            >
                                <img src={NAV_MESSAGE_ICON} alt="" className={styles.navAssetIcon} width={14} height={14} />
                                {unreadBadgeText ? <span className={styles.messageBadge}>{unreadBadgeText}</span> : null}
                            </button>

                            <div ref={avatarContainerRef} className={styles.avatarContainer}>
                                <div
                                    className={styles.avatar}
                                    role="button"
                                    tabIndex={0}
                                    aria-haspopup="menu"
                                    aria-expanded={showUserMenu}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setShowUserMenu((prev) => !prev);
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setShowUserMenu((prev) => !prev);
                                        }
                                    }}
                                >
                                    <UserAvatar
                                        fill
                                        verified={isVerifiedCreatorRole(user?.user?.role)}
                                        badgeSize="sm"
                                        className={styles.avatarInner}
                                    >
                                        <img
                                            src={(() => {
                                                const baseUrl = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/default_avatar.png`;
                                                // 功能注释：用户头像统一请求 webp 格式；后端按 USER_AVATAR_WEBP_AB_PERCENT 决定返回 webp 或原图。
                                                if (!baseUrl || baseUrl.includes('default_avatar')) return baseUrl;
                                                const sep = baseUrl.includes('?') ? '&' : '?';
                                                return `${baseUrl}${sep}format=webp`;
                                            })()}
                                            alt=""
                                        />
                                    </UserAvatar>
                                </div>

                                {showUserMenu && (
                                    <div className={styles.userMenu} role="menu">
                                        {isDesktopLayout && (
                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => {
                                                    runLeaveAction(() => {
                                                        navigate('/create');
                                                        setShowUserMenu(false);
                                                    });
                                                }}
                                            >
                                                {t('nav.profile')}
                                            </button>
                                        )}
                                        {!isDesktopLayout && (
                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => {
                                                    runLeaveAction(() => {
                                                        navigate('/warehouse');
                                                        setShowUserMenu(false);
                                                    });
                                                }}
                                            >
                                                {t('nav.warehouse')}
                                            </button>
                                        )}
                                        <button
                                            className={styles.menuBtn}
                                            onClick={() => {
                                                runLeaveAction(() => {
                                                    navigate('/favorites');
                                                    setShowUserMenu(false);
                                                });
                                            }}
                                        >
                                            {t('nav.favorites')}
                                        </button>
                                        {isOperatorRole(user?.user?.role) && isDesktopLayout && (
                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => {
                                                    runLeaveAction(() => {
                                                        navigate('/operator');
                                                        setShowUserMenu(false);
                                                    });
                                                }}
                                            >
                                                {t('nav.operatorPanel')}
                                            </button>
                                        )}
                                        {isAdminRole(user?.user?.role) && isDesktopLayout && (
                                            <button
                                                className={styles.menuBtn}
                                                onClick={() => {
                                                    runLeaveAction(() => {
                                                        navigate('/admin');
                                                        setShowUserMenu(false);
                                                    });
                                                }}
                                            >
                                                {t('nav.admin')}
                                            </button>
                                        )}
                                        <button
                                            className={`${styles.menuBtn} ${styles.logoutBtn}`}
                                            onClick={() => {
                                                runLeaveAction(() => {
                                                    logout();
                                                    setShowUserMenu(false);
                                                });
                                            }}
                                        >
                                            {t('nav.logout')}
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
                                {t('nav.login')}
                            </button>
                        )
                    )}

                    {/* 功能注释：语言入口固定在顶栏最右（头像/登录右侧），未登录也可用 */}
                    <button
                        type="button"
                        className={styles.langTrigger}
                        aria-label={t('nav.chooseLanguage')}
                        onClick={() => setShowLanguageModal(true)}
                    >
                        {getNavbarLanguageTriggerLabel(activeLanguage)}
                    </button>
                </div>
            </div>

            {!isWebViewEnv() && (
                <AuthModal
                    isOpen={isAuthModalOpen}
                    onClose={() => setIsAuthModalOpen(false)}
                />
            )}

            <LanguageSelectModal
                isOpen={showLanguageModal}
                activeLanguage={activeLanguage}
                onClose={() => setShowLanguageModal(false)}
                onSelect={handleLanguageChange}
            />
        </div>
    );
};

export default Navbar;
