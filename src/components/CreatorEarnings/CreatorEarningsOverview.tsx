import React from 'react';
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
    if (loading && !data) return <section className={styles.panel}><div className={styles.state}>正在加载收益数据…</div></section>;
    if (error && !data) return (
        <section className={styles.panel}><div className={styles.state} role="alert">收益数据加载失败<button type="button" onClick={onRetry}>重试</button></div></section>
    );
    if (!data) return null;

    const { summary } = data;
    const available = Number(summary.availableGrossYuan);
    const reached = available >= Number(summary.minimumWithdrawYuan);
    const metrics = [
        { label: '今日待结算（税前）', value: summary.pendingGrossYuan },
        { label: '提现处理中（税前）', value: summary.frozenGrossYuan },
        { label: '已到账（实收）', value: summary.paidNetYuan },
        { label: '昨日', value: summary.yesterdayGrossYuan },
        { label: '本月', value: summary.monthGrossYuan },
        { label: '税前累计', value: summary.cumulativeGrossYuan },
    ];

    return (
        <section className={styles.panel} aria-labelledby="creator-earnings-overview-title">
            <div className={styles.overviewHeading}>
                <h2 id="creator-earnings-overview-title">收益总览</h2>
                <button type="button" className={styles.rulesButton} onClick={onRules}>
                    <span>{benefitLabel}</span>
                    {editorShareRatio !== undefined && customShareRatio !== undefined && (
                        <><i aria-hidden="true">·</i><span>TXT {formatCreatorShareRatio(editorShareRatio)} / 自定义 {formatCreatorShareRatio(customShareRatio)}</span></>
                    )}
                    <i aria-hidden="true">·</i><span>分成规则</span><IoHelpCircle aria-hidden="true" />
                </button>
            </div>
            {error && <button type="button" className={styles.textButton} onClick={onRetry}>刷新失败，点击重试</button>}

            <div className={styles.overviewHero}>
                <div className={styles.heroMeta}>
                    <span>可提现（税前）</span>
                    <strong>{reached ? '已满¥100，可申请提现' : '未满¥100，可兑换KK或继续累计'}</strong>
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
                    创作者资料{!profileComplete && <span>待完善</span>}
                </button>
                <button type="button" onClick={onWithdraw} className={styles.withdrawAction}>
                    {data.activeWithdrawal ? '查看提现状态' : '申请提现'}
                </button>
            </div>

            <button type="button" onClick={onRecords} className={styles.recordsLink}>
                收益与提现记录<IoChevronForward aria-hidden="true" />
            </button>
        </section>
    );
};

export default CreatorEarningsOverview;
