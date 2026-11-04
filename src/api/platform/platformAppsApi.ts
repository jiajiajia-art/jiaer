/**
 * 平台应用表 API：创作草稿 / 上架 / 商店列表；作品与手机只读已上架记录。
 */
import { HOST_ADDRESS } from '../../config';

export type PlatformAppType = 'chat' | 'message' | 'browse' | 'read' | 'video' | 'job';
export type PlatformAppStatus = 'draft' | 'published';

export type PlatformApp = {
  appId: string;
  authorId: string;
  authorName: string;
  name: string;
  icon: string;
  previews: string[];
  summary: string;
  category: string;
  type: PlatformAppType | string;
  content: unknown;
  status: PlatformAppStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export const PLATFORM_APP_TYPE_OPTIONS: { value: PlatformAppType; label: string }[] = [
  { value: 'chat', label: '聊天' },
  { value: 'message', label: '信息' },
  { value: 'browse', label: '浏览' },
  { value: 'read', label: '阅读' },
  { value: 'video', label: '视频' },
  { value: 'job', label: '招聘' },
];

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

export const platformAppsApi = {
  listPublished: async (token: string | null | undefined, q = '') => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    const qs = params.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/platform-apps${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },

  listMine: async (token: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/auth/platform-apps/mine`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },

  get: async (token: string | null | undefined, appId: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/platform-apps/${encodeURIComponent(appId)}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },

  create: async (
    token: string,
    body: {
      name: string;
      icon?: string;
      previews?: string[];
      summary?: string;
      category?: string;
      type: PlatformAppType | string;
      content?: unknown;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/auth/platform-apps`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },

  update: async (
    token: string,
    appId: string,
    body: Partial<{
      name: string;
      icon: string;
      previews: string[];
      summary: string;
      category: string;
      type: PlatformAppType | string;
      content: unknown;
      status: PlatformAppStatus | string;
    }>,
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/auth/platform-apps/${encodeURIComponent(appId)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },

  publish: async (token: string, appId: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/auth/platform-apps/${encodeURIComponent(appId)}/publish`,
      { method: 'POST', headers: authHeaders(token) },
    );
    return parseJson(res);
  },

  unpublish: async (token: string, appId: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/auth/platform-apps/${encodeURIComponent(appId)}/unpublish`,
      { method: 'POST', headers: authHeaders(token) },
    );
    return parseJson(res);
  },

  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${HOST_ADDRESS}/api/auth/platform-apps/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res);
  },
};

export default platformAppsApi;
