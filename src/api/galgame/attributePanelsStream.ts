import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';

export interface StreamHandlers<T = any> {
  onStart?: () => void;
  onChunk?: (text: string) => void;
  onError?: (message: string) => void;
  onDone?: (json: T | null) => void;
}

/**
 * 读取 Galgame 属性面板的 SSE 流，并在结束后返回完整 JSON
 * - 服务端事件：start | raw_text | error | done
 * - raw_text 为 LLM 增量文本；最终整体能解析为 { panels: Record<string,string> }
 */
export async function streamAttributePanels<T = any>(
  sessionId: string,
  handlers: StreamHandlers<T> = {},
  signal?: AbortSignal
): Promise<T | null> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/attribute-panels`;
  const res = await authFetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/event-stream',
    },
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
  let fullText = '';

  handlers.onStart?.();

  const flushEvents = async () => {
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const dataLines = part.split('\n').filter((l) => l.startsWith('data:'));
      const payload = dataLines.map((l) => l.slice(5).trim()).join('\n');
      if (!payload) continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }

      if (evt?.type === 'raw_text' && typeof evt.text === 'string') {
        fullText += evt.text;
        handlers.onChunk?.(evt.text);
      } else if (evt?.type === 'error') {
        handlers.onError?.(evt.message || 'UNKNOWN_ERROR');
      } else if (evt?.type === 'start') {
        // no-op
      }
      // evt.type === 'done' 由 read 结束统一处理
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    await flushEvents();
  }

  let parsed: T | null = null;
  try {
    parsed = JSON.parse(fullText);
  } catch {
    handlers.onError?.('INVALID_JSON');
    handlers.onDone?.(null);
    return null;
  }
  handlers.onDone?.(parsed);
  return parsed;
}
