import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import FloatingJoinGroup from '../components/FloatingJoinGroup';
import GameGrid from '../components/GameGrid';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import libraryDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import gameTagsApi from '../api/gameTags/gameTagsApi';
import { flattenThemeTags, useLocalizedThemeTags, type FlatThemeTag } from '../utils/themeTags';
import {
    HOME_LIST_MODE_OPTIONS,
    HOME_LIST_SORT_OPTIONS,
    normalizeHomeListMode,
    normalizeHomeListSort,
    normalizeHomeListTagId,
    resolveCategoriesPageTitleKey,
    type HomeListMode,
    type HomeListSort,
} from '../utils/gameBrowseFilters';
import { resolveHomeFiltersForNovelThemeConflict } from '../utils/homeFilterNovelTheme';
import styles from './Categories.module.css';

const PAGE_SIZE = 12;

const MODE_LABEL_KEYS = {
    all: 'categories.modes.all',
    'role-playing': 'categories.modes.rolePlaying',
    world: 'categories.modes.world',
    custom: 'categories.modes.custom',
    'interactive-video': 'categories.modes.interactiveVideo',
    novel: 'categories.modes.novel',
} as const satisfies Record<HomeListMode, string>;

const SORT_LABEL_KEYS = {
    hot: 'categories.sorts.hot',
    recommended: 'categories.sorts.recommended',
    latest: 'categories.sorts.latest',
} as const satisfies Record<HomeListSort, string>;

const getInitialMobileState = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
};

/*
    if (value === 'role-playing') return 'role-playing';
    if (value === 'custom') return 'custom';
    return DEFAULT_MODE;
};

const normalizeSort = (value: string | null): CategorySort => {
    // 兼容旧链接的 sort=all
    if (value === 'recommended') return 'recommended';
    if (value === 'latest') return 'latest';
    return DEFAULT_SORT;
};

const normalizeTagId = (value: string | null): number | null => {
    if (!value || value === 'all') return null;
    const parsedTagId = Number(value);
    return Number.isInteger(parsedTagId) && parsedTagId > 0 ? parsedTagId : null;
};
*/

const getGameUniqueKey = (game: UserGameData, fallbackIndex?: number): string => {
    const fileId = String(game.file_id || '').trim();
    if (fileId) return `file:${fileId}`;

    const id = String(game.id || '').trim();
    if (id) return `id:${id}`;

    return `fallback:${fallbackIndex ?? 0}`;
};

/*
const dedupeGames = (list: UserGameData[]): UserGameData[] => {
    // 实现 分类页作品列表去重
    // 实现 分类页作品列表去重
    // 实现 分类页作品列表去重
    const uniqueGames = new Map<string, UserGameData>();
    // 实现 分类页作品列表去重
    const uniqueGames = new Map<string, UserGameData>();
    list.forEach((game, index) => {
        const uniqueKey = getGameUniqueKey(game, index);
        if (!uniqueGames.has(uniqueKey)) {
            uniqueGames.set(uniqueKey, game);
        }
    });
    return Array.from(uniqueGames.values());
};

const mergeUniqueGames = (currentGames: UserGameData[], nextGames: UserGameData[]): UserGameData[] => {
    // 实现 同页数据合并去重
    // 实现 同页数据合并去重
    // 实现 同页数据合并去重
    // 实现 同页数据合并去重
    return dedupeGames([...currentGames, ...nextGames]);
};

*/

const dedupeGames = (list: UserGameData[]): UserGameData[] => {
    // 实现 分类页作品列表去重
    const uniqueGames = new Map<string, UserGameData>();
    list.forEach((game, index) => {
        const uniqueKey = getGameUniqueKey(game, index);
        if (!uniqueGames.has(uniqueKey)) {
            uniqueGames.set(uniqueKey, game);
        }
    });
    return Array.from(uniqueGames.values());
};

const mergeUniqueGames = (currentGames: UserGameData[], nextGames: UserGameData[]): UserGameData[] => {
    // 实现 同页数据合并去重
    return dedupeGames([...currentGames, ...nextGames]);
};

