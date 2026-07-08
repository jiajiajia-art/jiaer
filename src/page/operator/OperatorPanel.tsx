import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Layout/Navbar';
import PromotionAdminManager from '../../components/PromotionAdminManager';
import DailyTasksAdminManager from '../../components/DailyTasksAdminManager';
import StatsOverviewSection from '../../components/stats/StatsOverviewSection';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import operatorStatsApi, {
  type RecruitmentOverview,
  type RecruitmentUserItem,
} from '../../api/stats/operatorStatsApi';
import type { CreatorWorkItem, StatsOverview } from '../../api/stats/creatorStatsApi';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorPanel.module.css';

type OperatorTab = 'stats' | 'promotions' | 'recruitment' | 'dailyTasks';
type WorksSortField = 'playCount' | 'pv' | 'shareCount';
type SortDirection = 'asc' | 'desc';

const resolveOperatorTab = (pathname: string): OperatorTab => {
  if (pathname.startsWith('/operator/promotion')) return 'promotions';
  if (pathname.startsWith('/operator/recruitment')) return 'recruitment';
  if (pathname.startsWith('/operator/daily-tasks')) return 'dailyTasks';
  return 'stats';
};

const OperatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = resolveOperatorTab(location.pathname);

  const [overview, setOverview] = useState<StatsOverview | null>(null);
  const [works, setWorks] = useState<CreatorWorkItem[]>([]);
  const [recruitmentOverview, setRecruitmentOverview] = useState<RecruitmentOverview | null>(null);
  const [recruitmentUsers, setRecruitmentUsers] = useState<RecruitmentUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [worksSortField, setWorksSortField] = useState<WorksSortField | null>(null);
  const [worksSortDir, setWorksSortDir] = useState<SortDirection>('desc');

  const tabs: Array<{ id: OperatorTab; label: string; path: string }> = useMemo(() => ([
    { id: 'stats', label: t('operator.tabs.stats'), path: '/operator' },
    { id: 'promotions', label: t('operator.tabs.promotions'), path: '/operator/promotion' },
    { id: 'recruitment', label: t('operator.tabs.recruitment'), path: '/operator/recruitment' },
    { id: 'dailyTasks', label: t('operator.tabs.dailyTasks'), path: '/operator/daily-tasks' },
  ]), [t]);

  const sortedWorks = useMemo(() => {
    if (!worksSortField) return works;
    const getMetricValue = (work: CreatorWorkItem) => {
      if (worksSortField === 'playCount') return work.metrics.playCount;
      if (worksSortField === 'pv') return work.metrics.pv;
      return work.metrics.shareCount ?? 0;
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

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'stats') {
          const [overviewResp, worksResp] = await Promise.all([
            operatorStatsApi.getOverview(),
            operatorStatsApi.getWorks({ limit: 50, offset: 0 }),
          ]);
          if (overviewResp.data.success) setOverview(overviewResp.data.data);
          if (worksResp.data.success && worksResp.data.data) setWorks(worksResp.data.data.items || []);
        } else if (activeTab === 'recruitment') {
          const [overviewResp, usersResp] = await Promise.all([
            operatorStatsApi.getRecruitmentOverview(),
            operatorStatsApi.getRecruitmentUsers({ limit: 100, offset: 0 }),
          ]);
          if (overviewResp.data.success) setRecruitmentOverview(overviewResp.data.data);
          if (usersResp.data.success && usersResp.data.data) setRecruitmentUsers(usersResp.data.data.users || []);
        }
      } catch (error) {
        console.error('[OperatorPanel] load failed', error);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [activeTab]);

  const renderStats = () => (
    <>
      <StatsOverviewSection stats={overview} updatedAt={new Date().toLocaleString()} />
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
                  <td className={styles.metricCol}>{work.metrics.playCount}</td>
                  <td className={styles.metricCol}>{work.metrics.pv}</td>
                  <td className={styles.metricCol}>{work.metrics.shareCount ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {works.length === 0 ? <div className={styles.emptyState}>{t('operator.noPublicWorks')}</div> : null}
        </div>
      </section>
    </>
  );

  const renderRecruitment = () => (
    <>
      <div className={adminStyles.panelGrid}>
        <div className={adminStyles.card}>
          <MetricTitleTip
            className={adminStyles.cardTitle}
            title={t('operator.recruitment.totalInvites')}
            tip={t('operator.recruitment.totalInvitesTip')}
          />
          <div className={styles.metricValue}>{recruitmentOverview?.totalInvites ?? 0}</div>
        </div>
        <div className={adminStyles.card}>
          <MetricTitleTip
            className={adminStyles.cardTitle}
            title={t('operator.recruitment.submissions')}
            tip={t('operator.recruitment.submissionsTip')}
          />
          <div className={styles.metricValue}>{recruitmentOverview?.promotionSubmissions ?? 0}</div>
        </div>
        <div className={adminStyles.card}>
          <MetricTitleTip
            className={adminStyles.cardTitle}
            title={t('operator.recruitment.activeEntryUsers')}
            tip={t('operator.recruitment.activeEntryUsersTip')}
          />
          <div className={styles.metricValue}>{recruitmentOverview?.activeEntryUsers ?? 0}</div>
        </div>
      </div>
      <section className={styles.panelSection}>
        <h2 className={adminStyles.cardTitle}>{t('operator.recruitment.usersTitle')}</h2>
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
