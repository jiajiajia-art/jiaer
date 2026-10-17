import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './MobileBottomNav.module.css';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { isCreatorRoutePath, isMiniProgramEnv } from '../../utils/miniProgram';
import { isOperatorRole } from '../../utils/userRoles';
import { isPublishBanned } from '../../lib/userPunishment';

type BottomNavKey = 'home' | 'create' | 'rankings' | 'profile' | 'admin';

const normalize = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.endsWith('/') && normalized.length > 1
        ? normalized.slice(0, -1)
        : normalized;
};

const isUnifiedProfilePath = (path: string) =>
    path === '/profile' || path.startsWith('/create/withdraw-records');

const MobileBottomNav: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, user, initialize } = useAuthStore();
    const { setIsAuthModalOpen } = authModalStore();
    const publishBanned = isPublishBanned(user?.user?.publishBanUntil);

    const isAdminNavVisible = isOperatorRole(user?.user?.role) && user?.user?.userId === '96e89940badf1f67';

    const navItems = useMemo(() => {
        const base: Array<{
            key: BottomNavKey;
            labelKey: string;
            iconActive: string;
            iconInactive: string;
        }> = [
            {
                key: 'home',
                labelKey: 'common.nav.home',
                iconInactive: 'data/assetsv2/home/home.svg',
                iconActive: 'data/assetsv2/home/home.svg',
            },
            {
                key: 'create',
                labelKey: 'common.nav.create',
                iconInactive: 'data/assetsv2/home/create.svg',
                iconActive: 'data/assetsv2/home/create.svg',
            },
            {
                key: 'rankings',
                labelKey: 'common.nav.rankings',
                iconInactive: 'data/assetsv2/home/rank.svg',
                iconActive: 'data/assetsv2/home/rank.svg',
            },
            {
                key: 'profile',
                labelKey: 'common.nav.profile',
                iconInactive: 'data/assetsv2/home/mine.svg',
                iconActive: 'data/assetsv2/home/mine.svg',
            },
        ];
        if (isAdminNavVisible) {
            base.push({
                key: 'admin',
                labelKey: 'common.nav.admin',
                iconInactive: '',
                iconActive: '',
            });
        }
        return base;
    }, [isAdminNavVisible]);

    useEffect(() => {
        initialize();
    }, [initialize]);

    const currentPath = normalize(location.pathname);

    const activeKey = useMemo<BottomNavKey>(() => {
        if (isUnifiedProfilePath(currentPath)) return 'profile';
        if (currentPath.startsWith('/home')) return 'home';
        if (currentPath === '/create/new' || isCreatorRoutePath(currentPath)) return 'create';
        if (currentPath.startsWith('/rank')) return 'rankings';
        if (currentPath.startsWith('/admin')) return 'admin';
        return 'home';
    }, [currentPath]);

    const ensureAuthenticated = () => {
        if (isAuthenticated) {
            return true;
        }

        if (!isMiniProgramEnv()) {
            setIsAuthModalOpen(true);
        }
        return false;
    };

    const handleNav = (key: BottomNavKey) => {
        switch (key) {
            case 'home':
                navigate('/home');
                break;
            case 'create':
                if (!ensureAuthenticated()) return;
                if (publishBanned) {
                    toast.error(t('report.createBannedHint'));
                    return;
                }
                navigate('/create/new');
                break;
            case 'rankings':
                navigate('/rank');
                break;
            case 'profile':
                if (!ensureAuthenticated()) return;
                navigate('/profile');
                break;
            case 'admin':
                navigate('/admin/comments');
                break;
            default:
                break;
        }
    };

    if (hidden) return null;

    return (
        <div className={styles.container}>
            {navItems.map(({ key, labelKey, iconActive, iconInactive }) => {
                const isActive = activeKey === key;
                const iconSrc = `${import.meta.env.BASE_URL}${isActive ? iconActive : iconInactive}`;

                return (
                    <button
                        key={key}
                        type="button"
                        className={`${styles.navItem} ${isActive ? styles.navItemActive : ''} ${key === 'create' && publishBanned ? styles.navItemDisabled : ''}`}
                        onClick={() => handleNav(key)}
                    >
                        {key === 'admin' ? (
                            <svg
                                className={`${styles.icon} ${isActive ? styles.adminIconActive : styles.adminIcon}`}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        ) : (
                            <img src={iconSrc} alt={t(labelKey)} className={styles.icon} />
                        )}
                        <span className={styles.label}>{t(labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default MobileBottomNav;
