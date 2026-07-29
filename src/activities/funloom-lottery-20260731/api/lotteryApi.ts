import type { ApiResponse } from '../../../api/api.types';
import { api } from '../../../api/base';
import type {
  DrawResultPrize,
  LotteryCampaign,
  LotteryDraw,
  LotteryPrizePublic,
} from '../lib/lotteryClient';
import { LOTTERY_SLUG } from '../lib/lotteryClient';

export interface LotteryCampaignPayload {
  campaign: LotteryCampaign;
  prizes: LotteryPrizePublic[];
  myTodayDraw: LotteryDraw | null;
  /** 活动内最近一次抽奖；once_per_activity 时用于禁用再抽 */
  myDraw?: LotteryDraw | null;
  canDraw: boolean;
  requireLoginToDraw: boolean;
}

export interface LotteryDrawPayload {
  campaign: LotteryCampaign;
  draw: LotteryDraw;
  prize: DrawResultPrize;
}

const lotteryApi = {
  getCampaign: (slug: string = LOTTERY_SLUG) =>
    api.get<ApiResponse<LotteryCampaignPayload>>(`/lottery/campaigns/${encodeURIComponent(slug)}`),

  draw: (slug: string = LOTTERY_SLUG, requestId?: string) =>
    api.post<ApiResponse<LotteryDrawPayload>>(`/lottery/campaigns/${encodeURIComponent(slug)}/draw`, {
      requestId,
    }),

  saveShipping: (
    drawId: number,
    body: { recipientName: string; phone: string; address: string },
  ) =>
    api.post<ApiResponse<{ drawId: number }>>(`/lottery/draws/${drawId}/shipping`, body),

  listMine: (slug: string = LOTTERY_SLUG) =>
    api.get<ApiResponse<{ campaign: LotteryCampaign; items: LotteryDraw[] }>>(
      `/lottery/campaigns/${encodeURIComponent(slug)}/me`,
    ),

  listRecent: (slug: string = LOTTERY_SLUG, limit = 20) =>
    api.get<
      ApiResponse<{
        items: Array<{
          id: number;
          prizeKey: string;
          prizeName: string;
          displayName: string;
          createdAt: string;
        }>;
      }>
    >(`/lottery/campaigns/${encodeURIComponent(slug)}/recent`, { params: { limit } }),

  retryPoints: (drawId: number) =>
    api.post<ApiResponse<LotteryDraw>>(`/lottery/draws/${drawId}/retry-points`, {}),

  adminListDraws: (params?: { slug?: string; prizeKey?: string }) =>
    api.get<
      ApiResponse<{
        campaign: LotteryCampaign;
        prizes: Array<{ prizeKey: string; name: string; weight: number; remaining: number }>;
        items: unknown[];
      }>
    >('/admin/lottery/draws', { params }),

  /** 功能注释：保存活动起止时间与一等奖权重（≤0 = 永远抽不中） */
  adminUpdateCampaign: (body: {
    slug?: string;
    startsAt: string;
    endsAt: string;
    firstPrizeWeight: number;
  }) =>
    api.put<
      ApiResponse<{
        campaign: LotteryCampaign;
        prizes: Array<{ prizeKey: string; name: string; weight: number; remaining: number }>;
      }>
    >('/admin/lottery/campaign', body),

  adminExportShippingUrl: (slug: string = LOTTERY_SLUG) =>
    `/api/admin/lottery/shipping-export?slug=${encodeURIComponent(slug)}`,
};

export default lotteryApi;
