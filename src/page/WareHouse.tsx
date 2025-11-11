import React, { useMemo } from 'react';
import styles from './WareHouse.module.css';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';

const WareHouse: React.FC = () => {
    const sidebarItems = useMemo<SidebarItem[]>(() => [
        {
            id: 'warehouse',
            label: '仓库',
            route: '/warehouse',
        }
    ], []);

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <MobileTopNav items={sidebarItems} />

            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar items={sidebarItems} />

                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    <div className={styles.WareHouseContainer}>
                        <h2>仓库</h2>
                        <p>仓库内容待开发...</p>
                    </div>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default WareHouse;

