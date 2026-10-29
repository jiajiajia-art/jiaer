/**
 * 对接 funloom 平台头像库（/api/avatar-library）。
 * Romance 经 virtual 嵌入主站，读 auth-storage 的 token；图片 URL 走同源/ASSET 根。
 */
import type { AvatarSource } from '../game/avatarPools';

export type PlatformAvatarItem = {
  id: string;
  gender: string;
  ageGroup: string;
  backgroundType: string;
  imageUrl: string;
  thumbUrl?: string;
  originalUrl?: string;
  title?: string;
  kind?: string;
};

type GroupDef = {
  id: string;
  name: string;
  hint: string;
  gender: string;
  ageGroup: string;
};

/** 功能注释：与旧版 Unsplash 分区文案对齐，按性别×年龄归桶展示 */
export const PLATFORM_AVATAR_GROUPS: readonly GroupDef[] = Object.freeze([
  { id: 'female-adult', name: '青年女性', hint: '女 · 成年', gender: 'female', ageGroup: 'adult' },
  { id: 'male-adult', name: '青年男性', hint: '男 · 成年', gender: 'male', ageGroup: 'adult' },
  { id: 'female-elder', name: '成熟女性', hint: '女 · 老年', gender: 'female', ageGroup: 'elder' },
  { id: 'male-elder', name: '成熟男性', hint: '男 · 老年', gender: 'male', ageGroup: 'elder' },
  { id: 'female-child', name: '幼年女性', hint: '女 · 幼年', gender: 'female', ageGroup: 'child' },
  { id: 'male-child', name: '幼年男性', hint: '男 · 幼年', gender: 'male', ageGroup: 'child' },
]);

/**
 * 功能注释：平台 API 根地址。
 * 与主站 config.resolveHostAddress 对齐：有 VITE_API_BASE_URL 用其值；
 * 空串表示 Aliyun 同源 Nginx 反代（gogo/neo/qqq），请求当前域名 /api。
 */
export function resolveFunloomApiBase(): string {
  // Node 单测里 import.meta.env 可能不存在
  const env = (import.meta as ImportMeta & { env?: { VITE_API_BASE_URL?: string; VITE_RUNTIME?: string } }).env;
  const fromEnv = String(env?.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return '';
}

function apiBase(): string {
  return resolveFunloomApiBase();
}

function assetBase(): string {
  return apiBase().replace(/\/cn-test-api$/i, '');
}

/** 功能注释：从主站 zustand persist（auth-storage）取 JWT */
export function readFunloomAuthToken(): string {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { state?: { user?: { token?: string } } };
    return String(parsed?.state?.user?.token || '').trim();
  } catch {
    return '';
  }
}

/**
 * 功能注释：新作品作者名优先用主站账号昵称 / 用户名；读不到则空串（不伪造）。
 * 仅用于新建绑定；编辑旧作品不得用此覆盖原作者。
 */
export function readFunloomAuthorLabel(): string {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as {
      state?: { user?: { user?: { nickname?: string; name?: string; userCode?: string } } };
    };
    const u = parsed?.state?.user?.user;
    const label = String(u?.nickname || u?.name || u?.userCode || '').trim();
    return label;
  } catch {
    return '';
  }
}

export function resolvePlatformAvatarUrl(path: string | null | undefined): string {
  const p = String(path || '').trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p) || p.startsWith('data:') || p.startsWith('blob:')) return p;
  const normalized = p.startsWith('/') ? p : `/${p}`;
  return `${assetBase()}${normalized}`;
}

export function platformAvatarDisplayUrl(item: PlatformAvatarItem): string {
  return resolvePlatformAvatarUrl(item.imageUrl || item.originalUrl || item.thumbUrl || '');
}

async function listScope(token: string, scope: 'public' | 'system'): Promise<PlatformAvatarItem[]> {
  const res = await fetch(`${apiBase()}/api/avatar-library?scope=${scope}&status=active`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: PlatformAvatarItem[];
    message?: string;
  } | null;
  if (!res.ok || !json?.success || !Array.isArray(json.data)) {
    throw new Error(json?.message || `加载${scope === 'system' ? '系统' : '公共'}头像失败`);
  }
  return json.data.filter((x) => x && String(x.imageUrl || x.originalUrl || '').trim());
}

/**
 * 功能注释：拉公共+系统库并按性别×年龄分组成 AvatarSource（供选择器 / 抽图缓存）。
 */
export function groupPlatformAvatars(items: PlatformAvatarItem[]): AvatarSource[] {
  const pools: AvatarSource[] = [];
  for (const g of PLATFORM_AVATAR_GROUPS) {
    const images = items
      .filter((it) => it.gender === g.gender && it.ageGroup === g.ageGroup)
      .map((it) => platformAvatarDisplayUrl(it))
      .filter(Boolean);
    if (!images.length) continue;
    pools.push({
      name: g.name,
      hint: `${g.hint} · ${images.length} 张`,
      images,
      source: 'public',
    });
  }
  // 未落入三维桶的（缺标签）单独一栏，避免丢图
  const tagged = new Set(
    items
      .filter((it) =>
        PLATFORM_AVATAR_GROUPS.some((g) => g.gender === it.gender && g.ageGroup === it.ageGroup),
      )
      .map((it) => it.id),
  );
  const orphan = items
    .filter((it) => !tagged.has(it.id))
    .map((it) => platformAvatarDisplayUrl(it))
    .filter(Boolean);
  if (orphan.length) {
    pools.push({
      name: '未分类',
      hint: `缺三维标签 · ${orphan.length} 张`,
      images: orphan,
      source: 'public',
    });
  }
  return pools;
}

export async function fetchPlatformSystemAvatarPools(token?: string): Promise<AvatarSource[]> {
  const t = String(token || readFunloomAuthToken() || '').trim();
  if (!t) throw new Error('请先登录后再浏览平台头像库');
  const [pub, sys] = await Promise.all([
    listScope(t, 'public'),
    listScope(t, 'system'),
  ]);
  // 功能注释：同 URL 去重，系统与公共合并进同一套分组
  const seen = new Set<string>();
  const merged: PlatformAvatarItem[] = [];
  for (const it of [...sys, ...pub]) {
    const url = platformAvatarDisplayUrl(it);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push(it);
  }
  return groupPlatformAvatars(merged);
}
