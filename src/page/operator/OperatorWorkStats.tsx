import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import AdminShell from '../../components/admin-shell/AdminShell';
import ListPaginationBar, { buildListPagination, type ListPaginationState } from '../../components/ListPaginationBar';
import OperatorStatsKpiGrid from '../../components/stats/OperatorStatsKpiGrid';
import operatorStatsApi, {
  type OperatorWorkDailyDay,
  type OperatorWorkDetail,
} from '../../api/stats/operatorStatsApi';
import {
  type OperatorStatsPreset,
  buildOperatorStatsQuery,
  formatOperatorPlayDuration,
  formatOperatorKkAmount,
  formatOperatorTokenCount,
  formatOperatorPublishedAt,
  formatOperatorWorkRank,
  operatorDeltaLabelKey,
  operatorPresetLabelKey,
  operatorCustomRangeDraft,
  operatorCustomRangeError,
  parseOperatorStatsQuery,
  resolveOperatorCoverFallbackSrc,
  resolveOperatorCoverSrc,
  resolveOperatorStatsRange,
} from '../../utils/operatorStatsRange';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorSiteStats.module.css';

const emptyDailyPagination: ListPaginationState = {
  page: 1,
  pageSize: 50,
  total: 0,
  totalPages: 1,
};

const DETAIL_PRESETS: OperatorStatsPreset[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
];

