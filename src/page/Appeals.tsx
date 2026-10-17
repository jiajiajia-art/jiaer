import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Navbar from '../components/Layout/Navbar';
import MobileBottomNav from '../components/Layout/MobileBottomNav';
import AppealSheet from '../components/Appeal/AppealSheet';
import appealApi from '../api/appeal/appealApi';
import type { AppealEligibleItem, AppealListItem } from '../api/appeal/appeal.type';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const relatedIdParam = useMemo(() => {
    const raw = searchParams.get('relatedId');
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  }, [searchParams]);

  const [eligible, setEligible] = useState<AppealEligibleItem[]>([]);
  const [mine, setMine] = useState<AppealListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingEligible, setLoadingEligible] = useState(true);
  const [loadingMine, setLoadingMine] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(Boolean(relatedIdParam));
  const [sheetRelatedId, setSheetRelatedId] = useState<number | null>(relatedIdParam);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
    if (relatedIdParam != null) {
      setSheetRelatedId(relatedIdParam);
      setSheetOpen(true);
    }
  }, [relatedIdParam]);

  const openSheet = (id?: number | null) => {
    setSheetRelatedId(id ?? null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetRelatedId(null);
    if (searchParams.has('relatedId')) {
      const next = new URLSearchParams(searchParams);
      next.delete('relatedId');
      setSearchParams(next, { replace: true });
    }
  };

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
          <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
            {t('common.close')}
          </button>
          <h1 className={styles.title}>{t('appeal.pageTitle')}</h1>
          <button type="button" className={styles.newBtn} onClick={() => openSheet(null)}>
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
                  <div className={styles.itemBody}>
                    <div className={styles.itemTitle}>
                      #{item.id} · {item.recordType}
                      {item.level != null ? ` L${item.level}` : ''}
                    </div>
                    <div className={styles.itemMeta}>{formatTime(item.createdAt)}</div>
                    <p className={styles.itemDesc}>{item.notifyBody || t('appeal.targetFallback')}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => openSheet(item.id)}
                  >
                    {t('appeal.goAppeal')}
                  </button>
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
                  <li key={item.id} className={styles.listItem}>
                    <div className={styles.itemBody}>
                      <div className={styles.itemTitle}>
                        #{item.id} · {statusLabel(String(item.status))}
                      </div>
                      <div className={styles.itemMeta}>
                        {t('appeal.relatedIdLabel', { id: item.relatedId })} · {formatTime(item.createdAt)}
                      </div>
                      <p className={styles.itemDesc}>{item.reason || '—'}</p>
                    </div>
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

      <AppealSheet
        isOpen={sheetOpen}
        relatedId={sheetRelatedId}
        onClose={closeSheet}
        onSubmitted={() => {
          void loadEligible();
          void loadMine(1);
        }}
      />
    </div>
  );
};

export default Appeals;
