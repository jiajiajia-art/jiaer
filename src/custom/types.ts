// PostMessage protocol types for Custom IF host <-> UI

export type UIToHostMessage =
  | { type: 'ai:init'; payload?: unknown }
  | { type: 'ai:send'; payload: { text: string; stream?: boolean } }
  | { type: 'ai:cancel'; payload: { requestId: string } }
  | { type: 'ai:history:get'; payload?: unknown }
  | { type: 'ai:regenerate'; payload: { historyIndex: number } };

export type HostToUIMessage =
  | { type: 'ai:ready'; payload: { appId: string; version: string; sessionId: string; entryUrl: string; manifest?: any } }
  | { type: 'ai:request-start'; payload: { requestId: string; inputPreview: string } }
  | { type: 'ai:token'; payload: { requestId: string; text: string; index: number } }
  | { type: 'ai:message'; payload: { requestId: string; finalText: string; finishReason?: string } }
  | { type: 'ai:request-error'; payload: { requestId: string; code: string; message: string } }
  | { type: 'ai:request-complete'; payload: { requestId: string; usage?: any; headers?: Record<string, string | null> } }
  | { type: 'ai:history'; payload: { messages: { role: 'system'|'user'|'assistant'; content: string }[] } };

export interface CustomIFSessionInfo {
  appId: string;
  sessionId: string;
  version: string;
  entryUrl: string;
  manifest?: any;
}

export interface ChatMessage { role: 'system'|'user'|'assistant'; content: string }

