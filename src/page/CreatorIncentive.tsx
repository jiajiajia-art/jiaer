import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { IoArrowBack, IoChevronDown } from 'react-icons/io5';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import ConfirmModal from '../components/CommonModal/ConfirmModal';
import confirmModalStyles from '../components/CommonModal/ConfirmModal.module.css';
import WithdrawFlowModal from '../components/Create/WithdrawFlowModal';
import CreatorProfile, {
    type CreatorProfileData,
    type CreatorProfileFormData,
} from '../components/CreatorProfile';
import statisticsApi from '../api/statistics/statisticsApi';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import { auth } from '../api/account/authApi';
import { getCreatorProfile, saveCreatorProfile } from '../api/incentive/creatorProfileApi';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/error';
import styles from './CreatorIncentive.module.css';

type LoadStatus = 'loading' | 'success' | 'error';
type IncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';
type PeriodKey = '7d' | '30d' | '1y' | 'all';
type Granularity = 'daily' | 'monthly';

interface SettlementStats {
    totalAmount: number;
    totalDiamondsAmount: number;
    totalIncentiveAmount: number;
    pendingIncome: number;
    inviteTotalAmount: number;
    invitePendingIncome: number;
    incentiveType: IncentiveType;
}

const EMPTY_STATS: SettlementStats = {
    totalAmount: 0,
    totalDiamondsAmount: 0,
    totalIncentiveAmount: 0,
    pendingIncome: 0,
    inviteTotalAmount: 0,
    invitePendingIncome: 0,
    incentiveType: 'none',
};

const PERIODS: Array<{ key: PeriodKey; labelKey: string }> = [
    { key: '7d', labelKey: 'create.incentivePeriod7Days' },
    { key: '30d', labelKey: 'create.incentivePeriod30Days' },
    { key: '1y', labelKey: 'create.incentivePeriod1Year' },
    { key: 'all', labelKey: 'create.incentivePeriodAll' },
];

