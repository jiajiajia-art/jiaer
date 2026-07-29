import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
      toast.error(validated.message);
      return;
    }
    await onSubmit(validated.data);
  };

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.card}>
        <h3 className={styles.title}>填写收货信息</h3>
        <label className={styles.label}>
          收货人
          <input
            className={styles.input}
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            maxLength={40}
            placeholder="姓名"
          />
        </label>
        <label className={styles.label}>
          手机号
          <input
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={14}
            placeholder="11 位手机号"
          />
        </label>
        <label className={styles.label}>
          地址
          <textarea
            className={styles.textarea}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
            placeholder="省市区 + 详细地址"
            rows={3}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button type="button" className={styles.primary} onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中…' : '提交'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ShippingFormModal;
