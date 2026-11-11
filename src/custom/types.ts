// PostMessage protocol types for Custom IF host <-> UI
import type { Currency } from '../api/common/currency';

export type CustomIFScope = 'user' | 'session';

export interface CustomIFLogPayload {
  level?: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  message?: string;
  data?: any;
  time?: string;
}

export interface CustomIFKVGetPayload {
  requestId: string;
  scope?: CustomIFScope;
  namespace?: string;
  keys?: string[];
  prefix?: string;
  limit?: number;
}

export interface CustomIFKVSetItem {
  key: string;
  value: any;
  ttlSeconds?: number;
}

export interface CustomIFKVSetPayload {
  requestId: string;
  scope?: CustomIFScope;
  namespace?: string;
  items: CustomIFKVSetItem[];
}

export interface CustomIFKVDeletePayload {
  requestId: string;
  scope?: CustomIFScope;
  namespace?: string;
  keys: string[];
}

export interface CustomIFKVResultPayload {
  requestId: string;
  success: boolean;
  op: 'get' | 'set' | 'delete';
  code?: string;
  message?: string;
  kv?: {
    scope: CustomIFScope;
    namespace?: string;
    values: Record<string, any>;
  };
}

export interface CustomIFPointsPayPayload {
  requestId: string;
  amount: number;
  dryRun?: boolean;
}

export interface CustomIFPointsResultPayload {
  requestId: string;
  success: boolean;
  consumed?: number;
  balance?: number;
  currency?: Currency;
  code?: string;
  message?: string;
  txnId?: string;
}

export type UIToHostMessage =
  | { type: 'ai:init'; payload?: unknown }
  | { type: 'ai:send'; payload: { text: string; stream?: boolean } }
  | { type: 'ai:cancel'; payload: { requestId: string } }
  | { type: 'ai:history:get'; payload?: unknown }
  | { type: 'ai:regenerate'; payload: { historyIndex: number } }
  | { type: 'log:write'; payload: CustomIFLogPayload }
  | { type: 'kv:get'; payload: CustomIFKVGetPayload }
  | { type: 'kv:set'; payload: CustomIFKVSetPayload }
  | { type: 'kv:delete'; payload: CustomIFKVDeletePayload }
  | { type: 'points:pay'; payload: CustomIFPointsPayPayload };

export type HostToUIMessage =
  | { type: 'ai:ready'; payload: { appId: string; version: string; sessionId: string; entryUrl: string; manifest?: any } }
  | { type: 'ai:request-start'; payload: { requestId: string; inputPreview: string } }
  | { type: 'ai:token'; payload: { requestId: string; text: string; index: number } }
  | { type: 'ai:message'; payload: { requestId: string; finalText: string; finishReason?: string } }
  | { type: 'ai:request-error'; payload: { requestId: string; code: string; message: string } }
  | { type: 'ai:request-complete'; payload: { requestId: string; usage?: any; headers?: Record<string, string | null> } }
  | { type: 'ai:history'; payload: { messages: { role: 'system'|'user'|'assistant'; content: string }[] } }
  | { type: 'kv:result'; payload: CustomIFKVResultPayload }
  | { type: 'points:result'; payload: CustomIFPointsResultPayload }
  | { type: 'log:ack'; payload: { ok: boolean; code?: string; message?: string } };

export interface CustomIFSessionInfo {
  appId: string;
  sessionId: string;
  version: string;
  entryUrl: string;
  manifest?: any;
}

export interface ChatMessage { role: 'system'|'user'|'assistant'; content: string }

