/**
 * 私聊 API 客户端
 */
import { HOST_ADDRESS } from '../../config';

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

export type PrivateChatMessageDto = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type PrivateChatThreadDto = {
  sessionId: string;
  npcId: string;
  messages: PrivateChatMessageDto[];
};

export type PrivateChatNpcDto = {
  id: string;
  name: string;
  relationship?: string;
  summary?: string;
  attitude?: string;
  playerName?: string;
};

export type PrivateChatSseEvent =
  | { type: 'thread'; thread: PrivateChatThreadDto; npc?: PrivateChatNpcDto }
  | { type: 'start' }
  | { type: 'delta'; text: string }
  | { type: 'done'; thread: PrivateChatThreadDto; text: string }
  | { type: 'error'; message: string; code?: string };

async function consumeSse(
  res: Response,
  onEvent: (ev: PrivateChatSseEvent) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    const err = await parseJson(res);
    throw new Error(err?.message || `HTTP ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';
    for (const chunk of chunks) {
      const line = chunk
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.startsWith('data:'));
      if (!line) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;
      try {
        onEvent(JSON.parse(raw) as PrivateChatSseEvent);
      } catch {
        // ignore malformed
      }
    }
  }
}

export const privateChatApi = {
  getThread: async (token: string, sessionId: string, npcId: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}`,
      { headers: authHeaders(token, false) },
    );
    return parseJson(res) as Promise<{
      success: boolean;
      message?: string;
      data?: { thread: PrivateChatThreadDto; npc: PrivateChatNpcDto };
    }>;
  },

  sendMessage: async (
    token: string,
    sessionId: string,
    npcId: string,
    content: string,
    onEvent: (ev: PrivateChatSseEvent) => void,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}/message`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ content }),
      },
    );
    await consumeSse(res, onEvent);
  },

  regenerate: async (
    token: string,
    sessionId: string,
    npcId: string,
    onEvent: (ev: PrivateChatSseEvent) => void,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}/regenerate`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      },
    );
    await consumeSse(res, onEvent);
  },
};
