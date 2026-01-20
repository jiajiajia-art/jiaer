// Minimal OpenAI-compatible SSE reader

export interface OpenAIStreamHandlers {
  onDelta?: (text: string) => void;
  onError?: (err: string) => void;
  onDone?: () => void;
}

export async function readOpenAIStream(resp: Response, handlers: OpenAIStreamHandlers){
  if (!resp.body) {
    handlers.onError?.(`No response body`);
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const l = line.trim();
        if (!l) continue;
        if (l === 'data: [DONE]') {
          handlers.onDone?.();
          continue;
        }
        const jsonStr = l.startsWith('data:') ? l.slice(5).trim() : l;
        try {
          const chunk = JSON.parse(jsonStr);
          const delta = chunk?.choices?.[0]?.delta?.content ?? '';
          if (delta) handlers.onDelta?.(delta);
          // Optional: detect error shape in-stream
          if (chunk?.error) handlers.onError?.(String(chunk.error?.message || 'stream error'));
        } catch {
          // ignore non-JSON lines
        }
      }
    }
    // flush rest
    if (buffer.trim() === 'data: [DONE]') handlers.onDone?.();
  } catch (e:any) {
    handlers.onError?.(String(e?.message || e));
  }
}

