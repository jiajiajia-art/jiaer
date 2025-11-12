import React, { useState, useEffect, useMemo } from 'react';
import styles from './Home.module.css';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/libraryData';
import type { LibraryData } from '../api/home/libraryData.type';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';

const Home: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<LibraryData[]>([]);
    const [selectedGameMeta, setSelectedGameMeta] = useState<LibraryData | null>(null);

    const navigator = useNavigate();

    const sidebarItems = useMemo<SidebarItem[]>(() => [
        {
            id: 'home',
            label: '首页',
            icon: 'data/asset/首页/homeIcon.png',
            route: '/home',
        },
        {
            id: 'library',
            label: '全部',
            route: '/home/library',
        },
    ], []);

    /**
     * 显示游戏详情（从后端数据）
     */
    const showGameDetail = (meta: LibraryData) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
    };

    // ESC键关闭弹窗
    useEffect(() => {
        const handleEscKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showGameModal) setShowGameModal(false);
            }
        };

        document.addEventListener('keydown', handleEscKey);
        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [showGameModal]);

    // 使用 libraryDataApi 获取游戏列表数据（首页显示前4个）
    useEffect(() => {
        const loadLibraryData = async () => {
            try {
                const response = await libraryDataApi.getLibraryData(2, { limit: 4 });

                if (response.data.success && response.data.data) {
                    setFileMetas(response.data.data);
                } else {
                    console.error('获取游戏列表失败:', response.data);
                    setFileMetas([]);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setFileMetas([]);
            }
        };

        loadLibraryData();
    }, []);

    return (
        <div className={styles.pageRoot}>
            {/* 顶部固定导航 */}
            <Navbar />
            <MobileTopNav items={sidebarItems} />

            {/* 主体 */}
            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar items={sidebarItems} />

                {/* 右侧商城内容 */}
                <div className={styles.main}>
                    <div className={styles.todayWrap}>
                        <div className={styles.todayHeader}>
                            <img src={`${import.meta.env.BASE_URL}data/asset/首页/字样.png`} alt="今日推荐" />
                        </div>
                        <div className={styles.todayScroller}>
                            <img src={`${import.meta.env.BASE_URL}data/gameCover/image.png`} alt="今日推荐" />
                        </div>
                    </div>

                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>限时优惠!</div>
                            <button 
                                type="button"
                                className={styles.more} 
                                onClick={() => {
                                    navigator('/home/library');
                                }}
                            ></button>
                        </div>
                        <div className={styles.grid4}>
                            {fileMetas.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '50px', color: '#5E4630' }}>
                                    <h2 style={{ fontSize: '24px', marginBottom: '10px' }}>⏳ 加载中...</h2>
                                    <p style={{ fontSize: '16px', opacity: 0.9 }}>正在加载剧情文件信息</p>
                                </div>
                            ) : (
                                fileMetas.map((meta, idx) => (
                                    <div
                                        className={styles.goodsCard}
                                        key={meta.id}
                                        onClick={() => {
                                            showGameDetail(meta);
                                        }}
                                    >
                                        <div className={styles.goodsImg}>
                                            <img
                                                src={meta.cover_url || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                                alt={meta.title || `剧情${idx + 1}`}
                                            />
                                        </div>
                                        <div className={styles.goodsBody}>
                                            <div className={styles.goodsTitle}>
                                                {meta.title || `剧情${idx + 1}`}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedGameMeta && (
                <GameDetailModal
                    isOpen={showGameModal}
                    game={selectedGameMeta}
                    onClose={closeModal}
                />
            )}
            <MobileBottomNav />
        </div>
    );
};

export default Home;


