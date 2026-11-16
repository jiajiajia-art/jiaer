import React from 'react';
import { useTranslation } from 'react-i18next';
import { IoChevronForward, IoHelpCircle } from 'react-icons/io5';
import type { CreatorEarningOverview } from '../../api/creatorEarnings/creatorEarningsApi';
import { formatCreatorShareRatio, formatYuan } from '../../lib/creatorEarningsView';
import styles from './CreatorEarnings.module.css';

interface Props {
    data: CreatorEarningOverview | null;
    loading: boolean;
    error: boolean;
    profileComplete: boolean;
    benefitLabel: string;
    editorShareRatio?: number;
    customShareRatio?: number;
    onRetry: () => void;
    onWithdraw: () => void;
    onProfile: () => void;
    onRecords: () => void;
    onRules: () => void;
}

const CreatorEarningsOverview: React.FC<Props> = ({
    data,
    loading,
    error,
    profileComplete,
    benefitLabel,
    editorShareRatio,
    customShareRatio,
    onRetry,
    onWithdraw,
    onProfile,
    onRecords,
    onRules,
}) => {
    const { t } = useTranslation();
    if (loading && !data) return <section className={styles.panel}><div className={styles.state}>{t('creatorCenter.loadingOverview')}</div></section>;
    if (error && !data) return (
        <section className={styles.panel}><div className={styles.state} role="alert">{t('creatorCenter.overviewLoadFailed')}<button type="button" onClick={onRetry}>{t('common.retry')}</button></div></section>
    );
    if (!data) return null;

    const { summary } = data;
    const available = Number(summary.availableGrossYuan);
    const reached = available >= Number(summary.minimumWithdrawYuan);
    const metrics = [
        { label: t('creatorCenter.pendingToday'), value: summary.pendingGrossYuan },
        { label: t('creatorCenter.frozen'), value: summary.frozenGrossYuan },
        { label: t('creatorCenter.paidNet'), value: summary.paidNetYuan },
        { label: t('creatorCenter.yesterday'), value: summary.yesterdayGrossYuan },
        { label: t('creatorCenter.month'), value: summary.monthGrossYuan },
        { label: t('creatorCenter.cumulativePretax'), value: summary.cumulativeGrossYuan },
    ];

    return (
        <section className={styles.panel} aria-labelledby="creator-earnings-overview-title">
            <div className={styles.overviewHeading}>
                <h2 id="creator-earnings-overview-title">{t('creatorCenter.overviewTitle')}</h2>
                <button type="button" className={styles.rulesButton} onClick={onRules}>
                    <span>{benefitLabel}</span>
                    {editorShareRatio !== undefined && customShareRatio !== undefined && (
                        <><i aria-hidden="true">·</i><span>TXT {formatCreatorShareRatio(editorShareRatio)} / {t('creatorCenter.customShort')} {formatCreatorShareRatio(customShareRatio)}</span></>
                    )}
                    <i aria-hidden="true">·</i><span>{t('creatorCenter.shareRules')}</span><IoHelpCircle aria-hidden="true" />
                </button>
            </div>
            {error && <button type="button" className={styles.textButton} onClick={onRetry}>{t('creatorCenter.refreshFailed')}</button>}

            <div className={styles.overviewHero}>
                <div className={styles.heroMeta}>
                    <span>{t('creatorCenter.withdrawable')}</span>
                    <strong>{reached ? t('creatorCenter.thresholdReached') : t('creatorCenter.thresholdPending')}</strong>
                </div>
                <b>{formatYuan(summary.availableGrossYuan)}</b>
            </div>

            <div className={styles.overviewMetrics}>
                {metrics.map((item) => (
                    <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{formatYuan(item.value)}</strong>
                    </div>
                ))}
            </div>

            <div className={styles.overviewActions}>
                <button type="button" onClick={onProfile} className={styles.profileAction}>
                    {t('creatorCenter.profile')}{!profileComplete && <span>{t('creatorCenter.profileIncomplete')}</span>}
                </button>
                <button type="button" onClick={onWithdraw} className={styles.withdrawAction}>
                    {data.activeWithdrawal ? t('creatorCenter.viewWithdrawal') : t('creatorCenter.requestWithdrawal')}
                </button>
            </div>

            <button type="button" onClick={onRecords} className={styles.recordsLink}>
                {t('creatorCenter.records')}<IoChevronForward aria-hidden="true" />
            </button>
        </section>
    );
};

export default CreatorEarningsOverview;
