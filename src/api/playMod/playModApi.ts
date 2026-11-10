/**
 * 玩法 Mod：运营管理 + 广场购买安装 API
 */
import { HOST_ADDRESS } from '../../config';

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, message: text || res.statusText };
  }
}

function authHeaders(token?: string | null, json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export type PlayModStatus = 'draft' | 'pending' | 'private_test' | 'listed' | 'delisted' | 'disabled';

export type PlayModRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** 功能注释：商店详情完整说明（上架必填） */
  detailMd?: string;
  /** 功能注释：预览图列表（上架至少 1 张） */
  previewImages?: string[];
  /** 功能注释：详情页作者展示名 */
  authorDisplayName?: string;
  category: string;
  iconSvg: string;
  version: string;
  compatMin?: string;
  compatMax?: string;
  defaultNavLabel: string;
  needsNavEntry: boolean;
  adjustableParams: string[];
  editorPanels: string[];
  priceKk: number;
  status: PlayModStatus;
  origin: string;
  authorUserId: string;
  payload?: Record<string, unknown>;
  /** 功能注释：C0.2 适用题材 id（后端 payload.applicableThemeTagIds）；运营改绑后以此为准，空=沿用前端种子语义 */
  applicableThemeTagIds?: number[];
  officialRecommend: boolean;
  listedAt?: string;
  updatedAt?: string;
  stats?: PlayModStats;
  recommendScore?: number;
  shelfTag?: string;
};

export type PlayModStats = {
  views: number;
  favorites: number;
  buyers: number;
  installGames: number;
  activeGames: number;
  installs7d: number;
  ratingSum: number;
  ratingCount: number;
  refundCount: number;
};

export const playModAdminApi = {
  list: async (token: string, opts: { status?: string; kind?: string; q?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (opts.status) q.set('status', opts.status);
    if (opts.kind) q.set('kind', opts.kind);
    if (opts.q) q.set('q', opts.q);
    if (opts.limit != null) q.set('limit', String(opts.limit));
    if (opts.offset != null) q.set('offset', String(opts.offset));
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components?${q}`, { headers: authHeaders(token, false) });
    return parseJson(res);
  },
  upsert: async (token: string, body: Partial<PlayModRecord> & { id?: string; componentKind?: string }) => {
    const url = body.id
      ? `${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(body.id)}`
      : `${HOST_ADDRESS}/api/admin/components`;
    const res = await fetch(url, {
      method: body.id ? 'PUT' : 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  setStatus: async (token: string, id: string, status: PlayModStatus) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ status }),
    });
    return parseJson(res);
  },
  audit: async (token: string, id: string, approve: boolean) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(id)}/audit`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ approve }),
    });
    return parseJson(res);
  },
  setOfficialRecommend: async (token: string, id: string, officialRecommend: boolean) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(id)}/official-recommend`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ officialRecommend }),
    });
    return parseJson(res);
  },
  /** 功能注释：运营改绑玩法包适用题材（至少 1 个） */
  setApplicableThemes: async (token: string, id: string, themeTagIds: number[]) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(id)}/applicable-themes`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ themeTagIds }),
    });
    return parseJson(res);
  },
  remove: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  getWeights: async (token: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/weights`, { headers: authHeaders(token, false) });
    return parseJson(res);
  },
  setWeights: async (token: string, weights: Record<string, number>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/admin/components/weights`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ weights }),
    });
    return parseJson(res);
  },
};

export const playModStoreApi = {
  shelf: async (opts: { installed?: string[]; theme?: string; navSlotsLeft?: number; engineVersion?: string; token?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.installed?.length) q.set('installed', opts.installed.join(','));
    if (opts.theme) q.set('theme', opts.theme);
    if (opts.navSlotsLeft != null) q.set('navSlotsLeft', String(opts.navSlotsLeft));
    if (opts.engineVersion) q.set('engineVersion', opts.engineVersion);
    const res = await fetch(`${HOST_ADDRESS}/api/components/shelf?${q}`, {
      headers: authHeaders(opts.token, false),
    });
    return parseJson(res);
  },
  /** 功能注释：商店详情 — 作者/下载量(stats)/说明/预览图 */
  getDetail: async (id: string, token?: string | null) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/${encodeURIComponent(id)}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  purchase: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/${encodeURIComponent(id)}/purchase`, {
      method: 'POST',
      headers: authHeaders(token),
      body: '{}',
    });
    return parseJson(res);
  },
  install: async (token: string, id: string, body: { gameFileId: string; authorUserId?: string }) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/${encodeURIComponent(id)}/install`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  listInstalls: async (token: string, gameFileId: string) => {
    const q = new URLSearchParams({ gameFileId });
    const res = await fetch(`${HOST_ADDRESS}/api/components/installs?${q}`, { headers: authHeaders(token, false) });
    return parseJson(res);
  },
  updateInstall: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/${encodeURIComponent(id)}/install`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  createAiDraft: async (token: string, prompt: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/ai-drafts`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ prompt }),
    });
    return parseJson(res);
  },
  /** 功能注释：提审创作者玩法草稿；C0.2 要求带 ≥1 个适用题材 id */
  submitAiDraft: async (token: string, draftId: string, applicableThemeTagIds: number[] = []) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/ai-drafts/${encodeURIComponent(draftId)}/submit`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ applicableThemeTagIds }),
    });
    return parseJson(res);
  },
  /** 功能注释：C2.3 创作者本人的组件列表（草稿/私有测试/审核中/上架/下架）；后端只按登录用户过滤，非运营全量 */
  listMine: async (token: string, kind?: 'gameplay' | 'phone_app') => {
    const q = new URLSearchParams();
    if (kind) q.set('kind', kind);
    const qs = q.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/components/mine${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  uploadKkmod: async (token: string, body: { filename?: string; package: unknown; engineVersion?: string }) => {
    const res = await fetch(`${HOST_ADDRESS}/api/components/kkmod/upload`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
};
