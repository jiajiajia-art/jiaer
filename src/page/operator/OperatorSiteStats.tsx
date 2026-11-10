import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import ListPaginationBar, { buildListPagination, type ListPaginationState } from '../../components/ListPaginationBar';
import OperatorStatsDateModal from '../../components/stats/OperatorStatsDateModal';
import OperatorStatsKpiGrid from '../../components/stats/OperatorStatsKpiGrid';
import OperatorStatsPresetBar from '../../components/stats/OperatorStatsPresetBar';
import operatorStatsApi, {
  type OperatorStatsOverview,
  type OperatorWorkListItem,
  type OperatorWorksResolveType,
} from '../../api/stats/operatorStatsApi';
import {
  resolveOperatorCoverFallbackSrc,
  resolveOperatorCoverSrc,
} from '../../utils/operatorCoverUrl';
import {
  OPERATOR_METRIC_KEYS,
  OPERATOR_SEARCH_TYPES,
  type OperatorSortBy,
  type OperatorStatsPreset,
  type OperatorStatsSearchType,
  buildOperatorStatsQuery,
  formatOperatorPlayDuration,
  formatOperatorPublishedAt,
  formatOperatorWorkRank,
  operatorDeltaLabelKey,
  operatorMetricLabelKey,
  operatorSearchPlaceholderKey,
  operatorSearchTypeLabelKey,
  operatorCustomRangeDraft,
  parseOperatorStatsQuery,
  resolveOperatorStatsRange,
  validateOperatorStatsSearchQuery,
} from '../../utils/operatorStatsRange';
import styles from './OperatorSiteStats.module.css';
import shared from './OperatorStatsShared.module.css';

const emptyPagination: ListPaginationState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

const AUTHOR_SEARCH_TYPES: OperatorStatsSearchType[] = ['nickname', 'userCode', 'phone'];

