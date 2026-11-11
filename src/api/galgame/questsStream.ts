import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { QuestItem } from '../../lib/galgame/quests';
import { normalizeQuests } from '../../lib/galgame/quests';
import { extractJsonFromStreamText, isAbortError } from '../../lib/galgame/attributePanelValues';
import type { StreamHandlers } from './attributePanelsStream';

/** 功能注释：只读已持久化任务（不跑 LLM），打开面板先有数。 */
export async function fetchCachedQuests(
  sessionId: string,
  signal?: AbortSignal,
): Promise<{ quests: QuestItem[]; source: 'cache' } | null> {
  const url = `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/quests?mode=cache`;
  const res = await authFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  const json = (await res.json()) as {
    success?: boolean;
    quests?: unknown;
  };
  if (!json?.success) return null;
  return { quests: normalizeQuests(json.quests), source: 'cache' };
}

/**
 * 功能注释：SSE 拉取最新任务列表；优先 type=result，否则从 raw 宽松提取 { quests }。
 */
export async function streamQuests(
  sessionId: string,
  handlers: StreamHandlers<{ quests: QuestItem[] }> = {},
  signal?: AbortSignal
): Promise<{ quests: QuestItem[] } | null> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/quests`;
  const res = await authFetch(url, {
    method: 'GET',
    headers: { Accept: 'text/event-stream' },
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try {
      msg = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }

  // mode=cache 或空历史可能直接 JSON
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json()) as { quests?: QuestItem[]; success?: boolean };
    const quests = normalizeQuests(json?.quests);
    const payload = { quests };
    handlers.onDone?.(payload);
    return payload;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let resultQuests: QuestItem[] | null = null;
  let streamError: string | null = null;

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
      } else if (evt?.type === 'result' && Array.isArray(evt.quests)) {
        resultQuests = evt.quests as QuestItem[];
      } else if (evt?.type === 'error') {
        const msg = String(evt.message || 'UNKNOWN_ERROR');
        streamError = msg;
        // 功能注释：有 result 时落盘忙仅软提示，勿盖掉已拿到的任务列表。
        if (!resultQuests) handlers.onError?.(msg);
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      await flushEvents();
    }
  } catch (e: unknown) {
    if (isAbortError(e) || signal?.aborted) {
      handlers.onDone?.(null);
      return null;
    }
    throw e;
  }

  if (resultQuests) {
    const payload = { quests: resultQuests };
    handlers.onDone?.(payload);
    return payload;
  }

  const parsed = extractJsonFromStreamText(fullText) as { quests?: QuestItem[] } | null;
  if (parsed && Array.isArray(parsed.quests)) {
    const payload = { quests: parsed.quests };
    handlers.onDone?.(payload);
    return payload;
  }

  // 功能注释：已有 SSE error 时不再二次标 INVALID_JSON（否则会盖掉锁/落盘错误）。
  if (!streamError) {
    handlers.onError?.('INVALID_JSON');
  }
  handlers.onDone?.(null);
  return null;
}
