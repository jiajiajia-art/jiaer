import type { ReactNode } from 'react';
import {
  AlertOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CommentOutlined,
  FileSearchOutlined,
  GiftOutlined,
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
import type { TFunction } from 'i18next';
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
  matches?: (pathname: string) => boolean;
}

export interface AdminNavigationGroup {
  key: string;
  label: string;
  items: AdminNavigationItem[];
}

const adminGroups = (badges: Record<string, number>, t: TFunction): AdminNavigationGroup[] => [
  {
    key: 'admin-content',
    label: t('adminUi.nav.groups.admin-content'),
    items: [
      { key: 'announcements', label: t('adminUi.nav.items.announcements'), path: '/admin', icon: <NotificationOutlined /> },
      {
        key: 'banners',
        label: t('adminUi.nav.items.banners'),
        path: '/admin/banners/home',
        icon: <PictureOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/banners'),
      },
      {
        key: 'themes',
        label: t('adminUi.nav.items.themes'),
        path: '/admin/themes/all',
        icon: <AppstoreOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/themes'),
      },
      { key: 'documents', label: t('adminUi.nav.items.documents'), path: '/admin/documents', icon: <ReadOutlined /> },
      { key: 'comments', label: t('adminUi.nav.items.comments'), path: '/admin/comments', icon: <CommentOutlined /> },
    ],
  },
  {
    key: 'admin-platform',
    label: t('adminUi.nav.groups.admin-platform', { defaultValue: '平台运营' }),
    items: [
      {
        key: 'currency',
        label: t('adminUi.nav.items.currency', { defaultValue: '资金管理' }),
        path: '/admin/points/activity',
        icon: <GiftOutlined />,
        badge: badges.points,
        matches: (pathname) => pathname.startsWith('/admin/points') || pathname.startsWith('/admin/diamonds'),
      },
      { key: 'dailyTasks', label: t('adminUi.nav.items.dailyTasks', { defaultValue: '每日任务管理' }), path: '/admin/daily-tasks', icon: <CheckCircleOutlined /> },
      { key: 'lottery', label: t('adminUi.nav.items.lottery', { defaultValue: '抽奖活动' }), path: '/admin/lottery', icon: <TrophyOutlined /> },
      { key: 'shareRatio', label: t('adminUi.nav.items.shareRatio', { defaultValue: '分成比例' }), path: '/admin/share-ratio', icon: <PercentageOutlined /> },
    ],
  },
  {
    key: 'admin-account',
    label: t('adminUi.nav.groups.admin-account', { defaultValue: '账户与权限' }),
    items: [
      {
        key: 'subscriptions',
        label: t('adminUi.nav.items.subscriptions', { defaultValue: '会员管理' }),
        path: '/admin/subscriptions/records',
        icon: <ShoppingOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/subscriptions'),
      },
      { key: 'users', label: t('adminUi.nav.items.users', { defaultValue: '用户角色' }), path: '/admin/users', icon: <TeamOutlined /> },
      {
        key: 'withdraw',
        label: t('adminUi.nav.items.withdraw', { defaultValue: '提现管理' }),
        path: '/admin/withdraw/applications',
        icon: <WalletOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/withdraw'),
      },
    ],
  },
  {
    key: 'admin-ai',
    label: t('adminUi.nav.groups.admin-ai'),
    items: [
      {
        key: 'aiModelCenter',
        label: t('adminUi.nav.items.aiModelCenter'),
        path: '/admin/ai-model-center/usage',
        icon: <BulbOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/ai-model-center') || pathname.startsWith('/admin/ai-model-pricing') || pathname.startsWith('/admin/image-gen') || pathname.startsWith('/admin/text-llm'),
      },
      {
        key: 'assetCenter',
        label: t('adminUi.nav.items.assetCenter'),
        path: '/admin/avatars',
        icon: <PictureOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/avatars') || pathname.startsWith('/admin/art-styles'),
      },
      {
        key: 'components',
        label: t('adminUi.nav.items.components'),
        path: '/admin/components',
        icon: <SettingOutlined />,
        matches: (pathname) => pathname.startsWith('/admin/components') || pathname.startsWith('/admin/play-mods'),
      },
    ],
  },
];

