import { authFetch, api } from '../base';
import { HOST_ADDRESS } from '../../config';

export interface StreamHandlers<T = any> {
  onStart?: (payload: any) => void;
  onChunk?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: (payload: T | null) => void;
}

/**
 * 流式读取存档摘要（SSE）。
 * 事件负载为 JSON，需包含 { type: 'start'|'chunk'|'done'|'error'|'ping', ... }
 * - start: { candidateId, createdAt }
 * - chunk: { text }
 * - done:  { candidateId, fullTextLen }
 * - error: { message }
 */
export async function streamSaveSummary<T = any>(
  sessionId: string,
  handlers: StreamHandlers<T> = {},
  signal?: AbortSignal
): Promise<T | null> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/save/summary`;
  const res = await authFetch(url, {
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' },
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try { msg = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flush = () => {
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      // 只读取 data: 行，忽略 event: / id: / retry: 等
      const dataLines = part.split('\n').filter((l) => l.startsWith('data:'));
      const payload = dataLines.map((l) => l.slice(5).trim()).join('\n');
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      const t = (evt && evt.type) || '';
      if (t === 'start') {
        handlers.onStart?.(evt);
      } else if (t === 'chunk' && typeof evt.text === 'string') {
        handlers.onChunk?.(evt.text);
      } else if (t === 'error') {
        handlers.onError?.(evt.message || 'UNKNOWN_ERROR');
      } else if (t === 'done') {
        handlers.onDone?.(evt as T);
      } else if (t === 'ping') {
        // keepalive
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush();
  }

  return null;
}

export interface CreateSaveRequest {
  fileId: string;
  sessionId: string;
  summaryText: string;
  candidateId?: string;
}

export interface CreateSaveResponse {
  saveId: string;
  createdAt: number;
}

export interface SaveSummaryItem {
  saveId: string;
  summaryText: string;
  createdAt: number;
}

export interface ListSavesResponse {
  items: SaveSummaryItem[];
  total: number;
}

export interface SaveDetail {
  saveId: string;
  fileId: string;
  createdAt: number;
  summaryText: string;
  candidateId?: string;
}

export const savesApi = {
  create: (data: CreateSaveRequest) =>
    api.post<CreateSaveResponse>('/visual/saves', data),
  listByFileId: (fileId: string, params?: { offset?: number; limit?: number }) =>
    api.get<ListSavesResponse>('/visual/saves', {
      params: { fileId, offset: params?.offset ?? 0, limit: params?.limit ?? 5 },
    }),
  remove: (saveId: string, fileId?: string) =>
    api.delete(`/visual/saves/${saveId}`, {
      params: fileId ? { fileId } : undefined,
    }),
  getDetail: (saveId: string, fileId: string) =>
    api.get<SaveDetail>(`/visual/saves/${saveId}`, { params: { fileId } }),
};
