import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import styles from './WareHouse.module.css';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore } from '../store/useAuthStore';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';

interface LibraryProps {
    variant?: 'all' | 'special';
}

const PAGE_SIZE = 20;

const Library: React.FC<LibraryProps> = ({ variant = 'all' }) => {
    const [games, setGames] = useState<UserGameData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(0);
    const { user } = useAuthStore();
    const isSpecialLibrary = variant === 'special';
    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);

    const requestParams = useMemo(() => {
        return {
            limit: String(PAGE_SIZE),
        };
    }, [isSpecialLibrary]);

    // 加载游戏数据
    const loadGames = useCallback(async (targetPage: number, isInitial = false) => {
        if (isInitial) {
            setIsLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        const type = isSpecialLibrary ? 'with-discount' : 'no-discount';
        try {
            const response = await libraryDataApi.getGameData(type,{
                limit: String(PAGE_SIZE),
                offset: String(targetPage * PAGE_SIZE),
            });

            if (response.data.success && response.data.data) {
                const newGames = response.data.data;
                if (isInitial) {
                    setGames(newGames);
                } else {
                    setGames(prev => [...prev, ...newGames]);
                }
                setHasMore(newGames.length === PAGE_SIZE);
                if (newGames.length > 0) {
                    setPage(targetPage + 1);
                }
            } else {
                console.error('获取游戏列表失败:', response.data);
                if (isInitial) setGames([]);
                setHasMore(false);
            }
        } catch (error) {
            console.error('获取游戏列表错误:', error);
            if (isInitial) setGames([]);
            setHasMore(false);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [isSpecialLibrary]);

    // 获取游戏数据
    useEffect(() => {
        setPage(0);
        setHasMore(true);
        loadGames(0, true);
    }, [user?.user.id, requestParams, loadGames]);

    const loadMore = useCallback(() => {
        if (!isLoadingMore && hasMore && !isLoading) {
            loadGames(page, false);
        }
    }, [isLoadingMore, hasMore, isLoading, page, loadGames]);

    // 触底懒加载：IntersectionObserver
    useEffect(() => {
        if (!loadMoreTriggerRef.current) return;
        if (observerRef.current) observerRef.current.disconnect();

        observerRef.current = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry.isIntersecting) {
                    loadMore();
                }
            },
            {
                root: null,
                rootMargin: '200px',
                threshold: 0.1,
            }
        );

        observerRef.current.observe(loadMoreTriggerRef.current);

        return () => {
            observerRef.current?.disconnect();
        };
    }, [loadMore]);

    
    return (
        <div className={styles.pageRoot}>
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
                            <div
                                ref={loadMoreTriggerRef}
                                style={{
                                    height: '1px',
                                    marginTop: '20px',
                                    visibility: hasMore ? 'visible' : 'hidden',
                                }}
                            />
                        </>
                    )}
                </div>
            </div>

            <FooterArea />

            <MobileBottomNav />
        </div>
    );



};

export default Library;
