import React, { useMemo } from 'react';
import styles from './MyGames.module.css';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';

const MyGames: React.FC = () => {
    const sidebarItems = useMemo<SidebarItem[]>(() => [
        {
            id: 'create',
            label: '创作游戏',
            icon: 'data/asset/创作页面/文件图标.png',
            route: '/create',
        },
        {
            id: 'myGames',
            label: '我的游戏',
            icon: 'data/asset/创作页面/文件夹图标.png',
            route: '/create/myGames',
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
                    <div className={styles.myGamesContainer}>
                        <h2>我的游戏</h2>
                        <p>我的游戏内容待开发...</p>
                    </div>
                </div>
            </div>
            <MobileBottomNav />
        </div>
    );
};

export default MyGames;

