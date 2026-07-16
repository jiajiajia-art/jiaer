import { authFetch } from '../base';
import { HOST_ADDRESS } from '../../config';
import type { QuestItem } from '../../lib/galgame/quests';

export interface PlayUiStateData {
  encounteredCharacterIds: string[];
  quests: QuestItem[];
  attributePanels: Record<string, string>;
  attributePanelsUpdatedAt?: string | null;
  questsUpdatedAt?: string | null;
}

/** 功能注释：读取 session 上已持久化的出场/任务/属性缓存（无 LLM）。 */
export async function fetchPlayUiState(sessionId: string): Promise<PlayUiStateData> {
  const url = `${HOST_ADDRESS}/api/visual/session/${sessionId}/play-ui`;
  const res = await authFetch(url, { method: 'GET' });
  const json = await res.json();
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
  };
}
