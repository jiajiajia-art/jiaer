import React, { useCallback, useEffect, useState } from 'react';
import adminManualAdjustmentsApi, {
  ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE,
} from '../api/admin/adminManualAdjustmentsApi';
import type {
  AdminManualAdjustmentCurrency,
  AdminManualAdjustmentHistoryItem,
  AdminManualAdjustmentPage,
} from '../api/admin/adminManualAdjustmentsApi';
import { getApiErrorMessage } from '../utils/error';
import styles from './AdminManualAdjustmentHistory.module.css';

type AdminManualAdjustmentHistoryProps = {
  currency: AdminManualAdjustmentCurrency;
  refreshKey: number;
};

const EMPTY_PAGE: AdminManualAdjustmentPage = {
  items: [],
  page: 1,
  pageSize: ADMIN_MANUAL_ADJUSTMENT_PAGE_SIZE,
  total: 0,
  totalPages: 0,
};

function formatAccount(account: AdminManualAdjustmentHistoryItem['operator']) {
  return `${account.nickname || '未命名用户'}（${account.userCode || '-'}）`;
}

function formatTime(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false });
}

const AdminManualAdjustmentHistory: React.FC<AdminManualAdjustmentHistoryProps> = ({
  currency,
  refreshKey,
}) => {
  const [data, setData] = useState<AdminManualAdjustmentPage>(EMPTY_PAGE);
  const [requestedPage, setRequestedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const currencyLabel = currency === 'points' ? '织梦豆' : 'KK币';

  const loadPage = useCallback(async (page: number) => {
    setRequestedPage(page);
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = currency === 'points'
        ? await adminManualAdjustmentsApi.listPoints(page)
        : await adminManualAdjustmentsApi.listDiamonds(page);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || `特殊${currencyLabel}变更记录加载失败`);
      }
      setData(response.data.data);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, `特殊${currencyLabel}变更记录加载失败`));
    } finally {
      setIsLoading(false);
    }
  }, [currency, currencyLabel]);

  useEffect(() => {
    setData(EMPTY_PAGE);
    void loadPage(1);
  }, [loadPage, refreshKey]);

  const totalPages = Math.max(data.totalPages, 1);
  const canGoPrevious = requestedPage > 1 && !isLoading;
  const canGoNext = requestedPage < data.totalPages && !isLoading;

  return (
    <section className={styles.historyCard}>
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>特殊{currencyLabel}变更记录</h3>
          <p className={styles.description}>展示全平台由管理员执行的特殊{currencyLabel}变更，每页 10 条。</p>
        </div>
        <div className={styles.totalCount}>共 {data.total} 条</div>
      </div>

      {isLoading && data.items.length === 0 ? (
        <div className={styles.stateBox} aria-live="polite">正在加载变更记录...</div>
      ) : errorMessage ? (
        <div className={styles.stateBox} role="alert">
          <span>{errorMessage}</span>
          <button type="button" className={styles.retryButton} onClick={() => void loadPage(requestedPage)}>
            重新加载
          </button>
        </div>
      ) : data.items.length === 0 ? (
        <div className={styles.stateBox}>暂无特殊{currencyLabel}变更记录。</div>
      ) : (
        <div className={styles.tableWrapper} aria-busy={isLoading}>
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>操作人</th>
                <th>变更用户</th>
                <th>变更情况</th>
                <th>备注</th>
                <th>操作时间</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const action = item.changeType === 'increment' ? '增加' : '扣减';
                return (
                  <tr key={item.id}>
                    <td>{formatAccount(item.operator)}</td>
                    <td>{formatAccount(item.targetUser)}</td>
                    <td className={item.changeType === 'increment' ? styles.increase : styles.decrease}>
                      {action} {item.amount} {currencyLabel}
                    </td>
                    <td className={styles.remarkCell}>{item.remark || '-'}</td>
                    <td className={styles.timeCell}>{formatTime(item.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.paginationRow}>
        <span>第 {requestedPage} 页，共 {totalPages} 页</span>
        <div className={styles.paginationActions}>
          <button
            type="button"
            className={styles.pageButton}
            disabled={!canGoPrevious}
            onClick={() => void loadPage(requestedPage - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className={styles.pageButton}
            disabled={!canGoNext}
            onClick={() => void loadPage(requestedPage + 1)}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
};

export default AdminManualAdjustmentHistory;
