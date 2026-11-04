import React, { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { IoCheckmarkCircleOutline, IoTimeOutline, IoWalletOutline } from 'react-icons/io5';
import creatorEarningsApi, {
    type CreatorEarningOverview,
    type CreatorEarningWithdrawal,
} from '../../api/creatorEarnings/creatorEarningsApi';
import {
    ensureCreatorEarningIdempotencyKey,
    formatYuan,
    maskBankAccount,
    resolveCreatorWithdrawAction,
} from '../../lib/creatorEarningsView';
import { getApiErrorMessage } from '../../utils/error';
import CreatorEarningsModalShell from './CreatorEarningsModalShell';
import styles from './CreatorEarnings.module.css';

interface Props {
    open: boolean;
    overview: CreatorEarningOverview | null;
    profileComplete: boolean;
    workTitles: Record<string, string>;
    bankCard?: string;
    bankBranch?: string;
    onClose: () => void;
    onOpenProfile: () => void;
    onSuccess: () => Promise<void> | void;
}

const CreatorEarningsWithdrawalModal: React.FC<Props> = ({
    open,
    overview,
    profileComplete,
    workTitles,
    bankCard,
    bankBranch,
    onClose,
    onOpenProfile,
    onSuccess,
}) => {
    const [submitting, setSubmitting] = useState(false);
    const [successText, setSuccessText] = useState('');
    const [submittedWithdrawal, setSubmittedWithdrawal] = useState<CreatorEarningWithdrawal | null>(null);
    const idempotencyKey = useRef<string | null>(null);
    const availableCents = Math.round(Number(overview?.summary.availableGrossYuan || 0) * 100);
    const action = resolveCreatorWithdrawAction({
        profileComplete,
        activeStatus: overview?.activeWithdrawal?.status,
        availableCents,
    });
    const active = submittedWithdrawal || overview?.activeWithdrawal;
    const isStatusView = Boolean(active) && (Boolean(submittedWithdrawal) || action === 'status');
    const title = isStatusView
        ? submittedWithdrawal
            ? '申请已提交，等待审核'
            : active?.status === 'approved'
                ? '审核通过，等待打款'
                : '提现申请状态'
        : action === 'withdraw'
            ? '确认本次提现'
            : action === 'profile'
                ? '完善创作者资料'
                : '创作者分成KK币提取';
    const progress = Math.min(100, Math.max(0, availableCents / 100));
    const preview = overview?.withdrawalPreview;
    const exchangePreview = overview?.exchangePreview;
    const creditedKk = (exchangePreview?.creditedKkMinor || 0) / 100;
    const activeBankLabel = useMemo(() => {
        const card = active?.bankCardNumber || '';
        return card ? maskBankAccount(card, active?.bankBranch || '银行卡') : '以创作者资料中的银行卡为准';
    }, [active]);
    const profileBankLabel = useMemo(() => (
        bankCard ? maskBankAccount(bankCard, bankBranch || '银行卡') : '以创作者资料中的银行卡为准'
    ), [bankBranch, bankCard]);

    const refreshAfterSuccess = async () => {
        try {
            await onSuccess();
        } catch (error) {
            console.error('Refresh creator earnings after operation failed:', error);
            toast.error('操作已成功，最新收益数据暂未刷新，请稍后重试。');
        }
    };

    const submit = async () => {
        if (submitting || !overview) return;
        idempotencyKey.current = ensureCreatorEarningIdempotencyKey(idempotencyKey.current);
        setSubmitting(true);
        try {
            if (action === 'withdraw') {
                const created = await creatorEarningsApi.createWithdrawal(idempotencyKey.current);
                setSubmittedWithdrawal(created);
            } else if (action === 'exchange') {
                const result = await creatorEarningsApi.exchangeKk(idempotencyKey.current);
                setSuccessText(`已兑换 ${result.creditedKk.toFixed(2)} KK币，余额已更新。`);
            }
            idempotencyKey.current = null;
            await refreshAfterSuccess();
        } catch (error) {
            toast.error(getApiErrorMessage(error, action === 'withdraw' ? '提现申请失败' : '兑换失败'));
        } finally {
            setSubmitting(false);
        }
    };

    const close = () => {
        if (submitting) return;
        setSuccessText('');
        setSubmittedWithdrawal(null);
        onClose();
    };

    let content: React.ReactNode;
    let actions: React.ReactNode;
    if (successText) {
        content = (
            <div className={styles.successState} role="status">
                <IoCheckmarkCircleOutline aria-hidden="true" />
                <h3>兑换成功</h3>
                <p>{successText}</p>
            </div>
        );
        actions = <button type="button" className={`${styles.primaryButton} ${styles.modalActionFull}`} onClick={close} disabled={submitting}>完成</button>;
    } else if (!overview) {
        content = <div className={styles.state}>收益数据尚未加载，请稍后重试。</div>;
        actions = <button type="button" className={`${styles.secondaryButton} ${styles.modalActionFull}`} onClick={close}>关闭</button>;
    } else if (action === 'profile' && !isStatusView) {
        content = (
            <div className={styles.modalMessage}>
                <IoWalletOutline aria-hidden="true" />
                <h3>提现前需完善收款资料</h3>
                <p>请填写手机号、实名、身份证、银行卡和开户行。保存后即可继续申请。</p>
            </div>
        );
        actions = (
            <div className={styles.selectorActions}>
                <button type="button" className={styles.secondaryButton} onClick={close}>稍后处理</button>
                <button type="button" className={styles.primaryButton} onClick={onOpenProfile}>完善资料</button>
            </div>
        );
    } else if (isStatusView && active) {
        content = (
            <div className={styles.withdrawContent}>
                <div className={styles.statusHero} role="status">
                    <IoTimeOutline aria-hidden="true" />
                    <div>
                        <h3>已受理</h3>
                        <p>{active.status === 'approved' ? '运营审核已通过，正在等待打款。' : '运营审核通过后，T+3 个工作日打款。'}</p>
                    </div>
                </div>
                <div className={styles.amountSummary}>
                    <div><span>本次冻结（税前）</span><strong>{formatYuan(active.grossYuan)}</strong></div>
                    <div><span>代扣个人所得税 · 20%</span><strong>-{formatYuan(active.incomeTaxYuan)}</strong></div>
                    <div><span>预计到账</span><strong>{formatYuan(active.payoutYuan)}</strong></div>
                </div>
                <p className={styles.bankLine}>本人{activeBankLabel}</p>
                <p className={styles.statusHint}>可在提现记录中查看审核与打款进度。</p>
            </div>
        );
        actions = <button type="button" className={`${styles.primaryButton} ${styles.modalActionFull}`} onClick={close} disabled={submitting}>返回创作者中心</button>;
    } else if (action === 'withdraw' && preview) {
        content = (
            <div className={styles.withdrawContent}>
                <p className={styles.modalIntro}>请核对金额、税额与收款账户</p>
                <div className={styles.amountSummary}>
                    <div><span>本次提现（税前）</span><strong>{formatYuan(preview.grossCents / 100)}</strong></div>
                    <div><span>代扣个人所得税 · 20%</span><strong>-{formatYuan(preview.incomeTaxCents / 100)}</strong></div>
                    <div><span>预计提现</span><strong>{formatYuan(preview.payoutCents / 100)}</strong></div>
                </div>
                <div className={styles.sourceList}>
                    <h3>提现来源 · {preview.items.length}部作品合计 {formatYuan(preview.grossCents / 100)}</h3>
                    {preview.items.map((item) => (
                        <div key={item.fileId}>
                            <span>{workTitles[item.fileId] || item.fileId}</span>
                            <strong>{formatYuan(item.grossYuan)}</strong>
                        </div>
                    ))}
                </div>
                <div className={styles.bankCard}>
                    <span>本人收款账户</span>
                    <strong>{profileBankLabel}</strong>
                </div>
                <p className={styles.notice}>确认前不冻结资金；提交成功后冻结本次金额。运营审核通过后 T+3 个工作日打款。</p>
            </div>
        );
        actions = (
            <button
                type="button"
                className={`${styles.primaryButton} ${styles.modalActionFull}`}
                onClick={() => void submit()}
                disabled={submitting}
            >
                {submitting ? '提交中…' : '确认提交'}
            </button>
        );
    } else {
        content = (
            <div className={styles.withdrawContent}>
                <div className={styles.balanceHero}>
                    <strong>创作者分成KK币提取</strong>
                    <p>本次提取分成 {formatYuan(exchangePreview?.grossYuan || overview.summary.availableGrossYuan)}，预计到账 {creditedKk.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KK币。未达到 ¥100 人民币提现门槛，可选择继续累计或提取为 KK币。</p>
                    <div className={styles.progressHeading}>
                        <span>当前累计</span>
                        <b>{formatYuan(overview.summary.availableGrossYuan)} / ¥100.00</b>
                    </div>
                    <div className={styles.progressTrack} aria-label="提现门槛进度">
                        <span style={{ width: `${progress}%` }} />
                    </div>
                </div>
                <p className={styles.progressText}>今日待结算 {formatYuan(overview.summary.pendingGrossYuan)} 不参与本次兑换</p>
            </div>
        );
        actions = (
            <div className={styles.stackedActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void submit()} disabled={submitting || availableCents <= 0}>
                    {submitting ? '兑换中…' : '提取KK币'}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={close} disabled={submitting}>继续累计收益</button>
            </div>
        );
    }

    return (
        <CreatorEarningsModalShell open={open} title={title} onClose={close} actions={actions} closeDisabled={submitting}>
            {content}
        </CreatorEarningsModalShell>
    );
};

export default CreatorEarningsWithdrawalModal;
