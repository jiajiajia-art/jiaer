import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

const Navbar: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // 根据当前路径确定激活的导航项
    const getActiveNav = () => {
        if (location.pathname === '/homeNew' || location.pathname === '/home') {
            return '商城';
        } else if (location.pathname === '/create') {
            return '创作';
        } else if (location.pathname === '/warehouse') {
            return '仓库';
        }
        return '商城';
    };
    
    const activeNav = getActiveNav();

    const handleNavClick = (navName: string) => {
        switch (navName) {
            case '商城':
                navigate('/homeNew');
                break;
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
        <div className={styles.navbar}>
            <div className={styles.navLinks}>
                <div 
                    className={`${styles.navLink} ${activeNav === '商城' ? styles.navLinkActive : ''}`}
                    onClick={() => handleNavClick('商城')}
                >
                    商城
                </div>
                <div 
                    className={`${styles.navLink} ${activeNav === '创作' ? styles.navLinkActive : ''}`}
                    onClick={() => handleNavClick('创作')}
                >
                    创作
                </div>
                <div 
                    className={`${styles.navLink} ${activeNav === '仓库' ? styles.navLinkActive : ''}`}
                    onClick={() => handleNavClick('仓库')}
                >
                    仓库
                </div>
            </div>
            <div className={styles.navRight}>
                <div className={styles.searchBox}>
                    <input className={styles.searchInput} placeholder="搜索商品、素材、事件..." />
                    <span className={styles.searchIcon}></span>
                </div>
                <div className={styles.avatar}>
                    <img src="/data/avatars/hunter.png" alt="" />
                </div>
                <img src="/data/asset/设置.png" alt="" className={styles.settingIcon} />
            </div>
        </div>
    );
};

export default Navbar;
