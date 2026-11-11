import { useTranslation } from 'react-i18next';
import type { useAlipayCheckout } from '../../hooks/useAlipayCheckout';
import styles from './RechargeModal.module.css';
import RechargeSuccessReceipt from './RechargeSuccessReceipt';

type Props = {
    checkout: ReturnType<typeof useAlipayCheckout>;
    onClose: () => void;
    onReturnToPlans: () => void;
};

export default function AlipayCheckoutPanel({ checkout, onClose, onReturnToPlans }: Props) {
    const { t } = useTranslation();
    const terminal = checkout.status === 'paid' || checkout.status === 'failed';
    if (checkout.status === 'paid' && checkout.receipt) {
        return <RechargeSuccessReceipt receipt={checkout.receipt} onReturn={onReturnToPlans} />;
    }
    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <section className={styles.modalContent} role="dialog" aria-modal="true"
                aria-label={t('rechargeModal.payAlipay')} onClick={event => event.stopPropagation()}>
                <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t('common.close')}>
                    <span className={styles.closeIcon} aria-hidden="true" />
                </button>
                <div className={styles.qrSection}>
                    <h2 className={styles.qrTitle}>{t('rechargeModal.payAlipay')}</h2>
                    <div role="status" aria-live="polite"
                        className={checkout.status === 'paid' ? styles.successText : styles.qrHint}>
                        {t(checkout.status === 'paid' ? 'rechargeModal.paymentSuccess'
                            : checkout.status === 'failed' ? 'rechargeModal.paymentFailed'
                                : checkout.status === 'cancelling' ? 'rechargeModal.alipayCancelling'
                                : checkout.status === 'pending' ? 'rechargeModal.alipayPayPending'
                                    : 'rechargeModal.alipayNewTabWaiting')}
                    </div>
                    {!terminal && checkout.status !== 'cancelling' && <p className={styles.qrHint}>{t('rechargeModal.alipayKeepOrder')}</p>}
                    {checkout.error && <p role="alert" className={styles.errorText}>
                        {t(`rechargeModal.alipayCheckoutErrors.${checkout.error}`)}
                    </p>}
                    {!terminal && checkout.status !== 'cancelling' && (checkout.error === 'cancelPending' ? (
                        <button type="button" className={styles.qrActionBtn} onClick={checkout.dismiss}>
                            {t('rechargeModal.alipayCancelRetry')}
                        </button>
                    ) : <>
                        <button type="button" className={styles.qrActionBtn} onClick={checkout.reopen}>
                            {t('rechargeModal.alipayReopen')}
                        </button>
                        <button type="button" className={styles.qrActionBtn} onClick={checkout.retry}>
                            {t('rechargeModal.alipayCheckStatus')}
                        </button>
                    </>)}
                    {checkout.status === 'failed' && <button type="button" className={styles.qrActionBtn} onClick={checkout.reset}>
                        {t('rechargeModal.restartRecharge')}
                    </button>}
                    {checkout.status !== 'cancelling' && <button type="button" className={styles.qrActionBtn} onClick={checkout.status === 'paid' ? onReturnToPlans : checkout.dismiss}>
                        {t(checkout.status === 'paid' ? 'rechargeModal.rechargeReceipt.returnToRecharge' : 'rechargeModal.alipayCancelAndBack')}
                    </button>
                    }
                </div>
            </section>
        </div>
    );
}
