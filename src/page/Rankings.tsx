import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import styles from './Rankings.module.css';
import getRankingsApi from '../api/rankings/getRankings';
import type { RankingsApiType, RankingsGameItem } from '../api/rankings/getRankings.type';
import type { RankingsCategoryKey } from '../api/rankings/getRankingsAll.type';
import { getImageUrl, resolveGameCoverUrl } from '../utils/constants';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import { getGameTypeLabel, getGameTypeTone, type GameTypeTone } from '../utils/gameTypeLabel';
import { resolveGameTypeToneStyle } from '../utils/gameTypeToneClass';
import type { UserGameData } from '../api/home/getGameData.type';

type RankingTab = 'all' | 'hot' | 'new' | 'rising' | 'sales' | 'romance';

/**
 * 与后端 interaction 互动榜相关：
 *  - 人气榜 -> overall（总榜，按点赞数降序）
 *  - 新作榜 -> new
 *  - 飙升榜 -> hot（近7天增量）
 *  - 畅销榜 -> rating
 *  - 互动榜 -> interaction
 * 全部 tab 走聚合接口 /api/auth/games/rankings/all。
 */
const TAB_TO_API_TYPE: Record<Exclude<RankingTab, 'all'>, RankingsApiType> = {
    hot: 'overall',
    new: 'new',
    rising: 'hot',
    sales: 'rating',
    romance: 'interaction',
};

/** RankingsCategoryKey -> RankingTab 的反向映射 */
const API_TYPE_TO_TAB: Record<RankingsApiType, RankingTab> = {
    overall: 'hot',
    new: 'new',
    hot: 'rising',
    rating: 'sales',
    interaction: 'romance',
};

const RANKING_PAGE_SIZE = 20;
const DEFAULT_RANKING_COVER = `${import.meta.env.BASE_URL}data/assets/defaultScene.png`;

interface RankedGame {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    coverUrl: string;
    playCount: number;
    updateInfo: string;
    category: string;
    authorName: string;
    tags: string[];
    gameTags: string[];
    gameTypeLabel: string;  // 转换后的中文标签
    gameTypeTone: GameTypeTone;  // 标签色调
    theme_tag_names?: string[];
}

function apiGameToRanked(item: RankingsGameItem): RankedGame {
    const tagsFromTheme = Array.isArray(item.theme_tag_names) ? item.theme_tag_names : [];
    const tagsFromGame = typeof item.game_tags === 'string' && item.game_tags.trim()
        ? item.game_tags.split(/[,，;；\s]+/).filter(Boolean)
        : [];
    const tags = tagsFromTheme.length > 0 ? tagsFromTheme : tagsFromGame;
    const author = item.author_name && item.author_name.trim() ? item.author_name : '匿名作者';
    // 列表展示与进详情预览统一走 display-cover，勿把原图 cover.png 绝对地址塞进 preview
    const coverRaw = resolveGameCoverUrl(item) || item.cover_url || '';
    const cover = getImageUrl(coverRaw) || DEFAULT_RANKING_COVER;
    const category = tags[0] ?? item.engine ?? '综合';
    const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
    const updateInfo = updatedAt && !Number.isNaN(updatedAt.getTime())
        ? `更新于 ${updatedAt.toLocaleDateString('zh-CN')}`
        : '';
    // 使用 getGameTypeLabel 转换原始标签为中文展示名
    const gameTypeLabel = getGameTypeLabel(item.game_tags, item.engine);
    const gameTypeTone = getGameTypeTone(item.game_tags, item.engine);
    return {
        id: item.file_id,
        title: item.title,
        subtitle: item.subtitle || item.description || '',
        description: item.description || '',
        coverUrl: cover,
        playCount: item.total_uv_count || item.like_count,
        updateInfo,
        category,
        authorName: author,
        tags,
        gameTags: tagsFromGame,
        gameTypeLabel,
        gameTypeTone,
        theme_tag_names: item.theme_tag_names ?? [],
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
        like_count: game.playCount || 0,
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
        avatarUrl: '',
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
];

/** 纯配置，无 games 字段；games 在组件内从 allTabState 注入 */
const ALL_TAB_SECTION_CONFIG: Array<{
    key: RankingsCategoryKey;
    label: string;
    labelZh: string;
}> = [
    { key: 'overall',    label: 'Hot',     labelZh: '人气榜' },
    { key: 'new',        label: 'New',     labelZh: '新作榜' },
    { key: 'hot',        label: 'Rising',  labelZh: '飙升榜' },
    { key: 'interaction',label: 'Interaction',  labelZh: '互动榜' },
    { key: 'rating',     label: 'Sales',      labelZh: '高分榜' },
];

const RANK_BADGE_ASSETS: Record<number, string> = {
    1: `${import.meta.env.BASE_URL}data/assets/第一.svg`,
    2: `${import.meta.env.BASE_URL}data/assets/第二.svg`,
    3: `${import.meta.env.BASE_URL}data/assets/第三.svg`,
};

function formatAuthorMeta(game: RankedGame): string {
    return game.authorName;
}

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
}

