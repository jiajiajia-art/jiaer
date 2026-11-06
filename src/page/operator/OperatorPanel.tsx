import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Layout/Navbar';
import PromotionAdminManager from '../../components/PromotionAdminManager';
import DailyTasksAdminManager from '../../components/DailyTasksAdminManager';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/Admin/MetricSummary.module.css';
import ListPaginationBar, { buildListPagination, type ListPaginationState } from '../../components/ListPaginationBar';
import operatorStatsApi, {
  type RecruitmentOverview,
  type RecruitmentUserItem,
} from '../../api/stats/operatorStatsApi';
import OperatorReports from './OperatorReports';
import OperatorSiteStats from './OperatorSiteStats';
import WithdrawAdminManager from '../../components/WithdrawAdminManager';
import ContentReportAdminManager from '../../components/Admin/ContentReportAdminManager';
import ContentAppealAdminManager from '../../components/Admin/ContentAppealAdminManager';
import PublishReviewAdminManager from '../../components/Admin/PublishReviewAdminManager';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorPanel.module.css';

type OperatorTab =
  | 'stats'
  | 'reports'
  | 'promotions'
  | 'recruitment'
  | 'dailyTasks'
  | 'withdraw'
  | 'contentReports'
  | 'appeals'
  | 'publishQueue';

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
  if (pathname.startsWith('/operator/content-reports')) return 'contentReports';
  if (pathname.startsWith('/operator/appeals')) return 'appeals';
  if (pathname.startsWith('/operator/publish-queue')) return 'publishQueue';
  return 'stats';
};

const OperatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = resolveOperatorTab(location.pathname);

  const [recruitmentOverview, setRecruitmentOverview] = useState<RecruitmentOverview | null>(null);
  const [recruitmentUsers, setRecruitmentUsers] = useState<RecruitmentUserItem[]>([]);
  const [recruitmentPage, setRecruitmentPage] = useState(1);
  const [recruitmentPageSize, setRecruitmentPageSize] = useState(20);
  const [recruitmentPagination, setRecruitmentPagination] = useState<ListPaginationState>(emptyPagination);
  const [isLoading, setIsLoading] = useState(false);

  const tabs: Array<{ id: OperatorTab; label: string; path: string }> = useMemo(() => ([
    { id: 'stats', label: t('operator.tabs.stats'), path: '/operator' },
    { id: 'reports', label: t('operator.tabs.reports'), path: '/operator/reports' },
    { id: 'promotions', label: t('operator.tabs.promotions'), path: '/operator/promotion' },
    { id: 'recruitment', label: t('operator.tabs.recruitment'), path: '/operator/recruitment' },
    { id: 'dailyTasks', label: t('operator.tabs.dailyTasks'), path: '/operator/daily-tasks' },
    { id: 'withdraw', label: t('operator.tabs.withdraw'), path: '/operator/withdraw' },
    { id: 'contentReports', label: t('operator.tabs.contentReports'), path: '/operator/content-reports' },
    { id: 'appeals', label: t('operator.tabs.appeals'), path: '/operator/appeals' },
    { id: 'publishQueue', label: t('operator.tabs.publishQueue'), path: '/operator/publish-queue' },
  ]), [t]);

  const loadRecruitmentUsers = useCallback(async () => {
    const offset = (recruitmentPage - 1) * recruitmentPageSize;
    const usersResp = await operatorStatsApi.getRecruitmentUsers({ limit: recruitmentPageSize, offset });
    if (usersResp.data.success && usersResp.data.data) {
      const payload = usersResp.data.data;
      setRecruitmentUsers(payload.users || []);
      setRecruitmentPagination(buildListPagination(recruitmentPage, recruitmentPageSize, payload.total ?? 0));
    }
  }, [recruitmentPage, recruitmentPageSize]);

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

  const handleRecruitmentPageSizeChange = (nextPageSize: number) => {
    setRecruitmentPageSize(nextPageSize);
    setRecruitmentPage(1);
  };

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
            {activeTab === 'stats' ? <OperatorSiteStats /> : null}
            {activeTab === 'reports' ? <OperatorReports /> : null}
            {activeTab === 'withdraw' ? <WithdrawAdminManager /> : null}
            {activeTab === 'promotions' ? (
              <PromotionAdminManager pendingReviewCount={0} onRefreshCounts={async () => {}} />
            ) : null}
            {isLoading && activeTab === 'recruitment' ? (
              <div className={styles.emptyState}>{t('creatorStats.loading')}</div>
            ) : null}
            {!isLoading && activeTab === 'recruitment' ? renderRecruitment() : null}
            {activeTab === 'dailyTasks' ? <DailyTasksAdminManager /> : null}
            {activeTab === 'contentReports' ? <ContentReportAdminManager /> : null}
            {activeTab === 'appeals' ? <ContentAppealAdminManager /> : null}
            {activeTab === 'publishQueue' ? <PublishReviewAdminManager /> : null}
          </section>
        </div>
      </div>
    </div>
  );
};

export default OperatorPanel;