const OperatorSiteStats: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const initialQuery = useMemo(() => parseOperatorStatsQuery(location.search), [location.search]);

  const [preset, setPreset] = useState<OperatorStatsPreset>(initialQuery.preset);
  const [startDate, setStartDate] = useState<string | undefined>(initialQuery.startDate);
  const [endDate, setEndDate] = useState<string | undefined>(initialQuery.endDate);
  const [sortBy, setSortBy] = useState<OperatorSortBy>(initialQuery.sortBy);
  const [order, setOrder] = useState<'asc' | 'desc'>(initialQuery.order);
  const [searchInput, setSearchInput] = useState(initialQuery.q);
  const [appliedQ, setAppliedQ] = useState(initialQuery.q);
  const [searchType, setSearchType] = useState<OperatorStatsSearchType>(initialQuery.searchType);
  const [creatorUserId, setCreatorUserId] = useState(initialQuery.creatorUserId);

  const [overview, setOverview] = useState<OperatorStatsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewFailed, setOverviewFailed] = useState(false);
  const [works, setWorks] = useState<OperatorWorkListItem[]>([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksFailed, setWorksFailed] = useState(false);
  const [resolveType, setResolveType] = useState<OperatorWorksResolveType>('none');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState<ListPaginationState>(emptyPagination);

  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [draftSortBy, setDraftSortBy] = useState<OperatorSortBy>('pv');

  const dateRange = useMemo(() => {
    if (preset === 'custom') {
      return resolveOperatorStatsRange('custom', { startDate, endDate });
    }
    return resolveOperatorStatsRange(preset);
  }, [preset, startDate, endDate]);

  const deltaLabel = t(operatorDeltaLabelKey(preset));

  const syncListUrl = useCallback((next: {
    preset: OperatorStatsPreset;
    startDate?: string;
    endDate?: string;
    sortBy: OperatorSortBy;
    order: 'asc' | 'desc';
    q?: string;
    searchType?: OperatorStatsSearchType;
    creatorUserId?: string;
  }) => {
    const query = buildOperatorStatsQuery({
      preset: next.preset,
      startDate: next.startDate,
      endDate: next.endDate,
      sortBy: next.sortBy,
      order: next.order,
      q: next.q,
      searchType: next.searchType,
      creatorUserId: next.creatorUserId,
    });
    navigate({ pathname: '/operator', search: query ? `?${query}` : '' }, { replace: true });
  }, [navigate]);

  const applyPreset = (nextPreset: OperatorStatsPreset) => {
    const range = resolveOperatorStatsRange(nextPreset);
    setPreset(nextPreset);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setPage(1);
    syncListUrl({
      preset: nextPreset,
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy,
      order,
      q: appliedQ,
      searchType,
      creatorUserId,
    });
  };

  const openCustomModal = () => {
    const range = operatorCustomRangeDraft(preset, { startDate, endDate });
    setDraftStart(range.startDate || '');
    setDraftEnd(range.endDate || '');
    setDraftSortBy(sortBy);
    setCustomOpen(true);
  };

  const applyCustomQuery = (next: { startDate: string; endDate: string; sortBy?: OperatorSortBy }) => {
    const nextSort = next.sortBy || draftSortBy;
    setPreset('custom');
    setStartDate(next.startDate);
    setEndDate(next.endDate);
    setSortBy(nextSort);
    setOrder('desc');
    setPage(1);
    setCustomOpen(false);
    syncListUrl({
      preset: 'custom',
      startDate: next.startDate,
      endDate: next.endDate,
      sortBy: nextSort,
      order: 'desc',
      q: appliedQ,
      searchType,
      creatorUserId,
    });
  };

  const resetCustomModal = () => {
    const range = resolveOperatorStatsRange('last7');
    setDraftStart(range.startDate || '');
    setDraftEnd(range.endDate || '');
    setDraftSortBy('pv');
    setPreset('last7');
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSortBy('pv');
    setOrder('desc');
    setPage(1);
    setCustomOpen(false);
    syncListUrl({
      preset: 'last7',
      startDate: range.startDate,
      endDate: range.endDate,
      sortBy: 'pv',
      order: 'desc',
      q: appliedQ,
      searchType,
      creatorUserId,
    });
  };

  const handleSort = (field: OperatorSortBy) => {
    const nextOrder = sortBy === field && order === 'desc' ? 'asc' : 'desc';
    const nextSort = field;
    setSortBy(nextSort);
    setOrder(nextOrder);
    setPage(1);
    syncListUrl({
      preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy: nextSort,
      order: nextOrder,
      q: appliedQ,
      searchType,
      creatorUserId,
    });
  };

  const runSearch = () => {
    const nextQ = searchInput.trim();
    if (!nextQ) {
      toast.error(t('operator.siteStats.searchHint'));
      return;
    }
    if (validateOperatorStatsSearchQuery(nextQ, searchType) === 'invalid') {
      toast.error(t('operator.siteStats.searchInvalid'));
      return;
    }
    setAppliedQ(nextQ);
    setCreatorUserId('');
    setResolveType('none');
    setPage(1);
    syncListUrl({
      preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy,
      order,
      q: nextQ,
      searchType,
      creatorUserId: '',
    });
  };

  const clearSearch = () => {
    setSearchInput('');
    setAppliedQ('');
    setCreatorUserId('');
    setResolveType('none');
    setPage(1);
    syncListUrl({
      preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy,
      order,
      q: '',
      searchType,
      creatorUserId: '',
    });
  };

  const clearAuthorFilter = () => {
    clearSearch();
  };

  const buildDetailPath = (fileId: string) => {
    const query = buildOperatorStatsQuery({
      preset,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      sortBy,
      order,
      q: appliedQ,
      searchType,
      creatorUserId,
    });
    return `/operator/works/${fileId}/stats${query ? `?${query}` : ''}`;
  };

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewFailed(false);
    try {
      const resp = await operatorStatsApi.getOverview({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        creatorUserId: creatorUserId || undefined,
      });
      if (resp.data.success && resp.data.data) {
        setOverview(resp.data.data);
        return;
      }
      throw new Error(resp.data.message || 'overview failed');
    } catch (error) {
      console.error('[OperatorSiteStats] overview failed', error);
      setOverviewFailed(true);
      toast.error(t('operator.statsOverviewLoadFailed'));
    } finally {
      setOverviewLoading(false);
    }
  }, [creatorUserId, dateRange.endDate, dateRange.startDate, t]);

  const loadWorks = useCallback(async () => {
    setWorksLoading(true);
    setWorksFailed(false);
    try {
      const offset = (page - 1) * pageSize;
      const hasQ = Boolean(appliedQ.trim());
      const resp = await operatorStatsApi.getWorks({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sortBy,
        order,
        limit: pageSize,
        offset,
        q: hasQ ? appliedQ : undefined,
        searchType: hasQ ? searchType : undefined,
        creatorUserId: creatorUserId || undefined,
      });
      if (!resp.data.success || !resp.data.data) {
        throw new Error(resp.data.message || 'works failed');
      }
      const payload = resp.data.data;
      const resolve = payload.resolve;
      const nextType = resolve?.type || 'none';
      setResolveType(nextType);

      // 功能注释：作品 ID 精确命中进详情；replace 避免「返回榜单」与详情互相堆历史
      if (nextType === 'workExact' && resolve?.fileId) {
        const query = buildOperatorStatsQuery({
          preset,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          sortBy,
          order,
          q: appliedQ,
          searchType,
          creatorUserId,
        });
        navigate(`/operator/works/${resolve.fileId}/stats${query ? `?${query}` : ''}`, { replace: true });
        return;
      }

      if (nextType === 'authorAmbiguous') {
        setCreatorUserId('');
        setWorks([]);
        setPagination(emptyPagination);
        return;
      }

      if (nextType === 'author' && resolve?.creatorUserId && resolve.creatorUserId !== creatorUserId) {
        setCreatorUserId(resolve.creatorUserId);
        const query = buildOperatorStatsQuery({
          preset,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          sortBy,
          order,
          q: appliedQ,
          searchType,
          creatorUserId: resolve.creatorUserId,
        });
        navigate({ pathname: '/operator', search: query ? `?${query}` : '' }, { replace: true });
      }

      if (
        hasQ
        && AUTHOR_SEARCH_TYPES.includes(searchType)
        && nextType !== 'author'
        && creatorUserId
      ) {
        setCreatorUserId('');
      }

      setWorks(payload.items || []);
      setPagination(buildListPagination(page, pageSize, payload.total ?? 0));
    } catch (error) {
      console.error('[OperatorSiteStats] works failed', error);
      setWorksFailed(true);
      setWorks([]);
      toast.error(t('operator.siteStats.loadFailed'));
    } finally {
      setWorksLoading(false);
    }
  }, [
    appliedQ,
    creatorUserId,
    dateRange.endDate,
    dateRange.startDate,
    navigate,
    order,
    page,
    pageSize,
    preset,
    searchType,
    sortBy,
    t,
  ]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    void loadWorks();
  }, [loadWorks]);

  const renderSortIndicator = (field: OperatorSortBy) => {
    const active = sortBy === field;
    const ascOn = active && order === 'asc';
    const descOn = active && order === 'desc';
    return (
      <span className={styles.sortChevrons} aria-hidden>
        <svg className={`${styles.sortChevron} ${ascOn ? styles.sortChevronOn : ''}`} viewBox="0 0 12 8" width="10" height="7">
          <path d="M6 1.2L10.5 6.2H1.5L6 1.2Z" fill="currentColor" />
        </svg>
        <svg className={`${styles.sortChevron} ${descOn ? styles.sortChevronOn : ''}`} viewBox="0 0 12 8" width="10" height="7">
          <path d="M6 6.8L1.5 1.8H10.5L6 6.8Z" fill="currentColor" />
        </svg>
      </span>
    );
  };

  const emptyMessage = () => {
    if (resolveType === 'authorAmbiguous') return t('operator.siteStats.authorAmbiguous');
    if (!appliedQ.trim()) return t('operator.siteStats.noWorksForFilter');
    if (resolveType === 'empty') {
      return AUTHOR_SEARCH_TYPES.includes(searchType)
        ? t('operator.siteStats.noAuthor')
        : t('operator.siteStats.noWorksForFilter');
    }
    if (resolveType === 'author' || creatorUserId) return t('operator.siteStats.authorNoWorks');
    return t('operator.siteStats.noWorksForFilter');
  };

  const dataAsOfText = overview?.dataAsOf
    ? formatOperatorPublishedAt(overview.dataAsOf)
    : '—';

  return (
    <div>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h1>{t('operator.siteStats.title')}</h1>
          <p className={styles.subtitle}>{t('operator.siteStats.subtitle')}</p>
        </div>
        <div className={styles.metaHint}>
          <div>{t('operator.siteStats.dataAsOf', { time: dataAsOfText })}</div>
        </div>
      </div>

      <OperatorStatsPresetBar
        preset={preset}
        onSelectPreset={applyPreset}
        onOpenCustom={openCustomModal}
      />

      <div className={styles.searchRow}>
        <select
          className={styles.searchTypeSelect}
          value={searchType}
          onChange={(event) => setSearchType(event.target.value as OperatorStatsSearchType)}
          aria-label={t('operator.siteStats.searchTypeLabel')}
        >
          {OPERATOR_SEARCH_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(operatorSearchTypeLabelKey(type))}
            </option>
          ))}
        </select>
        <div className={styles.searchField}>
          <input
            className={styles.searchInput}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') runSearch();
              if (event.key === 'Escape' && (searchInput || appliedQ || creatorUserId)) {
                clearSearch();
              }
            }}
            placeholder={t(operatorSearchPlaceholderKey(searchType))}
            aria-label={t('operator.siteStats.search')}
          />
          {searchInput || appliedQ || creatorUserId ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={clearSearch}
              aria-label={t('operator.siteStats.clearFilter')}
            >
              ×
            </button>
          ) : null}
        </div>
        <button type="button" className={styles.searchButton} onClick={runSearch}>
          {t('operator.siteStats.search')}
        </button>
      </div>
      {creatorUserId || (resolveType === 'author' && appliedQ) ? (
        <p className={styles.authorHint}>
          {t('operator.siteStats.authorFiltered')}
          {' '}
          <button type="button" className={shared.linkLikeButton} onClick={clearAuthorFilter}>
            {t('operator.siteStats.clearFilter')}
          </button>
        </p>
      ) : null}
      {resolveType === 'authorAmbiguous' ? (
        <p className={styles.authorHint}>{t('operator.siteStats.authorAmbiguous')}</p>
      ) : null}

      <OperatorStatsKpiGrid
        metrics={overview}
        deltaRatio={overview?.deltaRatio}
        deltaLabel={deltaLabel}
        loading={overviewLoading}
        loadFailed={overviewFailed}
        onRetry={() => { void loadOverview(); }}
      />

      <section className={shared.section}>
        <h2 className={shared.sectionTitle}>{t('operator.publicWorksTitle')}</h2>
        <div className={shared.tableWrap}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>{t('operator.siteStats.colRank')}</th>
                <th>{t('operator.siteStats.colWork')}</th>
                <th>{t('operator.siteStats.colAuthor')}</th>
                <th>{t('operator.siteStats.colPublishedAt')}</th>
                {OPERATOR_METRIC_KEYS.map((field) => {
                  const active = sortBy === field;
                  const ariaSort = active
                    ? (order === 'asc' ? 'ascending' : 'descending')
                    : 'none';
                  return (
                    <th key={field} className={shared.metricCol} aria-sort={ariaSort}>
                      <button
                        type="button"
                        className={`${styles.sortableHeader} ${active ? styles.sortableHeaderActive : ''}`}
                        onClick={() => handleSort(field)}
                        aria-label={`${t(operatorMetricLabelKey(field))}，${
                          active
                            ? (order === 'desc' ? t('operator.siteStats.sortDesc') : t('operator.siteStats.sortAsc'))
                            : t('operator.siteStats.sortIdle')
                        }`}
                      >
                        <span>{t(operatorMetricLabelKey(field))}</span>
                        {renderSortIndicator(field)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {works.map((work) => {
                const coverSrc = resolveOperatorCoverSrc(work.coverUrl);
                return (
                <tr key={work.fileId}>
                  <td>{formatOperatorWorkRank(work.rank, work.metrics?.[sortBy])}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.workCell}
                      onClick={() => navigate(buildDetailPath(work.fileId))}
                    >
                      {coverSrc ? (
                        <img
                          className={styles.workCellCover}
                          src={coverSrc}
                          alt=""
                          loading="lazy"
                          onError={(event) => {
                            const img = event.currentTarget;
                            const next = resolveOperatorCoverFallbackSrc(coverSrc, work.coverUrl);
                            if (!next || img.dataset.coverFallback === '1') {
                              img.style.visibility = 'hidden';
                              return;
                            }
                            img.dataset.coverFallback = '1';
                            img.src = next;
                          }}
                        />
                      ) : (
                        <span className={styles.workCellCoverPlaceholder} aria-hidden />
                      )}
                      <span className={styles.workCellTitle}>{work.title}</span>
                    </button>
                  </td>
                  <td>{work.creatorNickname || work.creatorUserId || '—'}</td>
                  <td>{formatOperatorPublishedAt(work.publishedAt)}</td>
                  <td className={shared.metricCol}>{(work.metrics?.pv ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>{(work.metrics?.uv ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>{(work.metrics?.playCount ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>
                    {formatOperatorPlayDuration(work.metrics?.playDurationSeconds ?? 0)}
                  </td>
                  <td className={shared.metricCol}>{(work.metrics?.likeCount ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>{(work.metrics?.favoriteCount ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>{(work.metrics?.commentCount ?? 0).toLocaleString()}</td>
                  <td className={shared.metricCol}>{(work.metrics?.spendPoints ?? 0).toLocaleString()}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
          {!worksLoading && works.length === 0 ? (
            <div className={shared.emptyState}>
              <div>{worksFailed ? t('operator.siteStats.loadFailed') : emptyMessage()}</div>
              {worksFailed ? (
                <button type="button" className={shared.linkLikeButton} onClick={() => { void loadWorks(); }}>
                  {t('operator.statsOverviewRetry')}
                </button>
              ) : null}
            </div>
          ) : null}
          {worksLoading ? <div className={shared.emptyState}>{t('creatorStats.loading')}</div> : null}
        </div>
        <ListPaginationBar
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          disabled={worksLoading}
          i18nPrefix="operator.pagination"
        />
      </section>

      <OperatorStatsDateModal
        open={customOpen}
        title={t('operator.siteStats.customTitle')}
        startDate={draftStart}
        endDate={draftEnd}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onClose={() => setCustomOpen(false)}
        onSubmit={applyCustomQuery}
        sortBy={draftSortBy}
        onSortByChange={setDraftSortBy}
        showRankMetric
        secondaryAction={{
          label: t('operator.siteStats.reset'),
          onClick: resetCustomModal,
        }}
      />
    </div>
  );
};

export default OperatorSiteStats;
