import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

const navItems: Array<{
    key: BottomNavKey;
    label: string;
    iconActive: string;
    iconInactive: string;
}> = [
    {
        key: 'home',
        label: '首页',
        iconInactive: 'data/assets/切图/首页02.png',
        iconActive: 'data/assets/切图/首页01.png',
    },
    {
        key: 'create',
        label: '创作',
        iconInactive: 'data/assets/切图/创作02.png',
        iconActive: 'data/assets/切图/创作01.png',
    },
    {
        key: 'create',
        label: '创作',
        iconInactive: 'data/assets/切图/创作02.png',
        iconActive: 'data/assets/切图/创作01.png',
    },
    {
        key: 'profile',
        label: '我的',
        iconInactive: 'data/assets/切图/我的02.png',
        iconActive: 'data/assets/切图/我的01.png',
    },
];

const MobileBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, initialize } = useAuthStore();
    const { setIsAuthModalOpen } = authModalStore();

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

    return (
        <div className={styles.container}>
            {navItems.map(({ key, label, iconActive, iconInactive }) => {
                const isActive = activeKey === key;
                const iconSrc = `${import.meta.env.BASE_URL}${isActive ? iconActive : iconInactive}`;

                return (
                    <button
                        key={key}
                        type="button"
                        className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                        onClick={() => handleNav(key)}
                    >
                        <img src={iconSrc} alt={label} className={styles.icon} />
                        <span className={styles.label}>{label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default MobileBottomNav;
