import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from './MobileBottomNav.module.css';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';
import { isCreatorRoutePath, isMiniProgramEnv } from '../../utils/miniProgram';

type BottomNavKey = 'home' | 'create' | 'profile';

const normalize = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.endsWith('/') && normalized.length > 1
        ? normalized.slice(0, -1)
        : normalized;
};

const MobileBottomNav: React.FC<{ hidden?: boolean }> = ({ hidden }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, initialize } = useAuthStore();
    const { setIsAuthModalOpen } = authModalStore();

    const navItems: Array<{
        key: BottomNavKey;
        labelKey: string;
        iconActive: string;
        iconInactive: string;
    }> = [
        {
            key: 'home',
            labelKey: 'common.nav.home',
            iconInactive: 'data/assets/切图/首页02.png',
            iconActive: 'data/assets/切图/首页01.png',
        },
        {
            key: 'create',
            labelKey: 'common.nav.create',
            iconInactive: 'data/assets/切图/创作02.png',
            iconActive: 'data/assets/切图/创作01.png',
        },
        {
            key: 'profile',
            labelKey: 'common.nav.profile',
            iconInactive: 'data/assets/切图/我的02.png',
            iconActive: 'data/assets/切图/我的01.png',
        },
    ];

    useEffect(() => {
        initialize();
    }, [initialize]);

    const currentPath = normalize(location.pathname);

    const activeKey = useMemo<BottomNavKey>(() => {
        if (currentPath.startsWith('/create')) return 'create';
        if (currentPath.startsWith('/home')) return 'home';
        if (isCreatorRoutePath(currentPath)) return 'create';
        if (currentPath.startsWith('/profile')) return 'profile';
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
                navigate('/create');
                break;
            case 'profile':
                if (!ensureAuthenticated()) return;
                navigate('/profile');
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
                        className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                        onClick={() => handleNav(key)}
                    >
                        <img src={iconSrc} alt={t(labelKey)} className={styles.icon} />
                        <span className={styles.label}>{t(labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default MobileBottomNav;
