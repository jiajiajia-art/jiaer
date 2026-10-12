import React, { useEffect, useRef, useState } from 'react';
import { IoChevronDown } from 'react-icons/io5';
import { MdContentCopy, MdOutlineEdit } from 'react-icons/md';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import styles from './Create.module.css';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import RechargeModal from '../components/Purchase/RechargeModal';
import ExchangeModal from '../components/Purchase/ExchangeModal';
import CreatorWorksPanel from '../components/Create/CreatorWorksPanel';
import ProfileFunctionPanel from '../components/Profile/ProfileFunctionPanel';
import InviteCampaignCard from '../components/Profile/InviteCampaignCard';
import TodayEarnPointsPanel from '../components/Profile/TodayEarnPointsPanel';
import ProfilePreferenceModal from '../components/ProfilePreferenceModal';
import { useAuthStore } from '../store/useAuthStore';
import statisticsApi from '../api/statistics/statisticsApi';
import creatorStatsApi, { type StatsOverview } from '../api/stats/creatorStatsApi';
import creatorBenefitsApi from '../api/creatorBenefits/creatorBenefitsApi';
import type { CreatorBenefitSummary } from '../api/creatorBenefits/creatorBenefits.type';
import payApi from '../api/pay/payApi';
import type { PayOrderRequest } from '../api/pay/pay.type';
import { auth } from '../api/account/authApi';
import { getApiErrorMessage } from '../utils/error';
import { getImageUrl } from '../utils/constants';
import { getGenderSymbol, normalizeGender } from '../utils/profileCompletion';
import {
    parseOverseasPayReturnSearch,
    resolveOverseasPayReturnStatus,
} from '../lib/overseasPayReturn';

const NICKNAME_MAX_LENGTH = 20;
const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

type CreatorStatsIncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';

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
    const location = useLocation();

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
    const [creatorBenefits, setCreatorBenefits] = useState<CreatorBenefitSummary | null>(null);
    const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
    const [isMembershipRechargeModalOpen, setIsMembershipRechargeModalOpen] = useState(false);
    const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);
    const [streakDays, setStreakDays] = useState(0);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    const [isEditNicknameOpen, setIsEditNicknameOpen] = useState(false);
    const [isProfilePreferenceOpen, setIsProfilePreferenceOpen] = useState(false);
    const [nicknameDraft, setNicknameDraft] = useState('');
    const [isSavingNickname, setIsSavingNickname] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const overseasPayReturnHandledRef = useRef(false);

    const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
    const userCode = user?.user?.userCode;
    const normalizedGender = normalizeGender(user?.user?.gender);
    const genderSymbol = getGenderSymbol(normalizedGender);
    const debugToken = user?.user?.debugToken;
    const truncatedDebugToken = debugToken ? `${debugToken.slice(0, 8)}...` : null;
    const userAvatar = getImageUrl(user?.user?.avatarUrl) || `${import.meta.env.BASE_URL}data/assets/defaultAvatar.png`;
    const isMember = Boolean(user?.user?.isMember);
    const isPromotionPartner = Boolean(user?.user?.userSegment && user.user.userSegment !== 'normal');
    const isWorkIncentive = stats.incentiveType === 'incentive' || stats.incentiveType === 'game_incentive' || stats.incentiveType === 'all_incentive';

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

    const getCreatorBenefits = async () => {
        if (!user?.user?.id) return;
        try {
            const response = await creatorBenefitsApi.getSummary();
            if (response.data.success && response.data.data) {
                setCreatorBenefits(response.data.data);
            }
        } catch (error) {
            console.error('Load creator benefits failed:', error);
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
        getCreatorOverviewStats();
        getCreatorBenefits();
        getUserInfo();
        getSignInStreak();
    }, [user?.user?.id]);

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
                toast.success(t('rechargeModal.overseasPaySuccess'));
                await getUserInfo();
                return;
            }
            if (status === 'failed') {
                toast.error(t('rechargeModal.overseasPayFailed'));
                return;
            }
            toast(t('rechargeModal.overseasPayPending'));
        })();
    }, [location.pathname, location.search, navigate, t]);

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

    return (
        <div className={styles.pageRoot}>
            <Navbar />

            <div className={styles.mainContent}>
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
                                        {(isMember || isPromotionPartner || creatorBenefits) && (
                                            <div className={styles.creatorHeroBadgeRow}>
                                                {creatorBenefits && (
                                                    <button
                                                        type="button"
                                                        className={styles.creatorLevelBadge}
                                                        onClick={() => navigate('/creator-benefits')}
                                                    >
                                                        {creatorBenefits.label}
                                                    </button>
                                                )}
                                                {isMember && (
                                                    <span className={styles.creatorRoleBadge}>
                                                        {t('create.memberBadge')}
                                                    </span>
                                                )}
                                                {isPromotionPartner && (
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
                                                aria-label={t('create.copy')}
                                                title={t('create.copy')}
                                            >
                                                <MdContentCopy aria-hidden="true" />
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
                                        <div className={styles.primaryStatValue}>{user?.user?.diamonds ?? 0}</div>
                                        <div className={styles.primaryStatLabel}>{t('create.diamondsStat')}</div>
                                    </div>
                                </div>

                                {!isStatsExpanded && (
                                    <button
                                        type="button"
                                        className={styles.statsExpandToggle}
                                        onClick={() => setIsStatsExpanded(true)}
                                        aria-expanded={false}
                                    >
                                        <span>{t('create.expandMoreStats')}</span>
                                        <IoChevronDown className={styles.statsExpandIcon} />
                                    </button>
                                )}

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

                            {isStatsExpanded && (
                                <button
                                    type="button"
                                    className={`${styles.statsExpandToggle} ${styles.statsExpandToggleFooter}`}
                                    onClick={() => setIsStatsExpanded(false)}
                                    aria-expanded={true}
                                >
                                    <span>{t('create.collapseMoreStats')}</span>
                                    <IoChevronDown
                                        className={`${styles.statsExpandIcon} ${styles.statsExpandIconOpen}`}
                                    />
                                </button>
                            )}
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
                                <button
                                    type="button"
                                    className={styles.accountActionItem}
                                    onClick={() => navigate('/create/incentives')}
                                >
                                    <span className={styles.accountActionIcon}>
                                        <img src={`${import.meta.env.BASE_URL}data/assetsv2/personal/exchange.svg`} alt="" />
                                    </span>
                                    <span className={styles.accountActionLabel}>{t('create.accountCreatorIncentive')}</span>
                                </button>
                            </div>
                        </div>
                        <InviteCampaignCard />
                        <TodayEarnPointsPanel />
                        <ProfileFunctionPanel />
                    </div>

                    <CreatorWorksPanel
                        mode="preview"
                        showIncentiveUI={isWorkIncentive}
                    />
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
            <ExchangeModal
                isOpen={isExchangeModalOpen}
                onClose={() => setIsExchangeModalOpen(false)}
                onSuccess={() => {
                    void getUserInfo();
                }}
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

            <ProfilePreferenceModal
                isOpen={isProfilePreferenceOpen}
                onClose={() => setIsProfilePreferenceOpen(false)}
                onSaved={() => setIsProfilePreferenceOpen(false)}
            />
        </div>
    );
};

export default Create;
