import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './MobileBottomNav.module.css';
import { authModalStore, useAuthStore } from '../../store/useAuthStore';

type BottomNavKey = 'home' | 'create' | 'warehouse' | 'profile';

const normalize = (path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return normalized.endsWith('/') && normalized.length > 1
        ? normalized.slice(0, -1)
        : normalized;
};

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
        if (currentPath.startsWith('/warehouse')) return 'warehouse';
        if (currentPath.startsWith('/home')) return 'home';
        if (currentPath.startsWith('/profile')) return 'profile';
        return 'home';
    }, [currentPath]);

    const handleNav = (key: BottomNavKey) => {
        switch (key) {
            case 'home':
                navigate('/home');
                break;
            case 'create':
                if (!isAuthenticated) {
                    setIsAuthModalOpen(true);
                    return;
                }
                navigate('/create');
                break;
            case 'warehouse':
                navigate('/warehouse');
                break;
            case 'profile':
                if (!isAuthenticated) {
                    setIsAuthModalOpen(true);
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
                {(['home', 'create', 'warehouse', 'profile'] as BottomNavKey[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        className={`${styles.navItem} ${activeKey === key ? styles.navItemActive : ''}`}
                        onClick={() => handleNav(key)}
                    >
                        <span className={styles.label}>
                            {key === 'home' && '商城'}
                            {key === 'create' && '创作'}
                            {key === 'warehouse' && '仓库'}
                            {key === 'profile' && '我的'}
                        </span>
                    </button>
                ))}
            </div>
        </>
    );
};

export default MobileBottomNav;

