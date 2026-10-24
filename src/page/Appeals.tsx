import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import appealApi from '../api/appeal/appealApi';
import type { AppealEligibleItem, AppealListItem } from '../api/appeal/appeal.type';
import { formatAppealRecordTitle } from '../lib/appealRecordLabel';
import { readRelatedModerationIdParam } from '../lib/externalModerationId';
import { getApiErrorMessage } from '../utils/error';
import styles from './Appeals.module.css';

const PAGE_SIZE = 20;

const formatTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
};

const Appeals: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const relatedModerationIdParam = useMemo(
    () => readRelatedModerationIdParam(searchParams),
    [searchParams],
  );

  const [eligible, setEligible] = useState<AppealEligibleItem[]>([]);
  const [mine, setMine] = useState<AppealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const openSubmit = (id?: string | null) => {
    if (id) {
      navigate(`/appeal/submit?relatedModerationId=${encodeURIComponent(id)}`);
      return;
    }
    navigate('/appeal/submit');
  };

  const loadEligible = useCallback(async () => {
    setLoadingEligible(true);
    try {
      const res = await appealApi.getEligible();
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('appeal.loadEligibleFailed'));
      }
      setEligible((res.data.data.list || []).filter((item) => item.canAppeal !== false));
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('appeal.loadEligibleFailed')));
      setEligible([]);
    } finally {
      setLoadingEligible(false);
    }
  }, [t]);

  const loadMine = useCallback(async (nextPage = page) => {
    setLoadingMine(true);
    try {
      const res = await appealApi.listMine({ page: nextPage, pageSize: PAGE_SIZE });
      if (!res.data.success || !res.data.data) {
        throw new Error(res.data.message || t('appeal.loadMineFailed'));
      }
      setMine(res.data.data.list || []);
      setTotal(res.data.data.total || 0);
      setPage(res.data.data.page || nextPage);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, t('appeal.loadMineFailed')));
      setMine([]);
      setTotal(0);
    } finally {
      setLoadingMine(false);
    }
  }, [page, t]);

  useEffect(() => {
    void loadEligible();
  }, [loadEligible]);

  useEffect(() => {
    void loadMine(1);
    // 仅挂载拉第一页；翻页走按钮
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (relatedModerationIdParam != null) {
      navigate(`/appeal/submit?relatedModerationId=${encodeURIComponent(relatedModerationIdParam)}`, { replace: true });
    }
  }, [navigate, relatedModerationIdParam]);

  const statusLabel = (status: string) => {
    if (status === 'pending') return t('appeal.statusPending');
    if (status === 'approved') return t('appeal.statusApproved');
    if (status === 'rejected') return t('appeal.statusRejected');
    return status;
  };

  return (
    <div className={styles.pageRoot}>
      <Navbar />
      <div className={styles.main}>
        <header className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate(-1)}
            aria-label={t('appeal.back')}
            title={t('appeal.back')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 6L9 12L15 18" />
            </svg>
          </button>
          <h1 className={styles.title}>{t('appeal.pageTitle')}</h1>
          <button type="button" className={styles.newBtn} onClick={() => openSubmit(null)}>
            {t('appeal.newAppeal')}
          </button>
        </header>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('appeal.eligibleSection')}</h2>
          {loadingEligible ? (
            <p className={styles.empty}>{t('common.loading')}</p>
          ) : eligible.length === 0 ? (
            <p className={styles.empty}>{t('appeal.noEligible')}</p>
          ) : (
            <ul className={styles.list}>
              {eligible.map((item) => (
                <li key={item.id} className={styles.listItem}>
                  <div className={styles.itemHead}>
                    <div className={styles.itemTitle}>
                      {formatAppealRecordTitle(t, item.recordType, item.level)}
                    </div>
                    <time className={styles.itemMeta}>{formatTime(item.createdAt)}</time>
                  </div>
                  <p className={styles.itemDesc}>{item.notifyBody || t('appeal.targetFallback')}</p>
                  <div className={styles.itemFoot}>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => openSubmit(item.id)}
                    >
                      {t('appeal.goAppeal')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>{t('appeal.mineSection')}</h2>
          {loadingMine ? (
            <p className={styles.empty}>{t('common.loading')}</p>
          ) : mine.length === 0 ? (
            <p className={styles.empty}>{t('appeal.noMine')}</p>
          ) : (
            <>
              <ul className={styles.list}>
                {mine.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={styles.listItem}
                      onClick={() => navigate(`/appeals/${item.id}`)}
                    >
                      <div className={styles.itemHead}>
                        <div className={styles.itemTitle}>
                          {statusLabel(String(item.status))}
                        </div>
                        <time className={styles.itemMeta}>{formatTime(item.createdAt)}</time>
                      </div>
                      <p className={styles.itemDesc}>{item.reason || '—'}</p>
                    </button>
                  </li>
                ))}
              </ul>
              {totalPages > 1 ? (
                <div className={styles.pagination}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page <= 1}
                    onClick={() => void loadMine(page - 1)}
                  >
                    {t('appeal.prevPage')}
                  </button>
                  <span className={styles.pageInfo}>{page} / {totalPages}</span>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    disabled={page >= totalPages}
                    onClick={() => void loadMine(page + 1)}
                  >
                    {t('appeal.nextPage')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default Appeals;