const OperatorWorkStats: React.FC = () => {
  const { fileId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const initialQuery = useMemo(() => parseOperatorStatsQuery(location.search), [location.search]);

  const [preset, setPreset] = useState<OperatorStatsPreset>(
    initialQuery.preset === 'lastMonth' ? 'custom' : initialQuery.preset,
  );
  const [startDate, setStartDate] = useState<string | undefined>(initialQuery.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(initialQuery.endDate);
  const [sortBy] = useState(initialQuery.sortBy);
  const [order] = useState(initialQuery.order);
  const [q] = useState(initialQuery.q);
  const [searchType] = useState(initialQuery.searchType);
  const [creatorUserId] = useState(initialQuery.creatorUserId);

  const [detail, setDetail] = useState<OperatorWorkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailFailed, setDetailFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [days, setDays] = useState<OperatorWorkDailyDay[]>([]);
  const [dailyNote, setDailyNote] = useState('');
  const [dailyFailed, setDailyFailed] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyPage, setDailyPage] = useState(1);
  const [dailyPageSize, setDailyPageSize] = useState(50);
  const [dailyPagination, setDailyPagination] = useState<ListPaginationState>(emptyDailyPagination);

  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      return resolveOperatorStatsRange('custom', { startDate, endDate });
    }
    return resolveOperatorStatsRange(preset);
  }, [preset, startDate, endDate]);

  /** 功能注释：「全部」不传日期，后端按 published_at～今天按日 + limit/offset */
  const isAllTimeDaily = !dateRange.startDate && !dateRange.endDate;

  const deltaLabel = t(operatorDeltaLabelKey(preset));

  // 功能注释：返回榜单时若 q 仍是当前作品 ID，列表会再次 workExact 跳回详情，故需剥掉
  const listQuery = useMemo(() => {
    const qTrim = String(q || '').trim();
    const idTrim = String(fileId || '').trim();
    const keepQ = qTrim && qTrim !== idTrim ? qTrim : '';
    return buildOperatorStatsQuery({
      preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy,
      order,
      q: keepQ || undefined,
      searchType: keepQ ? searchType : undefined,
      creatorUserId: creatorUserId || undefined,
    });
  }, [creatorUserId, dateRange.endDate, dateRange.startDate, fileId, order, preset, q, searchType, sortBy]);

  const syncDetailUrl = useCallback((nextPreset: OperatorStatsPreset, range: { startDate?: string; endDate?: string }) => {
    const query = buildOperatorStatsQuery({
      preset: nextPreset,
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy,
      order,
      q,
      searchType: q ? searchType : undefined,
      creatorUserId,
    });
    navigate(
      { pathname: `/operator/works/${fileId}/stats`, search: query ? `?${query}` : '' },
      { replace: true },
    );
  }, [creatorUserId, fileId, navigate, order, q, searchType, sortBy]);

  const applyPreset = (nextPreset: OperatorStatsPreset) => {
    const range = resolveOperatorStatsRange(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setDailyPage(1);
    syncDetailUrl(nextPreset, range);
  };

  const openCustomModal = () => {
    const range = operatorCustomRangeDraft(preset, { startDate, endDate });
    setDraftStart(range.startDate || '');
    setDraftEnd(range.endDate || '');
    setCustomOpen(true);
  };

  const applyCustomRange = () => {
    const rangeError = operatorCustomRangeError(draftStart, draftEnd);
    if (rangeError) {
      toast.error(t(`operator.siteStats.customDate${rangeError === 'required' ? 'Required' : 'Invalid'}`));
      return;
    }
    setPreset('custom');
    setStartDate(draftStart);
    setEndDate(draftEnd);
    setDailyPage(1);
    setCustomOpen(false);
    syncDetailUrl('custom', { startDate: draftStart, endDate: draftEnd });
  };

  const detailRequest = useRef(0);
  const loadDetail = useCallback(async () => {
    const requestId = ++detailRequest.current;
    if (!fileId) return;
    setDetailLoading(true);
    setDetail(null);
    setDetailFailed(false);
    setNotFound(false);
    try {
      const resp = await operatorStatsApi.getWorkDetail(fileId, {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sortBy,
        order,
        q: q || undefined,
        searchType: q ? searchType : undefined,
        creatorUserId: creatorUserId || undefined,
      });
      if (requestId !== detailRequest.current) return;
      if (resp.data.success && resp.data.data) {
        setDetail(resp.data.data);
        return;
      }
      throw new Error(resp.data.message || 'detail failed');
    } catch (error: unknown) {
      if (requestId !== detailRequest.current) return;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setNotFound(true);
        setDetail(null);
        return;
      }
      console.error('[OperatorWorkStats] detail failed', error);
      setDetailFailed(true);
      toast.error(t('operator.siteStats.loadFailed'));
    } finally {
      if (requestId === detailRequest.current) setDetailLoading(false);
    }
  }, [dateRange.endDate, dateRange.startDate, fileId, sortBy, order, q, searchType, creatorUserId, t]);

  const dailyRequest = useRef(0);
  const loadDaily = useCallback(async () => {
    const requestId = ++dailyRequest.current;
    if (!fileId) return;

    const start = dateRange.startDate;
    const end = dateRange.endDate;

    if (!isAllTimeDaily && (!start || !end)) {
      setDailyLoading(false);
      setDays([]);
      setDailyPagination(emptyDailyPagination);
      setDailyFailed(false);
      setDailyNote(t('operator.siteStats.dailyNeedRange'));
      return;
    }

    setDailyNote('');
    setDailyFailed(false);
    setDailyLoading(true);
    setDays([]);
    try {
      // 功能注释：有限区间一次全量；「全部」不传日期，服务端 published_at～今天 + 分页
      const resp = await operatorStatsApi.getWorkDaily(
        fileId,
        isAllTimeDaily
          ? {
            limit: dailyPageSize,
            offset: (dailyPage - 1) * dailyPageSize,
          }
          : {
            startDate: start,
            endDate: end,
          },
      );
      if (requestId !== dailyRequest.current) return;
      if (resp.data.success && resp.data.data) {
        const payload = resp.data.data;
        setDays(payload.days || []);
        if (isAllTimeDaily) {
          setDailyPagination(buildListPagination(
            dailyPage,
            dailyPageSize,
            Number(payload.total ?? payload.days?.length ?? 0),
          ));
        } else {
          setDailyPagination(emptyDailyPagination);
        }
        return;
      }
      setDays([]);
      setDailyPagination(emptyDailyPagination);
      setDailyFailed(true);
      setDailyNote(t('operator.siteStats.loadFailed'));
      toast.error(t('operator.siteStats.loadFailed'));
    } catch (error) {
      if (requestId !== dailyRequest.current) return;
      console.error('[OperatorWorkStats] daily failed', error);
      setDays([]);
      setDailyPagination(emptyDailyPagination);
      setDailyFailed(true);
      setDailyNote(t('operator.siteStats.loadFailed'));
      toast.error(t('operator.siteStats.loadFailed'));
    } finally {
      if (requestId === dailyRequest.current) setDailyLoading(false);
    }
  }, [
    dailyPage,
    dailyPageSize,
    dateRange.endDate,
    dateRange.startDate,
    fileId,
    isAllTimeDaily,
    t,
  ]);

  useEffect(() => {
    void loadDetail();
    return () => { detailRequest.current += 1; };
  }, [loadDetail]);

  useEffect(() => {
    void loadDaily();
    return () => { dailyRequest.current += 1; };
  }, [loadDaily]);

  const rankText = formatOperatorWorkRank(
    detail?.rank,
    detail ? Number(detail[sortBy] ?? 0) : 0,
  );

  const coverSrc = resolveOperatorCoverSrc(detail?.coverUrl);

  return (
    <AdminShell mode="operator" activeKey="stats">
      <div className={adminStyles.pageRoot}>
      <div className={adminStyles.pageBody}>
        <div className={adminStyles.contentArea}>
          <button
            type="button"
            className={styles.backChip}
            onClick={() => navigate(`/operator${listQuery ? `?${listQuery}` : ''}`)}
          >
            {'< '}{t('operator.siteStats.backToList')}
          </button>

          {notFound ? (
            <div className={styles.emptyState}>{t('operator.siteStats.workNotFound')}</div>
          ) : (
            <>
              <section className={styles.workHero}>
                {coverSrc ? (
                  <img
                    className={styles.workHeroCover}
                    src={coverSrc}
                    alt=""
                    onError={(event) => {
                      const img = event.currentTarget;
                      const next = resolveOperatorCoverFallbackSrc(coverSrc, detail?.coverUrl);
                      if (!next || img.dataset.coverFallback === '1') {
                        img.style.visibility = 'hidden';
                        return;
                      }
                      img.dataset.coverFallback = '1';
                      img.src = next;
                    }}
                  />
                ) : (
                  <div className={styles.workHeroCoverPlaceholder} aria-hidden />
                )}
                <div className={styles.workHeroBody}>
                  <h1 className={styles.workHeroTitle}>
                    {detail?.title || t('creatorStats.workStatsTitle')}
                  </h1>
                  <dl className={styles.workMetaGrid}>
                    <div className={`${styles.workMetaItem} ${styles.workMetaWide}`}>
                      <dt>{t('operator.siteStats.workId')}</dt>
                      <dd>{fileId || '—'}</dd>
                    </div>
                    <div className={styles.workMetaItem}>
                      <dt>{t('operator.siteStats.colAuthor')}</dt>
                      <dd>{detail?.creatorNickname || '—'}</dd>
                    </div>
                    <div className={`${styles.workMetaItem} ${styles.workMetaWide}`}>
                      <dt>{t('operator.siteStats.authorId')}</dt>
                      <dd>{detail?.creatorUserId || '—'}</dd>
                    </div>
                    <div className={styles.workMetaItem}>
                      <dt>{t('operator.siteStats.colPublishedAt')}</dt>
                      <dd>{formatOperatorPublishedAt(detail?.publishedAt, { withTime: true })}</dd>
                    </div>
                    <div className={`${styles.workMetaItem} ${styles.workMetaRank}`}>
                      <dt>{t('operator.siteStats.currentRank')}</dt>
                      <dd>{rankText}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <div className={styles.presetRow}>
                <div className={styles.presetRowMain}>
                  {DETAIL_PRESETS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`${styles.presetButton} ${preset === item ? styles.presetButtonActive : ''}`}
                      onClick={() => applyPreset(item)}
                    >
                      {t(operatorPresetLabelKey(item))}
                    </button>
                  ))}
                </div>
                <div className={styles.presetRowEnd}>
                  <button
                    type="button"
                    className={`${styles.presetButton} ${preset === 'all' ? styles.presetButtonActive : ''}`}
                    onClick={() => applyPreset('all')}
                  >
                    {t(operatorPresetLabelKey('all'))}
                  </button>
                  <button
                    type="button"
                    className={`${styles.presetButton} ${preset === 'custom' ? styles.presetButtonActive : ''}`}
                    onClick={openCustomModal}
                  >
                    {t('operator.siteStats.presetCustom')}
                  </button>
                </div>
              </div>

              <OperatorStatsKpiGrid
                metrics={detail}
                deltaRatio={detail?.deltaRatio}
                deltaLabel={deltaLabel}
                loading={detailLoading}
                loadFailed={detailFailed}
                onRetry={() => { void loadDetail(); }}
              />

              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{t('operator.siteStats.dailyTitle')}</h2>
                {dailyNote ? (
                  <div className={styles.emptyState}>
                    <div>{dailyNote}</div>
                    {dailyFailed ? (
                      <button
                        type="button"
                        className={styles.linkLikeButton}
                        onClick={() => { void loadDaily(); }}
                      >
                        {t('operator.statsOverviewRetry')}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {!dailyNote ? (
                  <>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>{t('operator.siteStats.colDate')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricPv')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricUv')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricPlayCount')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricPlayDuration')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricLikes')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricFavorites')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricComments')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricSpend')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricSpendKk')}</th>
                            <th className={styles.metricCol}>{t('operator.siteStats.metricAiTokens')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {days.map((day) => (
                            <tr key={day.date}>
                              <td>{day.date}</td>
                              <td className={styles.metricCol}>{day.pv.toLocaleString()}</td>
                              <td className={styles.metricCol}>{day.uv.toLocaleString()}</td>
                              <td className={styles.metricCol}>{day.playCount.toLocaleString()}</td>
                              <td className={styles.metricCol}>{formatOperatorPlayDuration(day.playDurationSeconds)}</td>
                              <td className={styles.metricCol}>{day.likeCount.toLocaleString()}</td>
                              <td className={styles.metricCol}>{day.favoriteCount.toLocaleString()}</td>
                              <td className={styles.metricCol}>{day.commentCount.toLocaleString()}</td>
                              <td className={styles.metricCol}>{day.spendPoints.toLocaleString()}</td>
                              <td className={styles.metricCol}>{formatOperatorKkAmount(day.spendKkMinor)}</td>
                              <td className={styles.metricCol}>{formatOperatorTokenCount(day.aiTokens)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {dailyLoading ? (
                        <div className={styles.emptyState}>{t('creatorStats.loading')}</div>
                      ) : null}
                      {!dailyLoading && days.length === 0 ? (
                        <div className={styles.emptyState}>{t('operator.siteStats.noDailyRows')}</div>
                      ) : null}
                    </div>
                    {isAllTimeDaily ? (
                      <ListPaginationBar
                        pagination={dailyPagination}
                        onPageChange={setDailyPage}
                        onPageSizeChange={(next) => {
                          setDailyPageSize(next);
                          setDailyPage(1);
                        }}
                        disabled={dailyLoading}
                        i18nPrefix="operator.pagination"
                      />
                    ) : null}
                  </>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>

      {customOpen ? (
        <div className={styles.modalOverlay} role="presentation" onClick={() => setCustomOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{t('operator.siteStats.customDateOnlyTitle')}</h3>
              <button type="button" className={styles.modalClose} onClick={() => setCustomOpen(false)}>
                ×
              </button>
            </div>
            <div className={styles.modalSection}>
              <span className={styles.modalLabel}>{t('operator.siteStats.timeRange')}</span>
              <div className={styles.dateRangeRow}>
                <input
                  className={styles.dateInput}
                  type="date"
                  value={draftStart}
                  onChange={(event) => setDraftStart(event.target.value)}
                />
                <span>~</span>
                <input
                  className={styles.dateInput}
                  type="date"
                  value={draftEnd}
                  onChange={(event) => setDraftEnd(event.target.value)}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.secondaryButton} onClick={() => setCustomOpen(false)}>
                {t('common.cancel')}
              </button>
              <button type="button" className={styles.primaryButton} onClick={applyCustomRange}>
                {t('operator.siteStats.queryRank')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </AdminShell>
  );
};

export default OperatorWorkStats;
