import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AdminShell from '../../components/admin-shell/AdminShell';
import PromotionAdminManager from '../../components/PromotionAdminManager';
import CreatorIncentiveAdminManager from '../../components/CreatorIncentiveAdminManager';
import CreatorBenefitsAdminManager from '../../components/CreatorBenefitsAdminManager';
import DailyTasksAdminManager from '../../components/DailyTasksAdminManager';
import MetricTitleTip from '../../components/stats/MetricTitleTip';
import metricStyles from '../../components/admin/MetricSummary.module.css';
import ListPaginationBar, { buildListPagination, type ListPaginationState } from '../../components/ListPaginationBar';
import operatorStatsApi, {
  type RecruitmentOverview,
  type RecruitmentUserItem,
} from '../../api/stats/operatorStatsApi';
import promotionApi from '../../api/promotion/promotionApi';
import OperatorReports from './OperatorReports';
import OperatorSiteStats from './OperatorSiteStats';
import WithdrawAdminManager from '../../components/WithdrawAdminManager';
import { useAuthStore } from '../../store/useAuthStore';
import { isAdminRole } from '../../utils/userRoles';
import AdminPublicAvatarManager from '../../components/admin/AdminPublicAvatarManager';
import AdminLocationLibraryManager from '../../components/admin/AdminLocationLibraryManager';
import AdminLocationAssetLibraryManager from '../../components/admin/AdminLocationAssetLibraryManager';
import AdminPlayModManager from '../../components/admin/AdminPlayModManager';
import ContentReportAdminManager from '../../components/admin/ContentReportAdminManager';
import ContentAppealAdminManager from '../../components/admin/ContentAppealAdminManager';
import PublishReviewAdminManager from '../../components/admin/PublishReviewAdminManager';
import SiteFeedbackAdminManager from '../../components/admin/SiteFeedbackAdminManager';
import BusinessCoopAdminManager from '../../components/admin/BusinessCoopAdminManager';
import GameIssueAdminManager from '../../components/admin/GameIssueAdminManager';
import adminStyles from '../AdminPanel.module.css';
import styles from './OperatorPanel.module.css';
import gamePublishAppealsApi from '../../api/gamePublishAppeals/gamePublishAppealsApi';
import AiModelCenter from '../../components/AiModelCenter';
import PlatformBenefitsManager from '../../components/PlatformBenefitsManager';

type OperatorTab =
  | 'stats'
  | 'reports'
  | 'promotions'
  | 'recruitment'
  | 'specialAuthors'
  | 'platformWorks'
  | 'promoters'
  | 'dailyTasks'
  | 'withdraw'
  | 'avatars'
  | 'locations'
  | 'locationAssets'
  | 'components'
  | 'aiModelCenter'
  | 'platformBenefits'
  | 'contentReports'
  | 'appeals'
  | 'publishQueue'
  | 'feedback'
  | 'businessCoop'
  | 'gameIssues';

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
  if (pathname.startsWith('/operator/special-authors')) return 'specialAuthors';
  if (pathname.startsWith('/operator/platform-works')) return 'platformWorks';
  if (pathname.startsWith('/operator/promoters')) return 'promoters';
  if (pathname.startsWith('/operator/daily-tasks')) return 'dailyTasks';
  if (pathname.startsWith('/operator/withdraw')) return 'withdraw';
  if (pathname.startsWith('/operator/avatars')) return 'avatars';
  if (pathname.startsWith('/operator/location-assets')) return 'locationAssets';
  if (pathname.startsWith('/operator/locations')) return 'locations';
  if (pathname.startsWith('/operator/components') || pathname.startsWith('/operator/play-mods')) return 'components';
  if (pathname.startsWith('/operator/ai-model-center')) return 'aiModelCenter';
  if (pathname.startsWith('/operator/platform-benefits')) return 'platformBenefits';
  if (pathname.startsWith('/operator/content-reports')) return 'contentReports';
  if (pathname.startsWith('/operator/appeals')) return 'appeals';
  if (pathname.startsWith('/operator/publish-queue')) return 'publishQueue';
  if (pathname.startsWith('/operator/feedback')) return 'feedback';
  if (pathname.startsWith('/operator/business-coop')) return 'businessCoop';
  if (pathname.startsWith('/operator/game-issues')) return 'gameIssues';
  return 'stats';
};

