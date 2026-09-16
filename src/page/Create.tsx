import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { MdOutlineEdit } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Create.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import Pagination from '../components/Pagination';
import RechargeModal from '../components/Purchase/RechargeModal';
import ExchangeModal from '../components/Purchase/ExchangeModal';
import CheckInModal from '../components/CheckInModal';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import confirmModalStyles from '../components/CommonModal/ConfirmModal.module.css';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import WithdrawFlowModal from '../components/Create/WithdrawFlowModal';
import ProfileFunctionPanel from '../components/Profile/ProfileFunctionPanel';
import ProfilePreferenceModal from '../components/ProfilePreferenceModal';
import { useAuthStore } from '../store/useAuthStore';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import statisticsApi from '../api/statistics/statisticsApi';
import creatorStatsApi, { type StatsOverview } from '../api/stats/creatorStatsApi';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { auth } from '../api/account/authApi';
import GameAction from '../api/rpgGame/gameAction';
import { partitionCreatorGames } from '../utils/novelGame';
import {
    DRAFT_BOX_FILTER_ORDER,
    filterDraftGamesByType,
    getDraftBoxFilterLabelKey,
    type DraftBoxFilterKey,
} from '../utils/draftBoxFilter';
import { getApiErrorMessage } from '../utils/error';
import { getImageUrl } from '../utils/constants';
import favoriteApi from '../api/favorite/favoriteApi';
import { buildGameDetailNavigateState } from '../utils/gameDetailNavigation';
import { getGenderSymbol, normalizeGender } from '../utils/profileCompletion';

const NICKNAME_MAX_LENGTH = 20;
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

type CreatorStatsIncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';
type WorksTabKey = 'published' | 'drafts' | 'favorites';

/** 2 列(手机)与 5 列(PC) 的最小公倍数，保证网格行完整 */
const WORKS_PAGE_SIZE = 10;

const paginateItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
    const start = (Math.max(1, page) - 1) * pageSize;
    return items.slice(start, start + pageSize);
};

const formatPlayDuration = (seconds: number) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
};

