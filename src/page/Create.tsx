import React, { useEffect, useRef, useState } from 'react';
import { MdContentCopy, MdOutlineEdit, MdOutlineTaskAlt } from 'react-icons/md';
import ExchangeModal from '../components/Purchase/ExchangeModal';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import confirmModalStyles from '../components/CommonModal/ConfirmModal.module.css';
import { RiAccountCircleLine } from 'react-icons/ri';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Create.module.css';
import AppPageShell from '../components/Layout/AppPageShell';
import FooterArea from '../components/Layout/FooterArea';
import RechargeModal from '../components/Purchase/RechargeModal';
import RechargeSuccessReceipt from '../components/Purchase/RechargeSuccessReceipt';
import ProfileFunctionPanel from '../components/Profile/ProfileFunctionPanel';
import VipStatusModal from '../components/Profile/VipStatusModal';
import InviteCampaignCard from '../components/Profile/InviteCampaignCard';
import ProfilePreferenceModal from '../components/ProfilePreferenceModal';
import { useAuthStore } from '../store/useAuthStore';
import { useProfileIdentityEdit } from '../hooks/useProfileIdentityEdit';
import statisticsApi from '../api/statistics/statisticsApi';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { auth } from '../api/account/authApi';
import { getApiErrorMessage } from '../utils/error';
import { copyTextToClipboard } from '../utils/clipboard';
import { getImageUrl } from '../utils/constants';
import { getGenderSymbol, normalizeGender } from '../utils/profileCompletion';
import { formatKk } from '../utils/kkMoney';
import { hasActiveVip } from '../lib/membershipStatus';
import {
    parseOverseasPayReturnSearch,
    resolveOverseasPayReturnStatus,
} from '../lib/overseasPayReturn';
import { parseAlipayReturnSearch } from '../lib/alipayPayReturn';
import { clearRechargeReceiptFromStorage, readRechargeReceiptFromStorage } from '../lib/rechargeReceipt';
import type { RechargeReceipt } from '../lib/rechargeReceipt';
import accountSocialApi from '../api/account/accountSocialApi';

type CreatorStatsIncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';