const operatorGroups = (isAdmin: boolean, badges: Record<string, number>, t: TFunction): AdminNavigationGroup[] => [
  {
    key: 'operator-overview',
    label: t('adminUi.nav.groups.operator-overview'),
    items: [
      {
        key: 'stats',
        label: t('adminUi.nav.items.stats', { defaultValue: '数据看板' }),
        path: '/operator',
        icon: <BarChartOutlined />,
        matches: (pathname) => pathname === '/operator' || pathname.startsWith('/operator/reports'),
      },
    ],
  },
  {
    key: 'operator-growth',
    label: t('adminUi.nav.groups.operator-growth'),
    items: [
      {
        key: 'promotions',
        label: t('adminUi.nav.items.promotions'),
        path: '/operator/promotion/list',
        icon: <ThunderboltOutlined />,
        badge: badges.promotions,
        matches: (pathname) => pathname.startsWith('/operator/promotion'),
      },
      { key: 'recruitment', label: t('adminUi.nav.items.recruitment'), path: '/operator/recruitment', icon: <TeamOutlined /> },
      ...(isAdmin
        ? [
            { key: 'promoters', label: t('adminUi.nav.items.promoters'), path: '/operator/promoters', icon: <UserOutlined /> },
          ]
        : []),
    ],
  },
  {
    key: 'operator-content',
    label: t('adminUi.nav.groups.operator-content'),
    items: [
      ...(isAdmin
        ? [
            { key: 'specialAuthors', label: t('adminUi.nav.items.specialAuthors'), path: '/operator/special-authors', icon: <TeamOutlined /> },
            {
              key: 'platformWorks',
              label: t('adminUi.nav.items.platformWorks'),
              path: '/operator/platform-works/works',
              icon: <BookOutlined />,
              badge: badges.platformWorks,
              matches: (pathname: string) => pathname.startsWith('/operator/platform-works'),
            },
          ]
        : []),
      {
        key: 'contentReports',
        label: t('adminUi.nav.items.contentReports'),
        path: '/operator/content-reports/reports',
        icon: <AlertOutlined />,
        matches: (pathname) => pathname.startsWith('/operator/content-reports'),
      },
      { key: 'appeals', label: t('adminUi.nav.items.appeals'), path: '/operator/appeals', icon: <FileSearchOutlined /> },
      { key: 'publishQueue', label: t('adminUi.nav.items.publishQueue'), path: '/operator/publish-queue', icon: <SettingOutlined /> },
    ],
  },
  {
    key: 'operator-platform',
    label: t('adminUi.nav.groups.operator-platform'),
    items: [
      {
        key: 'aiModelCenter',
        label: t('adminUi.nav.items.aiModelCenter'),
        path: '/operator/ai-model-center/usage',
        icon: <BulbOutlined />,
        matches: (pathname) => pathname.startsWith('/operator/ai-model-center'),
      },
      { key: 'platformBenefits', label: t('adminUi.nav.items.platformBenefits'), path: '/operator/platform-benefits', icon: <GiftOutlined /> },
      { key: 'dailyTasks', label: '每日任务', path: '/operator/daily-tasks', icon: <CheckCircleOutlined /> },
      {
        key: 'withdraw',
        label: t('adminUi.nav.items.withdraw', { defaultValue: '提现管理' }),
        path: '/operator/withdraw/applications',
        icon: <WalletOutlined />,
        matches: (pathname) => pathname.startsWith('/operator/withdraw'),
      },
      {
        key: 'assetCenter',
        label: t('adminUi.nav.items.assetCenter'),
        path: '/operator/avatars',
        icon: <PictureOutlined />,
        matches: (pathname) => ['/operator/avatars', '/operator/locations', '/operator/location-assets', '/operator/audio-library', '/operator/art-styles'].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
      },
      {
        key: 'components',
        label: t('adminUi.nav.items.components'),
        path: '/operator/components',
        icon: <SettingOutlined />,
        matches: (pathname) => pathname.startsWith('/operator/components') || pathname.startsWith('/operator/play-mods'),
      },
      {
        key: 'messages',
        label: t('adminUi.nav.items.messagesHub', { defaultValue: '消息中心' }),
        path: '/operator/messages/feedback',
        icon: <CommentOutlined />,
        matches: (pathname) => pathname.startsWith('/operator/messages') || pathname.startsWith('/operator/feedback'),
      },
      { key: 'businessCoop', label: t('adminUi.nav.items.businessCoop'), path: '/operator/business-coop', icon: <TeamOutlined /> },
      { key: 'gameIssues', label: t('adminUi.nav.items.gameIssues'), path: '/operator/game-issues', icon: <AlertOutlined /> },
    ],
  },
];

export const getAdminNavigation = (
  mode: AdminShellMode,
  options: { isAdmin?: boolean; userId?: string; badges?: Record<string, number> } = {},
  t: TFunction,
): AdminNavigationGroup[] => {
  const badges = options.badges || {};
  if (mode === 'operator') return operatorGroups(Boolean(options.isAdmin), badges, t);
  if (options.userId === '96e89940badf1f67') {
    return [{ key: 'admin-limited', label: t('adminUi.nav.groups.admin-limited'), items: [{ key: 'comments', label: t('adminUi.nav.items.comments'), path: '/admin/comments', icon: <CommentOutlined /> }] }];
  }
  return adminGroups(badges, t);
};

export const flattenNavigationItems = (groups: AdminNavigationGroup[]): AdminNavigationItem[] => (
  groups.flatMap((group) => group.items.flatMap((item) => [item, ...flattenNavigationItems([{ key: item.key, label: item.label, items: item.children || [] }])]))
);

export const resolveNavigationSelection = (groups: AdminNavigationGroup[], pathname: string) => {
  const find = (items: AdminNavigationItem[], parents: string[] = []): { key: string; openKeys: string[] } | null => {
    for (const item of items) {
      const nested = item.children?.length ? find(item.children, [...parents, item.key]) : null;
      if (nested) return nested;
      const matched = item.matches ? item.matches(pathname) : item.path === pathname;
      if (matched) return { key: item.key, openKeys: parents };
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
