import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type { ImageBusinessPrice, ImageBusinessResolutionPrice, ImageBusinessScenarioKey } from '../imageBusinessPricingApi';

export interface ImageBusinessAvailableModel {
  id: number;
  modelId: string;
  displayName: string;
  sourceGatewayLabel: string;
  selectable: boolean;
  activePricingVersionId: number | null;
  scheduledPricingVersionId: number | null;
  imageTiers: Array<{
    aspectRatio: string;
    userBasePriceKkX10000: number;
  }>;
}

export interface AdminImageBusinessConfig {
  scenarioKey: ImageBusinessScenarioKey;
  label: string;
  categoryKey: string;
  categoryLabel: string;
  categoryOrder: number;
  order: number;
  resolutions: ImageBusinessResolutionPrice[];
  modelCatalogId: number | null;
  modelId: string | null;
  modelName: string | null;
  primaryAspectRatioKey: string;
  selectable: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  pricing: ImageBusinessPrice | null;
  scheduledPricingVersionId?: number | null;
  validationError?: { code: string; message: string } | null;
}

const imageBusinessConfigApi = {
  list: () => api.get<ApiResponse<{
    items: AdminImageBusinessConfig[];
    availableModels: ImageBusinessAvailableModel[];
  }>>('/admin/ai-image-business-configs'),

  update: (
    scenarioKey: ImageBusinessScenarioKey,
    payload: {
      modelCatalogId: number;
      primaryAspectRatioKey: string;
      expectedUpdatedAt?: string | null;
    },
  ) => api.put<ApiResponse<AdminImageBusinessConfig>>(
    `/admin/ai-image-business-configs/${scenarioKey}`,
    payload,
  ),
};

export default imageBusinessConfigApi;
