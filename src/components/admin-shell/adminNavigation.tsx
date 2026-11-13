import type { ReactNode } from 'react';
import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  DollarOutlined,
  FileSearchOutlined,
  GiftOutlined,
  LineChartOutlined,
  NotificationOutlined,
  PictureOutlined,
  PercentageOutlined,
  ReadOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { getNavigationBadgeCount } from './navigationBadges';
import styles from './AdminShell.module.css';

export type AdminShellMode = 'admin' | 'operator';

export interface AdminNavigationItem {
  key: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  badge?: number;
  children?: AdminNavigationItem[];
}

export interface AdminNavigationGroup {
  key: string;
  label: string;
  items: AdminNavigationItem[];
}

const adminGroups = (badges: Record<string, number>): AdminNavigationGroup[] => [
  {
    key: 'admin-content',
    label: '内容管理',
    items: [
      { key: 'announcements', label: '公告管理', path: '/admin', icon: <NotificationOutlined /> },
      {
        key: 'banners',
        label: '轮播图管理',
        path: '/admin/banners/home',
        icon: <PictureOutlined />,
        children: [
          { key: 'bannerHome', label: '首页轮播图', path: '/admin/banners/home' },
          { key: 'bannerActivity', label: '活动轮播图', path: '/admin/banners/activity' },
        ],
      },
      {
        key: 'themes',
        label: '题材管理',
        path: '/admin/themes/all',
        icon: <AppstoreOutlined />,
      },
      { key: 'documents', label: '文档管理', path: '/admin/documents', icon: <ReadOutlined /> },
      { key: 'comments', label: '评论管理', path: '/admin/comments', icon: <CommentOutlined /> },
    ],
  },
  {
    key: 'admin-platform',
    label: '平台运营',
    items: [
      {
        key: 'points',
        label: '织梦豆管理',
        path: '/admin/points/activity',
        icon: <GiftOutlined />,
        children: [
          { key: 'pointsActivity', label: '活动奖励', path: '/admin/points/activity', badge: badges.points },
          { key: 'pointsSpecial', label: '特殊织梦豆', path: '/admin/points/special' },
        ],
      },
      { key: 'dailyTasks', label: '每日任务管理', path: '/admin/daily-tasks', icon: <CheckCircleOutlined /> },
      { key: 'lottery', label: '抽奖活动', path: '/admin/lottery', icon: <TrophyOutlined /> },
      { key: 'shareRatio', label: '分成比例', path: '/admin/share-ratio', icon: <PercentageOutlined /> },
    ],
  },
  {
    key: 'admin-account',
    label: '账户与权限',
    items: [
      { key: 'diamonds', label: 'KK币管理', path: '/admin/diamonds', icon: <DollarOutlined /> },
      {
        key: 'subscriptions',
        label: '会员管理',
        path: '/admin/subscriptions/records',
        icon: <ShoppingOutlined />,
        children: [
          { key: 'membershipRecords', label: '会员状态记录', path: '/admin/subscriptions/records' },
          { key: 'membershipKeyGeneration', label: '兑换卡生成', path: '/admin/subscriptions/key-generation' },
          { key: 'membershipKeyRecords', label: '兑换卡使用记录', path: '/admin/subscriptions/key-records' },
        ],
      },
      { key: 'users', label: '用户角色', path: '/admin/users', icon: <TeamOutlined /> },
      {
        key: 'withdraw',
        label: '提现管理',
        path: '/admin/withdraw/applications',
        icon: <WalletOutlined />,
        children: [
          { key: 'withdrawApplications', label: '提现申请', path: '/admin/withdraw/applications' },
          { key: 'withdrawVerify', label: '创作者认证', path: '/admin/withdraw/verify' },
          { key: 'withdrawCreatorEarnings', label: '创作者收益提现', path: '/admin/withdraw/creator-earnings' },
        ],
      },
    ],
  },
  {
    key: 'admin-ai',
    label: 'AI 与配置',
    items: [
      {
        key: 'aiModelCenter',
        label: 'AI 模型中心',
        path: '/admin/ai-model-center/models',
        icon: <BulbOutlined />,
        children: [
          { key: 'aiModels', label: '模型与计费', path: '/admin/ai-model-center/models' },
          { key: 'aiUsage', label: '用量与成本', path: '/admin/ai-model-center/usage' },
          { key: 'aiRuntime', label: '运行配置', path: '/admin/ai-model-center/runtime' },
        ],
      },
      {
        key: 'assetCenter',
        label: '素材中心',
        path: '/admin/avatars',
        icon: <PictureOutlined />,
        children: [
          { key: 'avatars', label: '公共头像', path: '/admin/avatars' },
          { key: 'artStyles', label: '画风管理', path: '/admin/art-styles' },
        ],
      },
      { key: 'components', label: '组件管理', path: '/admin/components', icon: <SettingOutlined /> },
    ],
  },
];

