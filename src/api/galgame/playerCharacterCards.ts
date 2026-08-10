/**
 * 账号玩家角色卡 / 局内档案 API
 */
import { HOST_ADDRESS } from '../../config';
import type { SessionPlayerProfile } from '../../lib/galgame/playerCharacterCard';

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
    return parseJson(res) as Promise<{
      success: boolean;
      message?: string;
      data?: {
        profile?: SessionPlayerProfile;
        ab?: { generateOnChange?: boolean };
        avatarNeedsRegen?: boolean;
        protagonistChange?: { content?: string; fromName?: string; toName?: string };
      };
    }>;
  },
  /** 实验组：AI 生成主角头像并扣积分，写回 session */
  generatePlayerAvatar: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/player-avatar`,
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
        avatarThumbUrl?: string;
        profile?: SessionPlayerProfile;
        pointsDeducted: number;
        remainingPoints: number;
      };
    }>;
  },
  /** AI 生成局内玩家人设并扣积分（仅返回文案，不写 session） */
  generatePlayerPersona: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/player-persona`,
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
        text: string;
        pointsDeducted: number;
        remainingPoints: number;
      };
    }>;
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
        avatarThumbUrl?: string;
        npcId: string;
        pointsDeducted: number;
        remainingPoints: number;
      };
    }>;
  },
  /** AI 生成局内 NPC 档案字段（关系/简介/态度/详细简介）并扣积分 */
  generateNpcProfileField: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/npc-profile-field`,
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
        field: 'relationship' | 'summary' | 'attitudeToPlayer' | 'detailedBio';
        text: string;
        pointsDeducted: number;
        remainingPoints: number;
      };
    }>;
  },
};
