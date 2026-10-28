/**
 * 仓库头像库 API：列表 / 上传 / 匹配 / 标签选项 / 相册 / 匹配偏好
 */
import { HOST_ADDRESS } from '../../config';
import type {
  AvatarLibraryAlbum,
  AvatarLibraryItem,
  AvatarMatchPrefs,
  AvatarMatchResult,
  AvatarTagOption,
} from '../../lib/galgame/avatarLibrary';
import type { SquareCropRect } from '../../lib/galgame/squareAvatarPrep';

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

export type AvatarLibraryListScope =
  | 'mine'
  | 'public'
  | 'system'
  | 'admin'
  | 'user-uploads';

export const avatarLibraryApi = {
  list: async (
    token: string,
    opts: {
      scope?: AvatarLibraryListScope;
      gender?: string;
      ageGroup?: string;
      backgroundType?: string;
      q?: string;
      kind?: string;
      status?: string;
      albumId?: string;
    } = {},
  ) => {
    const params = new URLSearchParams();
    params.set('scope', opts.scope || 'mine');
    if (opts.gender) params.set('gender', opts.gender);
    if (opts.ageGroup) params.set('ageGroup', opts.ageGroup);
    if (opts.backgroundType) params.set('backgroundType', opts.backgroundType);
    if (opts.q) params.set('q', opts.q);
    if (opts.kind) params.set('kind', opts.kind);
    if (opts.status) params.set('status', opts.status);
    if (opts.albumId) params.set('albumId', opts.albumId);
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library?${params}`, {
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryItem[]; message?: string }>;
  },

  listTagOptions: async (
    token: string,
    opts: { dimension?: string; includeDisabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.dimension) params.set('dimension', opts.dimension);
    if (opts.includeDisabled) params.set('includeDisabled', '1');
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/tag-options?${params}`, {
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarTagOption[]; message?: string }>;
  },

  createTagOption: async (
    token: string,
    body: { dimension: string; label: string; id?: string; sortOrder?: number },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/tag-options`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarTagOption; message?: string }>;
  },

  updateTagOption: async (
    token: string,
    id: string,
    body: { label?: string; status?: string; sortOrder?: number },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/tag-options/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarTagOption; message?: string }>;
  },

  reorderTagOptions: async (token: string, dimension: string, orderedIds: string[]) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/tag-options/reorder`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ dimension, orderedIds }),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarTagOption[]; message?: string }>;
  },

  deleteTagOption: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/tag-options/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: unknown; message?: string; code?: string }>;
  },

  listAlbums: async (token: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/albums`, {
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryAlbum[]; message?: string }>;
  },

  createAlbum: async (token: string, body: { title?: string } = {}) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/albums`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryAlbum; message?: string }>;
  },

  updateAlbum: async (token: string, id: string, body: { title?: string; sortOrder?: number }) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/albums/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryAlbum; message?: string }>;
  },

  reorderAlbums: async (token: string, orderedIds: string[]) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/albums/reorder`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ orderedIds }),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryAlbum[]; message?: string }>;
  },

  deleteAlbum: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/albums/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: unknown; message?: string }>;
  },

  getMatchPrefs: async (token: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/match-prefs`, {
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarMatchPrefs; message?: string }>;
  },

  saveMatchPrefs: async (token: string, body: Partial<AvatarMatchPrefs>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/match-prefs`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarMatchPrefs; message?: string }>;
  },

  match: async (
    token: string,
    opts: {
      gender: string;
      ageGroup: string;
      backgroundType: string;
      excludeUrls?: string[];
      /** 剧本级覆盖；未传则服务端用平台默认（私人优先 + 启用通用兜底） */
      sourceOrder?: Array<'private' | 'public' | string>;
      allowUniversalFallback?: boolean;
    },
  ) => {
    const params = new URLSearchParams();
    params.set('gender', opts.gender);
    params.set('ageGroup', opts.ageGroup);
    params.set('backgroundType', opts.backgroundType);
    if (opts.excludeUrls?.length) params.set('excludeUrls', opts.excludeUrls.join(','));
    if (opts.sourceOrder?.length) params.set('sourceOrder', opts.sourceOrder.join(','));
    if (typeof opts.allowUniversalFallback === 'boolean') {
      params.set('allowUniversalFallback', opts.allowUniversalFallback ? '1' : '0');
    }
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/match?${params}`, {
      headers: authHeaders(token),
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarMatchResult; message?: string }>;
  },

  upload: async (
    token: string,
    file: File,
    meta: {
      gender: string;
      ageGroup: string;
      backgroundType: string;
      title?: string;
      albumId?: string;
      kind?: 'private' | 'public' | 'system';
      asSystem?: boolean;
      asPublic?: boolean;
      crop?: SquareCropRect | null;
    },
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('gender', meta.gender);
    form.append('ageGroup', meta.ageGroup);
    form.append('backgroundType', meta.backgroundType);
    if (meta.title) form.append('title', meta.title);
    if (meta.albumId) form.append('albumId', meta.albumId);
    if (meta.kind) form.append('kind', meta.kind);
    if (meta.asSystem) form.append('asSystem', '1');
    if (meta.asPublic) form.append('asPublic', '1');
    if (meta.crop) form.append('crop', JSON.stringify(meta.crop));
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res) as Promise<{ success: boolean; data?: AvatarLibraryItem; message?: string }>;
  },

  update: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },

  delist: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/${encodeURIComponent(id)}/delist`, {
      method: 'POST',
      headers: authHeaders(token),
      body: '{}',
    });
    return parseJson(res);
  },

  remove: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/avatar-library/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
};
