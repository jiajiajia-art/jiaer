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
  apiKeySet?: boolean;
  apiKeyHint?: string;
}

export interface AdminTextLlmModelsData {
  openaiBaseUrl: string;
  models: string[];
  count: number;
}

export interface SaveTextLlmConfigPayload {
  model: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  clearApiKey?: boolean;
}

const adminTextLlmConfigApi = {
  getConfig: () =>
    api.get<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config'),

  saveConfig: (payload: SaveTextLlmConfigPayload | string) => {
    // 功能注释：兼容旧调用 saveConfig(model)；新调用传网关字段
    const body: SaveTextLlmConfigPayload =
      typeof payload === 'string' ? { model: payload } : payload;
    return api.put<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config', body);
  },

  listModels: (payload: { openaiBaseUrl?: string; openaiApiKey?: string }) =>
    api.post<ApiResponse<AdminTextLlmModelsData>>('/admin/text-llm-config/models', payload),
};

export default adminTextLlmConfigApi;