const CreatorIncentive: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [stats, setStats] = useState<SettlementStats>(EMPTY_STATS);
    const [settlementStatus, setSettlementStatus] = useState<LoadStatus>('loading');
    const [works, setWorks] = useState<UserGameData[]>([]);
    const [worksStatus, setWorksStatus] = useState<LoadStatus>('loading');
    const [profileData, setProfileData] = useState<CreatorProfileData>({});
    const [profileStatus, setProfileStatus] = useState<LoadStatus>('loading');
    const [isProfileExpanded, setIsProfileExpanded] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('30d');
    const [granularity, setGranularity] = useState<Granularity>('daily');
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
    const [isSettleDiamondsModalOpen, setIsSettleDiamondsModalOpen] = useState(false);
    const [isSettling, setIsSettling] = useState(false);

    const isCreator = user?.user?.userSegment !== 'normal';
    const isWorkIncentive = stats.incentiveType === 'incentive'
        || stats.incentiveType === 'game_incentive'
        || stats.incentiveType === 'all_incentive';
    const isCodeIncentive = stats.incentiveType === 'code_incentive'
        || stats.incentiveType === 'all_incentive';

    const formatValue = (value: number) => (Number(value) || 0).toLocaleString('zh-CN');

    const loadSettlement = useCallback(async () => {
        if (!user?.user?.id) return;

        setSettlementStatus('loading');
        try {
            const response = await statisticsApi.getALLGameStats();
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('create.incentiveStatsLoadFailed'));
            }
            const data = response.data.data;
            setStats({
                totalAmount: data.totalPointsAmount ?? 0,
                totalDiamondsAmount: data.totalDiamondsAmount ?? 0,
                totalIncentiveAmount: data.totalIncentiveAmount ?? 0,
                pendingIncome: data.pendingIncome ?? 0,
                inviteTotalAmount: data.inviteTotalAmount ?? 0,
                invitePendingIncome: data.invitePendingIncome ?? 0,
                incentiveType: data.incentiveType ?? 'none',
            });
            setSettlementStatus('success');
        } catch (error) {
            console.error('Load creator settlement failed:', error);
            setSettlementStatus('error');
        }
    }, [t, user?.user?.id]);

    const loadWorks = useCallback(async () => {
        if (!user?.user?.id) return;

        setWorksStatus('loading');
        try {
            const response = await getGameDataApi.getUserData({ limit: 100 });
            if (!response.data.success) {
                throw new Error(t('create.incentiveWorksLoadFailed'));
            }
            setWorks((response.data.data || []).filter((work) => !work.needDeleted));
            setWorksStatus('success');
        } catch (error) {
            console.error('Load creator works for incentives failed:', error);
            setWorks([]);
            setWorksStatus('error');
        }
    }, [t, user?.user?.id]);

    const loadProfile = useCallback(async () => {
        if (!isCreator) return;

        setProfileStatus('loading');
        try {
            const data = await getCreatorProfile();
            setProfileData({
                ...data,
                phoneNumber: data.phoneNumber || user?.user?.phoneNumber || '',
            });
            setProfileStatus('success');
        } catch (error) {
            console.error('Load creator profile failed:', error);
            setProfileStatus('error');
        }
    }, [isCreator, user?.user?.phoneNumber]);

    const refreshAccount = useCallback(async () => {
        const response = await auth.getUserInfo();
        if (response.data.success && response.data.data) {
            updateUser(response.data.data);
        }
    }, [updateUser]);

    useEffect(() => {
        void loadSettlement();
        void loadWorks();
    }, [loadSettlement, loadWorks]);

    useEffect(() => {
        if (isCreator) void loadProfile();
    }, [isCreator, loadProfile]);

    const profileComplete = useMemo(() => {
        const requiredValues = [
            profileData.phoneNumber || user?.user?.phoneNumber,
            profileData.realName,
            profileData.idCard,
            profileData.bankCard,
            profileData.bankBranch,
        ];
        return requiredValues.every((value) => Boolean(String(value || '').trim()));
    }, [profileData, user?.user?.phoneNumber]);

    const settlementSuccessMessage = (pointsAmount: number, diamondsAmount: number) => {
        if (pointsAmount > 0 && diamondsAmount > 0) {
            return t('create.settleSuccessDual', { points: pointsAmount, diamonds: diamondsAmount });
        }
        if (pointsAmount > 0) return t('create.settleSuccess', { amount: pointsAmount });
        if (diamondsAmount > 0) return t('create.settleSuccessDiamonds', { amount: diamondsAmount });
        return t('create.settleSuccessZero');
    };

    const handleSettle = async () => {
        if (isSettling) return;

        setIsSettling(true);
        try {
            const response = await auth.settlePoints('points');
            if (!response.data.success || !response.data.data) {
                throw new Error(response.data.message || t('create.settleFailed'));
            }
            const pointsAmount = response.data.data.pointsSettled || 0;
            const diamondsAmount = response.data.data.diamondsSettled || 0;
            toast.success(settlementSuccessMessage(pointsAmount, diamondsAmount));
            await Promise.all([loadSettlement(), refreshAccount()]);
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
                throw new Error(response.data.message || t('create.settleFailed'));
            }
            const diamondsAmount = response.data.data.diamondsSettled || 0;
            toast.success(settlementSuccessMessage(0, diamondsAmount));
            await Promise.all([loadSettlement(), refreshAccount()]);
            setIsSettleDiamondsModalOpen(false);
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, t('create.settleFailed')));
        } finally {
            setIsSettling(false);
        }
    };

    const handlePeriodChange = (period: PeriodKey) => {
        setSelectedPeriod(period);
        setGranularity(period === '1y' || period === 'all' ? 'monthly' : 'daily');
    };

    const workTypeLabel = (work: UserGameData) => {
        if (work.engine === 'AVG') return t('create.draftFilters.world');
        if (work.engine === 'CUSTOM') return t('create.draftFilters.custom');
        if (work.engine === 'IVG') return t('create.draftFilters.ivg');
        if (work.engine === 'NOVEL') return t('create.draftFilters.novel');
        return t('create.draftFilters.role-playing');
    };

    const selectedPeriodLabel = t(
        PERIODS.find((period) => period.key === selectedPeriod)?.labelKey || 'create.incentivePeriod30Days',
    );

    return (
        <div className={styles.pageRoot}>
            <Navbar />
            <main className={styles.mainContent}>
                <div className={styles.dashboard}>
                    <header className={styles.pageHeader}>
                        <button
                            type="button"
                            className={styles.backButton}
                            onClick={() => navigate('/create')}
                        >
                            <IoArrowBack aria-hidden="true" />
                            <span>{t('create.incentiveBack')}</span>
                        </button>
                        <div className={styles.headerCopy}>
                            <p className={styles.eyebrow}>{t('create.incentivePageEyebrow')}</p>
                            <h1>{t('create.incentivePageTitle')}</h1>
                            <p>{t('create.incentivePageSubtitle')}</p>
                        </div>
                    </header>

                    <section className={`${styles.panel} ${styles.settlementPanel}`} aria-labelledby="settlement-title">
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 id="settlement-title">{t('create.incentiveSettlementTitle')}</h2>
                                <p>{t('create.incentiveSettlementHint')}</p>
                            </div>
                            {isCreator && (
                                <button
                                    type="button"
                                    className={styles.withdrawButton}
                                    onClick={() => setIsWithdrawModalOpen(true)}
                                >
                                    {t('create.withdraw')}
                                </button>
                            )}
                        </div>

                        {settlementStatus === 'loading' && (
                            <div className={styles.stateBox} aria-live="polite">
                                {t('create.incentiveSettlementLoading')}
                            </div>
                        )}
                        {settlementStatus === 'error' && (
                            <div className={styles.stateBox} role="alert">
                                <span>{t('create.incentiveStatsLoadFailed')}</span>
                                <button type="button" onClick={() => void loadSettlement()}>
                                    {t('create.incentiveRetry')}
                                </button>
                            </div>
                        )}
                        {settlementStatus === 'success' && (
                            <div className={styles.settlementGrid} aria-busy={isSettling}>
                                <article className={styles.settlementCard}>
                                    <span className={styles.cardLabel}>{t('create.pendingRewardPoints')}</span>
                                    <strong>{formatValue(stats.totalAmount)}</strong>
                                    <span className={styles.cardUnit}>{t('create.pointsStat')}</span>
                                    {stats.totalAmount > 0 && (
                                        <button
                                            type="button"
                                            className={styles.settleButton}
                                            onClick={() => setIsSettleModalOpen(true)}
                                            disabled={isSettling}
                                        >
                                            {isSettling ? t('create.settling') : t('create.settle')}
                                        </button>
                                    )}
                                </article>
                                <article className={styles.settlementCard}>
                                    <span className={styles.cardLabel}>{t('create.pendingRewardDiamonds')}</span>
                                    <strong>{formatValue(stats.totalDiamondsAmount)}</strong>
                                    <span className={styles.cardUnit}>{t('create.diamondsStat')}</span>
                                    {stats.totalDiamondsAmount > 0 && (
                                        <button
                                            type="button"
                                            className={styles.settleButton}
                                            onClick={() => setIsSettleDiamondsModalOpen(true)}
                                            disabled={isSettling}
                                        >
                                            {isSettling ? t('create.settling') : t('create.settle')}
                                        </button>
                                    )}
                                </article>
                                {isWorkIncentive && (
                                    <article className={styles.settlementCard}>
                                        <span className={styles.cardLabel}>{t('create.totalIncentiveEarnings')}</span>
                                        <strong>{formatValue(stats.totalIncentiveAmount)}</strong>
                                        <span className={styles.cardSubvalue}>
                                            {t('create.pendingIncentiveEarnings')}: {formatValue(stats.pendingIncome)}
                                        </span>
                                    </article>
                                )}
                                {isCodeIncentive && (
                                    <article className={styles.settlementCard}>
                                        <span className={styles.cardLabel}>{t('create.inviteCodeTotalEarnings')}</span>
                                        <strong>{formatValue(stats.inviteTotalAmount)}</strong>
                                        <span className={styles.cardSubvalue}>
                                            {t('create.inviteCodePendingEarnings')}: {formatValue(stats.invitePendingIncome)}
                                        </span>
                                    </article>
                                )}
                            </div>
                        )}
                    </section>

                    <section className={styles.panel} data-testid="creator-incentive-overview" aria-labelledby="overview-title">
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 id="overview-title">{t('create.incentiveOverviewTitle')}</h2>
                                <p>{t('create.incentiveOverviewHint')}</p>
                            </div>
                        </div>
                        <div className={styles.periodGrid}>
                            {PERIODS.map((period) => (
                                <button
                                    key={period.key}
                                    type="button"
                                    className={`${styles.periodCard} ${selectedPeriod === period.key ? styles.periodCardActive : ''}`}
                                    onClick={() => handlePeriodChange(period.key)}
                                    aria-pressed={selectedPeriod === period.key}
                                >
                                    <span>{t(period.labelKey)}</span>
                                    <strong>{t('create.incentiveUnavailableAmount')}</strong>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className={styles.panel} data-testid="creator-incentive-chart" aria-labelledby="chart-title">
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 id="chart-title">{t('create.incentiveChartTitle')}</h2>
                                <p>{t('create.incentiveChartHint')}</p>
                            </div>
                            <div className={styles.segmentedControl} aria-label={t('create.incentiveGranularity')}>
                                <button
                                    type="button"
                                    className={granularity === 'daily' ? styles.segmentActive : ''}
                                    onClick={() => setGranularity('daily')}
                                    aria-pressed={granularity === 'daily'}
                                >
                                    {t('create.incentiveDaily')}
                                </button>
                                <button
                                    type="button"
                                    className={granularity === 'monthly' ? styles.segmentActive : ''}
                                    onClick={() => setGranularity('monthly')}
                                    aria-pressed={granularity === 'monthly'}
                                >
                                    {t('create.incentiveMonthly')}
                                </button>
                            </div>
                        </div>
                        <div
                            className={styles.chartPlaceholder}
                            role="img"
                            aria-label={t('create.incentiveChartAria', {
                                period: selectedPeriodLabel,
                                granularity: t(`create.incentive${granularity === 'daily' ? 'Daily' : 'Monthly'}`),
                            })}
                        >
                            <div className={styles.chartGrid} aria-hidden="true">
                                <span /><span /><span /><span />
                            </div>
                            <div className={styles.chartEmpty}>
                                <strong>{t('create.incentiveChartUnavailable')}</strong>
                                <span>{selectedPeriodLabel} · {t(`create.incentive${granularity === 'daily' ? 'Daily' : 'Monthly'}`)}</span>
                            </div>
                        </div>
                    </section>

                    <section className={styles.panel} data-testid="creator-incentive-works" aria-labelledby="works-title">
                        <div className={styles.sectionHeader}>
                            <div>
                                <h2 id="works-title">{t('create.incentiveWorksTitle')}</h2>
                                <p>{t('create.incentiveWorksHint')}</p>
                            </div>
                        </div>
                        {worksStatus === 'loading' && (
                            <div className={styles.stateBox} aria-live="polite">{t('create.incentiveWorksLoading')}</div>
                        )}
                        {worksStatus === 'error' && (
                            <div className={styles.stateBox} role="alert">
                                <span>{t('create.incentiveWorksLoadFailed')}</span>
                                <button type="button" onClick={() => void loadWorks()}>{t('create.incentiveRetry')}</button>
                            </div>
                        )}
                        {worksStatus === 'success' && works.length === 0 && (
                            <div className={styles.stateBox}>{t('create.incentiveWorksEmpty')}</div>
                        )}
                        {worksStatus === 'success' && works.length > 0 && (
                            <div className={styles.workList}>
                                {works.map((work) => (
                                    <article className={styles.workRow} key={work.file_id || work.id}>
                                        <div className={styles.workMeta}>
                                            <strong>{work.title || t('create.incentiveUntitledWork')}</strong>
                                            <span>{workTypeLabel(work)}</span>
                                        </div>
                                        <div className={styles.workAmount}>
                                            <strong>{t('create.incentiveUnavailableAmount')}</strong>
                                            <span>{t('create.incentiveDataPending')}</span>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    {isCreator && (
                        <section className={`${styles.panel} ${styles.profilePanel}`} aria-labelledby="profile-title">
                            <button
                                type="button"
                                className={styles.profileToggle}
                                onClick={() => setIsProfileExpanded((current) => !current)}
                                aria-expanded={isProfileExpanded}
                                aria-controls="creator-profile-content"
                            >
                                <span className={styles.profileHeading}>
                                    <strong id="profile-title">{t('profile.creatorProfile')}</strong>
                                    <span>{t('create.incentiveProfileHint')}</span>
                                </span>
                                <span className={styles.profileToggleMeta}>
                                    <span className={`${styles.profileStatus} ${profileComplete ? styles.profileStatusComplete : ''}`}>
                                        {profileStatus === 'loading'
                                            ? t('create.incentiveProfileLoading')
                                            : profileStatus === 'error'
                                                ? t('create.incentiveProfileLoadFailed')
                                                : profileComplete
                                                    ? t('create.incentiveProfileComplete')
                                                    : t('create.incentiveProfileIncomplete')}
                                    </span>
                                    <IoChevronDown
                                        className={isProfileExpanded ? styles.chevronOpen : ''}
                                        aria-hidden="true"
                                    />
                                </span>
                            </button>
                            {isProfileExpanded && (
                                <div className={styles.profileContent} id="creator-profile-content">
                                    {profileStatus === 'loading' && (
                                        <div className={styles.stateBox} aria-live="polite">
                                            {t('create.incentiveProfileLoading')}
                                        </div>
                                    )}
                                    {profileStatus === 'error' && (
                                        <div className={styles.stateBox} role="alert">
                                            <span>{t('create.incentiveProfileLoadFailed')}</span>
                                            <button type="button" onClick={() => void loadProfile()}>
                                                {t('create.incentiveRetry')}
                                            </button>
                                        </div>
                                    )}
                                    {profileStatus === 'success' && (
                                        <CreatorProfile
                                            data={profileData}
                                            onSave={async (data: CreatorProfileFormData) => {
                                                const saved = await saveCreatorProfile(data);
                                                setProfileData({ ...data, ...saved });
                                                setProfileStatus('success');
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </main>

            <MobileBottomNav />
            <FooterArea />

            <WithdrawFlowModal
                open={isWithdrawModalOpen}
                onClose={() => setIsWithdrawModalOpen(false)}
            />
            <ConfirmModal
                isOpen={isSettleModalOpen}
                onConfirm={handleSettle}
                onCancel={() => {
                    if (!isSettling) setIsSettleModalOpen(false);
                }}
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
                onCancel={() => {
                    if (!isSettling) setIsSettleDiamondsModalOpen(false);
                }}
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
        </div>
    );
};

export default CreatorIncentive;
