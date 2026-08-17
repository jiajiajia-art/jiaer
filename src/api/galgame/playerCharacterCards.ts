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
  list: async (token: string, opts: { q?: string; kind?: string; tag?: string } | string = '') => {
    const q = typeof opts === 'string' ? opts : (opts.q || '');
    const kind = typeof opts === 'string' ? '' : (opts.kind || '');
    const tag = typeof opts === 'string' ? '' : (opts.tag || '');
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (kind) params.set('kind', kind);
    if (tag) params.set('tag', tag);
    const qs = params.toString() ? `?${params}` : '';
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards${qs}`, {
      headers: authHeaders(token),
    });
    return parseJson(res);
  },
  listPublic: async (token: string, opts: { q?: string; kind?: string; tag?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.q) params.set('q', opts.q);
    if (opts.kind) params.set('kind', opts.kind);
    if (opts.tag) params.set('tag', opts.tag);
    const qs = params.toString() ? `?${params}` : '';
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/public${qs}`, {
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
  setDefault: async (token: string, id: string) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/player-character-cards/${encodeURIComponent(id)}/default`,
      { method: 'POST', headers: authHeaders(token), body: '{}' },
    );
    return parseJson(res);
  },
  publish: async (token: string, id: string, isPublic = true) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/player-character-cards/${encodeURIComponent(id)}/publish`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ isPublic }),
      },
    );
    return parseJson(res);
  },
  importFromPublic: async (token: string, cardId: string) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/import-public`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ cardId }),
    });
    return parseJson(res);
  },
  /** 仓库编辑卡：AI 生成立绘（WebP ≤500KB、宽 ≤800） */
  generateAvatar: async (
    token: string,
    body: {
      name: string;
      gender?: string;
      persona?: string;
      cardId?: string;
      cardKind?: string;
      promptSupplement?: string;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/avatar`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{
      success: boolean;
      message?: string;
      code?: string;
      data?: {
        avatarUrl: string;
        avatarThumbUrl?: string;
        pointsDeducted: number;
        remainingPoints: number;
        bytes?: number;
        width?: number;
        format?: string;
        card?: unknown;
      };
    }>;
  },
  /** 仓库人设/角色卡：AI 生成简介文案，扣分对齐局内人设字段 */
  generatePersona: async (
    token: string,
    body: {
      name: string;
      gender?: string;
      existingPersona?: string;
      tags?: string;
      cardKind?: string;
    },
  ) => {
    const res = await fetch(`${HOST_ADDRESS}/api/player-character-cards/persona`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
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
  /** AI 生成主角头像并扣积分，写回 session */
  generatePlayerAvatar: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
    opts?: { signal?: AbortSignal },
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/player-avatar`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
        signal: opts?.signal,
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
  /** AI 生成局内玩家定位字段（立场/秘密）并扣积分 */
  generatePlayerPositioningField: async (
    token: string,
    sessionId: string,
    body: Record<string, unknown>,
  ) => {
    const res = await fetch(
      `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/player-positioning-field`,
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
        field: 'traits' | 'secret';
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
