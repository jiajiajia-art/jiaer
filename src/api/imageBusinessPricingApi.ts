import type { ApiResponse } from './api.types';
import { api } from './base';

export type ImageBusinessScenarioKey =
  | 'visual_character'
  | 'visual_character_variant'
  | 'visual_scene'
  | 'visual_cover_landscape'
  | 'visual_cover_portrait'
  | 'session_avatar_control'
  | 'warehouse_card';

export interface ImageBusinessResolutionPrice {
  size: string;
  aspectRatio: string;
  userChargeMicro: number;
  estimatedPoints: number;
  estimatedUnits?: number;
}

export interface ImageBusinessPrice {
  scenarioKey: ImageBusinessScenarioKey;
  label: string;
  categoryKey?: string;
  categoryLabel?: string;
  categoryOrder?: number;
  order?: number;
  modelCatalogId: number;
  modelId: string;
  modelName: string;
  pricingVersionId: number;
  pricingEffectiveAt: string;
  benefitPercent: number;
  resolutions: ImageBusinessResolutionPrice[];
  estimatedPoints: number;
  maxRequiredPoints: number;
  currency?: 'kk' | 'points';
  estimatedUnits?: number;
  maxRequiredUnits?: number;
}

const imageBusinessPricingApi = {
  list: (params?: {
    scenarioKey?: ImageBusinessScenarioKey;
    fileId?: string | null;
    sessionId?: string | null;
  }) =>
    api.get<ApiResponse<{ items: ImageBusinessPrice[] }>>('/ai-image/business-prices', {
      params: {
        scenarioKey: params?.scenarioKey,
        fileId: params?.fileId || undefined,
        sessionId: params?.sessionId || undefined,
      },
    }),
};

export default imageBusinessPricingApi;
