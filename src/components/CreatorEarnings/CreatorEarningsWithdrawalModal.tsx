import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t, i18n } = useTranslation();
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
            ? t('creatorCenter.submittedWaiting')
            : active?.status === 'approved'
                ? t('creatorCenter.approvedWaitingPay')
                : t('creatorCenter.withdrawalStatus')
        : action === 'withdraw'
            ? t('creatorCenter.confirmWithdrawal')
            : action === 'profile'
                ? t('creatorCenter.completeProfile')
                : t('creatorCenter.exchangeTitle');
    const progress = Math.min(100, Math.max(0, availableCents / 100));
    const preview = overview?.withdrawalPreview;
    const exchangePreview = overview?.exchangePreview;
    const creditedKk = (exchangePreview?.creditedKkMinor || 0) / 100;
    const locale = i18n.resolvedLanguage || i18n.language || 'zh';
    const activeBankLabel = useMemo(() => {
        const card = active?.bankCardNumber || '';
        return card ? maskBankAccount(card, active?.bankBranch || t('creatorCenter.bankCard')) : t('creatorCenter.bankFromProfile');
    }, [active, t]);
    const profileBankLabel = useMemo(() => (
        bankCard ? maskBankAccount(bankCard, bankBranch || t('creatorCenter.bankCard')) : t('creatorCenter.bankFromProfile')
    ), [bankBranch, bankCard, t]);

    const refreshAfterSuccess = async () => {
        try {
            await onSuccess();
        } catch (error) {
            console.error('Refresh creator earnings after operation failed:', error);
            toast.error(t('creatorCenter.refreshAfterSuccessFailed'));
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
                setSuccessText(t('creatorCenter.exchangedKk', { amount: result.creditedKk.toFixed(2) }));
            }
            idempotencyKey.current = null;
            await refreshAfterSuccess();
        } catch (error) {
            toast.error(getApiErrorMessage(error, action === 'withdraw' ? t('creatorCenter.withdrawFailed') : t('creatorCenter.exchangeFailed')));
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

    let content: React.ReactNode = null;
    let actions: React.ReactNode = null;
    if (successText) {
        content = (
            <div className={styles.successState} role="status">
                <IoCheckmarkCircleOutline aria-hidden="true" />
                <h3>{t('creatorCenter.exchangeSuccess')}</h3>
                <p>{successText}</p>
            </div>
        );
        actions = <button type="button" className={`${styles.primaryButton} ${styles.modalActionFull}`} onClick={close} disabled={submitting}>{t('creatorCenter.done')}</button>;
    } else if (!overview) {
        content = <div className={styles.state}>{t('creatorCenter.overviewNotReady')}</div>;
        actions = <button type="button" className={`${styles.secondaryButton} ${styles.modalActionFull}`} onClick={close}>{t('common.close')}</button>;
    } else if (action === 'profile' && !isStatusView) {
        content = (
            <div className={styles.modalMessage}>
                <IoWalletOutline aria-hidden="true" />
                <h3>{t('creatorCenter.profileRequiredTitle')}</h3>
                <p>{t('creatorCenter.profileRequiredBody')}</p>
            </div>
        );
        actions = (
            <div className={styles.selectorActions}>
                <button type="button" className={styles.secondaryButton} onClick={close}>{t('creatorCenter.later')}</button>
                <button type="button" className={styles.primaryButton} onClick={onOpenProfile}>{t('creatorCenter.completeProfileAction')}</button>
            </div>
        );
    } else if (isStatusView && active) {
        content = (
            <div className={styles.withdrawContent}>
                <div className={styles.statusHero} role="status">
                    <IoTimeOutline aria-hidden="true" />
                    <div>
                        <h3>{t('creatorCenter.accepted')}</h3>
                        <p>{active.status === 'approved' ? t('creatorCenter.approvedPayHint') : t('creatorCenter.pendingPayHint')}</p>
                    </div>
                </div>
                <div className={styles.amountSummary}>
                    <div><span>{t('creatorCenter.frozenThisTime')}</span><strong>{formatYuan(active.grossYuan)}</strong></div>
                    <div><span>{t('creatorCenter.incomeTax')}</span><strong>-{formatYuan(active.incomeTaxYuan)}</strong></div>
                    <div><span>{t('creatorCenter.expectedArrival')}</span><strong>{formatYuan(active.payoutYuan)}</strong></div>
                </div>
                <p className={styles.bankLine}>{t('creatorCenter.ownAccount', { account: activeBankLabel })}</p>
                <p className={styles.statusHint}>{t('creatorCenter.statusHint')}</p>
            </div>
        );
        actions = <button type="button" className={`${styles.primaryButton} ${styles.modalActionFull}`} onClick={close} disabled={submitting}>{t('creatorCenter.backToCenter')}</button>;
    } else if (action === 'withdraw' && preview) {
        content = (
            <div className={styles.withdrawContent}>
                <p className={styles.modalIntro}>{t('creatorCenter.confirmAmounts')}</p>
                <div className={styles.amountSummary}>
                    <div><span>{t('creatorCenter.withdrawThisTime')}</span><strong>{formatYuan(preview.grossCents / 100)}</strong></div>
                    <div><span>{t('creatorCenter.incomeTax')}</span><strong>-{formatYuan(preview.incomeTaxCents / 100)}</strong></div>
                    <div><span>{t('creatorCenter.expectedWithdraw')}</span><strong>{formatYuan(preview.payoutCents / 100)}</strong></div>
                </div>
                <div className={styles.sourceList}>
                    <h3>{t('creatorCenter.withdrawSources', { count: preview.items.length, amount: formatYuan(preview.grossCents / 100) })}</h3>
                    {preview.items.map((item) => (
                        <div key={item.fileId}>
                            <span>{workTitles[item.fileId] || item.fileId}</span>
                            <strong>{formatYuan(item.grossYuan)}</strong>
                        </div>
                    ))}
                </div>
                <div className={styles.bankCard}>
                    <span>{t('creatorCenter.payoutAccount')}</span>
                    <strong>{profileBankLabel}</strong>
                </div>
                <p className={styles.notice}>{t('creatorCenter.withdrawNotice')}</p>
            </div>
        );
        actions = (
            <button
                type="button"
                className={`${styles.primaryButton} ${styles.modalActionFull}`}
                onClick={() => void submit()}
                disabled={submitting}
            >
                {submitting ? t('creatorCenter.submitting') : t('creatorCenter.confirmSubmit')}
            </button>
        );
    } else if (overview) {
        const creditedLabel = creditedKk.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        content = (
            <div className={styles.withdrawContent}>
                <div className={styles.balanceHero}>
                    <strong>{t('creatorCenter.exchangeTitle')}</strong>
                    <p>{t('creatorCenter.exchangeBody', {
                        gross: formatYuan(exchangePreview?.grossYuan || overview.summary.availableGrossYuan),
                        kk: creditedLabel,
                    })}</p>
                    <div className={styles.progressHeading}>
                        <span>{t('creatorCenter.currentTotal')}</span>
                        <b>{formatYuan(overview.summary.availableGrossYuan)} / ¥100.00</b>
                    </div>
                    <div className={styles.progressTrack} aria-label={t('creatorCenter.thresholdProgress')}>
                        <span style={{ width: `${progress}%` }} />
                    </div>
                </div>
                <p className={styles.progressText}>{t('creatorCenter.pendingExcluded', { amount: formatYuan(overview.summary.pendingGrossYuan) })}</p>
            </div>
        );
        actions = (
            <div className={styles.stackedActions}>
                <button type="button" className={styles.primaryButton} onClick={() => void submit()} disabled={submitting || availableCents <= 0}>
                    {submitting ? t('creatorCenter.exchanging') : t('creatorCenter.exchangeKk')}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={close} disabled={submitting}>{t('creatorCenter.keepAccumulating')}</button>
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
