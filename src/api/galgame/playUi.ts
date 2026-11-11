import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { QuestItem } from '../../lib/galgame/quests';
import type { SessionPlayerProfile } from '../../lib/galgame/playerCharacterCard';
import { parsePlayUiJson } from '../../lib/galgame/playUiState';

export interface PlayUiStateData {
  encounteredCharacterIds: string[];
  quests: QuestItem[];
  attributePanels: Record<string, string>;
  attributePanelsUpdatedAt?: string | null;
  questsUpdatedAt?: string | null;
  gameStartConfig?: Record<string, unknown> | null;
  playerEditableNpcs?: unknown[];
  sessionPlayerProfile?: SessionPlayerProfile | null;
  /** A/B：换角后 AI 生主角头像；未手改性别时跟创作台 */
  ab?: { playerAvatarOnChange?: boolean; npcGenderPreferPreset?: boolean } | null;
}

/** 功能注释：读取 session 上已持久化的出场/任务/属性缓存（无 LLM）。 */
export async function fetchPlayUiState(sessionId: string): Promise<PlayUiStateData> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/play-ui`;
  const res = await authFetch(url, { method: 'GET' });
  const text = await res.text();
  const json = parsePlayUiJson(text);
  if (!json) {
    const preview = text.trim().slice(0, 80);
    throw new Error(preview ? `面板缓存接口返回了非 JSON 内容：${preview}` : '面板缓存接口返回了空内容');
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  return {
    encounteredCharacterIds: Array.isArray(json.data?.encounteredCharacterIds)
      ? json.data.encounteredCharacterIds
      : [],
    quests: Array.isArray(json.data?.quests) ? json.data.quests : [],
    attributePanels:
      json.data?.attributePanels && typeof json.data.attributePanels === 'object'
        ? json.data.attributePanels
        : {},
    attributePanelsUpdatedAt: json.data?.attributePanelsUpdatedAt || null,
    questsUpdatedAt: json.data?.questsUpdatedAt || null,
    gameStartConfig:
      json.data?.gameStartConfig && typeof json.data.gameStartConfig === 'object'
        ? json.data.gameStartConfig
        : null,
    playerEditableNpcs: Array.isArray(json.data?.playerEditableNpcs)
      ? json.data.playerEditableNpcs
      : [],
    sessionPlayerProfile:
      json.data?.sessionPlayerProfile && typeof json.data.sessionPlayerProfile === 'object'
        ? (json.data.sessionPlayerProfile as SessionPlayerProfile)
        : null,
    ab:
      json.data?.ab && typeof json.data.ab === 'object'
        ? (() => {
            const raw = json.data.ab as {
              playerAvatarOnChange?: boolean;
              npcGenderPreferPreset?: boolean;
            };
            // 缺字段勿用 !! 变成 false，否则会盖掉前端「默认跟创作台」
            return {
              playerAvatarOnChange: !!raw.playerAvatarOnChange,
              ...(typeof raw.npcGenderPreferPreset === 'boolean'
                ? { npcGenderPreferPreset: raw.npcGenderPreferPreset }
                : {}),
            };
          })()
        : null,
  };
}

/** 功能注释：角色档案打开时批量 ensure 150 头部小图。 */
export async function fetchCharacterAvatarThumbs(sessionId: string): Promise<{
  npcAvatarThumbs: Record<string, string>;
  playerEditableNpcs: unknown[];
  sessionPlayerProfile: SessionPlayerProfile | null;
}> {
  const url = `${HOST_ADDRESS}/api/visual/session/${encodeURIComponent(sessionId)}/character-avatar-thumbs`;
  const res = await authFetch(url, { method: 'GET' });
  const text = await res.text();
  const json = parsePlayUiJson(text);
  if (!json) {
    throw new Error('角色头像接口返回了非 JSON 内容');
  }
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `HTTP ${res.status}`);
  }
  const thumbs =
    json.data?.npcAvatarThumbs && typeof json.data.npcAvatarThumbs === 'object'
      ? (json.data.npcAvatarThumbs as Record<string, string>)
      : {};
  return {
    npcAvatarThumbs: thumbs,
    playerEditableNpcs: Array.isArray(json.data?.playerEditableNpcs)
      ? json.data.playerEditableNpcs
      : [],
    sessionPlayerProfile:
      json.data?.sessionPlayerProfile && typeof json.data.sessionPlayerProfile === 'object'
        ? (json.data.sessionPlayerProfile as SessionPlayerProfile)
        : null,
  };
}