const Create: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const navigate = useNavigate();

    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [isLoadingMyGames, setIsLoadingMyGames] = useState(true);
    const [stats, setStats] = useState({
        totalCreated: 0,
        totalViews: 0,
        totalClicks: 0,
        totalAmount: 0,
        totalDiamondsAmount: 0,
        totalIncentiveAmount: 0,
        pendingIncome: 0,
        inviteTotalAmount: 0,
        invitePendingIncome: 0,
        incentiveType: 'none' as CreatorStatsIncentiveType,
    });
    const [creatorStats, setCreatorStats] = useState<StatsOverview | null>(null);
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isMembershipRechargeModalOpen, setIsMembershipRechargeModalOpen] = useState(false);
    const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettleDiamondsModalOpen, setIsSettleDiamondsModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isDraftManageMode, setIsDraftManageMode] = useState(false);
    const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
    const [isBatchDeletingDrafts, setIsBatchDeletingDrafts] = useState(false);
    const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);
    const [draftFilterKey, setDraftFilterKey] = useState<DraftBoxFilterKey>('all');
    const [streakDays, setStreakDays] = useState(0);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    const [isEarningsMoreExpanded, setIsEarningsMoreExpanded] = useState(false);
    const [isEditNicknameOpen, setIsEditNicknameOpen] = useState(false);
    const [isProfilePreferenceOpen, setIsProfilePreferenceOpen] = useState(false);
    const [nicknameDraft, setNicknameDraft] = useState('');
    const [isSavingNickname, setIsSavingNickname] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const worksSectionRef = useRef<HTMLDivElement>(null);
    const [worksTab, setWorksTab] = useState<WorksTabKey>('published');
    const [worksPage, setWorksPage] = useState(1);
    const [favoriteGames, setFavoriteGames] = useState<UserGameData[]>([]);
    const [favoritesTotal, setFavoritesTotal] = useState(0);
    const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
    const [favoritesLoaded, setFavoritesLoaded] = useState(false);

    const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
    const userCode = user?.user?.userCode;
    const normalizedGender = normalizeGender(user?.user?.gender);
    const genderSymbol = getGenderSymbol(normalizedGender);
    const debugToken = user?.user?.debugToken;
    const truncatedDebugToken = debugToken ? `${debugToken.slice(0, 8)}...` : null;
    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const isMember = Boolean(user?.user?.isMember);
    const isSignedAuthor = Boolean(user?.user?.userSegment && user.user.userSegment !== 'normal');
    const isWorkIncentive = stats.incentiveType === 'incentive' || stats.incentiveType === 'game_incentive' || stats.incentiveType === 'all_incentive';
    const isCodeIncentive = stats.incentiveType === 'code_incentive' || stats.incentiveType === 'all_incentive';
    const hasExtraEarnings = isWorkIncentive || isCodeIncentive;

    const handleWithdrawClick = () => {
        setIsWithdrawModalOpen(true);
    };

    const openEditNickname = () => {
        setNicknameDraft(user?.user?.nickname || user?.user?.name || '');
        setIsEditNicknameOpen(true);
    };

    const closeEditNickname = () => {
        if (isSavingNickname) return;
        setIsEditNicknameOpen(false);
    };

    const handleConfirmEditNickname = async () => {
        const nextName = nicknameDraft.trim();
        if (!nextName) {
            toast.error(t('profile.enterNewNickname'));
            return;
        }
        if (nextName.length > NICKNAME_MAX_LENGTH) {
            toast.error(t('profile.nicknameTip'));
            return;
        }
        if (nextName === (user?.user?.nickname || '').trim()) {
            setIsEditNicknameOpen(false);
            return;
        }

        setIsSavingNickname(true);
        try {
            const response = await auth.updateUserInfo(nextName);
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('common.error'));
            }
            updateUser(response.data.data);
            toast.success(t('common.success'));
            setIsEditNicknameOpen(false);
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setIsSavingNickname(false);
        }
    };

    const openAvatarPicker = () => {
        if (isUploadingAvatar) return;
        avatarInputRef.current?.click();
    };

    const handleAvatarFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error(t('profile.selectImageFile'));
            return;
        }
        if (file.size > AVATAR_MAX_SIZE_BYTES) {
            toast.error(t('profile.imageTooLarge'));
            return;
        }

        setIsUploadingAvatar(true);
        try {
            const response = await auth.updateUserAvatar(file);
            if (!response.data.success || !response.data.data?.avatarUrl) {
                throw new Error(response.data.message || t('common.error'));
            }
            updateUser({ avatarUrl: response.data.data.avatarUrl });
            toast.success(t('profile.avatarUpdated'));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('common.error')));
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const { publishedGames, draftGames } = useMemo(
        () => partitionCreatorGames(fileMetas),
        [fileMetas],
    );

    const filteredDraftGames = useMemo(
        () => filterDraftGamesByType(draftGames, draftFilterKey),
        [draftGames, draftFilterKey],
    );

    const publishedTotalPages = Math.max(1, Math.ceil(publishedGames.length / WORKS_PAGE_SIZE));
    const draftTotalPages = Math.max(1, Math.ceil(filteredDraftGames.length / WORKS_PAGE_SIZE));
    const favoritesTotalPages = Math.max(1, Math.ceil(favoritesTotal / WORKS_PAGE_SIZE));

    const pagedPublishedGames = useMemo(
        () => paginateItems(publishedGames, worksPage, WORKS_PAGE_SIZE),
        [publishedGames, worksPage],
    );
    const pagedDraftGames = useMemo(
        () => paginateItems(filteredDraftGames, worksPage, WORKS_PAGE_SIZE),
        [filteredDraftGames, worksPage],
    );

    const worksTotalPages = worksTab === 'published'
        ? publishedTotalPages
        : worksTab === 'drafts'
            ? draftTotalPages
            : favoritesTotalPages;

    const getGameManageId = (game: UserGameData) => String(game.file_id || game.id || '');
    const selectedDraftCount = selectedDraftIds.length;
    const isAllDraftsSelected = filteredDraftGames.length > 0
        && filteredDraftGames.every((game) => selectedDraftIds.includes(getGameManageId(game)));

    const loadMyGames = async () => {
        if (!user?.user?.id) {
            return;
        }

        setIsLoadingMyGames(true);
        try {
            const response = await getGameDataApi.getUserData({ limit: 100 });
            if (response.data.success && response.data.data) {
                setFileMetas(response.data.data);
            } else {
                setFileMetas([]);
            }
        } catch (error) {
            console.error('获取我的游戏列表错误:', error);
            setFileMetas([]);
        } finally {
            setIsLoadingMyGames(false);
        }
    };

    const getGameTotalStats = async () => {
        if (!user?.user?.id) {
            return;
        }

        try {
            const response = await statisticsApi.getALLGameStats();
            if (response.data.success && response.data.data) {
                setStats({
                    totalCreated: response.data.data.count ?? 0,
                    totalViews: response.data.data.pv ?? 0,
                    totalClicks: response.data.data.uv ?? 0,
                    totalAmount: response.data.data.totalPointsAmount ?? 0,
                    totalDiamondsAmount: response.data.data.totalDiamondsAmount ?? 0,
                    totalIncentiveAmount: response.data.data.totalIncentiveAmount ?? 0,
                    pendingIncome: response.data.data.pendingIncome ?? 0,
                    inviteTotalAmount: response.data.data.inviteTotalAmount ?? 0,
                    invitePendingIncome: response.data.data.invitePendingIncome ?? 0,
                    incentiveType: response.data.data.incentiveType ?? 'none',
                });
            }
        } catch (error) {
            console.error('获取我的游戏统计错误:', error);
        }
    };

    const getCreatorOverviewStats = async () => {
        if (!user?.user?.id) {
            return;
        }

        try {
            const response = await creatorStatsApi.getOverview();
            if (response.data.success) {
                setCreatorStats(response.data.data);
            }
        } catch (error) {
            console.error('获取创作者统计错误:', error);
        }
    };

    const getUserInfo = async () => {
        try {
            const response = await auth.getUserInfo();
            if (response.data.success && response.data.data) {
                updateUser(response.data.data);
            }
        } catch (error) {
            console.error('获取用户信息错误:', error);
        }
    };

    const getSignInStreak = async () => {
        if (!user?.user?.id) {
            return;
        }

        try {
            const response = await auth.getSignInStatus();
            if (response.data.success && response.data.data) {
                const status = response.data.data;
                const days = status.signedInToday
                    ? status.streakDay
                    : Math.max(0, (status.streakDay || 1) - 1);
                setStreakDays(days);
            }
        } catch (error) {
            console.error('获取签到状态错误:', error);
        }
    };

    useEffect(() => {
        loadMyGames();
        getGameTotalStats();
        getCreatorOverviewStats();
        getUserInfo();
        getSignInStreak();
    }, [user?.user?.id]);

    useEffect(() => {
        if (draftGames.length === 0) {
            setIsDraftManageMode(false);
            setSelectedDraftIds([]);
            return;
        }

        setSelectedDraftIds((prev) => prev.filter((id) => draftGames.some((game) => getGameManageId(game) === id)));
    }, [draftGames]);

    useEffect(() => {
        if (worksPage > worksTotalPages) {
            setWorksPage(worksTotalPages);
        }
    }, [worksPage, worksTotalPages]);

    const handleCopyUserCode = async () => {
        if (!userCode) return;

        try {
            await navigator.clipboard.writeText(userCode);
            toast.success(t('create.kuranIdCopied'));
        } catch (error) {
            console.error('复制 Kuran 号失败:', error);
            toast.error(t('create.copyFailed'));
        }
    };

    const handleCopyDebugToken = async () => {
        if (!debugToken) return;

        try {
            await navigator.clipboard.writeText(debugToken);
            toast.success(t('create.tokenCopied'));
        } catch (error) {
            console.error('复制 Token 失败:', error);
            toast.error(t('create.copyFailed'));
        }
    };

    const handleRecharge = async (order: PayOrderRequest) => {
        const response = await payApi.getPayQrCode(order);
        if (response.data.code === 200 && response.data.data) {
            getUserInfo();
            return {
                qrDataUrl: response.data.data.qrDataUrl,
                outTradeNo: response.data.data.outTradeNo,
            };
        }

        toast.error(response.data.message || t('create.rechargeFailed'));
        return null;
    };

    const formatEarningsValue = (value: number) => {
        const safe = Number(value) || 0;
        return safe.toLocaleString('zh-CN');
    };

    const handleOpenDraftManage = () => {
        // 实现草稿管理模式
        setIsDraftManageMode(true);
    };

    const handleCloseDraftManage = () => {
        // 实现退出管理模式
        setIsDraftManageMode(false);
        setSelectedDraftIds([]);
    };

    const handleToggleDraftSelect = (game: UserGameData) => {
        const draftId = getGameManageId(game);
        if (!draftId) return;

        // 实现草稿批量选择
        setSelectedDraftIds((prev) => (
            prev.includes(draftId)
                ? prev.filter((id) => id !== draftId)
                : [...prev, draftId]
        ));
    };

    const handleToggleSelectAllDrafts = () => {
        // 实现草稿全选切换
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

    const loadFavoriteGames = async (page = 1) => {
        setIsLoadingFavorites(true);
        try {
            const response = await favoriteApi.list({
                limit: String(WORKS_PAGE_SIZE),
                offset: String((Math.max(1, page) - 1) * WORKS_PAGE_SIZE),
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

    const handleWorksTabChange = (nextTab: WorksTabKey) => {
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

            // 实现批量删除确认
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

    const handleSettle = async () => {
        if (isSettling) return;

        setIsSettling(true);
        try {
            const response = await auth.settlePoints('points');
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                const pointsAmount = data.pointsSettled || 0;
                const diamondsAmount = data.diamondsSettled || 0;

                let successMsg = '';
                if (pointsAmount > 0 && diamondsAmount > 0) {
                    successMsg = t('create.settleSuccessDual', { points: pointsAmount, diamonds: diamondsAmount });
                } else if (pointsAmount > 0) {
                    successMsg = t('create.settleSuccess', { amount: pointsAmount });
                } else if (diamondsAmount > 0) {
                    successMsg = t('create.settleSuccessDiamonds', { amount: diamondsAmount });
                } else {
                    successMsg = t('create.settleSuccessZero');
                }

                toast.success(successMsg);
                await getGameTotalStats();
                await getCreatorOverviewStats();
                await getUserInfo();
                setIsSettleModalOpen(false);
            } else {
                toast.error(response.data.message || t('create.settleFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('create.settleFailed')));
        } finally {
            setIsSettling(false);
        }
    };

    const handleSettleDiamonds = async () => {
        if (isSettling) return;

        setIsSettling(true);
        try {
            const response = await auth.settlePoints('diamonds');
            if (response.data.success && response.data.data) {
                const data = response.data.data;
                const diamondsAmount = data.diamondsSettled || 0;

                let successMsg = '';
                if (diamondsAmount > 0) {
                    successMsg = t('create.settleSuccessDiamonds', { amount: diamondsAmount });
                } else {
                    successMsg = t('create.settleSuccessZero');
                }

                toast.success(successMsg);
                await getGameTotalStats();
                await getUserInfo();
                setIsSettleDiamondsModalOpen(false);
            } else {
                toast.error(response.data.message || t('create.settleFailed'));
            }
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('create.settleFailed')));
        } finally {
            setIsSettling(false);
        }
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    <div className={styles.creatorHeroSection}>
                        <div className={styles.creatorHeroCard}>
                            <div className={styles.pageHeader}>
                                <h1 className={styles.pageHeaderTitle}>{t('nav.profile')}</h1>
                            </div>

                            <div className={styles.creatorHeroTop}>
                                <div className={styles.creatorHeroAvatarFrame}>
                                    <button
                                        type="button"
                                        className={styles.creatorHeroAvatarBtn}
                                        onClick={openAvatarPicker}
                                        disabled={isUploadingAvatar}
                                        aria-label={t('profile.changeAvatar')}
                                    >
                                        <img
                                            className={styles.creatorHeroAvatar}
                                            src={userAvatar}
                                            alt={userName}
                                        />
                                        {isUploadingAvatar && (
                                            <span className={styles.creatorHeroAvatarLoading} aria-hidden="true" />
                                        )}
                                    </button>
                                    <input
                                        ref={avatarInputRef}
                                        type="file"
                                        accept="image/*"
                                        className={styles.hiddenFileInput}
                                        onChange={handleAvatarFileChange}
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                </div>
                                <div className={styles.creatorHeroInfo}>
                                    <div className={styles.creatorHeroNameRow}>
                                        <div className={styles.creatorHeroNameGroup}>
                                            <h2 className={styles.creatorHeroName}>{userName}</h2>
                                            <button
                                                type="button"
                                                className={styles.creatorEditNameBtn}
                                                onClick={openEditNickname}
                                                aria-label={t('profile.editNickname')}
                                            >
                                                <MdOutlineEdit aria-hidden="true" />
                                            </button>
                                            {genderSymbol && (
                                                <button
                                                    type="button"
                                                    className={`${styles.creatorGenderBadge} ${normalizedGender === 'male' ? styles.creatorGenderBadgeMale : styles.creatorGenderBadgeFemale}`}
                                                    onClick={() => setIsProfilePreferenceOpen(true)}
                                                    aria-label={t('profile.changeProfilePreference')}
                                                    title={t('profile.changeProfilePreference')}
                                                >
                                                    {genderSymbol}
                                                </button>
                                            )}
                                        </div>
                                        {streakDays > 0 && (
                                            <span className={styles.creatorStreakBadge}>
                                                {t('create.streakBadge', { days: streakDays })}
                                            </span>
                                        )}
                                    </div>
                                    <div className={styles.creatorHeroMetaRow}>
                                        <span className={styles.creatorHeroId}>
                                            {t('create.idPrefix')}{userCode || '--'}
                                        </span>
                                        {userCode && (
                                            <button
                                                type="button"
                                                className={styles.creatorCopyLink}
                                                onClick={handleCopyUserCode}
                                            >
                                                {t('create.copy')}
                                            </button>
                                        )}
                                        {(isMember || isSignedAuthor) && (
                                            <div className={styles.creatorHeroBadgeRow}>
                                                {isMember && (
                                                    <span className={styles.creatorRoleBadge}>
                                                        {t('create.memberBadge')}
                                                    </span>
                                                )}
                                                {isSignedAuthor && (
                                                    <span className={styles.creatorRoleBadge}>
                                                        {t('create.signedAuthorBadge')}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.creatorHeroTokenRow}>
                                        <span className={styles.creatorHeroTokenLabel}>Token:</span>
                                        <span className={styles.creatorHeroTokenValue}>
                                            {truncatedDebugToken || '--'}
                                        </span>
                                        {debugToken && (
                                            <button
                                                type="button"
                                                className={styles.creatorCopyLink}
                                                onClick={handleCopyDebugToken}
                                            >
                                                {t('create.copy')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className={styles.creatorHeroStats}>
                                <div className={styles.primaryStatsBar}>
                                    <div className={styles.primaryStatItem}>
                                        <div className={styles.primaryStatValue}>{stats.totalCreated}</div>
                                        <div className={styles.primaryStatLabel}>{t('create.totalCreated')}</div>
                                    </div>
                                    <div className={styles.primaryStatItem}>
                                        <div className={styles.primaryStatValue}>{creatorStats?.likeCount ?? 0}</div>
                                        <div className={styles.primaryStatLabel}>{t('creatorStats.totalLikes')}</div>
                                    </div>
                                    <div
                                        className={`${styles.primaryStatItem} ${styles.primaryStatItemClickable}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate('/asset/details')}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                navigate('/asset/details');
                                            }
                                        }}
                                    >
                                        <div className={styles.primaryStatValue}>{user?.user?.points ?? 0}</div>
                                        <div className={styles.primaryStatLabel}>{t('create.pointsStat')}</div>
                                    </div>
                                    <div
                                        className={`${styles.primaryStatItem} ${styles.primaryStatItemWithActions} ${styles.primaryStatItemClickable}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate('/asset/details')}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                navigate('/asset/details');
                                            }
                                        }}
                                    >
                                        <div className={styles.primaryStatValueRow}>
                                            <div className={styles.primaryStatValueBlock}>
                                                <div className={styles.primaryStatValue}>{user?.user?.diamonds ?? 0}</div>
                                                <div className={styles.primaryStatLabel}>{t('create.diamondsStat')}</div>
                                            </div>
                                            <div className={styles.primaryStatActions}>
                                                {user?.user?.userSegment !== 'normal' && (
                                                    <button
                                                        type="button"
                                                        className={`${styles.creatorAssetActionButton} ${styles.creatorWithdrawButton}`}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleWithdrawClick();
                                                        }}
                                                    >
                                                        {t('create.withdraw')}
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className={`${styles.creatorAssetActionButton} ${styles.creatorRechargeButton}`}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setIsRechargeModalOpen(true);
                                                    }}
                                                >
                                                    {t('create.recharge')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className={styles.statsExpandToggle}
                                    onClick={() => setIsStatsExpanded((prev) => !prev)}
                                    aria-expanded={isStatsExpanded}
                                >
                                    <span>
                                        {isStatsExpanded ? t('create.collapseMoreStats') : t('create.expandMoreStats')}
                                    </span>
                                    <IoChevronDown
                                        className={`${styles.statsExpandIcon} ${isStatsExpanded ? styles.statsExpandIconOpen : ''}`}
                                    />
                                </button>

                                {isStatsExpanded && (
                                    <div className={styles.expandedStatsBar}>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{stats.totalViews}</div>
                                            <div className={styles.primaryStatLabel}>{t('create.totalViews')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{stats.totalClicks}</div>
                                            <div className={styles.primaryStatLabel}>{t('create.totalVisitors')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{creatorStats?.playCount ?? 0}</div>
                                            <div className={styles.primaryStatLabel}>{t('creatorStats.playCount')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>
                                                {formatPlayDuration(creatorStats?.playDurationSeconds ?? 0)}
                                            </div>
                                            <div className={styles.primaryStatLabel}>{t('creatorStats.playDuration')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{creatorStats?.shareCount ?? 0}</div>
                                            <div className={styles.primaryStatLabel}>{t('creatorStats.shareCount')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{creatorStats?.commentCount ?? 0}</div>
                                            <div className={styles.primaryStatLabel}>{t('creatorStats.commentCount')}</div>
                                        </div>
                                        <div className={styles.expandedStatItem}>
                                            <div className={styles.primaryStatValue}>{creatorStats?.spendPoints ?? 0}</div>
                                            <div className={styles.primaryStatLabel}>{t('creatorStats.spendPoints')}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={styles.accountPanel}>
                            <div className={styles.accountPanelTitle}>{t('create.myAccount')}</div>
                            <div className={styles.accountActionGrid}>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => setIsCheckInModalOpen(true)}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/signin.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountCheckIn')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => setIsRechargeModalOpen(true)}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/pay.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountRecharge')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => setIsMembershipRechargeModalOpen(true)}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/member.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountMembership')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => setIsExchangeModalOpen(true)}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/mall.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountPointsMall')}</span>
                                </button>
                            </div>
                        </div>

                        <div className={styles.earningsPanelWrap}>
                            <div className={styles.earningsPanelBody}>
                                <div className={styles.earningsPanelTop}>
                                    <div className={styles.earningsPanelItem}>
                                        <div className={styles.earningsPanelLabel}>{t('create.pendingRewardPoints')}</div>
                                        <div className={styles.earningsPanelValueRow}>
                                            <div className={styles.earningsPanelValue}>{formatEarningsValue(stats.totalAmount)}</div>
                                            {stats.totalAmount > 0 && (
                                                <button
                                                    type="button"
                                                    className={styles.earningsInlineSettleButton}
                                                    onClick={() => setIsSettleModalOpen(true)}
                                                    disabled={isSettling}
                                                >
                                                    {t('create.settle')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className={styles.earningsPanelItem}>
                                        <div className={styles.earningsPanelLabel}>{t('create.pendingRewardDiamonds')}</div>
                                        <div className={styles.earningsPanelValueRow}>
                                            <div className={styles.earningsPanelValue}>{formatEarningsValue(stats.totalDiamondsAmount)}</div>
                                            {stats.totalDiamondsAmount > 0 && (
                                                <button
                                                    type="button"
                                                    className={styles.earningsInlineSettleButton}
                                                    onClick={() => setIsSettleDiamondsModalOpen(true)}
                                                    disabled={isSettling}
                                                >
                                                    {t('create.settle')}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {hasExtraEarnings && (
                                        <div className={styles.earningsPanelActions}>
                                            <button
                                                type="button"
                                                className={styles.earningsMoreToggle}
                                                onClick={() => setIsEarningsMoreExpanded((prev) => !prev)}
                                                aria-expanded={isEarningsMoreExpanded}
                                            >
                                                <span>
                                                    {isEarningsMoreExpanded
                                                        ? t('create.earningsCollapse')
                                                        : t('create.withdrawRecordsViewAll')}
                                                </span>
                                                <IoChevronDown
                                                    className={`${styles.earningsMoreIcon} ${isEarningsMoreExpanded ? styles.earningsMoreIconOpen : ''}`}
                                                />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {hasExtraEarnings && isEarningsMoreExpanded && (
                                    <div className={styles.earningsExtraStats}>
                                        {isWorkIncentive && (
                                            <div className={styles.earningsExtraItem}>
                                                <div className={styles.earningsExtraLabel}>{t('create.totalIncentiveEarnings')}</div>
                                                <div className={styles.earningsExtraValue}>{stats.totalIncentiveAmount}</div>
                                            </div>
                                        )}
                                        {isWorkIncentive && (
                                            <div className={styles.earningsExtraItem}>
                                                <div className={styles.earningsExtraLabel}>{t('create.pendingIncentiveEarnings')}</div>
                                                <div className={styles.earningsExtraValue}>{stats.pendingIncome}</div>
                                            </div>
                                        )}
                                        {isCodeIncentive && (
                                            <div className={styles.earningsExtraItem}>
                                                <div className={styles.earningsExtraLabel}>{t('create.inviteCodeTotalEarnings')}</div>
                                                <div className={styles.earningsExtraValue}>{stats.inviteTotalAmount}</div>
                                            </div>
                                        )}
                                        {isCodeIncentive && (
                                            <div className={styles.earningsExtraItem}>
                                                <div className={styles.earningsExtraLabel}>{t('create.inviteCodePendingEarnings')}</div>
                                                <div className={styles.earningsExtraValue}>{stats.invitePendingIncome}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={styles.worksSection} ref={worksSectionRef}>
                        <div className={styles.worksTabBar}>
                            <div className={styles.worksTabs}>
                                <button
                                    type="button"
                                    className={`${styles.worksTab} ${worksTab === 'published' ? styles.worksTabActive : ''}`}
                                    onClick={() => handleWorksTabChange('published')}
                                >
                                    {t('create.publishedWorksTab', { count: publishedGames.length })}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.worksTab} ${worksTab === 'drafts' ? styles.worksTabActive : ''}`}
                                    onClick={() => handleWorksTabChange('drafts')}
                                >
                                    {t('create.draftBox')}
                                    {draftGames.length > 0 ? ` (${draftGames.length})` : ''}
                                </button>
                                <button
                                    type="button"
                                    className={`${styles.worksTab} ${worksTab === 'favorites' ? styles.worksTabActive : ''}`}
                                    onClick={() => handleWorksTabChange('favorites')}
                                >
                                    {t('create.favoritesTab')}
                                    {favoritesLoaded && favoritesTotal > 0 ? ` (${favoritesTotal})` : ''}
                                </button>
                            </div>
                            {worksTab === 'drafts' && draftGames.length > 0 && (
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
                            )}
                        </div>

                        <div className={styles.worksTabPanel}>
                            {worksTab === 'published' && (
                                isLoadingMyGames ? (
                                    <GameGridSkeleton count={8} layoutVariant="works" />
                                ) : publishedGames.length === 0 ? (
                                    <div className={styles.worksEmpty}>{t('create.noPublishedGames')}</div>
                                ) : (
                                    <GameGrid
                                        games={pagedPublishedGames}
                                        layoutVariant="works"
                                        primaryStat="pv"
                                        showIncentiveUI={isWorkIncentive}
                                        onGameClick={(game) => {
                                            const gameId = game.file_id || game.id;
                                            if (!gameId) return;
                                            navigate(`/createGame?mode=stats&gameId=${gameId}`);
                                        }}
                                    />
                                )
                            )}

                            {worksTab === 'drafts' && (
                                isLoadingMyGames ? (
                                    <GameGridSkeleton count={8} layoutVariant="works" />
                                ) : draftGames.length === 0 ? (
                                    <div className={styles.worksEmpty}>{t('create.startCreating')}</div>
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
                                    <GameGridSkeleton count={8} layoutVariant="works" />
                                ) : favoriteGames.length === 0 ? (
                                    <div className={styles.worksEmpty}>{t('favorites.empty')}</div>
                                ) : (
                                    <GameGrid
                                        games={favoriteGames}
                                        layoutVariant="works"
                                        showUnpublishedBadge
                                        onGameClick={handleFavoriteGameClick}
                                    />
                                )
                            )}

                            {worksTotalPages > 1 && !(
                                (worksTab === 'published' && (isLoadingMyGames || publishedGames.length === 0))
                                || (worksTab === 'drafts' && (isLoadingMyGames || draftGames.length === 0 || filteredDraftGames.length === 0))
                                || (worksTab === 'favorites' && favoritesTotal === 0)
                            ) && (
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
                    </div>

                    <ProfileFunctionPanel />
                </div>
            </div>

            <MobileBottomNav />
            <FooterArea />

            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
            />
            <RechargeModal
                isOpen={isMembershipRechargeModalOpen}
                onClose={() => setIsMembershipRechargeModalOpen(false)}
                onRecharge={handleRecharge}
                fixedTab="membership"
            />
            <CheckInModal
                isOpen={isCheckInModalOpen}
                onClose={() => setIsCheckInModalOpen(false)}
                onSignInSuccess={() => {
                    void getUserInfo();
                }}
            />
            <ExchangeModal
                isOpen={isExchangeModalOpen}
                onClose={() => setIsExchangeModalOpen(false)}
                onSuccess={() => {
                    void getUserInfo();
                }}
            />
            <WithdrawFlowModal
                open={isWithdrawModalOpen}
                onClose={() => setIsWithdrawModalOpen(false)}
            />

            {isEditNicknameOpen && (
                <div className={styles.editNicknameOverlay} onClick={closeEditNickname}>
                    <div
                        className={styles.editNicknameModal}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('profile.editNickname')}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={styles.editNicknameCloseBtn}
                            onClick={closeEditNickname}
                            disabled={isSavingNickname}
                            aria-label={t('common.close')}
                        >
                            <span className={styles.editNicknameCloseIcon} aria-hidden="true" />
                        </button>
                        <h3 className={styles.editNicknameTitle}>{t('profile.editNickname')}</h3>
                        <div className={styles.editNicknameBody}>
                            <input
                                className={styles.editNicknameInput}
                                value={nicknameDraft}
                                onChange={(event) => setNicknameDraft(event.target.value.slice(0, NICKNAME_MAX_LENGTH))}
                                placeholder={t('profile.enterNewNickname')}
                                maxLength={NICKNAME_MAX_LENGTH}
                                autoFocus
                                disabled={isSavingNickname}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleConfirmEditNickname();
                                    }
                                }}
                            />
                            <p className={styles.editNicknameTip}>{t('profile.nicknameTip')}</p>
                        </div>
                        <button
                            type="button"
                            className={styles.editNicknameConfirm}
                            onClick={() => void handleConfirmEditNickname()}
                            disabled={isSavingNickname}
                        >
                            {isSavingNickname ? t('profile.saving') : t('profile.confirm')}
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isSettleModalOpen}
                onConfirm={handleSettle}
                onCancel={() => setIsSettleModalOpen(false)}
                title={t('create.confirmSettle')}
                message={(
                    <Trans
                        i18nKey="create.settleConfirmMessage"
                        values={{ amount: stats.totalAmount }}
                        components={{ hl: <strong className={confirmModalStyles.amountHighlight} /> }}
                    />
                )}
                confirmButtonText={isSettling ? t('create.settling') : t('create.confirmSettleBtn')}
                cancelButtonText={t('create.cancel')}
                tone="dark"
            />

            <ConfirmModal
                isOpen={isSettleDiamondsModalOpen}
                onConfirm={handleSettleDiamonds}
                onCancel={() => setIsSettleDiamondsModalOpen(false)}
                title={t('create.confirmSettleDiamonds')}
                message={(
                    <Trans
                        i18nKey="create.settleConfirmDiamondsMessage"
                        values={{ amount: stats.totalDiamondsAmount }}
                        components={{ hl: <strong className={confirmModalStyles.amountHighlight} /> }}
                    />
                )}
                confirmButtonText={isSettling ? t('create.settling') : t('create.confirmSettleBtn')}
                cancelButtonText={t('create.cancel')}
                tone="dark"
            />

            <ConfirmModal
                isOpen={isBatchDeleteConfirmOpen}
                onConfirm={handleConfirmBatchDeleteDrafts}
                onCancel={() => {
                    if (isBatchDeletingDrafts) return;
                    setIsBatchDeleteConfirmOpen(false);
                }}
                title={t('create.batchDeleteDrafts')}
                message={t('create.batchDeleteConfirmMessage', { count: selectedDraftCount })}
                confirmButtonText={isBatchDeletingDrafts ? t('create.deletingDrafts') : t('create.confirmDelete')}
                cancelButtonText={t('create.cancel')}
            />

            <ProfilePreferenceModal
                isOpen={isProfilePreferenceOpen}
                onClose={() => setIsProfilePreferenceOpen(false)}
                onSaved={() => setIsProfilePreferenceOpen(false)}
            />
        </div>
    );
};

export default Create;
