/** 仓库侧栏导航配置（方案 B：含游玩历史） */

export type WarehouseNavItem = {
  id: string;
  path: string;
  label: string;
  group: 'mine' | 'public' | 'extra';
  soon?: boolean;
};

export const WAREHOUSE_NAV: WarehouseNavItem[] = [
  { id: 'persona', path: '/warehouse/persona', label: 'warehouse.navPersona', group: 'mine' },
  { id: 'characters', path: '/warehouse/characters', label: 'warehouse.navCharacters', group: 'mine' },
  { id: 'avatars', path: '/warehouse/avatars', label: 'warehouse.navAvatars', group: 'mine' },
  { id: 'worldbooks', path: '/warehouse/worldbooks', label: 'warehouse.navWorldbooks', group: 'mine' },
  { id: 'plugins', path: '/warehouse/plugins', label: 'warehouse.navPlugins', group: 'mine' },
  { id: 'public-cards', path: '/warehouse/public/cards', label: 'warehouse.navPublicCards', group: 'public' },
  { id: 'public-worldbooks', path: '/warehouse/public/worldbooks', label: 'warehouse.navPublicWorldbooks', group: 'public' },
  { id: 'public-plugins', path: '/warehouse/public/plugins', label: 'warehouse.navPublicPlugins', group: 'public' },
  { id: 'history', path: '/warehouse/history', label: 'warehouse.navHistory', group: 'extra' },
];

export const WAREHOUSE_GROUP_LABEL: Record<WarehouseNavItem['group'], string> = {
  mine: 'warehouse.groupMine',
  public: 'warehouse.groupPublic',
  extra: 'warehouse.groupExtra',
};

/** 最长路径优先，避免 /warehouse/public 误匹配子路由前缀问题 */
export function resolveWarehouseNavItem(pathname: string): WarehouseNavItem | undefined {
  const path = String(pathname || '').split('?')[0] || '';
  if (!path.startsWith('/warehouse')) return undefined;
  const ranked = [...WAREHOUSE_NAV].sort((a, b) => b.path.length - a.path.length);
  return ranked.find((item) => path === item.path || path.startsWith(`${item.path}/`));
}

/** 筛选值保持中文，与卡面 tag 数据一致 */
export const PERSONA_TAGS = [
  '全部',
  '恋爱',
  '奇幻',
  '校园',
  '日常',
  '冒险',
  '悬疑',
  '治愈',
] as const;

/** 标签筛选「全部」— 值保持中文，与卡面 tag 数据一致 */
export const PERSONA_TAG_ALL = PERSONA_TAGS[0];

/** 世界书空条目默认标题（写入数据，保持中文） */
export const WORLDBOOK_DEFAULT_ENTRY_TITLE = '世界书';

const PERSONA_TAG_I18N: Record<string, string> = {
  全部: 'warehouse.tags.all',
  恋爱: 'warehouse.tags.romance',
  奇幻: 'warehouse.tags.fantasy',
  校园: 'warehouse.tags.school',
  日常: 'warehouse.tags.daily',
  冒险: 'warehouse.tags.adventure',
  悬疑: 'warehouse.tags.mystery',
  治愈: 'warehouse.tags.healing',
};

export function personaTagLabel(tag: string, t: (key: string) => string): string {
  const key = PERSONA_TAG_I18N[tag];
  return key ? t(key) : tag;
}

const GENDER_FALLBACK: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他',
};

export function genderLabel(g: string, t?: (key: string) => string): string {
  if (g === 'male') return t ? t('warehouse.gender.male') : GENDER_FALLBACK.male;
  if (g === 'female') return t ? t('warehouse.gender.female') : GENDER_FALLBACK.female;
  if (g === 'other') return t ? t('warehouse.gender.other') : GENDER_FALLBACK.other;
  return t ? t('warehouse.gender.unknown') : '未知';
}
