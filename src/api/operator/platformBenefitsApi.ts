import { api } from '../base';
import type { ApiResponse } from '../api.types';

export interface PlatformBenefitConfig {
  inviteRewardKk: number;
  registrationRewardKk: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PublishPlatformBenefitsInput {
  inviteRewardKk: number;
  registrationRewardKk: number;
}

const platformBenefitsApi = {
  getConfig: () =>
    api.get<ApiResponse<PlatformBenefitConfig>>('/operator/platform-benefits'),
  publish: (input: PublishPlatformBenefitsInput) =>
    api.put<ApiResponse<PlatformBenefitConfig>>('/operator/platform-benefits/publish', input),
};

export default platformBenefitsApi;
