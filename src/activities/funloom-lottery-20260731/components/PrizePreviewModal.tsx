import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import styles from './PrizePreviewModal.module.css';
import { PRIZE_CLAIM_INFO, type PrizeKey } from '../lib/lotteryClient';
import { PRIZE_IMAGES } from './LotteryWheel';

interface PrizePreviewModalProps {
  open: boolean;
  prizeKey: PrizeKey | null;
  /** 现场领取补充说明（活动配置） */
  onsiteHint?: string;
  onClose: () => void;
}

const claimMethodKey = (fulfillment: string) => {
  if (fulfillment === 'shipping') return 'lottery.claim.methodShipping';
  if (fulfillment === 'onsite') return 'lottery.claim.methodOnsite';
  return 'lottery.claim.methodPoints';
};

const claimDetailKey = (fulfillment: string) => {
  if (fulfillment === 'shipping') return 'lottery.claim.detailShipping';
  if (fulfillment === 'onsite') return 'lottery.claim.detailOnsite';
  return 'lottery.claim.detailPoints';
};

/**
 * 功能注释：奖池卡片点击放大预览（挂 body）。
 * 展示每奖独立领取方式；遮罩 / Esc / 关闭钮均可关。
 */
const PrizePreviewModal: React.FC<PrizePreviewModalProps> = ({
  open,
  prizeKey,
  onsiteHint,
  onClose,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !prizeKey) return null;

  const claim = PRIZE_CLAIM_INFO[prizeKey];
  const img = PRIZE_IMAGES[prizeKey];
  const label = t(`lottery.prizes.${prizeKey}.label`);
  const claimDetail =
    claim.fulfillment === 'onsite' && onsiteHint?.trim()
      ? onsiteHint.trim()
      : t(claimDetailKey(claim.fulfillment));

  const modal = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={styles.stage}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={t('lottery.prizePreview.closeAria')}
        >
          ×
        </button>
        <div className={styles.frame}>
          {img ? <img className={styles.img} src={img} alt={label} /> : null}
        </div>
        <p id={titleId} className={styles.name}>
          {label}
        </p>
        <div className={styles.claimBox}>
          <p className={styles.claimLabel}>{t('lottery.prizePreview.claimLabel')}</p>
          <p className={styles.claimMethod}>{t(claimMethodKey(claim.fulfillment))}</p>
          <p className={styles.claimDetail}>{claimDetail}</p>
          {claim.fulfillment === 'shipping' ? (
            <p className={styles.claimLinkNote}>
              {t('lottery.prizePreview.shippingEntryNote')}
            </p>
          ) : null}
        </div>
        <p className={styles.hint}>{t('lottery.prizePreview.tapToClose')}</p>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default PrizePreviewModal;
