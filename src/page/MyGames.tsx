import React, { useEffect, useMemo, useState } from 'react';
import styles from './MyGames.module.css';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/libraryData';
import createSessionApi from '../api/createGame/createSession.type';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/gameStore';
import { useNavigate } from 'react-router-dom';
import type { LibraryData } from '../api/home/libraryData.type';

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
    
    const { user } = useAuthStore();
    const { setPdfFileId, setSessionId } = useGameStore();
    const navigate = useNavigate();
    
    const [fileMetas, setFileMetas] = useState<LibraryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showGameModal, setShowGameModal] = useState(false);
    const [selectedGameMeta, setSelectedGameMeta] = useState<LibraryData | null>(null);

    /**
     * 显示游戏详情
     */
    const showGameDetail = (meta: LibraryData) => {
        setSelectedGameMeta(meta);
        setShowGameModal(true);
    };

    /**
     * 从详情弹窗创建游戏
     */
    const handleCreateGameFromDetail = async () => {
        const fileId = selectedGameMeta?.file_id || selectedGameMeta?.id;
        if (!fileId) {
            alert('游戏信息错误，请重试');
            return;
        }
        setPdfFileId(fileId);
        const sessionId = await createSession(fileId);
        setSessionId(sessionId);
        if (sessionId) {
            navigate('/newmain');
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

    // 加载我的游戏数据
    useEffect(() => {
        const loadMyGames = async () => {
            if (!user?.user?.id) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const response = await libraryDataApi.getLibraryData(user.user.id, { limit: 10 });

                if (response.data.success && response.data.data) {
                    setFileMetas(response.data.data);
                } else {
                    console.error('获取我的游戏列表失败:', response.data);
                    setFileMetas([]);
                }
            } catch (error) {
                console.error('获取我的游戏列表错误:', error);
                setFileMetas([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadMyGames();
    }, [user?.user?.id]);

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <MobileTopNav items={sidebarItems} />

            <div className={styles.mainContent}>
                {/* 左侧侧边栏 */}
                <Sidebar items={sidebarItems} />

                {/* 右侧内容区域 */}
                <div className={styles.main}>
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
                            ) : fileMetas.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <p>还没有创建游戏，快去创作吧！</p>
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
                                                alt={meta.title || `我的游戏${idx + 1}`}
                                            />
                                        </div>
                                        <div className={styles.goodsBody}>
                                            <div className={styles.goodsTitle}>
                                                {meta.title || `我的游戏${idx + 1}`}
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

export default MyGames;
