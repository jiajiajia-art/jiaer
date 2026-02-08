import type { ApiResponse } from "../api.types";
import { api } from "../base";

export interface AnalyticsEndRequest {
    durationSeconds: number;
    gameFileId?: string;
}

export interface EnterGameDetailRequest {
    gameFileId: string;
    source: 'link' | 'main_page' | 'search' | 'other';
}

export const trackingApi = {
    // 时长统计接口（游戏时长和平台停留时长共用）
    // - 游戏时长：传递 durationSeconds 和 gameFileId
    // - 平台停留时长：只传递 durationSeconds（不传 gameFileId）
    analyticsEnd: (data: AnalyticsEndRequest) => {
        return api.post<ApiResponse<null>>(`/analytics/session/duration`, data);
    },
    // 进入游戏详情页
    enterGameDetail: (data: EnterGameDetailRequest) => {
        return api.post<ApiResponse<null>>(`/analytics/game-detail-view`, data);
    },
}
