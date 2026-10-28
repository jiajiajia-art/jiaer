/** 仓库侧栏导航配置（方案 B：含游玩历史） */

export type WarehouseNavItem = {
  id: string;
  path: string;
  label: string;
  group: 'mine' | 'public' | 'extra';
  soon?: boolean;
};

export const WAREHOUSE_NAV: WarehouseNavItem[] = [
  { id: 'persona', path: '/warehouse/persona', label: '玩家人设卡', group: 'mine' },
  { id: 'characters', path: '/warehouse/characters', label: '我的角色卡', group: 'mine' },
  { id: 'avatars', path: '/warehouse/avatars', label: '头像库', group: 'mine' },
  { id: 'worldbooks', path: '/warehouse/worldbooks', label: '我的世界书', group: 'mine' },
  { id: 'plugins', path: '/warehouse/plugins', label: '我的插件', group: 'mine' },
  { id: 'public-cards', path: '/warehouse/public/cards', label: '公共卡库', group: 'public' },
  { id: 'public-worldbooks', path: '/warehouse/public/worldbooks', label: '公共世界书', group: 'public' },
  { id: 'public-plugins', path: '/warehouse/public/plugins', label: '公共插件', group: 'public' },
  { id: 'history', path: '/warehouse/history', label: '游玩历史', group: 'extra' },
];

export const WAREHOUSE_GROUP_LABEL: Record<WarehouseNavItem['group'], string> = {
  mine: '我的资源',
  public: '公共资源',
  extra: '其它',
};

/** 最长路径优先，避免 /warehouse/public 误匹配子路由前缀问题 */
export function resolveWarehouseNavItem(pathname: string): WarehouseNavItem | undefined {
  const path = String(pathname || '').split('?')[0] || '';
  if (!path.startsWith('/warehouse')) return undefined;
  const ranked = [...WAREHOUSE_NAV].sort((a, b) => b.path.length - a.path.length);
  return ranked.find((item) => path === item.path || path.startsWith(`${item.path}/`));
}

export const PERSONA_TAGS = [
  '全部',
  '恋爱',
  '奇幻',
  '校园',
  '日常',
  '冒险',
  '悬疑',
  '治愈',
];

export function genderLabel(g: string): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  if (g === 'other') return '其他';
  return '未知';
}