const Categories: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [themeTags, setThemeTags] = useState<FlatThemeTag[]>([]);
    const displayThemeTags = useLocalizedThemeTags(themeTags);
    const [games, setGames] = useState<UserGameData[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isMobilePage, setIsMobilePage] = useState<boolean>(getInitialMobileState);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
    const latestRequestIdRef = useRef(0);
    const activeRequestKeysRef = useRef<Set<string>>(new Set());
    const isLoadingRef = useRef(false);
    const isLoadingMoreRef = useRef(false);
    const themeScrollRef = useRef<HTMLDivElement | null>(null);

    const selectedMode = useMemo(() => normalizeHomeListMode(searchParams.get('mode')), [searchParams]);
    const selectedSort = useMemo(() => normalizeHomeListSort(searchParams.get('sort')), [searchParams]);
    const selectedTagId = useMemo(() => normalizeHomeListTagId(searchParams.get('tagId')), [searchParams]);
    const pageTitle = useMemo(
        () => t(resolveCategoriesPageTitleKey(selectedSort)),
        [selectedSort, t],
    );

    const modeOptions = useMemo(
        () => HOME_LIST_MODE_OPTIONS.map((option) => ({
            value: option.value,
            label: t(MODE_LABEL_KEYS[option.value]),
        })),
        [t],
    );

    const sortOptions = useMemo(
        () => HOME_LIST_SORT_OPTIONS.map((option) => ({
            value: option.value,
            label: t(SORT_LABEL_KEYS[option.value]),
        })),
        [t],
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) => {
            setIsMobilePage(event.matches);
        };
        setIsMobilePage(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const fetchTags = async () => {
            try {
                const response = await gameTagsApi.getGameTagsTree();
                if (!response.data?.success || cancelled) return;
                // 只展示可选题材，隐藏父题材
                setThemeTags(flattenThemeTags(response.data.data || []));
            } catch (error) {
                console.error('加载题材分类失败:', error);
            }
        };

        void fetchTags();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const scrollContainer = themeScrollRef.current;
        if (!scrollContainer) return;

        let frameId = 0;

        // 实现：换行布局下把选中题材滚进可视区
        frameId = window.requestAnimationFrame(() => {
            const selectedTagKey = selectedTagId === null ? 'all' : String(selectedTagId);
            const selectedButton = scrollContainer.querySelector<HTMLButtonElement>(`[data-tag-id="${selectedTagKey}"]`);
            if (!selectedButton || typeof selectedButton.scrollIntoView !== 'function') return;
            selectedButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [selectedTagId, themeTags]);

    const requestFilters = useMemo(() => ({
        mode: selectedMode,
        sort: selectedSort,
        tagId: selectedTagId,
    }), [selectedMode, selectedSort, selectedTagId]);

    const loadGames = useCallback(async (
        targetPage: number,
        filters: { mode: HomeListMode; sort: HomeListSort; tagId: number | null },
        initial = false,
    ) => {
        const requestKey = `${filters.mode}|${filters.sort}|${filters.tagId ?? 'all'}|${targetPage}|${initial ? 'initial' : 'append'}`;
        if (activeRequestKeysRef.current.has(requestKey)) {
            return;
        }

        activeRequestKeysRef.current.add(requestKey);
        const requestId = ++latestRequestIdRef.current;

        if (initial) {
            isLoadingRef.current = true;
            setIsLoading(true);
        } else {
            isLoadingMoreRef.current = true;
            setIsLoadingMore(true);
        }

        try {
            const response = await libraryDataApi.getGameData('no-discount', {
                limit: String(PAGE_SIZE),
                offset: String(targetPage * PAGE_SIZE),
                mode: filters.mode,
                sort: filters.sort,
                tagId: filters.tagId ? String(filters.tagId) : 'all',
            });

            if (requestId !== latestRequestIdRef.current) return;

            if (response.data.success && response.data.data) {
                const list = dedupeGames(response.data.data);
                if (initial) {
                    setGames(list);
                } else {
                    setGames((prev) => mergeUniqueGames(prev, list));
                }
                setHasMore(response.data.data.length === PAGE_SIZE);
                setPage(list.length > 0 ? targetPage + 1 : targetPage);
                return;
            }

            if (initial) setGames([]);
            setHasMore(false);
        } catch (error) {
            console.error('加载分类剧本失败:', error);
            if (initial) setGames([]);
            setHasMore(false);
        } finally {
            activeRequestKeysRef.current.delete(requestKey);
            if (initial) {
                isLoadingRef.current = false;
            } else {
                isLoadingMoreRef.current = false;
            }
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        setPage(0);
        setHasMore(true);
        isLoadingMoreRef.current = false;
        void loadGames(0, requestFilters, true);
    }, [loadGames, requestFilters]);

    /*
    const loadMore = useCallback(() => {
        // 实现 懒加载重复触发拦截
        // 实现 懒加载重复触发拦截
        // 实现 懒加载重复触发拦截
        if (isLoadingRef.current || isLoadingMoreRef.current || isLoading || isLoadingMore || !hasMore) return;
        // 实现 懒加载重复触发拦截
        if (isLoadingRef.current || isLoadingMoreRef.current || isLoading || isLoadingMore || !hasMore) return;
        void loadGames(page, requestFilters, false);
    }, [hasMore, isLoading, isLoadingMore, loadGames, page, requestFilters]);
    */

    const loadMore = useCallback(() => {
        // 实现 懒加载重复触发拦截
        if (isLoadingRef.current || isLoadingMoreRef.current || isLoading || isLoadingMore || !hasMore) return;
        void loadGames(page, requestFilters, false);
    }, [hasMore, isLoading, isLoadingMore, loadGames, page, requestFilters]);

    useEffect(() => {
        if (!loadMoreTriggerRef.current) return;
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    loadMore();
                }
            },
            {
                root: null,
                rootMargin: '200px',
                threshold: 0.1,
            },
        );

        observerRef.current.observe(loadMoreTriggerRef.current);
        return () => {
            observerRef.current?.disconnect();
        };
    }, [loadMore]);

    const updateFilters = useCallback((next: Partial<{
        mode: HomeListMode;
        sort: HomeListSort;
        tagId: number | null;
    }>) => {
        const resolved = resolveHomeFiltersForNovelThemeConflict(
            {
                mode: selectedMode,
                sort: selectedSort,
                tagId: selectedTagId,
            },
            next,
        );

        const nextParams = new URLSearchParams();
        nextParams.set('mode', resolved.mode);
        nextParams.set('sort', resolved.sort);
        nextParams.set('tagId', resolved.tagId ? String(resolved.tagId) : 'all');
        setSearchParams(nextParams);
    }, [selectedMode, selectedSort, selectedTagId, setSearchParams]);

    const handleBack = () => {
        navigate('/home');
    };

    const renderChipRow = <T extends string>(
        options: Array<{ value: T; label: string }>,
        activeValue: T,
        onSelect: (value: T) => void,
        optionsConfig?: { singleLine?: boolean },
    ) => (
        <div className={`${styles.chipRow} ${optionsConfig?.singleLine ? styles.chipRowSingle : ''}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={`${styles.tagChip} ${activeValue === option.value ? styles.tagChipActive : ''}`}
                    onClick={() => onSelect(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    {/* 功能注释：效果图标题在滤镜卡外，返回 + 居中标题 */}
                    <div className={styles.pageHeader}>
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={handleBack}
                            aria-label={t('categories.backToHome')}
                            title={t('categories.backToHome')}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M15 6L9 12L15 18" />
                            </svg>
                        </button>
                        <h1 className={styles.pageTitle}>{pageTitle}</h1>
                    </div>

                    <div className={styles.filtersPanel}>
                        <div className={styles.filtersCard}>
                            <section className={styles.filterSection}>
                                <div className={styles.filterTitle}>{t('categories.mode')}</div>
                                {renderChipRow(
                                    modeOptions,
                                    selectedMode,
                                    (mode) => updateFilters({ mode }),
                                    { singleLine: true },
                                )}
                            </section>

                            <section className={styles.filterSection}>
                                <div className={styles.filterTitle}>{t('categories.sort')}</div>
                                {renderChipRow(sortOptions, selectedSort, (sort) => updateFilters({ sort }))}
                            </section>

                            <section className={styles.filterSection}>
                                <div className={styles.filterTitle}>{t('categories.theme')}</div>
                                <div ref={themeScrollRef} className={styles.themeScrollRow}>
                                    <button
                                        type="button"
                                        data-tag-id="all"
                                        className={`${styles.tagChip} ${selectedTagId === null ? styles.tagChipActive : ''}`}
                                        onClick={() => updateFilters({ tagId: null })}
                                    >
                                        {t('categories.all')}
                                    </button>
                                    {displayThemeTags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            type="button"
                                            data-tag-id={String(tag.id)}
                                            className={`${styles.tagChip} ${selectedTagId === tag.id ? styles.tagChipActive : ''}`}
                                            onClick={() => updateFilters({ tagId: tag.id })}
                                            title={tag.pathLabel || tag.name}
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </div>

                    <div className={styles.listBlock}>
                        {isLoading ? (
                            <GameGridSkeleton count={8} />
                        ) : (
                            <>
                                <GameGrid
                                    games={games}
                                    emptyText={t('home.noMatchingWorks')}
                                />
                                {isLoadingMore && (
                                    <div className={styles.loadingMore}>
                                        <GameGridSkeleton count={4} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div
                        ref={loadMoreTriggerRef}
                        className={styles.loadMoreTrigger}
                        style={{ visibility: hasMore ? 'visible' : 'hidden' }}
                    />
                </div>
            </div>

            {!isMobilePage && <FooterArea />}
            <FloatingJoinGroup />
            <MobileBottomNav />
        </div>
    );
};

export default Categories;
