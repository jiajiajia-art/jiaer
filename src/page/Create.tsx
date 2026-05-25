import React, { useEffect, useMemo, useState } from 'react';
import { IoEye, IoStatsChartSharp } from 'react-icons/io5';
import { TbHandClick } from 'react-icons/tb';
import { HiOutlineLightBulb } from 'react-icons/hi';
import { MdContentCopy } from 'react-icons/md';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Create.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import GameGrid from '../components/GameGrid';
import RechargeModal from '../components/Purchase/RechargeModal';
import CreateGameModals from '../components/CreateGame/CreateGameModals';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import PDFTemplateModal from '../components/GameSettingEditor/PDFTemplateModal';
import GameGridSkeleton from '../components/Skeleton/GameGridSkeleton';
import { useAuthStore } from '../store/useAuthStore';
import { useEditorStore } from '../store/editorStore';
import { useGameStore } from '../store/gameStore';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import statisticsApi from '../api/statistics/statisticsApi';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { auth } from '../api/account/authApi';
import GameAction from '../api/rpgGame/gameAction';
import { HOST_ADDRESS } from '../config';
import { authFetch } from '../api/base';
import {
    getMiniProgramCreatorBlockedMessage,
    isMiniProgramCreatorTypeSupported,
    isMiniProgramEnv,
    MINI_PROGRAM_CREATOR_PC_URL,
    type CreatorGameType,
} from '../utils/miniProgram';

type CreatorStatsIncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';

