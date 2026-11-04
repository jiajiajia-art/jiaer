import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Favorites.module.css';
import AppPageShell from '../components/Layout/AppPageShell';
import GameGrid from '../components/GameGrid';
import FooterArea from '../components/Layout/FooterArea';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import favoriteApi from '../api/favorite/favoriteApi';
import type { UserGameData } from '../api/home/getGameData.type';
import { useAuthStore } from '../store/useAuthStore';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';

const PAGE_SIZE = 20;

const Favorites: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const scrollContainerRef = useRef<HTMLElement>(null);

  const [games, setGames] = useState<UserGameData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadGames = useCallback(async (currentOffset: number, append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await favoriteApi.list({
        limit: String(PAGE_SIZE),
        offset: String(currentOffset),
      });

      if (response.data.success && response.data.data) {
        const { rows, hasMore: nextHasMore } = response.data.data;
        setGames((prev) => (append ? [...prev, ...rows] : rows));
        setHasMore(Boolean(nextHasMore));
        setOffset(currentOffset + rows.length);
      } else {
        if (!append) setGames([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('获取收藏列表失败:', error);
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
    loadGames(0, false);
  }, [user?.user?.id, loadGames]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      loadGames(offset, true);
    }
  }, [isLoadingMore, hasMore, isLoading, offset, loadGames]);

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

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home');
    }
  };

  const handleFavoriteGameClick = useCallback((game: UserGameData) => {
    if (Number(game.is_public) !== 1) {
      toast.error(t('favorites.unpublishedHint'));
      return;
    }
    const gameId = game.file_id || game.id;
    if (!gameId) return;
    navigate(`/game/${gameId}`, {
      state: buildGameDetailNavigateState('favorites', game),
    });
  }, [navigate, t]);

  return (
    <AppPageShell
      shellClassName={styles.pageRoot}
      mainClassName={styles.mainContent}
      mainRef={scrollContainerRef}
    >
        <div className={styles.main}>
          <div className={styles.pageHeader}>
            <button type="button" className={styles.backButton} onClick={handleBack} aria-label={t('favorites.back')}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15 6L9 12L15 18" />
              </svg>
            </button>
            <h1 className={styles.pageTitle}>{t('favorites.title')}</h1>
          </div>

          {isLoading ? (
            <GameGridSkeleton count={12} />
          ) : games.length === 0 ? (
            <div className={styles.emptyState}>{t('favorites.empty')}</div>
          ) : (
            <>
              <GameGrid games={games} onGameClick={handleFavoriteGameClick} />
              {isLoadingMore && (
                <div className={styles.loadingMore}>
                  <GameGridSkeleton count={4} />
                </div>
              )}
            </>
          )}
        </div>
      <FooterArea />
    </AppPageShell>
  );
};

export default Favorites;