const OperatorPanel: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const activeTab = resolveOperatorTab(location.pathname);
  const isAdmin = isAdminRole(useAuthStore((state) => state.user?.user?.role));

  const [recruitmentOverview, setRecruitmentOverview] = useState<RecruitmentOverview | null>(null);
  const [recruitmentUsers, setRecruitmentUsers] = useState<RecruitmentUserItem[]>([]);
  const [recruitmentPage, setRecruitmentPage] = useState(1);
  const [recruitmentPageSize, setRecruitmentPageSize] = useState(20);
  const [recruitmentPagination, setRecruitmentPagination] = useState<ListPaginationState>(emptyPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [appealPendingCount, setAppealPendingCount] = useState(0);
  const [promotionPendingReviewCount, setPromotionPendingReviewCount] = useState(0);

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

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    const loadAppealPendingCount = async () => {
      try {
        const response = await gamePublishAppealsApi.getPendingCount();
        if (!cancelled) setAppealPendingCount(Number(response.data.data?.pendingCount || 0));
      } catch {
        // 待处理角标失败不阻断运营中心其他功能。
      }
    };
    void loadAppealPendingCount();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isAdmin]);

  const refreshPromotionPendingReviewCount = useCallback(async () => {
    try {
      const response = await promotionApi.adminSubmissions({ reviewStatus: 'pending_review', page: 1 });
      setPromotionPendingReviewCount(Number(response.data.data?.pagination?.total || 0));
    } catch {
      // 待处理角标失败不阻断运营中心其他功能。
    }
  }, []);

  useEffect(() => {
    void refreshPromotionPendingReviewCount();
  }, [refreshPromotionPendingReviewCount]);

  const handleRecruitmentPageSizeChange = (nextPageSize: number) => {
    setRecruitmentPageSize(nextPageSize);
    setRecruitmentPage(1);
  };

  // 功能注释：统计 Tab 交给 OperatorSiteStats（区间 KPI + 榜单），面板只保留壳与其它业务 Tab。
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
    <AdminShell mode="operator" activeKey={activeTab} badges={{ platformWorks: appealPendingCount, promotions: promotionPendingReviewCount }}>
    <div className={adminStyles.pageRoot}>
      <div className={adminStyles.pageBody}>
        <div className={adminStyles.workspace}>
          <section className={adminStyles.contentArea}>
            {activeTab === 'stats' ? <OperatorSiteStats /> : null}
            {activeTab === 'reports' ? <OperatorReports /> : null}
            {activeTab === 'withdraw' ? <WithdrawAdminManager /> : null}
            {activeTab === 'avatars' ? <AdminPublicAvatarManager /> : null}
            {activeTab === 'locations' ? <AdminLocationLibraryManager /> : null}
            {activeTab === 'locationAssets' ? <AdminLocationAssetLibraryManager /> : null}
            {activeTab === 'components' ? <AdminPlayModManager /> : null}
            {activeTab === 'promotions' ? (
              <PromotionAdminManager onRefreshCounts={refreshPromotionPendingReviewCount} />
            ) : null}
            {isLoading && activeTab === 'recruitment' ? (
              <div className={styles.emptyState}>{t('creatorStats.loading')}</div>
            ) : null}
            {!isLoading && activeTab === 'recruitment' ? renderRecruitment() : null}
            {activeTab === 'specialAuthors' ? <CreatorBenefitsAdminManager key="special-authors" view="benefits" /> : null}
            {activeTab === 'platformWorks' ? (
              <CreatorBenefitsAdminManager
                key="platform-works"
                view="games"
                onAppealPendingCountChange={setAppealPendingCount}
              />
            ) : null}
            {activeTab === 'promoters' ? <CreatorIncentiveAdminManager /> : null}
            {activeTab === 'dailyTasks' ? renderDailyTasks() : null}
            {activeTab === 'aiModelCenter' ? <AiModelCenter isAdmin={false} /> : null}
            {activeTab === 'platformBenefits' ? <PlatformBenefitsManager /> : null}
            {activeTab === 'contentReports' ? <ContentReportAdminManager /> : null}
            {activeTab === 'appeals' ? <ContentAppealAdminManager /> : null}
            {activeTab === 'publishQueue' ? <PublishReviewAdminManager /> : null}
            {activeTab === 'feedback' ? <SiteFeedbackAdminManager /> : null}
            {activeTab === 'businessCoop' ? <BusinessCoopAdminManager /> : null}
            {activeTab === 'gameIssues' ? <GameIssueAdminManager /> : null}
          </section>
        </div>
      </div>
    </div>
    </AdminShell>
  );
};

export default OperatorPanel;
