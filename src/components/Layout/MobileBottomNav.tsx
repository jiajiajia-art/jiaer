import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';

// 检测是否在微信小程序环境
const isWebViewEnv = (): boolean => {
    const win = window as any;
    return String(win.__wxjs_environment || '').toLowerCase() === 'miniprogram';
};

type BottomNavKey = 'home' | 'profile';

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
        label: '商城',
        iconInactive: 'data/assets/切图/首页02.png',
        iconActive: 'data/assets/切图/首页01.png',
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
        if (currentPath.startsWith('/home')) return 'home';
        if (currentPath.startsWith('/profile')) return 'profile';
        return 'home';
    }, [currentPath]);

    const handleNav = (key: BottomNavKey) => {
        switch (key) {
            case 'home':
                navigate('/home');
                break;
            case 'profile':
                if (!isAuthenticated) {
                    if (!isWebViewEnv()) {
                        setIsAuthModalOpen(true);
                    }
                    return;
                }
                navigate('/profile');
                break;
            default:
                break;
        }
    };

    return (
        <>
            <div className={styles.container}>
                {navItems.map(({ key, label, iconActive, iconInactive }) => {
                    const isActive = activeKey === key;
                    const iconSrc = `${import.meta.env.BASE_URL}${isActive ? iconActive : iconInactive}`;

                    return (
                    <button
                        key={key}
                        type="button"
                        className={`${styles.navItem} ${activeKey === key ? styles.navItemActive : ''}`}
                        onClick={() => handleNav(key)}
                    >
                        <img src={iconSrc} alt={label} className={styles.icon} />
                        <span className={styles.label}>
                            {label}
                        </span>
                    </button>
                    );
                })}
            </div>
        </>
    );
};

export default MobileBottomNav;

