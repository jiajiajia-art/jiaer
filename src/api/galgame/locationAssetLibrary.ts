/**
 * 运营地点素材库 API：只存图；用途 world_map / location_scene / cover。
 */
import { HOST_ADDRESS } from '../../config';

export type LocationAssetPurpose = 'world_map' | 'location_scene' | 'cover';

export type LocationAssetLibraryItem = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  purpose: LocationAssetPurpose;
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

export const locationAssetLibraryApi = {
  list: async (
    token: string,
    opts: { q?: string; purpose?: string; status?: string; includeDisabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.purpose) params.set('purpose', opts.purpose);
    if (opts.status) params.set('status', opts.status);
    if (opts.includeDisabled === false) params.set('includeDisabled', '0');
    const qs = params.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library${qs ? `?${qs}` : ''}`, {
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
      purpose: LocationAssetPurpose;
      tags?: string[];
      authorKul?: string;
      sortOrder?: number;
      status?: string;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library`, {
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
      purpose: LocationAssetPurpose;
      tags: string[];
      authorKul: string;
      sortOrder: number;
      status: string;
    }>,
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  disable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  enable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${HOST_ADDRESS}/api/location-asset-library/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res);
  },
};
