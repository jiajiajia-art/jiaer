import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { QuestItem } from '../../lib/galgame/quests';
import { parsePlayUiJson } from '../../lib/galgame/playUiState';

export interface PlayUiStateData {
  encounteredCharacterIds: string[];
  quests: QuestItem[];
  attributePanels: Record<string, string>;
  attributePanelsUpdatedAt?: string | null;
  questsUpdatedAt?: string | null;
  gameStartConfig?: Record<string, unknown> | null;
  playerEditableNpcs?: unknown[];
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
  };
}
