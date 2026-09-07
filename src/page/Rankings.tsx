import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
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

function formatThemeMeta(game: RankedGame): string {
    if (Array.isArray(game.theme_tag_names) && game.theme_tag_names.length > 0) {
        return game.theme_tag_names.join('  ');
    }
    return '';
}

function CategoryBoxMeteorIcon({ className }: { className: string }) {
    return (
        <svg
            viewBox="0 0 1025 1024"
            aria-hidden="true"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M466.985423 590.45059c142.556648-106.075429 205.76061-296.746667 189.625295-572.027123 4.067962-50.056533 62.983314 1.889524 176.73021 155.847923L981.179709 10.732495a24.939276 24.939276 0 0 1 13.1072-7.597105 25.334248 25.334248 0 0 1 15.174705 1.323886c4.790857 1.987048 8.823467 5.396724 11.526095 9.747505a23.87139 23.87139 0 0 1 3.536457 14.496914c-31.967086 401.837105-198.534095 646.20739-499.699809 733.110857-318.390857 91.882057-337.670095 34.756267-57.825524-171.350552l-0.01341-0.01341z"
                fill="currentColor"
            />
            <path
                d="M239.731785 164.167924c0 8.94659-3.631543 17.526248-10.097371 23.851886-6.465829 6.325638-15.235657 9.879162-24.379734 9.879161-9.144076 0-17.912686-3.553524-24.378514-9.879161-6.465829-6.325638-10.09859-14.905295-10.09859-23.851886 0-8.945371 3.632762-17.525029 10.09859-23.850667 6.465829-6.325638 15.234438-9.879162 24.378514-9.879162 9.144076 0 17.913905 3.553524 24.379734 9.879162 6.465829 6.325638 10.097371 14.905295 10.097371 23.850667zM105.515861 430.877257c6.465829-6.326857 10.09859-14.905295 10.098591-23.851886 0-8.945371-3.632762-17.525029-10.098591-23.850666-6.465829-6.325638-15.235657-9.879162-24.378514-9.879162-9.144076 0-17.913905 3.553524-24.379733 9.879162-6.465829 6.325638-10.09859 14.905295-10.098591 23.850666 0 8.94659 3.632762 17.525029 10.098591 23.851886 6.465829 6.325638 15.235657 9.879162 24.379733 9.879162 9.142857 0 17.912686-3.553524 24.378514-9.879162zM550.758376 848.680229L419.303595 865.072762a41.916952 41.916952 0 0 0-18.49661 6.998552 40.762514 40.762514 0 0 0-13.04259 14.616381l-60.721981 115.249981c-3.537676 6.714514-8.924648 12.32579-15.55261 16.199924a42.076648 42.076648 0 0 1-21.95139 5.724648 42.038857 42.038857 0 0 1-21.731962-6.479238c-6.484114-4.100876-11.665067-9.89501-14.958934-16.727772l-56.556495-117.246781a40.658895 40.658895 0 0 0-12.517181-15.046705 41.849905 41.849905 0 0 0-18.236952-7.619047L34.730642 839.870171a41.776762 41.776762 0 0 1-20.558019-9.462247c-5.816076-4.968838-10.094933-11.43101-12.352609-18.655086a39.633676 39.633676 0 0 1-0.420572-22.223238c1.98339-7.302095 6.013562-13.91421 11.638248-19.090286l96.494933-88.860038a40.391924 40.391924 0 0 0 10.769067-16.29379 39.655619 39.655619 0 0 0 1.781028-19.325562L101.961118 517.79779a39.672686 39.672686 0 0 1 2.848915-22.044038c3.03299-6.944914 7.990857-12.920686 14.314057-17.251962a41.982781 41.982781 0 0 1 21.46499-7.260647 42.129067 42.129067 0 0 1 22.148877 4.920076l116.215466 62.333562a42.088838 42.088838 0 0 0 19.163429 4.971276 42.15101 42.15101 0 0 0 19.328-4.322743l118.367086-58.313143a42.164419 42.164419 0 0 1 22.312228-4.164266 41.9072 41.9072 0 0 1 21.1968 7.988419c6.164724 4.54461 10.908038 10.68739 13.691124 17.732266a39.658057 39.658057 0 0 1 2.058971 22.130591l-24.685714 127.392914a39.631238 39.631238 0 0 0 1.08861 19.373105 40.30659 40.30659 0 0 0 10.179047 16.650971l93.266895 92.097829a40.239543 40.239543 0 0 1 10.950705 19.476724 39.648305 39.648305 0 0 1-1.214171 22.196419c-2.514895 7.143619-7.021714 13.455848-13.012115 18.222324a41.837714 41.837714 0 0 1-20.885942 8.752762zM302.974757 259.770514c5.172419-5.061486 12.188038-7.904305 19.503542-7.904304 7.314286 0 14.329905 2.842819 19.502324 7.904304 5.172419 5.060267 8.078629 11.923505 8.078629 19.080534v40.476038h41.373257c3.62179 0 7.208229 0.698514 10.554514 2.054095a27.638248 27.638248 0 0 1 8.949029 5.850209 26.937295 26.937295 0 0 1 5.978209 8.753981 26.480152 26.480152 0 0 1 2.0992 10.326553c0 3.543771-0.713143 7.05219-2.0992 10.326552a26.949486 26.949486 0 0 1-5.978209 8.753981 27.638248 27.638248 0 0 1-8.949029 5.85021 28.119771 28.119771 0 0 1-10.554514 2.052876h-41.373257v40.477257c0 3.543771-0.713143 7.05219-2.0992 10.326552a26.953143 26.953143 0 0 1-5.979429 8.753981 27.61021 27.61021 0 0 1-8.947809 5.848991 28.09661 28.09661 0 0 1-10.554515 2.054095 28.099048 28.099048 0 0 1-10.555733-2.054095 27.61021 27.61021 0 0 1-8.947809-5.848991 26.953143 26.953143 0 0 1-5.979429-8.753981 26.480152 26.480152 0 0 1-2.0992-10.326552v-40.477257h-41.373257c-7.314286 0-14.329905-2.842819-19.503543-7.903086-5.172419-5.060267-8.078629-11.923505-8.078629-19.080533 0-7.157029 2.90621-14.020267 8.078629-19.080534 5.173638-5.061486 12.189257-7.904305 19.503543-7.904304h41.373257v-40.476038c0-7.157029 2.90621-14.020267 8.078629-19.080534zM716.701233 785.965105c5.172419-5.061486 12.188038-7.904305 19.503543-7.904305 7.315505 0 14.331124 2.842819 19.503542 7.904305 5.172419 5.060267 8.078629 11.923505 8.078629 19.080533v40.476038h41.372038c7.315505 0 14.331124 2.842819 19.503543 7.904305 5.172419 5.060267 8.078629 11.923505 8.078629 19.080533 0 7.15581-2.90621 14.020267-8.078629 19.080534s-12.188038 7.903086-19.503543 7.903085h-41.372038v40.477257c0 7.15581-2.90621 14.020267-8.078629 19.080534s-12.188038 7.903086-19.503542 7.903086c-7.315505 0-14.331124-2.842819-19.503543-7.903086s-8.078629-11.924724-8.078629-19.080534v-40.477257h-41.372038c-7.315505 0-14.331124-2.842819-19.503543-7.903085s-8.078629-11.924724-8.078628-19.080534c0-7.157029 2.90621-14.020267 8.078628-19.080533 5.172419-5.061486 12.188038-7.904305 19.503543-7.904305h41.372038v-40.476038c0-7.157029 2.90621-14.020267 8.078629-19.080533z"
                fill="currentColor"
            />
        </svg>
    );
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
        <div className={styles.pageRoot}>
            <Navbar />
            <div className={styles.page}>
                <div className={styles.pageInner}>
                {/* Tab Bar */}
                <div className={styles.tabBar}>
                    {filteredTabs.map((tab) => (
                        <button
                            key={tab.key}
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
                                        <CategoryBoxMeteorIcon className={styles.categoryBoxIcon} />
                                        <span className={styles.categoryBoxTitle}>
                                            {isZh ? section.labelZh : section.label}
                                        </span>
                                        <CategoryBoxMeteorIcon className={styles.categoryBoxIconRight} />
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
                                            <CategoryBoxMeteorIcon className={styles.categoryBoxIcon} />
                                            <span className={styles.categoryBoxTitle}>
                                                {isZh ? section.labelZh : section.label}
                                            </span>
                                            <CategoryBoxMeteorIcon className={styles.categoryBoxIconRight} />
                                        </div>
                                        <div className={styles.categoryBoxList}>
                                            {games.map((game, index) => (
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
                                                        {formatThemeMeta(game) && (
                                                            <div className={styles.categoryBoxMeta}>{formatThemeMeta(game)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className={styles.categoryBoxMore}
                                            onClick={() => setActiveTab(API_TYPE_TO_TAB[section.key as RankingsApiType])}
                                        >
                                            <span className={styles.moreSpark} aria-hidden="true">✦</span>
                                            {isZh ? '更多' : 'More'}
                                            <img src={`${import.meta.env.BASE_URL}data/assets/向右箭头.svg`} alt="" className={styles.moreArrow} />
                                            <span className={styles.moreSpark} aria-hidden="true">✦</span>
                                        </button>
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
        </div>

        {!isMobilePage && <FooterArea />}
        <MobileBottomNav />
        </div>
    );
};

export default Rankings;
