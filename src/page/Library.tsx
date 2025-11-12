import React, { useState, useEffect, useMemo } from 'react';
import styles from './Library.module.css';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/libraryData';
import type { LibraryData } from '../api/home/libraryData.type';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import { IoSearch } from 'react-icons/io5';

const Library: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<LibraryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGameMeta, setSelectedGameMeta] = useState<LibraryData | null>(null);

    
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
        }
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

    // 使用 libraryDataApi 获取游戏列表数据
    useEffect(() => {
        const loadLibraryData = async () => {
            setIsLoading(true);
            try {
                // 修复调用参数数量：需要传递 userId 和 request 两个参数
                const response = await libraryDataApi.getLibraryData(2, { limit: 10 });

                if (response.data.success && response.data.data) {

                    setFileMetas(response.data.data);
                    setIsLoading(false);
                } else {
                    console.error('获取游戏列表失败:', response.data);
                    setFileMetas([]);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('获取游戏列表错误:', error);
                setFileMetas([]);
                setIsLoading(false);
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

                {/* 右侧内容区域 - Library 特有的内容 */}
                <div className={styles.main}>
                    <div className={styles.searchBox}>
                        <input className={styles.searchInput} placeholder="搜索商品、素材、事件..." />
                        <IoSearch className={styles.searchIcon} />
                    </div>
                    <div className={styles.libraryContent}>
                        <div className={styles.grid4}>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={`skeleton-${idx}`} className={styles.skeletonCard}>
                                        <div className={styles.skeletonImage} />
                                        <div className={styles.skeletonText} />
                                        <div className={styles.skeletonTextShort} />
                                    </div>
                                ))
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

export default Library;
