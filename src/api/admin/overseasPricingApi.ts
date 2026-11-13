import { api } from '../base';
import type { ApiResponse } from '../api.types';

/** 海外充值倍率配置：海外价 = 人民币价 × 倍率 */
export interface OverseasPricingPlan {
  planId: string;
  label: string;
  cnyPrice: number;
  /** null 表示跟随默认倍率 */
  multiplier: number | null;
}

export interface OverseasPricingConfig {
  currency: 'USD';
  defaultMultiplier: number;
  plans: OverseasPricingPlan[];
}

const overseasPricingApi = {
  get: () => api.get<ApiResponse<OverseasPricingConfig>>('/admin/pay/overseas-pricing'),
  update: (payload: Pick<OverseasPricingConfig, 'defaultMultiplier' | 'plans'>) =>
    api.put<ApiResponse<OverseasPricingConfig>>('/admin/pay/overseas-pricing', payload),
};

export default overseasPricingApi;
