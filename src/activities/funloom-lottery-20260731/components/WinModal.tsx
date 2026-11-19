import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './WinModal.module.css';
import { type PrizeKey } from '../lib/lotteryClient';
import { PRIZE_IMAGES } from './LotteryWheel';

interface WinModalProps {
  open: boolean;
  prizeKey: string;
  prizeName: string;
  fulfillment: string;
  pointsAmount: number;
  onsiteHint?: string;
  pointsGrantStatus?: string;
  onClose: () => void;
  onFillShipping?: () => void;
  onRetryPoints?: () => void;
}

/** 功能注释：转盘停稳后弹出中奖结果遮罩（挂 body，避免活动页 overflow/层叠裁切）。 */
const WinModal: React.FC<WinModalProps> = ({
  open,
  prizeKey,
  prizeName,
  fulfillment,
  pointsAmount,
  onsiteHint,
  pointsGrantStatus,
  onClose,
  onFillShipping,
  onRetryPoints,
}) => {
  const { t } = useTranslation();
  const prizeLabel = (key: string) => t(`lottery.prizes.${key}.label`, { defaultValue: key });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const img = PRIZE_IMAGES[prizeKey as PrizeKey];
  const displayName = prizeName || prizeLabel(prizeKey);

  const modal = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="funloom-lottery-win-title"
    >
      <div className={styles.card}>
        <h2 id="funloom-lottery-win-title" className={styles.title}>
          {t('lottery.winModal.title')}
        </h2>
        <div className={styles.prizeFrame}>
          {img ? <img className={styles.prizeImg} src={img} alt={displayName} /> : null}
        </div>
        <p className={styles.prizeName}>{displayName}</p>
        <div className={styles.claimBox}>
          <p className={styles.claimLabel}>{t('lottery.winModal.claimLabel')}</p>
          {fulfillment === 'points' && (
            <p className={styles.hint}>
              {pointsGrantStatus === 'granted'
                ? t('lottery.winModal.pointsGranted', { amount: pointsAmount })
                : pointsGrantStatus === 'failed'
                  ? t('lottery.winModal.pointsFailed')
                  : t('lottery.winModal.pointsPending', { amount: pointsAmount })}
            </p>
          )}
          {fulfillment === 'onsite' && (
            <p className={styles.hint}>{onsiteHint || t('lottery.winModal.onsiteDefault')}</p>
          )}
          {fulfillment === 'shipping' && (
            <p className={styles.hint}>
              {t('lottery.winModal.shippingHint')}
            </p>
          )}
        </div>
        <div className={styles.actions}>
          {fulfillment === 'shipping' && onFillShipping ? (
            <button type="button" className={styles.primary} onClick={onFillShipping}>
              {t('lottery.winModal.fillShipping')}
            </button>
          ) : null}
          {fulfillment === 'points' && pointsGrantStatus === 'failed' && onRetryPoints ? (
            <button type="button" className={styles.primary} onClick={onRetryPoints}>
              {t('lottery.winModal.retryPoints')}
            </button>
          ) : null}
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('lottery.winModal.dismiss')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default WinModal;
