import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import { extractJsonFromStreamText, isAbortError } from '../../lib/galgame/attributePanelValues';

export interface StreamHandlers<T = any> {
  onStart?: () => void;
  onChunk?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: (json: T | null) => void;
}

export { extractJsonFromStreamText };

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  return isAbortError(error) || !!signal?.aborted;
}

/**
 * 读取 Galgame 属性面板的 SSE 流，并在结束后返回完整 JSON
 * - 服务端事件：start | raw_text | result | error | done
 * - 优先消费 type=result；否则从 raw 宽松提取 { panels }
 */
export async function streamAttributePanels<T = any>(
  sessionId: string,
  handlers: StreamHandlers<T> = {},
  signal?: AbortSignal
): Promise<T | null> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/attribute-panels`;

  let res: Response;
  try {
    res = await authFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
      signal,
    });
  } catch (error) {
    if (isAbortLike(error, signal)) {
      return null;
    }
    throw error;
  }

  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try {
      msg = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  // 后端空历史会直接返回 JSON（非 SSE）
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json()) as { panels?: Record<string, string>; success?: boolean };
    const payload = (
      json?.panels && typeof json.panels === 'object'
        ? { panels: json.panels }
        : json
    ) as T;
    handlers.onDone?.(payload);
    return payload;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let resultPanels: Record<string, string> | null = null;

  handlers.onStart?.();

  const flushEvents = async () => {
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const dataLines = part.split('\n').filter((l) => l.startsWith('data:'));
      const payload = dataLines.map((l) => l.slice(5).trim()).join('\n');
      if (!payload) continue;
      let evt: Record<string, unknown>;
      try {
        evt = JSON.parse(payload);
      } catch {
        continue;
      }

      if (evt?.type === 'raw_text' && typeof evt.text === 'string') {
        fullText += evt.text;
        handlers.onChunk?.(evt.text);
      } else if (evt?.type === 'result' && evt.panels && typeof evt.panels === 'object') {
        resultPanels = evt.panels as Record<string, string>;
      } else if (evt?.type === 'error') {
        if (!signal?.aborted) {
          handlers.onError?.(String(evt.message || 'UNKNOWN_ERROR'));
        }
      }
    }
  };

  try {
    while (true) {
      if (signal?.aborted) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        return null;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      await flushEvents();
    }
  } catch (error) {
    if (isAbortLike(error, signal)) {
      return null;
    }
    throw error;
  }

  if (signal?.aborted) {
    return null;
  }

  if (resultPanels) {
    const payload = { panels: resultPanels } as T;
    handlers.onDone?.(payload);
    return payload;
  }

  const extracted = extractJsonFromStreamText(fullText);
  if (
    extracted &&
    typeof extracted === 'object' &&
    (extracted as { panels?: unknown }).panels &&
    typeof (extracted as { panels: unknown }).panels === 'object'
  ) {
    const payload = extracted as T;
    handlers.onDone?.(payload);
    return payload;
  }

  handlers.onError?.('INVALID_JSON');
  handlers.onDone?.(null);
  return null;
}
