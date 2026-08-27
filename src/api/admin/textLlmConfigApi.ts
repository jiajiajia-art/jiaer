import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { TextLlmModel, TextLlmUsageRow } from '../../lib/textLlmConfig';

export interface AdminTextLlmConfigData {
  models: string[];
  model: TextLlmModel | string;
  defaultModel: string;
  usageCatalog: TextLlmUsageRow[];
}

const adminTextLlmConfigApi = {
  getConfig: () =>
    api.get<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config'),

  saveConfig: (model: string) =>
    api.put<ApiResponse<AdminTextLlmConfigData>>('/admin/text-llm-config', { model }),
};

export default adminTextLlmConfigApi;
