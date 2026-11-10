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
import { clearBrowsingHistory, readBrowsingHistory } from '../../utils/browsingHistory';
import accountSocialApi from '../../api/account/accountSocialApi';
import GameAction from '../../api/rpgGame/gameAction';
import favoriteApi from '../../api/favorite/favoriteApi';
import { getApiErrorCode } from '../../utils/error';
import { partitionCreatorGames } from '../../utils/novelGame';
import { buildGameDetailNavigateState } from '../../utils/gameDetailNavigation';
import {
    WORKS_MOBILE_MEDIA,
    WORKS_MOBILE_PREVIEW_SIZE,
    WORKS_PAGE_SIZE,
    resolveWorksListLimit,
    shouldShowWorksViewAll,
} from '../../utils/creatorWorksPreview';
import { isDraftSlotWork, resolveCreatorWorkStatus } from '../../utils/creatorWorkLifecycle';
import creatorDraftApi from '../../api/creator/creatorDraftApi';
import {
    CREATOR_DRAFT_LIMIT,
    formatDraftLimitReachedMessage,
} from '../../utils/creatorDraftCapacity';

/** 功能注释：草稿箱 Tab 已下线；旧链接 ?tab=drafts 回落到全部，草稿靠卡片角标区分。 */
export type WorksTabKey = 'all' | 'published' | 'history' | 'favorites';

const WORKS_FETCH_LIMIT = 50;

const paginateItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    const start = (Math.max(1, page) - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

const isWorksTabKey = (value: string | null | undefined): value is WorksTabKey => (
    value === 'all' || value === 'published' || value === 'favorites'
);

/** 功能注释：兼容历史 ?tab=drafts / 未知 tab → 全部 */
export const normalizeWorksTabKey = (value: string | null | undefined): WorksTabKey => {
    if (value === 'drafts') return 'all';
    return isWorksTabKey(value) ? value : 'all';
};

export type CreatorWorksPanelProps = {
    mode: 'preview' | 'full';
    initialTab?: WorksTabKey | 'drafts';
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
    // 功能注释：本人视角下「已发布」并入「我的作品」(all)，旧链接 ?tab=published 回落到 all
    const resolveOwnerTab = (tab: WorksTabKey): WorksTabKey => (!isVisitor && tab === 'published' ? 'all' : tab);
    const [worksTab, setWorksTab] = useState<WorksTabKey>(() => resolveOwnerTab(normalizeWorksTabKey(initialTab)));
    const historyUserId = user?.user?.id;
    const [historyGames, setHistoryGames] = useState<UserGameData[]>(() => readBrowsingHistory(historyUserId));
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

    const publishedTotalPages = Math.max(1, Math.ceil(publishedGames.length / WORKS_PAGE_SIZE));
    const favoritesTotalPages = Math.max(1, Math.ceil(favoritesTotal / WORKS_PAGE_SIZE));

    const pagedPublishedGames = useMemo(
        () => paginateItems(publishedGames, isPreview ? 1 : worksPage, listPageSize),
        [publishedGames, worksPage, isPreview, listPageSize],
    );
    const displayedFavoriteGames = useMemo(
        () => (isPreview ? favoriteGames.slice(0, listPageSize) : favoriteGames),
        [favoriteGames, isPreview, listPageSize],
    );

    const historyTotalPages = Math.max(1, Math.ceil(historyGames.length / WORKS_PAGE_SIZE));
    const pagedHistoryGames = useMemo(
        () => paginateItems(historyGames, isPreview ? 1 : worksPage, listPageSize),
        [historyGames, worksPage, isPreview, listPageSize],
    );

    const worksTotalPages = worksTab === 'all'
        ? allTotalPages
        : worksTab === 'history'
            ? historyTotalPages
        : worksTab === 'published'
            ? publishedTotalPages
            : favoritesTotalPages;

    const getGameManageId = (game: UserGameData) => String(game.file_id || game.id || '');
    const selectedDraftCount = selectedDraftIds.length;
    const manageTargetGames = useMemo(() => {
        if (worksTab === 'published') return publishedGames.filter((g) => isDraftSlotWork(g));
        if (worksTab === 'favorites' || worksTab === 'history') return [];
        return draftGames;
    }, [worksTab, publishedGames, draftGames]);
    const isAllDraftsSelected = manageTargetGames.length > 0
        && manageTargetGames.every((game) => selectedDraftIds.includes(getGameManageId(game)));
    const canShowManage = !isVisitor && !showWorksViewAll && worksTab === 'all' && draftGames.length > 0;

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
        const next = resolveOwnerTab(normalizeWorksTabKey(initialTab));
        setWorksTab(next);
        setWorksPage(1);
        if (next === 'favorites') {
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
        if (!isDraftSlotWork(game)) return;
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

        setSelectedDraftIds(manageTargetGames.map((game) => getGameManageId(game)).filter(Boolean));
    };

    const handleWorksTabChange = (nextTab: WorksTabKey) => {
        if (isVisitor && nextTab !== 'published') return;
        setWorksTab(nextTab);
        if (nextTab === 'history') setHistoryGames(readBrowsingHistory(historyUserId));
        setWorksPage(1);
        setIsDraftManageMode(false);
        setSelectedDraftIds([]);
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
        || (worksTab === 'favorites' && favoritesTotal === 0)
    );

    const handleClearHistory = () => {
        clearBrowsingHistory(historyUserId);
        setHistoryGames([]);
        setWorksPage(1);
    };

    const renderManageActions = () => {
        if (worksTab === 'history' && !isVisitor && !showWorksViewAll && historyGames.length > 0) {
            return (
                <div className={styles.draftManageActions}>
                    <button type="button" className={styles.draftManageButton} onClick={handleClearHistory}>
                        清空记录
                    </button>
                </div>
            );
        }
        if (!canShowManage) return null;
        return (
            <div className={`${styles.draftManageActions} ${isDraftManageMode ? styles.draftManageActionsExpanded : ''}`}>
                {isDraftManageMode ? (
                    <>
                        <button
                            type="button"
                            className={styles.draftManageButton}
                            onClick={handleToggleSelectAllDrafts}
                            disabled={manageTargetGames.length === 0}
                        >
                            {isAllDraftsSelected ? t('create.cancelSelectAll') : t('create.selectAll')}
                        </button>
                        <button
                            type="button"
                            className={`${styles.draftManageButton} ${styles.draftDeleteButton}`}
                            onClick={() => setIsBatchDeleteConfirmOpen(true)}
                            disabled={selectedDraftCount === 0 || isBatchDeletingDrafts}
                        >
                            {isBatchDeletingDrafts ? t('create.deleting') : t('create.delete')}
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
        );
    };

    return (
        <div className={styles.worksSection} ref={worksSectionRef}>
            {/* 功能注释：管理模式用单行操作栏（左已选数、右操作），避免 Tab 空位 + 第二行提示双截条 */}
            <div className={`${styles.worksTabBar} ${isDraftManageMode ? styles.worksTabBarManaging : ''}`}>
                {isDraftManageMode ? (
                    <div className={styles.draftManageCount} role="status">
                        {t('create.draftsSelected', { count: selectedDraftCount })}
                    </div>
                ) : (
                    <div className={styles.worksTabs}>
                        {!isVisitor && (
                            <button
                                type="button"
                                className={`${styles.worksTab} ${worksTab === 'all' ? styles.worksTabActive : ''}`}
                                onClick={() => handleWorksTabChange('all')}
                            >
                                我的作品 ({allGames.length})
                            </button>
                        )}
                        {isVisitor && (
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
                                className={`${styles.worksTab} ${worksTab === 'history' ? styles.worksTabActive : ''}`}
                                onClick={() => handleWorksTabChange('history')}
                            >
                                {t('profile.browsingHistory')}
                                {historyGames.length > 0 ? ` (${historyGames.length})` : ''}
                            </button>
                        )}
                        {!isVisitor && (
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
                )}

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
                    renderManageActions()
                )}
            </div>

            {!isVisitor && draftCapacity && !draftCapacity.canCreate && (
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
                                // 功能注释：管理模式只勾选草稿；已发布/审核中仍可点进数据页
                                if (isDraftManageMode && isDraftSlotWork(game)) {
                                    handleToggleDraftSelect(game);
                                    return;
                                }
                                const status = resolveCreatorWorkStatus(game);
                                if (status === 'draft' || status === 'rejected') {
                                    handleDraftCardClick(game);
                                    return;
                                }
                                const gameId = game.file_id || game.id;
                                if (gameId) navigate(`/createGame?mode=stats&gameId=${gameId}`);
                            }}
                            selectable={isDraftManageMode}
                            selectedIds={selectedDraftIds}
                            onToggleSelect={handleToggleDraftSelect}
                            isSelectionMode={isDraftManageMode}
                            canSelectGame={isDraftSlotWork}
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

                {worksTab === 'history' && (
                    historyGames.length === 0 ? (
                        <div className={styles.worksEmpty}>还没有浏览记录</div>
                    ) : (
                        <GameGrid
                            games={pagedHistoryGames}
                            layoutVariant="works"
                            onGameClick={(game) => {
                                const gameId = game.file_id || game.id;
                                if (gameId) navigate(`/game/${gameId}`);
                            }}
                        />
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
