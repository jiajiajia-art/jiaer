import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import withdrawApi, {
  type CreatorVerifyStatus,
  type WithdrawEligibility,
  type WithdrawRecord,
} from '../../api/withdraw/withdrawApi';
import {
  diamondsToCny,
  isValidWithdrawAmount,
  WITHDRAW_DIAMOND_UNIT,
  WITHDRAW_PENDING_MESSAGE,
} from '../../utils/withdrawRules';
import { getApiErrorMessage } from '../../utils/error';
import { auth } from '../../api/account/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import styles from './WithdrawFlowModal.module.css';

type WithdrawFlowModalProps = {
  open: boolean;
  onClose: () => void;
};

const WithdrawFlowModal: React.FC<WithdrawFlowModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateUser = useAuthStore((s) => s.updateUser);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<WithdrawEligibility | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<CreatorVerifyStatus | null>(null);
  const [records, setRecords] = useState<WithdrawRecord[]>([]);
  const [amount, setAmount] = useState(10);
  const [applyRemark, setApplyRemark] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [eligResp, verifyResp, listResp] = await Promise.all([
        withdrawApi.getEligibility(),
        withdrawApi.getVerifyStatus(),
        withdrawApi.list({ page: 1, pageSize: 10 }),
      ]);
      if (eligResp.data.success) setEligibility(eligResp.data.data || null);
      if (verifyResp.data.success) setVerifyStatus(verifyResp.data.data || null);
      if (listResp.data.success) setRecords(listResp.data.data?.list || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('create.withdrawLoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open]);

  if (!open) return null;

  const refreshUserBalance = async () => {
    try {
      const me = await auth.getUserInfo();
      if (me.data?.success && me.data?.data) {
        updateUser(me.data.data);
      }
    } catch {
      // ignore
    }
  };

  const handleApplyVerify = async () => {
    setSubmitting(true);
    try {
      const resp = await withdrawApi.applyVerify(applyRemark);
      if (!resp.data.success) {
        toast.error(resp.data.message || t('create.verifyApplyFailed'));
        return;
      }
      toast.success(t('create.verifyApplySuccess'));
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('create.verifyApplyFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWithdraw = async () => {
    if (!eligibility) return;
    if (!isValidWithdrawAmount(amount) || amount > eligibility.maxWithdrawable) {
      toast.error(t('create.withdrawAmountInvalid', { unit: WITHDRAW_DIAMOND_UNIT, max: eligibility.maxWithdrawable }));
      return;
    }
    setSubmitting(true);
    try {
      const resp = await withdrawApi.create(amount);
      if (!resp.data.success) {
        toast.error(resp.data.message || t('create.withdrawFailed'));
        return;
      }
      toast.success(resp.data.data?.message || WITHDRAW_PENDING_MESSAGE);
      await Promise.all([load(), refreshUserBalance()]);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('create.withdrawFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (status: string) => {
    if (status === 'pending') return t('create.withdrawStatusPending');
    if (status === 'approved') return t('create.withdrawStatusApproved');
    if (status === 'rejected') return t('create.withdrawStatusRejected');
    return status;
  };

  const renderBody = () => {
    if (loading || !eligibility) {
      return <div className={styles.state}>{t('create.withdrawLoading')}</div>;
    }

    // 普通创作者：升级引导
    if (!eligibility.canWithdraw) {
      const latest = verifyStatus?.latest;
      return (
        <div className={styles.body}>
          <p className={styles.hint}>{t('create.withdrawNeedVerify')}</p>
          {latest?.status === 'pending' ? (
            <p className={styles.pendingBox}>{t('create.verifyPendingHint')}</p>
          ) : null}
          {latest?.status === 'rejected' ? (
            <div className={styles.rejectBox}>
              <div>{t('create.verifyRejected')}</div>
              <div className={styles.rejectRemark}>{latest.adminRemark || '—'}</div>
            </div>
          ) : null}
          {latest?.status !== 'pending' ? (
            <>
              <label className={styles.label}>
                {t('create.verifyApplyRemark')}
                <textarea
                  className={styles.textarea}
                  value={applyRemark}
                  onChange={(e) => setApplyRemark(e.target.value)}
                  rows={3}
                  placeholder={t('create.verifyApplyRemarkPlaceholder')}
                />
              </label>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={submitting}
                onClick={() => void handleApplyVerify()}
              >
                {submitting ? t('create.submitting') : t('create.applyVerify')}
              </button>
            </>
          ) : null}
        </div>
      );
    }

    // 资料不全
    if (!eligibility.profileComplete) {
      return (
        <div className={styles.body}>
          <p className={styles.hint}>{t('create.withdrawNeedProfile')}</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              onClose();
              navigate('/profile');
            }}
          >
            {t('create.goCompleteProfile')}
          </button>
        </div>
      );
    }

    // 已有 pending
    if (eligibility.pendingWithdraw) {
      return (
        <div className={styles.body}>
          <p className={styles.pendingBox}>{eligibility.pendingMessage || WITHDRAW_PENDING_MESSAGE}</p>
          <p className={styles.meta}>
            {t('create.withdrawPendingAmount', {
              amount: eligibility.pendingWithdraw.amount,
              cny: eligibility.pendingWithdraw.amountCny,
            })}
          </p>
        </div>
      );
    }

    return (
      <div className={styles.body}>
        <div className={styles.metaRow}>
          <span>{t('create.withdrawBalance', { balance: eligibility.balance })}</span>
          <span>{t('create.withdrawMax', { max: eligibility.maxWithdrawable })}</span>
          <span>{eligibility.rateLabel}</span>
        </div>
        <label className={styles.label}>
          {t('create.withdrawAmount')}
          <input
            className={styles.input}
            type="number"
            min={WITHDRAW_DIAMOND_UNIT}
            step={WITHDRAW_DIAMOND_UNIT}
            max={eligibility.maxWithdrawable}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </label>
        <p className={styles.meta}>
          {t('create.withdrawCnyPreview', { cny: diamondsToCny(amount) })}
        </p>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting || eligibility.maxWithdrawable < WITHDRAW_DIAMOND_UNIT}
          onClick={() => void handleCreateWithdraw()}
        >
          {submitting ? t('create.submitting') : t('create.confirmWithdraw')}
        </button>
      </div>
    );
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('create.withdraw')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('common.close')}>
            ×
          </button>
        </div>
        {renderBody()}
        {records.length > 0 ? (
          <div className={styles.records}>
            <h3 className={styles.recordsTitle}>{t('create.myWithdrawRecords')}</h3>
            <ul className={styles.recordList}>
              {records.map((item) => (
                <li key={item.id} className={styles.recordItem}>
                  <span>{item.amount}{t('create.diamondUnit')}</span>
                  <span>¥{item.amountCny}</span>
                  <span>{statusLabel(item.status)}</span>
                  <span className={styles.recordTime}>{item.createdAt?.slice(0, 10)}</span>
                  {item.status === 'rejected' && item.remark ? (
                    <span className={styles.rejectRemark}>{item.remark}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default WithdrawFlowModal;
