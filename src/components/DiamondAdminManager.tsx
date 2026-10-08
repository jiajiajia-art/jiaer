import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import adminDiamondsApi, { type AdminDiamondUser } from '../api/admin/adminDiamondsApi';
import {
  calculateDiamondBalance,
  parseAdminDiamondAmount,
  type AdminDiamondChangeType,
  validateAdminDiamondAmount,
} from '../utils/adminDiamondAdjustment';
import { getApiErrorMessage } from '../utils/error';
import AdminManualAdjustmentHistory from './AdminManualAdjustmentHistory';
import styles from './DiamondAdminManager.module.css';

type ApiErrorData = {
  code?: string;
  message?: string;
  data?: { currentDiamonds?: number };
};

function getApiErrorData(error: unknown): ApiErrorData | null {
  if (!error || typeof error !== 'object' || !('response' in error)) return null;
  const response = (error as { response?: { data?: ApiErrorData } }).response;
  return response?.data || null;
}

const DiamondAdminManager: React.FC = () => {
  const [userCode, setUserCode] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminDiamondUser | null>(null);
  const [changeType, setChangeType] = useState<AdminDiamondChangeType>('increment');
  const [amountInput, setAmountInput] = useState('');
  const [remark, setRemark] = useState('');
  const [amountError, setAmountError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const amount = parseAdminDiamondAmount(amountInput);
  const nextBalance = useMemo(() => (
    selectedUser && Number.isSafeInteger(amount) && amount > 0
      ? calculateDiamondBalance(selectedUser.diamonds, changeType, amount)
      : selectedUser?.diamonds ?? 0
  ), [amount, changeType, selectedUser]);

  const resetAdjustment = () => {
    setChangeType('increment');
    setAmountInput('');
    setRemark('');
    setAmountError('');
    setOperationId(null);
  };

  const handleUserCodeChange = (value: string) => {
    setUserCode(value);
    setSelectedUser(null);
    resetAdjustment();
  };

  const handleLookup = async () => {
    const normalizedUserCode = userCode.trim();
    if (!normalizedUserCode) {
      toast.error('请输入 Kuran号');
      return;
    }

    try {
      setIsLookingUp(true);
      const response = await adminDiamondsApi.lookupUser(normalizedUserCode);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '用户查询失败');
      }
      setSelectedUser(response.data.data);
      resetAdjustment();
      toast.success('用户查询成功');
    } catch (error) {
      setSelectedUser(null);
      toast.error(getApiErrorMessage(error, '用户查询失败'));
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleAdjustmentChange = (value: string) => {
    setAmountInput(value);
    setAmountError('');
    setOperationId(null);
  };

  const handleChangeType = (value: AdminDiamondChangeType) => {
    setChangeType(value);
    setAmountError('');
    setOperationId(null);
  };

  const openConfirmation = () => {
    if (!selectedUser) {
      toast.error('请先查询目标用户');
      return;
    }
    const validationError = validateAdminDiamondAmount(amountInput, changeType, selectedUser.diamonds);
    if (validationError) {
      setAmountError(validationError);
      return;
    }
    setAmountError('');
    setOperationId(crypto.randomUUID());
    setIsConfirmOpen(true);
  };

  const closeConfirmation = useCallback(() => {
    if (isSubmitting) return;
    setIsConfirmOpen(false);
    setOperationId(null);
  }, [isSubmitting]);

  const handleConfirm = async () => {
    if (!selectedUser || !operationId) return;
    const validationError = validateAdminDiamondAmount(amountInput, changeType, selectedUser.diamonds);
    if (validationError) {
      setAmountError(validationError);
      setIsConfirmOpen(false);
      setOperationId(null);
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await adminDiamondsApi.adjust({
        userId: selectedUser.userId,
        changeType,
        diamonds: amount,
        remark: remark.trim(),
        operationId,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || '特殊KK币变更失败');
      }
      setSelectedUser(response.data.data.user);
      setIsConfirmOpen(false);
      setAmountInput('');
      setRemark('');
      setAmountError('');
      setOperationId(null);
      setHistoryRefreshKey((value) => value + 1);
      toast.success(changeType === 'increment' ? '特殊KK币增加成功' : '特殊KK币扣减成功');
    } catch (error) {
      const errorData = getApiErrorData(error);
      if (errorData?.code === 'INSUFFICIENT_DIAMONDS') {
        const currentDiamonds = Number(errorData.data?.currentDiamonds);
        if (Number.isFinite(currentDiamonds)) {
          setSelectedUser((current) => current ? { ...current, diamonds: currentDiamonds } : current);
          setAmountError(`扣减数量不能超过当前余额 ${currentDiamonds} KK币`);
        }
        setIsConfirmOpen(false);
        setOperationId(null);
      } else if (errorData?.code === 'OPERATION_ID_CONFLICT') {
        setIsConfirmOpen(false);
        setOperationId(null);
      }
      toast.error(getApiErrorMessage(error, '特殊KK币变更失败'));
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isConfirmOpen) return undefined;
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) closeConfirmation();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeConfirmation, isConfirmOpen, isSubmitting]);

  const isBusy = isLookingUp || isSubmitting;
  const actionLabel = changeType === 'increment' ? '增加' : '扣减';

  return (
    <div className={styles.panelStack}>
      <section className={styles.heroCard}>
        <div className={styles.sectionBadge}>KK币管理</div>
        <h2 className={styles.heroTitle}>特殊 KK 币管理</h2>
        <p className={styles.heroDesc}>按 Kuran 号定位账号，安全地增加或扣减 KK 币。</p>
      </section>

      <div className={styles.managementGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>定位用户</h3>
              <p className={styles.cardDesc}>输入完整 Kuran 号进行精确查询。</p>
            </div>
          </div>
          <div className={styles.formArea}>
            <label className={styles.fieldLabel} htmlFor="admin-diamond-user-code">
              Kuran 号
            </label>
            <input
              id="admin-diamond-user-code"
              className={styles.textInput}
              value={userCode}
              onChange={(event) => handleUserCodeChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isBusy) void handleLookup();
              }}
              placeholder="请输入完整 Kuran 号"
              disabled={isBusy}
              autoComplete="off"
            />
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleLookup()}
              disabled={isBusy}
            >
              {isLookingUp ? '查询中...' : '查询用户'}
            </button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3 className={styles.cardTitle}>余额变更</h3>
              <p className={styles.cardDesc}>扣减后的账户余额最低为 0，备注仅供内部审计。</p>
            </div>
          </div>

          {selectedUser ? (
            <div className={styles.formArea}>
              <div className={styles.userCard}>
                <div>
                  <div className={styles.userName}>{selectedUser.nickname || '未命名用户'}</div>
                  <div className={styles.userMeta}>Kuran 号：{selectedUser.userCode || '-'}</div>
                  <div className={styles.userMeta}>手机号：{selectedUser.phoneNumber || '-'}</div>
                </div>
                <div className={styles.balanceBlock}>
                  <span>当前KK币</span>
                  <strong>{selectedUser.diamonds}</strong>
                </div>
              </div>

              <label className={styles.fieldLabel} htmlFor="admin-diamond-change-type">
                变更类型
              </label>
              <select
                id="admin-diamond-change-type"
                className={styles.select}
                value={changeType}
                onChange={(event) => handleChangeType(event.target.value as AdminDiamondChangeType)}
                disabled={isBusy}
              >
                <option value="increment">增加 KK 币</option>
                <option value="decrement">扣减 KK 币</option>
              </select>

              <label className={styles.fieldLabel} htmlFor="admin-diamond-amount">
                KK 币数量
              </label>
              <input
                id="admin-diamond-amount"
                className={`${styles.textInput} ${amountError ? styles.inputError : ''}`}
                type="number"
                min="1"
                step="1"
                value={amountInput}
                onChange={(event) => handleAdjustmentChange(event.target.value)}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? 'admin-diamond-amount-error' : undefined}
                disabled={isBusy}
              />
              {amountError ? (
                <div id="admin-diamond-amount-error" className={styles.fieldError} role="alert">
                  {amountError}
                </div>
              ) : null}

              <label className={styles.fieldLabel} htmlFor="admin-diamond-remark">
                内部备注（可选）
              </label>
              <textarea
                id="admin-diamond-remark"
                className={styles.textArea}
                value={remark}
                onChange={(event) => {
                  setRemark(event.target.value);
                  setOperationId(null);
                }}
                maxLength={500}
                placeholder="仅管理员审计可见，不会展示给用户"
                disabled={isBusy}
              />
              <div className={styles.remarkCount}>{remark.length}/500</div>

              <button
                type="button"
                className={changeType === 'decrement' ? styles.dangerButton : styles.primaryButton}
                onClick={openConfirmation}
                disabled={isBusy}
              >
                确认变更 KK 币
              </button>
            </div>
          ) : (
            <div className={styles.emptyState}>请先查询目标用户，再进行 KK 币变更。</div>
          )}
        </section>
      </div>

      <AdminManualAdjustmentHistory currency="diamonds" refreshKey={historyRefreshKey} />

      {isConfirmOpen && selectedUser ? (
        <div
          className={styles.confirmOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirmation();
          }}
        >
          <section
            className={styles.confirmDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-diamond-confirm-title"
          >
            <h3 id="admin-diamond-confirm-title" className={styles.confirmTitle}>确认{actionLabel} KK 币</h3>
            <p className={styles.confirmDesc}>请确认以下信息。提交后将立即修改账户余额并写入流水。</p>
            <dl className={styles.confirmDetails}>
              <div><dt>账号</dt><dd>{selectedUser.nickname || '未命名用户'}</dd></div>
              <div><dt>Kuran 号</dt><dd>{selectedUser.userCode}</dd></div>
              <div><dt>当前余额</dt><dd>{selectedUser.diamonds} KK币</dd></div>
              <div><dt>{actionLabel}数量</dt><dd>{amount} KK币</dd></div>
              <div><dt>变更后余额</dt><dd className={styles.confirmBalance}>{nextBalance} KK币</dd></div>
              <div><dt>内部备注</dt><dd>{remark.trim() || '无'}</dd></div>
            </dl>
            <div className={styles.actionRow}>
              <button type="button" className={styles.secondaryButton} onClick={closeConfirmation} disabled={isSubmitting}>
                取消
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                className={changeType === 'decrement' ? styles.dangerButton : styles.primaryButton}
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
              >
                {isSubmitting ? '提交中...' : `确认${actionLabel}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
};

export default DiamondAdminManager;
