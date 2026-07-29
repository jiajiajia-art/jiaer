/**
 * 账号玩家角色卡 / 局内档案 API
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

function authHeaders(token?: string | null): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export const playerCharacterCardsApi = {
  list: async (token: string, q = '') => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards${qs}`, {
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  create: async (token: string, body: Record<string, unknown>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  update: async (token: string, id: string, body: Record<string, unknown>) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res);
  },
  remove: async (token: string, id: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  importToSession: async (token: string, sessionId: string, cardId: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/import-player-card`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ cardId }),
      },
    );
    return parseJson(res);
  },
};

export const sessionPlayerProfileApi = {
  upsertNpc: async (
    token: string,
    sessionId: string,
    npcId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/npcs/${encodeURIComponent(npcId)}`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    );
    return parseJson(res);
  },
  putPlayerProfile: async (token: string, sessionId: string, body: Record<string, unknown>) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/player-profile`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    );
    return parseJson(res);
  },
  putGameStartConfig: async (token: string, sessionId: string, body: Record<string, unknown>) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/game-start-config`,
      {
        method: 'PUT',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    );
    return parseJson(res);
  },
  /** AI 生成局内 NPC 头像并扣积分 */
  generateNpcAvatar: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/npc-avatar`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      },
    );
    return parseJson(res) as Promise<{
      success: boolean;
      message?: string;
      code?: string;
      data?: {
        avatarUrl: string;
        npcId: string;
        pointsDeducted: number;
        remainingPoints: number;
      };
    }>;
  },
};
