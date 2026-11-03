import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from '../../page/Create.module.css';
import GameGrid from '../GameGrid';
import Pagination from '../Pagination';
import ConfirmModal from '../CommonModal/ConfirmModal';
import GameGridSkeleton from '../Skeleton/GameGridSkeleton';
import { useAuthStore } from '../../store/useAuthStore';
import getGameDataApi from '../../api/home/getGameData';
import type { UserGameData } from '../../api/home/getGameData.type';
import accountSocialApi from '../../api/account/accountSocialApi';
import GameAction from '../../api/rpgGame/gameAction';
import favoriteApi from '../../api/favorite/favoriteApi';
import { getApiErrorCode } from '../../utils/error';
import { partitionCreatorGames } from '../../utils/novelGame';
import {
    DRAFT_BOX_FILTER_ORDER,
    filterDraftGamesByType,
    getDraftBoxFilterLabelKey,
    type DraftBoxFilterKey,
} from '../../utils/draftBoxFilter';
import { buildGameDetailNavigateState } from '../../utils/gameDetailNavigation';
import {
    WORKS_MOBILE_MEDIA,
    WORKS_MOBILE_PREVIEW_SIZE,
    WORKS_PAGE_SIZE,
    resolveWorksListLimit,
    shouldShowWorksViewAll,
} from '../../utils/creatorWorksPreview';
import { resolveCreatorWorkStatus } from '../../utils/creatorWorkLifecycle';
import creatorDraftApi from '../../api/creator/creatorDraftApi';
import {
    CREATOR_DRAFT_LIMIT,
    formatDraftLimitReachedMessage,
} from '../../utils/creatorDraftCapacity';

export type WorksTabKey = 'all' | 'published' | 'drafts' | 'favorites';

const WORKS_FETCH_LIMIT = 50;

const paginateItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    const start = (Math.max(1, page) - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

const isWorksTabKey = (value: string | null | undefined): value is WorksTabKey => (
    value === 'all' || value === 'published' || value === 'drafts' || value === 'favorites'
);

export type CreatorWorksPanelProps = {
    mode: 'preview' | 'full';
    initialTab?: WorksTabKey;
    showIncentiveUI?: boolean;
    /** owner：自己看自己；visitor：仅已发布 Tab，按 ownerUserCode 拉公开作品 */
    access?: 'owner' | 'visitor';
    /** visitor 必填：主页主人的 userCode */
    ownerUserCode?: string;
};

const CreatorWorksPanel: React.FC<CreatorWorksPanelProps> = ({
    mode,
    initialTab = 'all',
    showIncentiveUI = false,
    access = 'owner',
    ownerUserCode = '',
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const worksSectionRef = useRef<HTMLDivElement>(null);

    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [isLoadingMyGames, setIsLoadingMyGames] = useState(true);
    const [isDraftManageMode, setIsDraftManageMode] = useState(false);
    const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
    const [isBatchDeletingDrafts, setIsBatchDeletingDrafts] = useState(false);
    const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
    const [draftFilterKey, setDraftFilterKey] = useState<DraftBoxFilterKey>('all');
    const [worksTab, setWorksTab] = useState<WorksTabKey>(initialTab);
    const [worksPage, setWorksPage] = useState(1);
    const [favoriteGames, setFavoriteGames] = useState<UserGameData[]>([]);
    const [favoritesTotal, setFavoritesTotal] = useState(0);
    const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
    const [favoritesLoaded, setFavoritesLoaded] = useState(false);
    const [homeHidden, setHomeHidden] = useState(false);
    const [draftCapacity, setDraftCapacity] = useState<{ count: number; limit: number; canCreate: boolean } | null>(null);

    const isPreview = mode === 'preview';
    const isVisitor = access === 'visitor';
    // 功能注释：下架只认 moderationStatus（兼容 moderation_status），勿用申诉 approved 推断已上架
    const hasTakenDownWork = useMemo(
        () => !isVisitor && fileMetas.some((game) => {
            const status = String(game.moderationStatus || game.moderation_status || 'none');
            return status === 'taken_down';
        }),
        [fileMetas, isVisitor],
    );
    const [isMobileViewport, setIsMobileViewport] = useState(() => (
        typeof window !== 'undefined' ? window.matchMedia(WORKS_MOBILE_MEDIA).matches : false
    ));
    const listPageSize = resolveWorksListLimit({ mode, isMobile: isMobileViewport });
    const showWorksViewAll = !isVisitor && shouldShowWorksViewAll({ mode, isMobile: isMobileViewport });

    const { allGames, publishedGames, draftGames } = useMemo(
        () => partitionCreatorGames(fileMetas),
        [fileMetas],
    );
    const allTotalPages = Math.max(1, Math.ceil(allGames.length / WORKS_PAGE_SIZE));
    const pagedAllGames = useMemo(
        () => paginateItems(allGames, isPreview ? 1 : worksPage, listPageSize),
        [allGames, worksPage, isPreview, listPageSize],
    );

    const filteredDraftGames = useMemo(
        () => filterDraftGamesByType(draftGames, draftFilterKey),
        [draftGames, draftFilterKey],
    );

    const publishedTotalPages = Math.max(1, Math.ceil(publishedGames.length / WORKS_PAGE_SIZE));
    const draftTotalPages = Math.max(1, Math.ceil(filteredDraftGames.length / WORKS_PAGE_SIZE));
    const favoritesTotalPages = Math.max(1, Math.ceil(favoritesTotal / WORKS_PAGE_SIZE));

    const pagedPublishedGames = useMemo(
        () => paginateItems(publishedGames, isPreview ? 1 : worksPage, listPageSize),
        [publishedGames, worksPage, isPreview, listPageSize],
    );
    const pagedDraftGames = useMemo(
        () => paginateItems(filteredDraftGames, isPreview ? 1 : worksPage, listPageSize),
        [filteredDraftGames, worksPage, isPreview, listPageSize],
    );
    const displayedFavoriteGames = useMemo(
        () => (isPreview ? favoriteGames.slice(0, listPageSize) : favoriteGames),
        [favoriteGames, isPreview, listPageSize],
    );

    const worksTotalPages = worksTab === 'all'
        ? allTotalPages
        : worksTab === 'published'
        ? publishedTotalPages
        : worksTab === 'drafts'
            ? draftTotalPages
            : favoritesTotalPages;

    const getGameManageId = (game: UserGameData) => String(game.file_id || game.id || '');
    const selectedDraftCount = selectedDraftIds.length;
    const isAllDraftsSelected = filteredDraftGames.length > 0
        && filteredDraftGames.every((game) => selectedDraftIds.includes(getGameManageId(game)));

    const loadMyGames = async () => {
        if (isVisitor) {
            const code = ownerUserCode.trim();
            if (!code) {
                setFileMetas([]);
                setIsLoadingMyGames(false);
                return;
            }

            setIsLoadingMyGames(true);
            setHomeHidden(false);
            try {
                const response = await accountSocialApi.getWorks(code, {
                    limit: WORKS_FETCH_LIMIT,
                    offset: 0,
                });
                if (response.data.success && response.data.data) {
                    const page = response.data.data;
                    if (page.homeHidden) {
                        setHomeHidden(true);
                        setFileMetas([]);
                    } else {
                        setFileMetas(page.list || []);
                    }
                } else {
                    setFileMetas([]);
                }
            } catch (error) {
                const axiosData = (error as {
                    response?: {
                        data?: {
                            data?: {
                                homeHidden?: boolean;
                            };
                            message?: string;
                        };
                    };
                })?.response?.data;
                if (axiosData?.data?.homeHidden) {
                    setHomeHidden(true);
                    setFileMetas([]);
                } else {
                    if (getApiErrorCode(error) !== 'USER_BLOCKED') {
                        console.error('获取主页已发布作品错误:', error);
                    }
                    setFileMetas([]);
                }
            } finally {
                setIsLoadingMyGames(false);
            }
            return;
        }

        if (!user?.user?.id) {
            setFileMetas([]);
            setIsLoadingMyGames(false);
            return;
        }

        setIsLoadingMyGames(true);
        try {
            // 功能注释：名额按全库草稿计；列表 limit 要盖住已发布+草稿，避免只看到前几条误以为没满
            const response = await getGameDataApi.getUserData({ limit: 200 });
            if (response.data.success && response.data.data) {
                setFileMetas(response.data.data);
            } else {
                setFileMetas([]);
            }
            try {
                const capacityResp = await creatorDraftApi.getCapacity();
                if (capacityResp.data?.data) {
                    setDraftCapacity(capacityResp.data.data);
                }
            } catch {
                /* 列表仍可用；创建入口会再拦 */
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
            setFileMetas([]);
        } finally {
            setIsLoadingMyGames(false);
        }
    };

    const loadFavoriteGames = async (page = 1) => {
        if (isVisitor) {
            setFavoriteGames([]);
            setFavoritesTotal(0);
            setFavoritesLoaded(true);
            setIsLoadingFavorites(false);
            return;
        }

        setIsLoadingFavorites(true);
        try {
            const favoritePageSize = resolveWorksListLimit({ mode, isMobile: isMobileViewport });
            const response = await favoriteApi.list({
                limit: String(favoritePageSize),
                offset: String((Math.max(1, page) - 1) * favoritePageSize),
            });
            if (response.data.success && response.data.data) {
                const { rows, total } = response.data.data;
                setFavoriteGames(rows || []);
                setFavoritesTotal(typeof total === 'number' ? total : (rows || []).length);
            } else {
                setFavoriteGames([]);
                setFavoritesTotal(0);
            }
        } catch (error) {
            console.error('获取收藏列表失败:', error);
            setFavoriteGames([]);
            setFavoritesTotal(0);
        } finally {
            setIsLoadingFavorites(false);
            setFavoritesLoaded(true);
        }
    };

    useEffect(() => {
        void loadMyGames();
    }, [user?.user?.id, isVisitor, ownerUserCode]);

    useEffect(() => {
        if (!isVisitor) return;
        setWorksTab('published');
        setWorksPage(1);
        setIsDraftManageMode(false);
        setSelectedDraftIds([]);
    }, [isVisitor]);

    useEffect(() => {
        const mediaQuery = window.matchMedia(WORKS_MOBILE_MEDIA);
        const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
        syncViewport();
        mediaQuery.addEventListener('change', syncViewport);
        return () => mediaQuery.removeEventListener('change', syncViewport);
    }, []);

    useEffect(() => {
        if (!isWorksTabKey(initialTab)) return;
        setWorksTab(initialTab);
        setWorksPage(1);
        if (initialTab === 'favorites') {
            void loadFavoriteGames(1);
        }
    }, [initialTab]);

    useEffect(() => {
        if (draftGames.length === 0) {
            setIsDraftManageMode(false);
            setSelectedDraftIds([]);
            return;
        }

        setSelectedDraftIds((prev) => prev.filter((id) => draftGames.some((game) => getGameManageId(game) === id)));
    }, [draftGames]);

    useEffect(() => {
        if (isPreview) return;
        if (worksPage > worksTotalPages) {
            setWorksPage(worksTotalPages);
        }
    }, [worksPage, worksTotalPages, isPreview]);

    const handleOpenDraftManage = () => {
        setIsDraftManageMode(true);
    };

    const handleCloseDraftManage = () => {
        setIsDraftManageMode(false);
        setSelectedDraftIds([]);
    };

    const handleToggleDraftSelect = (game: UserGameData) => {
        const draftId = getGameManageId(game);
        if (!draftId) return;

        setSelectedDraftIds((prev) => (
            prev.includes(draftId)
                ? prev.filter((id) => id !== draftId)
                : [...prev, draftId]
        ));
    };

    const handleToggleSelectAllDrafts = () => {
        if (isAllDraftsSelected) {
            setSelectedDraftIds([]);
            return;
        }

        setSelectedDraftIds(filteredDraftGames.map((game) => getGameManageId(game)).filter(Boolean));
    };

    const handleDraftFilterChange = (nextFilter: DraftBoxFilterKey) => {
        setDraftFilterKey(nextFilter);
        setSelectedDraftIds([]);
        setWorksPage(1);
    };

    const handleWorksTabChange = (nextTab: WorksTabKey) => {
        if (isVisitor && nextTab !== 'published') return;
        setWorksTab(nextTab);
        setWorksPage(1);
        if (nextTab !== 'drafts') {
            setIsDraftManageMode(false);
            setSelectedDraftIds([]);
        }
        if (nextTab === 'favorites') {
            void loadFavoriteGames(1);
        }
    };

    const handleWorksPageChange = (nextPage: number) => {
        setWorksPage(nextPage);
        if (worksTab === 'favorites') {
            void loadFavoriteGames(nextPage);
        }
        worksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleFavoriteGameClick = (game: UserGameData) => {
        if (Number(game.is_public) !== 1) {
            toast.error(t('favorites.unpublishedHint'));
            return;
        }
        const gameId = game.file_id || game.id;
        if (!gameId) return;
        navigate(`/game/${gameId}`, {
            state: buildGameDetailNavigateState('favorites', game),
        });
    };

    const handleDraftCardClick = (game: UserGameData) => {
        if (isDraftManageMode) {
            handleToggleDraftSelect(game);
            return;
        }

        const gameId = game.file_id || game.id;
        if (!gameId) return;
        if (String(game.engine || game.game_tags || '').toUpperCase() === 'ROMANCE') {
            navigate(`/romance/?createWorld=1&draftId=${encodeURIComponent(gameId)}&resume=1`);
            return;
        }
        navigate(`/createGame?mode=stats&gameId=${gameId}`);
    };

    const handleConfirmBatchDeleteDrafts = async () => {
        if (selectedDraftIds.length === 0 || isBatchDeletingDrafts) {
            return;
        }

        setIsBatchDeletingDrafts(true);
        try {
            const deletingIds = [...selectedDraftIds];
            const results = await Promise.allSettled(
                deletingIds.map((draftId) => GameAction.deleteGame(draftId))
            );

            const successIds = results
                .map((result, index) => (result.status === 'fulfilled' ? deletingIds[index] : null))
                .filter((draftId): draftId is string => Boolean(draftId));
            const failedIds = deletingIds.filter((draftId) => !successIds.includes(draftId));

            await loadMyGames();

            if (successIds.length > 0) {
                toast.success(t('create.draftsDeleted', { count: successIds.length }));
            }
            if (failedIds.length > 0) {
                toast.error(t('create.someDraftsDeleteFailed', { count: failedIds.length }));
            }

            setIsBatchDeleteConfirmOpen(false);

            if (failedIds.length === 0) {
                handleCloseDraftManage();
            } else {
                setSelectedDraftIds(failedIds);
            }
        } catch (error) {
            console.error('批量删除草稿失败:', error);
            toast.error(t('create.batchDeleteFailed'));
        } finally {
            setIsBatchDeletingDrafts(false);
        }
    };

    const handleViewAll = () => {
        navigate(`/create/works?tab=${worksTab}`);
    };

    const skeletonCount = isPreview
        ? (isMobileViewport ? WORKS_MOBILE_PREVIEW_SIZE : 5)
        : 8;
    const showPagination = !isPreview && worksTotalPages > 1 && !(
        (worksTab === 'published' && (isLoadingMyGames || publishedGames.length === 0))
        || (worksTab === 'drafts' && (isLoadingMyGames || draftGames.length === 0 || filteredDraftGames.length === 0))
        || (worksTab === 'favorites' && favoritesTotal === 0)
    );

    return (
        <div className={styles.worksSection} ref={worksSectionRef}>
            <div className={`${styles.worksTabBar} ${isDraftManageMode ? styles.worksTabBarManaging : ''}`}>
                <div className={styles.worksTabs}>
                    {!isDraftManageMode && !isVisitor && (
                        <button
                            type="button"
                            className={`${styles.worksTab} ${worksTab === 'all' ? styles.worksTabActive : ''}`}
                            onClick={() => handleWorksTabChange('all')}
                        >
                            全部 ({allGames.length})
                        </button>
                    )}
                    {!isDraftManageMode && (
                        <button
                            type="button"
                            className={`${styles.worksTab} ${worksTab === 'published' ? styles.worksTabActive : ''}`}
                            onClick={() => handleWorksTabChange('published')}
                        >
                            {t('create.publishedWorksTab', { count: publishedGames.length })}
                        </button>
                    )}
                    {!isVisitor && (
                        <button
                            type="button"
                            className={`${styles.worksTab} ${worksTab === 'drafts' ? styles.worksTabActive : ''}`}
                            onClick={() => handleWorksTabChange('drafts')}
                        >
                            {t('create.draftBox')}
                            {draftCapacity
                                ? ` (${draftCapacity.count}/${draftCapacity.limit})`
                                : draftGames.length > 0
                                    ? ` (${draftGames.length})`
                                    : ''}
                        </button>
                    )}
                    {!isVisitor && !isDraftManageMode && (
                        <button
                            type="button"
                            className={`${styles.worksTab} ${worksTab === 'favorites' ? styles.worksTabActive : ''}`}
                            onClick={() => handleWorksTabChange('favorites')}
                        >
                            {t('create.favoritesTab')}
                            {favoritesLoaded && favoritesTotal > 0 ? ` (${favoritesTotal})` : ''}
                        </button>
                    )}
                </div>

                {showWorksViewAll ? (
                    <div className={styles.worksViewAllSlot}>
                        <button
                            type="button"
                            className={styles.worksViewAllBtn}
                            onClick={handleViewAll}
                        >
                            {t('create.worksViewAll')}
                            <span aria-hidden="true">&gt;</span>
                        </button>
                    </div>
                ) : (
                    worksTab === 'drafts' && draftGames.length > 0 && (
                        <div className={`${styles.draftManageActions} ${isDraftManageMode ? styles.draftManageActionsExpanded : ''}`}>
                            {isDraftManageMode ? (
                                <>
                                    <button
                                        type="button"
                                        className={styles.draftManageButton}
                                        onClick={handleToggleSelectAllDrafts}
                                    >
                                        {isAllDraftsSelected ? t('create.cancelSelectAll') : t('create.selectAll')}
                                    </button>
                                    <button
                                        type="button"
                                        className={`${styles.draftManageButton} ${styles.draftDeleteButton}`}
                                        onClick={() => setIsBatchDeleteConfirmOpen(true)}
                                        disabled={selectedDraftCount === 0 || isBatchDeletingDrafts}
                                    >
                                        {isBatchDeletingDrafts ? t('create.deleting') : `${t('create.batchDelete')}${selectedDraftCount > 0 ? `(${selectedDraftCount})` : ''}`}
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.draftManageButton}
                                        onClick={handleCloseDraftManage}
                                    >
                                        {t('create.done')}
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className={styles.draftManageButton}
                                    onClick={handleOpenDraftManage}
                                >
                                    {t('create.manage')}
                                </button>
                            )}
                        </div>
                    )
                )}
            </div>

            {!isVisitor && worksTab === 'drafts' && draftCapacity && !draftCapacity.canCreate && (
                <p className={styles.draftManageTip} role="status">
                    {formatDraftLimitReachedMessage(draftCapacity.count, draftCapacity.limit || CREATOR_DRAFT_LIMIT)}
                </p>
            )}

            {hasTakenDownWork ? (
                <div className={styles.appealBanner}>
                    <span>{t('appeal.takenDownHint')}</span>
                    <button
                        type="button"
                        className={styles.appealBannerBtn}
                        onClick={() => navigate('/appeals')}
                    >
                        {t('appeal.goAppeal')}
                    </button>
                </div>
            ) : null}

            <div className={styles.worksTabPanel}>
                {worksTab === 'all' && (
                    isLoadingMyGames ? (
                        <GameGridSkeleton count={skeletonCount} layoutVariant="works" />
                    ) : allGames.length === 0 ? (
                        <div className={styles.worksEmpty}>还没有作品</div>
                    ) : (
                        <GameGrid
                            games={pagedAllGames}
                            layoutVariant="works"
                            showWorkStatus
                            onGameClick={(game) => {
                                const status = resolveCreatorWorkStatus(game);
                                if (status === 'draft' || status === 'rejected') {
                                    handleDraftCardClick(game);
                                    return;
                                }
                                const gameId = game.file_id || game.id;
                                if (gameId) navigate(`/createGame?mode=stats&gameId=${gameId}`);
                            }}
                        />
                    )
                )}

                {worksTab === 'published' && (
                    isLoadingMyGames ? (
                        <GameGridSkeleton count={skeletonCount} layoutVariant="works" />
                    ) : homeHidden ? (
                        <div className={styles.worksEmpty}>
                            {t('report.homepageUnavailableDefault')}
                        </div>
                    ) : publishedGames.length === 0 ? (
                        <div className={styles.worksEmpty}>{t('create.noPublishedGames')}</div>
                    ) : (
                        <GameGrid
                            games={pagedPublishedGames}
                            layoutVariant="works"
                            primaryStat="pv"
                            showWorkStatus
                            showIncentiveUI={showIncentiveUI}
                            onGameClick={(game) => {
                                const gameId = game.file_id || game.id;
                                if (!gameId) return;
                                if (isVisitor) {
                                    navigate(`/game/${gameId}`);
                                    return;
                                }
                                navigate(`/createGame?mode=stats&gameId=${gameId}`);
                            }}
                        />
                    )
                )}

                {worksTab === 'drafts' && (
                    isLoadingMyGames ? (
                        <GameGridSkeleton count={skeletonCount} layoutVariant="works" />
                    ) : draftGames.length === 0 ? (
                        <div className={styles.worksEmpty}>还没有草稿</div>
                    ) : (
                        <div className={styles.draftSectionBody}>
                            <div className={styles.draftFilterRow}>
                                {DRAFT_BOX_FILTER_ORDER.map((filterKey) => (
                                    <button
                                        key={filterKey}
                                        type="button"
                                        className={`${styles.draftFilterChip} ${draftFilterKey === filterKey ? styles.draftFilterChipActive : ''}`}
                                        onClick={() => handleDraftFilterChange(filterKey)}
                                    >
                                        {t(getDraftBoxFilterLabelKey(filterKey))}
                                    </button>
                                ))}
                            </div>
                            {isDraftManageMode && (
                                <div className={styles.draftManageTip}>
                                    {t('create.draftsSelected', { count: selectedDraftCount })}
                                </div>
                            )}
                            {filteredDraftGames.length === 0 ? (
                                <div className={styles.draftFilterEmpty}>
                                    {t('create.noDraftsForFilter')}
                                </div>
                            ) : (
                                <GameGrid
                                    games={pagedDraftGames}
                                    layoutVariant="works"
                                    showWorkStatus
                                    onGameClick={handleDraftCardClick}
                                    selectable={true}
                                    selectedIds={selectedDraftIds}
                                    onToggleSelect={handleToggleDraftSelect}
                                    isSelectionMode={isDraftManageMode}
                                />
                            )}
                        </div>
                    )
                )}

                {worksTab === 'favorites' && (
                    isLoadingFavorites ? (
                        <GameGridSkeleton count={skeletonCount} layoutVariant="works" />
                    ) : favoriteGames.length === 0 ? (
                        <div className={styles.worksEmpty}>{t('favorites.empty')}</div>
                    ) : (
                        <GameGrid
                            games={displayedFavoriteGames}
                            layoutVariant="works"
                            showWorkStatus
                            onGameClick={handleFavoriteGameClick}
                        />
                    )
                )}

                {showPagination && (
                    <div className={styles.worksPagination}>
                        <Pagination
                            variant="creator"
                            currentPage={worksPage}
                            totalPages={worksTotalPages}
                            onPageChange={handleWorksPageChange}
                            disabled={worksTab === 'favorites' && isLoadingFavorites}
                            maxVisiblePages={5}
                        />
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={isBatchDeleteConfirmOpen}
                tone="dark"
                onConfirm={() => {
                    void handleConfirmBatchDeleteDrafts();
                }}
                onCancel={() => {
                    if (isBatchDeletingDrafts) return;
                    setIsBatchDeleteConfirmOpen(false);
                }}
                title={t('create.batchDeleteDrafts')}
                message={t('create.batchDeleteConfirmMessage', { count: selectedDraftCount })}
                confirmButtonText={isBatchDeletingDrafts ? t('create.deletingDrafts') : t('create.confirmDelete')}
                cancelButtonText={t('create.cancel')}
            />
        </div>
    );
};

export default CreatorWorksPanel;
