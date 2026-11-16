import React from 'react';
import { useTranslation } from 'react-i18next';
import { IoChevronForward } from 'react-icons/io5';
import type { CreatorWorkEarningAccount } from '../../api/creatorEarnings/creatorEarningsApi';
import { formatYuan } from '../../lib/creatorEarningsView';
import styles from './CreatorEarnings.module.css';

export type CreatorWorkEarningView = CreatorWorkEarningAccount & { title: string };

interface Props {
    data: CreatorWorkEarningView[];
    loading: boolean;
    error: boolean;
    onRetry: () => void;
    onDetails: (fileId: string) => void;
}

const CreatorWorkEarnings: React.FC<Props> = ({ data, loading, error, onRetry, onDetails }) => {
    const { t } = useTranslation();
    return (
    <section className={styles.panel} aria-labelledby="creator-work-earnings-title">
        <div className={styles.workHeading}>
            <h2 id="creator-work-earnings-title">{t('creatorCenter.worksTitle')}</h2>
            <span>{t('creatorCenter.workCount', { count: data.length })}</span>
        </div>
        {loading && <div className={styles.state}>{t('creatorCenter.worksLoading')}</div>}
        {error && <div className={styles.state} role="alert">{t('creatorCenter.worksLoadFailed')}<button type="button" onClick={onRetry}>{t('common.retry')}</button></div>}
        {!loading && !error && data.length === 0 && <div className={styles.state}>{t('creatorCenter.worksEmpty')}</div>}
        {!loading && !error && data.length > 0 && (
            <div className={styles.workList}>
                <div className={styles.workColumns} aria-hidden="true"><span>{t('creatorCenter.workColumn')}</span><span>{t('creatorCenter.detailColumn')}</span></div>
                {data.map((work) => (
                    <article className={styles.workItem} key={work.fileId}>
                        <div className={styles.workTitle}>
                            <strong>{work.title}</strong>
                            <div className={styles.workMeta}>
                                <span>{t('creatorCenter.chargedKk', { amount: work.chargedKkTotal })}</span>
                                <span>{t('creatorCenter.qualifiedKk', { amount: work.qualifiedKkTotal })}</span>
                            </div>
                        </div>
                        <div className={styles.workRevenueMetrics}>
                            <div className={styles.workRevenueMetric}>
                                <span>{t('creatorCenter.cumulativeEarning')}</span>
                                <strong>{formatYuan(work.cumulativeYuan)}</strong>
                            </div>
                            <div className={styles.workRevenueMetric}>
                                <span>{t('creatorCenter.paidEarning')}</span>
                                <strong>{formatYuan(work.paidYuan)}</strong>
                            </div>
                            <div className={styles.workRevenueMetric}>
                                <span>{t('creatorCenter.availableEarning')}</span>
                                <strong>{formatYuan(work.availableYuan)}</strong>
                            </div>
                        </div>
                        <button type="button" className={styles.workDetailsButton} onClick={() => onDetails(work.fileId)}>{t('creatorCenter.viewDetailsButton')}<IoChevronForward aria-hidden="true" /></button>
                    </article>
                ))}
            </div>
        )}
    </section>
    );
};

export default CreatorWorkEarnings;
