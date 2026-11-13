import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './WareHouse.module.css';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';

const PAGE_SIZE = 20;

const WareHouse: React.FC = () => {
    const [games, setGames] = useState<UserGameData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
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


    return (
        <div className={styles.pageRoot} ref={scrollContainerRef}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {isLoading ? (
                        <GameGridSkeleton count={12} />
                    ) : (
                        <>
                            <GameGrid
                                games={games}
                            />
                            {isLoadingMore && (
                                <div style={{ padding: '20px', textAlign: 'center' }}>
                                    <GameGridSkeleton count={4} />
                                </div>
                            )}
                            {/* {!hasMore && games.length > 0 && (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                    没有更多数据了
                                </div>
                            )} */}
                        </>
                    )}
                </div>
            </div>

            <FooterArea />

            <MobileBottomNav />
        </div>
    );
};

export default WareHouse;

