/**
 * 运营画风库 API：标识、名称、正/负提示词、示例图、色板、排序、上下架。
 */
import { HOST_ADDRESS } from '../../config';

export type ArtStyleLibraryItem = {
  id: string;
  key: string;
  name: string;
  prompt: string;
  negative: string;
  sampleUrl: string;
  swatch: string;
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

export const artStyleLibraryApi = {
  list: async (
    token: string | null | undefined,
    opts: { q?: string; includeDisabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.includeDisabled) params.set('includeDisabled', '1');
    const qs = params.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  create: async (
    token: string,
    body: {
      key: string;
      name: string;
      prompt: string;
      negative?: string;
      sampleUrl?: string;
      swatch?: string;
      sortOrder?: number;
      status?: string;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library`, {
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
      key: string;
      name: string;
      prompt: string;
      negative: string;
      sampleUrl: string;
      swatch: string;
      sortOrder: number;
      status: string;
    }>,
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  disable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  enable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${HOST_ADDRESS}/api/art-style-library/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res);
  },
};
