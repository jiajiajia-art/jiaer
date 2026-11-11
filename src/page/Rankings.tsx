import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import { CardFlameIcon, CardHeartIcon } from '../components/GameCardStatIcons';
import styles from './Rankings.module.css';
import getRankingsApi from '../api/rankings/getRankings';
import type { RankingsApiType, RankingsAuthorItem, RankingsGameItem } from '../api/rankings/getRankings.type';
import type { RankingsCategoryKey } from '../api/rankings/getRankingsAll.type';
import { getImageUrl, resolveGameCoverUrl } from '../utils/constants';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import { getGameTypeLabel, getGameTypeTone, type GameTypeTone } from '../utils/gameTypeLabel';
import { resolveGameTypeToneStyle } from '../utils/gameTypeToneClass';
import type { UserGameData } from '../api/home/getGameData.type';
import {
    clearRankingsLoadingFlags,
    isRankingsVisibleAllSectionKey,
    isRankingsVisibleTabKey,
    mergeRankingsUniqueById,
    resolveRankingsHasMore,
    resolveRankingsHeatAndFavorite,
    resolveRankingsPanelKind,
    resolveRankingsPlainDescription,
    shouldFetchRankingsTab,
} from '../lib/rankingsUi';

type RankingTab = 'all' | 'hot' | 'new' | 'rising' | 'sales' | 'romance' | 'authors';
type GameRankingTab = Exclude<RankingTab, 'all' | 'authors'>;

/**
 * 与后端排行榜 type 映射：
 *  - 人气榜 -> overall
 *  - 新作榜 -> new
 *  - 飙升榜 -> hot
 *  - 高分榜 -> rating
 *  - 互动榜 -> interaction
 *  - 作者榜 -> authors（游玩轮次，单独结构）
 */
const TAB_TO_API_TYPE: Record<GameRankingTab, Exclude<RankingsApiType, 'authors'>> = {
    hot: 'overall',
    new: 'new',
    rising: 'hot',
    sales: 'rating',
    romance: 'interaction',
};

/** RankingsCategoryKey -> RankingTab 的反向映射 */
const API_TYPE_TO_TAB: Record<RankingsCategoryKey, RankingTab> = {
    overall: 'hot',
    new: 'new',
    hot: 'rising',
    rating: 'sales',
    interaction: 'romance',
    authors: 'authors',
};

