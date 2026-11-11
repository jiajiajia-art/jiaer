import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './WinModal.module.css';
import { PRIZE_DISPLAY, type PrizeKey } from '../lib/lotteryClient';
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
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const meta = PRIZE_DISPLAY[prizeKey as PrizeKey];
  const img = PRIZE_IMAGES[prizeKey as PrizeKey];
  const displayName = prizeName || meta?.label || '';

  const modal = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="funloom-lottery-win-title"
    >
      <div className={styles.card}>
        <h2 id="funloom-lottery-win-title" className={styles.title}>
          恭喜中奖！！
        </h2>
        <div className={styles.prizeFrame}>
          {img ? <img className={styles.prizeImg} src={img} alt={displayName} /> : null}
        </div>
        <p className={styles.prizeName}>{displayName}</p>
        <div className={styles.claimBox}>
          <p className={styles.claimLabel}>领取方式</p>
          {fulfillment === 'points' && (
            <p className={styles.hint}>
              {pointsGrantStatus === 'granted'
                ? `已自动发放 ${pointsAmount} 织梦豆到账`
                : pointsGrantStatus === 'failed'
                  ? '织梦豆发放失败，请重试'
                  : `中奖后自动发放 ${pointsAmount} 织梦豆`}
            </p>
          )}
          {fulfillment === 'onsite' && (
            <p className={styles.hint}>{onsiteHint || '请到活动现场领取奖品'}</p>
          )}
          {fulfillment === 'shipping' && (
            <p className={styles.hint}>
              邮寄领取：请填写收货人、地址与手机号，我们将安排寄送
            </p>
          )}
        </div>
        <div className={styles.actions}>
          {fulfillment === 'shipping' && onFillShipping ? (
            <button type="button" className={styles.primary} onClick={onFillShipping}>
              填写收货信息
            </button>
          ) : null}
          {fulfillment === 'points' && pointsGrantStatus === 'failed' && onRetryPoints ? (
            <button type="button" className={styles.primary} onClick={onRetryPoints}>
              重新领取织梦豆
            </button>
          ) : null}
          <button type="button" className={styles.secondary} onClick={onClose}>
            知道了
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default WinModal;
