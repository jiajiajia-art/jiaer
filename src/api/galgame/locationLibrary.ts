/**
 * 运营地点库 API：后台 CRUD / 停用；创作者只读 active 列表。
 */
import { HOST_ADDRESS } from '../../config';

export type LocationLibraryTreeRoom = {
  key: string;
  name: string;
  description?: string;
  imageUrl?: string;
  parentKey?: string | null;
  order?: number;
};

export type LocationLibraryItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  /** 大地图下的地点树；缺省导入时退化为单地点 */
  treeJson?: { rooms: LocationLibraryTreeRoom[] } | null;
  tags?: string[];
  authorKul?: string;
  status: 'active' | 'disabled';
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

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

export const locationLibraryApi = {
  list: async (
    token: string,
    opts: { q?: string; status?: string; includeDisabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.status) params.set('status', opts.status);
    if (opts.includeDisabled === false) params.set('includeDisabled', '0');
    const qs = params.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/location-library${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  create: async (
    token: string,
    body: {
      name: string;
      description?: string;
      imageUrl: string;
      sortOrder?: number;
      status?: string;
      tags?: string[];
      authorKul?: string;
      treeJson?: { rooms: LocationLibraryTreeRoom[] } | string | null;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-library`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  update: async (
    token: string,
    id: string,
    body: Partial<{
      name: string;
      description: string;
      imageUrl: string;
      sortOrder: number;
      status: string;
      tags: string[];
      authorKul: string;
      treeJson: { rooms: LocationLibraryTreeRoom[] } | string | null;
    }>,
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  disable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-library/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  enable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-library/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${HOST_ADDRESS}/api/location-library/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res);
  },
};
