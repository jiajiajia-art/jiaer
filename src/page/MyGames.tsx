import React, { useEffect, useMemo, useState } from 'react';
import styles from './MyGames.module.css';
import Navbar from '../components/Navbar';
import Sidebar, { type SidebarItem } from '../components/Sidebar';
import MobileTopNav from '../components/Mobile/MobileTopNav';
import MobileBottomNav from '../components/Mobile/MobileBottomNav';
import GameDetailModal from '../components/GameDetailModal';
import PublishSettingsModal from '../components/goodsModal/PublishSettingsModal';
import GameDataModal from '../components/goodsModal/GameDataModal';
import getGameDataApi from '../api/home/getGameData';
import GameAction from '../api/game/gameAction';
import { useAuthStore } from '../store/useAuthStore';
import type { UserGameData } from '../api/home/getGameData.type';
import { MdOutlineDeleteSweep } from 'react-icons/md';
import type { GameStatsResponse } from '../api/game/gameAction.Api';

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

    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showGameModal, setShowGameModal] = useState(false);
    const [selectedGameMeta, setSelectedGameMeta] = useState<UserGameData | null>(null);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showDataModal, setShowDataModal] = useState(false);
    const [currentGame, setCurrentGame] = useState<UserGameData | null>(null);
    const [gameStats, setGameStats] = useState<GameStatsResponse | null>(null);

    /**
     * 显示游戏详情
     */
    const showGameDetail = (meta: UserGameData) => {
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

    // 加载我的游戏数据
    const loadMyGames = async () => {
        if (!user?.user?.id) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const response = await getGameDataApi.getUserData(user.user.id, { limit: 10 });

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

    useEffect(() => {
        loadMyGames();
    }, [user?.user.id]);

    // 发布游戏
    const handlePublish = async (price: number | null, isFree: boolean) => {
        if (!currentGame) return;

        try {
            const priceAmount = isFree ? 0 : (price || 0);
            const response = await GameAction.publishGame({
                fileId: currentGame.file_id || '',
                priceAmount: priceAmount,
            });

            if (response.data.success) {
                // 发布成功后刷新数据
                await loadMyGames();
                // 关闭弹窗
                setShowPublishModal(false);
                setCurrentGame(null);
            } else {
                console.error('发布游戏失败:', response.data);
            }
        } catch (error) {
            console.error('发布游戏失败:', error);
        }
    };

    // 删除游戏
    // const handleDelete = async (fileId: string) => {
    //     try {
    //         const response = await GameAction.deleteGame(fileId);
    //         if (response.data.success) {
    //             await loadMyGames();
    //         } else {
    //             console.error('删除游戏失败:', response.data);
    //         }
    //     } catch (error) {
    //         console.error('删除游戏失败:', error);
    //     }
    // };

    const getGameStats = async (fileId: string) => {
        try {
            const response = await GameAction.getGameStats(fileId);
            if (response.data.success) {
                setGameStats(response.data.data);
                setShowDataModal(true);
            }
        } catch (error) {
            console.error('获取游戏数据失败:', error);
        }
    };

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
                                            {/* <MdOutlineDeleteSweep
                                                className={styles.deleteIcon}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(meta.file_id || '');
                                                }}
                                            /> */}
                                            <img
                                                src={meta.cover_url || `${import.meta.env.BASE_URL}data/events/welcome.png`}
                                                alt={meta.title || `我的游戏${idx + 1}`}
                                            />
                                        </div>
                                        <div className={styles.goodsBody}>
                                            <div className={styles.goodsTitle}>
                                                {meta.title || `我的游戏${idx + 1}`}
                                            </div>
                                            <div className={styles.goodsActions} onClick={(e) => e.stopPropagation()}>
                                                <div className={styles.editBtn}>编辑</div>
                                                {
                                                    meta.is_public === 0 ? (
                                                        <div
                                                            className={styles.publishBtn}
                                                            onClick={() => {
                                                                setCurrentGame(meta);
                                                                setShowPublishModal(true);
                                                            }}
                                                        >
                                                            发布
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={styles.publishBtn}
                                                            onClick={() => {
                                                                getGameStats(meta.file_id || '');
                                                                setCurrentGame(meta);
                                                            }}
                                                        >
                                                            数据
                                                        </div>
                                                    )
                                                }
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

            {currentGame && (
                <PublishSettingsModal
                    isOpen={showPublishModal}
                    game={currentGame}
                    onClose={() => {
                        setShowPublishModal(false);
                        setCurrentGame(null);
                    }}
                    onPublish={handlePublish}
                />
            )}

            {currentGame && (
                <GameDataModal
                    isOpen={showDataModal}
                    game={currentGame}
                    onClose={() => {
                        setShowDataModal(false);
                        setCurrentGame(null);
                    }}
                    data={gameStats}
                />
            )}
            <MobileBottomNav />
        </div>
    );
};

export default MyGames;
