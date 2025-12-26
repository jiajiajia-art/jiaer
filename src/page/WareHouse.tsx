import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './WareHouse.module.css';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import GameDetailModal from '../components/GameDetailModal';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';

const PAGE_SIZE = 40;

const WareHouse: React.FC = () => {
    const [games, setGames] = useState<UserGameData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [showGameModal, setShowGameModal] = useState(false);
    const [selectedGame, setSelectedGame] = useState<UserGameData | null>(null);
    const { user } = useAuthStore();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 加载游戏数据
    const loadGames = useCallback(async (currentOffset: number, append: boolean = false) => {
        if (append) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
        }

        try {
            const response = await libraryDataApi.getWareHouseData({
                limit: String(PAGE_SIZE),
                offset: String(currentOffset),
            });

            if (response.data.success && response.data.data) {
                const newGames = response.data.data.rows;
                
                if (append) {
                    setGames(prev => [...prev, ...newGames]);
                } else {
                    setGames(newGames);
                }

                // 如果返回的数据少于 PAGE_SIZE，说明没有更多数据了
                setHasMore(newGames.length === PAGE_SIZE);
                setOffset(currentOffset + newGames.length);
            } else {
                console.error('获取游戏列表失败:', response.data);
                if (!append) {
                    setGames([]);
                }
                setHasMore(false);
            }
        } catch (error) {
            console.error('获取游戏列表错误:', error);
            if (!append) {
                setGames([]);
            }
            setHasMore(false);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    // 初始加载
    useEffect(() => {
        setOffset(0);
        setHasMore(true);
        loadGames(0, false);
    }, [user?.user.id, loadGames]);

    // 加载更多数据
    const loadMore = useCallback(() => {
        if (!isLoadingMore && hasMore && !isLoading) {
            loadGames(offset, true);
        }
    }, [isLoadingMore, hasMore, isLoading, offset, loadGames]);

    // 滚动监听
    useEffect(() => {
        const handleScroll = () => {
            if (isLoadingMore || !hasMore) return;

            const container = scrollContainerRef.current;
            let scrollTop: number;
            let scrollHeight: number;
            let clientHeight: number;

            if (container) {
                scrollTop = container.scrollTop;
                scrollHeight = container.scrollHeight;
                clientHeight = container.clientHeight;
            } else {
                scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                scrollHeight = document.documentElement.scrollHeight;
                clientHeight = window.innerHeight;
            }

            // 当滚动到距离底部 200px 时加载更多
            if (scrollTop + clientHeight >= scrollHeight - 200) {
                loadMore();
            }
        };

        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
        } else {
            window.addEventListener('scroll', handleScroll);
        }

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            } else {
                window.removeEventListener('scroll', handleScroll);
            }
        };
    }, [isLoadingMore, hasMore, loadMore]);

    // 显示游戏详情
    const showGameDetail = (game: UserGameData) => {
        setSelectedGame(game);
        setShowGameModal(true);
    };

    // 关闭弹窗
    const closeModal = () => {
        setShowGameModal(false);
        setSelectedGame(null);
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

    const renderGameActions = (game: UserGameData) => {
        return (
            <button
                type="button"
                onClick={() => {
                    if (!game.file_id) return;
                    setSelectedGame(game);
                    setShowGameModal(true);
                }}
            >
                开始游戏
            </button>
        );
    };

    return (
        <div className={styles.pageRoot} ref={scrollContainerRef}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {isLoading ? (
                        <GameGridSkeleton count={8} />
                    ) : (
                        <>
                            <GameGrid
                                games={games}
                                onGameClick={showGameDetail}
                                renderActions={renderGameActions}
                            />
                            {isLoadingMore && (
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <GameGridSkeleton count={4} />
                                </div>
                            )}
                            {/* {!hasMore && games.length > 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                                    没有更多数据了
                                </div>
                            )} */}
                        </>
                    )}
                </div>
            </div>

            <FooterArea />

            {selectedGame && (
                <GameDetailModal
                    isOpen={showGameModal}
                    game={selectedGame}
                    onClose={closeModal}
                />
            )}

            <MobileBottomNav />
        </div>
    );
};

export default WareHouse;

