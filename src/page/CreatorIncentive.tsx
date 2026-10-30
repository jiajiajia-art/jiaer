import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import type { CreatorProfileData, CreatorProfileFormData } from '../components/CreatorProfile';
import CreatorEarningsOverview from '../components/CreatorEarnings/CreatorEarningsOverview';
import CreatorEarningsTrend from '../components/CreatorEarnings/CreatorEarningsTrend';
import CreatorWorkEarnings from '../components/CreatorEarnings/CreatorWorkEarnings';
import CreatorEarningsWithdrawalModal from '../components/CreatorEarnings/CreatorEarningsWithdrawalModal';
import CreatorEarningsRecordsModal from '../components/CreatorEarnings/CreatorEarningsRecordsModal';
import CreatorProfileModal from '../components/CreatorEarnings/CreatorProfileModal';
import CreatorBenefitRulesModal from '../components/CreatorBenefits/CreatorBenefitRulesModal';
import Navbar from '../components/Layout/Navbar';
import CenteredPageHeader from '../components/Layout/CenteredPageHeader';
import FooterArea from '../components/Layout/FooterArea';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import creatorEarningsApi, {
    type CreatorEarningOverview,
    type CreatorEarningPeriod,
    type CreatorWorkEarningAccount,
} from '../api/creatorEarnings/creatorEarningsApi';
import getGameDataApi from '../api/home/getGameData';
import type { UserGameData } from '../api/home/getGameData.type';
import statisticsApi from '../api/statistics/statisticsApi';
import { getCreatorProfile, saveCreatorProfile } from '../api/incentive/creatorProfileApi';
import { auth } from '../api/account/authApi';
import creatorBenefitsApi from '../api/creatorBenefits/creatorBenefitsApi';
import type { CreatorBenefitSummary } from '../api/creatorBenefits/creatorBenefits.type';
import { mergeCreatorWorkEarnings } from '../lib/creatorEarningsView';
import { useAuthStore } from '../store/useAuthStore';
import styles from './CreatorIncentive.module.css';

type LoadStatus = 'loading' | 'success' | 'error';
type IncentiveType = 'none' | 'incentive' | 'game_incentive' | 'code_incentive' | 'all_incentive';

interface PromotionStats {
    totalIncentiveAmount: number;
    pendingIncome: number;
    inviteTotalAmount: number;
    invitePendingIncome: number;
    incentiveType: IncentiveType;
}

const EMPTY_PROMOTION: PromotionStats = {
    totalIncentiveAmount: 0,
    pendingIncome: 0,
    inviteTotalAmount: 0,
    invitePendingIncome: 0,
    incentiveType: 'none',
};

const resolveCreatorCenterReturnPath = (state: unknown): '/profile' | '/create' => {
    const returnTo = (state as { returnTo?: unknown } | null)?.returnTo;
    return returnTo === '/profile' ? '/profile' : '/create';
};

