/**
 * 游戏推广每日任务闭环 API（与 backend gamePromotionLogic / visits 配套）。
 * 流程：点击带 ?promo= 的链接 → recordClick → 登录/注册后 attribute / consumePending 归因。
 */
import type { ApiResponse } from '../api.types';
import { api } from '../base';

export interface GamePromotionClickRequest {
    promotionCode: string;
    anonId: string;
    clickedAt?: string;
}

export interface GamePromotionAttributeRequest {
    promotionCode: string;
    anonId?: string;
    clickedAt?: string;
    isNewUser?: boolean;
}

const gamePromotionApi = {
    /** 匿名用户点击推广链时上报（GameDetail 入口） */
    recordClick: (payload: GamePromotionClickRequest) =>
        api.post<ApiResponse<Record<string, unknown>>>('/auth/promotion/game/click', payload),
    /** 已登录用户点击或注册后立即归因到推广人 */
    attribute: (payload: GamePromotionAttributeRequest) =>
        api.post<ApiResponse<Record<string, unknown>>>('/auth/promotion/game/attribute', payload),
    /** 登录/进详情页时：把 sessionStorage 中待处理的点击一次性提交给后端 */
    consumePending: (anonId: string) =>
        api.post<ApiResponse<{ outcomes: unknown[] }>>('/auth/promotion/game/consume-pending', { anonId }),
};

export default gamePromotionApi;
