/**
 * 运营平台音频库 API：BGM / 音效 / 环境音；下架不删文件，已引用作品仍可播。
 */
import { HOST_ADDRESS } from '../../config';

export type AudioLibraryKind = 'bgm' | 'sfx' | 'amb';

export type AudioLibraryItem = {
  id: string;
  name: string;
  description: string;
  audioUrl: string;
  kind: AudioLibraryKind;
  loop?: boolean;
  durationSec?: number | null;
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

export const audioLibraryApi = {
  list: async (
    token: string | null | undefined,
    opts: { q?: string; kind?: string; status?: string; includeDisabled?: boolean } = {},
  ) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.kind) params.set('kind', opts.kind);
    if (opts.status) params.set('status', opts.status);
    if (opts.includeDisabled) params.set('includeDisabled', '1');
    const qs = params.toString();
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library${qs ? `?${qs}` : ''}`, {
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  create: async (
    token: string,
    body: {
      name: string;
      description?: string;
      audioUrl: string;
      kind: AudioLibraryKind;
      loop?: boolean;
      durationSec?: number | null;
      tags?: string[];
      authorKul?: string;
      sortOrder?: number;
      status?: string;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library`, {
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
      audioUrl: string;
      kind: AudioLibraryKind;
      loop: boolean;
      durationSec: number | null;
      tags: string[];
      authorKul: string;
      sortOrder: number;
      status: string;
    }>,
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  disable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  enable: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
      headers: authHeaders(token, false),
    });
    return parseJson(res);
  },
  upload: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${HOST_ADDRESS}/api/audio-library/upload`, {
      method: 'POST',
      headers: authHeaders(token, false),
      body: form,
    });
    return parseJson(res);
  },
};
