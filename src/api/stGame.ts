import { api } from './base';

export type StChatRole = 'system' | 'user' | 'assistant';

export type StChatMessage = {
  role: StChatRole;
  content: string;
};

export type StRenderRule = {
  id?: string;
  order: number;
  pattern: string;
  replace: string;
  stage?: 'render' | 'generate' | 'both';
  target?: 'reply' | 'system' | 'user' | 'assistant' | 'all';
};

export type StConfig = {
  preset: { system: string; model?: string; temperature?: number };
  persona: { name: string; description?: string; first_mes?: string };
  regex: StRenderRule[];
  globals?: Record<string, any>;
  variables?: Record<string, any>;
  preferCharacterId?: string;
};

export const stApi = {
  getConfig: (appId: string) => api.get<{ success: boolean; config: StConfig }>(`/st/apps/${appId}/config`),
  setConfig: (appId: string, cfg: StConfig) => api.post<{ success: boolean }>(`/st/apps/${appId}/config`, cfg),
  createSession: (appId: string, body: { autoStart?: boolean; globals?: any; prompt?: string }) =>
    api.post(`/st/apps/${appId}/session/create`, body, { timeout: 45000 }),
  getSession: (appId: string, sessionId: string) => api.get(`/st/apps/${appId}/session/${sessionId}`),
  act: (appId: string, sessionId: string, body: { input: string; globals?: any }) =>
    api.post(`/st/apps/${appId}/session/${sessionId}/action`, body, { timeout: 45000 }),
  actByMessages: (
    appId: string,
    sessionId: string,
    body: { messages: StChatMessage[]; globals?: any; model?: string; stream?: boolean },
  ) => api.post(`/st/apps/${appId}/session/${sessionId}/action-by-messages`, body, { timeout: 45000 }),
};
