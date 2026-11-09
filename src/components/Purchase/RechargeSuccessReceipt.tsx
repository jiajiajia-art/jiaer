import { CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RechargeReceipt } from '../../lib/rechargeReceipt';
import styles from './RechargeSuccessReceipt.module.css';

type Props = {
    receipt: RechargeReceipt;
    onReturn: () => void;
};

export default function RechargeSuccessReceipt({ receipt, onReturn }: Props) {
    const { t } = useTranslation();
    const isDiamonds = receipt.kind === 'diamonds';

    return (
        <div className={styles.overlay}>
            <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="recharge-success-title">
                <CircleCheck className={styles.successIcon} size={42} aria-hidden="true" />
                <h2 id="recharge-success-title">{t('rechargeModal.rechargeReceipt.title')}</h2>
                {isDiamonds ? (
                    <>
                        <p className={styles.headline}>{t('rechargeModal.rechargeReceipt.diamondsHeadline')}</p>
                        <div className={styles.amount}>
                            <strong>{receipt.diamonds.toLocaleString()}</strong>
                            <span>KK币</span>
                        </div>
                        <p className={styles.description}>{t('rechargeModal.rechargeReceipt.diamondsDelivered')}</p>
                    </>
                ) : (
                    <>
                        <p className={styles.headline}>
                            {t(receipt.planId === 'week' ? 'rechargeModal.rechargeReceipt.weekHeadline' : 'rechargeModal.rechargeReceipt.monthHeadline')}
                        </p>
                        <dl className={styles.benefits}>
                            <div><dt>{t('rechargeModal.rechargeReceipt.duration')}</dt><dd>{t('rechargeModal.rechargeReceipt.days', { count: receipt.durationDays })}</dd></div>
                            <div><dt>{t('rechargeModal.rechargeReceipt.dailyReward')}</dt><dd>{receipt.dailyReward} KK币</dd></div>
                            <div><dt>{t('rechargeModal.rechargeReceipt.finalDayReward')}</dt><dd>{receipt.finalDayReward} KK币</dd></div>
                            <div><dt>{t('rechargeModal.rechargeReceipt.totalReward')}</dt><dd>{receipt.totalReward.toLocaleString()} KK币</dd></div>
                        </dl>
                        <p className={styles.description}>{t('rechargeModal.rechargeReceipt.membershipActivated')}</p>
                    </>
                )}
                <button type="button" className={styles.returnButton} onClick={onReturn}>
                    {t('rechargeModal.rechargeReceipt.returnToRecharge')}
                </button>
            </section>
        </div>
    );
}
