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
  apiKeySet?: boolean;
  apiKeyHint?: string;
}

export interface AdminImageGenModelsData {
  openaiBaseUrl: string;
  models: string[];
  count: number;
}

export interface SaveImageGenConfigPayload {
  models: Record<string, string>;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  clearApiKey?: boolean;
}

const adminImageGenConfigApi = {
  /** 功能注释：读取各模块当前生图模型 + 独立网关 */
  getConfig: () =>
    api.get<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config'),

  /** 功能注释：批量保存模块模型，并可同请求保存生图网关 */
  saveConfig: (payload: SaveImageGenConfigPayload | Record<string, string>) => {
    const body: SaveImageGenConfigPayload =
      payload && typeof payload === 'object' && 'models' in payload
        ? (payload as SaveImageGenConfigPayload)
        : { models: payload as Record<string, string> };
    return api.put<ApiResponse<AdminImageGenConfigData>>('/admin/image-gen-config', body);
  },

  listModels: (payload: { openaiBaseUrl?: string; openaiApiKey?: string }) =>
    api.post<ApiResponse<AdminImageGenModelsData>>('/admin/image-gen-config/models', payload),
};

export default adminImageGenConfigApi;