const Create: React.FC = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();
    const {
        isUploadingAvatar,
        avatarInputRef,
        openAvatarPicker,
        handleAvatarFileChange,
        openEditNickname,
        identityEditModal,
    } = useProfileIdentityEdit();

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
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [returnedRechargeReceipt, setReturnedRechargeReceipt] = useState<{ outTradeNo: string; receipt: RechargeReceipt } | null>(null);
    const [isMembershipRechargeModalOpen, setIsMembershipRechargeModalOpen] = useState(false);
    const [isVipStatusModalOpen, setIsVipStatusModalOpen] = useState(false);
    const [streakDays, setStreakDays] = useState(0);
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettleDiamondsModalOpen, setIsSettleDiamondsModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);
    const [isEarningsModalOpen, setIsEarningsModalOpen] = useState(false);
    const [isProfilePreferenceOpen, setIsProfilePreferenceOpen] = useState(false);
    const [followingCount, setFollowingCount] = useState(0);
    const [followersCount, setFollowersCount] = useState(0);
    const overseasPayReturnHandledRef = useRef(false);
    const alipayReturnHandledRef = useRef(false);

    const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
    const userCode = user?.user?.userCode;
    const normalizedGender = normalizeGender(user?.user?.gender);
    const genderSymbol = getGenderSymbol(normalizedGender);
    const debugToken = user?.user?.debugToken;
    const truncatedDebugToken = debugToken ? `${debugToken.slice(0, 8)}...` : null;
    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const membership = user?.user?.membership;
    const isVipActive = hasActiveVip(membership);
    const isPromotionPartner = Boolean(user?.user?.userSegment && user.user.userSegment !== 'normal');
    const isWorkIncentive = stats.incentiveType === 'incentive' || stats.incentiveType === 'game_incentive' || stats.incentiveType === 'all_incentive';
    const isCodeIncentive = stats.incentiveType === 'code_incentive' || stats.incentiveType === 'all_incentive';
    const hasExtraEarnings = isWorkIncentive || isCodeIncentive;

    const formatEarningsValue = (value: number) => (Number(value) || 0).toLocaleString('zh-CN');

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
        getGameTotalStats();
        getUserInfo();
        getSignInStreak();
    }, [user?.user?.id]);

    useEffect(() => {
        if (!userCode) {
            setFollowingCount(0);
            setFollowersCount(0);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const response = await accountSocialApi.getProfile(userCode);
                if (cancelled || !response.data.success || !response.data.data) return;
                setFollowingCount(response.data.data.followingCount ?? 0);
                setFollowersCount(response.data.data.followersCount ?? 0);
            } catch {
                /* keep following/followers at 0 */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userCode]);

    // 功能注释：海外收银台回站后查单并 Toast，不再只打开空白充值弹窗
    useEffect(() => {
        const parsed = parseOverseasPayReturnSearch(location.search);
        if (!parsed.handled || overseasPayReturnHandledRef.current) return;
        overseasPayReturnHandledRef.current = true;
        navigate(
            { pathname: location.pathname, search: parsed.nextSearch ? `?${parsed.nextSearch}` : '' },
            { replace: true },
        );
        void (async () => {
            const status = await resolveOverseasPayReturnStatus(
                parsed.outTradeNo,
                async (outTradeNo) => {
                    const response = await payApi.checkPayStatus(outTradeNo);
                    return response.data?.data;
                },
            );
            if (status === 'paid') {
                await getUserInfo();
                const userId = useAuthStore.getState().user?.user.userId;
                const receipt = userId
                    ? readRechargeReceiptFromStorage(sessionStorage, userId, parsed.outTradeNo)?.receipt
                    : null;
                if (receipt) setReturnedRechargeReceipt({ outTradeNo: parsed.outTradeNo, receipt });
                else toast.success(t('rechargeModal.overseasPaySuccess'));
                return;
            }
            if (status === 'failed') {
                toast.error(t('rechargeModal.overseasPayFailed'));
                return;
            }
            toast(t('rechargeModal.overseasPayPending'));
        })();
    }, [location.pathname, location.search, navigate, t]);

    useEffect(() => {
        const parsed = parseAlipayReturnSearch(location.search);
        if (!parsed.handled || alipayReturnHandledRef.current) return;
        alipayReturnHandledRef.current = true;
        navigate(
            { pathname: location.pathname, search: parsed.nextSearch ? '?' + parsed.nextSearch : '' },
            { replace: true },
        );
        void (async () => {
            const status = await resolveOverseasPayReturnStatus(parsed.outTradeNo, async (outTradeNo) => {
                const response = await payApi.checkPayStatus(outTradeNo);
                return response.data?.data;
            });
            if (status === 'paid') {
                await getUserInfo();
                const userId = useAuthStore.getState().user?.user.userId;
                const receipt = userId
                    ? readRechargeReceiptFromStorage(sessionStorage, userId, parsed.outTradeNo)?.receipt
                    : null;
                if (receipt) setReturnedRechargeReceipt({ outTradeNo: parsed.outTradeNo, receipt });
                else toast.success(t('rechargeModal.overseasPaySuccess'));
            } else if (status === 'failed') {
                toast.error(t('rechargeModal.overseasPayFailed'));
            } else {
                toast(t('rechargeModal.alipayPayPending'));
            }
        })();
    }, [location.pathname, location.search, navigate, t]);

    const handleOpenSocialList = (tab: 'following' | 'followers') => {
        if (!userCode) {
            toast.error(t('create.previewHomepageNoCode'));
            return;
        }
        navigate(`/account/${encodeURIComponent(userCode)}/social?tab=${tab}`);
    };

    const handleCopyUserCode = async () => {
        if (!userCode) return;

        try {
            await copyTextToClipboard(userCode);
            toast.success(t('create.kuranIdCopied'));
        } catch (error) {
            console.error('复制 Kuran 号失败:', error);
            toast.error(t('create.copyFailed'));
        }
    };

    const handleCopyDebugToken = async () => {
        if (!debugToken) return;

        try {
            await copyTextToClipboard(debugToken);
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

    const handleSettle = async () => {
        if (isSettling) return;
        setIsSettling(true);
        try {
            const response = await auth.settlePoints('points');
            if (!response.data.success || !response.data.data) {
                toast.error(response.data.message || t('create.settleFailed'));
                return;
            }
            const pointsAmount = response.data.data.pointsSettled || 0;
            const diamondsAmount = response.data.data.diamondsSettled || 0;
            const successMsg = pointsAmount > 0 && diamondsAmount > 0
                ? t('create.settleSuccessDual', { points: pointsAmount, diamonds: diamondsAmount })
                : pointsAmount > 0
                    ? t('create.settleSuccess', { amount: pointsAmount })
                    : diamondsAmount > 0
                        ? t('create.settleSuccessDiamonds', { amount: diamondsAmount })
                        : t('create.settleSuccessZero');
            toast.success(successMsg);
            await Promise.all([getGameTotalStats(), getUserInfo()]);
            setIsSettleModalOpen(false);
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
            if (!response.data.success || !response.data.data) {
                toast.error(response.data.message || t('create.settleFailed'));
                return;
            }
            const amount = response.data.data.diamondsSettled || 0;
            toast.success(amount > 0
                ? t('create.settleSuccessDiamonds', { amount })
                : t('create.settleSuccessZero'));
            await Promise.all([getGameTotalStats(), getUserInfo()]);
            setIsSettleDiamondsModalOpen(false);
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('create.settleFailed')));
        } finally {
            setIsSettling(false);
        }
    };

    return (
        <>
        <AppPageShell shellClassName={styles.pageRoot} mainClassName={styles.mainContent}>
                <div className={styles.main}>
                    <div className={styles.creatorHeroSection}>
                        <div className={styles.creatorHeroCard}>
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
                                            key={userAvatar}
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
                                        <div className={styles.creatorHeroIdGroup}>
                                            <span className={styles.creatorHeroId}>
                                                {t('create.idPrefix')}{userCode || '--'}
                                            </span>
                                            {userCode && (
                                                <button
                                                    type="button"
                                                    className={styles.creatorCopyLink}
                                                    onClick={handleCopyUserCode}
                                                    aria-label={t('create.copy')}
                                                    title={t('create.copy')}
                                                >
                                                    <MdContentCopy aria-hidden="true" />
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.creatorHeroBadgeRow}>
                                            <button
                                                type="button"
                                                className={`${styles.creatorVipBadge} ${!isVipActive ? styles.creatorVipBadgeInactive : ''}`}
                                                onClick={() => setIsVipStatusModalOpen(true)}
                                                aria-label="查看VIP会员状态与福利"
                                                title="查看VIP会员状态与福利"
                                            >
                                                VIP
                                            </button>
                                            {isPromotionPartner && (
                                                <span className={styles.creatorRoleBadge}>推广者</span>
                                            )}
                                        </div>
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
                                                aria-label={t('create.copy')}
                                                title={t('create.copy')}
                                            >
                                                <MdContentCopy aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.creatorSocialRow}>
                                        <div className={styles.creatorSocialStats}>
                                            <button
                                                type="button"
                                                className={styles.creatorSocialItem}
                                                onClick={() => handleOpenSocialList('following')}
                                            >
                                                <span className={styles.creatorSocialLabel}>{t('create.followingLabel')}</span>
                                                <span className={styles.creatorSocialValue}>{followingCount}</span>
                                            </button>
                                            <span className={styles.creatorSocialDivider} aria-hidden="true" />
                                            <button
                                                type="button"
                                                className={styles.creatorSocialItem}
                                                onClick={() => handleOpenSocialList('followers')}
                                            >
                                                <span className={styles.creatorSocialLabel}>{t('create.followersLabel')}</span>
                                                <span className={styles.creatorSocialValue}>{followersCount}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.creatorHeroStats}>
                                <div className={styles.primaryStatsBar}>
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
                                        <div className={styles.primaryStatValue}>
                                            {formatKk(user?.user?.kkBalance?.total ?? user?.user?.diamonds ?? 0)}
                                        </div>
                                        <div className={styles.primaryStatLabel}>
                                            KK币（含{formatKk(user?.user?.kkBalance?.limited ?? 0)}限时KK币）
                                        </div>
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
                                    <div className={styles.primaryStatItem}>
                                        <div className={styles.primaryStatValue}>{stats.totalCreated}</div>
                                        <div className={styles.primaryStatLabel}>{t('create.totalCreated')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.accountPanel}>
                            <div className={styles.accountPanelTitle}>{t('create.myAccount')}</div>
                            <div className={styles.accountActionGrid}>
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
                                    onClick={() => navigate('/asset/details')}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <RiAccountCircleLine aria-hidden="true" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountDetails')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => navigate('/points/earn')}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <MdOutlineTaskAlt aria-hidden="true" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountEarnPoints')}</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => navigate('/create/incentives', { state: { returnTo: location.pathname } })}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/exchange.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountCreatorIncentive')}</span>
                                </button>
                            </div>
                        </div>
                        <InviteCampaignCard />
                        <ProfileFunctionPanel />
                    </div>

                </div>
            <FooterArea />
        </AppPageShell>

            <VipStatusModal
                isOpen={isVipStatusModalOpen}
                membership={membership}
                onClose={() => setIsVipStatusModalOpen(false)}
                onPurchase={() => {
                    setIsVipStatusModalOpen(false);
                    setIsMembershipRechargeModalOpen(true);
                }}
            />

            <RechargeModal
                isOpen={isRechargeModalOpen}
                onClose={() => setIsRechargeModalOpen(false)}
                onRecharge={handleRecharge}
            />
            {returnedRechargeReceipt && (
                <RechargeSuccessReceipt
                    receipt={returnedRechargeReceipt.receipt}
                    onReturn={() => {
                        if (user?.user?.userId) {
                            clearRechargeReceiptFromStorage(
                                sessionStorage,
                                user.user.userId,
                                returnedRechargeReceipt.outTradeNo,
                            );
                        }
                        setReturnedRechargeReceipt(null);
                        setIsRechargeModalOpen(true);
                    }}
                />
            )}
            <RechargeModal
                isOpen={isMembershipRechargeModalOpen}
                onClose={() => setIsMembershipRechargeModalOpen(false)}
                onRecharge={handleRecharge}
                fixedTab="membership"
            />
            <ExchangeModal
                isOpen={isExchangeModalOpen}
                onClose={() => setIsExchangeModalOpen(false)}
                onSuccess={() => {
                    void getUserInfo();
                }}
            />
            {isEarningsModalOpen && (
                <div
                    className={styles.earningsModalOverlay}
                    onClick={() => setIsEarningsModalOpen(false)}
                >
                    <div
                        className={styles.earningsModal}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('create.accountRewardSettlement')}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <button
                            type="button"
                            className={styles.earningsModalCloseBtn}
                            onClick={() => setIsEarningsModalOpen(false)}
                            aria-label={t('common.close')}
                        >
                            <span className={styles.earningsModalCloseIcon} aria-hidden="true" />
                        </button>
                        <h3 className={styles.earningsModalTitle}>{t('create.accountRewardSettlement')}</h3>
                        <div className={styles.earningsModalBody}>
                            <div className={styles.earningsModalPrimary}>
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
                            </div>
                            {hasExtraEarnings && (
                                <div className={styles.earningsModalExtra}>
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
            )}

            {identityEditModal}

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

            <ProfilePreferenceModal
                isOpen={isProfilePreferenceOpen}
                onClose={() => setIsProfilePreferenceOpen(false)}
                onSaved={() => setIsProfilePreferenceOpen(false)}
            />
        </>
    );
};

export default Create;
