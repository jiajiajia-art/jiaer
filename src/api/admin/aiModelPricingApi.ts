import type { ApiResponse } from '../api.types';
import { api } from '../base';
import type {
  AiModelPricingPayload,
  AiModelPricingRecord,
} from '../../lib/aiModelPricing';

export interface AiModelPricingListData {
  items: AiModelPricingRecord[];
}

const adminAiModelPricingApi = {
  list: () =>
    api.get<ApiResponse<AiModelPricingListData>>('/admin/ai-model-pricing'),

  create: (payload: AiModelPricingPayload) =>
    api.post<ApiResponse<AiModelPricingRecord>>('/admin/ai-model-pricing', payload),

  update: (id: number, payload: AiModelPricingPayload) =>
    api.put<ApiResponse<AiModelPricingRecord>>(`/admin/ai-model-pricing/${id}`, payload),
};

export default adminAiModelPricingApi;