const operatorGroups = (isAdmin: boolean, badges: Record<string, number>): AdminNavigationGroup[] => [
  {
    key: 'operator-overview',
    label: '数据分析',
    items: [
      { key: 'stats', label: '数据概览', path: '/operator', icon: <BarChartOutlined /> },
      { key: 'reports', label: '运营报表', path: '/operator/reports', icon: <LineChartOutlined /> },
    ],
  },
  {
    key: 'operator-growth',
    label: '增长运营',
    items: [
      {
        key: 'promotions',
        label: '推广活动',
        path: '/operator/promotion/list',
        icon: <ThunderboltOutlined />,
        children: [
          { key: 'promotionList', label: '管理活动', path: '/operator/promotion/list' },
          { key: 'promotionCreate', label: '新增活动', path: '/operator/promotion/create' },
          { key: 'promotionTicker', label: '首页滚动通知', path: '/operator/promotion/ticker' },
          { key: 'promotionReviews', label: '投稿审核', path: '/operator/promotion/reviews', badge: badges.promotions },
        ],
      },
      { key: 'recruitment', label: '用户招募', path: '/operator/recruitment', icon: <TeamOutlined /> },
      ...(isAdmin
        ? [
            { key: 'promoters', label: '推广者', path: '/operator/promoters', icon: <UserOutlined /> },
          ]
        : []),
    ],
  },
  {
    key: 'operator-content',
    label: '内容运营',
    items: [
      ...(isAdmin
        ? [
            { key: 'specialAuthors', label: '特殊作者', path: '/operator/special-authors', icon: <TeamOutlined /> },
            {
              key: 'platformWorks',
              label: '平台作品',
              path: '/operator/platform-works/works',
              icon: <BookOutlined />,
              children: [
                { key: 'platformWorksList', label: '作品列表', path: '/operator/platform-works/works' },
                { key: 'platformWorksAppeals', label: '发布申诉', path: '/operator/platform-works/appeals', badge: badges.platformWorks },
              ],
            },
          ]
        : []),
      {
        key: 'contentReports',
        label: '内容举报',
        path: '/operator/content-reports/reports',
        icon: <AlertOutlined />,
        children: [
          { key: 'contentReportReviews', label: '举报审核', path: '/operator/content-reports/reports' },
          { key: 'contentReportPenalties', label: '处罚记录', path: '/operator/content-reports/penalties' },
        ],
      },
      { key: 'appeals', label: '申诉复核', path: '/operator/appeals', icon: <FileSearchOutlined /> },
      { key: 'publishQueue', label: '发布队列', path: '/operator/publish-queue', icon: <SettingOutlined /> },
    ],
  },
  {
    key: 'operator-platform',
    label: '平台配置',
    items: [
      {
        key: 'aiModelCenter',
        label: 'AI 模型中心',
        path: '/operator/ai-model-center/models',
        icon: <BulbOutlined />,
        children: [
          { key: 'aiModels', label: '模型与计费', path: '/operator/ai-model-center/models' },
          { key: 'aiUsage', label: '用量与成本', path: '/operator/ai-model-center/usage' },
        ],
      },
      { key: 'platformBenefits', label: '平台权益', path: '/operator/platform-benefits', icon: <GiftOutlined /> },
      { key: 'dailyTasks', label: '每日任务', path: '/operator/daily-tasks', icon: <CheckCircleOutlined /> },
      {
        key: 'withdraw',
        label: '提现',
        path: '/operator/withdraw/applications',
        icon: <WalletOutlined />,
        children: [
          { key: 'withdrawApplications', label: '提现申请', path: '/operator/withdraw/applications' },
          { key: 'withdrawVerify', label: '创作者认证', path: '/operator/withdraw/verify' },
          { key: 'withdrawCreatorEarnings', label: '创作者收益提现', path: '/operator/withdraw/creator-earnings' },
        ],
      },
      {
        key: 'assetCenter',
        label: '素材中心',
        path: '/operator/avatars',
        icon: <PictureOutlined />,
        children: [
          { key: 'avatars', label: '公共头像', path: '/operator/avatars' },
          { key: 'locations', label: '地点库', path: '/operator/locations' },
          { key: 'locationAssets', label: '地点素材库', path: '/operator/location-assets' },
          { key: 'audioLibrary', label: '音频库', path: '/operator/audio-library' },
          { key: 'artStyles', label: '画风管理', path: '/operator/art-styles' },
        ],
      },
      { key: 'components', label: '组件管理', path: '/operator/components', icon: <SettingOutlined /> },
      { key: 'feedback', label: '意见反馈', path: '/operator/feedback', icon: <CommentOutlined /> },
      { key: 'businessCoop', label: '商务合作', path: '/operator/business-coop', icon: <TeamOutlined /> },
      { key: 'gameIssues', label: '作品问题', path: '/operator/game-issues', icon: <AlertOutlined /> },
    ],
  },
];

