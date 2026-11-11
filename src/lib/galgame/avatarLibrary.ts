/** 头像库：三维标签 + 匹配优先级（与后端 avatarLibraryService 对齐） */

/** 角色匹配性别（男/女）；头像资产另含 universal */
export const AVATAR_GENDERS = Object.freeze([
  { id: 'male', label: '男' },
  { id: 'female', label: '女' },
] as const);

/** 上传/筛选用头像性别，含「通用」不限角色性别 */
export const AVATAR_ASSET_GENDERS = Object.freeze([
  { id: 'male', label: '男' },
  { id: 'female', label: '女' },
  { id: 'universal', label: '通用' },
] as const);

/** 平台默认年龄段（label 可由后台改名；id 稳定） */
export const AVATAR_AGE_GROUPS = Object.freeze([
  { id: 'child', label: '儿童' },
  { id: 'adult', label: '成人' },
  { id: 'elder', label: '老年' },
] as const);

/** 平台默认背景类型 */
export const AVATAR_BACKGROUNDS = Object.freeze([
  { id: 'ancient', label: '古代' },
  { id: 'modern', label: '现代' },
  { id: 'fantasy', label: '西幻' },
] as const);

export const AVATAR_KINDS = Object.freeze([
  { id: 'private', label: '私人' },
  { id: 'public', label: '公共' },
  { id: 'system', label: '系统' },
] as const);

export type AvatarGenderId = (typeof AVATAR_GENDERS)[number]['id'];
export type AvatarAssetGenderId = (typeof AVATAR_ASSET_GENDERS)[number]['id'];
export type AvatarAgeGroupId = (typeof AVATAR_AGE_GROUPS)[number]['id'];
export type AvatarBackgroundId = (typeof AVATAR_BACKGROUNDS)[number]['id'];
export type AvatarKindId = (typeof AVATAR_KINDS)[number]['id'];

export type AvatarTagOption = {
  id: string;
  dimension: 'age_group' | 'background_type' | string;
  label: string;
  sortOrder?: number;
  status?: 'active' | 'disabled' | string;
  isBuiltin?: boolean;
};

export type AvatarLibraryAlbum = {
  id: string;
  ownerUserId?: string;
  title: string;
  sortOrder?: number;
  avatarCount?: number;
  previewUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type AvatarMatchPrefs = {
  sourceOrder: Array<'private' | 'public' | string>;
  privateAlbumOrder: string[];
  allowUniversalFallback: boolean;
};

export type AvatarLibraryItem = {
  id: string;
  ownerUserId?: string | null;
  albumId?: string | null;
  gender: string;
  ageGroup: string;
  backgroundType: string;
  imageUrl: string;
  thumbUrl?: string;
  originalUrl?: string;
  title?: string;
  isPublic?: boolean;
  isSystem?: boolean;
  kind?: AvatarKindId | string;
  status?: 'active' | 'delisted' | 'deleted' | string;
  width?: number;
  height?: number;
  sourceFormat?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AvatarMatchResult = {
  source: 'private' | 'public' | 'system' | null;
  avatar: AvatarLibraryItem | null;
  reason?: string | null;
  reused?: boolean;
  usedUniversal?: boolean;
};

export function avatarGenderLabel(id: string): string {
  return AVATAR_ASSET_GENDERS.find((x) => x.id === id)?.label
    || AVATAR_GENDERS.find((x) => x.id === id)?.label
    || id
    || '—';
}

export function avatarAgeLabel(id: string, options?: readonly AvatarTagOption[]): string {
  const fromOpts = options?.find((x) => x.dimension === 'age_group' && x.id === id)?.label;
  if (fromOpts) return fromOpts;
  return AVATAR_AGE_GROUPS.find((x) => x.id === id)?.label || id || '—';
}

export function avatarBackgroundLabel(id: string, options?: readonly AvatarTagOption[]): string {
  const fromOpts = options?.find((x) => x.dimension === 'background_type' && x.id === id)?.label;
  if (fromOpts) return fromOpts;
  return AVATAR_BACKGROUNDS.find((x) => x.id === id)?.label || id || '—';
}

export function avatarKindLabel(id: string): string {
  return AVATAR_KINDS.find((x) => x.id === id)?.label || id || '—';
}

/**
 * 功能注释：管理端网格卡副文案——性别 · 背景（历史停用标签仍可读展示）。
 */
export function formatAvatarCardSummary(
  item: Pick<AvatarLibraryItem, 'gender' | 'backgroundType'>,
  options?: readonly AvatarTagOption[],
): string {
  const gender = avatarGenderLabel(item.gender);
  const background = avatarBackgroundLabel(item.backgroundType, options);
  return `${gender} · ${background}`;
}

/** 功能注释：标题优先用户填写；否则用序号占位，对齐线框「头像 01」。 */
export function resolveAvatarCardTitle(
  item: Pick<AvatarLibraryItem, 'title'>,
  index: number,
): string {
  const title = String(item.title || '').trim();
  if (title) return title;
  const n = Math.max(1, Math.floor(Number(index) || 0) + 1);
  return `头像 ${String(n).padStart(2, '0')}`;
}

/** 功能注释：把后台选项转成分段控件；无数据时回落平台默认 */
export function tagOptionsToSeg(
  options: readonly AvatarTagOption[] | undefined,
  dimension: 'age_group' | 'background_type',
  fallback: readonly { id: string; label: string }[],
): { id: string; label: string }[] {
  const active = (options || [])
    .filter((o) => o.dimension === dimension && o.status !== 'disabled')
    .map((o) => ({ id: o.id, label: o.label || o.id }));
  return active.length ? active : fallback.map((x) => ({ id: x.id, label: x.label }));
}

/** 功能注释：前端展示用；真实匹配在服务端 pickAvatarLibraryMatch。库顺序/通用兜底由剧本编辑器①基础配置，平台仅提供默认值 */
export function describeAvatarMatchPriority(): string {
  return '手动锁定始终最高；库来源顺序与「通用」兜底按当前剧本配置（缺省=公共库优先并启用通用），系统默认头像始终最终回退';
}