interface AllTabState {
    /** key = RankingsCategoryKey, value = RankedGame[] */
    data: Partial<Record<RankingsCategoryKey, RankedGame[]>>;
    loading: boolean;
    error: string | null;
    loaded: boolean;
}

const API_TAB_KEYS: Array<Exclude<RankingTab, 'all'>> = ['hot', 'new', 'rising', 'sales', 'romance'];

const Rankings: React.FC = () => {
    const { i18n } = useTranslation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<RankingTab>('all');
    const [isMobilePage, setIsMobilePage] = useState(window.innerWidth <= 768);
    const [apiTabState, setApiTabState] = useState<Record<Exclude<RankingTab, 'all'>, TabState>>(
        () => API_TAB_KEYS.reduce((acc, key) => {
            acc[key] = { data: [], loading: false, error: null, loaded: false };
            return acc;
        }, {} as Record<Exclude<RankingTab, 'all'>, TabState>)
    );
    const [allTabState, setAllTabState] = useState<AllTabState>({
        data: {},
        loading: false,
        error: null,
        loaded: false,
    });

    const tabAbortRef = useRef<AbortController | null>(null);
    const allAbortRef = useRef<AbortController | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            tabAbortRef.current?.abort();
            allAbortRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobilePage(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isZh = useMemo(() => i18n.language.startsWith('zh'), [i18n.language]);

    const fetchTabData = async (tab: Exclude<RankingTab, 'all'>) => {
        tabAbortRef.current?.abort();
        const controller = new AbortController();
        tabAbortRef.current = controller;

        setApiTabState((prev) => ({
            ...prev,
            [tab]: { ...prev[tab], loading: true, error: null },
        }));

        try {
            const apiType = TAB_TO_API_TYPE[tab];
            const resp = await getRankingsApi.getRankings({
                type: apiType,
                limit: RANKING_PAGE_SIZE,
                offset: 0,
            });
            if (controller.signal.aborted || !isMountedRef.current) return;

            const payload = resp?.data;
            if (!payload?.success) {
                throw new Error(payload?.message || '加载排行榜失败');
            }
            const items = Array.isArray(payload.data) ? payload.data : [];
            setApiTabState((prev) => ({
                ...prev,
                [tab]: { data: items.map(apiGameToRanked), loading: false, error: null, loaded: true },
            }));
        } catch (err: unknown) {
            const e = err as { code?: string; name?: string; message?: string; response?: { data?: { message?: string } } };
            if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') {
                if (!isMountedRef.current || tabAbortRef.current !== controller) return;
                setApiTabState((prev) => ({
                    ...prev,
                    [tab]: { ...prev[tab], loading: false },
                }));
                return;
            }
            if (controller.signal.aborted || !isMountedRef.current) return;
            const message = e?.response?.data?.message || e?.message || '加载排行榜失败，请稍后再试';
            setApiTabState((prev) => ({
                ...prev,
                [tab]: { ...prev[tab], loading: false, error: message },
            }));
        }
    };

    const fetchAllTabData = async () => {
        allAbortRef.current?.abort();
        const controller = new AbortController();
        allAbortRef.current = controller;

        setAllTabState((prev) => ({ ...prev, loading: true, error: null }));

        try {
            const resp = await getRankingsApi.getRankingsAll();
            if (controller.signal.aborted || !isMountedRef.current) return;

            const payload = resp?.data;
            if (!payload?.success) {
                throw new Error(payload?.message || '加载排行榜失败');
            }

            const rawData = payload.data ?? {};
            const mapped: Partial<Record<RankingsCategoryKey, RankedGame[]>> = {};
            for (const key of Object.keys(rawData) as RankingsCategoryKey[]) {
                const items = rawData[key];
                if (Array.isArray(items)) {
                    mapped[key] = items.map(apiGameToRanked);
                }
            }
            setAllTabState({ data: mapped, loading: false, error: null, loaded: true });
        } catch (err: unknown) {
            const e = err as { code?: string; name?: string; message?: string; response?: { data?: { message?: string } } };
            if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') {
                if (!isMountedRef.current || allAbortRef.current !== controller) return;
                setAllTabState((prev) => ({ ...prev, loading: false }));
                return;
            }
            if (controller.signal.aborted || !isMountedRef.current) return;
            const message =
                e?.response?.data?.message || e?.message || '加载排行榜失败，请稍后再试';
            setAllTabState((prev) => ({ ...prev, loading: false, error: message }));
        }
    };

    useEffect(() => {
        if (activeTab === 'all') {
            tabAbortRef.current?.abort();
            if (!allTabState.loaded && !allTabState.loading) {
                fetchAllTabData();
            }
            return;
        }
        allAbortRef.current?.abort();
        const tab = activeTab as Exclude<RankingTab, 'all'>;
        fetchTabData(tab);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    // Build the "all" merged list from allTabState (API data), top 5 per category
    const allMergedList = useMemo<RankedGame[]>(() => [
        ...(allTabState.data.overall ?? []).slice(0, 5),
        ...(allTabState.data.hot ?? []).slice(0, 5),
        ...(allTabState.data.new ?? []).slice(0, 5),
        ...(allTabState.data.interaction ?? []).slice(0, 5),
        ...(allTabState.data.rating ?? []).slice(0, 5),
    ], [allTabState.data]);

    const apiTabCurrent = activeTab !== 'all' ? apiTabState[activeTab] : null;
    const currentTabData = useMemo<RankedGame[]>(() =>
        activeTab === 'all'
            ? allMergedList
            : (apiTabCurrent?.data ?? []),
        [activeTab, allMergedList, apiTabCurrent]
    );

    // Tab 显示逻辑：
    // - 全部 Tab：等 allTabState 加载完成即可显示
    // - 子 Tab：在 allTab 中有数据时就显示（与 activeTab 无关）
    const filteredTabs = useMemo(() => {
        if (!allTabState.loaded && !allTabState.loading) return [];
        return TAB_CONFIG.filter(tab => {
            if (tab.key === 'all') return true;
            const apiType = TAB_TO_API_TYPE[tab.key as Exclude<RankingTab, 'all'>];
            return (allTabState.data[apiType] ?? []).length > 0;
        });
    }, [allTabState.loaded, allTabState.data, allTabState.loading]);

    // 当 filteredTabs 为空时自动切换到第一个有数据的 Tab
    useEffect(() => {
        if (filteredTabs.length === 0) return;
        if (!filteredTabs.find(t => t.key === activeTab)) {
            setActiveTab(filteredTabs[0].key);
        }
    }, [filteredTabs, activeTab]);

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
                        onClick={() => fetchTabData(activeTab as Exclude<RankingTab, 'all'>)}
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
                                <div className={styles.horizontalCardAuthor}>{game.authorName}</div>
                                <div className={styles.horizontalCardDesc}>
                                    {game.description}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const handleGameClick = (game: RankedGame) => {
        if (!game.id) return;
        navigate(`/game/${game.id}`, {
            state: buildGameDetailNavigateState('other', rankedGameToPreview(game)),
        });
    };

    return (
        <AppPageShell shellClassName={styles.pageRoot} mainClassName={styles.page}>
                <div className={styles.pageInner}>
                {/* Tab Bar */}
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

                {activeTab === 'all' ? (
                    /* ── 全部 Tab: 各分类 Top 5 网格 ── */
                    <>
                    <div className={styles.allTabGrid}>
                        {allTabState.loading ? (
                            /* Loading skeleton */
                            ALL_TAB_SECTION_CONFIG.map((section) => (
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
                            ALL_TAB_SECTION_CONFIG.map((section) => {
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
                                                onClick={() => setActiveTab(API_TYPE_TO_TAB[section.key as RankingsApiType])}
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
                                                        <div className={styles.categoryBoxAuthor}>{formatAuthorMeta(game)}</div>
                                                        {themeTags.length > 0 ? (
                                                            <div className={styles.categoryBoxMeta}>
                                                                {themeTags.slice(0, 2).map((tag) => (
                                                                    <span key={tag} className={styles.categoryBoxMetaPill}>{tag}</span>
                                                                ))}
                                                            </div>
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
                ) : (
                    <>
                    {/* 子排行榜内容：从接口拉取，按 activeTab 缓存 */}
                    {renderApiContent()}
                    </>
                )}
            </div>

        {!isMobilePage && <FooterArea />}
        </AppPageShell>
    );
};

export default Rankings;
