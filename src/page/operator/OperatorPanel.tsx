import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Navbar from '../../components/Layout/Navbar';
import PromotionAdminManager from '../../components/PromotionAdminManager';
import DailyTasksAdminManager from '../../components/DailyTasksAdminManager';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/admin/MetricSummary.module.css';
import ListPaginationBar, { buildListPagination, type ListPaginationState } from '../../components/ListPaginationBar';
import operatorStatsApi, {
  type RecruitmentOverview,
  type RecruitmentUserItem,
} from '../../api/stats/operatorStatsApi';
import type { CreatorWorkItem, StatsOverview } from '../../api/stats/creatorStatsApi';
import OperatorReports from './OperatorReports';
import WithdrawAdminManager from '../../components/WithdrawAdminManager';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorPanel.module.css';

type OperatorTab = 'stats' | 'reports' | 'promotions' | 'recruitment' | 'dailyTasks' | 'withdraw';
type WorksSortField = 'playCount' | 'pv' | 'shareCount';
type SortDirection = 'asc' | 'desc';

const emptyPagination: ListPaginationState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

const resolveOperatorTab = (pathname: string): OperatorTab => {
  if (pathname.startsWith('/operator/reports')) return 'reports';
  if (pathname.startsWith('/operator/promotion')) return 'promotions';
  if (pathname.startsWith('/operator/recruitment')) return 'recruitment';
  if (pathname.startsWith('/operator/daily-tasks')) return 'dailyTasks';
  if (pathname.startsWith('/operator/withdraw')) return 'withdraw';
  return 'stats';
};

const OperatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = resolveOperatorTab(location.pathname);

  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewLoadFailed, setOverviewLoadFailed] = useState(false);
  const [works, setWorks] = useState<CreatorWorkItem[]>([]);
  const [worksPage, setWorksPage] = useState(1);
  const [worksPageSize, setWorksPageSize] = useState(20);
  const [worksPagination, setWorksPagination] = useState<ListPaginationState>(emptyPagination);
  const [recruitmentOverview, setRecruitmentOverview] = useState<RecruitmentOverview | null>(null);
  const [recruitmentUsers, setRecruitmentUsers] = useState<RecruitmentUserItem[]>([]);
  const [recruitmentPage, setRecruitmentPage] = useState(1);
  const [recruitmentPageSize, setRecruitmentPageSize] = useState(20);
  const [recruitmentPagination, setRecruitmentPagination] = useState<ListPaginationState>(emptyPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [worksSortField, setWorksSortField] = useState<WorksSortField | null>(null);
  const [worksSortDir, setWorksSortDir] = useState<SortDirection>('desc');

  const tabs: Array<{ id: OperatorTab; label: string; path: string }> = useMemo(() => ([
    { id: 'stats', label: t('operator.tabs.stats'), path: '/operator' },
    { id: 'reports', label: t('operator.tabs.reports'), path: '/operator/reports' },
    { id: 'promotions', label: t('operator.tabs.promotions'), path: '/operator/promotion' },
    { id: 'recruitment', label: t('operator.tabs.recruitment'), path: '/operator/recruitment' },
    { id: 'dailyTasks', label: t('operator.tabs.dailyTasks'), path: '/operator/daily-tasks' },
    { id: 'withdraw', label: t('operator.tabs.withdraw'), path: '/operator/withdraw' },
  ]), [t]);

  const sortedWorks = useMemo(() => {
    if (!worksSortField) return works;
    const getMetricValue = (work: CreatorWorkItem) => {
      if (worksSortField === 'playCount') return work.metrics?.playCount ?? 0;
      if (worksSortField === 'pv') return work.metrics?.pv ?? 0;
      return work.metrics?.shareCount ?? 0;
    };
    return [...works].sort((left, right) => {
      const diff = getMetricValue(left) - getMetricValue(right);
      return worksSortDir === 'asc' ? diff : -diff;
    });
  }, [works, worksSortField, worksSortDir]);

  const handleWorksSort = (field: WorksSortField) => {
    if (worksSortField === field) {
      setWorksSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setWorksSortField(field);
    setWorksSortDir('desc');
  };

  const renderSortIndicator = (field: WorksSortField) => {
    if (worksSortField !== field) return <span className={styles.sortIconMuted}>↕</span>;
    return (
      <span className={styles.sortIconActive} aria-hidden>
        {worksSortDir === 'desc' ? '↓' : '↑'}
      </span>
    );
  };

  const loadWorks = useCallback(async () => {
    const offset = (worksPage - 1) * worksPageSize;
    const worksResp = await operatorStatsApi.getWorks({ limit: worksPageSize, offset });
    if (worksResp.data.success && worksResp.data.data) {
      const payload = worksResp.data.data;
      setWorks(payload.items || []);
      setWorksPagination(buildListPagination(worksPage, worksPageSize, payload.total ?? 0));
    }
  }, [worksPage, worksPageSize]);

  const loadRecruitmentUsers = useCallback(async () => {
    const offset = (recruitmentPage - 1) * recruitmentPageSize;
    const usersResp = await operatorStatsApi.getRecruitmentUsers({ limit: recruitmentPageSize, offset });
    if (usersResp.data.success && usersResp.data.data) {
      const payload = usersResp.data.data;
      setRecruitmentUsers(payload.users || []);
      setRecruitmentPagination(buildListPagination(recruitmentPage, recruitmentPageSize, payload.total ?? 0));
    }
  }, [recruitmentPage, recruitmentPageSize]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewLoadFailed(false);
    try {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const overviewResp = await operatorStatsApi.getOverview();
          if (overviewResp.data.success && overviewResp.data.data) {
            setOverview(overviewResp.data.data);
            return;
          }
          lastError = new Error(overviewResp.data.message || 'overview empty');
        } catch (error) {
          lastError = error;
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 1200));
          }
        }
      }
      throw lastError;
    } catch (error) {
      console.error('[OperatorPanel] overview load failed', error);
      setOverviewLoadFailed(true);
      toast.error(t('operator.statsOverviewLoadFailed'));
    } finally {
      setOverviewLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (activeTab !== 'stats') return;
    // 功能注释：overview 只随进入统计 Tab 触发；翻页不重拉汇总
    void loadOverview();
  }, [activeTab, loadOverview]);

  useEffect(() => {
    if (activeTab !== 'stats') return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        await loadWorks();
      } catch (error) {
        if (!cancelled) {
          console.error('[OperatorPanel] works load failed', error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadWorks]);

  useEffect(() => {
    if (activeTab !== 'recruitment') return;
    const loadOverview = async () => {
      try {
        const overviewResp = await operatorStatsApi.getRecruitmentOverview();
        if (overviewResp.data.success) setRecruitmentOverview(overviewResp.data.data);
      } catch (error) {
        console.error('[OperatorPanel] recruitment overview load failed', error);
      }
    };
    void loadOverview();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'recruitment') return;
    const load = async () => {
      setIsLoading(true);
      try {
        await loadRecruitmentUsers();
      } catch (error) {
        console.error('[OperatorPanel] recruitment users load failed', error);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [activeTab, loadRecruitmentUsers]);

  const handleWorksPageSizeChange = (nextPageSize: number) => {
    setWorksPageSize(nextPageSize);
    setWorksPage(1);
  };

  const handleRecruitmentPageSizeChange = (nextPageSize: number) => {
    setRecruitmentPageSize(nextPageSize);
    setRecruitmentPage(1);
  };

  const renderStats = () => (
    <>
      <StatsOverviewSection
        stats={overview}
        updatedAt={overview ? new Date().toLocaleString() : undefined}
        loading={overviewLoading}
        loadFailed={overviewLoadFailed}
        onRetry={() => { void loadOverview(); }}
      />
      <section className={`${adminStyles.card} ${styles.panelSection}`}>
        <h2 className={adminStyles.cardTitle}>{t('operator.publicWorksTitle')}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('operator.table.title')}</th>
                <th className={styles.metricCol}>
                  <button
                    type="button"
                    className={`${styles.sortableHeader} ${worksSortField === 'playCount' ? styles.sortableHeaderActive : ''}`}
                    onClick={() => handleWorksSort('playCount')}
                  >
                    <span>{t('creatorStats.playCount')}</span>
                    {renderSortIndicator('playCount')}
                  </button>
                </th>
                <th className={styles.metricCol}>
                  <button
                    type="button"
                    className={`${styles.sortableHeader} ${worksSortField === 'pv' ? styles.sortableHeaderActive : ''}`}
                    onClick={() => handleWorksSort('pv')}
                  >
                    <span>{t('creatorStats.totalViews')}</span>
                    {renderSortIndicator('pv')}
                  </button>
                </th>
                <th className={styles.metricCol}>
                  <button
                    type="button"
                    className={`${styles.sortableHeader} ${worksSortField === 'shareCount' ? styles.sortableHeaderActive : ''}`}
                    onClick={() => handleWorksSort('shareCount')}
                  >
                    <span>{t('creatorStats.shareCount')}</span>
                    {renderSortIndicator('shareCount')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedWorks.map((work) => (
                <tr key={work.fileId}>
                  <td>
                    <button
                      type="button"
                      className={styles.linkLikeButton}
                      onClick={() => navigate(`/operator/works/${work.fileId}/stats`)}
                    >
                      {work.title}
                    </button>
                  </td>
                  <td className={styles.metricCol}>{work.metrics?.playCount ?? 0}</td>
                  <td className={styles.metricCol}>{work.metrics?.pv ?? 0}</td>
                  <td className={styles.metricCol}>{work.metrics?.shareCount ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {works.length === 0 ? <div className={styles.emptyState}>{t('operator.noPublicWorks')}</div> : null}
        </div>
        <ListPaginationBar
          pagination={worksPagination}
          onPageChange={setWorksPage}
          onPageSizeChange={handleWorksPageSizeChange}
          disabled={isLoading}
          i18nPrefix="operator.pagination"
        />
      </section>
    </>
  );

  const renderRecruitment = () => (
    <>
      <div className={`${metricStyles.grid} ${metricStyles.gridThree}`}>
        <div className={metricStyles.card}>
          <MetricTitleTip
            className={metricStyles.title}
            title={t('operator.recruitment.totalInvites')}
            tip={t('operator.recruitment.totalInvitesTip')}
          />
          <div className={metricStyles.value}>{recruitmentOverview?.totalInvites ?? 0}</div>
        </div>
        <div className={metricStyles.card}>
          <MetricTitleTip
            className={metricStyles.title}
            title={t('operator.recruitment.submissions')}
            tip={t('operator.recruitment.submissionsTip')}
          />
          <div className={metricStyles.value}>{recruitmentOverview?.promotionSubmissions ?? 0}</div>
        </div>
        <div className={metricStyles.card}>
          <MetricTitleTip
            className={metricStyles.title}
            title={t('operator.recruitment.activeEntryUsers')}
            tip={t('operator.recruitment.activeEntryUsersTip')}
          />
          <div className={metricStyles.value}>{recruitmentOverview?.activeEntryUsers ?? 0}</div>
        </div>
      </div>
      <section className={styles.panelSection}>
        <h2 className={metricStyles.sectionTitle}>{t('operator.recruitment.usersTitle')}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('operator.recruitment.nickname')}</th>
                <th>{t('operator.recruitment.phone')}</th>
                <th>{t('operator.recruitment.inviteCount')}</th>
              </tr>
            </thead>
            <tbody>
              {recruitmentUsers.map((item) => (
                <tr key={item.userId}>
                  <td>{item.nickname}</td>
                  <td>{item.maskedPhone}</td>
                  <td>{item.inviteCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recruitmentUsers.length === 0 ? <div className={styles.emptyState}>{t('operator.recruitment.noUsers')}</div> : null}
        </div>
        <ListPaginationBar
          pagination={recruitmentPagination}
          onPageChange={setRecruitmentPage}
          onPageSizeChange={handleRecruitmentPageSizeChange}
          disabled={isLoading}
          i18nPrefix="operator.pagination"
        />
      </section>
    </>
  );

  const renderDailyTasks = () => <DailyTasksAdminManager />;

  return (
    <div className={adminStyles.pageRoot}>
      <Navbar />
      <div className={adminStyles.pageBody}>
        <div className={adminStyles.workspace}>
          <aside className={adminStyles.sidebar}>
            <div className={adminStyles.sidebarHeader}>
              <div className={adminStyles.sidebarTitle}>{t('operator.pageTitle')}</div>
              <div className={adminStyles.sidebarDivider} />
            </div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`${adminStyles.navItem} ${activeTab === tab.id ? adminStyles.navItemActive : ''}`}
                onClick={() => navigate(tab.path)}
              >
                <span className={adminStyles.navTitle}>{tab.label}</span>
              </button>
            ))}
          </aside>
          <section className={adminStyles.contentArea}>
            {isLoading ? <div className={styles.emptyState}>{t('creatorStats.loading')}</div> : null}
            {!isLoading && activeTab === 'stats' ? renderStats() : null}
            {!isLoading && activeTab === 'reports' ? <OperatorReports /> : null}
            {activeTab === 'withdraw' ? <WithdrawAdminManager /> : null}
            {!isLoading && activeTab === 'promotions' ? (
              <PromotionAdminManager pendingReviewCount={0} onRefreshCounts={async () => {}} />
            ) : null}
            {!isLoading && activeTab === 'recruitment' ? renderRecruitment() : null}
            {activeTab === 'dailyTasks' ? renderDailyTasks() : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OperatorPanel;
