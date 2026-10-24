import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { AiBillingModelCatalogRow } from '../operator/aiModelCenterApi';
import type { AiModelCapability } from '../../lib/aiModelCatalog';

const aiModelCatalogApi = {
  importModels: (payload: { capability: AiModelCapability; modelIds: string[] }) =>
    api.post<ApiResponse<{ items: AiBillingModelCatalogRow[] }>>('/admin/ai-model-catalog/import', payload),

  activateModel: (catalogId: number, capability: AiModelCapability) =>
    api.post<ApiResponse<{
      capability: AiModelCapability;
      activeModelCatalogId: number;
      modelId: string;
      sourceGatewayLabel: string;
    }>>(`/admin/ai-model-catalog/${catalogId}/activate`, { capability }),

  deactivateModel: (catalogId: number) =>
    api.post<ApiResponse<{ id: number; selectable: false }>>(
      `/admin/ai-model-catalog/${catalogId}/deactivate`,
    ),
};

export default aiModelCatalogApi;