const CreatorIncentive: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, updateUser } = useAuthStore();
    const userId = user?.user?.id;
    const isCreator = user?.user?.userSegment !== 'normal';

    const [overview, setOverview] = useState<CreatorEarningOverview | null>(null);
    const [overviewStatus, setOverviewStatus] = useState<LoadStatus>('loading');
    const [period, setPeriod] = useState<CreatorEarningPeriod>('30d');
    const [trendFileId, setTrendFileId] = useState('');
    const [earningAccounts, setEarningAccounts] = useState<CreatorWorkEarningAccount[]>([]);
    const [works, setWorks] = useState<UserGameData[]>([]);
    const [worksStatus, setWorksStatus] = useState<LoadStatus>('loading');
    const [profile, setProfile] = useState<CreatorProfileData>({});
    const [profileStatus, setProfileStatus] = useState<LoadStatus>('loading');
    const [promotion, setPromotion] = useState<PromotionStats>(EMPTY_PROMOTION);
    const [promotionStatus, setPromotionStatus] = useState<LoadStatus>('loading');
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [recordsOpen, setRecordsOpen] = useState(false);
    const [recordsFileId, setRecordsFileId] = useState('');
    const [rulesOpen, setRulesOpen] = useState(false);
    const [benefitSummary, setBenefitSummary] = useState<CreatorBenefitSummary | null>(null);

    const loadOverview = useCallback(async () => {
        if (!userId) return;
        setOverviewStatus('loading');
        try {
            setOverview(await creatorEarningsApi.getOverview({
                period,
                fileId: trendFileId || undefined,
            }));
            setOverviewStatus('success');
        } catch (error) {
            console.error('Load creator earning overview failed:', error);
            setOverviewStatus('error');
        }
    }, [period, trendFileId, userId]);

    const loadWorks = useCallback(async () => {
        if (!userId) return;
        setWorksStatus('loading');
        try {
            const [accounts, workResponse] = await Promise.all([
                creatorEarningsApi.listWorks({ limit: 100, offset: 0 }),
                getGameDataApi.getUserData({ limit: 100 }),
            ]);
            if (!workResponse.data.success) throw new Error('WORKS_LOAD_FAILED');
            setEarningAccounts(accounts);
            setWorks((workResponse.data.data || []).filter((work) => !work.needDeleted));
            setWorksStatus('success');
        } catch (error) {
            console.error('Load creator earning works failed:', error);
            setWorksStatus('error');
        }
    }, [userId]);

    const loadProfile = useCallback(async () => {
        if (!isCreator) return;
        setProfileStatus('loading');
        try {
            const data = await getCreatorProfile();
            setProfile({ ...data, phoneNumber: data.phoneNumber || user?.user?.phoneNumber || '' });
            setProfileStatus('success');
        } catch (error) {
            console.error('Load creator profile failed:', error);
            setProfileStatus('error');
        }
    }, [isCreator, user?.user?.phoneNumber]);

    const loadPromotion = useCallback(async () => {
        if (!userId) return;
        setPromotionStatus('loading');
        try {
            const response = await statisticsApi.getALLGameStats();
            if (!response.data.success || !response.data.data) throw new Error('PROMOTION_LOAD_FAILED');
            const data = response.data.data;
            setPromotion({
                totalIncentiveAmount: data.totalIncentiveAmount ?? 0,
                pendingIncome: data.pendingIncome ?? 0,
                inviteTotalAmount: data.inviteTotalAmount ?? 0,
                invitePendingIncome: data.invitePendingIncome ?? 0,
                incentiveType: data.incentiveType ?? 'none',
            });
            setPromotionStatus('success');
        } catch (error) {
            console.error('Load promotion incentives failed:', error);
            setPromotionStatus('error');
        }
    }, [userId]);

    const refreshAccount = useCallback(async () => {
        const response = await auth.getUserInfo();
        if (response.data.success && response.data.data) updateUser(response.data.data);
    }, [updateUser]);

    const loadBenefits = useCallback(async () => {
        if (!userId) return;
        try {
            const response = await creatorBenefitsApi.getSummary();
            if (response.data.success && response.data.data) setBenefitSummary(response.data.data);
        } catch (error) {
            console.error('Load creator benefit summary failed:', error);
        }
    }, [userId]);

    useEffect(() => { void loadOverview(); }, [loadOverview]);
    useEffect(() => { void loadWorks(); void loadPromotion(); }, [loadPromotion, loadWorks]);
    useEffect(() => { void loadProfile(); }, [loadProfile]);
    useEffect(() => { void loadBenefits(); }, [loadBenefits]);

    const profileComplete = useMemo(() => [
        profile.phoneNumber || user?.user?.phoneNumber,
        profile.realName,
        profile.idCard,
        profile.bankCard,
        profile.bankBranch,
    ].every((value) => Boolean(String(value || '').trim())), [profile, user?.user?.phoneNumber]);

    const workViews = useMemo(() => mergeCreatorWorkEarnings(earningAccounts, works), [earningAccounts, works]);
    const workTitles = useMemo(() => Object.fromEntries(workViews.map((work) => [work.fileId, work.title])), [workViews]);
    const trendWorks = useMemo(() => workViews.map((work) => ({ fileId: work.fileId, title: work.title })), [workViews]);
    const isWorkIncentive = ['incentive', 'game_incentive', 'all_incentive'].includes(promotion.incentiveType);
    const isCodeIncentive = ['code_incentive', 'all_incentive'].includes(promotion.incentiveType);
    const benefitLabel = benefitSummary?.isSpecialAuthor
        ? benefitSummary.label || '特邀'
        : benefitSummary?.level ? `Lv.${benefitSummary.level}` : '等级—';
    const formatValue = (value: number) => (Number(value) || 0).toLocaleString('zh-CN');

    const handlePeriodChange = (value: CreatorEarningPeriod) => setPeriod(value);
    const handleRecords = (fileId = '') => { setRecordsFileId(fileId); setRecordsOpen(true); };
    const refreshEarnings = async () => { await Promise.all([loadOverview(), loadWorks(), refreshAccount()]); };

    return (
        <div className={styles.pageRoot}>
            <div className={styles.desktopChrome}><Navbar /></div>
            <main className={styles.mainContent}>
                <div className={styles.dashboard}>
                    <CenteredPageHeader
                        title="创作者中心"
                        backLabel={t('create.incentiveBack')}
                        onBack={() => navigate(resolveCreatorCenterReturnPath(location.state))}
                    />

                    <CreatorEarningsOverview data={overview} loading={overviewStatus === 'loading'} error={overviewStatus === 'error'} profileComplete={profileComplete} benefitLabel={benefitLabel} editorShareRatio={benefitSummary?.editorShareRatio} customShareRatio={benefitSummary?.customShareRatio} onRetry={() => void loadOverview()} onWithdraw={() => setWithdrawOpen(true)} onProfile={() => setProfileOpen(true)} onRecords={() => handleRecords()} onRules={() => setRulesOpen(true)} />
                    <CreatorEarningsTrend data={overview?.trend || []} loading={overviewStatus === 'loading'} error={overviewStatus === 'error'} period={period} fileId={trendFileId} works={trendWorks} onPeriodChange={handlePeriodChange} onFileChange={setTrendFileId} onRetry={() => void loadOverview()} />
                    <CreatorWorkEarnings data={workViews} loading={worksStatus === 'loading'} error={worksStatus === 'error'} onRetry={() => void loadWorks()} onDetails={handleRecords} />

                    <section className={`${styles.panel} ${styles.promotionPanel}`} aria-labelledby="promotion-incentive-title">
                        <div className={styles.sectionHeader}><div><h2 id="promotion-incentive-title">{t('create.promotionIncentiveTitle')}</h2><p>{t('create.promotionIncentiveHint')}</p></div></div>
                        {promotionStatus === 'loading' && <div className={styles.stateBox}>正在加载推广激励…</div>}
                        {promotionStatus === 'error' && <div className={styles.stateBox} role="alert"><span>{t('create.incentiveStatsLoadFailed')}</span><button type="button" onClick={() => void loadPromotion()}>{t('create.incentiveRetry')}</button></div>}
                        {promotionStatus === 'success' && (isWorkIncentive || isCodeIncentive) && (
                            <div className={styles.settlementGrid}>
                                {isWorkIncentive && <article className={styles.settlementCard}><span className={styles.cardLabel}>{t('create.totalIncentiveEarnings')}</span><span className={styles.amountGroup}><strong>{formatValue(promotion.totalIncentiveAmount)}</strong></span><span className={styles.cardSubvalue}>{t('create.pendingIncentiveEarnings')}: {formatValue(promotion.pendingIncome)}</span></article>}
                                {isCodeIncentive && <article className={styles.settlementCard}><span className={styles.cardLabel}>{t('create.inviteCodeTotalEarnings')}</span><span className={styles.amountGroup}><strong>{formatValue(promotion.inviteTotalAmount)}</strong></span><span className={styles.cardSubvalue}>{t('create.inviteCodePendingEarnings')}: {formatValue(promotion.invitePendingIncome)}</span></article>}
                            </div>
                        )}
                        {promotionStatus === 'success' && !isWorkIncentive && !isCodeIncentive && <div className={styles.promotionEmpty}>{t('create.promotionIncentiveEmpty')}</div>}
                    </section>
                </div>
            </main>

            <div className={styles.desktopChrome}><MobileBottomNav /><FooterArea /></div>
            <CreatorEarningsWithdrawalModal
                open={withdrawOpen}
                overview={overview}
                profileComplete={profileComplete}
                workTitles={workTitles}
                bankCard={profile.bankCard}
                bankBranch={profile.bankBranch}
                onClose={() => setWithdrawOpen(false)}
                onOpenProfile={() => { setWithdrawOpen(false); setProfileOpen(true); }}
                onSuccess={refreshEarnings}
            />
            {recordsOpen && <CreatorEarningsRecordsModal open initialFileId={recordsFileId} workTitles={workTitles} onClose={() => setRecordsOpen(false)} />}
            <CreatorProfileModal open={profileOpen} data={profile} loading={profileStatus === 'loading'} error={profileStatus === 'error'} onRetry={() => void loadProfile()} onClose={() => setProfileOpen(false)} onSave={async (data: CreatorProfileFormData) => { const saved = await saveCreatorProfile(data); setProfile({ ...data, ...saved }); setProfileStatus('success'); }} />
            <CreatorBenefitRulesModal open={rulesOpen} currentLevel={benefitSummary?.level} isSpecialAuthor={benefitSummary?.isSpecialAuthor} onClose={() => setRulesOpen(false)} />
        </div>
    );
};

export default CreatorIncentive;
