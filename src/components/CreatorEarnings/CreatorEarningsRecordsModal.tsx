import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import creatorEarningsApi, {
    type CreatorEarningLedgerItem,
    type CreatorEarningLedgerPage,
    type CreatorEarningWithdrawal,
} from '../../api/creatorEarnings/creatorEarningsApi';
import { formatYuan } from '../../lib/creatorEarningsView';
import CreatorEarningsModalShell from './CreatorEarningsModalShell';
import styles from './CreatorEarnings.module.css';

type Tab = 'ledger' | 'withdrawals';
interface Props {
    open: boolean;
    initialFileId?: string;
    workTitles: Record<string, string>;
    onClose: () => void;
}

const statusLabel: Record<string, string> = { pending: '审核中', approved: '待打款', paid: '已打款', rejected: '已驳回' };
const formatTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
const formatKk = (minor: number) => `${(minor / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KK`;

const CreatorLedgerCard: React.FC<{ item: CreatorEarningLedgerItem; title: string }> = ({ item, title }) => {
    return (
        <article className={styles.ledgerCard}>
            <header className={styles.ledgerSummary}>
                <div><strong>{title}</strong></div>
            </header>
            <div className={styles.ledgerAmounts}>
                <div><span>充值KK币收益</span><strong>{formatKk(item.rechargeKkMinorTotal)}</strong></div>
                <div><span>Token消耗成本</span><strong>{formatKk(item.tokenCostKkMinorTotal)}</strong></div>
            </div>
        </article>
    );
};

const CreatorEarningsRecordsModal: React.FC<Props> = ({ open, initialFileId = '', workTitles, onClose }) => {
    const [tab, setTab] = useState<Tab>('ledger');
    const [fileId, setFileId] = useState(initialFileId);
    const [page, setPage] = useState(1);
    const [ledger, setLedger] = useState<CreatorEarningLedgerPage | null>(null);
    const [withdrawals, setWithdrawals] = useState<CreatorEarningWithdrawal[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const requestVersionRef = useRef(0);

    useEffect(() => { if (open) { setFileId(initialFileId); setPage(1); setTab('ledger'); } }, [initialFileId, open]);
    const load = useCallback(async () => {
        if (!open) return;
        const requestVersion = ++requestVersionRef.current;
        setLoading(true); setError(false);
        try {
            if (tab === 'ledger') {
                const nextLedger = await creatorEarningsApi.listLedger({ fileId: fileId || undefined, page, pageSize: 20 });
                if (requestVersion === requestVersionRef.current) setLedger(nextLedger);
            } else {
                const nextWithdrawals = await creatorEarningsApi.listWithdrawals({ limit: 100, offset: 0 });
                if (requestVersion === requestVersionRef.current) setWithdrawals(nextWithdrawals);
            }
        } catch {
            if (requestVersion === requestVersionRef.current) setError(true);
        } finally {
            if (requestVersion === requestVersionRef.current) setLoading(false);
        }
    }, [fileId, open, page, tab]);
    useEffect(() => { void load(); }, [load]);
    const totalPages = Math.max(1, Math.ceil((ledger?.total || 0) / (ledger?.pageSize || 20)));
    const workOptions = useMemo(() => Object.entries(workTitles), [workTitles]);
    return (
        <CreatorEarningsModalShell open={open} title="收益与提现记录" onClose={onClose} wide>
            <div className={styles.recordTabs}><button type="button" className={tab === 'ledger' ? styles.active : ''} onClick={() => { setTab('ledger'); setPage(1); }}>收益明细</button><button type="button" className={tab === 'withdrawals' ? styles.active : ''} onClick={() => setTab('withdrawals')}>提现记录</button></div>
            {tab === 'ledger' && <select className={styles.recordFilter} value={fileId} onChange={(event) => { setFileId(event.target.value); setPage(1); }} aria-label="筛选作品"><option value="">全部作品</option>{workOptions.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select>}
            {loading && <div className={styles.state}>正在加载记录…</div>}
            {error && <div className={styles.state} role="alert">记录加载失败<button type="button" onClick={() => void load()}>重试</button></div>}
            {!loading && !error && tab === 'ledger' && (
                <><div className={styles.ledgerList}>{ledger?.items.map((item) => <CreatorLedgerCard key={item.fileId} item={item} title={workTitles[item.fileId] || item.fileId} />)}</div>{(ledger?.items.length || 0) === 0 && <div className={styles.state}>暂无收益明细</div>}<div className={styles.pagination}><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>下一页</button></div></>
            )}
            {!loading && !error && tab === 'withdrawals' && (
                <><div className={styles.tableWrap}><table><thead><tr><th>申请时间</th><th>税前金额</th><th>个税</th><th>实际到账</th><th>状态</th><th>状态时间 / 原因</th></tr></thead><tbody>{withdrawals.map((item) => <tr key={item.id}><td>{formatTime(item.createdAt)}</td><td>{formatYuan(item.grossYuan)}</td><td>{formatYuan(item.incomeTaxYuan)}</td><td>{formatYuan(item.payoutYuan)}</td><td><span className={styles.statusBadge}>{statusLabel[item.status] || item.status}</span></td><td>{item.rejectionReason || formatTime(item.paidAt || item.approvedAt || item.updatedAt)}</td></tr>)}</tbody></table></div>{withdrawals.length === 0 && <div className={styles.state}>暂无提现记录</div>}</>
            )}
        </CreatorEarningsModalShell>
    );
};

export default CreatorEarningsRecordsModal;
