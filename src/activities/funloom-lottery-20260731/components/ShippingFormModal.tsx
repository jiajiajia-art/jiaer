import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { validateShippingForm } from '../lib/lotteryClient';
import styles from './ShippingFormModal.module.css';

interface ShippingFormModalProps {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (data: { recipientName: string; phone: string; address: string }) => Promise<void> | void;
}

/** 功能注释：游戏机/精灵球收货信息弹窗（挂 body）；仅取消或提交成功可关，点遮罩不关。 */
const ShippingFormModal: React.FC<ShippingFormModalProps> = ({
  open,
  submitting = false,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    const validated = validateShippingForm({ recipientName, phone, address });
    if (!validated.ok) {
      toast.error(t(`lottery.shippingValidation.${validated.code}`));
      return;
    }
    await onSubmit(validated.data);
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <h3 className={styles.title}>{t('lottery.shippingForm.title')}</h3>
        <label className={styles.label}>
          {t('lottery.shippingForm.recipient')}
          <input
            className={styles.input}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            maxLength={40}
            placeholder={t('lottery.shippingForm.namePlaceholder')}
          />
        </label>
        <label className={styles.label}>
          {t('lottery.shippingForm.phone')}
          <input
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={14}
            placeholder={t('lottery.shippingForm.phonePlaceholder')}
          />
        </label>
        <label className={styles.label}>
          {t('lottery.shippingForm.address')}
          <textarea
            className={styles.textarea}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            placeholder={t('lottery.shippingForm.addressPlaceholder')}
            rows={3}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={submitting}>
            {t('lottery.shippingForm.cancel')}
          </button>
          <button type="button" className={styles.primary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('lottery.shippingForm.submitting') : t('lottery.shippingForm.submit')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShippingFormModal;
