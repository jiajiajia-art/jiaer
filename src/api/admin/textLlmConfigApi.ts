import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  TextLlmGatewayPreset,
  TextLlmModel,
  TextLlmUsageRow,
} from '../../lib/textLlmConfig';

export interface AdminTextLlmConfigData {
  models: string[];
  model: TextLlmModel | string;
  defaultModel: string;
  usageCatalog: TextLlmUsageRow[];
  gatewayPresets?: TextLlmGatewayPreset[];
  openaiBaseUrl?: string;
  openaiBaseUrlFallback?: string;
  modelCatalogId?: number | null;
  gatewayKeyStates?: Record<string, { keySet: boolean; keyHint: string }>;
  apiKeySet?: boolean;
  apiKeyHint?: string;
}

export interface AdminTextLlmModelsData {
  openaiBaseUrl: string;
  models: string[];
  count: number;
}

export interface SaveTextLlmConfigPayload {
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  clearApiKey?: boolean;
}

const adminTextLlmConfigApi = {
  getConfig: () =>
    api.get<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config'),

  saveConfig: (payload: SaveTextLlmConfigPayload) =>
    api.put<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config', payload),

  listModels: (payload: { openaiBaseUrl?: string; openaiApiKey?: string }) =>
    api.post<ApiResponse<AdminTextLlmModelsData>>('/admin/text-llm-config/models', payload),
};

export default adminTextLlmConfigApi;
