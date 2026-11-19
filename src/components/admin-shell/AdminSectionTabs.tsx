import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import styles from './AdminSectionTabs.module.css';

interface SectionTab {
  key: string;
  label: string;
  path: string;
  badge?: number;
}

interface AdminSectionTabsProps {
  badges?: Record<string, number>;
}

const starts = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

const tabsForPath = (pathname: string, t: TFunction, badges: Record<string, number>): SectionTab[] | null => {
  if (starts(pathname, '/admin/banners')) {
    return [
      { key: 'bannerHome', label: t('adminUi.nav.items.bannerHome'), path: '/admin/banners/home' },
      { key: 'bannerActivity', label: t('adminUi.nav.items.bannerActivity'), path: '/admin/banners/activity' },
    ];
  }

  if (starts(pathname, '/admin/points') || starts(pathname, '/admin/diamonds')) {
    return [
      { key: 'pointsActivity', label: t('adminUi.nav.items.pointsActivity', { defaultValue: '活动织梦豆' }), path: '/admin/points/activity', badge: badges.points },
      { key: 'pointsSpecial', label: t('adminUi.nav.items.pointsSpecial', { defaultValue: '特殊织梦豆' }), path: '/admin/points/special' },
      { key: 'diamonds', label: t('adminUi.nav.items.diamonds', { defaultValue: 'KK币' }), path: '/admin/diamonds' },
    ];
  }

  if (starts(pathname, '/admin/subscriptions')) {
    return [
      { key: 'membershipRecords', label: t('adminUi.nav.items.membershipRecords', { defaultValue: '会员记录' }), path: '/admin/subscriptions/records' },
      { key: 'membershipKeyGeneration', label: t('adminUi.nav.items.membershipKeyGeneration', { defaultValue: '卡密生成' }), path: '/admin/subscriptions/key-generation' },
      { key: 'membershipKeyRecords', label: t('adminUi.nav.items.membershipKeyRecords', { defaultValue: '卡密记录' }), path: '/admin/subscriptions/key-records' },
    ];
  }

  const withdrawBase = starts(pathname, '/admin/withdraw')
    ? '/admin/withdraw'
    : starts(pathname, '/operator/withdraw')
      ? '/operator/withdraw'
      : '';
  if (withdrawBase) {
    return [
      { key: 'withdrawApplications', label: t('adminUi.nav.items.withdrawApplications', { defaultValue: '提现申请' }), path: `${withdrawBase}/applications` },
      { key: 'withdrawVerify', label: t('adminUi.nav.items.withdrawVerify', { defaultValue: '提现核验' }), path: `${withdrawBase}/verify` },
      { key: 'withdrawCreatorEarnings', label: t('adminUi.nav.items.withdrawCreatorEarnings', { defaultValue: '创作者收益' }), path: `${withdrawBase}/creator-earnings` },
    ];
  }

  const aiBase = starts(pathname, '/admin/ai-model-center')
    ? '/admin/ai-model-center'
    : starts(pathname, '/operator/ai-model-center')
      ? '/operator/ai-model-center'
      : '';
  if (aiBase) {
    const tabs: SectionTab[] = [
      { key: 'aiUsage', label: t('adminUi.nav.items.aiUsage', { defaultValue: '用量与成本' }), path: `${aiBase}/usage` },
      { key: 'aiModels', label: t('adminUi.nav.items.aiModels', { defaultValue: '模型与计费' }), path: `${aiBase}/models` },
    ];
    if (aiBase.startsWith('/admin')) {
      tabs.push({ key: 'aiRuntime', label: t('adminUi.nav.items.aiRuntime', { defaultValue: '运行配置' }), path: `${aiBase}/runtime` });
    }
    return tabs;
  }

  if (starts(pathname, '/admin/avatars') || starts(pathname, '/admin/art-styles')) {
    return [
      { key: 'avatars', label: t('adminUi.nav.items.avatars'), path: '/admin/avatars' },
      { key: 'artStyles', label: t('adminUi.nav.items.artStyles'), path: '/admin/art-styles' },
    ];
  }

  if (pathname === '/operator' || starts(pathname, '/operator/reports')) {
    return [
      { key: 'stats', label: t('adminUi.nav.items.stats', { defaultValue: '数据概览' }), path: '/operator' },
      { key: 'reports', label: t('adminUi.nav.items.reports', { defaultValue: '运营报表' }), path: '/operator/reports' },
    ];
  }

  if (starts(pathname, '/operator/promotion')) {
    return [
      { key: 'promotionList', label: t('adminUi.nav.items.promotionList'), path: '/operator/promotion/list' },
      { key: 'promotionCreate', label: t('adminUi.nav.items.promotionCreate'), path: '/operator/promotion/create' },
      { key: 'promotionTicker', label: t('adminUi.nav.items.promotionTicker'), path: '/operator/promotion/ticker' },
      { key: 'promotionReviews', label: t('adminUi.nav.items.promotionReviews'), path: '/operator/promotion/reviews', badge: badges.promotions },
    ];
  }

  if (starts(pathname, '/operator/platform-works')) {
    return [
      { key: 'platformWorksList', label: t('adminUi.nav.items.platformWorksList'), path: '/operator/platform-works/works' },
      { key: 'platformWorksAppeals', label: t('adminUi.nav.items.platformWorksAppeals'), path: '/operator/platform-works/appeals', badge: badges.platformWorks },
    ];
  }

  if (starts(pathname, '/operator/content-reports')) {
    return [
      { key: 'contentReportReviews', label: t('adminUi.nav.items.contentReportReviews'), path: '/operator/content-reports/reports' },
      { key: 'contentReportPenalties', label: t('adminUi.nav.items.contentReportPenalties'), path: '/operator/content-reports/penalties' },
    ];
  }

  if (starts(pathname, '/operator/messages') || pathname === '/operator/feedback') {
    return [
      { key: 'messagesAnnouncements', label: t('adminUi.nav.items.messagesAnnouncements', { defaultValue: '公告' }), path: '/operator/messages/announcements' },
      { key: 'messagesFeedback', label: t('adminUi.nav.items.messagesFeedback', { defaultValue: '意见反馈' }), path: '/operator/messages/feedback' },
      { key: 'messagesDirect', label: t('adminUi.nav.items.messagesDirect', { defaultValue: '定向站内信' }), path: '/operator/messages/direct' },
    ];
  }

  const operatorAsset = ['/operator/avatars', '/operator/locations', '/operator/location-assets', '/operator/audio-library', '/operator/art-styles']
    .some((prefix) => starts(pathname, prefix));
  if (operatorAsset) {
    return [
      { key: 'avatars', label: t('adminUi.nav.items.avatars'), path: '/operator/avatars' },
      { key: 'locations', label: t('adminUi.nav.items.locations'), path: '/operator/locations' },
      { key: 'locationAssets', label: t('adminUi.nav.items.locationAssets'), path: '/operator/location-assets' },
      { key: 'audioLibrary', label: t('adminUi.nav.items.audioLibrary'), path: '/operator/audio-library' },
      { key: 'artStyles', label: t('adminUi.nav.items.artStyles'), path: '/operator/art-styles' },
    ];
  }

  return null;
};

const AdminSectionTabs: React.FC<AdminSectionTabsProps> = ({ badges = {} }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = tabsForPath(location.pathname, t, badges);
  if (!tabs?.length) return null;

  const active = [...tabs].reverse().find((tab) => location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`));

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((tab) => {
        const selected = active?.key === tab.key;
        const badge = Number(tab.badge) > 0 ? Math.floor(Number(tab.badge)) : 0;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? styles.tabActive : styles.tab}
            onClick={() => navigate(tab.path)}
          >
            <span>{tab.label}</span>
            {badge > 0 ? <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
};

export default AdminSectionTabs;
