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

export type PrivateChatAbDto = {
  skipSelfIntro: boolean;
  idleProactive: boolean;
  idleProactiveMs: number;
};

export type PrivateChatThreadDto = {
  sessionId: string;
  npcId: string;
  messages: PrivateChatMessageDto[];
  lastProactiveAt?: string | null;
};

export type PrivateChatNpcDto = {
  id: string;
  name: string;
  relationship?: string;
  summary?: string;
  attitude?: string;
  detailedBio?: string;
  playerName?: string;
  avatarUrl?: string;
  avatarThumbUrl?: string;
};

export type PrivateChatPlayerDto = {
  name?: string;
  avatarUrl?: string;
  avatarThumbUrl?: string;
};

export type PrivateChatSseEvent =
  | { type: 'thread'; thread: PrivateChatThreadDto; npc?: PrivateChatNpcDto; ab?: PrivateChatAbDto }
  | { type: 'start' }
  | { type: 'delta'; text: string; replace?: boolean }
  | {
      type: 'done';
      thread: PrivateChatThreadDto;
      text: string;
      favorability?: number;
      favorabilityDelta?: number;
      playerEditableNpcs?: unknown[];
    }
  | { type: 'error'; message: string; code?: string };

async function consumeSse(
  res: Response,
  onEvent: (ev: PrivateChatSseEvent) => void,
): Promise<void> {
  if (!res.ok || !res.body) {
    const err = await parseJson(res);
    const error = new Error(err?.message || `HTTP ${res.status}`) as Error & { code?: string };
    if (err?.code) error.code = String(err.code);
    throw error;
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
      data?: {
        thread: PrivateChatThreadDto;
        npc: PrivateChatNpcDto;
        player?: PrivateChatPlayerDto;
        ab?: PrivateChatAbDto;
      };
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

  /** 再说一句：不删上一句，再生成一条助手消息 */
  continueMessage: async (
    token: string,
    sessionId: string,
    npcId: string,
    onEvent: (ev: PrivateChatSseEvent) => void,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}/continue`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      },
    );
    await consumeSse(res, onEvent);
  },

  /** 空线程时角色主动打招呼 */
  greet: async (
    token: string,
    sessionId: string,
    npcId: string,
    onEvent: (ev: PrivateChatSseEvent) => void,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}/greet`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      },
    );
    await consumeSse(res, onEvent);
  },

  /** 用户静默超时：角色主动再开口（A/B 实验组） */
  nudge: async (
    token: string,
    sessionId: string,
    npcId: string,
    onEvent: (ev: PrivateChatSseEvent) => void,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}/nudge`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      },
    );
    await consumeSse(res, onEvent);
  },

  /** 清空该角色私聊历史（不碰主线） */
  clearThread: async (token: string, sessionId: string, npcId: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/private-chat/${encodeURIComponent(npcId)}`,
      {
        method: 'DELETE',
        headers: authHeaders(token, false),
      },
    );
    return parseJson(res) as Promise<{
      success: boolean;
      message?: string;
      data?: { thread: PrivateChatThreadDto; npc: PrivateChatNpcDto };
    }>;
  },
};