const RANKING_PAGE_SIZE = 20;
const DEFAULT_RANKING_COVER = `${import.meta.env.BASE_URL}data/assets/defaultScene.png`;
const DEFAULT_AUTHOR_AVATAR = `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;

interface RankedGame {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    coverUrl: string;
    playCount: number;
    heatCount: number;
    likeCount: number;
    favoriteCount: number;
    updateInfo: string;
    category: string;
    authorName: string;
    authorAvatarUrl: string;
    tags: string[];
    gameTags: string[];
    gameTypeLabel: string;
    gameTypeTone: GameTypeTone;
    theme_tag_names?: string[];
}

interface RankedAuthor {
    creatorUserId: string;
    userCode: string;
    nickname: string;
    avatarUrl: string;
    playRounds: number;
    publicWorkCount: number;
    topWorkTitle: string;
    topWorkCoverUrl: string;
    topWorkFileId: string;
}

function apiGameToRanked(item: RankingsGameItem): RankedGame {
    const tagsFromTheme = Array.isArray(item.theme_tag_names) ? item.theme_tag_names : [];
    const tagsFromGame = typeof item.game_tags === 'string' && item.game_tags.trim()
        ? item.game_tags.split(/[,，;；\s]+/).filter(Boolean)
        : [];
    const tags = tagsFromTheme.length > 0 ? tagsFromTheme : tagsFromGame;
    const author = item.author_name && item.author_name.trim() ? item.author_name : '匿名作者';
    const coverRaw = resolveGameCoverUrl(item) || item.cover_url || '';
    const cover = getImageUrl(coverRaw) || DEFAULT_RANKING_COVER;
    const category = tags[0] ?? item.engine ?? '综合';
    const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
    const updateInfo = updatedAt && !Number.isNaN(updatedAt.getTime())
        ? `更新于 ${updatedAt.toLocaleDateString('zh-CN')}`
        : '';
    const gameTypeLabel = getGameTypeLabel(item.game_tags, item.engine);
    const gameTypeTone = getGameTypeTone(item.game_tags, item.engine);
    const { heat, favorite } = resolveRankingsHeatAndFavorite(item);
    const avatarRaw = typeof item.avatarUrl === 'string' ? item.avatarUrl.trim() : '';
    const plainDescription = resolveRankingsPlainDescription(item.description || item.subtitle || '');
    return {
        id: item.file_id,
        title: item.title,
        subtitle: resolveRankingsPlainDescription(item.subtitle || item.description || ''),
        description: plainDescription,
        coverUrl: cover,
        playCount: heat || item.like_count || 0,
        heatCount: heat,
        likeCount: Number(item.like_count) || 0,
        favoriteCount: favorite,
        updateInfo,
        category,
        authorName: author,
        authorAvatarUrl: getImageUrl(avatarRaw) || DEFAULT_AUTHOR_AVATAR,
        tags,
        gameTags: tagsFromGame,
        gameTypeLabel,
        gameTypeTone,
        theme_tag_names: item.theme_tag_names ?? [],
    };
}

function apiAuthorToRanked(item: RankingsAuthorItem): RankedAuthor {
    const coverRaw = item.top_work?.display_cover_url || item.top_work?.cover_url || '';
    const avatarRaw = item.avatar_url || '';
    return {
        creatorUserId: item.creator_user_id,
        userCode: item.user_code || '',
        nickname: item.nickname?.trim() || '匿名作者',
        avatarUrl: getImageUrl(avatarRaw) || DEFAULT_AUTHOR_AVATAR,
        playRounds: Number(item.play_rounds || 0),
        publicWorkCount: Number(item.public_work_count || 0),
        topWorkTitle: item.top_work?.title || '',
        topWorkCoverUrl: getImageUrl(coverRaw) || DEFAULT_RANKING_COVER,
        topWorkFileId: item.top_work?.file_id || '',
    };
}

function rankedGameToPreview(game: RankedGame): UserGameData {
    return {
        id: game.id,
        file_id: game.id,
        title: game.title,
        subtitle: game.subtitle,
        description: game.description,
        cover_url: game.coverUrl,
        display_cover_url: game.coverUrl,
        author_name: game.authorName,
        game_tags: game.gameTags.join(',') || game.tags.join(',') || '',
        theme_tag_names: game.theme_tag_names ?? game.tags,
        like_count: game.likeCount || game.playCount || 0,
        favorite_count: game.favoriteCount || 0,
        total_uv_count: game.heatCount || 0,
        creator_user_id: '',
        doc_url: '',
        files: '',
        price_amount: null,
        special_price_amount: 0,
        rating_avg: null,
        rating_count: null,
        created_at: '',
        updated_at: '',
        is_public: 1,
        dislike_count: 0,
        reaction: '',
        avatarUrl: game.authorAvatarUrl || '',
        is_preset: 0,
        needDeleted: false,
    };
}

const TAB_CONFIG: { key: RankingTab; label: string; labelZh: string }[] = [
    { key: 'all', label: 'All', labelZh: '全部' },
    { key: 'hot', label: 'Hot', labelZh: '人气榜' },
    { key: 'new', label: 'New', labelZh: '新作榜' },
    { key: 'rising', label: 'Rising', labelZh: '飙升榜' },
    { key: 'sales', label: 'Sales', labelZh: '高分榜' },
    { key: 'romance', label: 'Interaction', labelZh: '互动榜' },
    { key: 'authors', label: 'Authors', labelZh: '作者榜' },
];

const ALL_TAB_SECTION_CONFIG: Array<{
    key: RankingsCategoryKey;
    label: string;
    labelZh: string;
}> = [
    { key: 'overall', label: 'Hot', labelZh: '人气榜' },
    { key: 'new', label: 'New', labelZh: '新作榜' },
    { key: 'hot', label: 'Rising', labelZh: '飙升榜' },
    { key: 'interaction', label: 'Interaction', labelZh: '互动榜' },
    { key: 'authors', label: 'Authors', labelZh: '作者榜' },
    { key: 'rating', label: 'Sales', labelZh: '高分榜' },
];

const RANK_BADGE_ASSETS: Record<number, string> = {
    1: `${import.meta.env.BASE_URL}data/assets/第一.svg`,
    2: `${import.meta.env.BASE_URL}data/assets/第二.svg`,
    3: `${import.meta.env.BASE_URL}data/assets/第三.svg`,
};

function getThemeTags(game: RankedGame): string[] {
    if (Array.isArray(game.theme_tag_names) && game.theme_tag_names.length > 0) {
        return game.theme_tag_names;
    }
    return [];
}

interface TabState {
    data: RankedGame[];
    loading: boolean;
    error: string | null;
    loaded: boolean;
    hasMore: boolean;
    loadingMore: boolean;
}

interface AuthorTabState {
    data: RankedAuthor[];
    loading: boolean;
    error: string | null;
    loaded: boolean;
    hasMore: boolean;
    loadingMore: boolean;
}

interface AllTabState {
    data: Partial<Record<Exclude<RankingsCategoryKey, 'authors'>, RankedGame[]>>;
    authors: RankedAuthor[];
    loading: boolean;
    error: string | null;
    loaded: boolean;
}

const GAME_TAB_KEYS: GameRankingTab[] = ['hot', 'new', 'rising', 'sales', 'romance'];

const emptyGameTabState = (): TabState => ({
    data: [],
    loading: false,
    error: null,
    loaded: false,
    hasMore: true,
    loadingMore: false,
});

const Rankings: React.FC = () => {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<RankingTab>('all');
    const [apiTabState, setApiTabState] = useState<Record<GameRankingTab, TabState>>(
        () => GAME_TAB_KEYS.reduce((acc, key) => {
            acc[key] = emptyGameTabState();
            return acc;
        }, {} as Record<GameRankingTab, TabState>)
    );
    const [authorTabState, setAuthorTabState] = useState<AuthorTabState>({
        data: [],
        loading: false,
        error: null,
        loaded: false,
        hasMore: true,
        loadingMore: false,
    });
    const [allTabState, setAllTabState] = useState<AllTabState>({
        data: {},
        authors: [],
        loading: false,
        error: null,
        loaded: false,
    });

    const tabAbortRef = useRef<AbortController | null>(null);
    const allAbortRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);
    const mainRef = useRef<HTMLElement | null>(null);
    const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
    const loadingMoreRef = useRef(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            tabAbortRef.current?.abort();
            allAbortRef.current?.abort();
        };
    }, []);

    const isZh = useMemo(() => i18n.language.startsWith('zh'), [i18n.language]);

    /** 功能注释：中止后必须清 loading，否则 shouldFetch 虽会重拉，UI 也会一直转圈 */
    const releaseGameTabLoading = (tab: GameRankingTab) => {
        if (!isMountedRef.current) return;
        setApiTabState((prev) => ({
            ...prev,
            [tab]: clearRankingsLoadingFlags(prev[tab]),
        }));
    };

    const releaseAuthorTabLoading = () => {
        if (!isMountedRef.current) return;
        setAuthorTabState((prev) => clearRankingsLoadingFlags(prev));
    };

    const releaseAllTabLoading = () => {
        if (!isMountedRef.current) return;
        setAllTabState((prev) => clearRankingsLoadingFlags(prev));
    };

    const fetchGameTabData = async (
        tab: GameRankingTab,
        options?: { append?: boolean; offset?: number },
    ) => {
        const append = Boolean(options?.append);
        if (append && loadingMoreRef.current) return;

        if (!append) {
            tabAbortRef.current?.abort();
        }
        const controller = new AbortController();
        if (!append) {
            tabAbortRef.current = controller;
        }

        const offset = append ? Math.max(0, Number(options?.offset) || 0) : 0;
        if (append) {
            loadingMoreRef.current = true;
            setApiTabState((prev) => ({
                ...prev,
                [tab]: { ...prev[tab], loadingMore: true, error: null },
            }));
        } else {
            setApiTabState((prev) => ({
                ...prev,
                [tab]: { ...prev[tab], loading: true, error: null },
            }));
        }

        try {
            const apiType = TAB_TO_API_TYPE[tab];
            const resp = await getRankingsApi.getRankings(
                {
                    type: apiType,
                    limit: RANKING_PAGE_SIZE,
                    offset,
                },
                { signal: controller.signal },
            );
            if (controller.signal.aborted || !isMountedRef.current) {
                releaseGameTabLoading(tab);
                return;
            }

            const payload = resp?.data;
            if (!payload?.success) {
                throw new Error(payload?.message || '加载排行榜失败');
            }
            const items = Array.isArray(payload.data) ? payload.data.map(apiGameToRanked) : [];
            setApiTabState((prev) => {
                const prevData = append ? prev[tab].data : [];
                // 功能注释：追加时按 fileId 去重；若本页没有新 id（接口忽略 offset）则停翻页
                const { merged, newUniqueCount } = append
                    ? mergeRankingsUniqueById(prevData, items, (g) => g.id)
                    : { merged: items, newUniqueCount: items.length };
                return {
                    ...prev,
                    [tab]: {
                        data: merged,
                        loading: false,
                        loadingMore: false,
                        error: null,
                        loaded: true,
                        hasMore: resolveRankingsHasMore({
                            pageSize: RANKING_PAGE_SIZE,
                            fetchedCount: items.length,
                            newUniqueCount: append ? newUniqueCount : items.length,
                        }),
                    },
                };
            });
        } catch (err: unknown) {
            const e = err as { code?: string; name?: string; message?: string; response?: { data?: { message?: string } } };
            if (
                e?.code === 'ERR_CANCELED'
                || e?.name === 'CanceledError'
                || e?.name === 'AbortError'
                || controller.signal.aborted
            ) {
                releaseGameTabLoading(tab);
                return;
            }
            if (!isMountedRef.current) return;
            const message = e?.response?.data?.message || e?.message || '加载排行榜失败，请稍后再试';
            setApiTabState((prev) => ({
                ...prev,
                [tab]: { ...prev[tab], loading: false, loadingMore: false, error: message },
            }));
        } finally {
            if (append) loadingMoreRef.current = false;
        }
    };

    const fetchAuthorTabData = async (options?: { append?: boolean; offset?: number }) => {
        const append = Boolean(options?.append);
        if (append && loadingMoreRef.current) return;

        if (!append) {
            tabAbortRef.current?.abort();
        }
        const controller = new AbortController();
        if (!append) {
            tabAbortRef.current = controller;
        }

        const offset = append ? Math.max(0, Number(options?.offset) || 0) : 0;
        if (append) {
            loadingMoreRef.current = true;
            setAuthorTabState((prev) => ({ ...prev, loadingMore: true, error: null }));
        } else {
            setAuthorTabState((prev) => ({ ...prev, loading: true, error: null }));
        }

        try {
            const resp = await getRankingsApi.getAuthorRankings(
                {
                    limit: RANKING_PAGE_SIZE,
                    offset,
                },
                { signal: controller.signal },
            );
            if (controller.signal.aborted || !isMountedRef.current) {
                releaseAuthorTabLoading();
                return;
            }

            const payload = resp?.data;
            if (!payload?.success) {
                throw new Error(payload?.message || '加载作者榜失败');
            }
            const items = Array.isArray(payload.data) ? payload.data.map(apiAuthorToRanked) : [];
            setAuthorTabState((prev) => {
                const { merged, newUniqueCount } = append
                    ? mergeRankingsUniqueById(prev.data, items, (a) => a.creatorUserId)
                    : { merged: items, newUniqueCount: items.length };
                return {
                    data: merged,
                    loading: false,
                    loadingMore: false,
                    error: null,
                    loaded: true,
                    hasMore: resolveRankingsHasMore({
                        pageSize: RANKING_PAGE_SIZE,
                        fetchedCount: items.length,
                        newUniqueCount: append ? newUniqueCount : items.length,
                    }),
                };
            });
        } catch (err: unknown) {
            const e = err as { code?: string; name?: string; message?: string; response?: { data?: { message?: string } } };
            if (
                e?.code === 'ERR_CANCELED'
                || e?.name === 'CanceledError'
                || e?.name === 'AbortError'
                || controller.signal.aborted
            ) {
                releaseAuthorTabLoading();
                return;
            }
            if (!isMountedRef.current) return;
            const message = e?.response?.data?.message || e?.message || '加载作者榜失败，请稍后再试';
            setAuthorTabState((prev) => ({ ...prev, loading: false, loadingMore: false, error: message }));
        } finally {
            if (append) loadingMoreRef.current = false;
        }
    };

    const fetchAllTabData = async () => {
        allAbortRef.current?.abort();
        const controller = new AbortController();
        allAbortRef.current = controller;

        setAllTabState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const resp = await getRankingsApi.getRankingsAll({ signal: controller.signal });
            if (controller.signal.aborted || !isMountedRef.current) {
                releaseAllTabLoading();
                return;
            }

            const payload = resp?.data;
            if (!payload?.success) {
                throw new Error(payload?.message || '加载排行榜失败');
            }

            const rawData = payload.data ?? {};
            const mapped: Partial<Record<Exclude<RankingsCategoryKey, 'authors'>, RankedGame[]>> = {};
            for (const key of ['overall', 'new', 'hot', 'interaction', 'rating'] as const) {
                const items = rawData[key];
                if (Array.isArray(items)) {
                    mapped[key] = items.map(apiGameToRanked);
                }
            }
            const authors = Array.isArray(rawData.authors)
                ? rawData.authors.map(apiAuthorToRanked)
                : [];
            setAllTabState({ data: mapped, authors, loading: false, error: null, loaded: true });
        } catch (err: unknown) {
            const e = err as { code?: string; name?: string; message?: string; response?: { data?: { message?: string } } };
            if (
                e?.code === 'ERR_CANCELED'
                || e?.name === 'CanceledError'
                || e?.name === 'AbortError'
                || controller.signal.aborted
            ) {
                releaseAllTabLoading();
                return;
            }
            if (!isMountedRef.current) return;
            const message =
                e?.response?.data?.message || e?.message || '加载排行榜失败，请稍后再试';
            setAllTabState((prev) => ({ ...prev, loading: false, error: message }));
        }
    };

    useEffect(() => {
        if (activeTab === 'all') {
            // 功能注释：离开单榜时立刻中止并清 loading，避免等 abort 回调之前 UI/门闩已卡死
            tabAbortRef.current?.abort();
            setApiTabState((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const key of GAME_TAB_KEYS) {
                    if (next[key].loading || next[key].loadingMore) {
                        next[key] = clearRankingsLoadingFlags(next[key]);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
            setAuthorTabState((prev) => (
                prev.loading || prev.loadingMore ? clearRankingsLoadingFlags(prev) : prev
            ));
            if (shouldFetchRankingsTab(allTabState)) {
                fetchAllTabData();
            }
            return;
        }
        allAbortRef.current?.abort();
        setAllTabState((prev) => (prev.loading ? clearRankingsLoadingFlags(prev) : prev));
        if (activeTab === 'authors') {
            if (shouldFetchRankingsTab(authorTabState)) {
                fetchAuthorTabData();
            }
            return;
        }
        const tabState = apiTabState[activeTab];
        if (tabState && shouldFetchRankingsTab(tabState)) {
            fetchGameTabData(activeTab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const apiTabCurrent = (activeTab !== 'all' && activeTab !== 'authors')
        ? apiTabState[activeTab]
        : null;
    const currentTabData = useMemo<RankedGame[]>(() =>
        activeTab === 'all' || activeTab === 'authors'
            ? []
            : (apiTabCurrent?.data ?? []),
        [activeTab, apiTabCurrent]
    );

    // 功能注释：仅露出全部/人气/新作/作者；飙升与互动仍保留 TAB_CONFIG 与接口映射
    const filteredTabs = useMemo(() => {
        return TAB_CONFIG.filter((tab) => isRankingsVisibleTabKey(tab.key));
    }, []);

    const visibleAllSections = useMemo(
        () => ALL_TAB_SECTION_CONFIG.filter((section) => isRankingsVisibleAllSectionKey(section.key)),
        [],
    );

    useEffect(() => {
        if (filteredTabs.length === 0) return;
        if (!filteredTabs.find((t) => t.key === activeTab)) {
            setActiveTab(filteredTabs[0].key);
        }
    }, [filteredTabs, activeTab]);

    const tryLoadMore = useCallback(() => {
        if (activeTab === 'all') return;
        if (activeTab === 'authors') {
            if (!authorTabState.hasMore || authorTabState.loading || authorTabState.loadingMore) return;
            void fetchAuthorTabData({ append: true, offset: authorTabState.data.length });
            return;
        }
        const tabState = apiTabState[activeTab];
        if (!tabState?.hasMore || tabState.loading || tabState.loadingMore) return;
        void fetchGameTabData(activeTab, { append: true, offset: tabState.data.length });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, authorTabState, apiTabState]);

    // 功能注释：接近列表底部时加载下一页；加载中不观察，避免连触发把列表撑爆
    useEffect(() => {
        const root = mainRef.current;
        const sentinel = loadMoreSentinelRef.current;
        if (!root || !sentinel || activeTab === 'all') return;
        const busy = activeTab === 'authors'
            ? (authorTabState.loading || authorTabState.loadingMore || !authorTabState.hasMore)
            : Boolean(apiTabCurrent?.loading || apiTabCurrent?.loadingMore || !apiTabCurrent?.hasMore);
        if (busy) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    tryLoadMore();
                }
            },
            { root, rootMargin: '120px 0px', threshold: 0 },
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [
        activeTab,
        tryLoadMore,
        currentTabData.length,
        authorTabState.data.length,
        authorTabState.loading,
        authorTabState.loadingMore,
        authorTabState.hasMore,
        apiTabCurrent?.loading,
        apiTabCurrent?.loadingMore,
        apiTabCurrent?.hasMore,
    ]);

    const handleGameClick = (game: RankedGame) => {
        if (!game.id) return;
        navigate(`/game/${game.id}`, {
            state: buildGameDetailNavigateState('other', rankedGameToPreview(game)),
        });
    };

    const handleAuthorClick = (author: RankedAuthor) => {
        if (author.userCode) {
            navigate(`/account/${author.userCode}`);
            return;
        }
        if (author.topWorkFileId) {
            navigate(`/game/${author.topWorkFileId}`);
        }
    };

    const renderAuthorByline = (game: RankedGame, avatarClassName: string, nameClassName: string) => (
        <div className={styles.authorByline}>
            <img
                src={game.authorAvatarUrl || DEFAULT_AUTHOR_AVATAR}
                alt=""
                className={avatarClassName}
                loading="lazy"
                decoding="async"
            />
            <span className={nameClassName}>{game.authorName}</span>
        </div>
    );

    const renderHeatFavorite = (game: RankedGame, rowClassName: string) => {
        const heat = game.heatCount || game.playCount || 0;
        const favorite = game.favoriteCount || game.likeCount || 0;
        return (
            <div className={rowClassName} aria-label={isZh ? '热度与收藏' : 'Heat and favorites'}>
                <span className={styles.statItem} title={isZh ? '热度' : 'Heat'}>
                    <CardFlameIcon className={styles.statFlame} />
                    <span className={styles.statValue}>{heat}</span>
                </span>
                <span className={styles.statItem} title={isZh ? '收藏' : 'Favorites'}>
                    <CardHeartIcon className={styles.statHeart} />
                    <span className={styles.statValue}>{favorite}</span>
                </span>
            </div>
        );
    };

    const renderAuthorList = (authors: RankedAuthor[], loading: boolean, error: string | null, onRetry: () => void) => {
        if (loading && authors.length === 0) {
            return (
                <div className={styles.stateWrap}>
                    <div className={styles.spinner} aria-hidden="true" />
                    <span className={styles.stateText}>{isZh ? '加载中…' : 'Loading…'}</span>
                </div>
            );
        }
        if (error && authors.length === 0) {
            return (
                <div className={styles.stateWrap}>
                    <span className={styles.stateText}>{error}</span>
                    <button className={styles.retryBtn} onClick={onRetry}>
                        {isZh ? '重试' : 'Retry'}
                    </button>
                </div>
            );
        }
        if (authors.length === 0) {
            return (
                <div className={styles.stateWrap}>
                    <span className={styles.stateText}>
                        {isZh ? '暂无数据' : 'No data yet'}
                    </span>
                </div>
            );
        }
        return (
            /* 功能注释：作者单榜用左对齐单列，PC 不要套作品榜双列网格把少量作者甩散 */
            <div className={styles.authorSection}>
                {authors.map((author, index) => {
                    const rank = index + 1;
                    const badgeSrc = RANK_BADGE_ASSETS[rank];
                    return (
                        <div
                            key={author.creatorUserId}
                            className={`${styles.horizontalCard} ${styles.horizontalAuthorCard}`}
                            onClick={() => handleAuthorClick(author)}
                        >
                            <div className={styles.authorAvatarWrap}>
                                <img
                                    src={author.avatarUrl}
                                    alt={author.nickname}
                                    className={styles.authorAvatar}
                                />
                            </div>
                            <div className={styles.horizontalCardInfo}>
                                <div className={styles.horizontalCardTitleRow}>
                                    {badgeSrc ? (
                                        <img
                                            src={badgeSrc}
                                            alt={`Rank ${rank}`}
                                            className={styles.horizontalCardBadgeImage}
                                        />
                                    ) : (
                                        <span className={styles.horizontalCardBadge}>{rank}</span>
                                    )}
                                    <h4 className={styles.horizontalCardTitle}>{author.nickname}</h4>
                                </div>
                                <div className={styles.horizontalCardAuthor}>
                                    {isZh
                                        ? `游玩轮次 ${author.playRounds}`
                                        : `${author.playRounds} play rounds`}
                                </div>
                                {author.topWorkTitle ? (
                                    <div className={styles.horizontalCardDesc}>
                                        {isZh ? `代表作：${author.topWorkTitle}` : `Top work: ${author.topWorkTitle}`}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderApiContent = () => {
        if (!apiTabCurrent) return null;
        if (apiTabCurrent.loading && !apiTabCurrent.loaded) {
            return (
                <div className={styles.stateWrap}>
                    <div className={styles.spinner} aria-hidden="true" />
                    <span className={styles.stateText}>{isZh ? '加载中…' : 'Loading…'}</span>
                </div>
            );
        }
        if (apiTabCurrent.error && !apiTabCurrent.loaded) {
            return (
                <div className={styles.stateWrap}>
                    <span className={styles.stateText}>{apiTabCurrent.error}</span>
                    <button
                        className={styles.retryBtn}
                        onClick={() => fetchGameTabData(activeTab as GameRankingTab)}
                    >
                        {isZh ? '重试' : 'Retry'}
                    </button>
                </div>
            );
        }
        if (currentTabData.length === 0) {
            return (
                <div className={styles.stateWrap}>
                    <span className={styles.stateText}>
                        {isZh ? '暂无数据' : 'No data yet'}
                    </span>
                </div>
            );
        }
        return (
            <div className={styles.horizontalSection}>
                {currentTabData.map((game, index) => {
                    const rank = index + 1;
                    const badgeSrc = RANK_BADGE_ASSETS[rank];

                    return (
                        <div
                            key={game.id}
                            className={styles.horizontalCard}
                            onClick={() => handleGameClick(game)}
                        >
                            <div className={styles.horizontalCardCoverWrap}>
                                <img
                                    src={game.coverUrl}
                                    alt={game.title}
                                    className={styles.horizontalCardCover}
                                />
                                {game.gameTypeLabel && (
                                    <div
                                        className={styles.horizontalCardTag}
                                        style={resolveGameTypeToneStyle(game.gameTypeTone)}
                                        title={game.gameTypeLabel}
                                    >
                                        {game.gameTypeLabel}
                                    </div>
                                )}
                            </div>
                            <div className={styles.horizontalCardInfo}>
                                <div className={styles.horizontalCardTitleRow}>
                                    {badgeSrc ? (
                                        <img
                                            src={badgeSrc}
                                            alt={`Rank ${rank}`}
                                            className={styles.horizontalCardBadgeImage}
                                        />
                                    ) : (
                                        <span className={styles.horizontalCardBadge}>{rank}</span>
                                    )}
                                    <h4 className={styles.horizontalCardTitle}>{game.title}</h4>
                                </div>
                                {/* 功能注释：作者与热度/收藏同一容器——移动端同行，PC 仍上下排列 */}
                                <div className={styles.authorStatsRow}>
                                    {renderAuthorByline(
                                        game,
                                        styles.horizontalCardAuthorAvatar,
                                        styles.horizontalCardAuthor,
                                    )}
                                    {renderHeatFavorite(game, styles.horizontalCardStats)}
                                </div>
                                {getThemeTags(game).length > 0 ? (
                                    <div className={styles.horizontalCardTags}>
                                        {getThemeTags(game).slice(0, 2).map((tag) => (
                                            <span key={tag} className={styles.horizontalCardTagPill}>{tag}</span>
                                        ))}
                                    </div>
                                ) : null}
                                {game.description ? (
                                    <div className={styles.horizontalCardDesc}>
                                        {game.description}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <AppPageShell
            shellClassName={styles.pageRoot}
            mainClassName={styles.page}
            mainRef={mainRef}
        >
                <div className={styles.pageInner}>
                <div className={styles.tabBar} role="tablist" aria-label={isZh ? '排行分类' : 'Ranking categories'}>
                    {filteredTabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.key}
                            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            <span className={styles.tabLabel}>
                                {isZh ? tab.labelZh : tab.label}
                            </span>
                            {activeTab === tab.key && (
                                <span className={styles.tabUnderline} />
                            )}
                        </button>
                    ))}
                </div>

                {/* 功能注释：key=activeTab 强制整面板卸载重建，禁止全部网格与单榜卡 DOM 被 React 复用串台 */}
                <div
                    key={activeTab}
                    data-rankings-panel={resolveRankingsPanelKind(activeTab)}
                >
                {activeTab === 'all' ? (
                    <>
                    <div className={styles.allTabGrid}>
                        {allTabState.loading ? (
                            visibleAllSections.map((section) => (
                                <div key={section.key} className={styles.categoryBox}>
                                    <div className={styles.categoryBoxHeader}>
                                        <h2 className={styles.categoryBoxTitle}>
                                            {isZh ? section.labelZh : section.label}
                                        </h2>
                                        <span className={styles.categoryBoxMore} aria-hidden="true">
                                            {isZh ? '更多' : 'More'}
                                            <img src={`${import.meta.env.BASE_URL}data/assets/向右箭头.svg`} alt="" className={styles.moreArrow} />
                                        </span>
                                    </div>
                                    <div className={styles.categoryBoxList}>
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <div key={i} className={`${styles.categoryBoxItem} ${styles.skeletonItem}`}>
                                                <span className={`${styles.categoryBoxRank} ${styles.skeletonRank}`} />
                                                <div className={`${styles.categoryBoxCoverWrap} ${styles.skeletonCover}`} />
                                                <div className={styles.categoryBoxInfo}>
                                                    <div className={`${styles.categoryBoxTitle2} ${styles.skeletonLine}`} />
                                                    <div className={`${styles.categoryBoxMeta} ${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : allTabState.error ? (
                            <div className={styles.stateWrap} style={{ gridColumn: '1 / -1' }}>
                                <span className={styles.stateText}>{allTabState.error}</span>
                                <button className={styles.retryBtn} onClick={fetchAllTabData}>
                                    {isZh ? '重试' : 'Retry'}
                                </button>
                            </div>
                        ) : (
                            visibleAllSections.map((section) => {
                                if (section.key === 'authors') {
                                    const authors = allTabState.authors.slice(0, 5);
                                    if (authors.length === 0) return null;
                                    return (
                                        <div key={section.key} className={styles.categoryBox}>
                                            <div className={styles.categoryBoxHeader}>
                                                <h2 className={styles.categoryBoxTitle}>
                                                    {isZh ? section.labelZh : section.label}
                                                </h2>
                                                <button
                                                    type="button"
                                                    className={styles.categoryBoxMore}
                                                    onClick={() => setActiveTab('authors')}
                                                >
                                                    {isZh ? '更多' : 'More'}
                                                    <img src={`${import.meta.env.BASE_URL}data/assets/向右箭头.svg`} alt="" className={styles.moreArrow} />
                                                </button>
                                            </div>
                                            <div className={styles.categoryBoxList}>
                                                {authors.map((author, index) => (
                                                    <div
                                                        key={author.creatorUserId}
                                                        className={`${styles.categoryBoxItem} ${styles.categoryBoxAuthorItem}`}
                                                        onClick={() => handleAuthorClick(author)}
                                                    >
                                                        <span className={styles.categoryBoxRank} data-rank={index + 1}>{index + 1}</span>
                                                        {/* 功能注释：全部页作者行用固定圆形头像，禁止套作品封面 4:3 导致椭圆与大片留白 */}
                                                        <div className={styles.categoryBoxAuthorAvatarWrap}>
                                                            <img
                                                                src={author.avatarUrl}
                                                                alt={author.nickname}
                                                                className={styles.categoryBoxAuthorAvatarImg}
                                                            />
                                                        </div>
                                                        <div className={styles.categoryBoxInfo}>
                                                            <div className={styles.categoryBoxTitle2}>{author.nickname}</div>
                                                            <div className={styles.categoryBoxAuthor}>
                                                                {isZh
                                                                    ? `游玩轮次 ${author.playRounds}`
                                                                    : `${author.playRounds} rounds`}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                }

                                const games = (allTabState.data[section.key] ?? []).slice(0, 5);
                                if (games.length === 0) return null;
                                return (
                                    <div key={section.key} className={styles.categoryBox}>
                                        <div className={styles.categoryBoxHeader}>
                                            <h2 className={styles.categoryBoxTitle}>
                                                {isZh ? section.labelZh : section.label}
                                            </h2>
                                            <button
                                                type="button"
                                                className={styles.categoryBoxMore}
                                                onClick={() => setActiveTab(API_TYPE_TO_TAB[section.key])}
                                            >
                                                {isZh ? '更多' : 'More'}
                                                <img src={`${import.meta.env.BASE_URL}data/assets/向右箭头.svg`} alt="" className={styles.moreArrow} />
                                            </button>
                                        </div>
                                        <div className={styles.categoryBoxList}>
                                            {games.map((game, index) => {
                                                const themeTags = getThemeTags(game);
                                                return (
                                                <div
                                                    key={game.id}
                                                    className={styles.categoryBoxItem}
                                                    onClick={() => handleGameClick(game)}
                                                >
                                                    <span className={styles.categoryBoxRank} data-rank={index + 1}>{index + 1}</span>
                                                    <div className={styles.categoryBoxCoverWrap}>
                                                        <img src={game.coverUrl} alt={game.title} className={styles.categoryBoxCover} />
                                                        {game.gameTypeLabel && (
                                                            <div
                                                                className={styles.categoryBoxTag}
                                                                style={resolveGameTypeToneStyle(game.gameTypeTone)}
                                                                title={game.gameTypeLabel}
                                                            >
                                                                {game.gameTypeLabel}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className={styles.categoryBoxInfo}>
                                                        <div className={styles.categoryBoxTitle2}>{game.title}</div>
                                                        {/* 功能注释：全部页游戏行同样包一层，移动端作者与热度收藏同行 */}
                                                        <div className={styles.authorStatsRow}>
                                                            {renderAuthorByline(
                                                                game,
                                                                styles.categoryBoxAuthorAvatar,
                                                                styles.categoryBoxAuthor,
                                                            )}
                                                            {renderHeatFavorite(game, styles.categoryBoxStats)}
                                                        </div>
                                                        {themeTags.length > 0 ? (
                                                            <div className={styles.categoryBoxMeta}>
                                                                {themeTags.slice(0, 2).map((tag) => (
                                                                    <span key={tag} className={styles.categoryBoxMetaPill}>{tag}</span>
                                                                ))}
                                                            </div>
                                                        ) : null}
                                                        {game.description ? (
                                                            <div className={styles.categoryBoxDesc}>{game.description}</div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    </>
                ) : activeTab === 'authors' ? (
                    <>
                    {renderAuthorList(
                        authorTabState.data,
                        authorTabState.loading,
                        authorTabState.error,
                        () => fetchAuthorTabData(),
                    )}
                    <div ref={loadMoreSentinelRef} className={styles.loadMoreSentinel} aria-hidden="true" />
                    {authorTabState.loadingMore ? (
                        <div className={styles.loadMoreHint}>{isZh ? '加载中…' : 'Loading…'}</div>
                    ) : null}
                    </>
                ) : (
                    <>
                    {renderApiContent()}
                    <div ref={loadMoreSentinelRef} className={styles.loadMoreSentinel} aria-hidden="true" />
                    {apiTabCurrent?.loadingMore ? (
                        <div className={styles.loadMoreHint}>{isZh ? '加载中…' : 'Loading…'}</div>
                    ) : null}
                    </>
                )}
                </div>
            </div>

        <FooterArea />
        </AppPageShell>
    );
};

export default Rankings;
