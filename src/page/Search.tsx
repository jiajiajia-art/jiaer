/**
 * 搜索结果页：组织方式参考「全部 / 游戏 / 创作者」分块，视觉沿用本站暗色与作品卡/用户卡。
 * 全部：直接列出相关作者与相关游戏（同页完整结果，不再截断 4 条、不放「查看更多」）；无结果居中空状态。
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import GameGrid from '../components/GameGrid';
import SearchUserCard from '../components/SearchUserCard';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import userSearchApi, { type SearchUserItem } from '../api/account/userSearchApi';
import accountSocialApi from '../api/account/accountSocialApi';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/error';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import styles from './Search.module.css';

export type SearchTab = 'all' | 'games' | 'creators';

/** 功能注释：「全部」与分页签共用同一页大小，避免全部只预览 4 条 */
const FULL_PAGE_SIZE = 24;

const isSearchTab = (value: string | null): value is SearchTab =>
  value === 'all' || value === 'games' || value === 'creators';

const SearchPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selfCode = useAuthStore((s) => s.user?.user?.userCode || '');

  const keyword = (searchParams.get('q') || '').trim();
  const tabParam = searchParams.get('tab');
  const activeTab: SearchTab = isSearchTab(tabParam) ? tabParam : 'all';

  const [games, setGames] = useState<UserGameData[]>([]);
  const [creators, setCreators] = useState<SearchUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUserCode, setBusyUserCode] = useState<string | null>(null);

  const setTab = useCallback(
    (tab: SearchTab) => {
      const next = new URLSearchParams(searchParams);
      if (keyword) next.set('q', keyword);
      else next.delete('q');
      if (tab === 'all') next.delete('tab');
      else next.set('tab', tab);
      setSearchParams(next, { replace: true });
    },
    [keyword, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!isSearchTab(tabParam) && tabParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
    }
  }, [tabParam, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    const q = keyword;
    if (!q) {
      setGames([]);
      setCreators([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const needGames = activeTab === 'all' || activeTab === 'games';
        const needCreators = activeTab === 'all' || activeTab === 'creators';

        const [gameRes, userRes] = await Promise.all([
          needGames
            ? getGameDataApi.searchPublicGames({
                q,
                page: 1,
                pageSize: FULL_PAGE_SIZE,
                sort: 'relevance',
              })
            : Promise.resolve(null),
          needCreators
            ? userSearchApi.searchUsers({ q, page: 1, pageSize: FULL_PAGE_SIZE })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        if (gameRes) {
          // 功能注释：与 Navbar 一致，data 直接是游戏数组
          const list = Array.isArray(gameRes.data?.data) ? gameRes.data.data : [];
          setGames(list);
        } else {
          setGames([]);
        }

        if (userRes) {
          const payload = userRes.data?.data;
          const list = Array.isArray(payload?.items) ? payload.items : [];
          setCreators(list);
        } else {
          setCreators([]);
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setGames([]);
          setCreators([]);
          toast.error(getApiErrorMessage(error, t('search.failed')));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [keyword, activeTab, t]);

  const showCreatorsBlock =
    (activeTab === 'all' || activeTab === 'creators') && creators.length > 0;
  const showGamesBlock = (activeTab === 'all' || activeTab === 'games') && games.length > 0;

  const tabHasNoResults = (() => {
    if (!keyword || loading) return false;
    if (activeTab === 'all') return creators.length === 0 && games.length === 0;
    if (activeTab === 'games') return games.length === 0;
    return creators.length === 0;
  })();

  const handleToggleFollow = async (user: SearchUserItem) => {
    if (!selfCode) {
      toast.error(t('report.loginRequired'));
      return;
    }
    setBusyUserCode(user.userCode);
    try {
      if (user.isFollowing) {
        await accountSocialApi.unfollowOrRemove(user.userCode, 'unfollow');
        setCreators((list) =>
          list.map((item) =>
            item.userCode === user.userCode ? { ...item, isFollowing: false } : item,
          ),
        );
      } else {
        await accountSocialApi.follow(user.userCode);
        setCreators((list) =>
          list.map((item) =>
            item.userCode === user.userCode ? { ...item, isFollowing: true } : item,
          ),
        );
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('search.followFailed')));
    } finally {
      setBusyUserCode(null);
    }
  };

  const openGame = (game: UserGameData) => {
    const gameId = game.file_id || game.id;
    if (!gameId) return;
    navigate(`/game/${gameId}`, {
      state: buildGameDetailNavigateState('search', game),
    });
  };

  return (
    <AppPageShell
      shellClassName={`${styles.pageRoot}`}
      mainClassName={styles.main}
    >
        <div data-search-page="1">
        <h1 className={styles.title}>
          {t('search.resultsTitle')}
          {keyword ? (
            <>
              {' '}
              <span className={styles.keyword}>&quot;{keyword}&quot;</span>
            </>
          ) : null}
        </h1>

        <div className={styles.tabs} role="tablist" aria-label={t('search.tabsLabel')}>
          {(
            [
              ['all', t('search.tabAll')],
              ['games', t('search.tabGames')],
              ['creators', t('search.tabCreators')],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? <p className={styles.loading}>{t('search.searching')}</p> : null}

        {!loading && tabHasNoResults ? (
          <div className={styles.empty} data-search-empty="1">
            <p className={styles.emptyLine1}>{t('search.noRelatedContent')}</p>
            <p className={styles.emptyLine2}>{t('search.tryOtherKeywords')}</p>
          </div>
        ) : null}

        {!loading && !tabHasNoResults ? (
          <>
            {showCreatorsBlock ? (
              <section className={styles.section} data-search-section="creators">
                {activeTab === 'all' ? (
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{t('search.relatedCreators')}</h2>
                  </div>
                ) : null}
                <div className={styles.userList}>
                  {creators.map((user) => (
                    <SearchUserCard
                      key={user.userCode}
                      user={user}
                      selfCode={selfCode}
                      busy={busyUserCode === user.userCode}
                      onToggleFollow={handleToggleFollow}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {showGamesBlock ? (
              <section className={styles.section} data-search-section="games">
                {activeTab === 'all' ? (
                  <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>{t('search.relatedGames')}</h2>
                  </div>
                ) : null}
                <GameGrid
                  games={games}
                  layoutVariant="homeWide"
                  onGameClick={openGame}
                  emptyText=""
                />
              </section>
            ) : null}
          </>
        ) : null}
        </div>
      <FooterArea />
    </AppPageShell>
  );
};

export default SearchPage;
