import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { ImageGenGatewayPreset, ImageGenModel } from '../../lib/imageGenConfig';

export interface AdminImageGenModuleRow {
  key: string;
  label: string;
  description: string;
  model: ImageGenModel | string;
}

export interface AdminImageGenConfigData {
  models: string[];
  modules: AdminImageGenModuleRow[];
  catalog?: AdminImageGenModuleRow[];
  gatewayPresets?: ImageGenGatewayPreset[];
  openaiBaseUrl?: string;
  openaiBaseUrlFallback?: string;
  activeModelCatalogId?: number | null;
  activeModel?: string;
  apiKeySet?: boolean;
  apiKeyHint?: string;
}

export interface AdminImageGenModelsData {
  openaiBaseUrl: string;
  models: string[];
  count: number;
}

export interface AdminImageGenApiKeyData {
  openaiApiKey: string;
}

export interface SaveImageGenConfigPayload {
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  clearApiKey?: boolean;
}

const adminImageGenConfigApi = {
  /** 功能注释：读取各模块当前生图模型 + 独立网关 */
  getConfig: () =>
    api.get<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config'),

  getApiKey: () =>
    api.get<ApiResponse<AdminImageGenApiKeyData>>('/admin/image-gen-config/api-key'),

  saveConfig: (payload: SaveImageGenConfigPayload) =>
    api.put<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config', payload),

  listModels: (payload: { openaiBaseUrl?: string; openaiApiKey?: string }) =>
    api.post<ApiResponse<AdminImageGenModelsData>>('/admin/image-gen-config/models', payload),
};

export default adminImageGenConfigApi;
