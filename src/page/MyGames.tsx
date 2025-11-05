import React from 'react';
import styles from './MyGames.module.css';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const MyGames: React.FC = () => {
    return (
        <div className={styles.pageRoot}>
            <Navbar />
            
            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar
                    items={[
                        {
                            id: 'create',
                            label: '创作游戏',
                            icon: 'data/asset/创作页面/文件图标.png',
                            route: '/create'
                        },
                        {
                            id: 'myGames',
                            label: '我的游戏',
                            icon: 'data/asset/创作页面/文件夹图标.png',
                            route: '/create/myGames'
                        }
                    ]}
                />

                {/* 右侧内容区域 */}
                <div className={styles.main}>
                    <div className={styles.myGamesContainer}>
                        <h2>我的游戏</h2>
                        <p>我的游戏内容待开发...</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyGames;