export const getAdminNavigation = (
  mode: AdminShellMode,
  options: { isAdmin?: boolean; userId?: string; badges?: Record<string, number> } = {},
): AdminNavigationGroup[] => {
  const badges = options.badges || {};
  if (mode === 'operator') return operatorGroups(Boolean(options.isAdmin), badges);
  if (options.userId === '96e89940badf1f67') {
    return [{ key: 'admin-limited', label: '内容管理', items: [{ key: 'comments', label: '评论管理', path: '/admin/comments', icon: <CommentOutlined /> }] }];
  }
  return adminGroups(badges);
};

export const flattenNavigationItems = (groups: AdminNavigationGroup[]): AdminNavigationItem[] => (
  groups.flatMap((group) => group.items.flatMap((item) => [item, ...flattenNavigationItems([{ key: item.key, label: item.label, items: item.children || [] }])]))
);

export const resolveNavigationSelection = (groups: AdminNavigationGroup[], pathname: string) => {
  const find = (items: AdminNavigationItem[], parents: string[] = []): { key: string; openKeys: string[] } | null => {
    for (const item of items) {
      const nested = item.children?.length ? find(item.children, [...parents, item.key]) : null;
      if (nested) return nested;
      if (item.path === pathname) return { key: item.key, openKeys: parents };
    }
    return null;
  };

  for (const group of groups) {
    const selection = find(group.items);
    if (selection) return selection;
  }
  return null;
};

const toMenuItem = (item: AdminNavigationItem): NonNullable<MenuProps['items']>[number] => {
  const badgeCount = getNavigationBadgeCount(item);
  const label = (
    <span
      className={item.children?.length
        ? `${styles.menuItemLabel} ${styles.menuItemLabelWithSubmenu}`
        : styles.menuItemLabel}
    >
      <span>{item.label}</span>
      {badgeCount > 0 ? <span className={styles.menuBadge}>{badgeCount > 99 ? '99+' : badgeCount}</span> : null}
    </span>
  );

  return {
    key: item.key,
    icon: item.icon,
    label,
    ...(item.children?.length ? { children: item.children.map(toMenuItem) } : {}),
  };
};

export const toMenuItems = (groups: AdminNavigationGroup[]): MenuProps['items'] => groups.map((group) => ({
  key: group.key,
  type: 'group',
  label: group.label,
  children: group.items.map(toMenuItem),
}));
