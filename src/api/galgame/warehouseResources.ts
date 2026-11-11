/**
 * 仓库资源（世界书 / 插件）API
 */
import { HOST_ADDRESS } from '../../config';

export type WarehouseResourceType = 'worldbook' | 'plugin';

export type WarehouseResource = {
  id: string;
  userId?: string;
  resourceType: WarehouseResourceType;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  isPublic?: boolean;
  tags?: string[];
  authorName?: string;
  sourceId?: string | null;
  enabled?: boolean;
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

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const warehouseResourcesApi = {
  list: async (
    token: string,
    opts: { type: WarehouseResourceType; q?: string; tag?: string },
  ) => {
    const params = new URLSearchParams();
    params.set('type', opts.type);
    if (opts.q) params.set('q', opts.q);
    if (opts.tag) params.set('tag', opts.tag);
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources?${params}`, {
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  listPublic: async (
    token: string,
    opts: { type: WarehouseResourceType; q?: string; tag?: string },
  ) => {
    const params = new URLSearchParams();
    params.set('type', opts.type);
    if (opts.q) params.set('q', opts.q);
    if (opts.tag) params.set('tag', opts.tag);
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources/public?${params}`, {
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  create: async (
    token: string,
    body: Record<string, unknown> & { type: WarehouseResourceType },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  update: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  remove: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  publish: async (token: string, id: string, isPublic = true) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/warehouse-resources/${encodeURIComponent(id)}/publish`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ isPublic }),
      },
    );
    return parseJson(res);
  },
  importFromPublic: async (token: string, resourceId: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/warehouse-resources/import-public`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ resourceId }),
    });
    return parseJson(res);
  },
};
