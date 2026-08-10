import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameGrid from '../../components/GameGrid';
import libraryDataApi from '../../api/home/getGameData';
import type { UserGameData } from '../../api/home/getGameData.type';
import { useAuthStore } from '../../store/useAuthStore';
import GameGridSkeleton from '../../components/Skeleton/GameGridSkeleton';
import panel from './WarehousePanel.module.css';

const PAGE_SIZE = 20;

/** 原仓库游玩历史（方案 B：挂在仓库侧栏） */
const WarehousePlayHistory: React.FC = () => {
  const [games, setGames] = useState<UserGameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadGames = useCallback(async (currentOffset: number, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const response = await libraryDataApi.getWareHouseData({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
      });

      if (response.data.success && response.data.data) {
        const newGames = response.data.data.rows;
        setGames((prev) => (append ? [...prev, ...newGames] : newGames));
        setHasMore(newGames.length === PAGE_SIZE);
        setOffset(currentOffset + newGames.length);
      } else {
        if (!append) setGames([]);
        setHasMore(false);
      }
    } catch {
      if (!append) setGames([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    void loadGames(0, false);
  }, [user?.user.id, loadGames]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      void loadGames(offset, true);
    }
  }, [isLoadingMore, hasMore, isLoading, offset, loadGames]);

  useEffect(() => {
    const handleScroll = () => {
      if (isLoadingMore || !hasMore) return;
      const el = scrollContainerRef.current;
      const scrollTop = el ? el.scrollTop : window.pageYOffset;
      const scrollHeight = el ? el.scrollHeight : document.documentElement.scrollHeight;
      const clientHeight = el ? el.clientHeight : window.innerHeight;
      if (scrollTop + clientHeight >= scrollHeight - 200) loadMore();
    };
    const el = scrollContainerRef.current;
    const target: Window | HTMLDivElement = el || window;
    target.addEventListener('scroll', handleScroll);
    return () => target.removeEventListener('scroll', handleScroll);
  }, [isLoadingMore, hasMore, loadMore]);

  return (
    <div ref={scrollContainerRef} className={panel.panelRoot}>
      <header className={panel.header}>
        <h1 className={panel.title}>游玩历史</h1>
        <p className={panel.sub}>你玩过的游戏记录，可继续游玩</p>
      </header>
      {isLoading ? (
        <GameGridSkeleton count={8} />
      ) : (
        <>
          <GameGrid games={games} />
          {isLoadingMore ? <GameGridSkeleton count={4} /> : null}
          {!isLoading && games.length === 0 ? (
            <p className={panel.empty}>暂无游玩记录</p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default WarehousePlayHistory;
