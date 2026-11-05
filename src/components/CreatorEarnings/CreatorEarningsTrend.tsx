import React, { useState } from 'react';
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

const SERIES = {
    editor: { dataKey: 'editorGrossYuan', name: '编辑器作品', color: '#ff829e' },
    custom: { dataKey: 'customGrossYuan', name: '自定义作品', color: '#8f83ff' },
    sdk: { dataKey: 'sdkGrossYuan', name: 'SDK 外部应用', color: '#54d4b4' },
} as const;

const CreatorEarningsTrend: React.FC<Props> = ({
    data, loading, error, period, fileId, works,
    onPeriodChange, onFileChange, onRetry,
}) => {
    const visible = visibleTrendSeries(data);
    const ticks = buildCreatorTrendTicks(data.map((row) => row.bucket), period);
    const [workSelectOpen, setWorkSelectOpen] = useState(false);
    const selectedWorkTitle = fileId ? works.find((work) => work.fileId === fileId)?.title || fileId : '全部作品';
    return (
        <>
            <section className={styles.panel} aria-labelledby="creator-earnings-trend-title">
            <div className={styles.trendHeading}>
                <h2 id="creator-earnings-trend-title">收益趋势</h2>
                <span>单位：元（税前）</span>
                {error && <button type="button" className={styles.textButton} onClick={onRetry}>重试</button>}
            </div>
            <button type="button" className={styles.workFilter} onClick={() => setWorkSelectOpen(true)} aria-haspopup="dialog">
                <span>作品筛选</span>
                <strong>{selectedWorkTitle}<IoChevronDown aria-hidden="true" /></strong>
            </button>
            <div className={styles.trendControls}>
                <div className={`${styles.segmented} ${styles.periodControl}`} aria-label="时间范围">
                    {(['7d', '30d', '1y', 'all'] as const).map((value) => <button type="button" key={value} className={period === value ? styles.active : ''} onClick={() => onPeriodChange(value)}>{value === '7d' ? '近7日' : value === '30d' ? '近30日' : value === '1y' ? '近1年' : '累计'}</button>)}
                </div>
            </div>
            {loading && <div className={styles.chartWrap} aria-busy="true"><div className={styles.chartOverlay}>正在更新趋势…</div></div>}
            {!loading && (data.length === 0 || visible.length === 0) && (
                <div className={styles.chartEmptyCompact} role="status">
                    <IoStatsChartOutline aria-hidden="true" />
                    <strong>所选范围暂无收益</strong>
                    <span>产生收益后将在这里展示趋势</span>
                </div>
            )}
            {!loading && data.length > 0 && visible.length > 0 && (
                <div className={styles.chartWrap}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                            <XAxis dataKey="bucket" ticks={ticks} tickFormatter={(value) => formatCreatorTrendAxisDate(String(value), period)} stroke="#9b98aa" tickLine={false} axisLine={false} />
                            <YAxis stroke="#9b98aa" tickLine={false} axisLine={false} width={48} />
                            <Tooltip labelFormatter={(value) => formatCreatorTrendTooltipDate(String(value))} contentStyle={{ background: '#24202b', border: '1px solid #514959', borderRadius: 10 }} formatter={(value) => [`¥${Number(value).toFixed(2)}`, '']} />
                            <Legend />
                            {visible.map((key) => <Line key={key} type="monotone" dataKey={SERIES[key].dataKey} name={SERIES[key].name} stroke={SERIES[key].color} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />)}
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