const Create: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const { clearState } = useEditorStore();
    const { clearAll } = useGameStore();
    const navigate = useNavigate();

    const [fileMetas, setFileMetas] = useState<UserGameData[]>([]);
    const [isLoadingMyGames, setIsLoadingMyGames] = useState(true);
    const [stats, setStats] = useState({
        totalCreated: 0,
        totalViews: 0,
        totalClicks: 0,
        totalAmount: 0,
        totalIncentiveAmount: 0,
        pendingIncome: 0,
        inviteTotalAmount: 0,
        invitePendingIncome: 0,
        incentiveType: 'none' as CreatorStatsIncentiveType,
    });
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isCreateTypeModalOpen, setIsCreateTypeModalOpen] = useState(false);
    const [isMobileTipModalOpen, setIsMobileTipModalOpen] = useState(false);
    const [mobileTipMessage, setMobileTipMessage] = useState('');
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
    const [isDraftManageMode, setIsDraftManageMode] = useState(false);
    const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
    const [isBatchDeletingDrafts, setIsBatchDeletingDrafts] = useState(false);
    const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] = useState(false);

    const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
    const userCode = user?.user?.userCode;
    const debugToken = user?.user?.debugToken;
    const isMiniProgram = isMiniProgramEnv();
    const isWorkIncentive = stats.incentiveType === 'incentive' || stats.incentiveType === 'game_incentive' || stats.incentiveType === 'all_incentive';
    const isCodeIncentive = stats.incentiveType === 'code_incentive' || stats.incentiveType === 'all_incentive';

    const { publishedGames, draftGames } = useMemo(() => {
        const published: UserGameData[] = [];
        const drafts: UserGameData[] = [];

        fileMetas.forEach((game) => {
            if (game.is_public === 1) {
                published.push(game);
            } else {
                drafts.push(game);
            }
        });

        return {
            publishedGames: published,
            draftGames: drafts,
        };
    }, [fileMetas]);

    const getGameManageId = (game: UserGameData) => String(game.file_id || game.id || '');
    const selectedDraftCount = selectedDraftIds.length;
    const isAllDraftsSelected = draftGames.length > 0 && selectedDraftCount === draftGames.length;

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
                    totalCreated: response.data.data.Count ?? 0,
                    totalViews: response.data.data.pv ?? 0,
                    totalClicks: response.data.data.uv ?? 0,
                    totalAmount: response.data.data.totalAmount ?? 0,
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

    useEffect(() => {
        loadMyGames();
        getGameTotalStats();
        getUserInfo();
    }, [user?.user?.id]);

    useEffect(() => {
        if (draftGames.length === 0) {
            setIsDraftManageMode(false);
            setSelectedDraftIds([]);
            return;
        }

        setSelectedDraftIds((prev) => prev.filter((id) => draftGames.some((game) => getGameManageId(game) === id)));
    }, [draftGames]);

    const handleOpenBindPhoneGuide = () => {
        setIsMobileTipModalOpen(false);
        navigate('/profile?openBrowserLoginAccount=1');
    };

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

        setSelectedDraftIds(draftGames.map((game) => getGameManageId(game)).filter(Boolean));
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
            const response = await auth.settlePoints();
            if (response.data.success && response.data.data) {
                const settlementAmount = response.data.data.settlementAmount || 0;
                toast.success(t('create.settleSuccess', { amount: settlementAmount }));
                await getGameTotalStats();
                await getUserInfo();
                setIsSettleModalOpen(false);
            } else {
                toast.error(response.data.message || t('create.settleFailed'));
            }
        } catch (error: any) {
                const errorMessage = error?.response?.data?.message || error?.message || t('create.settleFailed');
            toast.error(errorMessage);
        } finally {
            setIsSettling(false);
        }
    };

    const openMiniProgramTypeTip = (type: Extract<CreatorGameType, 'avg' | 'custom' | 'st'>) => {
        // 小程序端暂不开放 AVG / 自定义编辑，统一引导去 PC 端。
        setMobileTipMessage(getMiniProgramCreatorBlockedMessage(type));
        setIsMobileTipModalOpen(true);
    };

    const handleSelectGameType = async (type: CreatorGameType) => {
        // 小程序端当前只允许 TXT 模式进入创作者编辑器。
        if (isMiniProgram && !isMiniProgramCreatorTypeSupported(type)) {
            if (type === 'avg' || type === 'custom' || type === 'st') {
                openMiniProgramTypeTip(type);
            }
            setIsCreateTypeModalOpen(false);
            return;
        }

        clearAll();

        if (type === 'rpg') {
            navigate('/createGame');
        } else if (type === 'txt') {
            clearState();
            navigate('/gameSettingsEditor');
        } else if (type === 'custom') {
            clearState();
            navigate('/customif/create');
        } else if (type === 'st') {
            clearState();
            navigate('/st/create');
        } else if (type === 'avg') {
            clearState();
            try {
                const resp = await authFetch(`${HOST_ADDRESS}/api/custom/apps/create-empty`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: t('create.defaultAvgGameTitle'), engine: 'AVG' }),
                });
                const data = await resp.json();
                const appId = data?.appId || data?.data?.appId;
                if (!resp.ok || !appId) {
                    throw new Error(data?.message || t('create.createAvgFailed'));
                }
                navigate(`/st/create?appId=${encodeURIComponent(appId)}`);
            } catch (error: any) {
                toast.error(String(error?.message || error || t('create.createAvgFailed')));
            }
        }

        setIsCreateTypeModalOpen(false);
    };

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
                <div className={styles.main}>
                    <div className={styles.creatorHeroSection}>
                        <div className={styles.creatorHeroCard}>
                            <div className={styles.creatorHeroMain}>
                                <div className={styles.creatorHeroMeta}>
                                    <div className={styles.creatorHeroEyebrow}>{t('create.creatorStudio')}</div>
                                    <div className={styles.creatorHeroName}>{userName}</div>
                                    <div className={styles.creatorHeroInfoRow}>
                                        <div className={styles.creatorIdentityStack}>
                                            <div className={styles.userCode}>
                                                <span className={styles.userCodeText}>{t('create.kuranIdPrefix')}{userCode || '--'}</span>
                                                {userCode && (
                                                    <button
                                                        type="button"
                                                        className={styles.userCodeCopyButton}
                                                        onClick={handleCopyUserCode}
                                                        title={t('profile.copyKuranId')}
                                                    >
                                                        <MdContentCopy />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={styles.debugToken}>
                                                <span className={styles.debugTokenText}>Token：{debugToken || '--'}</span>
                                                {debugToken && (
                                                    <button
                                                        type="button"
                                                        className={styles.userCodeCopyButton}
                                                        onClick={handleCopyDebugToken}
                                                        title={t('create.copyToken')}
                                                    >
                                                        <MdContentCopy />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.userCredit}>
                                            <button
                                                type="button"
                                                className={styles.userPointsButton}
                                                onClick={() => navigate('/points/details')}
                                            >
                                                <span className={styles.userPoints}>
                                                <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" className={styles.priceIcon} />
                                                {t('profile.myPoints')}：{user?.user?.points ?? 0}
                                                </span>
                                            </button>
                                            <button
                                                className={`${styles.payButton} ${styles.desktopPayButton}`}
                                                onClick={() => setIsRechargeModalOpen(true)}
                                            >
                                                <span>{t('create.recharge')}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.creatorHeroActions}>
                                    {/* 适配移动端按钮并排布局 */}
                                    <div className={styles.createGameButtonRow}>
                                        <button
                                            className={`${styles.payButton} ${styles.mobilePayButton}`}
                                            onClick={() => setIsRechargeModalOpen(true)}
                                        >
                                            <span>{t('create.recharge')}</span>
                                        </button>
                                        <button
                                            className={styles.createGameButtonItem}
                                            onClick={() => setIsCreateTypeModalOpen(true)}
                                        >
                                            <HiOutlineLightBulb />
                                            <span>{t('create.createGame')}</span>
                                        </button>
                                        <button
                                            className={styles.helpButton}
                                            onClick={() => setIsPDFModalOpen(true)}
                                            title={t('create.pdfGuide')}
                                        >
                                            <span className={styles.helpIcon}>?</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.statsSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/我的数据.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                {t('create.statsUpdateTime')}
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
                            </button>
                        </div>
                        <div className={styles.statsGrid}>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoStatsChartSharp />
                                    <span>{t('create.totalCreated')}</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalCreated}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <IoEye />
                                    <span>{t('create.totalViews')}</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalViews}</div>
                            </div>
                            <div className={styles.statBox}>
                                <div className={styles.statLabel}>
                                    <TbHandClick />
                                    <span>{t('create.totalVisitors')}</span>
                                </div>
                                <div className={styles.statValue}>{stats.totalClicks}</div>
                            </div>
                            <div className={`${styles.statBox} ${stats.totalAmount > 0 ? styles.statBoxWithAction : ''}`}>
                                <div className={styles.statLabel}>
                                    <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                    <span>{t('create.pendingRewardPoints')}</span>
                                </div>
                                <div className={styles.statActionRow}>
                                    <div className={styles.statValue}>{stats.totalAmount}</div>
                                    {stats.totalAmount > 0 && (
                                        <button
                                            type="button"
                                            className={styles.settleButton}
                                            onClick={() => setIsSettleModalOpen(true)}
                                        >
                                            {t('create.settle')}
                                        </button>
                                    )}
                                </div>
                            </div>
                            {isWorkIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>{t('create.totalIncentiveEarnings')}</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.totalIncentiveAmount}</div>
                                </div>
                            )}
                            {isWorkIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>{t('create.pendingIncentiveEarnings')}</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.pendingIncome}</div>
                                </div>
                            )}
                            {isCodeIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>{t('create.inviteCodeTotalEarnings')}</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.inviteTotalAmount}</div>
                                </div>
                            )}
                            {isCodeIncentive && (
                                <div className={styles.statBox}>
                                    <div className={styles.statLabel} style={{ justifyContent: 'space-between', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={`${import.meta.env.BASE_URL}data/assets/金币1.png`} alt="" />
                                            <span>{t('create.inviteCodePendingEarnings')}</span>
                                        </div>
                                    </div>
                                    <div className={styles.statValue}>{stats.invitePendingIncome}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.shopSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/发布作品.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            <button
                                type="button"
                                className={`${styles.more} ${styles.moreText}`}
                            >
                                {t('create.more')}
                                <img src={`${import.meta.env.BASE_URL}data/assets/home/箭头.png`} alt="" />
                            </button>
                        </div>

                        {isLoadingMyGames ? (
                            <GameGridSkeleton count={8} />
                        ) : publishedGames.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', height: '100px', lineHeight: '100px' }}>
                                {t('create.noPublishedGames')}
                            </div>
                        ) : (
                            <GameGrid
                                games={publishedGames}
                                primaryStat="pv"
                                showIncentiveUI={isWorkIncentive}
                                onGameClick={(game) => {
                                    const gameId = game.file_id || game.id;
                                    if (!gameId) return;
                                    navigate(`/createGame?mode=stats&gameId=${gameId}`);
                                }}
                            />
                        )}
                    </div>

                    <div className={styles.shopSection}>
                        <div className={`${styles.sectionHeader} ${styles.draftSectionHeader}`}>
                            <div className={styles.sectionTitle}>
                                <img src={`${import.meta.env.BASE_URL}data/assets/create/草稿箱.png`} alt="" />
                            </div>
                            <img
                                className={styles.sectionDividerDesktop}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线.png`}
                                alt=""
                            />
                            <img
                                className={styles.sectionDividerMobile}
                                src={`${import.meta.env.BASE_URL}data/assets/home/分界线移动端.png`}
                                alt=""
                            />
                            {draftGames.length > 0 && (
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
                        {isLoadingMyGames ? (
                            <GameGridSkeleton count={8} />
                        ) : draftGames.length === 0 ? (
                            <div style={{ textAlign: 'center', color: '#999', height: '100px', lineHeight: '100px' }}>
                                {t('create.startCreating')}
                            </div>
                        ) : (
                            <div className={styles.draftSectionBody}>
                                {isDraftManageMode && (
                                    <div className={styles.draftManageTip}>
                                        {/* 适配移动端操作栏 */}
                                        {t('create.draftsSelected', { count: selectedDraftCount })}
                                    </div>
                                )}
                                <GameGrid
                                    games={draftGames}
                                    onGameClick={handleDraftCardClick}
                                    selectable={true}
                                    selectedIds={selectedDraftIds}
                                    onToggleSelect={handleToggleDraftSelect}
                                    isSelectionMode={isDraftManageMode}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <MobileBottomNav />
            <FooterArea />

            <CreateGameModals
                isCreateTypeModalOpen={isCreateTypeModalOpen}
                isMobileTipModalOpen={isMobileTipModalOpen}
                isMiniProgram={isMiniProgram}
                mobileTipTitle={t('create.goToPC')}
                mobileTipMessage={mobileTipMessage}
                mobileTipLinkUrl={MINI_PROGRAM_CREATOR_PC_URL}
                onCloseCreateTypeModal={() => setIsCreateTypeModalOpen(false)}
                onCloseMobileTipModal={() => setIsMobileTipModalOpen(false)}
                onSelectGameType={handleSelectGameType}
                onOpenMiniProgramTip={openMiniProgramTypeTip}
                onOpenBindPhoneGuide={handleOpenBindPhoneGuide}
            />

            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
                isFirstCharge={user?.user?.firstCharge}
            />

            <ConfirmModal
                isOpen={isSettleModalOpen}
                onConfirm={handleSettle}
                onCancel={() => setIsSettleModalOpen(false)}
                title={t('create.confirmSettle')}
                message={t('create.settleConfirmMessage', { amount: stats.totalAmount })}
                confirmButtonText={isSettling ? t('create.settling') : t('create.confirmSettleBtn')}
                cancelButtonText={t('create.cancel')}
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

            <PDFTemplateModal
                isOpen={isPDFModalOpen}
                onClose={() => setIsPDFModalOpen(false)}
            />
        </div>
    );
};

export default Create;
