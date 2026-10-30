import React from 'react';
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

const CreatorWorkEarnings: React.FC<Props> = ({ data, loading, error, onRetry, onDetails }) => (
    <section className={styles.panel} aria-labelledby="creator-work-earnings-title">
        <div className={styles.workHeading}>
            <h2 id="creator-work-earnings-title">作品收益</h2>
            <span>共{data.length}款作品</span>
        </div>
        {loading && <div className={styles.state}>正在加载作品收益…</div>}
        {error && <div className={styles.state} role="alert">作品收益加载失败<button type="button" onClick={onRetry}>重试</button></div>}
        {!loading && !error && data.length === 0 && <div className={styles.state}>暂无作品收益记录</div>}
        {!loading && !error && data.length > 0 && (
            <div className={styles.workList}>
                <div className={styles.workColumns} aria-hidden="true"><span>作品</span><span>收益明细（税前）</span></div>
                {data.map((work) => (
                    <article className={styles.workItem} key={work.fileId}>
                        <div className={styles.workTitle}>
                            <strong>{work.title}</strong>
                            <div className={styles.workMeta}>
                                <span>总消费 {work.chargedKkTotal} KK币</span>
                                <span>参与分成 {work.qualifiedKkTotal} KK币</span>
                            </div>
                        </div>
                        <div className={styles.workRevenueMetrics}>
                            <div className={styles.workRevenueMetric}>
                                <span>累计收益</span>
                                <strong>{formatYuan(work.cumulativeYuan)}</strong>
                            </div>
                            <div className={styles.workRevenueMetric}>
                                <span>已提收益</span>
                                <strong>{formatYuan(work.paidYuan)}</strong>
                            </div>
                            <div className={styles.workRevenueMetric}>
                                <span>可提收益</span>
                                <strong>{formatYuan(work.availableYuan)}</strong>
                            </div>
                        </div>
                        <button type="button" className={styles.workDetailsButton} onClick={() => onDetails(work.fileId)}>查看明细<IoChevronForward aria-hidden="true" /></button>
                    </article>
                ))}
            </div>
        )}
    </section>
);

export default CreatorWorkEarnings;
