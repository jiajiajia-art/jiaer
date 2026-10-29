import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { IoArrowBack } from 'react-icons/io5';
import Navbar from '../components/Layout/Navbar';
import FooterArea from '../components/Layout/FooterArea';
import withdrawApi, { type WithdrawRecord } from '../api/withdraw/withdrawApi';
import {
  WITHDRAW_RECORDS_PAGE_SIZE,
  withdrawListTotalPages,
} from '../utils/withdrawRules';
import { getApiErrorMessage } from '../utils/error';
import { useAuthStore } from '../store/useAuthStore';
import createStyles from './Create.module.css';
import styles from './WithdrawRecords.module.css';

/**
 * 创作者提现记录独立页：头部对齐创作中心，列表采用宽松表格卡片。
 */
const WithdrawRecords: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<WithdrawRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(WITHDRAW_RECORDS_PAGE_SIZE);

  const userName = user?.user?.nickname || user?.user?.name || t('create.userNameDefault');
  const userCode = user?.user?.userCode || '';

  const statusLabel = (status: string) => {
    if (status === 'pending') return t('create.withdrawStatusPending');
    if (status === 'approved') return t('create.withdrawStatusApproved');
    if (status === 'rejected') return t('create.withdrawStatusRejected');
    return status;
  };

  const statusClassName = (status: string) => {
    if (status === 'pending') return styles.statusPending;
    if (status === 'approved') return styles.statusApproved;
    if (status === 'rejected') return styles.statusRejected;
    return '';
  };

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const resp = await withdrawApi.list({ page: nextPage, pageSize });
      if (!resp.data.success) {
        toast.error(resp.data.message || t('create.withdrawLoadFailed'));
        return;
      }
      const data = resp.data.data;
      setRecords(data?.list || []);
      setTotal(Number(data?.pagination?.total || 0));
      setPage(Number(data?.pagination?.page || nextPage));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('create.withdrawLoadFailed')));
    } finally {
      setLoading(false);
    }
  }, [pageSize, t]);

  useEffect(() => {
    void load(1);
  }, [load]);

  const totalPages = withdrawListTotalPages(total, pageSize);

  const pageHint = useMemo(
    () => t('create.withdrawRecordsPage', { page, totalPages }),
    [page, totalPages, t],
  );

  return (
    <div className={createStyles.pageRoot}>
      <Navbar />

      <div className={`${createStyles.mainContent} ${styles.mainContent}`}>
        <div className={createStyles.main}>
          <section className={`${createStyles.creatorHeroSection} ${styles.heroSection}`}>
            <div className={`${createStyles.creatorHeroCard} ${styles.heroCard}`}>
              <div className={styles.heroTopBar}>
                <div className={createStyles.creatorHeroEyebrow}>Creator Studio</div>
                <button
                  type="button"
                  className={`${createStyles.draftManageButton} ${styles.backToCreateButton}`}
                  onClick={() => navigate('/profile')}
                >
                  <IoArrowBack aria-hidden />
                  {t('create.withdrawRecordsBackToCreate')}
                </button>
              </div>

              <h1 className={`${createStyles.creatorHeroName} ${styles.heroTitle}`}>
                {t('create.myWithdrawRecords')}
              </h1>

              <p className={styles.heroMeta}>
                <span>{t('create.withdrawRecordsAccountLabel')} · {userName}</span>
                <span className={styles.heroMetaDot} aria-hidden>·</span>
                <span>{t('create.kuranIdPrefix')}{userCode || '—'}</span>
              </p>
            </div>
          </section>

          <section className={styles.recordsPanel}>
            {loading ? (
              <div className={styles.panelState}>{t('create.withdrawLoading')}</div>
            ) : null}

            {!loading && records.length === 0 ? (
              <div className={styles.panelState}>{t('create.withdrawRecordsEmpty')}</div>
            ) : null}

            {!loading && records.length > 0 ? (
              <>
                <div className={styles.tableHead} aria-hidden>
                  <span>{t('create.withdrawRecordsColTime')}</span>
                  <span>{t('create.withdrawRecordsColAmount')}</span>
                  <span>{t('create.withdrawRecordsColCny')}</span>
                  <span>{t('create.withdrawRecordsColStatus')}</span>
                  <span>{t('create.withdrawRecordsColRemark')}</span>
                </div>
                <ul className={styles.list}>
                  {records.map((item) => (
                    <li key={item.id} className={styles.item}>
                      <div className={styles.itemRow}>
                        <span className={styles.time}>{item.createdAt?.slice(0, 10)}</span>
                        <span className={styles.amount}>
                          {item.amount}
                          {t('create.diamondUnit')}
                        </span>
                        <span className={styles.cny}>¥{item.amountCny}</span>
                        <span className={`${styles.statusText} ${statusClassName(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        <span className={item.status === 'rejected' && item.remark ? styles.remark : styles.remarkEmpty}>
                          {item.status === 'rejected' && item.remark ? (
                            <>
                              <span className={styles.remarkLabel}>{t('create.withdrawRecordsColRemark')}：</span>
                              <span className={styles.remarkText}>{item.remark}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pagerButton}
                disabled={loading || page <= 1}
                onClick={() => void load(page - 1)}
              >
                {t('create.withdrawRecordsPrev')}
              </button>
              <span className={styles.pagerInfo}>{pageHint}</span>
              <button
                type="button"
                className={styles.pagerButton}
                disabled={loading || page >= totalPages}
                onClick={() => void load(page + 1)}
              >
                {t('create.withdrawRecordsNext')}
              </button>
            </div>
          </section>
        </div>
      </div>

      <FooterArea />
    </div>
  );
};

export default WithdrawRecords;
