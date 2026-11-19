import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IoChevronDown, IoStatsChartOutline } from 'react-icons/io5';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type {
    CreatorEarningPeriod,
    CreatorEarningTrendPoint,
} from '../../api/creatorEarnings/creatorEarningsApi';
import {
    buildCreatorTrendTicks,
    formatCreatorTrendAxisDate,
    formatCreatorTrendTooltipDate,
    visibleTrendSeries,
} from '../../lib/creatorEarningsView';
import CreatorWorkSelectModal from './CreatorWorkSelectModal';
import styles from './CreatorEarnings.module.css';

interface WorkOption { fileId: string; title: string }
interface Props {
    data: CreatorEarningTrendPoint[];
    loading: boolean;
    error: boolean;
    period: CreatorEarningPeriod;
    fileId: string;
    works: WorkOption[];
    onPeriodChange: (value: CreatorEarningPeriod) => void;
    onFileChange: (value: string) => void;
    onRetry: () => void;
}

const CreatorEarningsTrend: React.FC<Props> = ({
    data, loading, error, period, fileId, works,
    onPeriodChange, onFileChange, onRetry,
}) => {
    const { t } = useTranslation();
    const visible = visibleTrendSeries(data);
    const ticks = buildCreatorTrendTicks(data.map((row) => row.bucket), period);
    const [workSelectOpen, setWorkSelectOpen] = useState(false);
    const selectedWorkTitle = fileId ? works.find((work) => work.fileId === fileId)?.title || fileId : t('creatorCenter.allWorks');
    const series = {
        editor: { dataKey: 'editorGrossYuan', name: t('creatorCenter.seriesEditor'), color: 'var(--color-primary-light)' },
        custom: { dataKey: 'customGrossYuan', name: t('creatorCenter.seriesCustom'), color: 'var(--color-info)' },
        sdk: { dataKey: 'sdkGrossYuan', name: t('creatorCenter.seriesSdk'), color: 'var(--color-success)' },
    } as const;
    const periodLabel = (value: CreatorEarningPeriod) => (
        value === '7d' ? t('creatorCenter.period7')
            : value === '30d' ? t('creatorCenter.period30')
                : value === '1y' ? t('creatorCenter.period1y')
                    : t('creatorCenter.periodAll')
    );
    return (
        <>
            <section className={styles.panel} aria-labelledby="creator-earnings-trend-title">
            <div className={styles.trendHeading}>
                <h2 id="creator-earnings-trend-title">{t('creatorCenter.trendTitle')}</h2>
                <span>{t('creatorCenter.unitPretax')}</span>
                {error && <button type="button" className={styles.textButton} onClick={onRetry}>{t('common.retry')}</button>}
            </div>
            <button type="button" className={styles.workFilter} onClick={() => setWorkSelectOpen(true)} aria-haspopup="dialog">
                <span>{t('creatorCenter.filterWorks')}</span>
                <strong>{selectedWorkTitle}<IoChevronDown aria-hidden="true" /></strong>
            </button>
            <div className={styles.trendControls}>
                <div className={`${styles.segmented} ${styles.periodControl}`} aria-label={t('creatorCenter.periodAria')}>
                    {(['7d', '30d', '1y', 'all'] as const).map((value) => <button type="button" key={value} className={period === value ? styles.active : ''} onClick={() => onPeriodChange(value)}>{periodLabel(value)}</button>)}
                </div>
            </div>
            {loading && <div className={styles.chartWrap} aria-busy="true"><div className={styles.chartOverlay}>{t('creatorCenter.trendUpdating')}</div></div>}
            {!loading && (data.length === 0 || visible.length === 0) && (
                <div className={styles.chartEmptyCompact} role="status">
                    <IoStatsChartOutline aria-hidden="true" />
                    <strong>{t('creatorCenter.trendEmptyTitle')}</strong>
                    <span>{t('creatorCenter.trendEmptyHint')}</span>
                </div>
            )}
            {!loading && data.length > 0 && visible.length > 0 && (
                <div className={styles.chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke="color-mix(in srgb, var(--color-text) 8%, transparent)" vertical={false} />
                            <XAxis dataKey="bucket" ticks={ticks} tickFormatter={(value) => formatCreatorTrendAxisDate(String(value), period)} stroke="var(--color-text-secondary)" tickLine={false} axisLine={false} />
                            <YAxis stroke="var(--color-text-secondary)" tickLine={false} axisLine={false} width={48} />
                            <Tooltip labelFormatter={(value) => formatCreatorTrendTooltipDate(String(value))} contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 10 }} formatter={(value) => [`¥${Number(value).toFixed(2)}`, '']} />
                            <Legend />
                            {visible.map((key) => <Line key={key} type="monotone" dataKey={series[key].dataKey} name={series[key].name} stroke={series[key].color} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />)}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
            </section>
            <CreatorWorkSelectModal
                open={workSelectOpen}
                value={fileId}
                works={works}
                onClose={() => setWorkSelectOpen(false)}
                onConfirm={(value) => {
                    onFileChange(value);
                    setWorkSelectOpen(false);
                }}
            />
        </>
    );
};

export default CreatorEarningsTrend;
