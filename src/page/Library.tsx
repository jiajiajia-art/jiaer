import React, { useState, useEffect, useMemo } from 'react';
import styles from './Library.module.css';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import GameDetailModal from '../components/GameDetailModal';
import createSessionApi from '../api/createGame/createSession.type';
import libraryDataApi from '../api/home/libraryData';
import type { LibraryData } from '../api/home/libraryData.type';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';

const Library: React.FC = () => {
    const [showGameModal, setShowGameModal] = useState(false);
    const [fileMetas, setFileMetas] = useState<LibraryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedGameMeta, setSelectedGameMeta] = useState<LibraryData | null>(null);

    const { setPdfFileId, setSessionId } = useGameStore();
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
     * 从详情弹窗创建游戏
     */
    const handleCreateGameFromDetail = async () => {
        // 使用 file_id 或 id
        const fileId = selectedGameMeta?.file_id || selectedGameMeta?.id;
        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }
        // 同时更新 store 和直接传递给 createSession，确保立即生效
        setPdfFileId(fileId);
        const sessionId = await createSession(fileId);
        setSessionId(sessionId);
        if (sessionId) {
            navigator('/newmain');
        } else {
            alert('创建游戏失败，请重试');
        }
    };

    /**
     * 关闭弹窗
     */
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGameMeta(null);
    };

    /**
     * 创建会话
     */
    const createSession = async (fileIdParam?: string): Promise<string | null> => {
        // 优先使用传入的参数，否则从 store 读取
        const targetFileId = fileIdParam || useGameStore.getState().pdfFileId;

        if (!targetFileId) {
            console.error('没有 pdfFileId，无法创建 session');
            return null;
        }

        try {
            const response = await createSessionApi.createSession({
                fileId: targetFileId,
                playerName: '玩家'
            });

            if (response.data.success) {
                const data = response.data;
                return data.sessionId;
            } else {
                alert(response.data.message);
                return null;
            }
        } catch (error) {
            console.error('❌ Session 创建错误:', error);
            return null;
        }
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
                const response = await libraryDataApi.getLibraryData({ limit: 10 });

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
                        <span className={styles.searchIcon}></span>
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
                    onStart={handleCreateGameFromDetail}
                />
            )}
            <MobileBottomNav />
        </div>
    );
};

export default Library;
