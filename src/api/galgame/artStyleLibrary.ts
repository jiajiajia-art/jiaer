/**
 * 画风库 API（/api/art-style-library）：运营配置生图画风（名称 / 正向提示词 / 负面词 / 示例图 / 排序 / 上下架）。
 * 创作者编辑器只读上架项；接口未上线时编辑器回落内置预设。
 */
import { HOST_ADDRESS } from '../../config';

export type ArtStyleLibraryItem = {
  id: string;
  /** 稳定 key（如 vn / otome），作品里只存提示词，key 用于示例图与排序对齐 */
  key: string;
  name: string;
  prompt: string;
  negative?: string;
  sampleUrl?: string;
  /** 无示例图时的色块（CSS background） */
  swatch?: string;
  sortOrder?: number;
  status: 'active' | 'disabled';
  createdAt?: string;
  updatedAt?: string;
};

export type ArtStyleLibraryPayload = Partial<Omit<ArtStyleLibraryItem, 'id' | 'createdAt' | 'updatedAt'>>;

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, status: res.status, message: text || res.statusText };
  }
}

function authHeaders(token?: string | null, json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

const BASE = () => `${HOST_ADDRESS}/api/art-style-library`;

export const artStyleLibraryApi = {
  list: async (token: string, opts: { includeDisabled?: boolean } = {}) => {
    const qs = opts.includeDisabled ? '?includeDisabled=1' : '';
    const res = await fetch(`${BASE()}${qs}`, { headers: authHeaders(token, false) });
    return { httpStatus: res.status, ...(await parseJson(res)) };
  },
  create: async (token: string, body: ArtStyleLibraryPayload) => {
    const res = await fetch(BASE(), { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });
    return parseJson(res);
  },
  update: async (token: string, id: string, body: ArtStyleLibraryPayload) => {
    const res = await fetch(`${BASE()}/${encodeURIComponent(id)}`, { method: 'PUT', headers: authHeaders(token), body: JSON.stringify(body) });
    return parseJson(res);
  },
  disable: async (token: string, id: string) => {
    const res = await fetch(`${BASE()}/${encodeURIComponent(id)}/disable`, { method: 'POST', headers: authHeaders(token, false) });
    return parseJson(res);
  },
  enable: async (token: string, id: string) => {
    const res = await fetch(`${BASE()}/${encodeURIComponent(id)}/enable`, { method: 'POST', headers: authHeaders(token, false) });
    return parseJson(res);
  },
  /** 示例图上传，返回 { imageUrl } */
  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE()}/upload`, { method: 'POST', headers: authHeaders(token, false), body: form });
    return parseJson(res);
  },
};
