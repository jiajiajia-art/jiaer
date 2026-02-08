import { api } from '../base';

export interface BetaWhitelistResponse {
  success: boolean;
  whitelisted: boolean;
  sourceKey?: string | null;
  updatedAt?: string;
  message?: string;
}

// Galgame 内测白名单查询
const betaWhitelistApi = {
  get: (fileId: string) => api.get<BetaWhitelistResponse>(`/visual/whitelist/${fileId}`),
};

export default betaWhitelistApi;

