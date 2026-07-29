import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { QuestItem } from '../../lib/galgame/quests';
import { extractJsonFromStreamText, isAbortError } from '../../lib/galgame/attributePanelValues';
import type { StreamHandlers } from './attributePanelsStream';

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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let resultQuests: QuestItem[] | null = null;

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
        handlers.onError?.(String(evt.message || 'UNKNOWN_ERROR'));
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

  // 功能注释：解析失败用内部码；UI 应翻译或在已有列表时忽略，勿直接展示给玩家。
  handlers.onError?.('INVALID_JSON');
  handlers.onDone?.(null);
  return null;
}
