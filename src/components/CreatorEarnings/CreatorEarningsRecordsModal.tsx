import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import creatorEarningsApi, {
    type CreatorEarningLedgerItem,
    type CreatorEarningLedgerPage,
    type CreatorEarningWithdrawalRecord,
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

const formatTime = (value: string | null | undefined, locale: string) => (
    value ? new Date(value).toLocaleString(locale, { hour12: false }) : '—'
);
const formatKk = (minor: number, locale: string) => `${(minor / 100).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KK`;

const CreatorLedgerCard: React.FC<{ item: CreatorEarningLedgerItem; title: string; locale: string }> = ({ item, title, locale }) => {
    const { t } = useTranslation();
    return (
        <article className={styles.ledgerCard}>
            <header className={styles.ledgerSummary}>
                <div><strong>{title}</strong></div>
            </header>
            <div className={styles.ledgerAmounts}>
                <div><span>{t('creatorCenter.rechargeKk')}</span><strong>{formatKk(item.rechargeKkMinorTotal, locale)}</strong></div>
                <div><span>{t('creatorCenter.tokenCost')}</span><strong>{formatKk(item.tokenCostKkMinorTotal, locale)}</strong></div>
            </div>
        </article>
    );
};

const CreatorEarningsRecordsModal: React.FC<Props> = ({ open, initialFileId = '', workTitles, onClose }) => {
    const { t, i18n } = useTranslation();
    const locale = i18n.resolvedLanguage || i18n.language || 'zh';
    const [tab, setTab] = useState<Tab>('ledger');
    const [fileId, setFileId] = useState(initialFileId);
    const [page, setPage] = useState(1);
    const [ledger, setLedger] = useState<CreatorEarningLedgerPage | null>(null);
    const [withdrawals, setWithdrawals] = useState<CreatorEarningWithdrawalRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const requestVersionRef = useRef(0);
    const statusLabel: Record<string, string> = {
        pending: t('creatorCenter.statusPending'),
        approved: t('creatorCenter.statusApproved'),
        paid: t('creatorCenter.statusPaid'),
        rejected: t('creatorCenter.statusRejected'),
        completed: t('creatorCenter.statusCompleted'),
    };

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
        <CreatorEarningsModalShell open={open} title={t('creatorCenter.recordsTitle')} onClose={onClose} wide>
            <div className={styles.recordTabs}><button type="button" className={tab === 'ledger' ? styles.active : ''} onClick={() => { setTab('ledger'); setPage(1); }}>{t('creatorCenter.ledgerTab')}</button><button type="button" className={tab === 'withdrawals' ? styles.active : ''} onClick={() => setTab('withdrawals')}>{t('creatorCenter.withdrawalTab')}</button></div>
            {tab === 'ledger' && <select className={styles.recordFilter} value={fileId} onChange={(event) => { setFileId(event.target.value); setPage(1); }} aria-label={t('creatorCenter.filterWork')}><option value="">{t('creatorCenter.allWorks')}</option>{workOptions.map(([id, title]) => <option value={id} key={id}>{title}</option>)}</select>}
            {loading && <div className={styles.state}>{t('creatorCenter.recordsLoading')}</div>}
            {error && <div className={styles.state} role="alert">{t('creatorCenter.recordsLoadFailed')}<button type="button" onClick={() => void load()}>{t('common.retry')}</button></div>}
            {!loading && !error && tab === 'ledger' && (
                <><div className={styles.ledgerList}>{ledger?.items.map((item) => <CreatorLedgerCard key={item.fileId} item={item} title={workTitles[item.fileId] || item.fileId} locale={locale} />)}</div>{(ledger?.items.length || 0) === 0 && <div className={styles.state}>{t('creatorCenter.ledgerEmpty')}</div>}<div className={styles.pagination}><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('common.prevPage')}</button><span>{page} / {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.nextPage')}</button></div></>
            )}
            {!loading && !error && tab === 'withdrawals' && (
                <><div className={styles.tableWrap}><table><thead><tr><th>{t('creatorCenter.recordType')}</th><th>{t('creatorCenter.recordTime')}</th><th>{t('creatorCenter.shareAmount')}</th><th>{t('creatorCenter.tax')}</th><th>{t('creatorCenter.arrivalAmount')}</th><th>{t('creatorCenter.status')}</th><th>{t('creatorCenter.statusTime')}</th></tr></thead><tbody>{withdrawals.map((item) => item.type === 'kk_exchange' ? (<tr key={item.recordId}><td>{t('creatorCenter.kkExchange')}</td><td>{formatTime(item.createdAt, locale)}</td><td>{formatYuan(item.grossYuan)}</td><td>—</td><td>{formatKk(item.creditedKkMinor, locale)}</td><td><span className={styles.statusBadge}>{statusLabel[item.status]}</span></td><td>{formatTime(item.createdAt, locale)}</td></tr>) : (<tr key={item.recordId}><td>{t('creatorCenter.cnyWithdraw')}</td><td>{formatTime(item.createdAt, locale)}</td><td>{formatYuan(item.grossYuan)}</td><td>{formatYuan(item.incomeTaxYuan)}</td><td>{formatYuan(item.payoutYuan)}</td><td><span className={styles.statusBadge}>{statusLabel[item.status] || item.status}</span></td><td>{item.rejectionReason || formatTime(item.paidAt || item.approvedAt || item.updatedAt, locale)}</td></tr>))}</tbody></table></div>{withdrawals.length === 0 && <div className={styles.state}>{t('creatorCenter.withdrawalsEmpty')}</div>}</>
            )}
        </CreatorEarningsModalShell>
    );
};

export default CreatorEarningsRecordsModal;
